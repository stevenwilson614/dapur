/**
 * Hero images mirrored by recipe-import used to get `http://kong:8000/...`
 * public URLs (the in-cluster Supabase URL). Rewrite those so the browser
 * can actually load them.
 */
export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (
      parsed.hostname === "kong" ||
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".internal")
    ) {
      const base = String(import.meta.env.VITE_SUPABASE_URL ?? "").replace(/\/$/, "");
      if (!base) return null;
      return `${base}${parsed.pathname}${parsed.search}`;
    }
    return url;
  } catch {
    return url;
  }
}
