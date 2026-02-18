-- Run this in the Supabase SQL editor.
-- Adds first-class grocery lists with emoji support and links grocery items to lists.

create table if not exists public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  emoji text not null default chr(128722),
  created_at timestamptz not null default now(),
  constraint grocery_lists_name_not_blank check (char_length(trim(name)) > 0),
  constraint grocery_lists_name_limit check (char_length(name) <= 80),
  constraint grocery_lists_emoji_not_blank check (char_length(trim(emoji)) > 0),
  constraint grocery_lists_emoji_limit check (char_length(emoji) <= 16)
);

create index if not exists grocery_lists_user_created_idx
  on public.grocery_lists (user_id, created_at);

alter table public.grocery_lists enable row level security;

drop policy if exists "grocery_lists_select_own" on public.grocery_lists;
create policy "grocery_lists_select_own"
on public.grocery_lists
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "grocery_lists_insert_own" on public.grocery_lists;
create policy "grocery_lists_insert_own"
on public.grocery_lists
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "grocery_lists_update_own" on public.grocery_lists;
create policy "grocery_lists_update_own"
on public.grocery_lists
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "grocery_lists_delete_own" on public.grocery_lists;
create policy "grocery_lists_delete_own"
on public.grocery_lists
for delete
to authenticated
using (auth.uid() = user_id);

alter table public.groceries
  add column if not exists list_id uuid references public.grocery_lists(id) on delete cascade;

create index if not exists groceries_user_list_created_idx
  on public.groceries (user_id, list_id, created_at);

-- Create one default list for users that already have grocery items.
insert into public.grocery_lists (user_id, name, emoji)
select distinct g.user_id, 'Grocery List', chr(128722)
from public.groceries g
where g.user_id is not null
and not exists (
  select 1
  from public.grocery_lists gl
  where gl.user_id = g.user_id
);

-- Backfill existing grocery items into each user's earliest list.
with first_lists as (
  select distinct on (user_id) id, user_id
  from public.grocery_lists
  order by user_id, created_at asc, id asc
)
update public.groceries g
set list_id = fl.id
from first_lists fl
where g.user_id = fl.user_id
and g.list_id is null;
