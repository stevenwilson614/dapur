# Dapur

Household meal planning for two roles: a planner (Olivia) and a cook (the
household helper). Replaces sending recipes over WhatsApp.

**Planner** (Olivia, English UI) plans the week, imports recipes, writes notes, rates what was good.
**Cook** (Nias, Indonesian UI) sees what to cook today, what to buy, the full recipe book, and how long it takes.
Olivia can flip to Nias’s view with the toggle at the top. Both open the same
bookmarked page and just tap their name — no email, no password, no PIN.

## The one structural idea

A **Meal** is what gets planned and cooked. A **Recipe** is what gets imported,
reused, and rated. They are different objects — which is why "mie ayam + sambal"
is one meal with two recipes, and each recipe keeps its own library status.

Three kinds of notes, deliberately separated:

- **Standing notes** live on the recipe ("jangan pedas"). Written once, they
  resurface every single time it's cooked.
- **Today notes** live on the meal ("ada tamu, buat 6 porsi"). One-off.
- **Cook notes** live on a single ingredient or step. Nia taps + on that line
  if she wants a clarification for next time. They persist on the recipe.

## Stack

Vite 5 + React 18 + TypeScript + Tailwind + react-router, Supabase, PWA.
Deployed to GitHub Pages. Same shape as [amplop](https://github.com/stevenwilson614/amplop).

Self-hosted Supabase at `https://api.larisid.com` (Contabo VPS, Singapore).
All tables prefixed `kitchen_`. Shares the instance with Amplop and LarisID;
nothing here touches those tables. The old cloud project `vqvknxpbdbqlibzhqutz`
is frozen (storage quota) and is not used.

## Roles and access

The entry screen (`#/masuk`) is a name picker, not a form: one button per
household member with a `login_key` set on their `kitchen_members` row
("olivia", "lain" → shown as Nias). Tapping a name calls the `home-login` edge function,
which resolves that key to the member's real Supabase account server-side,
mints a magic-link token, and redeems it itself — the browser only ever
receives the finished session (access + refresh token), never a password,
PIN, or email address. Planner vs. cook routing after login is driven by the
`role` the function returns.

This is a deliberately narrow safety property: anyone who can load the app
can sign in as any member listed on that screen. That's an acceptable trade
for two people sharing one household — it is not multi-tenant-safe, and the
GitHub Pages URL should not be treated as itself private.

Once signed in, cooks get the ordinary RLS "is this user a member" check:
they can read the household, mark meals cooked (via RPC), leave cook notes on
a recipe line (via RPC), and manage the shopping list, but cannot create,
edit, or delete recipes, meals, or verdicts. That part is unchanged from before.

To add or rename a profile button: set `login_key` (and `display_name`) on
the relevant `kitchen_members` row, and add the key to the `PROFILES` list in
`src/pages/WhoLoginPage.tsx`.

## Recipe import

One edge function, `recipe-import`, takes a URL, pasted text, or a photo:

| Input | Model | Why |
|---|---|---|
| URL, pasted text | `deepseek-v4-flash` | ~$0.008/import; its 1M context means raw stripped HTML goes straight in, no page cleaner needed |
| Photo, screenshot | Claude (`ANTHROPIC_MODEL`) | DeepSeek V4 is text-only, so images have no other path |

Extraction, Indonesian for the cook, English for Olivia, and tag suggestions
all happen in a single call. URLs try schema.org JSON-LD first — most recipe
sites have it, and when present the model only has to translate.

Set `TEXT_PROVIDER=claude` to A/B the Indonesian against DeepSeek's.

### Required secrets

```bash
# On the Contabo box, in larisid-infra/docker/.env:
#   DEEPSEEK_API_KEY=...
#   ANTHROPIC_API_KEY=...
# then: docker compose up -d functions
```

Keys live only as edge secrets. The browser bundle is served publicly from
GitHub Pages, so an inlined key is a leaked key.

## Develop

```bash
npm install
npm run dev          # port 5175, app at /dapur/
```

`.env.local` needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Deploy

```bash
npm run build
npm run deploy       # gh-pages
# Edge functions live in larisid-infra/docker/volumes/functions/{recipe-import,home-login}
# On the box: git pull && docker compose restart functions
```

Migrations in `supabase/migrations/` are applied on Contabo via
`docker exec -i supabase-db psql -U postgres`.
