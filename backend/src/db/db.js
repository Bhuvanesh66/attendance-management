const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function query(text, params) {
  return pool.query(text, params);
}

/** DB may enforce NOT NULL on users.name; Clerk often has no name on first hit. */
function normalizeDisplayName(name) {
  if (typeof name === "string" && name.trim()) return name.trim();
  return "SkillBridge user";
}

/** Stable synthetic email when DB requires NOT NULL and JWT has no email. */
function normalizeUserEmail(clerkUserId, email) {
  if (typeof email === "string") {
    const t = email.trim().toLowerCase();
    if (t.includes("@") && t.length > 4) return t;
  }
  const safe = clerkUserId.replace(/[^a-zA-Z0-9_]/g, "_");
  return `${safe}@users.skillbridge.local`;
}

const users = {
  async getByClerkUserId(clerkUserId) {
    const r = await query(
      "select id, clerk_user_id, name, role, institution_id, created_at, email from users where clerk_user_id = $1",
      [clerkUserId]
    );
    return r.rows[0] || null;
  },

  async getOrCreateByClerkUserId({ clerkUserId, name, email }) {
    const displayName = normalizeDisplayName(name);
    const mailbox = normalizeUserEmail(clerkUserId, email);
    // INSERT … ON CONFLICT: parallel /me requests must not fail on unique violation.
    const r = await query(
      `insert into users (clerk_user_id, name, role, email)
       values ($1, $2, $3, $4)
       on conflict (clerk_user_id) do update
         set name = coalesce(nullif(trim(excluded.name::text), ''), users.name),
             email = coalesce(nullif(trim(excluded.email::text), ''), users.email)
       returning id, clerk_user_id, name, role, institution_id, created_at, email`,
      [clerkUserId, displayName, null, mailbox]
    );
    return r.rows[0];
  },

  async upsertRole({ clerkUserId, role, name, email }) {
    const displayName = normalizeDisplayName(name);
    const mailbox = normalizeUserEmail(clerkUserId, email);
    const r = await query(
      `insert into users (clerk_user_id, name, role, email)
       values ($1, $2, $3, $4)
       on conflict (clerk_user_id) do update
         set role = excluded.role,
             name = coalesce(nullif(trim(excluded.name::text), ''), users.name),
             email = coalesce(nullif(trim(excluded.email::text), ''), users.email)
       returning id, clerk_user_id, name, role, institution_id, created_at, email`,
      [clerkUserId, displayName, role, mailbox]
    );
    return r.rows[0];
  },

  async setInstitutionId(userId, institutionId) {
    const r = await query(
      `update users
         set institution_id = $1
       where id = $2
       returning id, clerk_user_id, name, role, institution_id, created_at, email`,
      [institutionId, userId]
    );
    return r.rows[0];
  },
};

const institutions = {
  async create({ name }) {
    const r = await query(
      "insert into institutions (name) values ($1) returning id, name, created_at",
      [name]
    );
    return r.rows[0];
  },

  async createWithId({ id, name }) {
    const r = await query(
      "insert into institutions (id, name) values ($1, $2) returning id, name, created_at",
      [id, name]
    );
    return r.rows[0];
  },

  async getById(id) {
    const r = await query("select id, name, created_at from institutions where id = $1", [
      id,
    ]);
    return r.rows[0] || null;
  },

  async rename(id, name) {
    const r = await query(
      "update institutions set name = $1 where id = $2 returning id, name, created_at",
      [name, id]
    );
    return r.rows[0] || null;
  },

  async listAll() {
    const r = await query(
      "select id, name, created_at from institutions order by created_at desc"
    );
    return r.rows;
  },
};

const batches = {
  async create({ name, institutionId }) {
    const r = await query(
      "insert into batches (name, institution_id) values ($1, $2) returning id, name, institution_id, created_at",
      [name, institutionId]
    );
    return r.rows[0];
  },

  async getById(id) {
    const r = await query(
      "select id, name, institution_id, created_at from batches where id = $1",
      [id]
    );
    return r.rows[0] || null;
  },
};

const db = { query, users, pool };

module.exports = { db: { ...db, institutions, batches } };

