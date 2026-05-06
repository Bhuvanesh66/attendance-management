-- SkillBridge Attendance: initial schema

create extension if not exists pgcrypto;

create table if not exists schema_migrations (
  id text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists institutions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  clerk_user_id text not null unique,
  name text,
  role text,
  institution_id uuid references institutions(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint users_role_check check (
    role is null or role in (
      'Student',
      'Trainer',
      'Institution',
      'ProgrammeManager',
      'MonitoringOfficer'
    )
  )
);

create index if not exists users_institution_id_idx on users(institution_id);

create table if not exists batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  institution_id uuid not null references institutions(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists batches_institution_id_idx on batches(institution_id);

create table if not exists batch_trainers (
  batch_id uuid not null references batches(id) on delete cascade,
  trainer_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (batch_id, trainer_id)
);

create index if not exists batch_trainers_trainer_id_idx on batch_trainers(trainer_id);

create table if not exists batch_students (
  batch_id uuid not null references batches(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (batch_id, student_id)
);

create index if not exists batch_students_student_id_idx on batch_students(student_id);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  trainer_id uuid not null references users(id) on delete cascade,
  title text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  constraint sessions_time_check check (end_time > start_time)
);

create index if not exists sessions_batch_id_idx on sessions(batch_id);
create index if not exists sessions_trainer_id_idx on sessions(trainer_id);
create index if not exists sessions_date_idx on sessions(date);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references users(id) on delete cascade,
  status text not null,
  marked_at timestamptz not null default now(),
  constraint attendance_status_check check (status in ('present', 'absent', 'late')),
  constraint attendance_unique_per_student_per_session unique (session_id, student_id)
);

create index if not exists attendance_session_id_idx on attendance(session_id);
create index if not exists attendance_student_id_idx on attendance(student_id);

create table if not exists batch_invites (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references batches(id) on delete cascade,
  token text not null unique,
  created_by_trainer_id uuid not null references users(id) on delete cascade,
  reusable boolean not null default false,
  max_uses integer,
  uses integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint batch_invites_uses_check check (uses >= 0),
  constraint batch_invites_max_uses_check check (max_uses is null or max_uses >= 1)
);

create index if not exists batch_invites_batch_id_idx on batch_invites(batch_id);

