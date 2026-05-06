-- First-time users hit GET /me before choosing a role on /auth/complete-signup.
-- Coursework / Neon schemas sometimes mark role NOT NULL; the app expects role nullable until then.
alter table users alter column role drop not null;
