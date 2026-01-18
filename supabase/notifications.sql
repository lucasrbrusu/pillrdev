-- Local + push notifications setup
-- Run this in Supabase SQL editor.

-- 1) Store local notification ids per item
alter table if exists public.tasks
  add column if not exists notification_ids text[];

alter table if exists public.chores
  add column if not exists notification_ids text[];

alter table if exists public.reminders
  add column if not exists notification_ids text[];

alter table if exists public.habits
  add column if not exists notification_ids text[];

-- If you use a tasks_list view, add notification_ids to the view definition as needed.

-- 2) Push tokens (per user + per device)
create extension if not exists "pgcrypto";

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  expo_push_token text not null,
  platform text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create unique index if not exists push_tokens_user_device
  on public.push_tokens(user_id, device_id);

create index if not exists push_tokens_user_id
  on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "push_tokens_select_own" on public.push_tokens;
create policy "push_tokens_select_own"
  on public.push_tokens
  for select
  using (user_id = auth.uid());

drop policy if exists "push_tokens_insert_own" on public.push_tokens;
create policy "push_tokens_insert_own"
  on public.push_tokens
  for insert
  with check (user_id = auth.uid());

drop policy if exists "push_tokens_update_own" on public.push_tokens;
create policy "push_tokens_update_own"
  on public.push_tokens
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "push_tokens_delete_own" on public.push_tokens;
create policy "push_tokens_delete_own"
  on public.push_tokens
  for delete
  using (user_id = auth.uid());

-- 3) Optional: cron + trigger helpers to call the send-push edge function
-- Requires pg_net and pg_cron extensions.
create extension if not exists "pg_net";
create extension if not exists "pg_cron";

-- Replace <PROJECT_REF> and <CRON_SECRET> before running.
-- Example edge URL: https://<PROJECT_REF>.functions.supabase.co/send-push
create or replace function public.invoke_send_push(payload jsonb)
returns void
language plpgsql
security definer
as $$
begin
  perform net.http_post(
    format('https://%s.functions.supabase.co/send-push', '<PROJECT_REF>'),
    jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    payload
  );
end;
$$;

-- Example: scheduled delivery for shared tasks due "now".
-- Adjust time parsing if you store task.time differently.
create or replace function public.push_due_shared_tasks()
returns void
language plpgsql
security definer
as $$
declare
  row record;
begin
  for row in
    select t.id, t.title
    from public.tasks t
    where t.completed is false
      and t.date = current_date
      and (
        (t.time ~* 'AM|PM'
          and to_timestamp(t.date::text || ' ' || t.time, 'YYYY-MM-DD HH12:MI AM')
            between now() and now() + interval '5 minutes')
        or
        (t.time !~* 'AM|PM'
          and to_timestamp(t.date::text || ' ' || t.time, 'YYYY-MM-DD HH24:MI')
            between now() and now() + interval '5 minutes')
      )
  loop
    perform public.invoke_send_push(
      jsonb_build_object(
        'title', 'Shared task due',
        'body', row.title || ' is due now.',
        'sharedTaskId', row.id
      )
    );
  end loop;
end;
$$;

-- Run every 5 minutes (adjust cadence as needed).
select cron.schedule(
  'shared-task-due-push',
  '*/5 * * * *',
  $$select public.push_due_shared_tasks();$$
);

-- Example: trigger immediate push on friend request insert (optional).
-- Replace <PROJECT_REF> and <CRON_SECRET> in invoke_send_push above first.
create or replace function public.push_on_friend_request()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.invoke_send_push(
    jsonb_build_object(
      'title', 'New friend request',
      'body', 'Someone sent you a friend request.',
      'userIds', jsonb_build_array(new.to_user_id)
    )
  );
  return new;
end;
$$;

drop trigger if exists friend_request_push on public.friend_requests;
create trigger friend_request_push
after insert on public.friend_requests
for each row
execute procedure public.push_on_friend_request();

-- Example: trigger push on task invite (assignment).
create or replace function public.push_on_task_invite()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.invoke_send_push(
    jsonb_build_object(
      'title', 'New task invite',
      'body', coalesce(new.task_title, 'A task') || ' was shared with you.',
      'userIds', jsonb_build_array(new.to_user_id)
    )
  );
  return new;
end;
$$;

drop trigger if exists task_invite_push on public.task_invites;
create trigger task_invite_push
after insert on public.task_invites
for each row
execute procedure public.push_on_task_invite();

-- Example: trigger push when a shared task updates.
create or replace function public.push_on_task_update()
returns trigger
language plpgsql
security definer
as $$
begin
  if (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.date is distinct from old.date
    or new.time is distinct from old.time
    or new.completed is distinct from old.completed
  ) then
    perform public.invoke_send_push(
      jsonb_build_object(
        'title', 'Shared task updated',
        'body', coalesce(new.title, 'A shared task') || ' was updated.',
        'sharedTaskId', coalesce(new.shared_task_id, new.id),
        'excludeUserId', new.user_id
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists task_update_push on public.tasks;
create trigger task_update_push
after update on public.tasks
for each row
execute procedure public.push_on_task_update();
