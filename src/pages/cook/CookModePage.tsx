import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fetchMeal, fetchRecipe, setCookNote } from "@/lib/queries";
import { formatMinutes } from "@/lib/dates";
import { mediaUrl } from "@/lib/media";
import type { Meal, Recipe } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import ViewToggle from "@/components/ViewToggle";
import CookLineNote from "@/components/CookLineNote";
import { Spinner } from "@/App";

/**
 * Full-screen, one recipe, big type. The phone is propped on a counter and the
 * cook's hands are wet — so: no nav, large tap targets, and the screen stays on.
 */
export default function CookModePage() {
  const { mealId, recipeId } = useParams();
  const navigate = useNavigate();
  const [meal, setMeal] = useState<Meal | null>(null);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const backTo = mealId ? "/masak" : "/masak/koleksi";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!recipeId) {
          setError("Resep tidak ditemukan.");
          return;
        }
        if (mealId) {
          const data = await fetchMeal(mealId);
          if (cancelled) return;
          if (!data) {
            setError("Resep tidak ditemukan.");
            return;
          }
          const found = data.recipes.find((mr) => mr.recipe_id === recipeId)?.recipe ?? null;
          if (!found) {
            setError("Resep tidak ditemukan.");
            return;
          }
          setMeal(data);
          setRecipe(found);
          return;
        }
        const data = await fetchRecipe(recipeId);
        if (cancelled) return;
        if (!data) {
          setError("Resep tidak ditemukan.");
          return;
        }
        setMeal(null);
        setRecipe(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Gagal memuat");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mealId, recipeId]);

  // Keep the screen awake while cooking. Silently unsupported on some browsers.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
    };
    nav.wakeLock
      ?.request("screen")
      .then((sentinel) => {
        lock = sentinel;
      })
      .catch(() => {});
    return () => {
      lock?.release().catch(() => {});
    };
  }, []);

  if (error) {
    return (
      <div className="cook flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <ViewToggle />
        <p className="text-ink-muted">{error}</p>
        <button onClick={() => navigate(backTo)} className="text-clay underline underline-offset-4">
          Kembali
        </button>
      </div>
    );
  }

  if (!recipe) return <Spinner label="memuat resep…" />;

  const hero = mediaUrl(recipe.hero_image_url);

  const steps = recipe.steps ?? [];

  function toggleStep(index: number) {
    setDoneSteps((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function saveNote(kind: "ingredient" | "step", index: number, note: string | null) {
    if (!recipe) return;
    const updated = await setCookNote(recipe.id, kind, index, note);
    setRecipe(updated);
    if (meal) {
      setMeal({
        ...meal,
        recipes: meal.recipes.map((mr) =>
          mr.recipe_id === recipe.id ? { ...mr, recipe: updated } : mr
        ),
      });
    }
  }

  return (
    <div className="cook mx-auto min-h-screen w-full max-w-[520px] bg-paper-bg pb-16">
      <ViewToggle />
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-paper-border bg-paper-bg/95 px-3 py-3 backdrop-blur">
        <button
          onClick={() => navigate(backTo)}
          className="flex min-h-[44px] items-center gap-1 rounded-full px-2 text-ink-muted"
        >
          <Icon name="chevron-left" size={22} />
          Kembali
        </button>
      </header>

      <div className="px-5 pt-5">
        {hero && (
          <img src={hero} alt="" className="mb-4 h-48 w-full rounded-2xl object-cover" />
        )}

        <h1 className="font-display text-[2rem] leading-tight text-ink">{recipe.title_id}</h1>
        <p className="mt-1 text-ink-muted">
          {[formatMinutes(recipe.total_minutes), recipe.servings ? `${recipe.servings} porsi` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {recipe.verdict === "no" && (
          <p className="mt-4 rounded-xl border border-clay/30 bg-clay-soft px-4 py-3 text-[0.95rem] leading-relaxed text-clay-deep">
            Kamu sudah pernah masak resep ini dan tidak suka.
          </p>
        )}

        {(meal?.notes_today || recipe.standing_notes) && (
          <div className="mt-4 space-y-2">
            {meal?.notes_today && (
              <p className="rounded-xl bg-clay-soft px-4 py-3 leading-relaxed text-clay-deep">
                {meal.notes_today}
              </p>
            )}
            {recipe.standing_notes && (
              <p className="rounded-xl bg-paper-sunk px-4 py-3 leading-relaxed text-ink-muted">
                {recipe.standing_notes}
              </p>
            )}
          </div>
        )}

        <section className="mt-7">
          <h2 className="font-display text-[1.35rem] text-ink">Bahan</h2>
          <p className="mb-3 mt-1 text-[0.85rem] text-ink-muted">Ketuk + untuk catatanmu</p>
          <ul className="space-y-1.5">
            {(recipe.ingredients ?? []).map((ing, i) => (
              <li
                key={i}
                className="flex flex-wrap items-start gap-x-3 gap-y-0 rounded-xl bg-paper-surface px-4 py-3"
              >
                <span className="min-w-[4.5rem] shrink-0 pt-0.5 font-medium text-clay">
                  {[ing.qty, ing.unit].filter(Boolean).join(" ") || "—"}
                </span>
                <span className="min-w-0 flex-1 pt-0.5 text-ink">
                  {ing.item_id}
                  {ing.note && <span className="text-ink-muted"> ({ing.note})</span>}
                </span>
                <CookLineNote
                  note={ing.cook_note}
                  onSave={(note) => saveNote("ingredient", i, note)}
                />
              </li>
            ))}
            {!recipe.ingredients?.length && (
              <li className="text-ink-muted">Bahan belum dicatat.</li>
            )}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="font-display text-[1.35rem] text-ink">Cara masak</h2>
          <p className="mb-3 mt-1 text-[0.85rem] text-ink-muted">Ketuk + untuk catatanmu</p>
          <ol className="space-y-2.5">
            {steps.map((step, i) => {
              const done = doneSteps.has(i);
              return (
                <li key={i}>
                  <div
                    className={`flex flex-wrap items-start gap-1 rounded-2xl bg-paper-surface p-3 transition ${
                      done ? "opacity-50" : ""
                    }`}
                  >
                    <button
                      onClick={() => toggleStep(i)}
                      className="flex min-w-0 flex-1 items-start gap-4 p-1 text-left"
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.95rem] font-medium transition ${
                          done ? "bg-leaf text-paper-surface" : "bg-paper-sunk text-ink-muted"
                        }`}
                      >
                        {done ? <Icon name="check" size={18} /> : i + 1}
                      </span>
                      <span className={`cook-step pt-1 text-ink ${done ? "line-through" : ""}`}>
                        {step.id}
                      </span>
                    </button>
                    <CookLineNote
                      note={step.cook_note}
                      onSave={(note) => saveNote("step", i, note)}
                    />
                  </div>
                </li>
              );
            })}
            {!steps.length && <li className="text-ink-muted">Langkah belum dicatat.</li>}
          </ol>
        </section>

        {recipe.source_url && (
          <a
            href={recipe.source_url}
            target="_blank"
            rel="noreferrer"
            className="mt-8 inline-flex items-center gap-1.5 text-sm text-ink-muted underline underline-offset-4"
          >
            <Icon name="link" size={15} /> Sumber asli
          </a>
        )}
      </div>
    </div>
  );
}
