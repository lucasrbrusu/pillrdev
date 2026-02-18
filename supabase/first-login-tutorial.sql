-- One-time app tutorial tracking for first authenticated app entry.
-- Existing users are backfilled as completed so only new accounts see this flow.

alter table if exists public.profiles
  add column if not exists has_completed_app_tutorial boolean;

alter table if exists public.profiles
  add column if not exists app_tutorial_completed_at timestamptz;

update public.profiles
set
  has_completed_app_tutorial = true,
  app_tutorial_completed_at = coalesce(app_tutorial_completed_at, now())
where has_completed_app_tutorial is null;

alter table if exists public.profiles
  alter column has_completed_app_tutorial set default false;

alter table if exists public.profiles
  alter column has_completed_app_tutorial set not null;
