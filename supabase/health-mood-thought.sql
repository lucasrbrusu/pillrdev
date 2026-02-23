-- Mood thought support for Health mood entries.
-- Run this once to persist "Share your thoughts" text with each mood log.

alter table if exists public.health_daily
  add column if not exists mood_thought text;

