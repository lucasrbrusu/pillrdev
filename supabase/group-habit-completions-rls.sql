-- Group habit completions RLS
-- Run this in the Supabase SQL editor.

create or replace function public.is_group_habit_member(p_group_habit_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  select exists (
    select 1
    from public.group_habits gh
    where gh.id = p_group_habit_id
      and (
        exists (
          select 1
          from public.group_members gm
          where gm.group_id = gh.group_id
            and gm.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.group_invites gi
          where gi.group_id = gh.group_id
            and gi.status = 'accepted'
            and (gi.from_user_id = auth.uid() or gi.to_user_id = auth.uid())
        )
      )
  );
$$;

alter table public.group_habit_completions enable row level security;

drop policy if exists "group_habit_completions_select_member" on public.group_habit_completions;
create policy "group_habit_completions_select_member"
  on public.group_habit_completions
  for select
  using (public.is_group_habit_member(group_habit_id));

drop policy if exists "group_habit_completions_insert_member" on public.group_habit_completions;
create policy "group_habit_completions_insert_member"
  on public.group_habit_completions
  for insert
  with check (
    user_id = auth.uid()
    and public.is_group_habit_member(group_habit_id)
  );

drop policy if exists "group_habit_completions_delete_member" on public.group_habit_completions;
create policy "group_habit_completions_delete_member"
  on public.group_habit_completions
  for delete
  using (
    user_id = auth.uid()
    and public.is_group_habit_member(group_habit_id)
  );

drop policy if exists "group_habit_completions_update_member" on public.group_habit_completions;
create policy "group_habit_completions_update_member"
  on public.group_habit_completions
  for update
  using (
    user_id = auth.uid()
    and public.is_group_habit_member(group_habit_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_group_habit_member(group_habit_id)
  );
