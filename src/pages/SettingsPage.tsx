import { useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { updateHousehold } from "@/lib/queries";
import { callFunction, supabase } from "@/lib/supabase";
import { SLOT_LABEL, SLOT_ORDER } from "@/lib/types";
import type { Slot } from "@/lib/types";
import Icon from "@/components/ui/Icon";
import Button from "@/components/ui/Button";
import { Spinner } from "@/App";

export default function SettingsPage() {
  const { household, loading, refetch } = useHousehold();
  const [pin, setPin] = useState("");
  const [pinSaved, setPinSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading || !household) return <Spinner />;

  const cookLink = `${window.location.origin}${import.meta.env.BASE_URL}#/masak/masuk?k=${household.link_token}`;

  async function toggleSlot(slot: Slot) {
    if (!household) return;
    const current = household.slots ?? [];
    const next = current.includes(slot)
      ? current.filter((s) => s !== slot)
      : [...SLOT_ORDER].filter((s) => current.includes(s) || s === slot);
    await updateHousehold(household.id, { slots: next });
    refetch();
  }

  async function savePin() {
    if (!household) return;
    if (!/^\d{4}$/.test(pin)) {
      setError("PIN harus 4 angka.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await callFunction("cook-access", {
        action: "set_pin",
        household_id: household.id,
        pin,
      });
      setPin("");
      setPinSaved(true);
      refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan PIN");
    } finally {
      setBusy(false);
    }
  }

  async function shareLink() {
    const text = `Buka link ini untuk lihat masakan hari ini: ${cookLink}`;
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        /* user dismissed — fall through to copy */
      }
    }
    await navigator.clipboard.writeText(cookLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="px-4 pb-8 pt-5">
      <h1 className="mb-5 font-display text-[1.9rem] leading-none text-ink">Pengaturan</h1>

      <Section title="Akses yang memasak">
        <p className="text-sm leading-relaxed text-ink-muted">
          Kirim link ini sekali. Dia buka, masukkan PIN, dan setelah itu tinggal buka saja —
          tanpa email, tanpa kata sandi.
        </p>

        <div className="mt-3 break-all rounded-xl bg-paper-bg px-3 py-2.5 text-[0.82rem] text-ink-muted">
          {cookLink}
        </div>

        <div className="mt-2 flex gap-2">
          <Button variant="secondary" onClick={shareLink} className="flex-1">
            <Icon name="share" size={17} />
            {copied ? "Tersalin" : "Bagikan link"}
          </Button>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-[0.78rem] font-medium uppercase tracking-wide text-ink-muted">
            {household.cook_pin_hash ? "Ganti PIN" : "Buat PIN"}
          </label>
          <div className="flex gap-2">
            <input
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, "").slice(0, 4));
                setPinSaved(false);
              }}
              inputMode="numeric"
              placeholder="4 angka"
              className="w-32 rounded-xl border border-paper-border bg-paper-surface px-3 py-2.5 text-center tracking-[0.4em] outline-none focus:border-clay"
            />
            <Button onClick={savePin} disabled={busy || pin.length !== 4}>
              Simpan
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-clay-deep">{error}</p>}
          {pinSaved && <p className="mt-2 text-sm text-leaf">PIN tersimpan.</p>}
          {!household.cook_pin_hash && !pinSaved && (
            <p className="mt-2 text-sm text-ink-muted">
              Belum ada PIN — link belum bisa dipakai.
            </p>
          )}
        </div>
      </Section>

      <Section title="Waktu makan">
        <div className="space-y-1.5">
          {SLOT_ORDER.map((slot) => {
            const on = (household.slots ?? []).includes(slot);
            return (
              <button
                key={slot}
                onClick={() => toggleSlot(slot)}
                className="flex w-full items-center justify-between rounded-xl bg-paper-bg px-3.5 py-3 text-left"
              >
                <span className={on ? "text-ink" : "text-ink-faint"}>{SLOT_LABEL[slot]}</span>
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

      <Section title="Lainnya">
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
            <span className="text-ink">Tanda sudah dibuka</span>
            <span className="mt-0.5 block text-sm text-ink-muted">
              Lihat kapan rencana hari ini dibuka.
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
        Keluar
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
