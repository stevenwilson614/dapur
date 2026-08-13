import type { Ingredient, Recipe, Step } from "@/lib/types";

/** Planner-facing title: English when we have it, Indonesian otherwise. */
export function recipeTitle(recipe: Pick<Recipe, "title_id" | "title_en">): string {
  return recipe.title_en?.trim() || recipe.title_id;
}

export function ingredientName(ing: Ingredient): string {
  return ing.item_en?.trim() || ing.item_id;
}

export function stepText(step: Step): string {
  return step.en?.trim() || step.id;
}

export function mealHeading(meal: {
  title: string | null;
  recipes: Array<{ recipe: Pick<Recipe, "title_id" | "title_en"> }>;
}): string {
  return meal.title?.trim() || meal.recipes.map((r) => recipeTitle(r.recipe)).join(" + ") || "Not planned yet";
}
