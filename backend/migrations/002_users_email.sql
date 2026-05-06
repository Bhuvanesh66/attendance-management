-- Email column (Neon / coursework schemas often require NOT NULL email).
alter table users add column if not exists email text;

update users
set email = clerk_user_id || '@users.skillbridge.local'
where email is null;

alter table users alter column email set not null;
