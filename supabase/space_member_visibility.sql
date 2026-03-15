-- Space members visibility for sharing UI
-- Run in Supabase SQL Editor

create or replace function public.is_owner_of_space(target_space_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_spaces us
    where us.space_id = target_space_id
      and us.user_id = auth.uid()
      and lower(coalesce(us.role, 'viewer')) in ('owner', 'admin')
  );
$$;

grant execute on function public.is_owner_of_space(uuid) to authenticated;

create policy "user_spaces read members as owner"
on public.user_spaces for select
to authenticated
using (
  auth.uid() = user_id
  or public.is_owner_of_space(space_id)
);

create policy "profiles read members as owner"
on public.profiles for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.user_spaces us
    where us.user_id = profiles.user_id
      and public.is_owner_of_space(us.space_id)
  )
);
