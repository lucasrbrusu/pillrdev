-- Task archive support
-- Run this in Supabase SQL editor.

alter table if exists public.tasks
  add column if not exists archived_at timestamptz;

create index if not exists tasks_user_archived_due_idx
  on public.tasks(user_id, archived_at, date, time);

-- Backfill: archive tasks already older than 24 hours past due date/time.
update public.tasks t
set archived_at = now()
where t.archived_at is null
  and (
    coalesce(
      case
        when t.time is null or btrim(t.time) = '' then t.date::timestamp + time '23:59'
        when t.time ~* 'AM|PM'
          then to_timestamp(t.date::text || ' ' || t.time, 'YYYY-MM-DD HH12:MI AM')
        else to_timestamp(t.date::text || ' ' || t.time, 'YYYY-MM-DD HH24:MI')
      end,
      t.date::timestamp + time '23:59'
    ) + interval '24 hours'
  ) <= now();

-- Optional if you use tasks_list and want archive data available from it:
-- include `archived_at` in the tasks_list view select list.
