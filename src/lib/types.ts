export type Slot = "sarapan" | "makan_siang" | "makan_malam" | "camilan";
export type MealStatus = "planned" | "cooked" | "skipped";
export type Verdict = "keeper" | "no";
export type Role = "planner" | "cook";

export const SLOT_ORDER: Slot[] = ["sarapan", "makan_siang", "makan_malam", "camilan"];

export const SLOT_LABEL: Record<Slot, string> = {
  sarapan: "Sarapan",
  makan_siang: "Makan siang",
  makan_malam: "Makan malam",
  camilan: "Camilan",
};

/** For the narrow column on the week grid — "Makan siang" and "Makan malam"
 *  both truncate to "Makan", which is exactly the distinction that matters. */
export const SLOT_SHORT: Record<Slot, string> = {
  sarapan: "Pagi",
  makan_siang: "Siang",
  makan_malam: "Malam",
  camilan: "Camilan",
};

export interface Ingredient {
  qty?: string | null;
  unit?: string | null;
  /** Indonesian name — what the cook reads and shops for. */
  item_id: string;
  item_en?: string | null;
  note?: string | null;
  /** Lowercased Indonesian name, used to group the shopping list. */
  norm_key: string;
}

export interface Step {
  id: string;
  en?: string | null;
}

export interface Household {
  id: string;
  name: string;
  link_token: string;
  cook_pin_hash: string | null;
  slots: Slot[];
  default_servings: number;
  show_read_receipt: boolean;
  timezone: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  title_id: string;
  title_en: string | null;
  source_type: "url" | "photo" | "paste" | "manual";
  source_url: string | null;
  hero_image_url: string | null;
  servings: number | null;
  total_minutes: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  standing_notes: string | null;
  tags: string[];
  verdict: Verdict | null;
  verdict_at: string | null;
  archived: boolean;
  created_at: string;
}

export interface MealRecipe {
  id: string;
  meal_id: string;
  recipe_id: string;
  position: number;
  portion_note: string | null;
  recipe: Recipe;
}

export interface Meal {
  id: string;
  household_id: string;
  date: string;
  slot: Slot;
  title: string | null;
  notes_today: string | null;
  status: MealStatus;
  cooked_at: string | null;
  seen_at: string | null;
  position: number;
  recipes: MealRecipe[];
}

/** Shape returned by the recipe-import edge function. */
export interface ImportedRecipe {
  title_id: string;
  title_en?: string | null;
  servings?: number | null;
  total_minutes?: number | null;
  ingredients: Ingredient[];
  steps: Step[];
  tags: string[];
  hero_image_url?: string | null;
  source_url?: string | null;
  notes?: string | null;
}
