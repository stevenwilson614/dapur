-- Passwordless profile picker: each member who should get a button on the
-- entry screen carries a fixed public `login_key` ("olivia", "lain"). The
-- `home-login` edge function resolves the key to that member's account
-- server-side and mints a session via a magic-link token it redeems itself,
-- so the browser never handles a password or a PIN. The key is not a secret
-- — it's just which name is on the button — the entry screen only ever
-- offers keys that already exist in this table.

alter table kitchen_members
  add column if not exists login_key text unique;

comment on column kitchen_members.login_key is
  'Public profile key shown on the entry screen (e.g. olivia, lain). Null = no button for this member.';
