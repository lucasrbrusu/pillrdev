-- Routine schedule-time support.
-- Run in Supabase SQL editor.

alter table if exists public.routines
  add column if not exists start_time text;

alter table if exists public.routines
  add column if not exists end_time text;

alter table if exists public.routines
  add column if not exists notification_ids text[];

alter table if exists public.routines
  add column if not exists scheduled_times text[];

alter table if exists public.group_routines
  add column if not exists start_time text;

alter table if exists public.group_routines
  add column if not exists end_time text;

alter table if exists public.group_routines
  add column if not exists scheduled_times text[];

-- Backfill new range columns from legacy scheduled_times when available.
update public.routines
set
  start_time = coalesce(start_time, scheduled_times[1]),
  end_time = coalesce(end_time, scheduled_times[2])
where scheduled_times is not null;

update public.group_routines
set
  start_time = coalesce(start_time, scheduled_times[1]),
  end_time = coalesce(end_time, scheduled_times[2])
where scheduled_times is not null;
