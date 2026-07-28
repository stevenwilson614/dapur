import { createClient } from "npm:@supabase/supabase-js@^2.49.4";

/**
 * cook-access — the helper's entire sign-in.
 *
 *   { action: "set_pin", household_id, pin }   planner sets/changes the PIN
 *   { action: "login", link_token, pin }       binds this device to the household
 *
 * The cook never gets a password. She opens a link (which carries an opaque
 * household token), types four digits, and this function binds her device's
 * anonymous auth user to the household as a cook. From then on RLS is the
 * ordinary "is this user a member" check and her session refreshes itself.
 *
 * The PIN is checked here rather than in the browser because the browser bundle
 * is public — a client-side check is decoration, not a gate.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ATTEMPTS = 8;
const LOCKOUT_MINUTES = 15;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

async function hashPin(pin: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100_000,
      hash: "SHA-256",
    },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Comparison in constant time — a four-digit space deserves no timing hints. */
function sameHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST saja" }, 405);

  let payload: {
    action?: string;
    household_id?: string;
    link_token?: string;
    pin?: string;
  };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Body bukan JSON" }, 400);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await asUser.auth.getUser();
  if (!user) return json({ error: "Belum masuk" }, 401);

  if (payload.action === "set_pin") {
    return await setPin(user.id, payload.household_id, payload.pin);
  }
  if (payload.action === "login") {
    return await login(user.id, payload.link_token, payload.pin);
  }
  return json({ error: "action tidak dikenal" }, 400);
});

async function setPin(userId: string, householdId?: string, pin?: string) {
  if (!householdId || !pin || !/^\d{4}$/.test(pin)) {
    return json({ error: "PIN harus 4 angka" }, 400);
  }

  const db = admin();

  // Only a planner of this household may set its PIN.
  const { data: member } = await db
    .from("kitchen_members")
    .select("role")
    .eq("household_id", householdId)
    .eq("user_id", userId)
    .maybeSingle();

  if (member?.role !== "planner") {
    return json({ error: "Tidak berhak mengubah PIN" }, 403);
  }

  const salt = crypto.randomUUID();
  const hash = await hashPin(pin, salt);

  const { error } = await db
    .from("kitchen_households")
    .update({
      cook_pin_hash: hash,
      cook_pin_salt: salt,
      pin_fail_count: 0,
      pin_locked_until: null,
    })
    .eq("id", householdId);

  if (error) return json({ error: error.message }, 500);
  return json({ ok: true });
}

async function login(userId: string, linkToken?: string, pin?: string) {
  if (!linkToken || !pin || !/^\d{4}$/.test(pin)) {
    return json({ error: "PIN harus 4 angka" }, 400);
  }

  const db = admin();

  const { data: household } = await db
    .from("kitchen_households")
    .select("id, cook_pin_hash, cook_pin_salt, pin_fail_count, pin_locked_until")
    .eq("link_token", linkToken)
    .maybeSingle();

  // Same message whether the token or the PIN was wrong — no probing.
  if (!household?.cook_pin_hash || !household.cook_pin_salt) {
    return json({ error: "PIN salah" }, 403);
  }

  if (household.pin_locked_until && new Date(household.pin_locked_until) > new Date()) {
    return json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, 429);
  }

  const candidate = await hashPin(pin, household.cook_pin_salt);
  if (!sameHash(candidate, household.cook_pin_hash)) {
    const fails = (household.pin_fail_count ?? 0) + 1;
    await db
      .from("kitchen_households")
      .update({
        pin_fail_count: fails,
        pin_locked_until: fails >= MAX_ATTEMPTS
          ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000).toISOString()
          : null,
      })
      .eq("id", household.id);
    return json({ error: "PIN salah" }, 403);
  }

  // Correct PIN. Bind this device as a cook — but never downgrade an existing
  // planner: Olivia opening her own cook link to check it would otherwise
  // demote herself out of her own household.
  const { data: existing } = await db
    .from("kitchen_members")
    .select("role")
    .eq("household_id", household.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!existing) {
    const { error } = await db
      .from("kitchen_members")
      .insert({ household_id: household.id, user_id: userId, role: "cook" });
    if (error) return json({ error: error.message }, 500);
  }

  await db
    .from("kitchen_households")
    .update({ pin_fail_count: 0, pin_locked_until: null })
    .eq("id", household.id);

  return json({
    ok: true,
    household_id: household.id,
    role: existing?.role ?? "cook",
  });
}
