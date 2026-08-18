import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";

/**
 * Small + on an ingredient or step. Nia taps it to leave a clarification that
 * comes back the next time this recipe is cooked.
 *
 * Parent should be `flex flex-wrap`. The + sits on the row; the note/editor
 * wraps onto the next line (`basis-full`).
 */
export default function CookLineNote({
  note,
  onSave,
}: {
  note?: string | null;
  onSave: (note: string | null) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(note ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setValue(note ?? "");
  }, [note, open]);

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    try {
      await onSave(next);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={note ? "Ubah catatan masak" : "Tambah catatan masak"}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-clay/40 text-clay active:bg-clay-soft"
        >
          <Icon name="plus" size={18} />
        </button>
      )}
      {(open || note) && (
        <div className="basis-full min-w-0">
          {note && !open && (
            <p className="mt-1 rounded-lg bg-clay-soft px-3 py-2 text-[0.95rem] leading-relaxed text-clay-deep">
              {note}
            </p>
          )}
          {open && (
            <div className="mt-1">
              <textarea
                value={value}
                onChange={(e) => setValue(e.target.value)}
                rows={3}
                autoFocus
                placeholder="Catatan untuk lain kali…"
                className="w-full rounded-xl border border-paper-border bg-paper-bg px-3 py-2.5 text-[0.95rem] leading-relaxed outline-none focus:border-clay"
              />
              {error && <p className="mt-1.5 text-[0.85rem] text-clay-deep">{error}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => save(value.trim() || null)}
                  className="rounded-full bg-clay px-4 py-2 text-[0.9rem] font-medium text-paper-surface disabled:opacity-50"
                >
                  Simpan
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-paper-sunk px-4 py-2 text-[0.9rem] text-ink"
                >
                  Batal
                </button>
                {note ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => save(null)}
                    className="rounded-full px-4 py-2 text-[0.9rem] text-clay-deep"
                  >
                    Hapus
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
