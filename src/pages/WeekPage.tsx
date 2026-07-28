import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { createMeal, fetchMeals, fetchUnratedMeals, submitVerdict } from "@/lib/queries";
import {
  addDays,
  dayNumber,
  dayShort,
  longDate,
  relativeDay,
  shortDate,
  todayISO,
  weekDays,
  weekStart,
} from "@/lib/dates";
import { SLOT_LABEL, SLOT_ORDER, SLOT_SHORT } from "@/lib/types";
import type { Meal, Slot } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import MealSheet from "@/components/MealSheet";
import { Spinner } from "@/App";

export default function WeekPage() {
  const { household, loading } = useHousehold();
  const [start, setStart] = useState(() => weekStart(todayISO()));
  const [meals, setMeals] = useState<Meal[]>([]);
  const [unrated, setUnrated] = useState<Meal[]>([]);
  const [busy, setBusy] = useState(true);
  const [openMeal, setOpenMeal] = useState<Meal | null>(null);
  const [slotPicker, setSlotPicker] = useState<string | null>(null);

  const days = weekDays(start);
  const today = todayISO();

  const load = useCallback(async () => {
    if (!household) return;
    setBusy(true);
    try {
      const [weekMeals, pending] = await Promise.all([
        fetchMeals(household.id, days[0], days[6]),
        fetchUnratedMeals(household.id, addDays(today, -7)),
      ]);
      setMeals(weekMeals);
      setUnrated(pending);
    } catch (err) {
      console.warn("week load failed", err);
    } finally {
      setBusy(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [household, start]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the open sheet in sync with reloaded data.
  useEffect(() => {
    if (!openMeal) return;
    const fresh = meals.find((m) => m.id === openMeal.id);
    if (fresh && fresh !== openMeal) setOpenMeal(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meals]);

  async function addMeal(date: string, slot: Slot) {
    if (!household) return;
    const meal = await createMeal(household.id, date, slot);
    setSlotPicker(null);
    await load();
    setOpenMeal(meal);
  }

  async function rate(meal: Meal, verdict: "keep" | "no") {
    await submitVerdict(meal, verdict);
    setUnrated((prev) => prev.filter((m) => m.id !== meal.id));
  }

  if (loading || !household) return <Spinner />;

  const slots = (household.slots?.length ? household.slots : SLOT_ORDER).filter((s) =>
    SLOT_ORDER.includes(s)
  );
  const pending = unrated[0];

  return (
    <div className="px-4 pb-8 pt-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[1.9rem] leading-none text-ink">Minggu ini</h1>
          <p className="mt-1 text-sm text-ink-muted">
            {shortDate(days[0])} – {shortDate(days[6])}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStart(addDays(start, -7))}
            aria-label="Minggu sebelumnya"
            className="rounded-full p-2.5 text-ink-muted hover:bg-paper-sunk"
          >
            <Icon name="chevron-left" />
          </button>
          <button
            onClick={() => setStart(weekStart(today))}
            className="rounded-full px-3 py-2 text-sm text-ink-muted hover:bg-paper-sunk"
          >
            Kini
          </button>
          <button
            onClick={() => setStart(addDays(start, 7))}
            aria-label="Minggu berikutnya"
            className="rounded-full p-2.5 text-ink-muted hover:bg-paper-sunk"
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      </header>

      {pending && (
        <section className="mb-4 rounded-card border border-paper-border bg-paper-surface p-4 shadow-card">
          <p className="text-sm text-ink-muted">
            {relativeDay(pending.date) ?? longDate(pending.date)} ·{" "}
            {SLOT_LABEL[pending.slot].toLowerCase()}
          </p>
          <p className="mt-1 font-display text-[1.25rem] leading-tight text-ink">
            {pending.title || pending.recipes.map((r) => r.recipe.title_id).join(" + ")}
          </p>
          <p className="mt-1 text-sm text-ink-muted">Disimpan ke koleksi?</p>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => rate(pending, "keep")} className="flex-1">
              <Icon name="check" size={18} /> Simpan
            </Button>
            <Button variant="secondary" onClick={() => rate(pending, "no")} className="flex-1">
              Tidak
            </Button>
          </div>
        </section>
      )}

      {busy && !meals.length ? (
        <Spinner label="memuat minggu…" />
      ) : (
        <div className="space-y-3">
          {days.map((date) => {
            const dayMeals = meals.filter((m) => m.date === date);
            const isToday = date === today;

            return (
              <section
                key={date}
                className={`rounded-card border bg-paper-surface p-4 shadow-card ${
                  isToday ? "border-clay/40" : "border-paper-border"
                }`}
              >
                <div className="mb-2.5 flex items-baseline gap-2">
                  <h2
                    className={`font-display text-[1.15rem] leading-none ${
                      isToday ? "text-clay" : "text-ink"
                    }`}
                  >
                    {dayShort(date)}
                  </h2>
                  <span className="text-sm text-ink-faint">{dayNumber(date)}</span>
                  {isToday && (
                    <span className="ml-auto text-[0.75rem] uppercase tracking-wide text-clay">
                      hari ini
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  {dayMeals.map((meal) => (
                    <button
                      key={meal.id}
                      onClick={() => setOpenMeal(meal)}
                      className="flex w-full items-center gap-3 rounded-xl bg-paper-bg px-3 py-2.5 text-left transition hover:bg-paper-sunk"
                    >
                      <span className="w-[3.6rem] shrink-0 text-[0.78rem] uppercase tracking-wide text-ink-faint">
                        {SLOT_SHORT[meal.slot]}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink">
                        {meal.title ||
                          meal.recipes.map((r) => r.recipe.title_id).join(" + ") ||
                          "Belum diisi"}
                      </span>
                      {meal.status === "cooked" && (
                        <Icon name="check" size={16} className="shrink-0 text-leaf" />
                      )}
                    </button>
                  ))}

                  <button
                    onClick={() => setSlotPicker(date)}
                    className="inline-flex items-center gap-1.5 px-1 py-1.5 text-sm text-ink-muted hover:text-clay"
                  >
                    <Icon name="plus" size={16} /> Tambah
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <Sheet
        open={!!slotPicker}
        onClose={() => setSlotPicker(null)}
        title="Mau masak apa"
        subtitle={slotPicker ? longDate(slotPicker) : undefined}
      >
        <div className="space-y-2">
          {slots.map((slot) => (
            <button
              key={slot}
              onClick={() => slotPicker && addMeal(slotPicker, slot)}
              className="flex w-full items-center justify-between rounded-xl border border-paper-border bg-paper-surface px-4 py-3.5 text-left transition hover:border-clay"
            >
              <span className="text-ink">{SLOT_LABEL[slot]}</span>
              <Icon name="chevron-right" className="text-ink-faint" />
            </button>
          ))}
        </div>
      </Sheet>

      {openMeal && (
        <MealSheet
          meal={openMeal}
          open={!!openMeal}
          onClose={() => setOpenMeal(null)}
          onChanged={load}
        />
      )}
    </div>
  );
}
