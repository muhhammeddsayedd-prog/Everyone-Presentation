-- Forward fix for the canonical32 coordinator's missing managed Auth USAGE.
-- No managed Auth ACL/schema/RLS/policy changes or role memberships are added.
-- The existing strict ordinary-session guard runs under the existing postgres
-- bridge owner; the NOLOGIN coordinator receives only principal/session UUIDs.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';

do $$begin
 if current_user<>'postgres'or(current_database()<>'postgres'and not(
   current_database()~'^eps_oauth_consent_[a-f0-9]{32}$'
   and coalesce(current_setting('eps.oauth_consent_test_run',true)~'^[a-f0-9]{32}$',false)
   and current_database()='eps_oauth_consent_'||current_setting('eps.oauth_consent_test_run',true)
   and shobj_description((select oid from pg_database where datname=current_database()),'pg_database')='eps-oauth-consent-owned:'||current_setting('eps.oauth_consent_test_run',true)))
  or(select count(*)from supabase_migrations.schema_migrations)<>32
  or not exists(select 1 from supabase_migrations.schema_migrations where version='20261031104603')
  or exists(select 1 from supabase_migrations.schema_migrations where version>='20261031130207')
  or to_regprocedure('eps.oauth_consent_browser_context()')is not null
  or not exists(select 1 from pg_roles where rolname='eps_oauth_consent_owner'and not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls and not rolcreatedb and not rolcreaterole and not rolreplication)
  or has_schema_privilege('eps_oauth_consent_owner','auth','USAGE')
  or not has_schema_privilege('postgres','auth','USAGE')
  or exists(select 1 from pg_auth_members where member='eps_oauth_consent_owner'::regrole)
  or exists(select 1 from eps.oauth_consent_claims)
 then raise exception'OAUTH_CONTEXT_EXACT32_FORWARD_TARGET_REQUIRED';end if;
 if not exists(select 1 from pg_proc where oid=to_regprocedure('public.eps_oauth_consent_claim(text,text,text,uuid)')
   and proowner='eps_oauth_consent_owner'::regrole and prosecdef
   and encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='746f867006acc628512eab0d076e9795965d32335234d174afcf22a057023514')
  or not exists(select 1 from pg_proc where oid=to_regprocedure('public.eps_oauth_consent_finish(text,text,uuid,text)')
   and proowner='eps_oauth_consent_owner'::regrole and prosecdef
   and encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex')='fa01f2d9ec103a086df400ba2fcfb648c09178f644a0394d70a1e4b1810d2244')
  or not has_function_privilege('postgres','eps.oauth_consent_browser_session()','EXECUTE')
  or not exists(select 1 from pg_policy where polrelid='eps.oauth_consent_claims'::regclass and polname='oauth_consent_own_claim'and polcmd='*'and polpermissive and polroles=array['eps_oauth_consent_owner'::regrole::oid])
 then raise exception'OAUTH_CONTEXT_REVIEWED32_FUNCTIONS_REQUIRED';end if;
end$$;

create function eps.oauth_consent_browser_context()returns jsonb
language plpgsql stable security definer set search_path=''set timezone='UTC'as $$
declare sid uuid;begin
 -- Reuse every existing native ordinary-browser/active-session predicate.
 sid:=eps.oauth_consent_browser_session();
 return jsonb_build_object('principal_id',auth.uid(),'session_id',sid);
end$$;
revoke all on function eps.oauth_consent_browser_context()from public,anon,authenticated,service_role;
grant execute on function eps.oauth_consent_browser_context()to eps_oauth_consent_owner;
comment on function eps.oauth_consent_browser_context()is 'Private strict ordinary browser context for the NOLOGIN OAuth coordinator. Existing postgres Auth USAGE only; no delegated identity, token, claim setter or managed grant. Returns principal/session UUIDs after the unchanged native-session guard.';

create or replace function public.eps_oauth_consent_claim(p_authorization_id text,p_resource text,p_action text,p_request_id uuid)returns jsonb language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$
declare principal uuid;sid uuid;context jsonb;binding jsonb;key text;fingerprint text;row_value eps.oauth_consent_claims%rowtype;new_claim uuid;begin
 context:=eps.oauth_consent_browser_context();principal:=(context->>'principal_id')::uuid;sid:=(context->>'session_id')::uuid;
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

create or replace function public.eps_oauth_consent_finish(p_authorization_id text,p_resource text,p_claim_id uuid,p_outcome text)returns jsonb language plpgsql volatile security definer set search_path=''set timezone='UTC'as $$
declare principal uuid;sid uuid;context jsonb;binding jsonb;key text;row_value eps.oauth_consent_claims%rowtype;begin
 context:=eps.oauth_consent_browser_context();principal:=(context->>'principal_id')::uuid;sid:=(context->>'session_id')::uuid;
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

-- The ledger keeps exactly the same ordinary principal AND session predicates.
-- Resolve them through the private guard so SQL helper expansion cannot require
-- managed Auth namespace USAGE in the NOLOGIN coordinator's execution context.
alter policy oauth_consent_own_claim on eps.oauth_consent_claims
 using(principal_id=(select(eps.oauth_consent_browser_context()->>'principal_id')::uuid)
  and session_id=(select(eps.oauth_consent_browser_context()->>'session_id')::uuid))
 with check(principal_id=(select(eps.oauth_consent_browser_context()->>'principal_id')::uuid)
  and session_id=(select(eps.oauth_consent_browser_context()->>'session_id')::uuid));
