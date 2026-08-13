import { createContext, useCallback, useContext, useState, ReactNode } from "react";

const KEY = "dapur_nias_view";

interface Ctx {
  /** Planner-only: Olivia is looking at Nias's cook screens. */
  niasView: boolean;
  setNiasView: (on: boolean) => void;
}

const ViewCtx = createContext<Ctx>({
  niasView: false,
  setNiasView: () => {},
});

export function ViewProvider({ children }: { children: ReactNode }) {
  const [niasView, setNiasViewState] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });

  const setNiasView = useCallback((on: boolean) => {
    try {
      localStorage.setItem(KEY, on ? "1" : "0");
    } catch {
      /* private mode */
    }
    setNiasViewState(on);
  }, []);

  return <ViewCtx.Provider value={{ niasView, setNiasView }}>{children}</ViewCtx.Provider>;
}

export function useView() {
  return useContext(ViewCtx);
}
