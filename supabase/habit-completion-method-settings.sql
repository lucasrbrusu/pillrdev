-- Run this in Supabase SQL editor.
-- Persists user habit completion preference (swipe vs manual_plus).

alter table if exists public.user_settings
add column if not exists habit_completion_method text;

update public.user_settings
set habit_completion_method = 'swipe'
where habit_completion_method is null
   or btrim(habit_completion_method) = '';

alter table if exists public.user_settings
alter column habit_completion_method set default 'swipe';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_settings_habit_completion_method_check'
      and conrelid = 'public.user_settings'::regclass
  ) then
    alter table public.user_settings
    add constraint user_settings_habit_completion_method_check
    check (habit_completion_method in ('swipe', 'manual_plus'));
  end if;
end $$;

