/**
 * Helpers used during the demo flow to make sure trainers/institutions can
 * actually create batches without first having to design an onboarding flow.
 *
 * Institution role: We do NOT auto-provision an organisation any more.
 * The Institution dashboard exposes an explicit "Set up your organization"
 * card that calls `POST /institutions` so the user can name the org and
 * see the assigned UUID. This matches the assignment requirement that
 * Institutions manage their own org (and the user explicitly asked for a
 * create-org flow on the institution dashboard).
 *
 * Trainer role: Still auto-attached because the Trainer signup flow has no
 * org-name step — they get attached to the most recently created
 * institution, falling back to a demo org if the system is empty. This
 * keeps trainer onboarding low-friction without altering the assignment.
 */

async function ensureInstitutionForInstitutionUser({ db, user }) {
  // No-op for Institution: org is created explicitly via POST /institutions.
  return user;
}

async function ensureTrainerHasInstitution({ db, user }) {
  if (user.role !== "Trainer") return user;
  if (user.institution_id) return user;

  const existing = await db.query(
    "select id from institutions order by created_at desc limit 1"
  );
  const inst = existing.rows[0]?.id
    ? { id: existing.rows[0].id }
    : await db.institutions.create({
        name: user.name ? `${user.name}'s organisation (demo)` : "Trainer organisation (demo)",
      });

  const r = await db.query(
    `update users
       set institution_id = $1
     where id = $2
     returning id, clerk_user_id, name, role, institution_id, created_at, email`,
    [inst.id, user.id]
  );
  return r.rows[0];
}

module.exports = {
  ensureInstitutionForInstitutionUser,
  ensureTrainerHasInstitution,
};
