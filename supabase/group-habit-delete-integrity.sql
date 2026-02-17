-- Group habit completion/delete integrity.
-- Run in Supabase SQL editor.

-- Ensure one completion row per user/day/group-habit.
create unique index if not exists group_habit_completions_unique_day
  on public.group_habit_completions(group_habit_id, user_id, date);

-- Ensure deleting a group habit also removes all completion rows.
do $$
declare
  fk_name text;
begin
  select con.conname
  into fk_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'group_habit_completions'
    and con.contype = 'f'
    and exists (
      select 1
      from unnest(con.conkey) as ck(attnum)
      join pg_attribute a
        on a.attrelid = con.conrelid
       and a.attnum = ck.attnum
      where a.attname = 'group_habit_id'
    )
  limit 1;

  if fk_name is not null then
    execute format(
      'alter table public.group_habit_completions drop constraint %I',
      fk_name
    );
  end if;

  begin
    alter table public.group_habit_completions
      add constraint group_habit_completions_group_habit_id_fkey
      foreign key (group_habit_id)
      references public.group_habits(id)
      on delete cascade;
  exception
    when duplicate_object then null;
  end;
end $$;

