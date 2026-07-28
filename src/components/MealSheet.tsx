import { useEffect, useMemo, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import Icon from "@/components/ui/Icon";
import AddRecipeSheet from "@/components/AddRecipeSheet";
import CookPreview from "@/components/CookPreview";
import { attachRecipe, deleteMeal, detachRecipe, fetchMeal, fetchRecipes, updateMeal } from "@/lib/queries";
import { formatMinutes, longDate } from "@/lib/dates";
import { SLOT_LABEL } from "@/lib/types";
import type { Meal, Recipe } from "@/lib/types";

interface Props {
  meal: Meal;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export default function MealSheet({ meal: initialMeal, open, onClose, onChanged }: Props) {
  const [meal, setMeal] = useState<Meal>(initialMeal);
  const [notes, setNotes] = useState(initialMeal.notes_today ?? "");
  const [title, setTitle] = useState(initialMeal.title ?? "");
  const [picking, setPicking] = useState(false);
  const [addingNew, setAddingNew] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [library, setLibrary] = useState<Recipe[]>([]);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setMeal(initialMeal);
    setNotes(initialMeal.notes_today ?? "");
    setTitle(initialMeal.title ?? "");
  }, [initialMeal]);

  async function reload() {
    const fresh = await fetchMeal(meal.id);
    if (fresh) setMeal(fresh);
    onChanged();
  }

  async function openPicker() {
    setPicking(true);
    if (!library.length) {
      try {
        setLibrary(await fetchRecipes(meal.household_id));
      } catch (err) {
        console.warn("library load failed", err);
      }
    }
  }

  async function addExisting(recipe: Recipe) {
    await attachRecipe(meal.id, recipe.id, meal.recipes.length);
    setPicking(false);
    setSearch("");
    await reload();
  }

  async function removeRecipe(linkId: string) {
    await detachRecipe(linkId);
    await reload();
  }

  async function saveAndClose() {
    setSaving(true);
    try {
      await updateMeal(meal.id, {
        notes_today: notes.trim() || null,
        title: title.trim() || null,
      });
      onChanged();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    await deleteMeal(meal.id);
    onChanged();
    onClose();
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const taken = new Set(meal.recipes.map((r) => r.recipe_id));
    return library
      .filter((r) => !taken.has(r.id))
      .filter((r) => !q || r.title_id.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q)));
  }, [library, search, meal.recipes]);

  if (previewing) {
    return (
      <Sheet
        open={open}
        onClose={() => setPreviewing(false)}
        title="Tampilan yang memasak"
        subtitle="Persis seperti ini yang dia lihat."
      >
        <CookPreview meal={{ ...meal, notes_today: notes.trim() || null, title: title.trim() || null }} />
      </Sheet>
    );
  }

  return (
    <>
      <Sheet
        open={open && !addingNew}
        onClose={saveAndClose}
        title={SLOT_LABEL[meal.slot]}
        subtitle={longDate(meal.date)}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setPreviewing(true)}>
              <Icon name="eye" size={18} />
              Pratinjau
            </Button>
            <Button full onClick={saveAndClose} disabled={saving}>
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="mb-1.5 block text-[0.78rem] font-medium uppercase tracking-wide text-ink-muted">
              Nama menu <span className="normal-case tracking-normal">(opsional)</span>
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={meal.recipes.map((r) => r.recipe.title_id).join(" + ") || "Mie ayam + sambal"}
              className="w-full rounded-xl border border-paper-border bg-paper-surface px-3 py-2.5 font-display text-lg outline-none focus:border-clay"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[0.78rem] font-medium uppercase tracking-wide text-ink-muted">
                Resep
              </span>
              <span className="text-[0.78rem] text-ink-faint">
                {meal.recipes.length ? `${meal.recipes.length} resep` : "belum ada"}
              </span>
            </div>

            <div className="space-y-2">
              {meal.recipes.map((mr) => (
                <div
                  key={mr.id}
                  className="flex items-start gap-3 rounded-2xl border border-paper-border bg-paper-surface p-3"
                >
                  {mr.recipe.hero_image_url ? (
                    <img
                      src={mr.recipe.hero_image_url}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-paper-sunk text-ink-faint">
                      <Icon name="pot" size={20} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[1.05rem] leading-snug text-ink">
                      {mr.recipe.title_id}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-muted">
                      {formatMinutes(mr.recipe.total_minutes) ?? "waktu belum diisi"}
                      {mr.recipe.ingredients?.length
                        ? ` · ${mr.recipe.ingredients.length} bahan`
                        : ""}
                    </p>
                    {mr.recipe.standing_notes && (
                      <p className="mt-2 rounded-lg bg-paper-sunk px-2.5 py-1.5 text-[0.85rem] text-ink-muted">
                        <span className="font-medium text-ink">Catatan tetap:</span>{" "}
                        {mr.recipe.standing_notes}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => removeRecipe(mr.id)}
                    aria-label="Keluarkan resep"
                    className="shrink-0 rounded-full p-2 text-ink-faint hover:bg-paper-sunk hover:text-clay-deep"
                  >
                    <Icon name="x" size={18} />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={openPicker}
              className="mt-2 inline-flex items-center gap-1.5 text-sm text-clay"
            >
              <Icon name="plus" size={16} /> Tambah resep
            </button>
          </div>

          <div>
            <label className="mb-1.5 block text-[0.78rem] font-medium uppercase tracking-wide text-ink-muted">
              Catatan hari ini
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Ada tamu, buat 6 porsi"
              className="w-full rounded-xl border border-paper-border bg-paper-surface px-3 py-2.5 outline-none focus:border-clay"
            />
            <p className="mt-1.5 text-[0.8rem] text-ink-muted">
              Hanya untuk hari ini. Untuk yang selalu berlaku, tulis di catatan tetap resep.
            </p>
          </div>

          <button
            onClick={remove}
            className="inline-flex items-center gap-1.5 text-sm text-clay-deep"
          >
            <Icon name="trash" size={16} /> Hapus menu ini
          </button>
        </div>
      </Sheet>

      {/* Recipe picker */}
      <Sheet open={picking} onClose={() => setPicking(false)} title="Pilih resep">
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-xl border border-paper-border bg-paper-surface px-3">
            <Icon name="search" size={18} className="text-ink-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari di koleksi…"
              className="w-full bg-transparent py-2.5 outline-none"
            />
          </div>

          <Button
            variant="secondary"
            full
            onClick={() => {
              setPicking(false);
              setAddingNew(true);
            }}
          >
            <Icon name="plus" size={18} /> Resep baru
          </Button>

          <div className="space-y-1.5 pt-1">
            {filtered.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => addExisting(recipe)}
                className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-paper-sunk"
              >
                {recipe.hero_image_url ? (
                  <img src={recipe.hero_image_url} alt="" className="h-11 w-11 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-paper-sunk text-ink-faint">
                    <Icon name="pot" size={17} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="truncate text-ink">{recipe.title_id}</p>
                  <p className="text-sm text-ink-muted">
                    {formatMinutes(recipe.total_minutes) ?? "—"}
                    {recipe.verdict === "keeper" ? " · disimpan" : ""}
                  </p>
                </div>
              </button>
            ))}
            {!filtered.length && (
              <p className="py-6 text-center text-sm text-ink-muted">
                {library.length ? "Tidak ada yang cocok." : "Koleksi masih kosong."}
              </p>
            )}
          </div>
        </div>
      </Sheet>

      <AddRecipeSheet
        open={addingNew}
        onClose={() => setAddingNew(false)}
        householdId={meal.household_id}
        onSaved={async (recipe) => {
          setAddingNew(false);
          setLibrary((prev) => [recipe, ...prev]);
          await attachRecipe(meal.id, recipe.id, meal.recipes.length);
          await reload();
        }}
      />
    </>
  );
}
