import type { Meal } from "@/lib/types";

export interface ShoppingLine {
  norm_key: string;
  /** Display name — the first spelling we saw for this ingredient. */
  label: string;
  /** "5 buah", "2 sdm" — kept separate on purpose, never summed. */
  amounts: string[];
  /** Which meals need it, so the cook can drop one dish and know what to skip. */
  meals: string[];
}

export function normalizeKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Roll a set of meals up into one shopping list.
 *
 * Deliberately no unit arithmetic: "5 buah + 2 sdm" is shown as two amounts on
 * one line rather than converted into a single number. Anyone reading it in a
 * market understands it immediately, and it can never be quietly wrong.
 */
export function buildShoppingList(meals: Meal[]): ShoppingLine[] {
  const lines = new Map<string, ShoppingLine>();

  for (const meal of meals) {
    if (meal.status === "skipped") continue;

    for (const mr of meal.recipes) {
      const mealLabel = meal.title || mr.recipe.title_id;

      for (const ing of mr.recipe.ingredients ?? []) {
        const key = ing.norm_key || normalizeKey(ing.item_id);
        if (!key) continue;

        let line = lines.get(key);
        if (!line) {
          line = { norm_key: key, label: ing.item_id, amounts: [], meals: [] };
          lines.set(key, line);
        }

        const amount = [ing.qty, ing.unit].filter(Boolean).join(" ").trim();
        if (amount && !line.amounts.includes(amount)) line.amounts.push(amount);
        if (!line.meals.includes(mealLabel)) line.meals.push(mealLabel);
      }
    }
  }

  return [...lines.values()].sort((a, b) => a.label.localeCompare(b.label, "id"));
}

export function formatAmounts(line: ShoppingLine): string {
  return line.amounts.join(" + ");
}
