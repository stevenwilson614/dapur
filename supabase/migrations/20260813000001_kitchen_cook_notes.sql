-- Let the cook leave a clarification on an ingredient or step. She cannot
-- edit the recipe itself — only the cook_note field on that one line.

create or replace function public.kitchen_set_cook_note(
  p_recipe_id uuid,
  p_kind text,
  p_index int,
  p_note text
)
returns kitchen_recipes
language plpgsql
security definer
set search_path = public
as $$
declare
  rec kitchen_recipes;
  note text;
  arr jsonb;
  len int;
begin
  if p_kind not in ('ingredient', 'step') then
    raise exception 'invalid kind';
  end if;

  select * into rec from kitchen_recipes where id = p_recipe_id;
  if rec.id is null then
    raise exception 'recipe not found';
  end if;
  if not kitchen_private.is_member(rec.household_id) then
    raise exception 'not a member of this household';
  end if;

  note := nullif(btrim(coalesce(p_note, '')), '');
  arr := case when p_kind = 'ingredient' then rec.ingredients else rec.steps end;
  len := coalesce(jsonb_array_length(arr), 0);
  if p_index < 0 or p_index >= len then
    raise exception 'invalid index';
  end if;

  if note is null then
    arr := arr #- array[p_index::text, 'cook_note'];
  else
    arr := jsonb_set(arr, array[p_index::text, 'cook_note'], to_jsonb(note), true);
  end if;

  if p_kind = 'ingredient' then
    update kitchen_recipes set ingredients = arr where id = rec.id returning * into rec;
  else
    update kitchen_recipes set steps = arr where id = rec.id returning * into rec;
  end if;

  return rec;
end;
$$;

grant execute on function public.kitchen_set_cook_note(uuid, text, int, text) to authenticated;

notify pgrst, 'reload schema';
