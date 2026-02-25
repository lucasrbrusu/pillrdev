-- Task collaboration (invites + participants)
-- Run this in Supabase SQL editor.
--
-- Depends on an existing `tasks` table with primary key `id` (uuid).
-- This design keeps the "task details" snapshot inside the invite so invitees
-- can accept without needing read access to the inviter's `tasks` row.

create extension if not exists "pgcrypto";

alter table if exists public.tasks
  add column if not exists duration_minutes integer not null default 30;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_duration_minutes_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_duration_minutes_check
      check (duration_minutes between 5 and 1440);
  end if;
end
$$;

-- 1) Invites (shown in Notification Centre)
create table if not exists public.task_invites (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  from_user_id uuid not null,
  to_user_id uuid not null,
  task_title text not null,
  task_description text,
  task_priority text,
  task_date date,
  task_time text,
  task_duration_minutes integer,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

alter table if exists public.task_invites
  add column if not exists task_duration_minutes integer;

-- Idempotent constraint creation (Postgres doesn't support ADD CONSTRAINT IF NOT EXISTS).
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_invites_status_check'
      and conrelid = 'public.task_invites'::regclass
  ) then
    alter table public.task_invites
      add constraint task_invites_status_check
      check (status in ('pending', 'accepted', 'declined', 'cancelled'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'task_invites_duration_minutes_check'
      and conrelid = 'public.task_invites'::regclass
  ) then
    alter table public.task_invites
      add constraint task_invites_duration_minutes_check
      check (task_duration_minutes is null or task_duration_minutes between 5 and 1440);
  end if;
end
$$;

create unique index if not exists task_invites_unique_task_to_user
  on public.task_invites(task_id, to_user_id);

create index if not exists task_invites_to_user_status
  on public.task_invites(to_user_id, status);

create index if not exists task_invites_from_user_status
  on public.task_invites(from_user_id, status);

-- 2) Participants (used to show "People" on a task)
create table if not exists public.task_participants (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  user_id uuid not null,
  participant_task_id uuid references public.tasks(id) on delete cascade,
  role text not null default 'participant',
  created_at timestamptz not null default now()
);

create unique index if not exists task_participants_unique_task_user
  on public.task_participants(task_id, user_id);

create index if not exists task_participants_user_id
  on public.task_participants(user_id);

-- Row Level Security
alter table public.task_invites enable row level security;
alter table public.task_participants enable row level security;

-- task_invites policies
drop policy if exists "task_invites_select_own" on public.task_invites;
create policy "task_invites_select_own"
  on public.task_invites
  for select
  using (from_user_id = auth.uid() or to_user_id = auth.uid());

drop policy if exists "task_invites_insert_from_user" on public.task_invites;
create policy "task_invites_insert_from_user"
  on public.task_invites
  for insert
  with check (from_user_id = auth.uid() and to_user_id <> auth.uid());

drop policy if exists "task_invites_update_parties" on public.task_invites;
create policy "task_invites_update_parties"
  on public.task_invites
  for update
  using (from_user_id = auth.uid() or to_user_id = auth.uid())
  with check (from_user_id = auth.uid() or to_user_id = auth.uid());

-- task_participants policies
-- A user can see all participants for tasks they are part of.
--
-- Note: avoid self-referential RLS recursion by using a SECURITY DEFINER helper.
create or replace function public.is_task_member(p_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.task_participants tp
    where tp.task_id = p_task_id
      and tp.user_id = auth.uid()
  );
$$;

-- Allow selecting your own membership row without any extra checks.
drop policy if exists "task_participants_select_self" on public.task_participants;
create policy "task_participants_select_self"
  on public.task_participants
  for select
  using (user_id = auth.uid());

drop policy if exists "task_participants_select_if_member" on public.task_participants;
create policy "task_participants_select_if_member"
  on public.task_participants
  for select
  using (public.is_task_member(task_participants.task_id));

-- A user can add/remove only themselves.
drop policy if exists "task_participants_insert_self" on public.task_participants;
create policy "task_participants_insert_self"
  on public.task_participants
  for insert
  with check (user_id = auth.uid());

drop policy if exists "task_participants_update_self" on public.task_participants;
create policy "task_participants_update_self"
  on public.task_participants
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "task_participants_delete_self" on public.task_participants;
create policy "task_participants_delete_self"
  on public.task_participants
  for delete
  using (user_id = auth.uid());
