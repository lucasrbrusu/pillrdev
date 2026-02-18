-- Run this in the Supabase SQL editor.
-- Fixes 42501 permission errors for reads/upserts on public.profiles.

alter table if exists public.profiles enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

do $$
declare
  has_id boolean;
  has_user_id boolean;
  owner_check_sql text;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'id'
  ) into has_id;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'user_id'
  ) into has_user_id;

  if has_id and has_user_id then
    owner_check_sql := '(id = auth.uid() or user_id = auth.uid())';
  elsif has_id then
    owner_check_sql := '(id = auth.uid())';
  elsif has_user_id then
    owner_check_sql := '(user_id = auth.uid())';
  else
    raise exception 'public.profiles needs either an id or user_id column for RLS ownership checks';
  end if;

  execute 'drop policy if exists "profiles_insert_own" on public.profiles';
  execute format(
    'create policy "profiles_insert_own" on public.profiles for insert to authenticated with check %s',
    owner_check_sql
  );

  execute 'drop policy if exists "profiles_update_own" on public.profiles';
  execute format(
    'create policy "profiles_update_own" on public.profiles for update to authenticated using %s with check %s',
    owner_check_sql,
    owner_check_sql
  );

  execute 'drop policy if exists "profiles_delete_own" on public.profiles';
  execute format(
    'create policy "profiles_delete_own" on public.profiles for delete to authenticated using %s',
    owner_check_sql
  );
end
$$;
