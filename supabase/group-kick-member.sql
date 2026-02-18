-- Run this in the Supabase SQL editor.
-- Adds a secure RPC for admins to kick a member and remove member-specific group data.

drop function if exists public.kick_group_member(uuid, uuid);

create or replace function public.kick_group_member(p_group_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
set row_security = off
as $$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_group_id is null or p_member_id is null then
    raise exception 'Missing group or member';
  end if;

  select g.owner_id
  into v_owner_id
  from public.groups g
  where g.id = p_group_id;

  if v_owner_id is null then
    raise exception 'Group not found';
  end if;

  if v_owner_id <> auth.uid() then
    raise exception 'Only the group admin can remove members';
  end if;

  if p_member_id = v_owner_id then
    raise exception 'You cannot remove the group admin';
  end if;

  -- Remove canonical group membership.
  delete from public.group_members
  where group_id = p_group_id
    and user_id = p_member_id;

  -- Remove accepted/pending invites involving the kicked member so invite-based access is removed.
  if to_regclass('public.group_invites') is not null then
    delete from public.group_invites
    where group_id = p_group_id
      and (to_user_id = p_member_id or from_user_id = p_member_id);
  end if;

  -- Remove this user's group habit completions for the group.
  if to_regclass('public.group_habits') is not null
     and to_regclass('public.group_habit_completions') is not null then
    delete from public.group_habit_completions ghc
    using public.group_habits gh
    where ghc.group_habit_id = gh.id
      and gh.group_id = p_group_id
      and ghc.user_id = p_member_id;
  end if;

  -- If routine tasks track author columns, remove tasks added by the kicked member in this group.
  if to_regclass('public.group_routines') is not null
     and to_regclass('public.group_routine_tasks') is not null then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'group_routine_tasks'
        and column_name = 'created_by'
    ) then
      delete from public.group_routine_tasks grt
      using public.group_routines gr
      where grt.group_routine_id = gr.id
        and gr.group_id = p_group_id
        and grt.created_by = p_member_id;
    end if;

    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'group_routine_tasks'
        and column_name = 'user_id'
    ) then
      delete from public.group_routine_tasks grt
      using public.group_routines gr
      where grt.group_routine_id = gr.id
        and gr.group_id = p_group_id
        and grt.user_id = p_member_id;
    end if;
  end if;
end;
$$;

revoke all on function public.kick_group_member(uuid, uuid) from public;
grant execute on function public.kick_group_member(uuid, uuid) to authenticated;

