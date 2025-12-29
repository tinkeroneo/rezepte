-- RLS Audit / Baseline Policies for cook_events + client_logs
-- Run in Supabase SQL editor.
-- Assumption: space_id columns in these tables are TEXT and store the UUID as string.

-- =====================
-- cook_events
-- - Visible to all space members
-- - Members can insert/update/delete
-- =====================

alter table if exists public.cook_events enable row level security;

drop policy if exists "cook_events_select_members" on public.cook_events;
create policy "cook_events_select_members" on public.cook_events
  for select
  using (
    exists (
      select 1
      from public.user_spaces us
      where us.user_id = auth.uid()
        and us.space_id::text = cook_events.space_id
    )
  );

drop policy if exists "cook_events_insert_members" on public.cook_events;
create policy "cook_events_insert_members" on public.cook_events
  for insert
  with check (
    exists (
      select 1
      from public.user_spaces us
      where us.user_id = auth.uid()
        and us.space_id::text = cook_events.space_id
    )
  );

drop policy if exists "cook_events_update_members" on public.cook_events;
create policy "cook_events_update_members" on public.cook_events
  for update
  using (
    exists (
      select 1
      from public.user_spaces us
      where us.user_id = auth.uid()
        and us.space_id::text = cook_events.space_id
    )
  )
  with check (
    exists (
      select 1
      from public.user_spaces us
      where us.user_id = auth.uid()
        and us.space_id::text = cook_events.space_id
    )
  );

drop policy if exists "cook_events_delete_members" on public.cook_events;
create policy "cook_events_delete_members" on public.cook_events
  for delete
  using (
    exists (
      select 1
      from public.user_spaces us
      where us.user_id = auth.uid()
        and us.space_id::text = cook_events.space_id
    )
  );

-- =====================
-- client_logs
-- - Insert allowed for any space member (frontend error logs)
-- - Select/delete restricted to owner/editor
-- =====================

alter table if exists public.client_logs enable row level security;

drop policy if exists "client_logs_insert_members" on public.client_logs;
create policy "client_logs_insert_members" on public.client_logs
  for insert
  with check (
    exists (
      select 1
      from public.user_spaces us
      where us.user_id = auth.uid()
        and us.space_id::text = client_logs.space_id
    )
  );

drop policy if exists "client_logs_select_manage" on public.client_logs;
create policy "client_logs_select_manage" on public.client_logs
  for select
  using (
    exists (
      select 1
      from public.user_spaces us
      where us.user_id = auth.uid()
        and us.space_id::text = client_logs.space_id
        and us.role in ('owner','editor')
    )
  );

drop policy if exists "client_logs_delete_manage" on public.client_logs;
create policy "client_logs_delete_manage" on public.client_logs
  for delete
  using (
    exists (
      select 1
      from public.user_spaces us
      where us.user_id = auth.uid()
        and us.space_id::text = client_logs.space_id
        and us.role in ('owner','editor')
    )
  );
