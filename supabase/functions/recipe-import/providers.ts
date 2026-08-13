import Anthropic from "npm:@anthropic-ai/sdk@^0.70.0";
import { IMAGE_PROMPT, RECIPE_SCHEMA, SYSTEM_PROMPT, userPromptForText } from "./prompt.ts";

/**
 * Two providers behind one shape.
 *
 * Text (a URL's contents, or a pasted WhatsApp forward) goes to DeepSeek: it is
 * roughly $0.008 per import and its 1M context lets us hand over lightly
 * stripped HTML instead of building a page cleaner.
 *
 * Images go to Claude, because DeepSeek V4 is text-only — verified July 2026,
 * both v4-flash and v4-pro. Since photos and screenshots are a primary source
 * here, that split is load-bearing rather than an optimization.
 *
 * Both return the identical JSON shape, so nothing downstream knows which ran.
 */

export interface ImportedRecipe {
  title_id: string;
  title_en: string | null;
  servings: number | null;
  total_minutes: number | null;
  ingredients: Array<{
    qty: string | null;
    unit: string | null;
    item_id: string;
    item_en: string | null;
    note: string | null;
  }>;
  steps: Array<{ id: string; en: string | null }>;
  tags: string[];
  notes: string | null;
}

/**
 * Which model handles text. Set TEXT_PROVIDER=claude to A/B the Indonesian —
 * at this volume the cost difference is cents, so quality should decide.
 */
const TEXT_PROVIDER = Deno.env.get("TEXT_PROVIDER") ?? "deepseek";
const DEEPSEEK_MODEL = Deno.env.get("DEEPSEEK_MODEL") ?? "deepseek-v4-flash";
const CLAUDE_MODEL = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-opus-5";

export async function structureFromText(
  text: string,
  sourceUrl?: string,
): Promise<ImportedRecipe> {
  return TEXT_PROVIDER === "claude"
    ? await claudeStructure([{ type: "text", text: userPromptForText(text, sourceUrl) }])
    : await deepseekStructure(userPromptForText(text, sourceUrl));
}

export async function structureFromImage(
  base64: string,
  mediaType: string,
): Promise<ImportedRecipe> {
  return await claudeStructure([
    { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
    { type: "text", text: IMAGE_PROMPT },
  ]);
}

// ------------------------------------------------------------------- Claude

async function claudeStructure(content: unknown[]): Promise<ImportedRecipe> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error(
      "Photo import needs an Anthropic API key on the server. Use Link or Paste for now.",
    );
  }

  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    // Extraction is a shallow task and Olivia is waiting on it, so keep the
    // thinking budget small rather than turning it off — disabled thinking has
    // its own failure modes and buys little here.
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: RECIPE_SCHEMA },
    },
    messages: [{ role: "user", content }],
  } as never);

  if (response.stop_reason === "refusal") {
    throw new Error("The model refused to read this source");
  }

  const block = response.content.find((b: { type: string }) => b.type === "text");
  if (!block) throw new Error("The model didn't return a result");
  return normalize(JSON.parse((block as { text: string }).text));
}

// ----------------------------------------------------------------- DeepSeek

async function deepseekStructure(prompt: string): Promise<ImportedRecipe> {
  const apiKey = Deno.env.get("DEEPSEEK_API_KEY");
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not set on the server");

  const models = [DEEPSEEK_MODEL, "deepseek-chat"].filter(
    (m, i, arr) => m && arr.indexOf(m) === i,
  );
  let lastError = "DeepSeek didn't return a result";

  for (const model of models) {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content: `${SYSTEM_PROMPT}\n\nReply ONLY with JSON that matches this schema:\n${
              JSON.stringify(RECIPE_SCHEMA)
            }`,
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        max_tokens: 8000,
      }),
    });

    if (!res.ok) {
      lastError = `DeepSeek failed (${res.status}): ${(await res.text()).slice(0, 200)}`;
      continue;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      lastError = "DeepSeek didn't return a result";
      continue;
    }
    return normalize(JSON.parse(content));
  }

  throw new Error(lastError);
}

// ---------------------------------------------------------------- normalize

/** Models drift on optional fields; the app should never see a missing array. */
function normalize(raw: Record<string, unknown>): ImportedRecipe {
  const num = (v: unknown): number | null => {
    const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
    return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  };
  const str = (v: unknown): string | null => {
    const s = typeof v === "string" ? v.trim() : "";
    return s ? s : null;
  };

  return {
    title_id: str(raw.title_id) ?? "Untitled recipe",
    title_en: str(raw.title_en),
    servings: num(raw.servings),
    total_minutes: num(raw.total_minutes),
    ingredients: Array.isArray(raw.ingredients)
      ? raw.ingredients
        .map((row: Record<string, unknown>) => ({
          qty: str(row?.qty),
          unit: str(row?.unit),
          item_id: str(row?.item_id) ?? "",
          item_en: str(row?.item_en),
          note: str(row?.note),
        }))
        .filter((row) => row.item_id)
      : [],
    // Model returns text_id/text_en; the stored shape is {id, en}. Accept the
    // old key too, and drop anything that is obviously a placeholder
    // identifier ("step-1") rather than an actual instruction.
    steps: Array.isArray(raw.steps)
      ? raw.steps
        .map((row: Record<string, unknown>) => ({
          id: (str(row?.text_id) ?? str(row?.id) ?? "").replace(/^\s*\d+[.)]\s*/, ""),
          en: str(row?.text_en) ?? str(row?.en),
        }))
        .filter((row) => row.id && !/^(step|langkah)[-_\s]?\d+$/i.test(row.id))
      : [],
    tags: Array.isArray(raw.tags)
      ? raw.tags
        .map((t: unknown) => String(t).toLowerCase().trim())
        .filter(Boolean)
        .slice(0, 8)
      : [],
    notes: str(raw.notes),
  };
}
