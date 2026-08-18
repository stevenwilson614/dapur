import { normalizeKey } from "@/lib/shopping";
import type { Ingredient, ImportedRecipe, Recipe, Step } from "@/lib/types";

/**
 * The editable shape used by the review form. Olivia edits English; Indonesian
 * for the cook is kept alongside so a translation from import isn't overwritten.
 */
export interface DraftIngredient {
  amount: string;
  /** What Olivia sees and edits — English when we have it. */
  name: string;
  /** Indonesian name for the cook. Empty on a manual English-only entry. */
  name_id: string;
  note?: string;
  cook_note?: string;
}

export interface RecipeDraft {
  title_id: string;
  title_en: string;
  servings: string;
  total_minutes: string;
  ingredients: DraftIngredient[];
  /** Olivia's steps — English when we have it. */
  stepsText: string;
  /** Indonesian steps for the cook. */
  stepsTextId: string;
  /** Nia's clarifications, aligned with stepsTextId lines. */
  stepCookNotes: string[];
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
    ingredients: [{ amount: "", name: "", name_id: "" }],
    stepsText: "",
    stepsTextId: "",
    stepCookNotes: [],
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
      name: ing.item_en?.trim() || ing.item_id,
      name_id: ing.item_id,
      note: ing.note ?? undefined,
      cook_note: ing.cook_note ?? undefined,
    })),
    stepsText: (imported.steps ?? []).map((s) => s.en?.trim() || s.id).join("\n"),
    stepsTextId: (imported.steps ?? []).map((s) => s.id).join("\n"),
    stepCookNotes: (imported.steps ?? []).map((s) => s.cook_note ?? ""),
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
      name: ing.item_en?.trim() || ing.item_id,
      name_id: ing.item_id,
      note: ing.note ?? undefined,
      cook_note: ing.cook_note ?? undefined,
    })),
    stepsText: (recipe.steps ?? []).map((s) => s.en?.trim() || s.id).join("\n"),
    stepsTextId: (recipe.steps ?? []).map((s) => s.id).join("\n"),
    stepCookNotes: (recipe.steps ?? []).map((s) => s.cook_note ?? ""),
    tags: recipe.tags ?? [],
    standing_notes: recipe.standing_notes ?? "",
    hero_image_url: recipe.hero_image_url,
    source_url: recipe.source_url,
  };
}

/** "2 tbsp" -> { qty: "2", unit: "tbsp" }; "to taste" -> { unit: "to taste" }. */
function splitAmount(amount: string): { qty: string | null; unit: string | null } {
  const trimmed = amount.trim();
  if (!trimmed) return { qty: null, unit: null };

  const match = trimmed.match(/^([\d]+(?:[.,/]\d+)?(?:\s*[-–]\s*\d+(?:[.,/]\d+)?)?)\s*(.*)$/);
  if (!match) return { qty: null, unit: trimmed };
  return { qty: match[1].trim(), unit: match[2].trim() || null };
}

export function draftToIngredients(draft: RecipeDraft): Ingredient[] {
  return draft.ingredients
    .filter((row) => row.name.trim() || row.name_id.trim())
    .map((row) => {
      const { qty, unit } = splitAmount(row.amount);
      const name = row.name.trim();
      const nameId = row.name_id.trim();
      const item_id = nameId || name;
      const item_en = name && name !== item_id ? name : nameId ? null : name || null;
      return {
        qty,
        unit,
        item_id,
        item_en,
        note: row.note?.trim() || null,
        cook_note: row.cook_note?.trim() || null,
        norm_key: normalizeKey(item_id),
      };
    });
}

function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean);
}

export function draftToSteps(draft: RecipeDraft): Step[] {
  const enLines = splitLines(draft.stepsText);
  const idLines = splitLines(draft.stepsTextId);
  const count = Math.max(enLines.length, idLines.length);
  const steps: Step[] = [];
  for (let i = 0; i < count; i++) {
    const en = enLines[i] ?? "";
    const id = idLines[i] ?? "";
    const cook = id || en;
    if (!cook) continue;
    steps.push({
      id: cook,
      en: en && en !== cook ? en : id ? null : en || null,
      cook_note: draft.stepCookNotes[i]?.trim() || null,
    });
  }
  return steps;
}

export function draftToRecipe(draft: RecipeDraft, householdId: string, sourceType: Recipe["source_type"]) {
  const titleEn = draft.title_en.trim();
  const titleId = draft.title_id.trim() || titleEn || "Untitled recipe";
  return {
    household_id: householdId,
    title_id: titleId,
    title_en: titleEn || null,
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
