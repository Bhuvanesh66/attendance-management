require("../server/loadEnv").loadBackendEnv();

const fs = require("fs");
const path = require("path");
const { db } = require("./db");
const { requireEnv } = require("../server/env");

async function ensureMigrationsTable() {
  await db.query(`
    create table if not exists schema_migrations (
      id text primary key,
      applied_at timestamptz not null default now()
    );
  `);
}

async function getAppliedMigrationIds() {
  const r = await db.query("select id from schema_migrations order by id asc");
  return new Set(r.rows.map((x) => x.id));
}

function listMigrationFiles() {
  const migrationsDir = path.join(__dirname, "..", "..", "migrations");
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d+_.+\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b));
  return files.map((f) => ({
    id: f,
    fullPath: path.join(migrationsDir, f),
  }));
}

async function applyMigration(client, migration) {
  const sql = fs.readFileSync(migration.fullPath, "utf8");
  await client.query(sql);
  await client.query("insert into schema_migrations (id) values ($1)", [
    migration.id,
  ]);
}

async function migrate() {
  // Fail fast with a helpful message instead of trying localhost/defaults.
  requireEnv("DATABASE_URL");

  await ensureMigrationsTable();
  const applied = await getAppliedMigrationIds();
  const migrations = listMigrationFiles().filter((m) => !applied.has(m.id));

  if (migrations.length === 0) {
    console.log("[migrate] up to date");
    return;
  }

  const client = await db.pool.connect();
  try {
    await client.query("begin");
    for (const m of migrations) {
      console.log(`[migrate] applying ${m.id}`);
      await applyMigration(client, m);
    }
    await client.query("commit");
    console.log(`[migrate] applied ${migrations.length} migration(s)`);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

migrate()
  .catch((e) => {
    console.error("[migrate] failed", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.pool.end();
    } catch {
      // ignore
    }
  });

