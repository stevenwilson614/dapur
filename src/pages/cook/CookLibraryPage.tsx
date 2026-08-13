import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useHousehold } from "@/context/HouseholdContext";
import { fetchRecipes } from "@/lib/queries";
import { formatMinutes } from "@/lib/dates";
import { mediaUrl } from "@/lib/media";
import type { Recipe } from "@/lib/types";
import Icon from "@/components/ui/Icon";
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter(
      (r) =>
        r.title_id.toLowerCase().includes(q) ||
        (r.title_en ?? "").toLowerCase().includes(q) ||
        r.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [recipes, search]);

  if (loading || !household) return <Spinner label="sebentar…" />;

  return (
    <div className="px-4 pb-8 pt-5">
      <header className="mb-4">
        <h1 className="font-display text-[1.9rem] leading-none text-ink">Resep</h1>
        <p className="mt-1 text-ink-muted">
          {recipes.length ? `${recipes.length} resep` : "Belum ada resep"}
        </p>
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
      ) : filtered.length ? (
        <div className="space-y-3">
          {filtered.map((recipe) => {
            const hero = mediaUrl(recipe.hero_image_url);
            return (
              <Link
                key={recipe.id}
                to={`/masak/koleksi/${recipe.id}`}
                className="flex gap-3 rounded-card border border-paper-border bg-paper-surface p-3 shadow-card active:bg-paper-sunk"
              >
                {hero ? (
                  <img src={hero} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
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
          })}
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-paper-line px-4 py-16 text-center">
          <Icon name="book" size={26} className="mx-auto text-ink-faint" />
          <p className="mt-3 text-ink-muted">
            {recipes.length ? "Tidak ada yang cocok." : "Belum ada resep di koleksi."}
          </p>
        </div>
      )}
    </div>
  );
}
