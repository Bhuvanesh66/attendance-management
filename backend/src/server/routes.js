const { authMiddleware, requireRole } = require("../server/auth");
const { db } = require("../db/db");
const { z } = require("zod");
const { clerkClient } = require("@clerk/clerk-sdk-node");
const crypto = require("crypto");
const { httpError } = require("./http");
const {
  ensureInstitutionForInstitutionUser,
  ensureTrainerHasInstitution,
} = require("./seedHelpers");

const RoleEnum = z.enum([
  "Student",
  "Trainer",
  "Institution",
  "ProgrammeManager",
  "MonitoringOfficer",
]);

const Uuid = z.string().uuid();

/**
 * Combines Postgres `date` + `time` into an "instant" using a fixed programme timezone offset.
 * This avoids "server is UTC, users are IST" confusion in deployed demos.
 *
 * Override with SKILLBRIDGE_TZ_OFFSET_MINUTES (e.g. 330 for IST).
 */
function getSessionTimeBounds(session) {
  const dateStr =
    session.date instanceof Date
      ? session.date.toISOString().slice(0, 10)
      : String(session.date).slice(0, 10);

  const normalizeTime = (t) => {
    if (t == null) return "00:00:00";
    const s = typeof t === "string" ? t : String(t);
    if (s.length === 5 && s[2] === ":") return `${s}:00`;
    return s;
  };

  const parseParts = (isoDate, timeStr) => {
    const [y, m, d] = isoDate.split("-").map((x) => Number(x));
    const [hh, mm, ss] = String(timeStr).split(":").map((x) => Number(x || 0));
    return { y, m, d, hh, mm, ss };
  };

  const offsetMin = Number(process.env.SKILLBRIDGE_TZ_OFFSET_MINUTES || 330); // IST default
  const toInstantWithOffset = (isoDate, t) => {
    const { y, m, d, hh, mm, ss } = parseParts(isoDate, t);
    // Interpret the provided clock time as "programme local". Convert to UTC instant by subtracting the offset.
    return new Date(Date.UTC(y, m - 1, d, hh, mm, ss) - offsetMin * 60_000);
  };

  const start = toInstantWithOffset(dateStr, normalizeTime(session.start_time));
  const end = toInstantWithOffset(dateStr, normalizeTime(session.end_time));
  const now = new Date();
  return { start, end, now, offsetMin, dateStr };
}

function registerRoutes(app) {
  // All API routes below require auth unless explicitly public.
  app.get("/me", authMiddleware, async (req, res) => {
    const me = await db.users.getOrCreateByClerkUserId({
      clerkUserId: req.auth.clerkUserId,
      name: req.auth.name || null,
      email: req.auth.email || null,
    });
    // Auto-create an institution row for Institution users to keep the demo flow simple.
    let maybeUpdated = me?.role
      ? await ensureInstitutionForInstitutionUser({ db, user: me })
      : me;
    if (maybeUpdated?.role === "Trainer") {
      maybeUpdated = await ensureTrainerHasInstitution({ db, user: maybeUpdated });
    }
    let institution = null;
    if (maybeUpdated?.institution_id) {
      institution = await db.institutions.getById(maybeUpdated.institution_id);
    }
    res.json({ user: maybeUpdated, institution });
  });

  if (process.env.NODE_ENV !== "production") {
    app.get(
      "/debug/rbac",
      authMiddleware,
      requireRole(["ProgrammeManager", "MonitoringOfficer"]),
      async (req, res) => {
        res.json({ ok: true, role: req.user.role });
      }
    );
  }

  // Temporary: role completion after signup (frontend calls this once).
  app.post("/auth/complete-signup", authMiddleware, async (req, res) => {
    const schema = z.object({
      role: RoleEnum,
      name: z.preprocess(
        (v) => {
          if (v == null) return undefined;
          if (typeof v === "string" && !v.trim()) return undefined;
          return v;
        },
        z.string().max(120).optional()
      ),
    });
    const input = schema.parse(req.body);

    const user = await db.users.upsertRole({
      clerkUserId: req.auth.clerkUserId,
      role: input.role,
      name: input.name ?? req.auth.name ?? null,
      email: req.auth.email || null,
    });

    try {
      await clerkClient.users.updateUserMetadata(req.auth.clerkUserId, {
        publicMetadata: { role: input.role },
      });
    } catch (syncErr) {
      console.warn("[auth/complete-signup] Clerk publicMetadata sync failed:", syncErr.message);
    }

    res.json({ user });
  });

  // POST /institutions (Institution role) — Institution sets up their organisation explicitly.
  app.post(
    "/institutions",
    authMiddleware,
    requireRole(["Institution"]),
    async (req, res) => {
      const schema = z.object({
        name: z.string().trim().min(2, "Name is too short").max(200),
      });
      const input = schema.parse(req.body || {});

      if (req.user.institution_id) {
        const existing = await db.institutions.getById(req.user.institution_id);
        return res.status(200).json({ institution: existing, user: req.user });
      }

      const inst = await db.institutions.create({ name: input.name });
      const user = await db.users.setInstitutionId(req.user.id, inst.id);

      res.status(201).json({ institution: inst, user });
    }
  );

  // PATCH /institutions/:id (Institution role) — rename own organisation.
  app.patch(
    "/institutions/:id",
    authMiddleware,
    requireRole(["Institution"]),
    async (req, res) => {
      const params = z.object({ id: Uuid }).parse(req.params);
      const body = z
        .object({ name: z.string().trim().min(2).max(200) })
        .parse(req.body || {});

      if (!req.user.institution_id) throw httpError(403, "No institution set up yet");
      if (String(req.user.institution_id) !== String(params.id)) {
        throw httpError(403, "Forbidden");
      }

      const inst = await db.institutions.rename(params.id, body.name);
      if (!inst) throw httpError(404, "Institution not found");
      res.json({ institution: inst });
    }
  );

  // ---- Core assignment endpoints ----

  // POST /batches (Trainer / Institution)
  app.post(
    "/batches",
    authMiddleware,
    requireRole(["Trainer", "Institution"]),
    async (req, res) => {
      const schema = z.object({
        name: z.string().min(1).max(200),
        institutionId: Uuid.optional(),
      });
      const input = schema.parse(req.body);

      // Institution users can only create under their own institution_id.
      let institutionId = input.institutionId || req.user.institution_id;
      if (req.user.role === "Institution") {
        req.user = await ensureInstitutionForInstitutionUser({ db, user: req.user });
        if (!req.user.institution_id) throw httpError(403, "Institution not set");
        institutionId = req.user.institution_id;
      } else {
        req.user = await ensureTrainerHasInstitution({ db, user: req.user });
        institutionId = input.institutionId || req.user.institution_id;
      }

      if (!institutionId) {
        throw httpError(
          403,
          "Institution required — every batch must belong to an organisation."
        );
      }

      let inst = await db.institutions.getById(institutionId);
      if (!inst) {
        // Trainer pasted a custom organisation UUID that isn't in our DB yet.
        // Create a placeholder institution row so batches can be created under it.
        // This keeps the default flow unchanged (trainers still auto-attach to the demo org),
        // while allowing future "paste organisation link" scenarios.
        if (req.user.role === "Trainer" && input.institutionId) {
          inst = await db.institutions.createWithId({
            id: institutionId,
            name: "Imported organisation",
          });
        } else {
          throw httpError(400, "Institution not found");
        }
      }

      const batch = await db.batches.create({ name: input.name, institutionId });

      // If trainer created it, auto-assign trainer to batch.
      if (req.user.role === "Trainer") {
        await db.query(
          "insert into batch_trainers (batch_id, trainer_id) values ($1, $2) on conflict do nothing",
          [batch.id, req.user.id]
        );
      }

      const payload = { batch, institution: inst };
      if (req.user.role === "Trainer") payload.profile = req.user;
      res.status(201).json(payload);
    }
  );

  // GET /my/batches — batches your role can see (trainer: assigned; institution: whole org).
  app.get(
    "/my/batches",
    authMiddleware,
    requireRole(["Trainer", "Institution"]),
    async (req, res) => {
      if (req.user.role === "Institution") {
        const u = await ensureInstitutionForInstitutionUser({ db, user: req.user });
        if (!u.institution_id) {
          throw httpError(403, "Institution workspace not ready — refresh the page.");
        }
        const r = await db.query(
          `select id, name, institution_id, created_at
           from batches
           where institution_id = $1
           order by created_at desc`,
          [u.institution_id]
        );
        return res.json({ batches: r.rows });
      }

      const u = await ensureTrainerHasInstitution({ db, user: req.user });
      const r = await db.query(
        `select distinct b.id, b.name, b.institution_id, b.created_at
         from batches b
         inner join batch_trainers bt on bt.batch_id = b.id and bt.trainer_id = $1
         order by b.created_at desc`,
        [u.id]
      );
      return res.json({ batches: r.rows });
    }
  );

  // GET /my/sessions — sessions visible to the logged-in student (via batch enrollment).
  app.get(
    "/my/sessions",
    authMiddleware,
    requireRole(["Student"]),
    async (req, res) => {
      const r = await db.query(
        `select
           s.id,
           s.batch_id,
           s.trainer_id,
           s.title,
           s.date,
           s.start_time,
           s.end_time,
           s.created_at,
           b.name as batch_name
         from sessions s
         join batch_students bs on bs.batch_id = s.batch_id and bs.student_id = $1
         join batches b on b.id = s.batch_id
         order by s.date desc, s.start_time desc, s.created_at desc`,
        [req.user.id]
      );
      res.json({ sessions: r.rows });
    }
  );

  // GET /trainer/sessions — sessions created by the logged-in trainer.
  app.get(
    "/trainer/sessions",
    authMiddleware,
    requireRole(["Trainer"]),
    async (req, res) => {
      const r = await db.query(
        `select
           s.id,
           s.batch_id,
           s.trainer_id,
           s.title,
           s.date,
           s.start_time,
           s.end_time,
           s.created_at,
           b.name as batch_name
         from sessions s
         join batches b on b.id = s.batch_id
         where s.trainer_id = $1
         order by s.date desc, s.start_time desc, s.created_at desc`,
        [req.user.id]
      );
      res.json({ sessions: r.rows });
    }
  );

  // GET /my/trainers — trainers under the logged-in institution.
  app.get(
    "/my/trainers",
    authMiddleware,
    requireRole(["Institution"]),
    async (req, res) => {
      const u = await ensureInstitutionForInstitutionUser({ db, user: req.user });
      if (!u.institution_id) throw httpError(403, "Institution workspace not ready — refresh the page.");
      const r = await db.query(
        `select id, clerk_user_id, name, email, role, institution_id, created_at
         from users
         where institution_id = $1 and role = 'Trainer'
         order by created_at desc`,
        [u.institution_id]
      );
      res.json({ trainers: r.rows });
    }
  );

  // POST /batches/:id/invite (Trainer)
  app.post(
    "/batches/:id/invite",
    authMiddleware,
    requireRole(["Trainer"]),
    async (req, res) => {
      req.user = await ensureTrainerHasInstitution({ db, user: req.user });
      const params = z.object({ id: Uuid }).parse(req.params);
      const body = z
        .object({
          reusable: z.boolean().optional().default(true),
          maxUses: z.number().int().positive().optional(),
          expiresAt: z.string().datetime().optional(),
        })
        .parse(req.body || {});

      const batch = await db.batches.getById(params.id);
      if (!batch) throw httpError(404, "Batch not found");

      // Trainer must be assigned to this batch.
      const assigned = await db.query(
        "select 1 from batch_trainers where batch_id = $1 and trainer_id = $2",
        [batch.id, req.user.id]
      );
      if (assigned.rowCount === 0) throw httpError(403, "Not assigned to batch");

      const token = crypto.randomBytes(24).toString("hex");
      const r = await db.query(
        `insert into batch_invites
          (batch_id, token, created_by_trainer_id, reusable, max_uses, expires_at)
         values ($1, $2, $3, $4, $5, $6)
         returning id, batch_id, token, reusable, max_uses, uses, expires_at, created_at`,
        [
          batch.id,
          token,
          req.user.id,
          body.reusable,
          body.maxUses || null,
          body.expiresAt ? new Date(body.expiresAt) : null,
        ]
      );

      res.status(201).json({
        invite: r.rows[0],
        joinUrl: `/batches/${batch.id}/join?token=${token}`,
      });
    }
  );

  // POST /batches/:id/join (Student)
  app.post(
    "/batches/:id/join",
    authMiddleware,
    requireRole(["Student"]),
    async (req, res) => {
      const params = z.object({ id: Uuid }).parse(req.params);
      const input = z
        .object({
          token: z.string().optional(),
        })
        .passthrough()
        .parse(req.body || {});

      const rawToken =
        typeof input.token === "string"
          ? input.token
          : typeof req.query?.token === "string"
            ? req.query.token
            : "";

      const token = (() => {
        const t = String(rawToken || "").trim();
        if (!t) return "";
        // Allow students to paste:
        // - just the token (hex)
        // - "token=...."
        // - a full join URL ".../batches/<id>/join?token=...."
        try {
          if (t.startsWith("http://") || t.startsWith("https://")) {
            const u = new URL(t);
            return (u.searchParams.get("token") || "").trim();
          }
        } catch (_) {
          // ignore URL parse errors; we'll fall back to string parsing
        }
        if (t.includes("token=")) {
          const after = t.split("token=").pop();
          return String(after || "").split(/[&\s]/)[0].trim();
        }
        return t;
      })();

      if (!token || token.length < 10) {
        throw httpError(
          400,
          "Invite token is missing. Paste the raw token (hex) or the full join link your trainer shared."
        );
      }

      const batch = await db.batches.getById(params.id);
      if (!batch) throw httpError(404, "Batch not found");

      const inv = await db.query(
        `select *
         from batch_invites
         where batch_id = $1 and token = $2`,
        [batch.id, token]
      );
      const invite = inv.rows[0];
      if (!invite) throw httpError(403, "Invalid invite token");
      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        throw httpError(403, "Invite expired");
      }
      if (!invite.reusable && invite.uses >= 1) throw httpError(403, "Invite already used");
      if (invite.max_uses != null && invite.uses >= invite.max_uses) {
        throw httpError(403, "Invite max uses reached");
      }

      const client = await db.pool.connect();
      try {
        await client.query("begin");
        await client.query(
          "insert into batch_students (batch_id, student_id) values ($1, $2) on conflict do nothing",
          [batch.id, req.user.id]
        );
        await client.query(
          "update batch_invites set uses = uses + 1 where id = $1",
          [invite.id]
        );
        await client.query("commit");
      } catch (e) {
        await client.query("rollback");
        throw e;
      } finally {
        client.release();
      }

      res.json({ ok: true, batchId: batch.id });
    }
  );

  // POST /sessions (Trainer)
  app.post(
    "/sessions",
    authMiddleware,
    requireRole(["Trainer"]),
    async (req, res) => {
      const schema = z.object({
        batchId: Uuid,
        title: z.string().min(1).max(200),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        startTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
        endTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
      });
      const input = schema.parse(req.body);

      const assigned = await db.query(
        "select 1 from batch_trainers where batch_id = $1 and trainer_id = $2",
        [input.batchId, req.user.id]
      );
      if (assigned.rowCount === 0) throw httpError(403, "Not assigned to batch");

      const r = await db.query(
        `insert into sessions (batch_id, trainer_id, title, date, start_time, end_time)
         values ($1, $2, $3, $4, $5, $6)
         returning id, batch_id, trainer_id, title, date, start_time, end_time, created_at`,
        [
          input.batchId,
          req.user.id,
          input.title,
          input.date,
          input.startTime,
          input.endTime,
        ]
      );

      res.status(201).json({ session: r.rows[0] });
    }
  );

  // POST /attendance/mark (Student)
  app.post(
    "/attendance/mark",
    authMiddleware,
    requireRole(["Student"]),
    async (req, res) => {
      const schema = z.object({
        sessionId: Uuid,
        status: z.enum(["present", "absent", "late"]),
      });
      const input = schema.parse(req.body);

      const s = await db.query(
        `select s.*, bs.student_id
         from sessions s
         join batch_students bs on bs.batch_id = s.batch_id
         where s.id = $1 and bs.student_id = $2`,
        [input.sessionId, req.user.id]
      );
      const session = s.rows[0];
      if (!session) throw httpError(403, "Not enrolled in session batch");

      const { start, end, now } = getSessionTimeBounds(session);
      if (!(now >= start && now <= end)) {
        const { offsetMin, dateStr } = getSessionTimeBounds(session);
        const fmt = (d) => d.toISOString().replace("T", " ").slice(0, 19) + "Z";
        const tz =
          offsetMin === 330
            ? "IST (UTC+05:30)"
            : `UTC${offsetMin >= 0 ? "+" : ""}${String(offsetMin / 60)}`;
        throw httpError(403, "Session is not active", {
          hint: `Attendance can be marked only during the session window. This system interprets times in ${tz}.`,
          window: {
            date: dateStr,
            start: fmt(start),
            end: fmt(end),
            now: fmt(now),
          },
        });
      }

      const r = await db.query(
        `insert into attendance (session_id, student_id, status)
         values ($1, $2, $3)
         on conflict (session_id, student_id) do update
           set status = excluded.status,
               marked_at = now()
         returning id, session_id, student_id, status, marked_at`,
        [input.sessionId, req.user.id, input.status]
      );

      res.json({ attendance: r.rows[0] });
    }
  );

  // GET /sessions/:id/attendance (Trainer)
  app.get(
    "/sessions/:id/attendance",
    authMiddleware,
    requireRole(["Trainer"]),
    async (req, res) => {
      const params = z.object({ id: Uuid }).parse(req.params);
      const s = await db.query(
        "select * from sessions where id = $1",
        [params.id]
      );
      const session = s.rows[0];
      if (!session) throw httpError(404, "Session not found");

      // Trainer must be the creator OR assigned trainer on batch.
      if (String(session.trainer_id) !== String(req.user.id)) {
        const assigned = await db.query(
          "select 1 from batch_trainers where batch_id = $1 and trainer_id = $2",
          [session.batch_id, req.user.id]
        );
        if (assigned.rowCount === 0) throw httpError(403, "Forbidden");
      }

      const a = await db.query(
        `select u.id as student_id, u.name as student_name, u.email as student_email,
                a.status, a.marked_at
         from batch_students bs
         join users u on u.id = bs.student_id
         left join attendance a
           on a.session_id = $1 and a.student_id = bs.student_id
         where bs.batch_id = $2
         order by u.id asc`,
        [session.id, session.batch_id]
      );

      res.json({ session, attendance: a.rows });
    }
  );

  // GET /batches/:id/summary (Institution)
  app.get(
    "/batches/:id/summary",
    authMiddleware,
    requireRole(["Institution"]),
    async (req, res) => {
      const params = z.object({ id: Uuid }).parse(req.params);
      const u = await ensureInstitutionForInstitutionUser({ db, user: req.user });
      if (!u.institution_id) throw httpError(403, "Institution not set");

      const b = await db.query(
        "select * from batches where id = $1",
        [params.id]
      );
      const batch = b.rows[0];
      if (!batch) throw httpError(404, "Batch not found");
      if (String(batch.institution_id) !== String(u.institution_id)) {
        throw httpError(403, "Forbidden");
      }

      const r = await db.query(
        `select
           count(distinct s.id)::int as total_sessions,
           count(distinct bs.student_id)::int as total_students,
           count(a.id)::int as total_marks,
           sum(case when a.status = 'present' then 1 else 0 end)::int as present_count,
           sum(case when a.status = 'absent' then 1 else 0 end)::int as absent_count,
           sum(case when a.status = 'late' then 1 else 0 end)::int as late_count
         from batches b
         left join sessions s on s.batch_id = b.id
         left join batch_students bs on bs.batch_id = b.id
         left join attendance a on a.session_id = s.id and a.student_id = bs.student_id
         where b.id = $1`,
        [batch.id]
      );

      res.json({ batch, summary: r.rows[0] });
    }
  );

  // GET /institutions/:id/details (Institution)
  app.get(
    "/institutions/:id/details",
    authMiddleware,
    requireRole(["Institution"]),
    async (req, res) => {
      const params = z.object({ id: Uuid }).parse(req.params);
      const u = await ensureInstitutionForInstitutionUser({ db, user: req.user });
      if (!u.institution_id) throw httpError(403, "Institution not set");
      if (String(u.institution_id) !== String(params.id)) throw httpError(403, "Forbidden");

      const inst = await db.institutions.getById(params.id);
      if (!inst) throw httpError(404, "Institution not found");

      const batches = await db.query(
        `select id, name, institution_id, created_at
         from batches
         where institution_id = $1
         order by created_at desc`,
        [params.id]
      );

      const sessions = await db.query(
        `select
           s.id, s.batch_id, s.trainer_id, s.title, s.date, s.start_time, s.end_time, s.created_at,
           b.name as batch_name
         from sessions s
         join batches b on b.id = s.batch_id
         where b.institution_id = $1
         order by s.date desc, s.start_time desc, s.created_at desc`,
        [params.id]
      );

      const trainers = await db.query(
        `select id, clerk_user_id, name, email, role, institution_id, created_at
         from users
         where institution_id = $1 and role = 'Trainer'
         order by created_at desc`,
        [params.id]
      );

      res.json({
        institution: inst,
        batches: batches.rows,
        sessions: sessions.rows,
        trainers: trainers.rows,
      });
    }
  );

  // GET /institutions/:id/summary (Programme Manager)
  app.get(
    "/institutions/:id/summary",
    authMiddleware,
    requireRole(["ProgrammeManager"]),
    async (req, res) => {
      const params = z.object({ id: Uuid }).parse(req.params);

      const inst = await db.institutions.getById(params.id);
      if (!inst) throw httpError(404, "Institution not found");

      const r = await db.query(
        `select
           count(distinct b.id)::int as total_batches,
           count(distinct s.id)::int as total_sessions,
           count(distinct bs.student_id)::int as total_students,
           count(a.id)::int as total_marks,
           sum(case when a.status = 'present' then 1 else 0 end)::int as present_count,
           sum(case when a.status = 'absent' then 1 else 0 end)::int as absent_count,
           sum(case when a.status = 'late' then 1 else 0 end)::int as late_count
         from institutions i
         left join batches b on b.institution_id = i.id
         left join sessions s on s.batch_id = b.id
         left join batch_students bs on bs.batch_id = b.id
         left join attendance a on a.session_id = s.id and a.student_id = bs.student_id
         where i.id = $1`,
        [inst.id]
      );

      res.json({ institution: inst, summary: r.rows[0] });
    }
  );

  // GET /programme/summary (Programme Manager / Monitoring Officer)
  app.get(
    "/programme/summary",
    authMiddleware,
    requireRole(["ProgrammeManager", "MonitoringOfficer"]),
    async (_req, res) => {
      const r = await db.query(
        `select
           count(distinct i.id)::int as total_institutions,
           count(distinct b.id)::int as total_batches,
           count(distinct s.id)::int as total_sessions,
           count(distinct bs.student_id)::int as total_students,
           count(a.id)::int as total_marks,
           sum(case when a.status = 'present' then 1 else 0 end)::int as present_count,
           sum(case when a.status = 'absent' then 1 else 0 end)::int as absent_count,
           sum(case when a.status = 'late' then 1 else 0 end)::int as late_count
         from institutions i
         left join batches b on b.institution_id = i.id
         left join sessions s on s.batch_id = b.id
         left join batch_students bs on bs.batch_id = b.id
         left join attendance a on a.session_id = s.id and a.student_id = bs.student_id`
      );

      res.json({ summary: r.rows[0] });
    }
  );

  // GET /institutions — list institutions for programme-level navigation.
  app.get(
    "/institutions",
    authMiddleware,
    requireRole(["ProgrammeManager", "MonitoringOfficer"]),
    async (_req, res) => {
      const r = await db.query(
        `select id, name, created_at
         from institutions
         order by created_at desc`
      );
      res.json({ institutions: r.rows });
    }
  );
}

module.exports = { registerRoutes };

