import { normalizeKey } from "@/lib/shopping";
import type { Ingredient, ImportedRecipe, Recipe, Step } from "@/lib/types";

/**
 * The editable shape used by the review form. Ingredients keep amount and name
 * as two plain fields — the split into qty/unit is a detail the form shouldn't
 * make Olivia think about, so it happens on the way in and out.
 */
export interface DraftIngredient {
  amount: string;
  name: string;
  note?: string;
}

export interface RecipeDraft {
  title_id: string;
  title_en: string;
  servings: string;
  total_minutes: string;
  ingredients: DraftIngredient[];
  stepsText: string;
  tags: string[];
  standing_notes: string;
  hero_image_url: string | null;
  source_url: string | null;
}

export function emptyDraft(): RecipeDraft {
  return {
    title_id: "",
    title_en: "",
    servings: "",
    total_minutes: "",
    ingredients: [{ amount: "", name: "" }],
    stepsText: "",
    tags: [],
    standing_notes: "",
    hero_image_url: null,
    source_url: null,
  };
}

export function draftFromImport(imported: ImportedRecipe): RecipeDraft {
  return {
    title_id: imported.title_id ?? "",
    title_en: imported.title_en ?? "",
    servings: imported.servings ? String(imported.servings) : "",
    total_minutes: imported.total_minutes ? String(imported.total_minutes) : "",
    ingredients: (imported.ingredients ?? []).map((ing) => ({
      amount: [ing.qty, ing.unit].filter(Boolean).join(" ").trim(),
      name: ing.item_id,
      note: ing.note ?? undefined,
    })),
    stepsText: (imported.steps ?? []).map((s) => s.id).join("\n"),
    tags: imported.tags ?? [],
    standing_notes: imported.notes ?? "",
    hero_image_url: imported.hero_image_url ?? null,
    source_url: imported.source_url ?? null,
  };
}

export function draftFromRecipe(recipe: Recipe): RecipeDraft {
  return {
    title_id: recipe.title_id,
    title_en: recipe.title_en ?? "",
    servings: recipe.servings ? String(recipe.servings) : "",
    total_minutes: recipe.total_minutes ? String(recipe.total_minutes) : "",
    ingredients: (recipe.ingredients ?? []).map((ing) => ({
      amount: [ing.qty, ing.unit].filter(Boolean).join(" ").trim(),
      name: ing.item_id,
      note: ing.note ?? undefined,
    })),
    stepsText: (recipe.steps ?? []).map((s) => s.id).join("\n"),
    tags: recipe.tags ?? [],
    standing_notes: recipe.standing_notes ?? "",
    hero_image_url: recipe.hero_image_url,
    source_url: recipe.source_url,
  };
}

/** "2 sdm" -> { qty: "2", unit: "sdm" }; "secukupnya" -> { unit: "secukupnya" }. */
function splitAmount(amount: string): { qty: string | null; unit: string | null } {
  const trimmed = amount.trim();
  if (!trimmed) return { qty: null, unit: null };

  const match = trimmed.match(/^([\d]+(?:[.,/]\d+)?(?:\s*[-–]\s*\d+(?:[.,/]\d+)?)?)\s*(.*)$/);
  if (!match) return { qty: null, unit: trimmed };
  return { qty: match[1].trim(), unit: match[2].trim() || null };
}

export function draftToIngredients(draft: RecipeDraft): Ingredient[] {
  return draft.ingredients
    .filter((row) => row.name.trim())
    .map((row) => {
      const { qty, unit } = splitAmount(row.amount);
      const name = row.name.trim();
      return {
        qty,
        unit,
        item_id: name,
        item_en: null,
        note: row.note?.trim() || null,
        norm_key: normalizeKey(name),
      };
    });
}

export function draftToSteps(draft: RecipeDraft): Step[] {
  return draft.stepsText
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => ({ id: line, en: null }));
}

export function draftToRecipe(draft: RecipeDraft, householdId: string, sourceType: Recipe["source_type"]) {
  return {
    household_id: householdId,
    title_id: draft.title_id.trim() || "Resep tanpa judul",
    title_en: draft.title_en.trim() || null,
    source_type: sourceType,
    source_url: draft.source_url,
    hero_image_url: draft.hero_image_url,
    servings: draft.servings ? Number(draft.servings) : null,
    total_minutes: draft.total_minutes ? Number(draft.total_minutes) : null,
    ingredients: draftToIngredients(draft),
    steps: draftToSteps(draft),
    standing_notes: draft.standing_notes.trim() || null,
    tags: draft.tags,
  };
}
