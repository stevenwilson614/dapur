import { FormEvent, useCallback, useEffect, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import {
  addExtra,
  fetchMeals,
  fetchShoppingState,
  removeExtra,
  setChecked,
  setExtraChecked,
} from "@/lib/queries";
import { addDays, todayISO, weekStart } from "@/lib/dates";
import { buildShoppingList, formatAmounts, ShoppingLine } from "@/lib/shopping";
import type { Meal } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import { Spinner } from "@/App";

type Scope = "today" | "week";

interface Extra {
  id: string;
  label: string;
  checked: boolean;
}

export default function ShoppingPage() {
  const { household, loading } = useHousehold();
  const [scope, setScope] = useState<Scope>("today");
  const [meals, setMeals] = useState<Meal[]>([]);
  const [checked, setCheckedSet] = useState<Set<string>>(new Set());
  const [extras, setExtras] = useState<Extra[]>([]);
  const [newItem, setNewItem] = useState("");
  const [busy, setBusy] = useState(true);

  const today = todayISO();
  const week = weekStart(today);

  const load = useCallback(async () => {
    if (!household) return;
    setBusy(true);
    try {
      // "Minggu ini" means the rest of the week — nobody shops for yesterday.
      const from = today;
      const to = scope === "today" ? today : addDays(week, 6);
      const [mealData, state] = await Promise.all([
        fetchMeals(household.id, from, to),
        fetchShoppingState(household.id, week),
      ]);
      setMeals(mealData);
      setCheckedSet(state.checked);
      setExtras(state.extras as Extra[]);
    } catch (err) {
      console.warn("shopping load failed", err);
    } finally {
      setBusy(false);
    }
  }, [household, scope, today, week]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(line: ShoppingLine) {
    if (!household) return;
    const next = new Set(checked);
    const isChecked = !next.has(line.norm_key);
    if (isChecked) next.add(line.norm_key);
    else next.delete(line.norm_key);
    setCheckedSet(next);
    try {
      await setChecked(household.id, week, line.norm_key, isChecked);
    } catch (err) {
      console.warn("check failed", err);
      load();
    }
  }

  async function toggleExtra(extra: Extra) {
    setExtras((prev) =>
      prev.map((e) => (e.id === extra.id ? { ...e, checked: !e.checked } : e))
    );
    try {
      await setExtraChecked(extra.id, !extra.checked);
    } catch {
      load();
    }
  }

  async function submitExtra(e: FormEvent) {
    e.preventDefault();
    if (!household || !newItem.trim()) return;
    const label = newItem.trim();
    setNewItem("");
    try {
      const row = (await addExtra(household.id, week, label)) as Extra;
      setExtras((prev) => [...prev, row]);
    } catch (err) {
      console.warn("add extra failed", err);
    }
  }

  if (loading || !household) return <Spinner />;

  const lines = buildShoppingList(meals);
  const remaining = lines.filter((l) => !checked.has(l.norm_key)).length + extras.filter((e) => !e.checked).length;

  return (
    <div className="px-4 pb-8 pt-5">
      <header className="mb-4">
        <h1 className="font-display text-[1.9rem] leading-none text-ink">Belanja</h1>
        <p className="mt-1 text-ink-muted">
          {remaining ? `${remaining} belum diambil` : "Semua sudah diambil"}
        </p>
      </header>

      <div className="mb-4 flex gap-1.5 rounded-2xl bg-paper-sunk p-1.5">
        {(
          [
            ["today", "Hari ini"],
            ["week", "Minggu ini"],
          ] as [Scope, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setScope(key)}
            className={`flex-1 rounded-xl py-2.5 text-[0.92rem] transition ${
              scope === key ? "bg-paper-surface text-clay shadow-sm" : "text-ink-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {busy && !lines.length ? (
        <Spinner label="memuat…" />
      ) : (
        <div className="space-y-2">
          {lines.map((line) => {
            const isChecked = checked.has(line.norm_key);
            return (
              <button
                key={line.norm_key}
                onClick={() => toggle(line)}
                className={`flex w-full items-start gap-3 rounded-2xl border bg-paper-surface p-3.5 text-left transition ${
                  isChecked ? "border-paper-border opacity-55" : "border-paper-border"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                    isChecked ? "border-leaf bg-leaf text-paper-surface" : "border-paper-line"
                  }`}
                >
                  {isChecked && <Icon name="check" size={15} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`block font-medium text-ink ${isChecked ? "line-through" : ""}`}
                  >
                    {line.label}
                    {line.amounts.length > 0 && (
                      <span className="font-normal text-ink-muted"> — {formatAmounts(line)}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-[0.85rem] text-ink-faint">
                    {line.meals.join(" · ")}
                  </span>
                </span>
              </button>
            );
          })}

          {extras.map((extra) => (
            <div
              key={extra.id}
              className={`flex items-center gap-3 rounded-2xl border border-paper-border bg-paper-surface p-3.5 ${
                extra.checked ? "opacity-55" : ""
              }`}
            >
              <button
                onClick={() => toggleExtra(extra)}
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                  extra.checked ? "border-leaf bg-leaf text-paper-surface" : "border-paper-line"
                }`}
                aria-label="Tandai"
              >
                {extra.checked && <Icon name="check" size={15} />}
              </button>
              <span className={`flex-1 text-ink ${extra.checked ? "line-through" : ""}`}>
                {extra.label}
              </span>
              <button
                onClick={async () => {
                  setExtras((prev) => prev.filter((e) => e.id !== extra.id));
                  await removeExtra(extra.id).catch(() => load());
                }}
                aria-label="Hapus"
                className="rounded-full p-2 text-ink-faint active:bg-paper-sunk"
              >
                <Icon name="x" size={17} />
              </button>
            </div>
          ))}

          {!lines.length && !extras.length && (
            <div className="rounded-card border border-dashed border-paper-line px-4 py-14 text-center">
              <Icon name="cart" size={26} className="mx-auto text-ink-faint" />
              <p className="mt-3 text-ink-muted">Belum ada bahan yang perlu dibeli.</p>
            </div>
          )}
        </div>
      )}

      <form onSubmit={submitExtra} className="mt-4 flex gap-2">
        <input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder="Tambah sendiri — beras, minyak…"
          className="w-full rounded-xl border border-paper-border bg-paper-surface px-3.5 py-3 outline-none focus:border-clay"
        />
        <button
          type="submit"
          disabled={!newItem.trim()}
          aria-label="Tambah"
          className="shrink-0 rounded-xl bg-paper-sunk px-4 text-ink disabled:opacity-40"
        >
          <Icon name="plus" />
        </button>
      </form>
    </div>
  );
}
