-- Coursework DBs often use CREATE TYPE user_role AS ENUM (...); labels rarely match our API strings.
-- We store canonical PascalCase role strings (Student, Trainer, …) as plain text.
alter table users drop constraint if exists users_role_check;

alter table users
  alter column role type text
  using (
    case role::text
      when 'STUDENT' then 'Student'
      when 'student' then 'Student'
      when 'TRAINER' then 'Trainer'
      when 'trainer' then 'Trainer'
      when 'INSTITUTION' then 'Institution'
      when 'institution' then 'Institution'
      when 'PROGRAMME_MANAGER' then 'ProgrammeManager'
      when 'programme_manager' then 'ProgrammeManager'
      when 'PROGRAMMEMANAGER' then 'ProgrammeManager'
      when 'MONITORING_OFFICER' then 'MonitoringOfficer'
      when 'monitoring_officer' then 'MonitoringOfficer'
      when 'MONITORINGOFFICER' then 'MonitoringOfficer'
      else role::text
    end
  );

alter table users add constraint users_role_check check (
  role is null or role in (
    'Student',
    'Trainer',
    'Institution',
    'ProgrammeManager',
    'MonitoringOfficer'
  )
);
