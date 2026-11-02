"""Owned-only official0074 plus one synthetic coordination row, before baseline."""
from pathlib import Path
import hashlib,json
HERE=Path(__file__).resolve().parent
UPSTREAM_SHA='60fb345d3c03dd8a629a73aa6b296743a9c9f81887c9cc81af8fcf71d9994ec0'
FUNCTION_SOURCE_SHA='7acc27abc9a7b7d0a54fe179f98c5297d34424207a635684c5ddaaa6597baf9e'
CORE_SHA='65525a911066368e0375190045de813964b4c8052985a877a5521ccdb9944e07'
DARK_SOURCE_SHA='a45b23c42ace617d552467ead1e55844ed424eb78b6bc9d0eab96646d7573a89'
def literal(value):return "'"+str(value).replace("'","''")+"'"
def build(history):
 raw=(HERE/'upstream/0074-unlock-object-versioning.sql').read_bytes()
 if hashlib.sha256(raw).hexdigest()!=UPSTREAM_SHA:raise ValueError('FORWARD_UPSTREAM_CHANGED')
 core=(HERE/'upstream/0062-object-versioning-core.sql').read_bytes();dark=(HERE/'upstream/observed-historical-dark-check.json').read_bytes()
 if hashlib.sha256(core).hexdigest()!=CORE_SHA or hashlib.sha256(dark).hexdigest()!=DARK_SOURCE_SHA:raise ValueError('FORWARD_PREREQUISITE_SOURCE_CHANGED')
 column_start=core.decode().index('ALTER TABLE storage.buckets');column=core.decode()[column_start:core.decode().index(';',column_start)+1];definition=json.loads(dark)['definition']
 if column!="ALTER TABLE storage.buckets\nADD COLUMN IF NOT EXISTS versioning_status text NOT NULL DEFAULT 'DISABLED';"or definition!="CHECK ((versioning_status = 'DISABLED'::text))":raise ValueError('FORWARD_PREREQUISITE_NOT_EXACT')
 versions='array['+','.join(map(literal,history))+']::text[]'
 prefix="""begin;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='60s';
do $forward_owned$begin
 if current_database()<>'project39'or current_user<>'postgres'or(pg_control_system()).system_identifier::text<>__FORWARD_SYSTEM_SQL__
 or(pg_control_system()).system_identifier::text='7701520506262638626'
 or current_setting('eps.reason40forward.run',true)is distinct from __FORWARD_RUN_SQL__
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from __FORWARD_HISTORY__
 or to_regprocedure('storage.enforce_versioning_status_transition()')is not null
 or exists(select 1 from pg_trigger where tgrelid='storage.buckets'::regclass and tgname='enforce_versioning_status_transition')
 or exists(select 1 from pg_constraint where conrelid='storage.buckets'::regclass and conname='buckets_versioning_dark_check')
 or exists(select 1 from pg_attribute where attrelid='storage.buckets'::regclass and attname='versioning_status'and not attisdropped)
 or exists(select 1 from pg_constraint where conrelid='eps.oauth_consent_claims'::regclass and contype='f')
 then raise exception'FORWARD_EXACT_OWNED39_FIXTURE_REQUIRED';end if;
 perform set_config('eps.reason40forward.claims_before',(select count(*)::text from eps.oauth_consent_claims),true);
 perform set_config('eps.reason40forward.buckets_before',(select count(*)::text from storage.buckets),true);
end$forward_owned$;
set local role supabase_storage_admin;
""".replace('__FORWARD_HISTORY__',versions)
 prerequisite=column+'\nALTER TABLE storage.buckets ADD CONSTRAINT buckets_versioning_dark_check '+definition+";\ndo $forward_prerequisite$begin if not exists(select 1 from pg_constraint where conrelid='storage.buckets'::regclass and conname='buckets_versioning_dark_check'and pg_get_constraintdef(oid)='CHECK ((versioning_status = ''DISABLED''::text))')or exists(select 1 from storage.buckets where versioning_status is distinct from'DISABLED')then raise exception'FORWARD_PREREQUISITE_REQUIRED';end if;end$forward_prerequisite$;\n"
 suffix="""
reset role;
do $forward_ledger$declare run uuid:=current_setting('eps.reason40forward.run')::uuid;key text;begin
 key:=encode(sha256(convert_to('eps-owned-forward-ledger:'||run::text,'UTF8')),'hex');
 if exists(select 1 from eps.oauth_consent_claims where authorization_hash=key)then raise exception'FORWARD_LEDGER_ALREADY_EXISTS';end if;
 insert into eps.oauth_consent_claims(authorization_hash,principal_id,session_id,resource,binding_hash,action,claim_id,request_id,outcome,expires_at)
 values(key,'d4400000-0000-4000-8000-000000000001','d4400000-0000-4000-8000-000000000002','urn:eps:owned-forward-fixture',encode(sha256(convert_to('eps-owned-forward-binding:'||run::text,'UTF8')),'hex'),'details',run,run,'uncertain',clock_timestamp()+interval'1 hour');
 if(select count(*)from eps.oauth_consent_claims)<>current_setting('eps.reason40forward.claims_before')::bigint+1
 or exists(select 1 from pg_constraint where conrelid='storage.buckets'::regclass and conname='buckets_versioning_dark_check')
 or(select encode(sha256(convert_to(prosrc,'UTF8')),'hex')from pg_proc where oid='storage.enforce_versioning_status_transition()'::regprocedure)<>'__SOURCE_SHA__'
 or not exists(select 1 from pg_proc where oid='storage.enforce_versioning_status_transition()'::regprocedure and proowner='supabase_storage_admin'::regrole)
 or exists(select 1 from storage.buckets where versioning_status is distinct from'DISABLED')
 or(select count(*)from storage.buckets)<>current_setting('eps.reason40forward.buckets_before')::bigint
 or not exists(select 1 from pg_trigger where tgrelid='storage.buckets'::regclass and tgname='enforce_versioning_status_transition'and tgfoid='storage.enforce_versioning_status_transition()'::regprocedure and tgtype=19 and tgenabled='O'and not tgisinternal)
 then raise exception'FORWARD_FIXTURE_POSTIMAGE_REQUIRED';end if;
end$forward_ledger$;
select jsonb_build_object('claims_before',current_setting('eps.reason40forward.claims_before')::bigint,'claims_after',(select count(*)from eps.oauth_consent_claims),'one_synthetic_ledger_row_added',true,'official0074_exact_source',true,'owned_bucket_prerequisite_new_column',true,'historical_dark_check_installed_then_removed',true,'storage_bucket_count',(select count(*)from storage.buckets),'new_bucket_versioning_status_all_disabled',true,'new_owned_function_oid','storage.enforce_versioning_status_transition()'::regprocedure::oid,'original_Auth_users_sessions_clients_untouched',true)as forward_fixture;
commit;
""".replace('__SOURCE_SHA__',FUNCTION_SOURCE_SHA)
 return prefix+prerequisite+raw.decode()+suffix
