import { useState } from "react";
import Icon from "@/components/ui/Icon";
import type { RecipeDraft } from "@/lib/recipeDraft";
import { mediaUrl } from "@/lib/media";

interface Props {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
  forCook?: boolean;
}

const FIELD =
  "w-full rounded-xl border border-paper-border bg-paper-surface px-3 py-2.5 outline-none focus:border-clay";
const LABEL = "mb-1.5 block text-[0.78rem] font-medium uppercase tracking-wide text-ink-muted";

export default function RecipeReviewForm({ draft, onChange, forCook }: Props) {
  const [tagInput, setTagInput] = useState("");

  const set = (patch: Partial<RecipeDraft>) => onChange({ ...draft, ...patch });

  function setIngredient(index: number, patch: Partial<RecipeDraft["ingredients"][number]>) {
    const next = draft.ingredients.map((row, i) => (i === index ? { ...row, ...patch } : row));
    set({ ingredients: next });
  }

  function addIngredient() {
    set({ ingredients: [...draft.ingredients, { amount: "", name: "", name_id: "" }] });
  }

  function removeIngredient(index: number) {
    set({ ingredients: draft.ingredients.filter((_, i) => i !== index) });
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !draft.tags.includes(tag)) set({ tags: [...draft.tags, tag] });
    setTagInput("");
  }

  const titleValue = forCook ? draft.title_id : draft.title_en;
  const titlePlaceholder = forCook ? draft.title_en || "Mie ayam" : draft.title_id || "Chicken noodle soup";
  const stepsValue = forCook ? draft.stepsTextId || draft.stepsText : draft.stepsText;

  return (
    <div className="space-y-5">
      {mediaUrl(draft.hero_image_url) && (
        <img
          src={mediaUrl(draft.hero_image_url)!}
          alt=""
          className="h-40 w-full rounded-2xl object-cover"
          onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
        />
      )}

      <div>
        <label className={LABEL}>{forCook ? "Judul" : "Title"}</label>
        <input
          value={titleValue}
          onChange={(e) =>
            forCook
              ? set({ title_id: e.target.value })
              : set({ title_en: e.target.value })
          }
          className={`${FIELD} font-display text-lg`}
          placeholder={titlePlaceholder}
        />
      </div>

      {!forCook && (
        <div>
          <label className={LABEL}>Indonesian title (cook)</label>
          <input
            value={draft.title_id}
            onChange={(e) => set({ title_id: e.target.value })}
            className={FIELD}
            placeholder="Mie ayam"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={LABEL}>{forCook ? "Waktu (menit)" : "Time (min)"}</label>
          <input
            inputMode="numeric"
            value={draft.total_minutes}
            onChange={(e) => set({ total_minutes: e.target.value.replace(/\D/g, "") })}
            className={FIELD}
            placeholder="45"
          />
        </div>
        <div>
          <label className={LABEL}>{forCook ? "Porsi" : "Servings"}</label>
          <input
            inputMode="numeric"
            value={draft.servings}
            onChange={(e) => set({ servings: e.target.value.replace(/\D/g, "") })}
            className={FIELD}
            placeholder="4"
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>{forCook ? "Bahan" : "Ingredients"}</label>
        <div className="space-y-2">
          {draft.ingredients.map((row, i) => (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <input
                  value={row.amount}
                  onChange={(e) => setIngredient(i, { amount: e.target.value })}
                  className={`${FIELD} w-24 shrink-0 text-center`}
                  placeholder={forCook ? "2 sdm" : "2 tbsp"}
                />
                <input
                  value={forCook ? row.name_id || row.name : row.name}
                  onChange={(e) =>
                    setIngredient(
                      i,
                      forCook
                        ? { name_id: e.target.value, name: e.target.value }
                        : { name: e.target.value }
                    )
                  }
                  className={FIELD}
                  placeholder={forCook ? "kecap manis" : "sweet soy sauce"}
                />
                <button
                  type="button"
                  onClick={() => removeIngredient(i)}
                  aria-label={forCook ? "Hapus bahan" : "Remove ingredient"}
                  className="shrink-0 rounded-full p-2 text-ink-faint hover:bg-paper-sunk hover:text-clay-deep"
                >
                  <Icon name="x" size={18} />
                </button>
              </div>
              {row.cook_note && (
                <p className="px-1 text-[0.8rem] text-clay-deep">Nia: {row.cook_note}</p>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addIngredient}
          className="mt-2 inline-flex items-center gap-1.5 text-sm text-clay"
        >
          <Icon name="plus" size={16} /> {forCook ? "Tambah bahan" : "Add ingredient"}
        </button>
      </div>

      <div>
        <label className={LABEL}>{forCook ? "Cara masak — satu langkah per baris" : "Steps — one per line"}</label>
        <textarea
          value={stepsValue}
          onChange={(e) =>
            forCook
              ? set({ stepsTextId: e.target.value, stepsText: e.target.value })
              : set({ stepsText: e.target.value })
          }
          rows={7}
          className={`${FIELD} leading-relaxed`}
          placeholder={
            forCook
              ? "Rebus mie sampai matang.\nTumis bawang putih…"
              : "Boil the noodles until cooked.\nSauté the garlic…"
          }
        />
        {!forCook && (
          <p className="mt-1.5 text-[0.8rem] text-ink-muted">
            The cook still sees the Indonesian version from import.
          </p>
        )}
        {draft.stepCookNotes.some((n) => n.trim()) && (
          <ul className="mt-2 space-y-1">
            {draft.stepCookNotes.map((n, i) =>
              n.trim() ? (
                <li key={i} className="text-[0.8rem] text-clay-deep">
                  Nia, step {i + 1}: {n}
                </li>
              ) : null
            )}
          </ul>
        )}
      </div>

      <div>
        <label className={LABEL}>{forCook ? "Catatan tetap" : "Standing notes"}</label>
        <textarea
          value={draft.standing_notes}
          onChange={(e) => set({ standing_notes: e.target.value })}
          rows={2}
          className={FIELD}
          placeholder={forCook ? "Jangan terlalu pedas" : "Always half the chili"}
        />
        <p className="mt-1.5 text-[0.8rem] text-ink-muted">
          {forCook
            ? "Muncul setiap kali resep ini dimasak."
            : "Shown every time this recipe is cooked."}
        </p>
      </div>

      <div>
        <label className={LABEL}>{forCook ? "Tag" : "Tags"}</label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {draft.tags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => set({ tags: draft.tags.filter((t) => t !== tag) })}
              className="inline-flex items-center gap-1 rounded-full bg-clay-soft px-3 py-1 text-sm text-clay-deep"
            >
              {tag}
              <Icon name="x" size={13} />
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTag();
              }
            }}
            className={FIELD}
            placeholder={forCook ? "ayam, mie, cepat…" : "chicken, noodles, quick…"}
          />
          <button
            type="button"
            onClick={addTag}
            className="shrink-0 rounded-xl bg-paper-sunk px-4 text-sm text-ink"
          >
            {forCook ? "Tambah" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
