const { httpError } = require("./http");

async function ensureInstitutionForInstitutionUser({ db, user }) {
  if (user.role !== "Institution") return user;
  if (user.institution_id) return user;

  const inst = await db.institutions.create({
    name: user.name ? `${user.name} Institution` : "Institution",
  });

  const r = await db.query(
    "update users set institution_id = $1 where id = $2 returning id, clerk_user_id, name, role, institution_id, created_at, email",
    [inst.id, user.id]
  );
  return r.rows[0];
}

/**
 * Trainers need an institution_id to create batches (FK on batches).
 * For demos we provision a small organisation automatically — same idea as Institution-role signup.
 */
async function ensureTrainerHasInstitution({ db, user }) {
  if (user.role !== "Trainer") return user;
  if (user.institution_id) return user;

  // If there is already an institution in the system (common in demos),
  // attach the trainer to the newest one so Institution dashboards can manage trainers + batches together.
  // If none exists, create a demo institution for this trainer.
  const existing = await db.query("select id from institutions order by created_at desc limit 1");
  const inst =
    existing.rows[0]?.id
      ? { id: existing.rows[0].id }
      : await db.institutions.create({
          name: user.name ? `${user.name}'s organisation (demo)` : "Trainer organisation (demo)",
        });

  const r = await db.query(
    "update users set institution_id = $1 where id = $2 returning id, clerk_user_id, name, role, institution_id, created_at, email",
    [inst.id, user.id]
  );
  return r.rows[0];
}

module.exports = {
  ensureInstitutionForInstitutionUser,
  ensureTrainerHasInstitution,
};
