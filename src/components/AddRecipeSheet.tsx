import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import Icon, { IconName } from "@/components/ui/Icon";
import RecipeReviewForm from "@/components/RecipeReviewForm";
import { callFunction } from "@/lib/supabase";
import { saveRecipe } from "@/lib/queries";
import { fileToCompressedBase64 } from "@/lib/image";
import {
  RecipeDraft,
  draftFromImport,
  draftToRecipe,
  emptyDraft,
} from "@/lib/recipeDraft";
import type { ImportedRecipe, Recipe } from "@/lib/types";

type Mode = "url" | "photo" | "paste" | "manual";

const MODES: { key: Mode; label: string; icon: IconName }[] = [
  { key: "url", label: "Link", icon: "link" },
  { key: "photo", label: "Photo", icon: "camera" },
  { key: "paste", label: "Paste", icon: "clipboard" },
  { key: "manual", label: "Write", icon: "pencil" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  householdId: string;
  /** When set, the sheet offers "add to this meal" as the primary action. */
  onSaved: (recipe: Recipe) => void;
}

export default function AddRecipeSheet({ open, onClose, householdId, onSaved }: Props) {
  const [mode, setMode] = useState<Mode>("url");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [stage, setStage] = useState<"input" | "loading" | "review">("input");
  const [draft, setDraft] = useState<RecipeDraft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset() {
    setStage("input");
    setDraft(emptyDraft());
    setUrl("");
    setPasted("");
    setError(null);
    setMode("url");
  }

  function close() {
    reset();
    onClose();
  }

  async function runImport(payload: Record<string, unknown>) {
    setStage("loading");
    setError(null);
    try {
      const result = await callFunction<ImportedRecipe>("recipe-import", payload);
      setDraft(draftFromImport(result));
      setStage("review");
    } catch (err) {
      // Never a dead end: fall through to the editor with whatever we have.
      setError(
        err instanceof Error
          ? `${err.message} — fill in the rest below.`
          : "Couldn't read the recipe — fill it in below."
      );
      setDraft({
        ...emptyDraft(),
        stepsText: typeof payload.text === "string" ? (payload.text as string) : "",
        source_url: typeof payload.url === "string" ? (payload.url as string) : null,
      });
      setStage("review");
    }
  }

  async function handlePhoto(file: File) {
    try {
      const { image, media_type } = await fileToCompressedBase64(file);
      await runImport({ image, media_type });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that photo.");
      setDraft(emptyDraft());
      setStage("review");
    }
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const sourceType = stage === "review" && mode ? mode : "manual";
      const recipe = await saveRecipe(draftToRecipe(draft, householdId, sourceType));
      onSaved(recipe);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title={stage === "review" ? "Check the recipe" : "New recipe"}
      subtitle={
        stage === "review"
          ? "Translated for you and for the cook. Fix anything that's off."
          : undefined
      }
      footer={
        stage === "review" ? (
          <Button full onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save recipe"}
          </Button>
        ) : undefined
      }
    >
      {stage === "loading" && (
        <div className="flex flex-col items-center gap-3 py-16 text-ink-muted">
          <Icon name="pot" size={30} className="animate-pulse" />
          <p>Reading the recipe…</p>
        </div>
      )}

      {stage === "input" && (
        <div className="space-y-4">
          <div className="flex gap-1.5 rounded-2xl bg-paper-sunk p-1.5">
            {MODES.map((m) => (
              <button
                key={m.key}
                onClick={() => setMode(m.key)}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl py-2.5 text-[0.78rem] transition ${
                  mode === m.key ? "bg-paper-surface text-clay shadow-sm" : "text-ink-muted"
                }`}
              >
                <Icon name={m.icon} size={19} />
                {m.label}
              </button>
            ))}
          </div>

          {mode === "url" && (
            <div className="space-y-3">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                inputMode="url"
                placeholder="https://…"
                className="w-full rounded-xl border border-paper-border bg-paper-surface px-3 py-3 outline-none focus:border-clay"
              />
              <Button full disabled={!url.trim()} onClick={() => runImport({ url: url.trim() })}>
                Get recipe
              </Button>
              <p className="text-sm text-ink-muted">
                From a food blog, Cookpad, or another recipe site.
              </p>
            </div>
          )}

          {mode === "photo" && (
            <div className="space-y-3">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-paper-line bg-paper-surface px-4 py-10 text-ink-muted">
                <Icon name="camera" size={26} />
                <span className="text-sm">Take a photo or pick from the gallery</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhoto(file);
                  }}
                />
              </label>
              <p className="text-sm text-ink-muted">
                Cookbook page, handwriting, or a screenshot.
              </p>
            </div>
          )}

          {mode === "paste" && (
            <div className="space-y-3">
              <textarea
                value={pasted}
                onChange={(e) => setPasted(e.target.value)}
                rows={9}
                placeholder="Paste a WhatsApp recipe here…"
                className="w-full rounded-xl border border-paper-border bg-paper-surface px-3 py-3 outline-none focus:border-clay"
              />
              <Button
                full
                disabled={!pasted.trim()}
                onClick={() => runImport({ text: pasted.trim() })}
              >
                Clean up recipe
              </Button>
            </div>
          )}

          {mode === "manual" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-muted">Write it yourself from scratch.</p>
              <Button
                full
                onClick={() => {
                  setDraft(emptyDraft());
                  setStage("review");
                }}
              >
                Start writing
              </Button>
            </div>
          )}
        </div>
      )}

      {stage === "review" && (
        <div className="space-y-4">
          {error && (
            <p className="rounded-xl bg-clay-soft px-3 py-2 text-sm text-clay-deep">{error}</p>
          )}
          <RecipeReviewForm draft={draft} onChange={setDraft} />
        </div>
      )}
    </Sheet>
  );
}
