import { FormEvent, useState } from "react";
import { supabase } from "@/lib/supabase";
import Button from "@/components/ui/Button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setNotice("Cek email untuk konfirmasi, lalu masuk.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center px-6">
      <header className="mb-8">
        <h1 className="font-display text-[2.6rem] leading-none text-ink">Dapur</h1>
        <p className="mt-3 text-ink-muted">
          Rencana masak rumah — satu tempat untuk resep, catatan, dan belanja.
        </p>
      </header>

      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="w-full rounded-2xl border border-paper-border bg-paper-surface px-4 py-3 outline-none focus:border-clay"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Kata sandi"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          className="w-full rounded-2xl border border-paper-border bg-paper-surface px-4 py-3 outline-none focus:border-clay"
        />

        {error && <p className="text-sm text-clay-deep">{error}</p>}
        {notice && <p className="text-sm text-leaf">{notice}</p>}

        <Button type="submit" full disabled={busy}>
          {busy ? "Sebentar…" : mode === "signup" ? "Buat akun" : "Masuk"}
        </Button>
      </form>

      <button
        onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        className="mt-5 text-sm text-ink-muted underline underline-offset-4"
      >
        {mode === "signin" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk"}
      </button>
    </div>
  );
}
