-- Habit advanced fields used by redesigned Habits/Add/Edit flows.
-- Run in Supabase SQL editor.

alter table if exists public.habits
  add column if not exists habit_type text default 'build';

alter table if exists public.habits
  add column if not exists goal_period text default 'day';

alter table if exists public.habits
  add column if not exists goal_value numeric default 1;

alter table if exists public.habits
  add column if not exists goal_unit text default 'times';

alter table if exists public.habits
  add column if not exists time_range text default 'all_day';

alter table if exists public.habits
  add column if not exists reminders_enabled boolean default false;

alter table if exists public.habits
  add column if not exists reminder_times text[];

alter table if exists public.habits
  add column if not exists reminder_message text;

alter table if exists public.habits
  add column if not exists task_days_mode text default 'every_day';

alter table if exists public.habits
  add column if not exists task_days_count integer default 3;

alter table if exists public.habits
  add column if not exists month_days integer[];

alter table if exists public.habits
  add column if not exists show_memo_after_completion boolean default false;

alter table if exists public.habits
  add column if not exists chart_type text default 'bar';

alter table if exists public.habits
  add column if not exists start_date date;

alter table if exists public.habits
  add column if not exists end_date date;

alter table if exists public.habits
  add column if not exists color text default '#9B59B6';

alter table if exists public.habit_completions
  add column if not exists amount numeric;
