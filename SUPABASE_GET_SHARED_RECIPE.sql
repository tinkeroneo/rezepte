-- get_shared_recipe: Public read endpoint for share tokens
-- Returns a JSON payload for rendering the read-only share view.
--
-- Payload:
-- {
--   recipe: <recipes row>,
--   parts: [ { part: <recipe_parts row>, recipe: <child recipes row> }, ... ]
-- }
--
-- Requirements:
--   - public.recipe_shares (token text, recipe_id uuid, expires_at timestamptz, max_uses int, used_count int)
--   - public.recipes (id uuid, title text, ingredients jsonb, steps jsonb, image_url text, ...)
--   - public.recipe_parts (space_id uuid, parent_id uuid, child_id uuid, sort_order int, ...)

create or replace function public.get_shared_recipe(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  s record;
  r record;
begin
  if p_token is null or length(trim(p_token)) = 0 then
    raise exception 'missing_token';
  end if;

  select *
    into s
  from public.recipe_shares
  where token = p_token
  limit 1;

  if not found then
    raise exception 'not_found';
  end if;

  if s.expires_at is not null and s.expires_at < now() then
    raise exception 'expired';
  end if;

  if s.max_uses is not null and s.used_count >= s.max_uses then
    raise exception 'max_uses';
  end if;

  -- count usage
  update public.recipe_shares
  set used_count = used_count + 1
  where token = p_token;

  select *
    into r
  from public.recipes
  where id = s.recipe_id
  limit 1;

  if not found then
    raise exception 'recipe_missing';
  end if;

  return jsonb_build_object(
    'recipe', to_jsonb(r),
    'parts', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'part', to_jsonb(rp),
            'recipe', to_jsonb(cr)
          )
          order by rp.sort_order asc
        )
        from public.recipe_parts rp
        join public.recipes cr on cr.id = rp.child_id
        where rp.parent_id = s.recipe_id
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.get_shared_recipe(text) to anon, authenticated;

notify pgrst, 'reload schema';
