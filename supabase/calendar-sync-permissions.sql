-- Calendar import/export permission toggle on user settings.
-- Run this in the Supabase SQL editor.

alter table if exists public.user_settings
  add column if not exists calendar_sync_enabled boolean not null default false;

