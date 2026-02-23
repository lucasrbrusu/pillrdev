-- Run this in the Supabase SQL editor.

-- Reset old account deletion helpers.
drop function if exists public.delete_account();
drop function if exists public.delete_user();
drop policy if exists "profiles_delete_own" on public.profiles;

-- Self-service account deletion (RPC).
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  delete from public.habit_completions where user_id = auth.uid();
  delete from public.health_food_entries where user_id = auth.uid();
  delete from public.health_daily where user_id = auth.uid();
  delete from public.habits where user_id = auth.uid();
  delete from public.tasks where user_id = auth.uid();
  delete from public.notes where user_id = auth.uid();
  delete from public.routines where user_id = auth.uid();
  delete from public.routine_completions where user_id = auth.uid();
  delete from public.chores where user_id = auth.uid();
  delete from public.reminders where user_id = auth.uid();
  delete from public.groceries where user_id = auth.uid();
  delete from public.grocery_lists where user_id = auth.uid();
  delete from public.finance_transactions where user_id = auth.uid();
  delete from public.user_settings where user_id = auth.uid();
  delete from public.profiles where id = auth.uid();
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public;
grant execute on function public.delete_account() to authenticated;
