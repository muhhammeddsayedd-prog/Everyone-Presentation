-- LOCAL-ONLY Node signLogoReceipt -> actual SQL finalize interoperability proof.
-- The known 07x32 key, identities and receipt are synthetic test authority.
-- This exercises no Storage HTTP, object bytes, Sharp or hosted integration.
begin;
set local lock_timeout='3s';
set local statement_timeout='20s';
do $guard$ begin
  if current_database()<>'postgres' or current_user<>'postgres'
    or current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
    or not exists(select 1 from eps_local_guard.instance where id=1)
  then raise exception 'VERIFIED_LOCAL_INTEROP_TARGET_REQUIRED'; end if;
  if exists(select 1 from auth.users where id='ffffffff-1111-4111-8111-111111111111')
    or exists(select 1 from public.clients where id='ffffffff-2222-4222-8222-222222222222')
    or exists(select 1 from public.projects where id='ffffffff-3333-4333-8333-333333333333')
    or exists(select 1 from eps.workspaces where id='ffffffff-4444-4444-8444-444444444444')
    or exists(select 1 from eps.media_assets where id='ffffffff-5555-4555-8555-555555555555')
    or exists(select 1 from eps.upload_sessions where id='ffffffff-6666-4666-8666-666666666666')
    or exists(select 1 from eps.logo_verification_keys where key_id='synthetic-node-logo-interop-v1')
  then raise exception 'REFUSING_EXISTING_NODE_INTEROP_FIXTURE'; end if;
end $guard$;

insert into auth.users(id) values('ffffffff-1111-4111-8111-111111111111');
insert into public.clients(id,name) values('ffffffff-2222-4222-8222-222222222222','Synthetic Node interop client');
insert into public.projects(id,client_id,name) values('ffffffff-3333-4333-8333-333333333333','ffffffff-2222-4222-8222-222222222222','Synthetic Node interop project');
insert into public.project_memberships(project_id,principal_id,can_write)
  values('ffffffff-3333-4333-8333-333333333333','ffffffff-1111-4111-8111-111111111111',true);
insert into public.app_capability_grants(principal_id,capability)
  select 'ffffffff-1111-4111-8111-111111111111'::uuid,capability
  from unnest(array['projects.read','workspaces.read','workspaces.write']) capability;
insert into eps.workspaces(id,project_id) values('ffffffff-4444-4444-8444-444444444444','ffffffff-3333-4333-8333-333333333333');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status)
  values('ffffffff-5555-4555-8555-555555555555','ffffffff-4444-4444-8444-444444444444','client_logo','synthetic-node-logo.png','image/png',
    'eps-brand-assets','assets/ffffffff-5555-4555-8555-555555555555/original.png',1234,'uploading');
insert into eps.upload_sessions(id,asset_id,principal_id,workspace_id,verification_id,bucket,object_key,expected_size_bytes,expected_mime_type,expected_sha256)
  values('ffffffff-6666-4666-8666-666666666666','ffffffff-5555-4555-8555-555555555555','ffffffff-1111-4111-8111-111111111111',
    'ffffffff-4444-4444-8444-444444444444','ffffffff-7777-4777-8777-777777777777','eps-brand-assets',
    'assets/ffffffff-5555-4555-8555-555555555555/original.png',1234,'image/png',repeat('a',64));
insert into eps.logo_verification_keys(key_id,secret,not_before,not_after)
  values('synthetic-node-logo-interop-v1',decode(repeat('07',32),'hex'),clock_timestamp()-interval '1 day',clock_timestamp()+interval '1 day');

set local role authenticated;
do $claims$ begin
  perform set_config('request.jwt.claim.sub','ffffffff-1111-4111-8111-111111111111',true);
  perform set_config('request.jwt.claims','{"sub":"ffffffff-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
end $claims$;
do $interop$
declare payload text:='__EPS_NODE_LOGO_PAYLOAD__'; mac text:='__EPS_NODE_LOGO_MAC__'; wrong_mac text; result jsonb; replay jsonb;
  input jsonb:=jsonb_build_object('actual_size_bytes',1234,'start_processing',false,'sha256',repeat('a',64));
begin
  wrong_mac:=overlay(mac placing case when left(mac,1)='A' then 'B' else 'A' end from 1 for 1);
  begin
    perform public.eps_finalize_logo_completion('ffffffff-6666-4666-8666-666666666666',input,'synthetic-node-logo-interop-complete',payload,wrong_mac);
    raise exception 'NODE_INTEROP_WRONG_SIGNATURE_ACCEPTED';
  exception when sqlstate 'P0001' then
    if sqlerrm<>'ACCESS_DENIED' then raise; end if;
  end;
  result:=public.eps_finalize_logo_completion('ffffffff-6666-4666-8666-666666666666',input,'synthetic-node-logo-interop-complete',payload,mac);
  if result->>'status' is distinct from 'ready' or result->'processing_job_id' is distinct from 'null'::jsonb
    or result->'asset'->>'id' is distinct from 'ffffffff-5555-4555-8555-555555555555'
    or result->'asset'->>'status' is distinct from 'ready' or result->'asset'->>'sha256' is distinct from repeat('a',64)
    or result->'asset'->>'size_bytes' is distinct from '1234' or result->'asset'->>'width' is distinct from '128'
    or result->'asset'->>'height' is distinct from '64'
  then raise exception 'NODE_INTEROP_READY_PROJECTION_MISMATCH'; end if;
  replay:=public.eps_finalize_logo_completion('ffffffff-6666-4666-8666-666666666666',input,'synthetic-node-logo-interop-complete','unused','unused');
  if replay is distinct from result then raise exception 'NODE_INTEROP_REPLAY_MISMATCH'; end if;
end $interop$;
reset role;
do $stored$ begin
  if not exists(select 1 from eps.media_assets asset join eps.upload_sessions upload on upload.asset_id=asset.id
    where asset.id='ffffffff-5555-4555-8555-555555555555' and asset.status='ready' and asset.sha256=repeat('a',64)
      and asset.size_bytes=1234 and asset.width=128 and asset.height=64
      and upload.id='ffffffff-6666-4666-8666-666666666666' and upload.status='completed' and upload.completed_at is not null)
    or (select count(*) from eps.idempotency_records where principal_id='ffffffff-1111-4111-8111-111111111111')<>1
    or (select count(*) from eps.audit_events where principal_id='ffffffff-1111-4111-8111-111111111111' and action='complete_upload')<>1
  then raise exception 'NODE_INTEROP_STORED_STATE_MISMATCH'; end if;
end $stored$;
select jsonb_build_object('node_to_sql_receipt_verified',true,'wrong_signature_rejected',true,
  'ready_projection_verified',true,'single_transition_verified',true,'assertion_backend_pid',pg_backend_pid()) as interop_result;
rollback;
