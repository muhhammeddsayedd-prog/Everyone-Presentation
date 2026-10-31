-- Synthetic disposable database only; never run against canonical/local app DB.
create schema auth;create schema eps;create schema supabase_migrations;
create type auth.oauth_authorization_status as enum('pending','approved','denied','expired');
create table supabase_migrations.schema_migrations(version text primary key);
-- Synthetic prerequisite version labels only; this disposable DB is not a replay.
insert into supabase_migrations.schema_migrations select unnest(array[
 '20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320',
 '20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600',
 '20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218',
 '20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000']);
create function auth.jwt()returns jsonb language sql stable as $$select nullif(current_setting('request.jwt.claims',true),'')::jsonb$$;
create function auth.uid()returns uuid language sql stable as $$select(auth.jwt()->>'sub')::uuid$$;
grant usage on schema auth to authenticated,anon,service_role;
create table auth.sessions(id uuid primary key,user_id uuid not null,oauth_client_id uuid,not_after timestamptz);
alter table auth.sessions enable row level security;
create policy preserved_auth_session_policy on auth.sessions for select to authenticated using(false);
create table auth.oauth_clients(id uuid primary key,redirect_uris text not null,client_name text,client_uri text,logo_uri text,deleted_at timestamptz,client_secret_hash text);
create table auth.oauth_authorizations(authorization_id text primary key,client_id uuid not null,user_id uuid,redirect_uri text not null,scope text not null,resource text,status auth.oauth_authorization_status not null default'pending',expires_at timestamptz not null,authorization_code text,state text,code_challenge text);
create table eps.mcp_oauth_resources(resource text not null,client_id uuid not null,enabled boolean not null default false,primary key(resource,client_id));
alter table eps.mcp_oauth_resources enable row level security;alter table eps.mcp_oauth_resources force row level security;
revoke all on auth.sessions,auth.oauth_clients,auth.oauth_authorizations,eps.mcp_oauth_resources from public,authenticated,anon,service_role;
insert into auth.sessions values
 ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001',null,clock_timestamp()+interval'1 hour'),
 ('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001',null,clock_timestamp()+interval'1 hour'),
 ('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002',null,clock_timestamp()+interval'1 hour');
insert into auth.oauth_clients values('30000000-0000-4000-8000-000000000001','http://localhost:3118/callback','Synthetic approved client',null,null,null,'synthetic-unreadable-secret');
insert into eps.mcp_oauth_resources values('https://studio.example.invalid/mcp','30000000-0000-4000-8000-000000000001',true);
insert into auth.oauth_authorizations(authorization_id,client_id,redirect_uri,scope,resource,expires_at,authorization_code,state,code_challenge)
 select repeat(chr(97+i),32),'30000000-0000-4000-8000-000000000001','http://localhost:3118/callback','openid',null,clock_timestamp()+interval'1 hour','synthetic-unreadable-code','synthetic-unreadable-state','synthetic-unreadable-challenge'from generate_series(0,15)i;
create function public.consent_test_assert(ok boolean,label text)returns void language plpgsql as $$begin if ok is distinct from true then raise exception'CONSENT_TEST_FAILED:%',label;end if;end$$;
create function public.consent_test_reject(statement text,label text)returns void language plpgsql as $$declare caught boolean:=false;begin begin execute statement;exception when sqlstate'28000'or sqlstate'22023'or insufficient_privilege then caught:=true;end;perform public.consent_test_assert(caught,label);end$$;
create temp table consent_test_values(name text primary key,value jsonb);
grant all on consent_test_values to authenticated;
