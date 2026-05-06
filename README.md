# SkillBridge Attendance (Prototype)

End-to-end prototype for a fictional attendance management system with 5 roles:
Student, Trainer, Institution, Programme Manager, Monitoring Officer.

## Live URLs
- **Frontend**: (add after deploy) `TODO`
- **Backend**: (add after deploy) `TODO`
- **API Base URL**: (same as backend) `TODO`

## Test accounts
Create these in Clerk after deployment (or use your own) and assign roles via the app’s “Complete signup” screen.

- **Student**: `TODO` / `TODO`
- **Trainer**: `TODO` / `TODO`
- **Institution**: `TODO` / `TODO`
- **Programme Manager**: `TODO` / `TODO`
- **Monitoring Officer**: `TODO` / `TODO`

## Stack choices
- **Frontend**: React (Vite) + Clerk
- **Backend**: Node.js + Express
- **DB**: Neon Postgres
- **Auth**: Clerk (JWT verified on backend)

## Deployment (how to)
This project is designed to deploy as:
- **DB**: Neon Postgres
- **Backend**: Render or Railway (Node/Express)
- **Frontend**: Vercel (Vite/React)
- **Auth**: Clerk

### 1) Neon (Postgres)
- Create a Neon project + database.
- Copy the connection string and set it as `DATABASE_URL` on the backend (keep `?sslmode=require`).
- Run migrations once (locally or in a one-off deploy command):

```bash
npm run migrate -w backend
```

### 2) Clerk (Auth)
- Create a Clerk application.
- Copy:
  - **Publishable Key** → `VITE_CLERK_PUBLISHABLE_KEY` (frontend)
  - **Secret Key** → `CLERK_SECRET_KEY` (backend)
- Configure the Clerk app’s allowed origins / redirect URLs to include:
  - `http://localhost:5173` (local)
  - your Vercel domain (prod)

### 3) Backend deploy (Render or Railway)
Deploy the `backend/` folder as a Node service.

- **Build command** (Render): `npm install`
- **Start command**: `npm start -w backend` (or set the service root to `backend` and run `npm start`)

Set environment variables on the backend service:
- `DATABASE_URL` = Neon connection string
- `CLERK_SECRET_KEY` = Clerk secret key
- `CLERK_PUBLISHABLE_KEY` = Clerk publishable key (required by Clerk Node SDK in this prototype)
- `CORS_ORIGINS` = `http://localhost:5173,https://<your-vercel-app>.vercel.app`
- `SKILLBRIDGE_TZ_OFFSET_MINUTES` = `330` (default; IST) — used for “session active” attendance window checks

Verify:
- `GET /health` returns `{ "ok": true }`

### 4) Frontend deploy (Vercel)
Deploy the `frontend/` folder (or monorepo root with Vercel “Root Directory” set to `frontend`).

Set environment variables on Vercel:
- `VITE_CLERK_PUBLISHABLE_KEY` = Clerk publishable key
- `VITE_API_BASE_URL` = your backend base URL (e.g. `https://<backend-host>`)

### 5) Create test users + roles
- Sign up 5 users (one per role) using the deployed frontend.
- After first login, the app prompts **Complete signup** where the user selects their role.
- The backend stores the role in Postgres (`users.role`) and also writes it to Clerk **public metadata** for debugging.

## How to verify quickly (manual)
Suggested quick end-to-end flow:
1. Login as **Institution** → note your organisation id (auto-created).
2. Login as **Trainer** → create a batch → generate an invite token → create a session (set times so it is active).
3. Login as **Student** → join using batch id + token → see it under **My sessions** → mark attendance.
4. Login as **Trainer** → open **View attendance** for that session.
5. Login as **Institution** → open **Batch summary** for that batch.
6. Login as **Programme Manager** → view programme summary + pick an institution summary.
7. Login as **Monitoring Officer** → read-only programme summary.

## Local setup
### Prereqs
- Node.js 18+ recommended
- A Neon Postgres database
- A Clerk app (Publishable Key + Secret Key)

### 1) Configure env vars
Copy examples and fill values:

- `backend/.env.example` → `backend/.env`
- `frontend/.env.example` → `frontend/.env`

Backend envs:
- `DATABASE_URL`: Neon connection string
- `CLERK_SECRET_KEY`: Clerk Secret Key
- `CORS_ORIGINS`: comma-separated (default `http://localhost:5173`)

Frontend envs:
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL` (default `http://localhost:4001`)

### 2) Install dependencies
From repo root:

```bash
npm install
```

### 3) Run DB migrations

```bash
npm run migrate -w backend
```

### 4) Run apps

```bash
npm run dev
```

Frontend: `http://localhost:5173`  
Backend: `http://localhost:4001/health`

## Data model
Core tables implemented (plus a small `institutions` table to support summaries):
- `users`, `institutions`, `batches`, `batch_trainers`, `batch_students`, `sessions`, `attendance`, `batch_invites`

## API summary (what’s implemented)
All endpoints validate the caller’s role **server-side** and return **403** when not permitted.

Required endpoints implemented:
- `POST /batches` (Trainer / Institution)
- `POST /batches/:id/invite` (Trainer)
- `POST /batches/:id/join` (Student)
- `POST /sessions` (Trainer)
- `POST /attendance/mark` (Student)
- `GET /sessions/:id/attendance` (Trainer)
- `GET /batches/:id/summary` (Institution)
- `GET /institutions/:id/summary` (Programme Manager)
- `GET /programme/summary` (Programme Manager / Monitoring Officer)

Supporting endpoints:
- `GET /me` (any role) bootstrap user row
- `POST /auth/complete-signup` (any logged-in user) set role on first use
- `GET /my/sessions` (Student) list sessions for enrolled batches
- `GET /trainer/sessions` (Trainer) list trainer-created sessions
- `GET /my/trainers` (Institution) list trainers under the institution
- `GET /institutions` (Programme Manager / Monitoring Officer) list institutions for navigation

## What’s working vs incomplete
### Working
- Clerk login/signup UI
- Role selection after first login (stored in DB + Clerk public metadata)
- Server-side RBAC on required endpoints (403 on disallowed)
- Endpoints implemented per assignment
- Minimal role-specific dashboards calling real API endpoints

### Partially done / rough edges
- “Onboarding” is demo-first: trainers are auto-attached to the newest institution if one exists, otherwise a demo institution is created.
- Session “active” uses a fixed programme timezone offset (default IST) for predictable behaviour in deployment.

## With more time
- Add proper institution/trainer onboarding UI (email-based trainer invites), better session lists, better summaries and filters, and timezone-safe session activation logic.

