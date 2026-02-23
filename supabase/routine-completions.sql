-- Routine completion tracking for personal and group routines.

create table if not exists public.routine_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id uuid not null,
  routine_kind text not null default 'personal',
  completion_date date not null,
  completed_task_ids jsonb not null default '[]'::jsonb,
  is_completed boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint routine_completions_kind_check
    check (routine_kind in ('personal', 'group'))
);

create unique index if not exists routine_completions_unique_day
  on public.routine_completions(user_id, routine_id, routine_kind, completion_date);

create index if not exists routine_completions_user_idx
  on public.routine_completions(user_id, completion_date desc);

create index if not exists routine_completions_routine_idx
  on public.routine_completions(routine_id, routine_kind, completion_date desc);

create or replace function public.set_routine_completions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists routine_completions_set_updated_at on public.routine_completions;
create trigger routine_completions_set_updated_at
before update on public.routine_completions
for each row
execute function public.set_routine_completions_updated_at();

alter table public.routine_completions enable row level security;

drop policy if exists "routine_completions_select_own" on public.routine_completions;
create policy "routine_completions_select_own"
  on public.routine_completions
  for select
  using (auth.uid() = user_id);

drop policy if exists "routine_completions_insert_own" on public.routine_completions;
create policy "routine_completions_insert_own"
  on public.routine_completions
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "routine_completions_update_own" on public.routine_completions;
create policy "routine_completions_update_own"
  on public.routine_completions
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "routine_completions_delete_own" on public.routine_completions;
create policy "routine_completions_delete_own"
  on public.routine_completions
  for delete
  using (auth.uid() = user_id);
