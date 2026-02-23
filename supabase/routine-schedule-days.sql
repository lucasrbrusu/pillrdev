-- Routine schedule-day support.
-- Run in Supabase SQL editor.

-- Personal routines
alter table if exists public.routines
  add column if not exists repeat text;

alter table if exists public.routines
  add column if not exists days text[];

alter table if exists public.routines
  add column if not exists month_days integer[];

-- Group routines
alter table if exists public.group_routines
  add column if not exists repeat text;

alter table if exists public.group_routines
  add column if not exists days text[];

alter table if exists public.group_routines
  add column if not exists month_days integer[];

-- Defaults (safe to re-run)
alter table if exists public.routines
  alter column repeat set default 'Daily';

alter table if exists public.routines
  alter column days set default '{}'::text[];

alter table if exists public.routines
  alter column month_days set default '{}'::integer[];

alter table if exists public.group_routines
  alter column repeat set default 'Daily';

alter table if exists public.group_routines
  alter column days set default '{}'::text[];

alter table if exists public.group_routines
  alter column month_days set default '{}'::integer[];

-- Normalize existing rows for personal routines
update public.routines
set repeat = case
  when repeat is null or btrim(repeat) = '' then 'Daily'
  when lower(btrim(repeat)) in ('daily', 'weekly', 'monthly') then initcap(lower(btrim(repeat)))
  when lower(btrim(repeat)) in ('specific weekdays', 'specific_weekdays') then 'Weekly'
  when lower(btrim(repeat)) in ('specific month days', 'specific_month_days') then 'Monthly'
  else 'Daily'
end;

update public.routines
set days = coalesce(days, '{}'::text[]);

update public.routines
set month_days = coalesce(month_days, '{}'::integer[]);

-- If monthly days were stored in month_days previously, mirror to days for app reads.
update public.routines
set days = (
  select array_agg(day_value::text order by day_value)
  from unnest(month_days) as day_value
)
where repeat = 'Monthly'
  and coalesce(array_length(days, 1), 0) = 0
  and coalesce(array_length(month_days, 1), 0) > 0;

-- Normalize existing rows for group routines
update public.group_routines
set repeat = case
  when repeat is null or btrim(repeat) = '' then 'Daily'
  when lower(btrim(repeat)) in ('daily', 'weekly', 'monthly') then initcap(lower(btrim(repeat)))
  when lower(btrim(repeat)) in ('specific weekdays', 'specific_weekdays') then 'Weekly'
  when lower(btrim(repeat)) in ('specific month days', 'specific_month_days') then 'Monthly'
  else 'Daily'
end;

update public.group_routines
set days = coalesce(days, '{}'::text[]);

update public.group_routines
set month_days = coalesce(month_days, '{}'::integer[]);

update public.group_routines
set days = (
  select array_agg(day_value::text order by day_value)
  from unnest(month_days) as day_value
)
where repeat = 'Monthly'
  and coalesce(array_length(days, 1), 0) = 0
  and coalesce(array_length(month_days, 1), 0) > 0;

