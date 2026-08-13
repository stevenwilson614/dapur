import { useHousehold } from "@/context/HouseholdContext";
import { updateHousehold } from "@/lib/queries";
import { supabase } from "@/lib/supabase";
import { SLOT_LABEL_EN, SLOT_ORDER } from "@/lib/types";
import type { Slot } from "@/lib/types";
import { Spinner } from "@/App";

export default function SettingsPage() {
  const { household, loading, refetch } = useHousehold();

  if (loading || !household) return <Spinner />;

  async function toggleSlot(slot: Slot) {
    if (!household) return;
    const current = household.slots ?? [];
    const next = current.includes(slot)
      ? current.filter((s) => s !== slot)
      : [...SLOT_ORDER].filter((s) => current.includes(s) || s === slot);
    await updateHousehold(household.id, { slots: next });
    refetch();
  }

  return (
    <div className="px-4 pb-8 pt-5">
      <h1 className="mb-5 font-display text-[1.9rem] leading-none text-ink">Settings</h1>

      <Section title="Meal times">
        <div className="space-y-1.5">
          {SLOT_ORDER.map((slot) => {
            const on = (household.slots ?? []).includes(slot);
            return (
              <button
                key={slot}
                onClick={() => toggleSlot(slot)}
                className="flex w-full items-center justify-between rounded-xl bg-paper-bg px-3.5 py-3 text-left"
              >
                <span className={on ? "text-ink" : "text-ink-faint"}>{SLOT_LABEL_EN[slot]}</span>
                <span
                  className={`flex h-6 w-11 items-center rounded-full px-0.5 transition ${
                    on ? "bg-clay" : "bg-paper-line"
                  }`}
                >
                  <span
                    className={`h-5 w-5 rounded-full bg-paper-surface transition ${
                      on ? "translate-x-5" : ""
                    }`}
                  />
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Also">
        <button
          onClick={async () => {
            await updateHousehold(household.id, {
              show_read_receipt: !household.show_read_receipt,
            });
            refetch();
          }}
          className="flex w-full items-center justify-between rounded-xl bg-paper-bg px-3.5 py-3 text-left"
        >
          <span className="pr-4">
            <span className="text-ink">Seen indicator</span>
            <span className="mt-0.5 block text-sm text-ink-muted">
              See when today’s plan was opened.
            </span>
          </span>
          <span
            className={`flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition ${
              household.show_read_receipt ? "bg-clay" : "bg-paper-line"
            }`}
          >
            <span
              className={`h-5 w-5 rounded-full bg-paper-surface transition ${
                household.show_read_receipt ? "translate-x-5" : ""
              }`}
            />
          </span>
        </button>
      </Section>

      <button
        onClick={() => supabase.auth.signOut()}
        className="mt-2 text-sm text-ink-muted underline underline-offset-4"
      >
        Sign out
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 rounded-card border border-paper-border bg-paper-surface p-4 shadow-card">
      <h2 className="mb-3 font-display text-[1.15rem] leading-none text-ink">{title}</h2>
      {children}
    </section>
  );
}
