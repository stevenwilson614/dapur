import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate, Outlet, NavLink, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { HouseholdProvider, useHousehold } from "@/context/HouseholdContext";
import Icon, { IconName } from "@/components/ui/Icon";

import LoginPage from "@/pages/LoginPage";
import OnboardingPage from "@/pages/OnboardingPage";
import WeekPage from "@/pages/WeekPage";
import LibraryPage from "@/pages/LibraryPage";
import SettingsPage from "@/pages/SettingsPage";

import CookLoginPage from "@/pages/cook/CookLoginPage";
import TodayPage from "@/pages/cook/TodayPage";
import ShoppingPage from "@/pages/cook/ShoppingPage";
import CookModePage from "@/pages/cook/CookModePage";

export function Spinner({ label = "sebentar…" }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}

const PLANNER_NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/minggu", label: "Minggu", icon: "calendar" },
  { to: "/koleksi", label: "Koleksi", icon: "book" },
  { to: "/pengaturan", label: "Atur", icon: "settings" },
];

const COOK_NAV: { to: string; label: string; icon: IconName }[] = [
  { to: "/masak", label: "Hari ini", icon: "pot" },
  { to: "/masak/belanja", label: "Belanja", icon: "cart" },
];

function BottomNav({ items }: { items: typeof PLANNER_NAV }) {
  return (
    <nav className="sticky bottom-0 z-30 border-t border-paper-border bg-paper-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-[520px] items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/masak"}
            className={({ isActive }) =>
              `flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl text-[0.72rem] transition ${
                isActive ? "text-clay" : "text-ink-muted"
              }`
            }
          >
            <Icon name={item.icon} size={22} />
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Planner shell: Olivia's side. */
function PlannerShell() {
  const { needsOnboarding, loading } = useHousehold();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && needsOnboarding) navigate("/onboard", { replace: true });
  }, [loading, needsOnboarding, navigate]);

  if (loading) return <Spinner />;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-paper-bg">
      <main className="flex-1">
        <Outlet />
      </main>
      <BottomNav items={PLANNER_NAV} />
    </div>
  );
}

/**
 * Cook shell: the helper's side. Deliberately not the planner shell — different
 * nav, larger type, no settings, nothing she can break.
 */
function CookShell() {
  return (
    <div className="cook mx-auto flex min-h-screen w-full max-w-[520px] flex-col bg-paper-bg">
      <main className="flex-1">
        <Outlet />
      </main>
      <BottomNav items={COOK_NAV} />
    </div>
  );
}

function PlannerGuard({ session }: { session: Session | null }) {
  if (!session) return <Navigate to="/login" replace />;
  return (
    <HouseholdProvider>
      <PlannerShell />
    </HouseholdProvider>
  );
}

function CookGuard({ session }: { session: Session | null }) {
  if (!session) return <Navigate to="/masak/masuk" replace />;
  return (
    <HouseholdProvider>
      <CookShell />
    </HouseholdProvider>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <Spinner />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={session ? <Navigate to="/minggu" replace /> : <LoginPage />} />
        <Route path="/masak/masuk" element={<CookLoginPage />} />

        {/* Cook — full-screen, outside the shell so nothing competes with the steps. */}
        <Route
          path="/masak/resep/:mealId/:recipeId"
          element={
            <HouseholdProvider>
              <CookModePage />
            </HouseholdProvider>
          }
        />

        <Route element={<CookGuard session={session} />}>
          <Route path="/masak" element={<TodayPage />} />
          <Route path="/masak/belanja" element={<ShoppingPage />} />
        </Route>

        <Route element={<PlannerGuard session={session} />}>
          <Route path="/onboard" element={<OnboardingPage />} />
          <Route index element={<Navigate to="/minggu" replace />} />
          <Route path="/minggu" element={<WeekPage />} />
          <Route path="/koleksi" element={<LibraryPage />} />
          <Route path="/pengaturan" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/minggu" replace />} />
      </Routes>
    </HashRouter>
  );
}
