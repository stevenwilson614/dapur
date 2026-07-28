import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { fetchMyHousehold } from "@/lib/queries";
import type { Household, Role } from "@/lib/types";

interface Ctx {
  household: Household | null;
  role: Role | null;
  loading: boolean;
  needsOnboarding: boolean;
  refetch: () => void;
}

const HouseholdCtx = createContext<Ctx>({
  household: null,
  role: null,
  loading: true,
  needsOnboarding: false,
  refetch: () => {},
});

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [household, setHousehold] = useState<Household | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const result = await fetchMyHousehold();
        if (cancelled) return;
        if (result) {
          setHousehold(result.household);
          setRole(result.role as Role);
          setNeedsOnboarding(false);
        } else {
          setHousehold(null);
          setRole(null);
          setNeedsOnboarding(true);
        }
      } catch (err) {
        console.warn("household load failed:", JSON.stringify(err), err);
        if (!cancelled) setNeedsOnboarding(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return (
    <HouseholdCtx.Provider value={{ household, role, loading, needsOnboarding, refetch }}>
      {children}
    </HouseholdCtx.Provider>
  );
}

export function useHousehold() {
  return useContext(HouseholdCtx);
}
