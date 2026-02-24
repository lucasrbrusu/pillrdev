-- Weight progress check storage for each user account.
-- Run this file in the Supabase SQL editor.

create table if not exists public.weight_progress_checks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starting_weight numeric(6,2),
  current_weight numeric(6,2),
  entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint weight_progress_checks_starting_weight_check
    check (starting_weight is null or starting_weight > 0),
  constraint weight_progress_checks_current_weight_check
    check (current_weight is null or current_weight > 0),
  constraint weight_progress_checks_entries_array_check
    check (jsonb_typeof(entries) = 'array')
);

create or replace function public.set_weight_progress_checks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists weight_progress_checks_set_updated_at on public.weight_progress_checks;
create trigger weight_progress_checks_set_updated_at
before update on public.weight_progress_checks
for each row
execute function public.set_weight_progress_checks_updated_at();

alter table public.weight_progress_checks enable row level security;

drop policy if exists "weight_progress_checks_select_own" on public.weight_progress_checks;
create policy "weight_progress_checks_select_own"
  on public.weight_progress_checks
  for select
  using (auth.uid() = user_id);

drop policy if exists "weight_progress_checks_insert_own" on public.weight_progress_checks;
create policy "weight_progress_checks_insert_own"
  on public.weight_progress_checks
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "weight_progress_checks_update_own" on public.weight_progress_checks;
create policy "weight_progress_checks_update_own"
  on public.weight_progress_checks
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "weight_progress_checks_delete_own" on public.weight_progress_checks;
create policy "weight_progress_checks_delete_own"
  on public.weight_progress_checks
  for delete
  using (auth.uid() = user_id);

-- Optional RPC helper you can call from the app as an authenticated user.
create or replace function public.upsert_weight_progress_check(
  _starting_weight numeric,
  _current_weight numeric,
  _entries jsonb default '[]'::jsonb
)
returns public.weight_progress_checks
language plpgsql
security invoker
set search_path = public
as $$
declare
  _row public.weight_progress_checks;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.weight_progress_checks (
    user_id,
    starting_weight,
    current_weight,
    entries
  )
  values (
    auth.uid(),
    _starting_weight,
    _current_weight,
    coalesce(_entries, '[]'::jsonb)
  )
  on conflict (user_id)
  do update set
    starting_weight = excluded.starting_weight,
    current_weight = excluded.current_weight,
    entries = excluded.entries,
    updated_at = timezone('utc', now())
  returning * into _row;

  return _row;
end;
$$;

revoke all on function public.upsert_weight_progress_check(numeric, numeric, jsonb) from public;
grant execute on function public.upsert_weight_progress_check(numeric, numeric, jsonb) to authenticated;

-- Example from app (authenticated session):
-- select * from public.upsert_weight_progress_check(
--   74.0,
--   73.2,
--   '[{"dateKey":"2026-02-23","weight":73.2}]'::jsonb
-- );

-- Example from SQL editor (replace with a real user id):
-- insert into public.weight_progress_checks (user_id, starting_weight, current_weight, entries)
-- values (
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   74.0,
--   73.2,
--   '[{"dateKey":"2026-02-23","weight":73.2}]'::jsonb
-- )
-- on conflict (user_id)
-- do update set
--   starting_weight = excluded.starting_weight,
--   current_weight = excluded.current_weight,
--   entries = excluded.entries,
--   updated_at = timezone('utc', now());
