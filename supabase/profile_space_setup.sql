
-- Profiles + Space name setup
-- Run in Supabase SQL Editor

create table if not exists profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  default_space_id uuid null,
  last_space_id uuid null,
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles read own"
on profiles for select
using (auth.uid() = user_id);

create policy "profiles insert own"
on profiles for insert
with check (auth.uid() = user_id);

create policy "profiles update own"
on profiles for update
using (auth.uid() = user_id);

-- Space name (if not present yet)
alter table spaces
add column if not exists name text;
