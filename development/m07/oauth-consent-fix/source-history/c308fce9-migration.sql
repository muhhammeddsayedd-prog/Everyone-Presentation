-- Additive OAuth consent binding/coordination. No provider settings, Auth rows,
-- existing permissions, business records, tokens or signing keys are changed.
-- Discovered canonical metadata: oauth-consent-fix/*-catalogue.json, 2026-10-31.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';
do $$begin
 if current_user<>'postgres'or(current_database()<>'postgres'and not(
   current_database()~'^eps_oauth_consent_[a-f0-9]{32}$'
   and coalesce(current_setting('eps.oauth_consent_test_run',true)~'^[a-f0-9]{32}$',false)
   and current_database()='eps_oauth_consent_'||current_setting('eps.oauth_consent_test_run',true)
   and shobj_description((select oid from pg_database where datname=current_database()),'pg_database')='eps-oauth-consent-owned:'||current_setting('eps.oauth_consent_test_run',true)))
  or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[
   '20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320',
   '20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600',
   '20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218',
   '20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000']::text[]
  or exists(select 1 from pg_roles where rolname='eps_oauth_consent_owner')
  or to_regclass('eps.oauth_consent_claims')is not null
  or to_regprocedure('public.eps_oauth_consent_claim(text,text,text,uuid)')is not null
  or to_regprocedure('public.eps_oauth_consent_finish(text,text,uuid,text)')is not null
 then raise exception'OAUTH_CONSENT_EXACT31_ADDITIVE_TARGET_REQUIRED';end if;
 if exists(select 1 from(values
  ('auth.oauth_authorizations','authorization_id','text'),('auth.oauth_authorizations','client_id','uuid'),
  ('auth.oauth_authorizations','user_id','uuid'),('auth.oauth_authorizations','redirect_uri','text'),
  ('auth.oauth_authorizations','scope','text'),('auth.oauth_authorizations','resource','text'),
  ('auth.oauth_authorizations','status','auth.oauth_authorization_status'),('auth.oauth_authorizations','expires_at','timestamp with time zone'),
  ('auth.oauth_clients','id','uuid'),('auth.oauth_clients','redirect_uris','text'),('auth.oauth_clients','deleted_at','timestamp with time zone'),
  ('auth.sessions','id','uuid'),('auth.sessions','user_id','uuid'),('auth.sessions','oauth_client_id','uuid'),('auth.sessions','not_after','timestamp with time zone')
 )v(relation,name,type)where not exists(select 1 from pg_attribute a where a.attrelid=to_regclass(v.relation)and a.attname=v.name and format_type(a.atttypid,a.atttypmod)=v.type and not a.attisdropped))
 or not exists(select 1 from pg_class where oid='auth.sessions'::regclass and relrowsecurity)
 or not exists(select 1 from pg_class where oid='eps.mcp_oauth_resources'::regclass and relrowsecurity and relforcerowsecurity)
 then raise exception'OAUTH_CONSENT_DISCOVERED_COLUMNS_REQUIRED';end if;
end$$;

create role eps_oauth_consent_owner nologin noinherit nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant eps_oauth_consent_owner to postgres;
grant usage on schema auth,eps,public to eps_oauth_consent_owner;
grant select(id,user_id,oauth_client_id,not_after)on auth.sessions to eps_oauth_consent_owner;
grant select(authorization_id,client_id,user_id,redirect_uri,scope,resource,status,expires_at)on auth.oauth_authorizations to eps_oauth_consent_owner;
grant select(id,redirect_uris,client_name,client_uri,logo_uri,deleted_at)on auth.oauth_clients to eps_oauth_consent_owner;
grant select(resource,client_id,enabled)on eps.mcp_oauth_resources to eps_oauth_consent_owner;
create policy oauth_consent_ordinary_own_session on auth.sessions for select to eps_oauth_consent_owner
 using(user_id=(select auth.uid())and id::text=(select auth.jwt()->>'session_id')and oauth_client_id is null);
create policy oauth_consent_enabled_registry on eps.mcp_oauth_resources for select to eps_oauth_consent_owner
 using(auth.uid()is not null and enabled);

create table eps.oauth_consent_claims(
 authorization_hash text primary key check(authorization_hash~'^[a-f0-9]{64}$'),
 principal_id uuid not null,session_id uuid not null,resource text not null,binding_hash text not null check(binding_hash~'^[a-f0-9]{64}$'),
 action text not null check(action in('details','approve','deny')),
 claim_id uuid not null,request_id uuid not null,
 outcome text not null check(outcome in('claimed','consent_ready','redirect','uncertain','rejected')),
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null
);
comment on table eps.oauth_consent_claims is 'Durable one-provider-call coordination, globally keyed by SHA256 of opaque selector. Contains no raw selector, callback code, OAuth state, PKCE challenge/verifier or token. No automatic takeover/replay.';
alter table eps.oauth_consent_claims enable row level security;alter table eps.oauth_consent_claims force row level security;
revoke all on eps.oauth_consent_claims from public,anon,authenticated,service_role;
grant select,insert,update on eps.oauth_consent_claims to eps_oauth_consent_owner;
create policy oauth_consent_own_claim on eps.oauth_consent_claims for all to eps_oauth_consent_owner
 using(principal_id=(select auth.uid())and session_id::text=(select auth.jwt()->>'session_id'))
 with check(principal_id=(select auth.uid())and session_id::text=(select auth.jwt()->>'session_id'));

-- No managed Auth RLS flag, ownership, existing policy or grant is replaced.
create function eps.oauth_consent_browser_session()returns uuid language plpgsql stable security invoker set search_path=''as $$
declare claims jsonb:=auth.jwt();principal uuid:=auth.uid();sid uuid;begin
 if principal is null or claims->>'role'is distinct from'authenticated'or claims->>'aud'is distinct from'authenticated'
  or claims->'is_anonymous'is distinct from'false'::jsonb or claims?'client_id'or claims?'eps_delegation'
  or jsonb_typeof(claims->'session_id')is distinct from'string'
  or claims->>'session_id'!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'
 then raise exception using errcode='28000',message='OAUTH_CONSENT_BROWSER_SESSION_REQUIRED';end if;
 sid:=(claims->>'session_id')::uuid;
 if not exists(select 1 from auth.sessions where id=sid and user_id=principal and oauth_client_id is null and(not_after is null or not_after>clock_timestamp()))
 then raise exception using errcode='28000',message='OAUTH_CONSENT_BROWSER_SESSION_REQUIRED';end if;
 return sid;
end$$;

create function eps.oauth_consent_binding(p_authorization_id text,p_resource text)returns jsonb language plpgsql stable security invoker set search_path=''set timezone='UTC'as $$
declare principal uuid:=auth.uid();a record;begin
 perform eps.oauth_consent_browser_session();
 if p_authorization_id is null or p_authorization_id!~'^[a-z2-7]{32}$'or p_resource is null or length(p_resource)not between 1 and 2048
 then raise exception using errcode='22023',message='OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE';end if;
 select r.authorization_id,r.client_id,r.user_id,r.redirect_uri,r.scope,r.resource,r.status,r.expires_at,
  c.client_name,c.client_uri,c.logo_uri,c.redirect_uris into a
 from auth.oauth_authorizations r join auth.oauth_clients c on c.id=r.client_id and c.deleted_at is null
 where r.authorization_id=p_authorization_id and r.expires_at>clock_timestamp()
  and(r.user_id is null or r.user_id=principal)and r.scope='openid'
  and(r.resource is null or r.resource=p_resource)
  and r.redirect_uri=any(string_to_array(c.redirect_uris,','))
  and length(c.client_name)between 1 and 200 and c.client_name!~'^[[:space:]]*$'and c.client_name!~'[[:cntrl:]]'
  and exists(select 1 from eps.mcp_oauth_resources b where b.resource=p_resource and b.client_id=r.client_id and b.enabled)
  and(select count(*)from eps.mcp_oauth_resources b where b.client_id=r.client_id and b.enabled)=1;
 if not found then raise exception using errcode='22023',message='OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE';end if;
 return jsonb_build_object('authorization_id',a.authorization_id,'client',jsonb_build_object('id',a.client_id,'name',a.client_name,'uri',a.client_uri,'logo_uri',a.logo_uri),
  'redirect_uri',a.redirect_uri,'scope',a.scope,'user_id',a.user_id,'status',a.status,'expires_at',a.expires_at);
end$$;

create function eps.oauth_consent_binding_hash(p_binding jsonb,p_resource text)returns text language sql immutable security invoker set search_path=''as $$
 select encode(sha256(convert_to(jsonb_build_object('authorization_id',p_binding->'authorization_id','client_id',p_binding#>'{client,id}',
  'redirect_uri',p_binding->'redirect_uri','scope',p_binding->'scope','expires_at',p_binding->'expires_at','resource',p_resource)::text,'UTF8')),'hex')
$$;

create function public.eps_oauth_consent_claim(p_authorization_id text,p_resource text,p_action text,p_request_id uuid)returns jsonb language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$
declare principal uuid:=auth.uid();sid uuid;binding jsonb;key text;fingerprint text;row_value eps.oauth_consent_claims%rowtype;new_claim uuid;begin
 sid:=eps.oauth_consent_browser_session();
 if p_action is null or p_action not in('details','approve','deny')or p_request_id is null then raise exception using errcode='22023',message='OAUTH_CONSENT_INPUT_INVALID';end if;
 if p_authorization_id is null or p_authorization_id!~'^[a-z2-7]{32}$'then raise exception using errcode='22023',message='OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE';end if;
 key:=encode(sha256(convert_to(p_authorization_id,'UTF8')),'hex');
 -- Transaction-scoped lock spans lookup and insert, including globally unique
 -- hashes hidden by own-session RLS; no native provider call occurs in this RPC.
 perform pg_advisory_xact_lock(hashtextextended(key,72103));
 binding:=eps.oauth_consent_binding(p_authorization_id,p_resource);fingerprint:=eps.oauth_consent_binding_hash(binding,p_resource);
 select * into row_value from eps.oauth_consent_claims where authorization_hash=key for update;
 if found then
  if row_value.principal_id<>principal or row_value.session_id<>sid or row_value.resource<>p_resource or row_value.binding_hash<>fingerprint
  then raise exception using errcode='28000',message='OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE';end if;
  if row_value.outcome='consent_ready'and binding->>'status'='pending'and binding->>'user_id'=principal::text then
   if p_action='details'then return jsonb_build_object('claim_id',null,'state','consent_ready','binding',binding);end if;
   new_claim:=gen_random_uuid();
   update eps.oauth_consent_claims set action=p_action,claim_id=new_claim,request_id=p_request_id,outcome='claimed',updated_at=clock_timestamp()where authorization_hash=key;
   return jsonb_build_object('claim_id',new_claim,'state','claimed','binding',binding);
  end if;
  return jsonb_build_object('claim_id',null,'state',case when row_value.outcome='claimed'then'in_progress'else'already_processed'end,'binding',binding);
 end if;
 if p_action<>'details'or binding->>'status'<>'pending'then raise exception using errcode='22023',message='OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE';end if;
 new_claim:=gen_random_uuid();
 insert into eps.oauth_consent_claims(authorization_hash,principal_id,session_id,resource,binding_hash,action,claim_id,request_id,outcome,expires_at)
 values(key,principal,sid,p_resource,fingerprint,p_action,new_claim,p_request_id,'claimed',(binding->>'expires_at')::timestamptz)
 on conflict(authorization_hash)do nothing;
 if not found then raise exception using errcode='28000',message='OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE';end if;
 return jsonb_build_object('claim_id',new_claim,'state','claimed','binding',binding);
end$$;

create function public.eps_oauth_consent_finish(p_authorization_id text,p_resource text,p_claim_id uuid,p_outcome text)returns jsonb language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$
declare principal uuid:=auth.uid();sid uuid;binding jsonb;key text;row_value eps.oauth_consent_claims%rowtype;begin
 sid:=eps.oauth_consent_browser_session();
 if p_claim_id is null or p_outcome is null or p_outcome not in('consent_ready','redirect','uncertain','rejected')then raise exception using errcode='22023',message='OAUTH_CONSENT_INPUT_INVALID';end if;
 if p_authorization_id is null or p_authorization_id!~'^[a-z2-7]{32}$'then raise exception using errcode='22023',message='OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE';end if;
 key:=encode(sha256(convert_to(p_authorization_id,'UTF8')),'hex');
 perform pg_advisory_xact_lock(hashtextextended(key,72103));
 binding:=eps.oauth_consent_binding(p_authorization_id,p_resource);
 select * into row_value from eps.oauth_consent_claims where authorization_hash=key for update;
 if not found or row_value.principal_id<>principal or row_value.session_id<>sid or row_value.claim_id<>p_claim_id
  or row_value.resource<>p_resource or row_value.binding_hash<>eps.oauth_consent_binding_hash(binding,p_resource)
 then raise exception using errcode='28000',message='OAUTH_CONSENT_AUTHORIZATION_UNAVAILABLE';end if;
 if row_value.outcome<>'claimed'then
  if row_value.outcome<>p_outcome then raise exception using errcode='22023',message='OAUTH_CONSENT_OUTCOME_INVALID';end if;
  return jsonb_build_object('claim_id',null,'state',case when p_outcome='consent_ready'then'consent_ready'else'already_processed'end,'binding',binding);
 end if;
 if p_outcome='consent_ready'and(row_value.action<>'details'or binding->>'status'<>'pending'or binding->>'user_id'is distinct from principal::text)
  or p_outcome='redirect'and(binding->>'user_id'is distinct from principal::text or binding->>'status'is distinct from case when row_value.action='deny'then'denied'else'approved'end)
 then raise exception using errcode='22023',message='OAUTH_CONSENT_NATIVE_OUTCOME_UNCONFIRMED';end if;
 update eps.oauth_consent_claims set outcome=p_outcome,updated_at=clock_timestamp()where authorization_hash=key;
 return jsonb_build_object('claim_id',null,'state',case when p_outcome='consent_ready'then'consent_ready'else'already_processed'end,'binding',binding);
end$$;

grant create on schema eps,public to eps_oauth_consent_owner;
alter table eps.oauth_consent_claims owner to eps_oauth_consent_owner;
alter function eps.oauth_consent_browser_session()owner to eps_oauth_consent_owner;
alter function eps.oauth_consent_binding(text,text)owner to eps_oauth_consent_owner;
alter function eps.oauth_consent_binding_hash(jsonb,text)owner to eps_oauth_consent_owner;
alter function public.eps_oauth_consent_claim(text,text,text,uuid)owner to eps_oauth_consent_owner;
alter function public.eps_oauth_consent_finish(text,text,uuid,text)owner to eps_oauth_consent_owner;
revoke create on schema eps,public from eps_oauth_consent_owner;
revoke all on function eps.oauth_consent_browser_session(),eps.oauth_consent_binding(text,text),eps.oauth_consent_binding_hash(jsonb,text),
 public.eps_oauth_consent_claim(text,text,text,uuid),public.eps_oauth_consent_finish(text,text,uuid,text)from public,anon,authenticated,service_role;
grant execute on function public.eps_oauth_consent_claim(text,text,text,uuid),public.eps_oauth_consent_finish(text,text,uuid,text)to authenticated;
comment on function public.eps_oauth_consent_claim(text,text,text,uuid)is 'Ordinary active browser session only. Authoritative approved-client/scope/registered-callback binding and durable consuming-call coordination. Raw selectors are hashed; no provider calls or authorization secrets stored.';
comment on function public.eps_oauth_consent_finish(text,text,uuid,text)is 'Completes the same user/session claim after provider response; verifies unchanged native binding and actual native user/status. No code/state input or persistence. Unknown outcomes are never automatically replayed.';
