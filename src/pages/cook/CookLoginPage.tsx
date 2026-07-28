import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { callFunction, supabase } from "@/lib/supabase";
import Icon from "@/components/ui/Icon";

/**
 * The helper's whole sign-in: open the link once, type four digits, done.
 *
 * The token in the URL identifies the household; the PIN is checked server-side
 * by the `cook-access` function, which binds this device's anonymous auth user
 * to the household as a cook. After that the session refreshes itself and she
 * never sees this screen again.
 */
export default function CookLoginPage() {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // HashRouter puts the query after the hash: #/masak/masuk?k=…
    const hash = window.location.hash;
    const queryIndex = hash.indexOf("?");
    const fromHash = queryIndex >= 0 ? new URLSearchParams(hash.slice(queryIndex + 1)).get("k") : null;
    const fromSearch = new URLSearchParams(window.location.search).get("k");
    const stored = localStorage.getItem("dapur_link_token");
    const found = fromHash || fromSearch || stored;
    if (found) {
      setToken(found);
      localStorage.setItem("dapur_link_token", found);
    }
  }, []);

  async function submit(value: string) {
    if (!token) {
      setError("Link belum lengkap. Minta link baru.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // An anonymous auth user is this device's identity; the function binds it
      // to the household after checking the PIN.
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError) throw anonError;
      }

      await callFunction("cook-access", {
        action: "login",
        link_token: token,
        pin: value,
      });

      navigate("/masak", { replace: true });
    } catch (err) {
      setPin("");
      setError(err instanceof Error ? err.message : "PIN salah");
    } finally {
      setBusy(false);
    }
  }

  function press(digit: string) {
    if (busy) return;
    const next = (pin + digit).slice(0, 4);
    setPin(next);
    if (next.length === 4) submit(next);
  }

  return (
    <div className="cook mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center px-6 pb-10">
      <div className="mb-8 text-center">
        <Icon name="pot" size={34} className="mx-auto text-clay" />
        <h1 className="mt-3 font-display text-[2rem] leading-none text-ink">Dapur</h1>
        <p className="mt-2 text-ink-muted">Masukkan PIN</p>
      </div>

      <div className="mb-7 flex justify-center gap-3">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-3.5 w-3.5 rounded-full transition ${
              i < pin.length ? "bg-clay" : "bg-paper-line"
            }`}
          />
        ))}
      </div>

      {error && <p className="mb-4 text-center text-sm text-clay-deep">{error}</p>}

      <div className="mx-auto grid w-full max-w-[280px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="h-16 rounded-2xl bg-paper-surface text-[1.4rem] text-ink shadow-card transition active:bg-paper-sunk"
          >
            {d}
          </button>
        ))}
        <span />
        <button
          onClick={() => press("0")}
          className="h-16 rounded-2xl bg-paper-surface text-[1.4rem] text-ink shadow-card transition active:bg-paper-sunk"
        >
          0
        </button>
        <button
          onClick={() => setPin(pin.slice(0, -1))}
          aria-label="Hapus"
          className="flex h-16 items-center justify-center rounded-2xl text-ink-muted transition active:bg-paper-sunk"
        >
          <Icon name="chevron-left" size={22} />
        </button>
      </div>

      {busy && <p className="mt-6 text-center text-sm text-ink-muted">Sebentar…</p>}
    </div>
  );
}
