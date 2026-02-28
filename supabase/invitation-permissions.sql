-- Invitation permission toggles in user settings.
alter table if exists public.user_settings
  add column if not exists allow_task_invites boolean not null default true,
  add column if not exists allow_group_invites boolean not null default true,
  add column if not exists allow_habit_invites boolean not null default true,
  add column if not exists allow_routine_invites boolean not null default true;

update public.user_settings
set
  allow_task_invites = coalesce(allow_task_invites, true),
  allow_group_invites = coalesce(allow_group_invites, true),
  allow_habit_invites = coalesce(allow_habit_invites, true),
  allow_routine_invites = coalesce(allow_routine_invites, true);
