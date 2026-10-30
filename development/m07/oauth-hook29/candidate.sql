-- LOCAL-ONLY issuer candidate. No Auth hook registration or actual migration.
-- Event contract: Supabase Auth v2.197.0, commit4eee58f296d9698a1c2c0ae14d7a0b379c7622d3.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';
do $$begin
 if current_user<>'postgres'
 or current_database()!~'^eps_m07_hook29_[a-f0-9]{32}$'
 or current_setting('eps.m07_issuer_tests',true)is distinct from'owned-local-hook29'
 or coalesce((select shobj_description(oid,'pg_database')from pg_database where datname=current_database()),'')!~'^eps-m07-owned-hook29:[a-f0-9-]{36}$'
 or(select count(*)from supabase_migrations.schema_migrations)<>29
 or to_regclass('eps.mcp_oauth_resources')is null or to_regclass('eps.app_settings')is null
 or to_regprocedure('public.eps_validate_own_oauth_session(text)')is null
 or to_regprocedure('eps.mcp_custom_access_token_hook(jsonb)')is not null
 or exists(select 1 from pg_roles where rolname='eps_mcp_issuer_owner')
 then raise exception'HOOK29_EXACT_OWNED_CURRENT29_REQUIRED';end if;
 if exists(select 1 from(values('eps.mcp_oauth_resources','resource','text'),('eps.mcp_oauth_resources','client_id','uuid'),('eps.mcp_oauth_resources','enabled','boolean'),
 ('public.app_capability_grants','principal_id','uuid'),('public.app_capability_grants','capability','text'),('public.app_capability_grants','active','boolean'))v(relation,column_name,type_name)
 where not exists(select 1 from pg_attribute where attrelid=v.relation::regclass and attname=v.column_name and format_type(atttypid,atttypmod)=v.type_name and not attisdropped))
 or exists(select 1 from pg_class where oid in('eps.mcp_oauth_resources'::regclass,'public.app_capability_grants'::regclass)and(not relrowsecurity or not relforcerowsecurity))
 then raise exception'HOOK30_REVIEWED_REGISTRY_CAPABILITY_COLUMNS_AND_FORCED_RLS_REQUIRED';end if;
end$$;

create role eps_mcp_issuer_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant eps_mcp_issuer_owner to postgres with inherit false,set true,admin false;
grant usage on schema eps,public to eps_mcp_issuer_owner;
grant select(resource,client_id,enabled)on eps.mcp_oauth_resources to eps_mcp_issuer_owner;
grant select(principal_id,capability,active)on public.app_capability_grants to eps_mcp_issuer_owner;
-- Native Auth has no acting-user JWT here. The private hook validates the event
-- principal and filters that exact UUID; this dedicated role reads metadata only.
create policy mcp_issuer_resource_lookup on eps.mcp_oauth_resources for select to eps_mcp_issuer_owner using(true);
create policy mcp_issuer_capability_lookup on public.app_capability_grants for select to eps_mcp_issuer_owner using(true);

create function eps.mcp_custom_access_token_hook(event jsonb)returns jsonb
language plpgsql stable security definer set search_path=''as $$
declare claims jsonb;cid_text text;cid uuid;uid uuid;resource_uri text;enabled_count bigint;caps jsonb;begin
 if jsonb_typeof(event)is distinct from'object'or jsonb_typeof(event->'claims')is distinct from'object'
 then raise exception'MCP_DELEGATION_UNAVAILABLE';end if;
 claims:=event->'claims';
 -- Only trusted issuer claims select a registered client. Preserve all browser
 -- and unrelated OAuth claims, including optional fields, without alteration.
 if jsonb_typeof(claims->'client_id')is distinct from'string'
 or claims->>'client_id'!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 then return jsonb_build_object('claims',claims);end if;
 cid_text:=claims->>'client_id';cid:=cid_text::uuid;
 if not exists(select 1 from eps.mcp_oauth_resources r where r.client_id=cid)
 then return jsonb_build_object('claims',claims);end if;
 select count(*),min(r.resource)into enabled_count,resource_uri from eps.mcp_oauth_resources r where r.client_id=cid and r.enabled;
 if enabled_count<>1
 or not(claims?&array['iss','aud','exp','iat','sub','role','aal','session_id','email','phone','is_anonymous'])
 or jsonb_typeof(event->'user_id')is distinct from'string'
 or event->>'user_id'!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 or jsonb_typeof(claims->'sub')is distinct from'string'
 or claims->>'sub'!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 or claims->>'role'is distinct from'authenticated'or claims->'is_anonymous'is distinct from'false'::jsonb
 or jsonb_typeof(claims->'session_id')is distinct from'string'
 or claims->>'session_id'!~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
 or jsonb_typeof(claims->'scope')is distinct from'string'
 or length(claims->>'scope')>256
 or not('openid'=any(regexp_split_to_array(claims->>'scope',E'\\s+')))
 then raise exception'MCP_DELEGATION_UNAVAILABLE';end if;
 uid:=(event->>'user_id')::uuid;
 if (claims->>'sub')::uuid<>uid then raise exception'MCP_DELEGATION_UNAVAILABLE';end if;
 -- No auth.uid(), own-session RPC, caller business-capability claim, user
 -- metadata, client name or top-level client_id is authority at issuance.
 select coalesce(jsonb_agg(g.capability order by g.capability),'[]'::jsonb)into caps
 from public.app_capability_grants g where g.principal_id=uid and g.active
 and g.capability=any(array['projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review',
 'presentations.generate','review_links.manage','settings.manage','operations.read','operations.retry']);
 claims:=jsonb_set(claims,'{aud}',to_jsonb(resource_uri));
 claims:=jsonb_set(claims,'{eps_delegation}',jsonb_build_object('v',1,'resource',resource_uri,'client_id',cid::text,'capabilities',caps));
 return jsonb_build_object('claims',claims);
end$$;
-- PostgreSQL requires CREATE on the containing schema for ownership transfer.
-- The role cannot log in; this grant exists only inside this transaction.
grant create on schema eps to eps_mcp_issuer_owner;
alter function eps.mcp_custom_access_token_hook(jsonb)owner to eps_mcp_issuer_owner;
set local role eps_mcp_issuer_owner;
revoke all on function eps.mcp_custom_access_token_hook(jsonb)from public,anon,authenticated,service_role,postgres;
grant execute on function eps.mcp_custom_access_token_hook(jsonb)to supabase_auth_admin;
comment on function eps.mcp_custom_access_token_hook(jsonb)is 'LOCAL-only candidate: claims-preserving approved-client resource delegation for native Auth. Not registered as any provider hook.';
set local role postgres;
revoke create on schema eps from eps_mcp_issuer_owner;
grant usage on schema eps to supabase_auth_admin;
