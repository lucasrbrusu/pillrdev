-- Run this in the Supabase SQL editor.
-- Speeds up case-insensitive username search for friend lookup.

create extension if not exists pg_trgm;

create index if not exists profiles_username_trgm_idx
on public.profiles
using gin (username gin_trgm_ops)
where username is not null and username <> '';

analyze public.profiles;
