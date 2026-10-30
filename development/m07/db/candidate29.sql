-- M07 additive settings/defaults and constrained delegated session29 after exact reviewed28.
-- No Auth identities/client registration/hooks, secrets, flags, cloud fixtures, seeds or historical-version updates.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';
do $m07_history$begin if current_user<>'postgres'or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600','20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218','20261030002634','20261030004643','20261030013832','20261030030717']::text[]then raise exception'M07_EXACT_REVIEWED28_REQUIRED';end if;end$m07_history$;

-- Guarded component: development/m07/db/settings-forward.sql
-- M07 additive LOCAL development candidate on exact history28. Not promoted.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';
do $$begin
 if current_user<>'postgres' or (current_database()<>'postgres'and(current_setting('eps.m07_candidate_tests',true)is distinct from'owned-local29'
 or current_database()!~'^eps_m07_settings_[a-f0-9]{32}$'))
 or(select count(*)from supabase_migrations.schema_migrations)<>28
 or(select max(version)from supabase_migrations.schema_migrations)<>'20261030030717'
 or to_regclass('eps.app_settings')is not null or exists(select 1 from pg_roles where rolname='eps_settings_owner')
 then raise exception'M07_SETTINGS_EXACT_OWNED_LOCAL28_REQUIRED';end if;
end$$;
create role eps_settings_owner nologin noinherit nosuperuser nocreatedb nocreaterole nobypassrls;
grant eps_settings_owner to postgres;
grant authenticated to eps_settings_owner with inherit true,set false,admin false;
grant usage on schema eps,public to eps_settings_owner;
create table eps.app_settings(
 singleton boolean primary key default true check(singleton),
 resource_id uuid not null unique default gen_random_uuid(),
 template_key text not null default'everyone-casting'check(template_key='everyone-casting'),
 template_version text not null default'1.1.0',
 default_timezone text not null default'Africa/Cairo'check(length(default_timezone)between 1 and 100),
 default_review_expiry_days integer not null default 30 check(default_review_expiry_days=30),
 row_version bigint not null default 1 check(row_version between 1 and 9007199254740991),
 updated_at timestamptz not null default clock_timestamp(),
 foreign key(template_key,template_version)references eps.presentation_templates(key,version)on delete restrict
);
alter table eps.app_settings enable row level security;alter table eps.app_settings force row level security;
revoke all on eps.app_settings from public,anon,authenticated,service_role;
insert into eps.app_settings(singleton)values(true);
grant select on eps.app_settings to eps_settings_owner,eps_review_owner;
grant update(template_version,default_timezone,row_version,updated_at)on eps.app_settings to eps_settings_owner;
grant select(key,version,registered)on eps.presentation_templates to eps_settings_owner;
grant select(id,model_version)on eps.specs_pipeline_config to eps_settings_owner;
grant select(id,transcription_model,extraction_model)on eps.candidate_asset_config to eps_settings_owner;
grant select(id,model)on eps.review_processing_config to eps_settings_owner;
grant select,insert on eps.idempotency_records to eps_settings_owner;
grant insert on eps.audit_events to eps_settings_owner;
grant execute on function eps.fail(text,text,integer,bigint),eps.require_capability(text),eps.has_capability(text),eps.check_input(jsonb,text[]),eps.expected_version(jsonb,text),eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid)to eps_settings_owner;
create policy settings_read on eps.app_settings for select to eps_settings_owner using(eps.has_capability('settings.manage'));
create policy settings_update on eps.app_settings for update to eps_settings_owner using(eps.has_capability('settings.manage'))with check(eps.has_capability('settings.manage'));
create policy settings_future_template on eps.app_settings for select to eps_review_owner using(eps.has_capability('presentations.generate')or eps.has_capability('workspaces.read'));
create policy settings_registered_templates on eps.presentation_templates for select to eps_settings_owner using(registered and eps.has_capability('settings.manage'));
create policy settings_specs_model on eps.specs_pipeline_config for select to eps_settings_owner using(id=1 and eps.has_capability('settings.manage'));
create policy settings_candidate_models on eps.candidate_asset_config for select to eps_settings_owner using(id and eps.has_capability('settings.manage'));
create policy settings_wording_model on eps.review_processing_config for select to eps_settings_owner using(id and eps.has_capability('settings.manage'));
create policy settings_idempotency on eps.idempotency_records for all to eps_settings_owner using(principal_id=auth.uid()and operation='settings.update_settings')with check(principal_id=auth.uid()and operation='settings.update_settings');
create policy settings_audit on eps.audit_events for insert to eps_settings_owner with check(principal_id=auth.uid()and action='settings.update_settings');
create policy eps_settings_no_storage on storage.objects as restrictive for all to eps_settings_owner using(false)with check(false);
create policy eps_settings_no_buckets on storage.buckets as restrictive for all to eps_settings_owner using(false)with check(false);

create function eps.settings_timezone_valid(p_value text)returns boolean language sql stable security invoker set search_path=''as $$
 select p_value is not null and length(p_value)between 1 and 100
 and(p_value='UTC'or p_value~'^[A-Za-z_+-]+(/[A-Za-z0-9_+.-]+)+$')and p_value!~'^(posix|right)/'
 and exists(select 1 from pg_catalog.pg_timezone_names where name=p_value)
$$;
create function eps.settings_dto()returns jsonb language sql stable security invoker set search_path=''as $$
 select jsonb_build_object('template_version',s.template_version,'default_timezone',s.default_timezone,
 'default_review_expiry_days',s.default_review_expiry_days,'row_version',s.row_version,
 'models',coalesce((select jsonb_object_agg(name,model)from(
   select'specs'::text name,model_version model from eps.specs_pipeline_config where id=1
   union all select'transcription',transcription_model from eps.candidate_asset_config where id
   union all select'candidate_extraction',extraction_model from eps.candidate_asset_config where id
   union all select'slide_wording',model from eps.review_processing_config where id
 )v where model~'^[A-Za-z0-9._-]{1,200}$'),'{}'::jsonb))from eps.app_settings s where singleton
$$;
create function public.eps_get_settings()returns jsonb language plpgsql stable security definer set search_path=''as $$declare result jsonb;begin
 perform eps.require_capability('settings.manage');result:=eps.settings_dto();
 if result is null then perform eps.fail('DEPENDENCY_UNAVAILABLE','Central app settings are unavailable.',503);end if;return result;
end$$;
create function public.eps_update_settings(p_input jsonb,p_idempotency_key text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare item eps.app_settings;cached jsonb;expected bigint;next_timezone text;next_template text;begin
 perform eps.require_capability('settings.manage');perform eps.check_input(p_input,array['row_version','default_timezone','template_version']);
 expected:=eps.expected_version(p_input);
 if p_idempotency_key is null or length(p_idempotency_key)not between 16 and 200 or p_idempotency_key~'[[:cntrl:]]'then perform eps.fail('IDEMPOTENCY_KEY_REQUIRED','Provide a bounded stable Idempotency-Key.',400);end if;
 -- The generic helper obtains the per-principal/key advisory lock. Recheck live
 -- permission after that wait before returning any previously saved response.
 cached:=eps.idempotency_begin('settings.update_settings',p_idempotency_key,p_input);
 perform eps.require_capability('settings.manage');if cached is not null then return cached;end if;
 select * into item from eps.app_settings where singleton for update;
 perform eps.require_capability('settings.manage');
 if not found or item.singleton is null then perform eps.fail('DEPENDENCY_UNAVAILABLE','Central app settings are unavailable.',503);end if;
 if item.row_version<>expected then perform eps.fail('STALE_RESOURCE_VERSION','Settings changed. Reload before saving.',409,item.row_version);end if;
 next_timezone:=item.default_timezone;next_template:=item.template_version;
 if p_input?'default_timezone'then
  if jsonb_typeof(p_input->'default_timezone')is distinct from'string'or not eps.settings_timezone_valid(p_input->>'default_timezone')then perform eps.fail('INVALID_REQUEST','Select an IANA timezone.',400);end if;
  next_timezone:=p_input->>'default_timezone';
 end if;
 if p_input?'template_version'then
  if jsonb_typeof(p_input->'template_version')is distinct from'string'or p_input->>'template_version'<>'1.1.0'
  or not exists(select 1 from eps.presentation_templates where key=item.template_key and version=p_input->>'template_version'and registered)
  then perform eps.fail('INVALID_REQUEST','Select an approved template supported by the current renderer.',400);end if;
  next_template:=p_input->>'template_version';
 end if;
 if item.row_version=9007199254740991 then perform eps.fail('INVALID_TRANSITION','Settings reached their revision limit.',409);end if;
 update eps.app_settings set default_timezone=next_timezone,template_version=next_template,row_version=row_version+1,updated_at=clock_timestamp()where singleton;
 return eps.finish_mutation('settings.update_settings',p_idempotency_key,p_input,eps.settings_dto(),item.resource_id);
end$$;
grant create on schema eps,public to eps_settings_owner;
alter function eps.settings_timezone_valid(text)owner to eps_settings_owner;
alter function eps.settings_dto()owner to eps_settings_owner;
alter function public.eps_get_settings()owner to eps_settings_owner;
alter function public.eps_update_settings(jsonb,text)owner to eps_settings_owner;
revoke create on schema eps,public from eps_settings_owner;
revoke all on function eps.settings_timezone_valid(text),eps.settings_dto(),public.eps_get_settings(),public.eps_update_settings(jsonb,text)from public,anon,authenticated,service_role;
grant execute on function public.eps_get_settings(),public.eps_update_settings(jsonb,text)to authenticated;

-- Read defaults only when creating a future series. Existing retained series,
-- Ready versions, manifests, PDFs and links are deliberately never rewritten.
do $forward$declare source text;definition text;replacement text;needle text:='version=''1.1.0''and registered;';begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid='public.eps_create_presentation_series(jsonb,text)'::regprocedure;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'30fa983b81ad5ec624f55c3e46eae59f0157179290b91377d049644a1f685f37'
 or(length(source)-length(replace(source,needle,'')))/length(needle)<>1 then raise exception'M07_SERIES_SOURCE28_REQUIRED';end if;
 replacement:=replace(source,needle,'version=(select template_version from eps.app_settings where singleton)and registered;');
 if replacement=source then raise exception'M07_FUTURE_TEMPLATE_CHANGE_MISSING';end if;execute replace(definition,source,replacement);
end$forward$;


-- Guarded component: development/m07/db/session-forward.sql
-- Canonical auth.sessions columns were read-only discovered before authoring:
-- tracking/evidence/m07/2026-10-30-canonical-auth-settings-discovery.json.
-- Local candidate only. Standard provider revokeGrant deletes client sessions;
-- actual OAuth configuration/client revocation acceptance remains unverified.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';
do $$begin
 if current_user<>'postgres'or (current_database()<>'postgres'and(current_setting('eps.m07_candidate_tests',true)is distinct from'owned-local29'
 or current_database()!~'^eps_m07_settings_[a-f0-9]{32}$'))
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


-- Guarded component: development/m07/db/capabilities-default-forward.sql
-- Extend the existing authenticated capability projection with the saved
-- central display default. No full Settings read is granted to ordinary users.
grant select(singleton,default_timezone)on eps.app_settings to eps_api_owner;
create policy capabilities_timezone_default on eps.app_settings for select to eps_api_owner
 using(auth.uid()is not null and coalesce(auth.jwt()->'is_anonymous','false'::jsonb)='false'::jsonb);
do $forward$declare source text;definition text;replacement text;needle text:='''timezone'',''Africa/Cairo''';begin
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid='public.eps_get_capabilities()'::regprocedure;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'e08212ed292c5893688bcdd9ef314a00d74b1d13974af2f7f273acb99ae10d3e'
 or(length(source)-length(replace(source,needle,'')))/length(needle)<>1
 or(length(source)-length(replace(source,'g.active)','')))/length('g.active)')<>1
 then raise exception'M07_CAPABILITIES_SOURCE28_REQUIRED';end if;
 replacement:=replace(source,needle,'''timezone'',(select default_timezone from eps.app_settings where singleton)');
 -- Advertise the same effective delegated authority that the SQL operation
 -- boundary enforces; ordinary browser capabilities remain unchanged.
 replacement:=replace(replacement,'g.active)','g.active and eps.has_capability(g.capability))');
 execute replace(definition,source,replacement);
end$forward$;

