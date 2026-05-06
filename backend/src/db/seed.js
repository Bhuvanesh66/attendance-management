/**
 * SkillBridge demo seed.
 *
 * Creates 5 Clerk users (one per role) using the Clerk admin API, then
 * provisions a demo institution, batch, session, invite, and a sample
 * attendance row so a grader can sign in as any role and immediately see
 * realistic data.
 *
 * Run:    npm run seed -w backend
 *
 * Idempotent: re-running is safe. Existing Clerk users (matched by email)
 * are reused; existing DB rows (matched by clerk_user_id) are not duplicated.
 */

require("../server/loadEnv").loadBackendEnv();

const crypto = require("crypto");
const { clerkClient } = require("@clerk/clerk-sdk-node");
const { db } = require("./db");
const { requireEnv } = require("../server/env");

const DEMO_PASSWORD = "Skill@Bridge1";
const TZ_OFFSET_MIN = Number(process.env.SKILLBRIDGE_TZ_OFFSET_MINUTES || 330); // IST default

const DEMO_USERS = [
  {
    role: "Student",
    email: "student.demo@skillbridge.example.com",
    firstName: "Sam",
    lastName: "Student",
  },
  {
    role: "Trainer",
    email: "trainer.demo@skillbridge.example.com",
    firstName: "Tara",
    lastName: "Trainer",
  },
  {
    role: "Institution",
    email: "institution.demo@skillbridge.example.com",
    firstName: "Indira",
    lastName: "Institute",
  },
  {
    role: "ProgrammeManager",
    email: "pm.demo@skillbridge.example.com",
    firstName: "Priya",
    lastName: "Manager",
  },
  {
    role: "MonitoringOfficer",
    email: "mo.demo@skillbridge.example.com",
    firstName: "Mohan",
    lastName: "Officer",
  },
];

const DEMO_INSTITUTION_NAME = "SkillBridge Demo Academy";
const DEMO_BATCH_NAME = "Cohort Alpha — Web Dev";
const DEMO_SESSION_TITLE = "Intro to SkillBridge";

async function findOrCreateClerkUser({ email, firstName, lastName, role }) {
  const list = await clerkClient.users.getUserList({ emailAddress: [email] });
  const existing = Array.isArray(list)
    ? list[0]
    : Array.isArray(list?.data)
      ? list.data[0]
      : null;
  if (existing) {
    try {
      await clerkClient.users.updateUser(existing.id, {
        firstName,
        lastName,
        publicMetadata: { role },
      });
    } catch (e) {
      console.warn(`  [warn] could not update Clerk user metadata for ${email}: ${e.message}`);
    }
    return { id: existing.id, reused: true };
  }

  // skipPasswordChecks lets us seed predictable demo passwords even on dev
  // instances with strict password policies (e.g. leaked-password check).
  const created = await clerkClient.users.createUser({
    emailAddress: [email],
    password: DEMO_PASSWORD,
    firstName,
    lastName,
    skipPasswordChecks: true,
    skipPasswordRequirement: false,
    publicMetadata: { role },
  });
  return { id: created.id, reused: false };
}

function programmeLocalSessionWindow() {
  // Place the session window so it brackets "now" in the configured timezone
  // — guarantees the seeded student can mark attendance right after seeding.
  const now = new Date();
  const utcMs = now.getTime();
  const localMs = utcMs + TZ_OFFSET_MIN * 60_000;
  const local = new Date(localMs);

  const dateStr = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, "0")}-${String(local.getUTCDate()).padStart(2, "0")}`;

  // start = now - 30min (clamped to 00:00), end = now + 4h (clamped to 23:59)
  const startLocal = new Date(localMs - 30 * 60_000);
  const endLocal = new Date(localMs + 4 * 60 * 60_000);

  // If now is near midnight, sessions can't span days (date column is single day).
  // Clamp both endpoints to the same date as `local`.
  function clampSameDay(d) {
    const sameDay =
      d.getUTCFullYear() === local.getUTCFullYear() &&
      d.getUTCMonth() === local.getUTCMonth() &&
      d.getUTCDate() === local.getUTCDate();
    return sameDay ? d : null;
  }

  const startSafe = clampSameDay(startLocal) || new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 0, 0, 0));
  const endSafe = clampSameDay(endLocal) || new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 23, 59, 0));

  const fmt = (d) =>
    `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}:00`;

  return {
    date: dateStr,
    startTime: fmt(startSafe),
    endTime: fmt(endSafe),
  };
}

async function main() {
  requireEnv("DATABASE_URL");
  requireEnv("CLERK_SECRET_KEY");

  console.log("\n[seed] starting SkillBridge demo seed\n");

  // 1) Create / reuse Clerk users + DB user rows.
  const usersByRole = {};
  for (const u of DEMO_USERS) {
    process.stdout.write(`[seed] ${u.role.padEnd(18)} ${u.email}  `);
    const { id: clerkUserId, reused } = await findOrCreateClerkUser(u);

    const existing = await db.users.getByClerkUserId(clerkUserId);
    let dbUser;
    if (existing) {
      // Make sure role is set (existing seeds may have nulls).
      if (existing.role !== u.role) {
        dbUser = await db.users.upsertRole({
          clerkUserId,
          role: u.role,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
        });
      } else {
        dbUser = existing;
      }
    } else {
      dbUser = await db.users.upsertRole({
        clerkUserId,
        role: u.role,
        name: `${u.firstName} ${u.lastName}`,
        email: u.email,
      });
    }
    usersByRole[u.role] = dbUser;
    console.log(reused ? "(reused)" : "(created)");
  }

  // 2) Make sure a demo institution exists; attach Institution + Trainer to it.
  let institution = null;
  if (usersByRole.Institution.institution_id) {
    institution = await db.institutions.getById(usersByRole.Institution.institution_id);
  }
  if (!institution) {
    // Reuse an institution with the demo name if it exists, else create.
    const all = await db.query(
      "select id, name, created_at from institutions where name = $1 order by created_at asc limit 1",
      [DEMO_INSTITUTION_NAME]
    );
    institution = all.rows[0] || (await db.institutions.create({ name: DEMO_INSTITUTION_NAME }));
    await db.users.setInstitutionId(usersByRole.Institution.id, institution.id);
    usersByRole.Institution = await db.users.getByClerkUserId(usersByRole.Institution.clerk_user_id);
  }
  console.log(`[seed] institution: ${institution.name} (${institution.id})`);

  if (!usersByRole.Trainer.institution_id) {
    await db.users.setInstitutionId(usersByRole.Trainer.id, institution.id);
    usersByRole.Trainer = await db.users.getByClerkUserId(usersByRole.Trainer.clerk_user_id);
  }

  // 3) Batch — find by name+institution or create.
  const existingBatch = await db.query(
    "select id, name, institution_id, created_at from batches where institution_id = $1 and name = $2",
    [institution.id, DEMO_BATCH_NAME]
  );
  const batch =
    existingBatch.rows[0] ||
    (await db.batches.create({ name: DEMO_BATCH_NAME, institutionId: institution.id }));
  console.log(`[seed] batch: ${batch.name} (${batch.id})`);

  // 4) Trainer ↔ batch link, Student ↔ batch enrolment.
  await db.query(
    "insert into batch_trainers (batch_id, trainer_id) values ($1, $2) on conflict do nothing",
    [batch.id, usersByRole.Trainer.id]
  );
  await db.query(
    "insert into batch_students (batch_id, student_id) values ($1, $2) on conflict do nothing",
    [batch.id, usersByRole.Student.id]
  );

  // 5) Session — find one for today (in programme TZ) or create.
  const window = programmeLocalSessionWindow();
  const existingSession = await db.query(
    `select id, batch_id, trainer_id, title, date, start_time, end_time, created_at
       from sessions
      where batch_id = $1 and title = $2 and date = $3
      order by created_at desc
      limit 1`,
    [batch.id, DEMO_SESSION_TITLE, window.date]
  );
  let session = existingSession.rows[0];
  if (!session) {
    const r = await db.query(
      `insert into sessions (batch_id, trainer_id, title, date, start_time, end_time)
       values ($1, $2, $3, $4, $5, $6)
       returning id, batch_id, trainer_id, title, date, start_time, end_time, created_at`,
      [
        batch.id,
        usersByRole.Trainer.id,
        DEMO_SESSION_TITLE,
        window.date,
        window.startTime,
        window.endTime,
      ]
    );
    session = r.rows[0];
  } else {
    // Always widen the existing session window so demo attendance still works.
    const r = await db.query(
      `update sessions
          set start_time = $1, end_time = $2
        where id = $3
        returning id, batch_id, trainer_id, title, date, start_time, end_time, created_at`,
      [window.startTime, window.endTime, session.id]
    );
    session = r.rows[0];
  }
  console.log(
    `[seed] session: ${session.title} on ${session.date} ${String(session.start_time).slice(0, 5)}–${String(session.end_time).slice(0, 5)} (${session.id})`
  );

  // 6) Reusable invite token for the demo batch (so a fresh student can join too).
  const inviteRow = await db.query(
    "select id, token from batch_invites where batch_id = $1 and reusable = true order by created_at asc limit 1",
    [batch.id]
  );
  let inviteToken;
  if (inviteRow.rows[0]) {
    inviteToken = inviteRow.rows[0].token;
  } else {
    inviteToken = crypto.randomBytes(24).toString("hex");
    await db.query(
      `insert into batch_invites
         (batch_id, token, created_by_trainer_id, reusable)
       values ($1, $2, $3, true)`,
      [batch.id, inviteToken, usersByRole.Trainer.id]
    );
  }
  console.log(`[seed] invite token: ${inviteToken.slice(0, 12)}…`);

  // 7) A sample attendance row so summaries aren't all-zero on first login.
  await db.query(
    `insert into attendance (session_id, student_id, status)
       values ($1, $2, 'present')
     on conflict (session_id, student_id) do nothing`,
    [session.id, usersByRole.Student.id]
  );

  // 8) Print credentials for the grader.
  const line = "─".repeat(72);
  console.log(`\n${line}`);
  console.log("✅  SkillBridge demo data ready");
  console.log(`${line}`);
  console.log("\nLog in via the app with any of these accounts (password is the same for all):\n");
  console.log(`  Password:  ${DEMO_PASSWORD}\n`);
  for (const u of DEMO_USERS) {
    const dbUser = usersByRole[u.role];
    const role = u.role.padEnd(18);
    console.log(`  ${role}  ${u.email}`);
    console.log(`  ${"".padEnd(18)}    user.id = ${dbUser.id}`);
  }
  console.log(`\n  Institution: ${institution.name}`);
  console.log(`  Institution ID: ${institution.id}`);
  console.log(`  Batch:        ${batch.name}`);
  console.log(`  Batch ID:     ${batch.id}`);
  console.log(`  Session:      ${session.title}  (${session.date} ${String(session.start_time).slice(0, 5)}–${String(session.end_time).slice(0, 5)} programme local)`);
  console.log(`  Invite token: ${inviteToken}`);
  console.log(`${line}\n`);
}

main()
  .catch((e) => {
    console.error("\n[seed] failed:", e?.message || e);
    if (e?.errors) {
      try { console.error("[seed] details:", JSON.stringify(e.errors, null, 2)); } catch { /* ignore */ }
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await db.pool.end();
    } catch {
      // ignore
    }
  });
