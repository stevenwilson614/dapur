-- Row-level security for Dapur.
--
-- Two roles, both real authenticated users: the planner signs in with a
-- password, the cook is an anonymous auth user bound to the household by the
-- `kitchen-cook-login` edge function after a link-token + PIN check.
--
-- Least privilege for the cook: she can read everything in her household, mark
-- meals cooked (via RPC, not a direct UPDATE), and manage the shopping list.
-- She cannot create, edit, or delete recipes, meals, or verdicts.

-- Security-definer helpers so policies can consult kitchen_members without the
-- membership check recursing back through kitchen_members' own RLS.

create or replace function kitchen_is_member(hh uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from kitchen_members m
    where m.household_id = hh and m.user_id = auth.uid()
  );
$$;

create or replace function kitchen_is_planner(hh uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from kitchen_members m
    where m.household_id = hh and m.user_id = auth.uid() and m.role = 'planner'
  );
$$;

alter table kitchen_households      enable row level security;
alter table kitchen_members         enable row level security;
alter table kitchen_recipes         enable row level security;
alter table kitchen_meals           enable row level security;
alter table kitchen_meal_recipes    enable row level security;
alter table kitchen_feedback        enable row level security;
alter table kitchen_shopping_state  enable row level security;
alter table kitchen_shopping_extras enable row level security;

-- ---------------------------------------------------------------- households

drop policy if exists kitchen_households_select on kitchen_households;
create policy kitchen_households_select on kitchen_households
  for select to authenticated
  using (kitchen_is_member(id));

drop policy if exists kitchen_households_update on kitchen_households;
create policy kitchen_households_update on kitchen_households
  for update to authenticated
  using (kitchen_is_planner(id))
  with check (kitchen_is_planner(id));

-- Creating a household is how a new planner onboards, so it is self-serve.
drop policy if exists kitchen_households_insert on kitchen_households;
create policy kitchen_households_insert on kitchen_households
  for insert to authenticated
  with check (true);

-- ------------------------------------------------------------------- members

-- Read your own membership rows only. Binding a cook to a household is done by
-- the edge function with the service role, never from the client.
drop policy if exists kitchen_members_select on kitchen_members;
create policy kitchen_members_select on kitchen_members
  for select to authenticated
  using (user_id = auth.uid() or kitchen_is_planner(household_id));

drop policy if exists kitchen_members_insert_self on kitchen_members;
create policy kitchen_members_insert_self on kitchen_members
  for insert to authenticated
  with check (user_id = auth.uid() and role = 'planner');

-- ------------------------------------------------------------------- recipes

drop policy if exists kitchen_recipes_select on kitchen_recipes;
create policy kitchen_recipes_select on kitchen_recipes
  for select to authenticated
  using (kitchen_is_member(household_id));

drop policy if exists kitchen_recipes_write on kitchen_recipes;
create policy kitchen_recipes_write on kitchen_recipes
  for all to authenticated
  using (kitchen_is_planner(household_id))
  with check (kitchen_is_planner(household_id));

-- --------------------------------------------------------------------- meals

drop policy if exists kitchen_meals_select on kitchen_meals;
create policy kitchen_meals_select on kitchen_meals
  for select to authenticated
  using (kitchen_is_member(household_id));

-- Planner only. The cook changes status through kitchen_mark_cooked() below.
drop policy if exists kitchen_meals_write on kitchen_meals;
create policy kitchen_meals_write on kitchen_meals
  for all to authenticated
  using (kitchen_is_planner(household_id))
  with check (kitchen_is_planner(household_id));

drop policy if exists kitchen_meal_recipes_select on kitchen_meal_recipes;
create policy kitchen_meal_recipes_select on kitchen_meal_recipes
  for select to authenticated
  using (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_is_member(m.household_id)
  ));

drop policy if exists kitchen_meal_recipes_write on kitchen_meal_recipes;
create policy kitchen_meal_recipes_write on kitchen_meal_recipes
  for all to authenticated
  using (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_is_planner(m.household_id)
  ))
  with check (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_is_planner(m.household_id)
  ));

-- ------------------------------------------------------------------ feedback

drop policy if exists kitchen_feedback_select on kitchen_feedback;
create policy kitchen_feedback_select on kitchen_feedback
  for select to authenticated
  using (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_is_member(m.household_id)
  ));

drop policy if exists kitchen_feedback_write on kitchen_feedback;
create policy kitchen_feedback_write on kitchen_feedback
  for all to authenticated
  using (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_is_planner(m.household_id)
  ))
  with check (exists (
    select 1 from kitchen_meals m
    where m.id = meal_id and kitchen_is_planner(m.household_id)
  ));

-- ------------------------------------------------------------------ shopping

-- Both roles: the cook is the one who actually shops.
drop policy if exists kitchen_shopping_state_all on kitchen_shopping_state;
create policy kitchen_shopping_state_all on kitchen_shopping_state
  for all to authenticated
  using (kitchen_is_member(household_id))
  with check (kitchen_is_member(household_id));

drop policy if exists kitchen_shopping_extras_all on kitchen_shopping_extras;
create policy kitchen_shopping_extras_all on kitchen_shopping_extras
  for all to authenticated
  using (kitchen_is_member(household_id))
  with check (kitchen_is_member(household_id));

-- ----------------------------------------------------------------- cook RPCs

-- The cook's one write to the plan: "selesai dimasak".
create or replace function kitchen_mark_cooked(p_meal_id uuid, p_cooked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  hh uuid;
begin
  select household_id into hh from kitchen_meals where id = p_meal_id;
  if hh is null or not kitchen_is_member(hh) then
    raise exception 'not a member of this household';
  end if;

  update kitchen_meals
     set status    = case when p_cooked then 'cooked' else 'planned' end,
         cooked_at = case when p_cooked then now() else null end
   where id = p_meal_id;
end;
$$;

-- Read receipt, only recorded when the household has opted in.
create or replace function kitchen_touch_seen(p_meal_ids uuid[])
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
     and kitchen_is_member(m.household_id);
end;
$$;

grant execute on function kitchen_mark_cooked(uuid, boolean) to authenticated;
grant execute on function kitchen_touch_seen(uuid[]) to authenticated;

-- Storage for recipe hero images, so a recipe survives its source going away.
insert into storage.buckets (id, name, public)
values ('kitchen', 'kitchen', true)
on conflict (id) do nothing;
