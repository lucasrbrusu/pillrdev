-- Health steps entry storage for each user account.
-- Run this file in the Supabase SQL editor.

create table if not exists public.health_steps_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null default timezone('utc', now())::date,
  steps integer not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint health_steps_entries_steps_check
    check (steps > 0)
);

create index if not exists health_steps_entries_user_date_idx
  on public.health_steps_entries(user_id, entry_date desc, created_at desc);

create or replace function public.set_health_steps_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists health_steps_entries_set_updated_at on public.health_steps_entries;
create trigger health_steps_entries_set_updated_at
before update on public.health_steps_entries
for each row
execute function public.set_health_steps_entries_updated_at();

alter table public.health_steps_entries enable row level security;

drop policy if exists "health_steps_entries_select_own" on public.health_steps_entries;
create policy "health_steps_entries_select_own"
  on public.health_steps_entries
  for select
  using (auth.uid() = user_id);

drop policy if exists "health_steps_entries_insert_own" on public.health_steps_entries;
create policy "health_steps_entries_insert_own"
  on public.health_steps_entries
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "health_steps_entries_update_own" on public.health_steps_entries;
create policy "health_steps_entries_update_own"
  on public.health_steps_entries
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "health_steps_entries_delete_own" on public.health_steps_entries;
create policy "health_steps_entries_delete_own"
  on public.health_steps_entries
  for delete
  using (auth.uid() = user_id);

-- Optional RPC helper to save a steps entry from the app as an authenticated user.
create or replace function public.add_health_steps_entry(
  _entry_date date,
  _steps integer
)
returns public.health_steps_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  _row public.health_steps_entries;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.health_steps_entries (
    user_id,
    entry_date,
    steps
  )
  values (
    auth.uid(),
    coalesce(_entry_date, timezone('utc', now())::date),
    _steps
  )
  returning * into _row;

  return _row;
end;
$$;

revoke all on function public.add_health_steps_entry(date, integer) from public;
grant execute on function public.add_health_steps_entry(date, integer) to authenticated;

-- Example from app (authenticated):
-- select * from public.add_health_steps_entry('2026-02-23', 7421);

-- Example from SQL editor (replace with a real user id):
-- insert into public.health_steps_entries (user_id, entry_date, steps)
-- values ('00000000-0000-0000-0000-000000000000'::uuid, '2026-02-23', 7421);
