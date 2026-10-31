-- Synthetic disposable DB only: model the observed managed namespace authority.
set local role supabase_admin;
alter schema auth owner to supabase_admin;
revoke all on schema auth from postgres;
grant usage on schema auth to postgres;
set local role postgres;
