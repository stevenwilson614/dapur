/**
 * Turn a recipe URL into text the model can work with.
 *
 * Fast path: most recipe sites (NYT Cooking, Serious Eats, Cookpad, and a large
 * share of food blogs) embed a schema.org Recipe as JSON-LD. When it's there,
 * extraction is exact and free — we hand the model clean structured data and it
 * only has to translate. When it isn't, we strip the page and let the model read
 * it. DeepSeek's 1M context means "strip" can stay crude: no Readability port,
 * no DOM parser, just drop the parts that are definitely not recipe.
 */

export interface PageContent {
  text: string;
  heroImage: string | null;
  fromJsonLd: boolean;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export const FETCH_UA = UA;

export async function fetchPage(url: string): Promise<PageContent> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  // Some big recipe sites (Serious Eats, AllRecipes) block datacenter IPs
  // outright. Nothing to fix server-side — so say the thing that actually
  // works: copy the text and use Tempel.
  if (res.status === 403 || res.status === 401 || res.status === 429) {
    throw new Error(
      "This site blocks automatic access. Copy the recipe text and use the Paste tab.",
    );
  }
  if (!res.ok) throw new Error(`Couldn't open that page (${res.status})`);

  const html = await res.text();
  const recipe = findRecipeJsonLd(html);
  const heroImage = resolveImageUrl(
    findMetaImage(html) ?? (recipe ? firstImageFromRecipe(recipe) : null),
    url,
  );

  if (recipe) {
    return {
      text: JSON.stringify(recipe),
      heroImage,
      fromJsonLd: true,
    };
  }

  return { text: stripToText(html), heroImage, fromJsonLd: false };
}

/** Turn a possibly-relative or protocol-relative image URL into an absolute https URL. */
export function resolveImageUrl(raw: string | null | undefined, pageUrl?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    if (trimmed.startsWith("//")) return new URL(`https:${trimmed}`).toString();
    if (pageUrl) return new URL(trimmed, pageUrl).toString();
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

function findMetaImage(html: string): string | null {
  const patterns = [
    /<meta[^>]+property=["']og:image(?::secure_url|:url)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url|:url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image(?::src)?["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return null;
}

/** Walk any JSON-LD graph shape and return the first @type: Recipe node. */
function findRecipeJsonLd(html: string): unknown | null {
  const blocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )];

  for (const block of blocks) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(block[1].trim());
    } catch {
      continue;
    }
    const found = searchForRecipe(parsed);
    if (found) return found;
  }
  return null;
}

function searchForRecipe(node: unknown, depth = 0): unknown | null {
  if (!node || depth > 6) return null;

  if (Array.isArray(node)) {
    for (const child of node) {
      const found = searchForRecipe(child, depth + 1);
      if (found) return found;
    }
    return null;
  }

  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const type = obj["@type"];
    const isRecipe = Array.isArray(type)
      ? type.some((t) => String(t).toLowerCase() === "recipe")
      : String(type ?? "").toLowerCase() === "recipe";
    if (isRecipe) return obj;

    for (const key of ["@graph", "itemListElement", "mainEntity", "mainEntityOfPage"]) {
      if (key in obj) {
        const found = searchForRecipe(obj[key], depth + 1);
        if (found) return found;
      }
    }
  }
  return null;
}

function firstImageFromRecipe(recipe: unknown): string | null {
  const obj = recipe as Record<string, unknown> | null;
  return imageUrlFromUnknown(obj?.image) ?? imageUrlFromUnknown(obj?.thumbnailUrl);
}

/** schema.org image can be a string, ImageObject, or an array of either. */
function imageUrlFromUnknown(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    for (const item of image) {
      const url = imageUrlFromUnknown(item);
      if (url) return url;
    }
    return null;
  }
  if (typeof image === "object") {
    const obj = image as Record<string, unknown>;
    if (typeof obj.url === "string") return obj.url;
    if (typeof obj.contentUrl === "string") return obj.contentUrl;
    return imageUrlFromUnknown(obj.url);
  }
  return null;
}

function stripToText(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<(nav|header|footer|aside|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|li|h[1-6]|tr|br)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim()
    .slice(0, 200_000);
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, " ");
}
