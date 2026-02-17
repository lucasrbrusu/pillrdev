-- Ensure group habit creators/admins can delete group habits.
-- Run in Supabase SQL editor.

alter table public.group_habits enable row level security;

drop policy if exists "group_habits_delete_creator_or_owner" on public.group_habits;
create policy "group_habits_delete_creator_or_owner"
  on public.group_habits
  for delete
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.groups g
      where g.id = group_habits.group_id
        and g.owner_id = auth.uid()
    )
  );

