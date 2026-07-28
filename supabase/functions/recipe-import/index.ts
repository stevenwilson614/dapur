import { createClient } from "npm:@supabase/supabase-js@^2.49.4";
import { fetchPage } from "./extract.ts";
import { structureFromImage, structureFromText, type ImportedRecipe } from "./providers.ts";

/**
 * recipe-import — one entry point, four inputs, one output shape.
 *
 *   { url }                    a recipe blog / Cookpad page
 *   { text }                   a pasted WhatsApp forward
 *   { image, media_type }      a photo of a cookbook page or a screenshot
 *
 * API keys live here as edge secrets and never reach the browser: the bundle is
 * served publicly from GitHub Pages, so an inlined key is a leaked key.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST saja" }, 405);

  // Must be a signed-in member of some household — planner or cook.
  const authHeader = req.headers.get("Authorization") ?? "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return json({ error: "Belum masuk" }, 401);

  let payload: { url?: string; text?: string; image?: string; media_type?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body bukan JSON" }, 400);
  }

  try {
    let recipe: ImportedRecipe;
    let heroImage: string | null = null;
    let sourceUrl: string | null = null;

    if (payload.image) {
      const mediaType = payload.media_type ?? "image/jpeg";
      if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType)) {
        return json({ error: "Format gambar tidak didukung" }, 400);
      }
      // base64 inflates by ~4/3; guard before handing it to the model.
      if (payload.image.length * 0.75 > MAX_IMAGE_BYTES) {
        return json({ error: "Gambar terlalu besar (maksimal 6MB)" }, 400);
      }
      recipe = await structureFromImage(payload.image, mediaType);
    } else if (payload.url) {
      const url = safeUrl(payload.url);
      if (!url) return json({ error: "Link tidak valid" }, 400);
      sourceUrl = url;
      const page = await fetchPage(url);
      heroImage = page.heroImage;
      recipe = await structureFromText(page.text, url);
    } else if (payload.text) {
      const text = payload.text.slice(0, 200_000).trim();
      if (!text) return json({ error: "Teks kosong" }, 400);
      recipe = await structureFromText(text);
    } else {
      return json({ error: "Butuh url, text, atau image" }, 400);
    }

    // Store the hero image so the recipe survives the source rotting or
    // blocking hotlinks. Best effort — a missing photo is not a failed import.
    const storedImage = heroImage ? await mirrorImage(heroImage) : null;

    return json({
      ...recipe,
      hero_image_url: storedImage ?? heroImage,
      source_url: sourceUrl,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Gagal membaca resep";
    console.error("recipe-import failed:", message);
    return json({ error: message }, 502);
  }
});

function safeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    // Don't let a pasted link make the function fetch internal addresses.
    const host = url.hostname.toLowerCase();
    if (
      host === "localhost" ||
      host.endsWith(".local") ||
      /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host === "[::1]"
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

async function mirrorImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return null;

    const type = res.headers.get("content-type") ?? "image/jpeg";
    if (!type.startsWith("image/")) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength > MAX_IMAGE_BYTES) return null;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const ext = type.split("/")[1]?.split(";")[0] ?? "jpg";
    const path = `recipes/${crypto.randomUUID()}.${ext}`;

    const { error } = await admin.storage
      .from("kitchen")
      .upload(path, bytes, { contentType: type, upsert: false });
    if (error) return null;

    return admin.storage.from("kitchen").getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}
