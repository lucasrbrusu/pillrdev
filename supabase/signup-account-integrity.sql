-- Run this in the Supabase SQL editor.
-- Enforces profile username/email uniqueness and exposes anon-safe availability checks.

create index if not exists profiles_username_ci_lookup_idx
on public.profiles ((lower(btrim(coalesce(username, '')))));

create index if not exists profiles_email_ci_lookup_idx
on public.profiles ((lower(btrim(coalesce(email, '')))));

create or replace function public.enforce_profile_identity_uniqueness()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text := nullif(lower(btrim(coalesce(new.username, ''))), '');
  normalized_email text := nullif(lower(btrim(coalesce(new.email, ''))), '');
  normalized_current_id text := coalesce(
    to_jsonb(new)->>'id',
    to_jsonb(new)->>'user_id',
    ''
  );
  username_conflict_exists boolean := false;
  email_conflict_exists boolean := false;
begin
  if normalized_username is not null then
    select exists (
      select 1
      from public.profiles p
      where nullif(lower(btrim(coalesce(p.username, ''))), '') = normalized_username
        and coalesce(
          to_jsonb(p)->>'id',
          to_jsonb(p)->>'user_id',
          ''
        ) <> normalized_current_id
    )
    into username_conflict_exists;

    if username_conflict_exists then
      raise exception using
        errcode = '23505',
        message = 'username_taken',
        detail = 'This username is already in use.';
    end if;
  end if;

  if normalized_email is not null then
    select exists (
      select 1
      from public.profiles p
      where nullif(lower(btrim(coalesce(p.email, ''))), '') = normalized_email
        and coalesce(
          to_jsonb(p)->>'id',
          to_jsonb(p)->>'user_id',
          ''
        ) <> normalized_current_id
    )
    into email_conflict_exists;

    if email_conflict_exists then
      raise exception using
        errcode = '23505',
        message = 'email_taken',
        detail = 'This email is already in use.';
    end if;
  end if;

  if new.username is not null then
    new.username := nullif(btrim(new.username), '');
  end if;
  if new.email is not null then
    new.email := nullif(lower(btrim(new.email)), '');
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_identity_integrity on public.profiles;
create trigger profiles_identity_integrity
before insert or update of username, email
on public.profiles
for each row
execute function public.enforce_profile_identity_uniqueness();

create or replace function public.check_signup_availability(
  candidate_username text default null,
  candidate_email text default null
)
returns table (
  username_available boolean,
  email_available boolean,
  username_reason text,
  email_reason text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  normalized_username text := nullif(lower(btrim(coalesce(candidate_username, ''))), '');
  normalized_email text := nullif(lower(btrim(coalesce(candidate_email, ''))), '');
  username_taken boolean := false;
  email_taken boolean := false;
begin
  if normalized_username is not null then
    select exists (
      select 1
      from public.profiles p
      where nullif(lower(btrim(coalesce(p.username, ''))), '') = normalized_username
    )
    into username_taken;

    if not username_taken then
      select exists (
        select 1
        from auth.users u
        where nullif(lower(btrim(coalesce(u.raw_user_meta_data->>'username', ''))), '') = normalized_username
      )
      into username_taken;
    end if;
  end if;

  if normalized_email is not null then
    select exists (
      select 1
      from auth.users u
      where nullif(lower(btrim(coalesce(u.email, ''))), '') = normalized_email
    )
    into email_taken;

    if not email_taken then
      select exists (
        select 1
        from public.profiles p
        where nullif(lower(btrim(coalesce(p.email, ''))), '') = normalized_email
      )
      into email_taken;
    end if;
  end if;

  return query
  select
    case when normalized_username is null then true else not username_taken end as username_available,
    case when normalized_email is null then true else not email_taken end as email_available,
    case
      when normalized_username is null then 'username_not_checked'
      when username_taken then 'username_taken'
      else 'username_available'
    end as username_reason,
    case
      when normalized_email is null then 'email_not_checked'
      when email_taken then 'email_taken'
      else 'email_available'
    end as email_reason;
end;
$$;

revoke all on function public.check_signup_availability(text, text) from public;
grant execute on function public.check_signup_availability(text, text) to anon;
grant execute on function public.check_signup_availability(text, text) to authenticated;
grant execute on function public.check_signup_availability(text, text) to service_role;
