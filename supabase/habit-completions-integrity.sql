-- Habit completion integrity for personal + shared habits.
-- Run this in the Supabase SQL editor.

-- Ensure one completion row per habit/user/day.
create unique index if not exists habit_completions_unique_day_per_user
  on public.habit_completions(habit_id, user_id, date);

-- Remove legacy uniqueness on (habit_id, date) if it exists.
do $$
declare
  legacy_constraint_name text;
begin
  select con.conname
    into legacy_constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'habit_completions'
    and con.contype = 'u'
    and array_length(con.conkey, 1) = 2
    and exists (
      select 1
      from unnest(con.conkey) as ck(attnum)
      join pg_attribute a
        on a.attrelid = con.conrelid
       and a.attnum = ck.attnum
      where a.attname = 'habit_id'
    )
    and exists (
      select 1
      from unnest(con.conkey) as ck(attnum)
      join pg_attribute a
        on a.attrelid = con.conrelid
       and a.attnum = ck.attnum
      where a.attname = 'date'
    )
  limit 1;

  if legacy_constraint_name is not null then
    execute format(
      'alter table public.habit_completions drop constraint %I',
      legacy_constraint_name
    );
  end if;
end $$;

-- In case legacy uniqueness was created as an index (not a constraint).
drop index if exists public.habit_completions_habit_id_date_key;
