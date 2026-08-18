import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useHousehold } from "@/context/HouseholdContext";
import { fetchRecipes } from "@/lib/queries";
import { formatMinutes } from "@/lib/dates";
import { mediaUrl } from "@/lib/media";
import type { Recipe } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import AddRecipeSheet from "@/components/AddRecipeSheet";
import { Spinner } from "@/App";

/**
 * Nia's full recipe book: every recipe in the household, Indonesian, read-only.
 * Tap one to open the same big-type cook view she uses from Hari ini.
 */
export default function CookLibraryPage() {
  const { household, loading } = useHousehold();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(true);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!household) return;
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const data = await fetchRecipes(household.id);
        if (!cancelled) setRecipes(data);
      } catch (err) {
        console.warn("cook library load failed", err);
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [household]);

  const matchesSearch = (r: Recipe, q: string) =>
    !q ||
    r.title_id.toLowerCase().includes(q) ||
    (r.title_en ?? "").toLowerCase().includes(q) ||
    r.tags.some((t) => t.toLowerCase().includes(q));

  const { keep, rejected } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const keep: Recipe[] = [];
    const rejected: Recipe[] = [];
    for (const r of recipes) {
      if (!matchesSearch(r, q)) continue;
      if (r.verdict === "no") rejected.push(r);
      else keep.push(r);
    }
    return { keep, rejected };
  }, [recipes, search]);

  if (loading || !household) return <Spinner label="sebentar…" />;

  return (
    <div className="px-4 pb-8 pt-5">
      <header className="mb-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-[1.9rem] leading-none text-ink">Resep</h1>
            <p className="mt-1 text-ink-muted">
              {recipes.length ? `${recipes.length} resep` : "Belum ada resep"}
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-clay px-3.5 py-2 text-sm text-paper-surface"
          >
            <Icon name="plus" size={16} />
            Tambah
          </button>
        </div>
      </header>

      <div className="mb-4 flex items-center gap-2 rounded-2xl border border-paper-border bg-paper-surface px-3">
        <Icon name="search" size={20} className="text-ink-faint" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari resep…"
          className="w-full bg-transparent py-3 text-[1.05rem] outline-none"
        />
      </div>

      {busy && !recipes.length ? (
        <Spinner label="memuat resep…" />
      ) : keep.length || rejected.length ? (
        <div className="space-y-6">
          {keep.length ? (
            <div className="space-y-3">
              {keep.map((recipe) => (
                <RecipeRow key={recipe.id} recipe={recipe} />
              ))}
            </div>
          ) : (
            <div className="rounded-card border border-dashed border-paper-line px-4 py-10 text-center">
              <p className="text-ink-muted">Tidak ada resep yang cocok.</p>
            </div>
          )}

          {rejected.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-[1.2rem] text-clay-deep">Jangan masak lagi</h2>
              <p className="mb-3 text-[0.9rem] text-ink-muted">
                Resep yang sudah pernah dicoba dan tidak disukai.
              </p>
              <div className="space-y-3">
                {rejected.map((recipe) => (
                  <RecipeRow key={recipe.id} recipe={recipe} rejected />
                ))}
              </div>
            </section>
          )}
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-paper-line px-4 py-16 text-center">
          <Icon name="book" size={26} className="mx-auto text-ink-faint" />
          <p className="mt-3 text-ink-muted">
            {recipes.length ? "Tidak ada yang cocok." : "Belum ada resep di koleksi."}
          </p>
        </div>
      )}

      {household && (
        <AddRecipeSheet
          open={adding}
          onClose={() => setAdding(false)}
          householdId={household.id}
          forCook
          onSaved={(recipe) => setRecipes((prev) => [recipe, ...prev])}
        />
      )}
    </div>
  );
}

function RecipeRow({ recipe, rejected }: { recipe: Recipe; rejected?: boolean }) {
  const hero = mediaUrl(recipe.hero_image_url);
  return (
    <Link
      to={`/masak/koleksi/${recipe.id}`}
      className={`flex gap-3 rounded-card border bg-paper-surface p-3 shadow-card active:bg-paper-sunk ${
        rejected ? "border-clay/30 opacity-80" : "border-paper-border"
      }`}
    >
      {hero ? (
        <img
          src={hero}
          alt=""
          className={`h-24 w-24 shrink-0 rounded-xl object-cover ${rejected ? "grayscale-[40%]" : ""}`}
        />
      ) : (
        <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-paper-sunk text-ink-faint">
          <Icon name="pot" size={28} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <h2 className="font-display text-[1.35rem] leading-snug text-ink">{recipe.title_id}</h2>
        <p className="mt-1 text-[0.95rem] text-ink-muted">
          {[
            formatMinutes(recipe.total_minutes),
            recipe.ingredients?.length ? `${recipe.ingredients.length} bahan` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "—"}
        </p>
      </div>
      <Icon name="chevron-right" className="shrink-0 self-center text-ink-faint" />
    </Link>
  );
}
