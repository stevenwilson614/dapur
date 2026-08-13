import { useEffect, useMemo, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { attachRecipe, createMeal, fetchMeals, fetchRecipes, updateRecipe } from "@/lib/queries";
import { formatMinutes, longDate, todayISO, weekDays, weekStart } from "@/lib/dates";
import { SLOT_LABEL_EN, SLOT_ORDER } from "@/lib/types";
import type { Recipe, Slot } from "@/lib/types";
import { recipeTitle } from "@/lib/display";
import { mediaUrl } from "@/lib/media";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import AddRecipeSheet from "@/components/AddRecipeSheet";
import RecipeReviewForm from "@/components/RecipeReviewForm";
import { RecipeDraft, draftFromRecipe, draftToIngredients, draftToSteps } from "@/lib/recipeDraft";
import { Spinner } from "@/App";

export default function LibraryPage() {
  const { household, loading } = useHousehold();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [planning, setPlanning] = useState<Recipe | null>(null);
  const [editing, setEditing] = useState<Recipe | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);

  async function load() {
    if (!household) return;
    setBusy(true);
    try {
      setRecipes(await fetchRecipes(household.id));
    } catch (err) {
      console.warn("library load failed", err);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household]);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    recipes.forEach((r) => r.tags.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }, [recipes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes
      .filter((r) => !activeTag || r.tags.includes(activeTag))
      .filter(
        (r) =>
          !q ||
          recipeTitle(r).toLowerCase().includes(q) ||
          r.title_id.toLowerCase().includes(q) ||
          r.tags.some((t) => t.includes(q))
      );
  }, [recipes, search, activeTag]);

  async function saveEdit() {
    if (!editing || !draft) return;
    await updateRecipe(editing.id, {
      title_id: draft.title_id.trim() || draft.title_en.trim() || editing.title_id,
      title_en: draft.title_en.trim() || null,
      servings: draft.servings ? Number(draft.servings) : null,
      total_minutes: draft.total_minutes ? Number(draft.total_minutes) : null,
      ingredients: draftToIngredients(draft),
      steps: draftToSteps(draft),
      standing_notes: draft.standing_notes.trim() || null,
      tags: draft.tags,
    });
    setEditing(null);
    setDraft(null);
    await load();
  }

  if (loading || !household) return <Spinner />;

  return (
    <div className="px-4 pb-8 pt-5">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[1.9rem] leading-none text-ink">Library</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {recipes.length} recipes · {recipes.filter((r) => r.verdict === "keeper").length} keepers
          </p>
        </div>
        <Button onClick={() => setAdding(true)}>
          <Icon name="plus" size={18} /> Recipe
        </Button>
      </header>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-paper-border bg-paper-surface px-3">
        <Icon name="search" size={18} className="text-ink-faint" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recipes…"
          className="w-full bg-transparent py-2.5 outline-none"
        />
      </div>

      {tags.length > 0 && (
        <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm transition ${
                activeTag === tag
                  ? "bg-clay text-paper-surface"
                  : "bg-paper-surface text-ink-muted ring-1 ring-paper-border"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {busy && !recipes.length ? (
        <Spinner label="loading library…" />
      ) : filtered.length ? (
        <div className="space-y-2.5">
          {filtered.map((recipe) => (
            <article
              key={recipe.id}
              className="flex gap-3 rounded-card border border-paper-border bg-paper-surface p-3 shadow-card"
            >
              {mediaUrl(recipe.hero_image_url) ? (
                <img
                  src={mediaUrl(recipe.hero_image_url)!}
                  alt=""
                  className="h-20 w-20 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-paper-sunk text-ink-faint">
                  <Icon name="pot" size={24} />
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start gap-2">
                  <h2 className="min-w-0 flex-1 font-display text-[1.15rem] leading-snug text-ink">
                    {recipeTitle(recipe)}
                  </h2>
                  {recipe.verdict === "keeper" && (
                    <span className="mt-0.5 shrink-0 rounded-full bg-leaf-soft px-2 py-0.5 text-[0.72rem] text-leaf">
                      keeper
                    </span>
                  )}
                </div>

                <p className="mt-0.5 text-sm text-ink-muted">
                  {[formatMinutes(recipe.total_minutes, "en"), recipe.tags.slice(0, 3).join(" · ")]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </p>

                <div className="mt-auto flex gap-3 pt-2">
                  <button
                    onClick={() => setPlanning(recipe)}
                    className="text-sm font-medium text-clay"
                  >
                    Plan
                  </button>
                  <button
                    onClick={() => {
                      setEditing(recipe);
                      setDraft(draftFromRecipe(recipe));
                    }}
                    className="text-sm text-ink-muted"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-paper-line px-4 py-14 text-center">
          <p className="text-ink-muted">
            {recipes.length ? "Nothing matches." : "No recipes in the library yet."}
          </p>
          {!recipes.length && (
            <Button className="mt-4" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} /> Add the first recipe
            </Button>
          )}
        </div>
      )}

      <AddRecipeSheet
        open={adding}
        onClose={() => setAdding(false)}
        householdId={household.id}
        onSaved={() => load()}
      />

      {planning && (
        <PlanSheet
          recipe={planning}
          householdId={household.id}
          slots={household.slots?.length ? household.slots : SLOT_ORDER}
          onClose={() => setPlanning(null)}
        />
      )}

      {editing && draft && (
        <Sheet
          open
          onClose={() => {
            setEditing(null);
            setDraft(null);
          }}
          title="Edit recipe"
          footer={
            <Button full onClick={saveEdit}>
              Save changes
            </Button>
          }
        >
          <RecipeReviewForm draft={draft} onChange={setDraft} />
        </Sheet>
      )}
    </div>
  );
}

/** Two taps to re-plan something already vetted: pick a day, pick a slot. */
function PlanSheet({
  recipe,
  householdId,
  slots,
  onClose,
}: {
  recipe: Recipe;
  householdId: string;
  slots: Slot[];
  onClose: () => void;
}) {
  const [date, setDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const days = useMemo(() => {
    const start = weekStart(todayISO());
    return [...weekDays(start), ...weekDays(start).map((d) => d)].slice(0, 7);
  }, []);
  const upcoming = useMemo(() => {
    const today = todayISO();
    return days.filter((d) => d >= today);
  }, [days]);

  async function plan(slot: Slot) {
    if (!date) return;
    setSaving(true);
    try {
      // Reuse an existing meal in that slot rather than creating a duplicate.
      const existing = await fetchMeals(householdId, date, date);
      const match = existing.find((m) => m.slot === slot);
      const meal = match ?? (await createMeal(householdId, date, slot));
      await attachRecipe(meal.id, recipe.id, meal.recipes?.length ?? 0);
      setDone(`${recipeTitle(recipe)} added to ${SLOT_LABEL_EN[slot].toLowerCase()} ${longDate(date, "en")}.`);
    } catch (err) {
      setDone(err instanceof Error ? err.message : "Couldn't plan that");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Plan" subtitle={recipeTitle(recipe)}>
      {done ? (
        <div className="py-8 text-center">
          <p className="text-ink">{done}</p>
          <Button className="mt-5" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : !date ? (
        <div className="space-y-2">
          {(upcoming.length ? upcoming : days).map((d) => (
            <button
              key={d}
              onClick={() => setDate(d)}
              className="flex w-full items-center justify-between rounded-xl border border-paper-border bg-paper-surface px-4 py-3 text-left hover:border-clay"
            >
              <span className="text-ink">{longDate(d, "en")}</span>
              <Icon name="chevron-right" className="text-ink-faint" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <button onClick={() => setDate(null)} className="mb-2 text-sm text-ink-muted">
            ‹ {longDate(date, "en")}
          </button>
          {slots.map((slot) => (
            <button
              key={slot}
              disabled={saving}
              onClick={() => plan(slot)}
              className="flex w-full items-center justify-between rounded-xl border border-paper-border bg-paper-surface px-4 py-3.5 text-left hover:border-clay disabled:opacity-50"
            >
              <span className="text-ink">{SLOT_LABEL_EN[slot]}</span>
              <Icon name="chevron-right" className="text-ink-faint" />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}
