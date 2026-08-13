import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { callFunction, supabase } from "@/lib/supabase";
import Icon from "@/components/ui/Icon";

/**
 * The entire sign-in: tap a name, done.
 *
 * There is one household, and each member who should get an entry button
 * carries a `login_key` (Olivia, Nias). The `home-login` edge function
 * resolves that key to the member's account server-side and mints a session
 * with a magic-link token it redeems itself — the browser never sees a
 * password or a PIN, and the client can't request a session for anyone
 * whose key it doesn't already know from this same screen.
 */

interface Profile {
  login_key: string;
  display_name: string | null;
  role: "planner" | "cook";
}

interface LoginResult {
  access_token: string;
  refresh_token: string;
  role: "planner" | "cook";
}

const FALLBACK_PROFILES: Profile[] = [
  { login_key: "olivia", display_name: "Olivia", role: "planner" },
  { login_key: "lain", display_name: "Nias", role: "cook" },
];

export default function WhoLoginPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  async function enter(profile: Profile) {
    setBusy(profile.login_key);
    setError(null);
    try {
      const result = await callFunction<LoginResult>("home-login", { profile: profile.login_key });
      const { error } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (error) throw error;
      navigate(result.role === "cook" ? "/masak" : "/minggu", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal masuk");
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center px-6">
      <header className="mb-10 text-center">
        <Icon name="pot" size={34} className="mx-auto text-clay" />
        <h1 className="mt-3 font-display text-[2.6rem] leading-none text-ink">Dapur</h1>
        <p className="mt-3 text-ink-muted">Siapa yang masuk?</p>
      </header>

      <div className="space-y-3">
        {FALLBACK_PROFILES.map((profile) => (
          <button
            key={profile.login_key}
            onClick={() => enter(profile)}
            disabled={busy !== null}
            className="flex w-full items-center gap-4 rounded-2xl border border-paper-border bg-paper-surface px-5 py-5 text-left shadow-card transition active:bg-paper-sunk disabled:opacity-60"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-clay-soft font-display text-[1.3rem] text-clay-deep">
              {(profile.display_name ?? profile.login_key).charAt(0).toUpperCase()}
            </span>
            <span className="flex-1 font-display text-[1.4rem] text-ink">
              {profile.display_name ?? profile.login_key}
            </span>
            {busy === profile.login_key && (
              <span className="text-sm text-ink-muted">Sebentar…</span>
            )}
          </button>
        ))}
      </div>

      {error && <p className="mt-5 text-center text-sm text-clay-deep">{error}</p>}
    </div>
  );
}
