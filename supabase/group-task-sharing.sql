-- Group task sharing for Tasks + Calendar + Group Detail task section.
-- Run this migration before using group task sharing in the app.

alter table if exists public.tasks
  add column if not exists group_id uuid references public.groups(id) on delete set null;

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

create index if not exists tasks_user_group_due_idx
  on public.tasks(user_id, group_id, date, time);

create index if not exists tasks_group_shared_idx
  on public.tasks(group_id, shared_task_id);

drop function if exists public.share_task_with_group(uuid, text, text, text, date, text, integer);
drop function if exists public.share_task_with_group(uuid, text, text, text, date, text);

create or replace function public.share_task_with_group(
  p_group_id uuid,
  p_title text,
  p_description text default null,
  p_priority text default 'medium',
  p_date date default null,
  p_time text default null,
  p_duration_minutes integer default 30
)
returns public.tasks
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller uuid := auth.uid();
  v_priority text := lower(coalesce(nullif(trim(p_priority), ''), 'medium'));
  v_duration_minutes integer := greatest(5, least(1440, coalesce(p_duration_minutes, 30)));
  v_owner_task public.tasks%rowtype;
  v_member_task record;
begin
  if v_caller is null then
    raise exception 'You must be logged in to share a task.';
  end if;

  if p_group_id is null then
    raise exception 'Missing group.';
  end if;

  if p_title is null or length(trim(p_title)) = 0 then
    raise exception 'Task title is required.';
  end if;

  if p_date is null then
    raise exception 'Task date is required.';
  end if;

  if p_time is null or length(trim(p_time)) = 0 then
    raise exception 'Task time is required.';
  end if;

  if v_priority not in ('low', 'medium', 'high') then
    v_priority := 'medium';
  end if;

  if not exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = v_caller
  ) then
    raise exception 'You are not a member of this group.';
  end if;

  insert into public.tasks (
    user_id,
    title,
    description,
    priority,
    date,
    time,
    duration_minutes,
    completed,
    shared_task_id,
    group_id
  )
  values (
    v_caller,
    trim(p_title),
    nullif(trim(coalesce(p_description, '')), ''),
    v_priority,
    p_date,
    trim(p_time),
    v_duration_minutes,
    false,
    null,
    p_group_id
  )
  returning * into v_owner_task;

  update public.tasks
  set shared_task_id = v_owner_task.id
  where id = v_owner_task.id;

  select * into v_owner_task from public.tasks where id = v_owner_task.id;

  if to_regclass('public.task_participants') is not null then
    insert into public.task_participants(task_id, user_id, participant_task_id, role)
    values (v_owner_task.id, v_caller, v_owner_task.id, 'group_owner')
    on conflict (task_id, user_id)
    do update
      set participant_task_id = excluded.participant_task_id,
          role = excluded.role;
  end if;

  for v_member_task in
    insert into public.tasks (
      user_id,
      title,
      description,
      priority,
      date,
      time,
      duration_minutes,
      completed,
      shared_task_id,
      group_id
    )
    select
      gm.user_id,
      v_owner_task.title,
      v_owner_task.description,
      v_owner_task.priority,
      v_owner_task.date,
      v_owner_task.time,
      v_owner_task.duration_minutes,
      false,
      v_owner_task.id,
      p_group_id
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id <> v_caller
    returning id, user_id
  loop
    if to_regclass('public.task_participants') is not null then
      insert into public.task_participants(task_id, user_id, participant_task_id, role)
      values (v_owner_task.id, v_member_task.user_id, v_member_task.id, 'group_member')
      on conflict (task_id, user_id)
      do update
        set participant_task_id = excluded.participant_task_id,
            role = excluded.role;
    end if;
  end loop;

  return v_owner_task;
end;
$$;

revoke all on function public.share_task_with_group(uuid, text, text, text, date, text, integer) from public;
grant execute on function public.share_task_with_group(uuid, text, text, text, date, text, integer) to authenticated;
