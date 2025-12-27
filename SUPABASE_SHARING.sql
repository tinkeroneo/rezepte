-- Space Sharing / Invites
-- Run in Supabase SQL editor once.

-- Table for email-based invites.
create table if not exists public.space_invites (
  id uuid primary key default gen_random_uuid(),
  space_id uuid not null references public.spaces(id) on delete cascade,
  email text not null,
  role text not null default 'viewer',
  created_at timestamptz not null default now()
);

create index if not exists space_invites_space_id_idx on public.space_invites(space_id);
create index if not exists space_invites_email_idx on public.space_invites(email);

alter table public.space_invites enable row level security;

-- Helper: is user member with a role that may manage invites?
-- owner/editor can invite/revoke.

drop policy if exists "space_invites_select_manage" on public.space_invites;
create policy "space_invites_select_manage" on public.space_invites
  for select
  using (
    exists (
      select 1 from public.user_spaces us
      where us.space_id = space_invites.space_id
        and us.user_id = auth.uid()
        and us.role in ('owner','editor')
    )
  );

drop policy if exists "space_invites_insert_manage" on public.space_invites;
create policy "space_invites_insert_manage" on public.space_invites
  for insert
  with check (
    exists (
      select 1 from public.user_spaces us
      where us.space_id = space_invites.space_id
        and us.user_id = auth.uid()
        and us.role in ('owner','editor')
    )
  );

drop policy if exists "space_invites_delete_manage" on public.space_invites;
create policy "space_invites_delete_manage" on public.space_invites
  for delete
  using (
    exists (
      select 1 from public.user_spaces us
      where us.space_id = space_invites.space_id
        and us.user_id = auth.uid()
        and us.role in ('owner','editor')
    )
  );

-- Invited user can see and remove their own invites by email claim.
-- (Used by the app on login to auto-accept invites.)

drop policy if exists "space_invites_select_by_email" on public.space_invites;
create policy "space_invites_select_by_email" on public.space_invites
  for select
  using (
    lower(space_invites.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  );

drop policy if exists "space_invites_delete_by_email" on public.space_invites;
create policy "space_invites_delete_by_email" on public.space_invites
  for delete
  using (
    lower(space_invites.email) = lower(coalesce(auth.jwt() ->> 'email',''))
  );

-- NOTE:
-- Ensure user_spaces has a policy that allows a user to insert their own membership:
--   with check (user_id = auth.uid())
-- and select on user_spaces for space members.
