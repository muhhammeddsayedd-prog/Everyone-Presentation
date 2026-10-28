-- LOCAL-ONLY SQL boundary proof. No HTTP, token mint, S3 bytes or Sharp acceptance.
-- Storage GUCs below SIMULATE the verified server context for database policy tests.
-- The known synthetic HMAC key is test authority only and rolls back with all fixtures.
begin;
do $$ begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
end $$;
create function pg_temp.assert_logo(condition boolean,label text) returns void language plpgsql as $$ begin
  if condition is distinct from true then raise exception 'ASSERTION_FAILED: %',label; end if;
end $$;
create function pg_temp.expect_logo_query(query text,expected text) returns void language plpgsql as $$ begin
  begin execute query;
  exception when others then if sqlstate=expected or sqlerrm=expected then return; end if; raise exception 'WRONG_ERROR: expected %, got % / %',expected,sqlstate,sqlerrm; end;
  raise exception 'EXPECTED_ERROR_NOT_RAISED: %',expected;
end $$;
create function pg_temp.logo_user(subject uuid) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claim.sub',subject::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',subject,'role','authenticated','is_anonymous',false)::text,true);
end $$;
create function pg_temp.logo_context(operation text,headers text) returns void language plpgsql as $$ begin
  perform set_config('storage.operation',operation,true); perform set_config('request.headers',headers,true);
end $$;
create function pg_temp.logo_put(name text,value jsonb) returns void language plpgsql as $$ begin perform set_config(name,value::text,true); end $$;
create function pg_temp.logo_get(name text) returns jsonb language sql stable as $$ select current_setting(name)::jsonb $$;
create function pg_temp.logo_input() returns jsonb language sql immutable as $$ select '{"actual_size_bytes":1234,"start_processing":false}'::jsonb $$;
create function pg_temp.logo_proof(reservation jsonb,changes jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$ declare claims jsonb; bytes bytea; issued bigint; begin
  issued:=floor(extract(epoch from clock_timestamp()))::bigint;
  claims:=jsonb_build_object('schema_version','1.0','audience','eps.logo-verification.v1','purpose','client_logo','key_id','synthetic-logo-test',
    'verification_id',reservation->>'verification_id','upload_id',reservation->>'upload_id','asset_id',reservation->'asset'->>'id',
    'principal_id',reservation->>'principal_id','workspace_id',reservation->>'workspace_id','reservation_revision',(reservation->>'reservation_revision')::bigint,
    'bucket',reservation->>'bucket','object_key',reservation->>'object_key','size_bytes',1234,'sha256',repeat('a',64),
    'mime_type','image/png','width',128,'height',64,'issued_at',issued,'expires_at',issued+60)||changes;
  bytes:=convert_to(claims::text,'UTF8');
  return jsonb_build_object('payload',rtrim(translate(replace(encode(bytes,'base64'),E'\n',''),'+/','-_'),'='),
    'mac',rtrim(translate(replace(encode(extensions.hmac(bytes,decode(repeat('07',32),'hex'),'sha256'),'base64'),E'\n',''),'+/','-_'),'='));
end $$;
create function pg_temp.expect_logo_finalize(upload uuid,proof jsonb,expected text,input jsonb default '{"actual_size_bytes":1234,"start_processing":false}') returns void language plpgsql as $$ begin
  begin perform public.eps_finalize_logo_completion(upload,input,'synthetic-complete-'||upload::text,proof->>'payload',proof->>'mac');
  exception when others then if sqlstate=expected or sqlerrm=expected then return; end if; raise exception 'WRONG_FINALIZE_ERROR expected %, got % / %',expected,sqlstate,sqlerrm; end;
  raise exception 'FORGED_COMPLETION_WAS_ACCEPTED';
end $$;

insert into auth.users(id) values('aaaaaaaa-1111-4111-8111-111111111111'),('bbbbbbbb-2222-4222-8222-222222222222'),('cccccccc-3333-4333-8333-333333333333');
insert into public.clients(id,name) values('aaaaaaaa-4444-4444-8444-444444444444','Synthetic logo client');
insert into public.projects(id,client_id,name) values('aaaaaaaa-5555-4555-8555-555555555555','aaaaaaaa-4444-4444-8444-444444444444','Synthetic logo project'),('bbbbbbbb-5555-4555-8555-555555555555',null,'Synthetic unrelated project');
insert into public.project_memberships(project_id,principal_id,can_write) values
  ('aaaaaaaa-5555-4555-8555-555555555555','aaaaaaaa-1111-4111-8111-111111111111',true),
  ('aaaaaaaa-5555-4555-8555-555555555555','cccccccc-3333-4333-8333-333333333333',false),
  ('bbbbbbbb-5555-4555-8555-555555555555','bbbbbbbb-2222-4222-8222-222222222222',true);
insert into public.app_capability_grants(principal_id,capability)
  select actor.id,capability from (values('aaaaaaaa-1111-4111-8111-111111111111'::uuid),('bbbbbbbb-2222-4222-8222-222222222222'::uuid)) actor(id)
  cross join unnest(array['projects.read','workspaces.read','workspaces.write']) capability;
insert into public.app_capability_grants(principal_id,capability)
  select 'cccccccc-3333-4333-8333-333333333333'::uuid,capability from unnest(array['projects.read','workspaces.read']) capability;
insert into eps.workspaces(id,project_id) values('aaaaaaaa-6666-4666-8666-666666666666','aaaaaaaa-5555-4555-8555-555555555555');
insert into eps.logo_verification_keys(key_id,secret,not_before,not_after) values('synthetic-logo-test',decode(repeat('07',32),'hex'),now()-interval '1 day',now()+interval '1 day');

select pg_temp.assert_logo(not has_table_privilege('authenticated','eps.logo_verification_keys','SELECT'),'users cannot read verification keys');
select pg_temp.assert_logo(not has_table_privilege('eps_api_owner','eps.logo_verification_keys','SELECT'),'ordinary RPC owner cannot read verification keys');
select pg_temp.assert_logo(not has_column_privilege('eps_api_owner','eps.media_assets','sha256','UPDATE'),'ordinary RPC owner cannot write verified checksum');
select pg_temp.assert_logo(not pg_has_role('authenticated','eps_logo_verify_owner','MEMBER') and not pg_has_role('eps_api_owner','eps_logo_verify_owner','MEMBER'),'no reverse verifier role membership');
select pg_temp.assert_logo(not exists(select 1 from pg_roles where rolname='eps_logo_verify_owner' and (rolcanlogin or rolsuper or rolbypassrls or rolcreaterole or rolcreatedb)),'verifier role is narrow');
select pg_temp.assert_logo(not has_function_privilege('authenticated','eps.logo_verify_receipt(eps.upload_sessions,text,text)','EXECUTE'),'user cannot call private verifier helper');
select pg_temp.assert_logo((select count(*)=5 from pg_policy where polrelid='storage.objects'::regclass and polname in('eps_logo_insert_guard','eps_logo_update_guard','eps_logo_delete_guard','eps_logo_read_guard','eps_logo_verifier_no_storage') and not polpermissive),'restrictive guards cannot be OR bypassed');
select pg_temp.assert_logo((select count(*)=1 from pg_policy where polrelid='storage.buckets'::regclass and polname='eps_logo_verifier_no_buckets' and not polpermissive),'verifier cannot inherit bucket DML');
select pg_temp.assert_logo((select not public and file_size_limit=5242880 from storage.buckets where id='eps-brand-assets'),'brand bucket is private and bounded');

-- A deliberately broad future permissive policy must not bypass brand guards.
create policy eps_test_logo_broad on storage.objects for all to authenticated using(true) with check(true);
create policy eps_test_logo_broad_buckets on storage.buckets for all to authenticated using(true) with check(true);
set local role authenticated;
select pg_temp.logo_user('aaaaaaaa-1111-4111-8111-111111111111');
select pg_temp.assert_logo(public.eps_get_capabilities()->'upload_policy'->'available_purposes'='[]'::jsonb,'hosted upload acceptance remains disabled');
select pg_temp.expect_logo_query('select * from eps.logo_verification_keys','42501');
select pg_temp.expect_logo_query('update eps.media_assets set status=''ready''','42501');
select pg_temp.expect_logo_query('select public.eps_reserve_logo_upload(''{"workspace_id":"aaaaaaaa-6666-4666-8666-666666666666","purpose":"client_logo","filename":"logo.png","mime_type":"image/png","size_bytes":1234,"status":"ready"}'',''forged-ready'')','INVALID_REQUEST');
select pg_temp.logo_put('eps.logo.request','{"workspace_id":"aaaaaaaa-6666-4666-8666-666666666666","purpose":"client_logo","filename":"synthetic-logo.png","mime_type":"image/png","size_bytes":1234}'::jsonb);
select pg_temp.logo_put('eps.logo.reservation',public.eps_reserve_logo_upload(pg_temp.logo_get('eps.logo.request'),'synthetic-reserve'));
select pg_temp.assert_logo(pg_temp.logo_get('eps.logo.reservation')->'asset'->>'status'='uploading','a reservation alone is not Ready');
select pg_temp.assert_logo(public.eps_get_logo_upload((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid)->>'upload_id'=pg_temp.logo_get('eps.logo.reservation')->>'upload_id','upload reservation persists');
select pg_temp.logo_put('eps.logo.proof',pg_temp.logo_proof(pg_temp.logo_get('eps.logo.reservation')));
reset role;
set local role eps_api_owner;
select pg_temp.expect_logo_query(format('update eps.media_assets set status=''ready'' where id=%L',pg_temp.logo_get('eps.logo.reservation')->'asset'->>'id'),'42501');
reset role;
set local role authenticated;

-- These are GUC-based SQL policy probes, not Storage HTTP/token behavior.
select pg_temp.logo_context('storage.object.sign_upload_url','{"x-upsert":"true"}');
select pg_temp.assert_logo(not eps.logo_storage_insert_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'upsert signing denied before any object exists');
select pg_temp.expect_logo_query(format('insert into storage.objects(bucket_id,name) values(''eps-brand-assets'',%L)',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'42501');
select pg_temp.logo_context('storage.object.sign_upload_url','{}');
select pg_temp.assert_logo(not eps.logo_storage_insert_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'missing explicit false denied');
select pg_temp.logo_context('storage.object.sign_upload_url','{"x-upsert":false}');
select pg_temp.assert_logo(not eps.logo_storage_insert_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'boolean false is not the trusted header string');
select pg_temp.logo_context('storage.object.sign_upload_url','{"x-upsert":"false"}');
select pg_temp.assert_logo(eps.logo_storage_insert_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'explicit false with exact active reservation allowed');
select pg_temp.logo_context('storage.object.unknown','{"x-upsert":"false"}');
select pg_temp.assert_logo(not eps.logo_storage_insert_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'unknown operation denied');
select pg_temp.logo_context('storage.object.upload','{"x-upsert":"false"}');
select pg_temp.expect_logo_query('insert into storage.objects(bucket_id,name) values(''eps-brand-assets'',''unreserved/original.png'')','42501');
reset role;
set local role eps_logo_verify_owner;
select pg_temp.expect_logo_query(format('insert into storage.objects(bucket_id,name) values(''eps-brand-assets'',%L)',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'42501');
select pg_temp.expect_logo_query('insert into storage.buckets(id,name) values(''eps-synthetic-forbidden-verifier'',''eps-synthetic-forbidden-verifier'')','42501');
reset role;
set local role authenticated;
-- A metadata row below is a policy probe only; it represents no actual object bytes.
do $$ begin execute format('insert into storage.objects(bucket_id,name) values(''eps-brand-assets'',%L)',pg_temp.logo_get('eps.logo.reservation')->>'object_key'); end $$;
select pg_temp.logo_context('storage.object.get_authenticated','{}');
select pg_temp.assert_logo(eps.logo_storage_read_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'uploader may read its private unverified source');
select pg_temp.logo_user('cccccccc-3333-4333-8333-333333333333');
select pg_temp.assert_logo(not eps.logo_storage_read_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'project viewer cannot read unverified source');
select pg_temp.logo_user('bbbbbbbb-2222-4222-8222-222222222222');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,pg_temp.logo_get('eps.logo.proof'),'RESOURCE_NOT_FOUND');
select pg_temp.expect_logo_query(format('select public.eps_get_logo_upload(%L)',pg_temp.logo_get('eps.logo.reservation')->>'upload_id'),'RESOURCE_NOT_FOUND');
select pg_temp.logo_user('aaaaaaaa-1111-4111-8111-111111111111');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,'{"payload":"e30","mac":"AAAA"}','ACCESS_DENIED');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,jsonb_build_object('payload',repeat('A',100000),'mac',pg_temp.logo_get('eps.logo.proof')->>'mac'),'ACCESS_DENIED');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,pg_temp.logo_get('eps.logo.proof')||'{"mac":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}','ACCESS_DENIED');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,pg_temp.logo_proof(pg_temp.logo_get('eps.logo.reservation'),'{"workspace_id":"bbbbbbbb-6666-4666-8666-666666666666"}'),'ACCESS_DENIED');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,pg_temp.logo_proof(pg_temp.logo_get('eps.logo.reservation'),'{"purpose":"candidate_frame"}'),'ACCESS_DENIED');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,pg_temp.logo_proof(pg_temp.logo_get('eps.logo.reservation'),jsonb_build_object('issued_at',floor(extract(epoch from clock_timestamp()))::bigint-200,'expires_at',floor(extract(epoch from clock_timestamp()))::bigint-1)),'ACCESS_DENIED');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,pg_temp.logo_proof(pg_temp.logo_get('eps.logo.reservation'),jsonb_build_object('issued_at',floor(extract(epoch from clock_timestamp()))::bigint+30,'expires_at',floor(extract(epoch from clock_timestamp()))::bigint+60)),'ACCESS_DENIED');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,pg_temp.logo_get('eps.logo.proof'),'INVALID_REQUEST','{"actual_size_bytes":1234,"start_processing":false,"verified":true}');
do $$ declare reservation jsonb; proof jsonb; result jsonb; completion_key text; begin
  reservation:=pg_temp.logo_get('eps.logo.reservation'); proof:=pg_temp.logo_get('eps.logo.proof');
  completion_key:='synthetic-complete-'||(reservation->>'upload_id');
  result:=public.eps_finalize_logo_completion((reservation->>'upload_id')::uuid,pg_temp.logo_input(),completion_key,proof->>'payload',proof->>'mac');
  perform pg_temp.assert_logo(result->>'status'='ready' and result->'processing_job_id'='null'::jsonb and result->'asset'->>'sha256'=repeat('a',64),'only verified receipt publishes Ready without fake job');
  perform pg_temp.assert_logo(public.eps_finalize_logo_completion((reservation->>'upload_id')::uuid,pg_temp.logo_input(),completion_key,'not-used','not-used')=result,'duplicate completion replays without proof reissue');
  perform pg_temp.assert_logo(public.eps_prepare_logo_completion((reservation->>'upload_id')::uuid,pg_temp.logo_input(),completion_key)->'replay'=result,'prepare returns prior completion before download');
  perform pg_temp.assert_logo(public.eps_prepare_logo_completion((reservation->>'upload_id')::uuid,pg_temp.logo_input(),'synthetic-complete-new-prepare')->'replay'=result,'new prepare key binds completed response without another transition');
  perform pg_temp.expect_logo_query(format('select public.eps_prepare_logo_completion(%L,''{"actual_size_bytes":1234,"start_processing":true}'',''synthetic-complete-new-prepare'')',reservation->>'upload_id'),'IDEMPOTENCY_KEY_REUSED');
  perform pg_temp.assert_logo(public.eps_finalize_logo_completion((reservation->>'upload_id')::uuid,pg_temp.logo_input(),'synthetic-complete-new-finalize','unused','unused')=result,'new final key reaches immutable completed replay before transition RLS locks');
  perform pg_temp.expect_logo_query(format('select public.eps_finalize_logo_completion(%L,''{"actual_size_bytes":1234,"start_processing":false,"sha256":"%s"}'',''synthetic-complete-new-finalize'',''unused'',''unused'')',reservation->>'upload_id',repeat('a',64)),'IDEMPOTENCY_KEY_REUSED');
  perform pg_temp.expect_logo_query(format('select public.eps_cancel_logo_upload(%L,''synthetic-cancel-completed'')',reservation->>'upload_id'),'INVALID_TRANSITION');
  perform pg_temp.assert_logo(public.eps_reserve_logo_upload(pg_temp.logo_get('eps.logo.request'),'synthetic-reserve')->>'status'='completed','reserve replay refreshes current closed state');
end $$;
select pg_temp.logo_user('cccccccc-3333-4333-8333-333333333333');
select pg_temp.logo_context('storage.object.get_authenticated','{}');
select pg_temp.assert_logo(eps.logo_storage_read_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'project viewer may read Ready permitted logo');
select pg_temp.logo_context('storage.object.sign','{}');
select pg_temp.assert_logo(not eps.logo_storage_read_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'unbounded read signing is denied');
select pg_temp.logo_user('aaaaaaaa-1111-4111-8111-111111111111');
select pg_temp.logo_context('storage.object.upload','{"x-upsert":"false"}');
select pg_temp.assert_logo(not eps.logo_storage_insert_allowed('eps-brand-assets',pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'completed source cannot mint another transfer');
-- UPDATE/DELETE USING false silently affect no rows: assert original identity below.
do $$ begin execute format('update storage.objects set name=''replaced.png'' where bucket_id=''eps-brand-assets'' and name=%L',pg_temp.logo_get('eps.logo.reservation')->>'object_key'); end $$;
do $$ begin execute format('delete from storage.objects where bucket_id=''eps-brand-assets'' and name=%L',pg_temp.logo_get('eps.logo.reservation')->>'object_key'); end $$;

-- Independent cancelled and expired sessions cannot publish even valid proofs.
-- Deterministically expire a different reservation after Ready media UPDATE but
-- before the upload UPDATE. This owner-only test trigger rolls back with fixtures;
-- production code has no clock setter, sleep or bypass authority.
select pg_temp.logo_put('eps.logo.expiry_cross',public.eps_reserve_logo_upload(pg_temp.logo_get('eps.logo.request'),'synthetic-expiry-cross'));
reset role;
create function pg_temp.logo_expire_during_ready() returns trigger language plpgsql security definer set search_path='' as $$ begin
  if new.id=(pg_temp.logo_get('eps.logo.expiry_cross')->'asset'->>'id')::uuid and new.status='ready' then
    update eps.upload_sessions set created_at=clock_timestamp()-interval '3 hours',expires_at=clock_timestamp()-interval '1 second' where asset_id=new.id;
  end if;
  return new;
end $$;
create trigger eps_test_logo_expiry_cross after update of status on eps.media_assets for each row execute function pg_temp.logo_expire_during_ready();
set local role authenticated;
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.expiry_cross')->>'upload_id')::uuid,pg_temp.logo_proof(pg_temp.logo_get('eps.logo.expiry_cross')),'INVALID_TRANSITION');
reset role;
select pg_temp.assert_logo((select asset.status='uploading' and upload.status='open' and upload.expires_at>clock_timestamp() from eps.upload_sessions upload join eps.media_assets asset on asset.id=upload.asset_id where upload.id=(pg_temp.logo_get('eps.logo.expiry_cross')->>'upload_id')::uuid),'zero-row completion rolls back both Ready metadata and test expiry');
select pg_temp.assert_logo(not exists(select 1 from eps.idempotency_records where operation='complete_upload' and key='synthetic-complete-'||(pg_temp.logo_get('eps.logo.expiry_cross')->>'upload_id')),'failed atomic completion leaves no replay effect');
drop trigger eps_test_logo_expiry_cross on eps.media_assets;
drop function pg_temp.logo_expire_during_ready();
set local role authenticated;
select pg_temp.logo_put('eps.logo.cancelled',public.eps_reserve_logo_upload(pg_temp.logo_get('eps.logo.request'),'synthetic-cancelled'));
do $$ declare r jsonb; proof jsonb; begin
  r:=pg_temp.logo_get('eps.logo.cancelled'); proof:=pg_temp.logo_proof(r);
  perform public.eps_cancel_logo_upload((r->>'upload_id')::uuid,'synthetic-cancel');
  perform pg_temp.assert_logo(public.eps_cancel_logo_upload((r->>'upload_id')::uuid,'synthetic-cancel-new-key')->>'success'='true','new-key cancellation stays idempotently closed');
  perform pg_temp.expect_logo_finalize((r->>'upload_id')::uuid,proof,'INVALID_TRANSITION');
  perform pg_temp.assert_logo(public.eps_reserve_logo_upload(pg_temp.logo_get('eps.logo.request'),'synthetic-cancelled')->>'status'='cancelled','cancelled replay stays closed');
end $$;
select pg_temp.logo_put('eps.logo.expired',public.eps_reserve_logo_upload(pg_temp.logo_get('eps.logo.request'),'synthetic-expired'));
reset role;
update eps.upload_sessions set created_at=now()-interval '3 hours',expires_at=now()-interval '1 hour' where id=(pg_temp.logo_get('eps.logo.expired')->>'upload_id')::uuid;
select pg_temp.assert_logo((select count(*)=1 from eps.audit_events where principal_id='aaaaaaaa-1111-4111-8111-111111111111' and action='complete_upload'),'one completion audit effect');
select pg_temp.assert_logo((select count(*)=3 from eps.idempotency_records where principal_id='aaaaaaaa-1111-4111-8111-111111111111' and operation='complete_upload'),'one transition plus two completed-state keys preserve public request hashes');
select pg_temp.assert_logo((select count(*)=1 from storage.objects where bucket_id='eps-brand-assets' and name=pg_temp.logo_get('eps.logo.reservation')->>'object_key'),'restrictive update and delete preserve protected object identity');
set local role authenticated;
select pg_temp.logo_user('aaaaaaaa-1111-4111-8111-111111111111');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.expired')->>'upload_id')::uuid,pg_temp.logo_proof(pg_temp.logo_get('eps.logo.expired')),'INVALID_TRANSITION');
reset role;
update public.project_memberships set active=false where principal_id='aaaaaaaa-1111-4111-8111-111111111111' and project_id='aaaaaaaa-5555-4555-8555-555555555555';
set local role authenticated;
select pg_temp.logo_user('aaaaaaaa-1111-4111-8111-111111111111');
select pg_temp.expect_logo_finalize((pg_temp.logo_get('eps.logo.reservation')->>'upload_id')::uuid,pg_temp.logo_get('eps.logo.proof'),'RESOURCE_NOT_FOUND');
select pg_temp.expect_logo_query('select public.eps_reserve_logo_upload(pg_temp.logo_get(''eps.logo.request''),''synthetic-reserve'')','RESOURCE_NOT_FOUND');
reset role;
select 'M01 private logo SQL scope, receipt, idempotency and restrictive policy assertions passed; all fixtures rolled back. Storage operation GUC probes are simulation, not HTTP or actual byte verification.' as result;
rollback;
