-- Habit sharing without groups.
-- Run in Supabase SQL editor.

create extension if not exists "pgcrypto";

create table if not exists public.habit_participants (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  owner_user_id uuid not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create unique index if not exists habit_participants_unique_habit_user
  on public.habit_participants(habit_id, user_id);

create index if not exists habit_participants_user_id_idx
  on public.habit_participants(user_id);

create index if not exists habit_participants_owner_user_id_idx
  on public.habit_participants(owner_user_id);

create or replace function public.is_habit_owner(p_habit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.habits h
    where h.id = p_habit_id
      and h.user_id = auth.uid()
  );
$$;

create or replace function public.is_habit_participant(p_habit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.habit_participants hp
    where hp.habit_id = p_habit_id
      and hp.user_id = auth.uid()
  );
$$;

alter table public.habit_participants enable row level security;

drop policy if exists "habit_participants_select_owner_or_self" on public.habit_participants;
create policy "habit_participants_select_owner_or_self"
  on public.habit_participants
  for select
  using (
    owner_user_id = auth.uid()
    or user_id = auth.uid()
    or public.is_habit_owner(habit_participants.habit_id)
  );

drop policy if exists "habit_participants_insert_owner_only" on public.habit_participants;
create policy "habit_participants_insert_owner_only"
  on public.habit_participants
  for insert
  with check (
    owner_user_id = auth.uid()
    and user_id <> auth.uid()
    and public.is_habit_owner(habit_participants.habit_id)
    and exists (
      select 1
      from public.friendships f
      where
        (f.user_id = owner_user_id and f.friend_id = user_id)
        or (f.user_id = user_id and f.friend_id = owner_user_id)
    )
  );

drop policy if exists "habit_participants_delete_owner_or_self" on public.habit_participants;
create policy "habit_participants_delete_owner_or_self"
  on public.habit_participants
  for delete
  using (
    owner_user_id = auth.uid()
    or user_id = auth.uid()
    or public.is_habit_owner(habit_participants.habit_id)
  );

-- Allow reading shared habits in addition to a user's own habits.
alter table public.habits enable row level security;

drop policy if exists "habits_select_if_shared" on public.habits;
create policy "habits_select_if_shared"
  on public.habits
  for select
  using (
    user_id = auth.uid()
    or public.is_habit_participant(habits.id)
  );

-- Allow participants to write their own completion rows on shared habits.
alter table public.habit_completions enable row level security;

drop policy if exists "habit_completions_select_shared_or_own" on public.habit_completions;
create policy "habit_completions_select_shared_or_own"
  on public.habit_completions
  for select
  using (
    user_id = auth.uid()
    and (
      public.is_habit_owner(habit_completions.habit_id)
      or public.is_habit_participant(habit_completions.habit_id)
    )
  );

drop policy if exists "habit_completions_insert_shared_or_own" on public.habit_completions;
create policy "habit_completions_insert_shared_or_own"
  on public.habit_completions
  for insert
  with check (
    user_id = auth.uid()
    and (
      public.is_habit_owner(habit_completions.habit_id)
      or public.is_habit_participant(habit_completions.habit_id)
    )
  );

drop policy if exists "habit_completions_update_shared_or_own" on public.habit_completions;
create policy "habit_completions_update_shared_or_own"
  on public.habit_completions
  for update
  using (
    user_id = auth.uid()
    and (
      public.is_habit_owner(habit_completions.habit_id)
      or public.is_habit_participant(habit_completions.habit_id)
    )
  )
  with check (
    user_id = auth.uid()
    and (
      public.is_habit_owner(habit_completions.habit_id)
      or public.is_habit_participant(habit_completions.habit_id)
    )
  );

drop policy if exists "habit_completions_delete_shared_or_own" on public.habit_completions;
create policy "habit_completions_delete_shared_or_own"
  on public.habit_completions
  for delete
  using (
    user_id = auth.uid()
    and (
      public.is_habit_owner(habit_completions.habit_id)
      or public.is_habit_participant(habit_completions.habit_id)
    )
  );
