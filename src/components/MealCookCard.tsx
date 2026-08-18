import { Link } from "react-router-dom";
import Icon from "@/components/ui/Icon";
import { formatMinutes } from "@/lib/dates";
import { mediaUrl } from "@/lib/media";
import { SLOT_LABEL } from "@/lib/types";
import type { Meal } from "@/lib/types";

interface Props {
  meal: Meal;
  /** Preview mode renders the same card without any working controls. */
  preview?: boolean;
  onToggleCooked?: (cooked: boolean) => void;
}

/**
 * The meal exactly as the cook sees it. Shared by the cook's Hari ini screen and
 * the planner's preview, so "what she'll see" can never drift from what she sees.
 */
export default function MealCookCard({ meal, preview, onToggleCooked }: Props) {
  const cooked = meal.status === "cooked";
  const totalMinutes = meal.recipes.reduce((sum, mr) => sum + (mr.recipe.total_minutes ?? 0), 0);
  const heading = meal.title || meal.recipes.map((mr) => mr.recipe.title_id).join(" + ") || "Belum diisi";

  return (
    <article
      className={`overflow-hidden rounded-card border bg-paper-surface shadow-card transition ${
        cooked ? "border-leaf-soft opacity-75" : "border-paper-border"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3 px-4 pt-4">
        <span className="text-[0.8rem] font-medium uppercase tracking-wide text-clay">
          {SLOT_LABEL[meal.slot]}
        </span>
        {totalMinutes > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[0.85rem] text-ink-muted">
            <Icon name="clock" size={15} />
            {formatMinutes(totalMinutes)}
          </span>
        )}
      </div>

      <h3 className="px-4 pt-1 font-display text-[1.5rem] leading-tight text-ink">{heading}</h3>

      {meal.notes_today && (
        <p className="mx-4 mt-3 rounded-xl bg-clay-soft px-3.5 py-2.5 text-[0.95rem] leading-relaxed text-clay-deep">
          {meal.notes_today}
        </p>
      )}

      <div className="mt-3 space-y-2 px-4">
        {meal.recipes.map((mr) => {
          const body = (
            <>
              {mediaUrl(mr.recipe.hero_image_url) ? (
                <img
                  src={mediaUrl(mr.recipe.hero_image_url)!}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-xl object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-paper-sunk text-ink-faint">
                  <Icon name="pot" size={22} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug text-ink">{mr.recipe.title_id}</p>
                <p className="mt-0.5 text-[0.88rem] text-ink-muted">
                  {[formatMinutes(mr.recipe.total_minutes), `${mr.recipe.ingredients?.length ?? 0} bahan`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {mr.recipe.verdict === "no" && (
                  <p className="mt-1.5 text-[0.88rem] leading-snug text-clay-deep">
                    Sudah pernah dicoba — tidak suka
                  </p>
                )}
                {mr.recipe.standing_notes && (
                  <p className="mt-1.5 text-[0.88rem] leading-snug text-ink-muted">
                    {mr.recipe.standing_notes}
                  </p>
                )}
              </div>
              {!preview && <Icon name="chevron-right" className="shrink-0 text-ink-faint" />}
            </>
          );

          return preview ? (
            <div key={mr.id} className="flex items-center gap-3 rounded-2xl bg-paper-bg p-3">
              {body}
            </div>
          ) : (
            <Link
              key={mr.id}
              to={`/masak/resep/${meal.id}/${mr.recipe_id}`}
              className="flex items-center gap-3 rounded-2xl bg-paper-bg p-3 transition active:bg-paper-sunk"
            >
              {body}
            </Link>
          );
        })}

        {!meal.recipes.length && (
          <p className="rounded-2xl bg-paper-bg p-3 text-[0.9rem] text-ink-muted">
            Belum ada resep untuk menu ini.
          </p>
        )}
      </div>

      <div className="p-4 pt-3">
        <button
          disabled={preview}
          onClick={() => onToggleCooked?.(!cooked)}
          className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-[0.95rem] font-medium transition ${
            cooked
              ? "bg-leaf-soft text-leaf"
              : "bg-clay text-paper-surface active:bg-clay-deep"
          } ${preview ? "cursor-default" : ""}`}
        >
          <Icon name="check" size={19} />
          {cooked ? "Sudah dimasak" : "Selesai dimasak"}
        </button>
      </div>
    </article>
  );
}
