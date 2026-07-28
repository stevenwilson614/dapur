import { useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { fetchMeals, markCooked } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { addDays, longDate, relativeDay, todayISO } from "@/lib/dates";
import { SLOT_ORDER } from "@/lib/types";
import type { Meal } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import MealCookCard from "@/components/MealCookCard";
import { Spinner } from "@/App";

const CACHE_KEY = "dapur_today_cache";

export default function TodayPage() {
  const { household, loading } = useHousehold();
  const [date, setDate] = useState(todayISO());
  const [meals, setMeals] = useState<Meal[]>([]);
  const [busy, setBusy] = useState(true);
  const [offline, setOffline] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    setBusy(true);
    try {
      const data = await fetchMeals(household.id, date, date);
      setMeals(data);
      setOffline(false);
      if (date === todayISO()) {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ date, meals: data }));
      }
      const ids = data.map((m) => m.id);
      if (ids.length && household.show_read_receipt) {
        supabase.rpc("kitchen_touch_seen", { p_meal_ids: ids }).then(undefined, () => {});
      }
    } catch (err) {
      console.warn("today load failed", err);
      // A weak kitchen signal should never mean a blank screen.
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as { date: string; meals: Meal[] };
        if (parsed.date === date) {
          setMeals(parsed.meals);
          setOffline(true);
        }
      }
    } finally {
      setBusy(false);
    }
  }, [household, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(meal: Meal, cooked: boolean) {
    setMeals((prev) =>
      prev.map((m) => (m.id === meal.id ? { ...m, status: cooked ? "cooked" : "planned" } : m))
    );
    try {
      await markCooked(meal.id, cooked);
    } catch (err) {
      console.warn("mark cooked failed", err);
      load();
    }
  }

  if (loading || !household) return <Spinner />;

  const slotRank = (m: Meal) => SLOT_ORDER.indexOf(m.slot);
  const sorted = [...meals].sort((a, b) => slotRank(a) - slotRank(b) || a.position - b.position);

  return (
    <div className="px-4 pb-8 pt-5">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[1.9rem] leading-none text-ink">
            {relativeDay(date) ?? longDate(date)}
          </h1>
          {relativeDay(date) && <p className="mt-1 text-ink-muted">{longDate(date)}</p>}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDate(addDays(date, -1))}
            aria-label="Hari sebelumnya"
            className="rounded-full p-3 text-ink-muted active:bg-paper-sunk"
          >
            <Icon name="chevron-left" />
          </button>
          <button
            onClick={() => setDate(addDays(date, 1))}
            aria-label="Hari berikutnya"
            className="rounded-full p-3 text-ink-muted active:bg-paper-sunk"
          >
            <Icon name="chevron-right" />
          </button>
        </div>
      </header>

      {offline && (
        <p className="mb-3 rounded-xl bg-paper-sunk px-3 py-2 text-[0.88rem] text-ink-muted">
          Sinyal lemah — ini rencana terakhir yang tersimpan.
        </p>
      )}

      {busy && !meals.length ? (
        <Spinner label="memuat…" />
      ) : sorted.length ? (
        <div className="space-y-3">
          {sorted.map((meal) => (
            <MealCookCard key={meal.id} meal={meal} onToggleCooked={(c) => toggle(meal, c)} />
          ))}
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-paper-line px-4 py-16 text-center">
          <Icon name="pot" size={26} className="mx-auto text-ink-faint" />
          <p className="mt-3 text-ink-muted">Belum ada rencana untuk hari ini.</p>
        </div>
      )}
    </div>
  );
}
