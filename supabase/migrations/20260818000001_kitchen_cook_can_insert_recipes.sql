-- Cooks can add recipes to the household library. Editing and deleting
-- recipes stays planner-only; cook notes still go through kitchen_set_cook_note.

drop policy if exists kitchen_recipes_write on kitchen_recipes;
drop policy if exists kitchen_recipes_insert on kitchen_recipes;
drop policy if exists kitchen_recipes_update on kitchen_recipes;
drop policy if exists kitchen_recipes_delete on kitchen_recipes;

create policy kitchen_recipes_insert on kitchen_recipes
  for insert to authenticated
  with check (kitchen_private.is_member(household_id));

create policy kitchen_recipes_update on kitchen_recipes
  for update to authenticated
  using (kitchen_private.is_planner(household_id))
  with check (kitchen_private.is_planner(household_id));

create policy kitchen_recipes_delete on kitchen_recipes
  for delete to authenticated
  using (kitchen_private.is_planner(household_id));
