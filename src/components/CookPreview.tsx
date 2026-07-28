import MealCookCard from "@/components/MealCookCard";
import type { Meal } from "@/lib/types";

/**
 * What the helper will actually open. Rendering the real cook card here (rather
 * than a mockup of it) is the point — it's the trust-builder that replaces
 * scrolling back through WhatsApp to check what was sent.
 */
export default function CookPreview({ meal }: { meal: Meal }) {
  return (
    <div className="cook rounded-2xl bg-paper-bg p-3">
      <MealCookCard meal={meal} preview />
    </div>
  );
}
