-- Recipe one-time / expiring share links (read-only)
-- Run in Supabase SQL editor once.
-- This adds:
--  - public.recipe_shares table
--  - RPC: create_recipe_share(p_recipe_id uuid, p_expires_in_days int, p_max_uses int)
--  - RPC: get_shared_recipe(p_token text) -> jsonb

create table if not exists public.recipe_shares (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  max_uses int,
  used_count int not null default 0,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists recipe_shares_recipe_id_idx on public.recipe_shares(recipe_id);
create index if not exists recipe_shares_expires_at_idx on public.recipe_shares(expires_at);

-- RLS: table is private by default (only creators can see their rows).
alter table public.recipe_shares enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='recipe_shares' and policyname='recipe_shares_select_own'
  ) then
    create policy recipe_shares_select_own
    on public.recipe_shares
    for select
    using (auth.uid() = created_by);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='recipe_shares' and policyname='recipe_shares_insert_authed'
  ) then
    create policy recipe_shares_insert_authed
    on public.recipe_shares
    for insert
    with check (auth.uid() is not null and auth.uid() = created_by);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='recipe_shares' and policyname='recipe_shares_delete_own'
  ) then
    create policy recipe_shares_delete_own
    on public.recipe_shares
    for delete
    using (auth.uid() = created_by);
  end if;
end$$;

-- RPC: create share token (authenticated)
create or replace function public.create_recipe_share(
  p_recipe_id uuid,
  p_expires_in_days int default 7,
  p_max_uses int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
  v_id uuid;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- generate token (non-guessable)
  v_token := encode(gen_random_bytes(24), 'base64');
  v_token := replace(replace(replace(v_token,'+','-'),'/','_'),'=','');

  if p_expires_in_days is not null then
    v_expires := now() + make_interval(days => greatest(p_expires_in_days, 1));
  else
    v_expires := null;
  end if;

  insert into public.recipe_shares(recipe_id, token, expires_at, max_uses, created_by)
  values (p_recipe_id, v_token, v_expires, p_max_uses, auth.uid())
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'token', v_token, 'expires_at', v_expires, 'max_uses', p_max_uses);
end;
$$;

-- RPC: fetch a shared recipe by token (public read)
create or replace function public.get_shared_recipe(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  r record;
begin
  select * into s
  from public.recipe_shares
  where token = p_token;

  if not found then
    raise exception 'Not found';
  end if;

  if s.expires_at is not null and s.expires_at < now() then
    raise exception 'Expired';
  end if;

  if s.max_uses is not null and s.used_count >= s.max_uses then
    raise exception 'Link already used';
  end if;

  select * into r from public.recipes where id = s.recipe_id;
  if not found then
    raise exception 'Recipe missing';
  end if;

  update public.recipe_shares
    set used_count = used_count + 1
    where id = s.id;

  return jsonb_build_object(
    'recipe', to_jsonb(r),
    'meta', jsonb_build_object(
      'expires_at', s.expires_at,
      'max_uses', s.max_uses,
      'used_count', s.used_count + 1
    )
  );
end;
$$;

-- IMPORTANT:
-- Because these functions are SECURITY DEFINER, consider reviewing them before running.
-- They intentionally allow public read of ONE recipe via an unguessable token.
