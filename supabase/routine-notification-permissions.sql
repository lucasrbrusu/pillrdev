-- Add independent routine notification category toggle to user settings.
-- Run this in Supabase SQL editor.

alter table if exists public.user_settings
  add column if not exists routine_reminders_enabled boolean not null default true;

