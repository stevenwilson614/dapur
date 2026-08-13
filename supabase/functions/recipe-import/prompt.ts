/**
 * One prompt, one call: extract structure AND render it in both languages.
 *
 * Indonesian is what the cook reads. English is what Olivia plans with.
 * Doing both in the extraction call (rather than a second pass) keeps them
 * from drifting, and there's no "translate" button anywhere in the app.
 */
export const SYSTEM_PROMPT = `You help a household in Bandung tidy up cooking recipes.

Your job: read the recipe text or image, then return structured recipe data in BOTH Indonesian and English.

Language rules:
- Indonesian is what the cook reads. Fill title_id, item_id, and text_id in everyday Indonesian kitchen/market language — "bawang bombay", not a literal "onion". "Daun bawang", not "green onion".
- Terms already used as-is in Indonesian kitchens stay as-is (e.g. "saus teriyaki", "pasta", "oregano").
- Units in Indonesian fields: sdm, sdt, gram, ml, buah, siung, butir, lembar, secukupnya.
- ALWAYS fill the English fields too: title_en, item_en, text_en. Olivia plans in English. Never leave them null just because the source was Indonesian.
- English units: tbsp, tsp, g, ml, cloves, etc. Use names a native English speaker would shop with.

Content rules:
- Split amount from name: qty ("2"), unit ("sdm" / "tbsp"), item_id ("kecap manis"), item_en ("sweet soy sauce").
- If there is no amount, qty and unit are null.
- Steps: text_id / text_en are the STEP SENTENCE, not a number. Short and clear, one action per step. Do not number them (numbers are added automatically).
- Strip blog preamble, ads, personal stories, and subscribe CTAs.
- total_minutes: estimated total cooking time in minutes. If unsure, give a reasonable estimate.
- tags: 2-5 short lowercase labels for later search (e.g. chicken, noodles, spicy, quick, dinner, vegetarian). English is fine.
- notes: only if the source has an important note (e.g. "better if left overnight"). Otherwise null.

Do not invent ingredients or steps that aren't in the source. If a part is unreadable, skip it.`;

export const RECIPE_SCHEMA = {
  type: "object",
  properties: {
    title_id: { type: "string" },
    title_en: { type: ["string", "null"] },
    servings: { type: ["integer", "null"] },
    total_minutes: { type: ["integer", "null"] },
    ingredients: {
      type: "array",
      items: {
        type: "object",
        properties: {
          qty: { type: ["string", "null"] },
          unit: { type: ["string", "null"] },
          item_id: { type: "string" },
          item_en: { type: ["string", "null"] },
          note: { type: ["string", "null"] },
        },
        required: ["qty", "unit", "item_id", "item_en", "note"],
        additionalProperties: false,
      },
    },
    // Named text_id / text_en, NOT id / en: a field called "id" reads as
    // "identifier" to a model, and it intermittently returned "step-1" instead
    // of the step text. The stored shape stays {id, en} — normalize() maps back.
    steps: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text_id: { type: "string", description: "Cooking step in Indonesian" },
          text_en: { type: ["string", "null"], description: "Same step in English" },
        },
        required: ["text_id", "text_en"],
        additionalProperties: false,
      },
    },
    tags: { type: "array", items: { type: "string" } },
    notes: { type: ["string", "null"] },
  },
  required: [
    "title_id",
    "title_en",
    "servings",
    "total_minutes",
    "ingredients",
    "steps",
    "tags",
    "notes",
  ],
  additionalProperties: false,
} as const;

export function userPromptForText(text: string, sourceUrl?: string): string {
  const source = sourceUrl ? `\n\nSource: ${sourceUrl}` : "";
  return `Tidy this recipe into structured data in both Indonesian and English.${source}\n\n---\n${text}\n---`;
}

export const IMAGE_PROMPT =
  "Read the recipe in this image (cookbook page, handwriting, or screenshot) " +
  "and return structured data in both Indonesian and English.";
