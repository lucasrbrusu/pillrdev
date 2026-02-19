-- One-time habits page tutorial tracking.
-- Existing users are backfilled as completed so only new accounts see this flow.

alter table if exists public.profiles
  add column if not exists has_completed_habits_tutorial boolean;

alter table if exists public.profiles
  add column if not exists habits_tutorial_completed_at timestamptz;

update public.profiles
set
  has_completed_habits_tutorial = true,
  habits_tutorial_completed_at = coalesce(habits_tutorial_completed_at, now())
where has_completed_habits_tutorial is null;

alter table if exists public.profiles
  alter column has_completed_habits_tutorial set default false;

alter table if exists public.profiles
  alter column has_completed_habits_tutorial set not null;
