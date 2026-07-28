import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createHousehold } from "@/lib/queries";
import { useHousehold } from "@/context/HouseholdContext";
import Button from "@/components/ui/Button";

export default function OnboardingPage() {
  const [name, setName] = useState("Dapur kami");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { refetch } = useHousehold();
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await createHousehold(name.trim() || "Dapur");
      refetch();
      navigate("/minggu", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal membuat dapur");
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center px-6">
      <h1 className="font-display text-[2rem] leading-tight text-ink">Buat dapur</h1>
      <p className="mt-2 text-ink-muted">
        Satu dapur untuk rumah ini. Nanti kamu bisa kirim link + PIN ke yang memasak.
      </p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama dapur"
          className="w-full rounded-2xl border border-paper-border bg-paper-surface px-4 py-3 outline-none focus:border-clay"
        />
        {error && <p className="text-sm text-clay-deep">{error}</p>}
        <Button type="submit" full disabled={busy}>
          {busy ? "Sebentar…" : "Mulai"}
        </Button>
      </form>
    </div>
  );
}
