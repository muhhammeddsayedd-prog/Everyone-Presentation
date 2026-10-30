-- EXPLICITLY SYNTHETIC catalogue subset, isolated disposable owned DB only.
-- Actual canonical catalogue was discovered read-only before choosing columns.
-- This is never a production migration, provider registration or live JWT proof.
set local role supabase_auth_admin;
create table auth.sessions(
 id uuid primary key,user_id uuid not null references auth.users(id)on delete cascade,
 oauth_client_id uuid,not_after timestamptz,scopes text,
 user_agent text,refresh_token_hmac_key text
);
alter table auth.sessions enable row level security;
grant select on auth.sessions to postgres with grant option;
set local role postgres;
