-- SYNTHETIC local prerequisite only. The complete owned29 application schema
-- already exists. These missing native Auth catalogue relations are a model,
-- not the Supabase Auth program, managed migrations, registration or token flow.
-- No migration version labels are inserted by this prerequisite.
do $$begin
 if to_regclass('auth.oauth_clients')is not null or to_regclass('auth.oauth_authorizations')is not null
 or to_regtype('auth.oauth_authorization_status')is not null
 or(select count(*)from auth.users)<>0 or(select count(*)from auth.sessions)<>0
 or has_schema_privilege('postgres','auth','USAGE WITH GRANT OPTION')
 or not has_schema_privilege('postgres','auth','USAGE')
 then raise exception'RECOVERY33_EXACT_EMPTY_NATIVE_PREREQUISITE_REQUIRED';end if;
end$$;
set local role supabase_auth_admin;
create type auth.oauth_authorization_status as enum('pending','approved','denied','expired');
create table auth.oauth_clients(
 id uuid primary key,client_name text,client_uri text,logo_uri text,redirect_uris text not null,
 client_type text not null,token_endpoint_auth_method text not null,grant_types text[]not null,
 response_types text[]not null,registration_type text not null,deleted_at timestamptz,client_secret_hash text
);
create table auth.oauth_authorizations(
 authorization_id text primary key,client_id uuid not null references auth.oauth_clients(id),user_id uuid references auth.users(id),
 redirect_uri text not null,scope text not null,resource text,status auth.oauth_authorization_status not null default'pending',
 expires_at timestamptz not null,authorization_code text,state text,code_challenge text
);
revoke all on auth.oauth_clients,auth.oauth_authorizations from public,anon,authenticated,service_role;
grant all on auth.oauth_clients,auth.oauth_authorizations to postgres;
comment on table auth.oauth_clients is 'Synthetic recovery33 native catalogue subset; no real registration or provider secret.';
comment on table auth.oauth_authorizations is 'Synthetic recovery33 native catalogue subset; no real authorization or token flow.';
set local role postgres;
