import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const functionsUrl = `${supabaseUrl}/functions/v1`;

/** Call an edge function with the caller's session (falls back to the anon key). */
export async function callFunction<T>(name: string, body: unknown): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(`${functionsUrl}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token ?? supabaseAnonKey}`,
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.slice(0, 200) || `${name} returned a non-JSON response`);
  }

  if (!res.ok) {
    const p = payload as { error?: string; msg?: string };
    throw new Error(p.error || p.msg || `${name} failed (${res.status})`);
  }
  return payload as T;
}
