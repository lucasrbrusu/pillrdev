-- Health app connection + daily snapshot tables.
-- Run this file in the Supabase SQL editor.

create table if not exists public.health_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null,
  provider text not null,
  is_connected boolean not null default false,
  can_read_steps boolean not null default false,
  can_read_active_calories boolean not null default false,
  can_write_nutrition boolean not null default false,
  sync_nutrition_to_health boolean not null default false,
  last_synced_date date,
  last_synced_at timestamptz,
  connection_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint health_connections_platform_check
    check (platform in ('ios', 'android')),
  constraint health_connections_provider_check
    check (provider in ('apple_health', 'health_connect')),
  constraint health_connections_user_platform_unique
    unique (user_id, platform)
);

create table if not exists public.health_daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  steps integer not null default 0,
  active_calories numeric(10,2),
  source text not null default 'platform_health',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint health_daily_metrics_steps_check
    check (steps >= 0),
  constraint health_daily_metrics_active_calories_check
    check (active_calories is null or active_calories >= 0),
  constraint health_daily_metrics_user_date_unique
    unique (user_id, metric_date)
);

create table if not exists public.nutrition_daily_totals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  total_date date not null,
  calories integer not null default 0,
  protein_grams numeric(10,2) not null default 0,
  carbs_grams numeric(10,2) not null default 0,
  fat_grams numeric(10,2) not null default 0,
  source text not null default 'pillaflow',
  synced_to_health boolean not null default false,
  last_synced_to_health_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint nutrition_daily_totals_calories_check
    check (calories >= 0),
  constraint nutrition_daily_totals_protein_check
    check (protein_grams >= 0),
  constraint nutrition_daily_totals_carbs_check
    check (carbs_grams >= 0),
  constraint nutrition_daily_totals_fat_check
    check (fat_grams >= 0),
  constraint nutrition_daily_totals_user_date_unique
    unique (user_id, total_date)
);

create index if not exists health_connections_user_idx
  on public.health_connections(user_id, updated_at desc);

create index if not exists health_daily_metrics_user_date_idx
  on public.health_daily_metrics(user_id, metric_date desc);

create index if not exists nutrition_daily_totals_user_date_idx
  on public.nutrition_daily_totals(user_id, total_date desc);

create or replace function public.set_health_data_transfer_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists health_connections_set_updated_at on public.health_connections;
create trigger health_connections_set_updated_at
before update on public.health_connections
for each row
execute function public.set_health_data_transfer_updated_at();

drop trigger if exists health_daily_metrics_set_updated_at on public.health_daily_metrics;
create trigger health_daily_metrics_set_updated_at
before update on public.health_daily_metrics
for each row
execute function public.set_health_data_transfer_updated_at();

drop trigger if exists nutrition_daily_totals_set_updated_at on public.nutrition_daily_totals;
create trigger nutrition_daily_totals_set_updated_at
before update on public.nutrition_daily_totals
for each row
execute function public.set_health_data_transfer_updated_at();

alter table public.health_connections enable row level security;
alter table public.health_daily_metrics enable row level security;
alter table public.nutrition_daily_totals enable row level security;

drop policy if exists "health_connections_select_own" on public.health_connections;
create policy "health_connections_select_own"
  on public.health_connections
  for select
  using (auth.uid() = user_id);

drop policy if exists "health_connections_insert_own" on public.health_connections;
create policy "health_connections_insert_own"
  on public.health_connections
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "health_connections_update_own" on public.health_connections;
create policy "health_connections_update_own"
  on public.health_connections
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "health_connections_delete_own" on public.health_connections;
create policy "health_connections_delete_own"
  on public.health_connections
  for delete
  using (auth.uid() = user_id);

drop policy if exists "health_daily_metrics_select_own" on public.health_daily_metrics;
create policy "health_daily_metrics_select_own"
  on public.health_daily_metrics
  for select
  using (auth.uid() = user_id);

drop policy if exists "health_daily_metrics_insert_own" on public.health_daily_metrics;
create policy "health_daily_metrics_insert_own"
  on public.health_daily_metrics
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "health_daily_metrics_update_own" on public.health_daily_metrics;
create policy "health_daily_metrics_update_own"
  on public.health_daily_metrics
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "health_daily_metrics_delete_own" on public.health_daily_metrics;
create policy "health_daily_metrics_delete_own"
  on public.health_daily_metrics
  for delete
  using (auth.uid() = user_id);

drop policy if exists "nutrition_daily_totals_select_own" on public.nutrition_daily_totals;
create policy "nutrition_daily_totals_select_own"
  on public.nutrition_daily_totals
  for select
  using (auth.uid() = user_id);

drop policy if exists "nutrition_daily_totals_insert_own" on public.nutrition_daily_totals;
create policy "nutrition_daily_totals_insert_own"
  on public.nutrition_daily_totals
  for insert
  with check (auth.uid() = user_id);

drop policy if exists "nutrition_daily_totals_update_own" on public.nutrition_daily_totals;
create policy "nutrition_daily_totals_update_own"
  on public.nutrition_daily_totals
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "nutrition_daily_totals_delete_own" on public.nutrition_daily_totals;
create policy "nutrition_daily_totals_delete_own"
  on public.nutrition_daily_totals
  for delete
  using (auth.uid() = user_id);

