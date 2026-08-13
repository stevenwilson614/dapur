import { useLocation, useNavigate } from "react-router-dom";
import { useHousehold } from "@/context/HouseholdContext";
import { useView } from "@/context/ViewContext";

/**
 * Planner-only. Lets Olivia flip into Nias's cook screens (Indonesian, today +
 * shopping + cook mode) without signing out. Hidden when Nias herself is signed in.
 */
export default function ViewToggle() {
  const { role, loading } = useHousehold();
  const { niasView, setNiasView } = useView();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading || role !== "planner") return null;

  function showOlivia() {
    setNiasView(false);
    if (location.pathname.startsWith("/masak")) navigate("/minggu", { replace: true });
  }

  function showNias() {
    setNiasView(true);
    if (!location.pathname.startsWith("/masak")) navigate("/masak", { replace: true });
  }

  return (
    <div className="px-4 pt-3">
      <div className="flex gap-1.5 rounded-2xl bg-paper-sunk p-1.5">
        <button
          type="button"
          onClick={showOlivia}
          className={`flex-1 rounded-xl py-2.5 text-[0.92rem] transition ${
            !niasView ? "bg-paper-surface text-clay shadow-sm" : "text-ink-muted"
          }`}
        >
          Olivia
        </button>
        <button
          type="button"
          onClick={showNias}
          className={`flex-1 rounded-xl py-2.5 text-[0.92rem] transition ${
            niasView ? "bg-paper-surface text-clay shadow-sm" : "text-ink-muted"
          }`}
        >
          Nias
        </button>
      </div>
    </div>
  );
}
