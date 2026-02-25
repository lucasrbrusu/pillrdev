-- Task duration support
-- Run this in Supabase SQL editor.
-- If you also use group task sharing, rerun `supabase/group-task-sharing.sql`
-- after applying this file so the RPC includes duration.

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

create index if not exists tasks_user_due_duration_idx
  on public.tasks(user_id, date, time, duration_minutes);

alter table if exists public.task_invites
  add column if not exists task_duration_minutes integer;

do $$
begin
  if to_regclass('public.task_invites') is null then
    return;
  end if;

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
