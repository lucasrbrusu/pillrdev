-- Task category support for Tasks screen filters (All / Tasks / Holidays)
-- and calendar import/export integrity.
-- Run this in Supabase SQL editor.

alter table if exists public.tasks
  add column if not exists category text not null default 'task';

update public.tasks
set category = 'task'
where category is null or btrim(category) = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tasks_category_check'
      and conrelid = 'public.tasks'::regclass
  ) then
    alter table public.tasks
      add constraint tasks_category_check
      check (lower(category) in ('task', 'holiday'));
  end if;
end
$$;

create index if not exists tasks_user_category_date_idx
  on public.tasks(user_id, category, date);
