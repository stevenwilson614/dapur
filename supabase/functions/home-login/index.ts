import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@^2.49.4";

/**
 * home-login — the entire sign-in for this app: tap a name, done.
 *
 * There is one household. Each member who should get an entry button carries
 * a `login_key` (kitchen_members.login_key) — a public label like "olivia" or
 * "lain", not a secret. Tapping it asks this function to mint a session for
 * that member: a magic-link token generated and redeemed server-side, so the
 * browser never sees a password, a PIN, or the member's email. The safety
 * property is narrower than a password: anyone who can load the app can sign
 * in as any member listed here. That's the deliberate trade for a household
 * of two people sharing one kitchen tablet.
 *
 *   POST {}                    -> list available profiles
 *   POST { profile: "olivia" } -> mint + redeem a session for that member
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST saja" }, 405);

  let payload: { profile?: string };
  try {
    payload = await req.json();
  } catch {
    payload = {};
  }

  const db = admin();

  if (!payload.profile) {
    const { data, error } = await db
      .from("kitchen_members")
      .select("login_key, display_name, role")
      .not("login_key", "is", null)
      .order("role", { ascending: false }); // planner before cook
    if (error) return json({ error: error.message }, 500);
    return json({ profiles: data ?? [] });
  }

  const key = payload.profile.trim().toLowerCase();
  const { data: member, error: mErr } = await db
    .from("kitchen_members")
    .select("user_id, role, display_name")
    .eq("login_key", key)
    .maybeSingle();
  if (mErr) return json({ error: mErr.message }, 500);
  if (!member) return json({ error: "Profil tidak dikenal" }, 404);

  const { data: authUser, error: uErr } = await db.auth.admin.getUserById(member.user_id);
  if (uErr || !authUser?.user?.email) return json({ error: "Akun tidak ditemukan" }, 500);

  return await issueSession(db, authUser.user.email, member);
});

async function issueSession(
  admin: SupabaseClient,
  email: string,
  member: { role: string; display_name: string | null },
) {
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) return json({ error: linkErr.message }, 500);

  const tokenHash = linkData.properties?.hashed_token;
  if (!tokenHash) return json({ error: "Tidak bisa membuat sesi" }, 500);

  const anon = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data: sessionData, error: vErr } = await anon.auth.verifyOtp({
    token_hash: tokenHash,
    type: "email",
  });
  if (vErr || !sessionData.session) return json({ error: "Tidak bisa membuat sesi" }, 500);

  return json({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
    role: member.role,
    display_name: member.display_name,
  });
}
