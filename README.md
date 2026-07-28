# Dapur

Household meal planning for two roles: a planner (Olivia) and a cook (the
household helper). Replaces sending recipes over WhatsApp.

**Planner** plans the week, imports recipes, writes notes, rates what was good.
**Cook** opens one bookmarked link, enters a PIN once, and sees what to cook
today, what to buy, and how long it takes.

## The one structural idea

A **Meal** is what gets planned and cooked. A **Recipe** is what gets imported,
reused, and rated. They are different objects — which is why "mie ayam + sambal"
is one meal with two recipes, and each recipe keeps its own library status.

Two kinds of notes, deliberately separated:

- **Standing notes** live on the recipe ("jangan pedas"). Written once, they
  resurface every single time it's cooked.
- **Today notes** live on the meal ("ada tamu, buat 6 porsi"). One-off.

## Stack

Vite 5 + React 18 + TypeScript + Tailwind + react-router, Supabase, PWA.
Deployed to GitHub Pages. Same shape as [amplop](https://github.com/stevenwilson614/amplop).

Supabase project `vqvknxpbdbqlibzhqutz` (Singapore), all tables prefixed
`kitchen_`. Shares the instance with Amplop; nothing touches those tables.

## Roles and access

The planner signs in with email + password. The cook has **no account**: she
opens `#/masak/masuk?k=<link_token>` and enters a 4-digit PIN. The `cook-access`
edge function verifies the PIN server-side (PBKDF2, throttled after 8 tries)
and binds that device's *anonymous* Supabase auth user to the household as
`role: 'cook'`. From there RLS is the ordinary "is this user a member" check.

The cook can read her household, mark meals cooked (via RPC), and manage the
shopping list. She cannot create, edit, or delete recipes, meals, or verdicts.

Requires **anonymous sign-ins enabled** in the project's auth settings.

## Recipe import

One edge function, `recipe-import`, takes a URL, pasted text, or a photo:

| Input | Model | Why |
|---|---|---|
| URL, pasted text | `deepseek-v4-flash` | ~$0.008/import; its 1M context means raw stripped HTML goes straight in, no page cleaner needed |
| Photo, screenshot | Claude (`ANTHROPIC_MODEL`) | DeepSeek V4 is text-only, so images have no other path |

Extraction, translation to Indonesian, and tag suggestions all happen in a
single call. URLs try schema.org JSON-LD first — most recipe sites have it, and
when present the model only has to translate.

Set `TEXT_PROVIDER=claude` to A/B the Indonesian against DeepSeek's.

### Required secrets

```bash
supabase secrets set DEEPSEEK_API_KEY=... ANTHROPIC_API_KEY=... --project-ref vqvknxpbdbqlibzhqutz
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
supabase functions deploy recipe-import cook-access --project-ref vqvknxpbdbqlibzhqutz
```

Migrations in `supabase/migrations/` are applied in order.
