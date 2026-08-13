-- Align helpers with the live cloud schema: kitchen_private.* plus
-- kitchen_create_household (used by the planner onboarding RPC).

create schema if not exists kitchen_private;

create or replace function kitchen_private.is_member(hh uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from kitchen_members m
    where m.household_id = hh and m.user_id = auth.uid()
  );
$$;

create or replace function kitchen_private.is_planner(hh uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from kitchen_members m
    where m.household_id = hh and m.user_id = auth.uid() and m.role = 'planner'
  );
$$;

create or replace function public.kitchen_create_household(p_name text)
returns kitchen_households
language plpgsql
security definer
set search_path = public
as $$
declare
  hh kitchen_households;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  insert into kitchen_households (name)
  values (coalesce(nullif(trim(p_name), ''), 'Dapur'))
  returning * into hh;

  insert into kitchen_members (household_id, user_id, role)
  values (hh.id, auth.uid(), 'planner');

  return hh;
end;
$$;

grant usage on schema kitchen_private to authenticated, anon, service_role;
grant execute on function kitchen_private.is_member(uuid) to authenticated, anon, service_role;
grant execute on function kitchen_private.is_planner(uuid) to authenticated, anon, service_role;
grant execute on function public.kitchen_create_household(text) to authenticated;

-- Recreate policies against kitchen_private.* (drop public kitchen_is_* if present).
drop policy if exists kitchen_households_select on kitchen_households;
create policy kitchen_households_select on kitchen_households
  for select to authenticated
  using (kitchen_private.is_member(id));

drop policy if exists kitchen_households_update on kitchen_households;
create policy kitchen_households_update on kitchen_households
  for update to authenticated
  using (kitchen_private.is_planner(id))
  with check (kitchen_private.is_planner(id));

drop policy if exists kitchen_members_select on kitchen_members;
create policy kitchen_members_select on kitchen_members
  for select to authenticated
  using (user_id = auth.uid() or kitchen_private.is_planner(household_id));

drop policy if exists kitchen_recipes_select on kitchen_recipes;
create policy kitchen_recipes_select on kitchen_recipes
  for select to authenticated
  using (kitchen_private.is_member(household_id));

drop policy if exists kitchen_recipes_write on kitchen_recipes;
create policy kitchen_recipes_write on kitchen_recipes
  for all to authenticated
  using (kitchen_private.is_planner(household_id))
  with check (kitchen_private.is_planner(household_id));

drop policy if exists kitchen_meals_select on kitchen_meals;
create policy kitchen_meals_select on kitchen_meals
  for select to authenticated
  using (kitchen_private.is_member(household_id));

drop policy if exists kitchen_meals_write on kitchen_meals;
create policy kitchen_meals_write on kitchen_meals
  for all to authenticated
  using (kitchen_private.is_planner(household_id))
  with check (kitchen_private.is_planner(household_id));

drop policy if exists kitchen_meal_recipes_select on kitchen_meal_recipes;
create policy kitchen_meal_recipes_select on kitchen_meal_recipes
  for select to authenticated
  using (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_private.is_member(m.household_id)
  ));

drop policy if exists kitchen_meal_recipes_write on kitchen_meal_recipes;
create policy kitchen_meal_recipes_write on kitchen_meal_recipes
  for all to authenticated
  using (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_private.is_planner(m.household_id)
  ))
  with check (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_private.is_planner(m.household_id)
  ));

drop policy if exists kitchen_feedback_select on kitchen_feedback;
create policy kitchen_feedback_select on kitchen_feedback
  for select to authenticated
  using (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_private.is_member(m.household_id)
  ));

drop policy if exists kitchen_feedback_write on kitchen_feedback;
create policy kitchen_feedback_write on kitchen_feedback
  for all to authenticated
  using (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_private.is_planner(m.household_id)
  ))
  with check (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_private.is_planner(m.household_id)
  ));

drop policy if exists kitchen_shopping_state_all on kitchen_shopping_state;
create policy kitchen_shopping_state_all on kitchen_shopping_state
  for all to authenticated
  using (kitchen_private.is_member(household_id))
  with check (kitchen_private.is_member(household_id));

drop policy if exists kitchen_shopping_extras_all on kitchen_shopping_extras;
create policy kitchen_shopping_extras_all on kitchen_shopping_extras
  for all to authenticated
  using (kitchen_private.is_member(household_id))
  with check (kitchen_private.is_member(household_id));

create or replace function public.kitchen_mark_cooked(p_meal_id uuid, p_cooked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hh uuid;
begin
  select household_id into hh from kitchen_meals where id = p_meal_id;
  if hh is null or not kitchen_private.is_member(hh) then
    raise exception 'not a member of this household';
  end if;

  update kitchen_meals
     set status    = case when p_cooked then 'cooked' else 'planned' end,
         cooked_at = case when p_cooked then now() else null end
   where id = p_meal_id;
end;
$$;

create or replace function public.kitchen_touch_seen(p_meal_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update kitchen_meals m
     set seen_at = now()
    from kitchen_households h
   where m.id = any(p_meal_ids)
     and h.id = m.household_id
     and h.show_read_receipt
     and m.seen_at is null
     and kitchen_private.is_member(m.household_id);
end;
$$;
