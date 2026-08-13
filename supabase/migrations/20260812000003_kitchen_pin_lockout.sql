-- The cook-access function records failed PIN attempts and temporarily locks
-- the cook link after repeated failures. These fields intentionally live on
-- the household, because the PIN belongs to the household rather than a user.

alter table kitchen_households
  add column if not exists pin_fail_count integer not null default 0,
  add column if not exists pin_locked_until timestamptz;
