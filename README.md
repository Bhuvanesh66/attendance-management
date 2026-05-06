# SkillBridge Attendance (Prototype)

End-to-end prototype for a fictional state-level skilling programme called **SkillBridge**, with five role-based workspaces:
**Student**, **Trainer**, **Institution**, **Programme Manager**, **Monitoring Officer**.

## Live URLs
- **Frontend**: _add after deploy_
- **Backend**:  _add after deploy_
- **API base URL**: same host as backend (`/health` for a quick check)

> Until deployed, run locally — see [Local setup](#local-setup) below. Local runs cover every flow described in the spec.

## Test accounts (seeded)

Run the seed script (`npm run seed -w backend`) and you immediately get five working accounts. **Password is the same for all five** — `Skill@Bridge1`.

| Role | Email | Password |
|---|---|---|
| Student | `student.demo@skillbridge.example.com` | `Skill@Bridge1` |
| Trainer | `trainer.demo@skillbridge.example.com` | `Skill@Bridge1` |
| Institution | `institution.demo@skillbridge.example.com` | `Skill@Bridge1` |
| Programme Manager | `pm.demo@skillbridge.example.com` | `Skill@Bridge1` |
| Monitoring Officer | `mo.demo@skillbridge.example.com` | `Skill@Bridge1` |

The seed also creates:
- An institution: **SkillBridge Demo Academy**
- A batch: **Cohort Alpha — Web Dev** (Trainer assigned, Student enrolled)
- A session for today (window straddles "now" so the Student can mark attendance immediately)
- A reusable invite token printed by the seed script — you can hand it to other student accounts to test the join flow
- A pre-marked `present` attendance row so Programme/Monitoring summaries are non-zero

## Stack choices

| Layer | Tool | Why |
|---|---|---|
| Frontend | **React 19 + Vite 7** | Fast dev cycle, no framework lock-in, simple deploy to Vercel |
| Auth | **Clerk** | Drop-in sign-up/sign-in/JWT verification, free tier covers demos. Backend re-validates the JWT and reads the role from Postgres on every protected call. |
| Backend | **Node.js + Express** | Smallest viable surface area for a 5-role REST API; Zod for input validation. |
| Database | **Neon (Postgres)** | Free tier serverless Postgres, single connection string, easy SSL. |
| Styling | **Plain CSS** with custom utility classes (`.ui-*`) | Avoided Tailwind/MUI to keep the bundle small and the styling auditable in one file (`frontend/src/styles/global.css`). |

## Schema decisions

8 tables. UUID primary keys (`gen_random_uuid()`), `timestamptz` for created_at, foreign keys with `on delete cascade` for child rows. Highlights:

- **`users`** — one row per Clerk user; role stored as a CHECK-constrained text column (Student / Trainer / Institution / ProgrammeManager / MonitoringOfficer). `institution_id` is nullable to support roles that don't belong to an org.
- **`institutions`** — Institution role gets to *explicitly* create theirs (POST `/institutions`); a small auto-attach helper still wires up Trainers so they can create batches without a separate onboarding step.
- **`batches`** belong to an institution. Many-to-many to trainers (`batch_trainers`) and students (`batch_students`) so multiple trainers per batch is supported (per spec).
- **`sessions`** — `date date` + `start_time time` + `end_time time` (split rather than `timestamptz`) so the programme operates in a fixed local clock (default IST). The "session active" window is computed at request time using `SKILLBRIDGE_TZ_OFFSET_MINUTES` (default `330`).
- **`attendance`** — unique `(session_id, student_id)`; mark/upsert pattern with status check (`present | absent | late`).
- **`batch_invites`** — token + `reusable` + `max_uses` + `expires_at` so trainers can hand a single token to a class.

## What's working / partial / skipped

### Working
- Clerk sign-up, sign-in, sign-out
- Role selection on first login (stored in Postgres + mirrored to Clerk `publicMetadata`)
- Server-side RBAC on every protected route (returns **403** if role is wrong)
- All 9 required endpoints, plus supporting endpoints for navigation
- Five role dashboards with role-appropriate UI:
  - **Student**: live session cards, mark-attendance modal (only enabled when the session is in its time window)
  - **Trainer**: tabs for Batches / Sessions / Invites / Attendance; create batch/session via modals; full join-link generation (copy-to-clipboard URL + token)
  - **Institution**: explicit "Set up your organisation" flow (`POST /institutions`) — captures name, displays UUID; Rename available; per-batch attendance summary modal with progress bar
  - **Programme Manager**: programme-wide stat cards + clickable institution drill-down
  - **Monitoring Officer**: shared component, `readOnly` banner, no create/edit/delete actions
- Seed script that provisions five Clerk users (via Clerk admin API) + an institution + a batch + a session + a reusable invite + a sample attendance row
- Toast notifications for every action (success + error)

### Partial
- Time-window check for attendance is timezone-fixed (default IST). If the seed runs in a different `SKILLBRIDGE_TZ_OFFSET_MINUTES`, the seed widens the session window to 4 hours straddling "now" so the demo still works.
- Trainer onboarding still uses an auto-attach helper (a Trainer signing up without an institution gets attached to the most recently created institution). Removing this would require an explicit Trainer-org-pick step that wasn't in scope.

### Skipped (explicit non-goals)
- Real notification system (email / SMS) — toasts only
- Bulk attendance mark from the trainer side
- Pagination on lists (fine for demo data; would need it at scale)
- Audit log / soft-delete

## One thing I'd do differently with more time

Move the timezone-aware session activation into a tested helper used by **both** backend and frontend (right now the same logic lives in two places). Then add a tiny per-request `requestAuthFor(req, { batchId? })` middleware that handles "Trainer is on this batch", "Institution owns this batch", "Student is enrolled", and so on — the row-level authorisation queries are correct today but they're spread across handlers.

## Local setup

### Prereqs
- Node.js 18+
- A Neon Postgres database (or any Postgres with `gen_random_uuid()` available — `pgcrypto` extension is created by migration)
- A Clerk application (Publishable Key + Secret Key)

### 1) Configure env vars

Copy examples and fill values:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Backend (`backend/.env`):
- `PORT` (default `4001`)
- `DATABASE_URL` — Neon connection string with `?sslmode=require`
- `CLERK_PUBLISHABLE_KEY` — must match the frontend's `VITE_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY` — Clerk dashboard → API keys
- `CORS_ORIGINS` — e.g. `http://localhost:5173`
- `SKILLBRIDGE_TZ_OFFSET_MINUTES` (optional, default `330` for IST)

Frontend (`frontend/.env`):
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL` — your backend base URL (default `http://localhost:4001`)

### 2) Install dependencies

```bash
npm install
```

### 3) Run DB migrations

```bash
npm run migrate -w backend
```

### 4) Seed five test accounts + demo data

```bash
npm run seed -w backend
```

The seed script:
- Creates 5 Clerk users via the Clerk admin API (idempotent — re-running reuses existing users)
- Provisions a demo institution, batch, session, invite token
- Prints all credentials at the end

### 5) Run both apps

```bash
npm run dev
```

Frontend: `http://localhost:5173`
Backend health: `http://localhost:4001/health`

## End-to-end verification (manual)

After running `npm run seed -w backend`, sign in (in different browsers / incognito tabs is easiest):

| As | Do | Expected |
|---|---|---|
| `student.demo@skillbridge.example.com` | Open dashboard | "Live now" tab shows the seeded session; "Mark attendance" enabled |
| Same student | Click Mark attendance → Present → Submit | Toast: "Attendance recorded as present" |
| `trainer.demo@skillbridge.example.com` | Sessions tab → Attendance on the seeded session | See the student row with `Present` |
| Same trainer | Invites tab → pick batch → Generate | Get a copyable join link |
| `institution.demo@skillbridge.example.com` | Organisation tab | See "SkillBridge Demo Academy" + UUID; click Rename to change |
| Same institution | Batches tab → View summary | Stat cards + attendance bar |
| `pm.demo@skillbridge.example.com` | Overview tab | Stat cards (institutions / batches / sessions / present etc.) |
| Same PM | Institutions tab → View summary | Drill-down stats for the demo academy |
| `mo.demo@skillbridge.example.com` | Overview tab | Same data, with a "read-only" banner; no action buttons |

## API summary

All endpoints validate the caller's role server-side (returns **403** if not permitted).

### Required (per assignment spec)
| Method | Path | Roles |
|---|---|---|
| POST | `/batches` | Trainer / Institution |
| POST | `/batches/:id/invite` | Trainer |
| POST | `/batches/:id/join` | Student |
| POST | `/sessions` | Trainer |
| POST | `/attendance/mark` | Student |
| GET | `/sessions/:id/attendance` | Trainer |
| GET | `/batches/:id/summary` | Institution |
| GET | `/institutions/:id/summary` | Programme Manager |
| GET | `/programme/summary` | Programme Manager / Monitoring Officer |

### Supporting
| Method | Path | Purpose |
|---|---|---|
| GET | `/me` | Bootstrap the current user row (any role) |
| POST | `/auth/complete-signup` | Set role on first login |
| **POST** | **`/institutions`** | **Institution creates their organisation explicitly** |
| **PATCH** | **`/institutions/:id`** | **Institution renames their organisation** |
| GET | `/my/batches` | Trainer/Institution list |
| GET | `/my/sessions` | Student list |
| GET | `/my/trainers` | Institution list |
| GET | `/trainer/sessions` | Trainer list |
| GET | `/institutions` | Programme Manager / Monitoring Officer navigation list |
| GET | `/institutions/:id/details` | Institution full overview |
| GET | `/health` | Liveness check |

## Deployment notes

The project is structured to deploy as:
- **DB**: Neon Postgres
- **Backend**: Render or Railway (Node/Express). Build command `npm install` (workspaces hoist deps), start command `npm start -w backend`.
- **Frontend**: Vercel (set "Root Directory" to `frontend`). Build `npm run build`, output `dist`.
- **Auth**: Clerk

Set Clerk's "Allowed origins" to include your local + production frontend URLs. Set `CLERK_AUTHORIZED_PARTIES` on the backend to the same list (comma-separated). Set `CORS_ORIGINS` likewise.

Run migrations once after deploy (`npm run migrate -w backend` against the production DB) and optionally `npm run seed -w backend` to seed the same demo accounts in production.
