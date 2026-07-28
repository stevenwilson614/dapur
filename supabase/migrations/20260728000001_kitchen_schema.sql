-- Dapur — household meal planning.
-- All tables are prefixed `kitchen_` because this project is shared with Amplop
-- (budget) in the same Postgres instance. Nothing here touches those tables.

-- ---------------------------------------------------------------- households

create table if not exists kitchen_households (
  id                uuid primary key default gen_random_uuid(),
  name              text not null default 'Dapur',
  -- Cook access: a link token in the URL + a PIN. Hash and salt are computed in
  -- the edge function (Web Crypto), never in the browser and never in the DB.
  link_token        text not null unique default replace(gen_random_uuid()::text, '-', ''),
  cook_pin_hash     text,
  cook_pin_salt     text,
  -- Which slots this household actually uses. Breakfast is off by default.
  slots             text[] not null default array['makan_siang', 'makan_malam', 'camilan'],
  default_servings  int  not null default 4,
  show_read_receipt boolean not null default false,
  timezone          text not null default 'Asia/Jakarta',
  created_at        timestamptz not null default now()
);

create table if not exists kitchen_members (
  household_id  uuid not null references kitchen_households(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('planner', 'cook')),
  display_name  text,
  created_at    timestamptz not null default now(),
  primary key (household_id, user_id)
);

create index if not exists kitchen_members_user_idx on kitchen_members(user_id);

-- ------------------------------------------------------------------- recipes

create table if not exists kitchen_recipes (
  id              uuid primary key default gen_random_uuid(),
  household_id    uuid not null references kitchen_households(id) on delete cascade,
  title_id        text not null,
  title_en        text,
  source_type     text not null default 'manual'
                    check (source_type in ('url', 'photo', 'paste', 'manual')),
  source_url      text,
  hero_image_url  text,
  servings        int,
  total_minutes   int,
  -- [{qty, unit, item_id, item_en, note, norm_key}]
  ingredients     jsonb not null default '[]'::jsonb,
  -- [{id, en}]
  steps           jsonb not null default '[]'::jsonb,
  -- Standing notes: written once, resurface every single time this is cooked.
  standing_notes  text,
  tags            text[] not null default '{}',
  verdict         text check (verdict in ('keeper', 'no')),
  verdict_at      timestamptz,
  archived        boolean not null default false,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists kitchen_recipes_household_idx on kitchen_recipes(household_id);
create index if not exists kitchen_recipes_tags_idx on kitchen_recipes using gin (tags);

-- --------------------------------------------------------------------- meals

create table if not exists kitchen_meals (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references kitchen_households(id) on delete cascade,
  date          date not null,
  slot          text not null
                  check (slot in ('sarapan', 'makan_siang', 'makan_malam', 'camilan')),
  title         text,
  -- One-off notes for this cooking only. Standing notes live on the recipe.
  notes_today   text,
  status        text not null default 'planned'
                  check (status in ('planned', 'cooked', 'skipped')),
  cooked_at     timestamptz,
  seen_at       timestamptz,
  position      int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists kitchen_meals_household_date_idx
  on kitchen_meals(household_id, date);

-- The multi-recipe join: "mie ayam + sambal" is one meal, two recipes.
create table if not exists kitchen_meal_recipes (
  id            uuid primary key default gen_random_uuid(),
  meal_id       uuid not null references kitchen_meals(id) on delete cascade,
  recipe_id     uuid not null references kitchen_recipes(id) on delete cascade,
  position      int not null default 0,
  portion_note  text,
  unique (meal_id, recipe_id)
);

create index if not exists kitchen_meal_recipes_meal_idx on kitchen_meal_recipes(meal_id);

-- Verdicts are asked once per meal but stored per recipe, so a two-recipe meal
-- gives both recipes their own independent library status from a single tap.
create table if not exists kitchen_feedback (
  id          uuid primary key default gen_random_uuid(),
  meal_id     uuid not null references kitchen_meals(id) on delete cascade,
  recipe_id   uuid not null references kitchen_recipes(id) on delete cascade,
  verdict     text not null check (verdict in ('keep', 'no')),
  comment     text,
  created_at  timestamptz not null default now(),
  unique (meal_id, recipe_id)
);

-- ------------------------------------------------------------------ shopping

-- Check-off state, keyed by the normalized ingredient name for a given week.
create table if not exists kitchen_shopping_state (
  household_id  uuid not null references kitchen_households(id) on delete cascade,
  week_start    date not null,
  norm_key      text not null,
  checked       boolean not null default false,
  updated_at    timestamptz not null default now(),
  primary key (household_id, week_start, norm_key)
);

-- Staples the cook adds herself (rice, oil) — not derived from any recipe.
create table if not exists kitchen_shopping_extras (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references kitchen_households(id) on delete cascade,
  week_start    date not null,
  label         text not null,
  checked       boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists kitchen_shopping_extras_idx
  on kitchen_shopping_extras(household_id, week_start);

-- ------------------------------------------------------------ updated_at

create or replace function kitchen_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kitchen_recipes_touch on kitchen_recipes;
create trigger kitchen_recipes_touch
  before update on kitchen_recipes
  for each row execute function kitchen_touch_updated_at();
