import { supabase } from "@/lib/supabase";
import type { Household, Meal, Recipe, Slot, Verdict } from "@/lib/types";

const MEAL_SELECT =
  "*, recipes:kitchen_meal_recipes(id, meal_id, recipe_id, position, portion_note, recipe:kitchen_recipes(*))";

function sortMeal(meal: Meal): Meal {
  meal.recipes = (meal.recipes ?? []).sort((a, b) => a.position - b.position);
  return meal;
}

// ------------------------------------------------------------------ household

export async function fetchMyHousehold(): Promise<{ household: Household; role: string } | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("kitchen_members")
    .select("role, household:kitchen_households(*)")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.household) return null;

  return {
    household: data.household as unknown as Household,
    role: data.role as string,
  };
}

/**
 * Household + first membership are created together in one RPC. Split across
 * two client calls, the household row exists for a moment with no members —
 * and a household with no members is invisible to everyone, including whoever
 * just created it, because that's exactly what the RLS policy checks.
 */
export async function createHousehold(name: string): Promise<Household> {
  const { data, error } = await supabase.rpc("kitchen_create_household", { p_name: name });
  if (error) throw error;
  return data as Household;
}

export async function updateHousehold(id: string, patch: Partial<Household>) {
  const { error } = await supabase.from("kitchen_households").update(patch).eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------- meals

export async function fetchMeals(householdId: string, from: string, to: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from("kitchen_meals")
    .select(MEAL_SELECT)
    .eq("household_id", householdId)
    .gte("date", from)
    .lte("date", to)
    .order("date");

  if (error) throw error;
  return ((data ?? []) as unknown as Meal[]).map(sortMeal);
}

export async function fetchMeal(mealId: string): Promise<Meal | null> {
  const { data, error } = await supabase
    .from("kitchen_meals")
    .select(MEAL_SELECT)
    .eq("id", mealId)
    .maybeSingle();

  if (error) throw error;
  return data ? sortMeal(data as unknown as Meal) : null;
}

export async function createMeal(
  householdId: string,
  date: string,
  slot: Slot,
  title?: string
): Promise<Meal> {
  const { data, error } = await supabase
    .from("kitchen_meals")
    .insert({ household_id: householdId, date, slot, title: title ?? null })
    .select(MEAL_SELECT)
    .single();

  if (error) throw error;
  return sortMeal(data as unknown as Meal);
}

export async function updateMeal(mealId: string, patch: Record<string, unknown>) {
  const { error } = await supabase.from("kitchen_meals").update(patch).eq("id", mealId);
  if (error) throw error;
}

export async function deleteMeal(mealId: string) {
  const { error } = await supabase.from("kitchen_meals").delete().eq("id", mealId);
  if (error) throw error;
}

/** The cook's one write to the plan. Goes through an RPC, not a table update. */
export async function markCooked(mealId: string, cooked: boolean) {
  const { error } = await supabase.rpc("kitchen_mark_cooked", {
    p_meal_id: mealId,
    p_cooked: cooked,
  });
  if (error) throw error;
}

export async function attachRecipe(mealId: string, recipeId: string, position: number) {
  const { error } = await supabase
    .from("kitchen_meal_recipes")
    .insert({ meal_id: mealId, recipe_id: recipeId, position });
  if (error) throw error;
}

export async function detachRecipe(linkId: string) {
  const { error } = await supabase.from("kitchen_meal_recipes").delete().eq("id", linkId);
  if (error) throw error;
}

// -------------------------------------------------------------------- recipes

export async function fetchRecipes(
  householdId: string,
  opts: { onlyKeepers?: boolean } = {}
): Promise<Recipe[]> {
  let q = supabase
    .from("kitchen_recipes")
    .select("*")
    .eq("household_id", householdId)
    .eq("archived", false)
    .order("created_at", { ascending: false });

  if (opts.onlyKeepers) q = q.eq("verdict", "keeper");

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

export async function saveRecipe(recipe: Partial<Recipe> & { household_id: string; title_id: string }) {
  const { data, error } = await supabase
    .from("kitchen_recipes")
    .insert(recipe)
    .select()
    .single();
  if (error) throw error;
  return data as Recipe;
}

export async function updateRecipe(id: string, patch: Partial<Recipe>) {
  const { error } = await supabase.from("kitchen_recipes").update(patch).eq("id", id);
  if (error) throw error;
}

// ------------------------------------------------------------------- verdicts

/**
 * One question at the meal level, one row written per recipe. A two-recipe meal
 * gives both recipes their own library status from a single tap — and a later
 * "actually the sauce was off" can demote just that one.
 */
export async function submitVerdict(meal: Meal, verdict: "keep" | "no", comment?: string) {
  const rows = meal.recipes.map((mr) => ({
    meal_id: meal.id,
    recipe_id: mr.recipe_id,
    verdict,
    comment: comment ?? null,
  }));

  if (rows.length) {
    const { error } = await supabase
      .from("kitchen_feedback")
      .upsert(rows, { onConflict: "meal_id,recipe_id" });
    if (error) throw error;

    const recipeVerdict: Verdict = verdict === "keep" ? "keeper" : "no";
    const { error: recipeError } = await supabase
      .from("kitchen_recipes")
      .update({ verdict: recipeVerdict, verdict_at: new Date().toISOString() })
      .in("id", meal.recipes.map((mr) => mr.recipe_id));
    if (recipeError) throw recipeError;
  }
}

/** Meals that were cooked but never rated — drives the card on the week screen. */
export async function fetchUnratedMeals(householdId: string, since: string): Promise<Meal[]> {
  const { data, error } = await supabase
    .from("kitchen_meals")
    .select(MEAL_SELECT)
    .eq("household_id", householdId)
    .eq("status", "cooked")
    .gte("date", since)
    .order("date", { ascending: false });

  if (error) throw error;

  const meals = ((data ?? []) as unknown as Meal[]).map(sortMeal).filter((m) => m.recipes.length);
  if (!meals.length) return [];

  const { data: rated } = await supabase
    .from("kitchen_feedback")
    .select("meal_id")
    .in("meal_id", meals.map((m) => m.id));

  const ratedIds = new Set((rated ?? []).map((r) => r.meal_id as string));
  return meals.filter((m) => !ratedIds.has(m.id));
}

// ------------------------------------------------------------------- shopping

export async function fetchShoppingState(householdId: string, week: string) {
  const [state, extras] = await Promise.all([
    supabase
      .from("kitchen_shopping_state")
      .select("norm_key, checked")
      .eq("household_id", householdId)
      .eq("week_start", week),
    supabase
      .from("kitchen_shopping_extras")
      .select("*")
      .eq("household_id", householdId)
      .eq("week_start", week)
      .order("created_at"),
  ]);

  if (state.error) throw state.error;
  if (extras.error) throw extras.error;

  const checked = new Set(
    (state.data ?? []).filter((r) => r.checked).map((r) => r.norm_key as string)
  );
  return { checked, extras: extras.data ?? [] };
}

export async function setChecked(
  householdId: string,
  week: string,
  normKey: string,
  checked: boolean
) {
  const { error } = await supabase.from("kitchen_shopping_state").upsert(
    {
      household_id: householdId,
      week_start: week,
      norm_key: normKey,
      checked,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "household_id,week_start,norm_key" }
  );
  if (error) throw error;
}

export async function addExtra(householdId: string, week: string, label: string) {
  const { data, error } = await supabase
    .from("kitchen_shopping_extras")
    .insert({ household_id: householdId, week_start: week, label })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setExtraChecked(id: string, checked: boolean) {
  const { error } = await supabase.from("kitchen_shopping_extras").update({ checked }).eq("id", id);
  if (error) throw error;
}

export async function removeExtra(id: string) {
  const { error } = await supabase.from("kitchen_shopping_extras").delete().eq("id", id);
  if (error) throw error;
}
