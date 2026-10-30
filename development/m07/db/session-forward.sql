-- Canonical auth.sessions columns were read-only discovered before authoring:
-- tracking/evidence/m07/2026-10-30-canonical-auth-settings-discovery.json.
-- Local candidate only. Standard provider revokeGrant deletes client sessions;
-- actual OAuth configuration/client revocation acceptance remains unverified.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';
do $$begin
 if current_user<>'postgres'or current_setting('eps.m07_candidate_tests',true)is distinct from'owned-local29'
 or current_database()!~'^eps_m07_settings_[a-f0-9]{32}$'
 or(select count(*)from supabase_migrations.schema_migrations)<>28
 or to_regclass('auth.sessions')is null or to_regclass('eps.mcp_oauth_resources')is not null
 or exists(select 1 from pg_roles where rolname='eps_mcp_session_owner')
 then raise exception'M07_SESSION_EXACT_OWNED_LOCAL28_REQUIRED';end if;
 if exists(select 1 from(values('id','uuid'),('user_id','uuid'),('oauth_client_id','uuid'),('not_after','timestamp with time zone'),('scopes','text'))v(name,type)
 where not exists(select 1 from pg_attribute where attrelid='auth.sessions'::regclass and attname=v.name and format_type(atttypid,atttypmod)=v.type and not attisdropped))
 then raise exception'M07_DISCOVERED_SESSION_COLUMNS_REQUIRED';end if;
end$$;
create role eps_mcp_session_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_mcp_session_owner to postgres;
grant authenticated to eps_mcp_session_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_mcp_session_owner;
grant select(id,user_id,oauth_client_id,not_after,scopes)on auth.sessions to eps_mcp_session_owner;
create table eps.mcp_oauth_resources(
 resource text not null check(length(resource)between 1 and 2048 and resource!~'[[:cntrl:][:space:]]'
  and(resource~'^https://[^/@?#]+(/[^?#]*)?$'or resource~'^http://(127\.0\.0\.1|localhost|\[::1\])(:[0-9]{1,5})?/mcp$')),
 client_id uuid not null,enabled boolean not null default false,
 primary key(resource,client_id)
);
comment on table eps.mcp_oauth_resources is 'Operator-owned resource/client enablement, initially empty. No public writer or provider configuration. Signed delegation and current session/capabilities are independently required.';
alter table eps.mcp_oauth_resources enable row level security;alter table eps.mcp_oauth_resources force row level security;
revoke all on eps.mcp_oauth_resources from public,anon,authenticated,service_role;
grant select on eps.mcp_oauth_resources to eps_mcp_session_owner;
create policy mcp_resources_for_own_session on eps.mcp_oauth_resources for select to eps_mcp_session_owner using(auth.uid()is not null);

create function eps.mcp_claim_uuid(p_name text)returns uuid language sql stable security invoker set search_path=''as $$
 select case when p_name in('session_id','client_id')and jsonb_typeof(auth.jwt()->p_name)='string'
  and auth.jwt()->>p_name~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then(auth.jwt()->>p_name)::uuid else null end
$$;
grant create on schema eps to eps_mcp_session_owner;
alter function eps.mcp_claim_uuid(text)owner to eps_mcp_session_owner;
revoke create on schema eps from eps_mcp_session_owner;
revoke all on function eps.mcp_claim_uuid(text)from public,anon,authenticated,service_role;
-- A dedicated NOLOGIN owner can SELECT only its caller's exact signed session.
-- No existing managed policy, ownership, FORCE flag or client role is changed.
create policy eps_mcp_own_session on auth.sessions for select to eps_mcp_session_owner
 using(user_id=(select auth.uid())and id=(select eps.mcp_claim_uuid('session_id'))and oauth_client_id=(select eps.mcp_claim_uuid('client_id')));

create function public.eps_validate_own_oauth_session(p_resource text)returns jsonb language plpgsql stable security definer set search_path=''as $$
declare claims jsonb:=auth.jwt();principal uuid:=auth.uid();sid uuid:=eps.mcp_claim_uuid('session_id');cid uuid:=eps.mcp_claim_uuid('client_id');delegation jsonb;inactive jsonb;capabilities jsonb;now_epoch numeric:=extract(epoch from clock_timestamp());begin
 inactive:=jsonb_build_object('active',false,'principal_id',principal,'session_id',sid,'client_id',cid,'capabilities','[]'::jsonb);
 if principal is null or sid is null or cid is null or claims->>'role'is distinct from'authenticated'or claims->'is_anonymous'is distinct from'false'::jsonb
 or p_resource is null or length(p_resource)not between 1 and 2048 or jsonb_typeof(claims->'aud')is distinct from'string'or claims->>'aud'is distinct from p_resource
 then return inactive;end if;
 -- Numeric bounds and types precede casts. This projection is not a signature
 -- verifier: PostgREST verifies JWTs and the resource gate verifies them again.
 if jsonb_typeof(claims->'exp')is distinct from'number'or claims->>'exp'!~'^[0-9]{1,12}$'
 or jsonb_typeof(claims->'iat')is distinct from'number'or claims->>'iat'!~'^[0-9]{1,12}$'then return inactive;end if;
 if(claims->>'exp')::numeric<=now_epoch or(claims->>'iat')::numeric>now_epoch then return inactive;end if;
 if claims?'nbf'then
  if jsonb_typeof(claims->'nbf')is distinct from'number'or claims->>'nbf'!~'^[0-9]{1,12}$'then return inactive;end if;
  if(claims->>'nbf')::numeric>now_epoch then return inactive;end if;
 end if;
 if not'openid'=any(regexp_split_to_array(coalesce(claims->>'scope',''),E'\\s+'))then return inactive;end if;
 delegation:=claims->'eps_delegation';
 if jsonb_typeof(delegation)is distinct from'object'then return inactive;end if;
 if(select count(*)from jsonb_object_keys(delegation))<>4 or delegation->'v'is distinct from'1'::jsonb
 or delegation->>'resource'is distinct from p_resource or delegation->>'client_id'is distinct from cid::text
 or jsonb_typeof(delegation->'capabilities')is distinct from'array'then return inactive;end if;
 if jsonb_array_length(delegation->'capabilities')not between 1 and 32
 or exists(select 1 from jsonb_array_elements(delegation->'capabilities')v where jsonb_typeof(v)<>'string'or v#>>'{}'not in('projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review','presentations.generate','review_links.manage','settings.manage','operations.read','operations.retry'))then return inactive;end if;
 if not exists(select 1 from eps.mcp_oauth_resources where resource=p_resource and client_id=cid and enabled)
 or not exists(select 1 from auth.sessions where id=sid and user_id=principal and oauth_client_id=cid and(not_after is null or not_after>clock_timestamp())and'openid'=any(regexp_split_to_array(coalesce(scopes,''),E'\\s+')))
 then return inactive;end if;
 select coalesce(jsonb_agg(capability order by capability),'[]'::jsonb)into capabilities from public.app_capability_grants g
 where g.principal_id=principal and g.active and delegation->'capabilities'?g.capability;
 return jsonb_build_object('active',true,'principal_id',principal,'session_id',sid,'client_id',cid,'capabilities',capabilities);
end$$;
grant create on schema public to eps_mcp_session_owner;
alter function public.eps_validate_own_oauth_session(text)owner to eps_mcp_session_owner;
revoke create on schema public from eps_mcp_session_owner;
revoke all on function public.eps_validate_own_oauth_session(text)from public,anon,authenticated,service_role;
grant execute on function public.eps_validate_own_oauth_session(text)to authenticated;

-- Bind delegated tokens at the shared SQL permission boundary as well as MCP.
-- Otherwise a client could call a public business RPC directly with its token.
create function eps.mcp_token_permits_capability(p_capability text)returns boolean language plpgsql stable security definer set search_path=''as $$
declare claims jsonb:=auth.jwt();cid uuid:=eps.mcp_claim_uuid('client_id');state jsonb;begin
 if not(claims?'eps_delegation')and not exists(select 1 from eps.mcp_oauth_resources where client_id=cid)then return true;end if;
 state:=public.eps_validate_own_oauth_session(claims#>>'{eps_delegation,resource}');
 return state->'active'='true'::jsonb and state->'capabilities'?p_capability;
end$$;
grant create on schema eps to eps_mcp_session_owner;
alter function eps.mcp_token_permits_capability(text)owner to eps_mcp_session_owner;
revoke create on schema eps from eps_mcp_session_owner;
revoke all on function eps.mcp_token_permits_capability(text)from public,anon,authenticated,service_role;
grant execute on function eps.mcp_token_permits_capability(text)to authenticated;
do $forward$declare source text;definition text;replacement text;begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid='eps.has_capability(text)'::regprocedure;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'35af18435653ebb4249711e926d342e25adab1d9adb029079c38b27a0297bd7f'then raise exception'M07_HAS_CAPABILITY_SOURCE28_REQUIRED';end if;
 replacement:=source||E'    and eps.mcp_token_permits_capability(p_capability)\n';
 execute replace(definition,source,replacement);
end$forward$;
