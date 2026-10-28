-- LOCAL-ONLY committed SQL completion race fixture. No bytes or Storage HTTP.
-- This known synthetic verifier key is authority ONLY in the owned local DB.
begin;
do $$ begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
    or current_database()<>'postgres' or to_regclass('eps_local_guard.instance') is null
  then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
  if to_regclass('eps_local_guard.logo_race_fixture') is not null
    or exists(select 1 from auth.users where id='dddddddd-1111-4111-8111-111111111111')
    or exists(select 1 from public.projects where id='dddddddd-2222-4222-8222-222222222222')
    or exists(select 1 from eps.workspaces where id='dddddddd-3333-4333-8333-333333333333')
    or exists(select 1 from eps.logo_verification_keys where key_id='eps-local-logo-race-v1')
  then raise exception 'LOGO_RACE_FIXTURE_COLLISION_PRESERVE_EXISTING_DATA'; end if;
end $$;
create table eps_local_guard.logo_race_fixture (
  fixture_id integer primary key check(fixture_id=1),
  marker text not null check(marker='EPS LOCAL LOGO SQL POLICY RACE V1'),
  principal_id uuid not null, project_id uuid not null, workspace_id uuid not null,
  upload_id uuid not null, asset_id uuid not null, reservation jsonb not null,
  completion_input jsonb not null, proof_payload text not null, proof_mac text not null,
  created_at timestamptz not null default clock_timestamp()
);
revoke all on eps_local_guard.logo_race_fixture from public,anon,authenticated,service_role,eps_api_owner,eps_logo_verify_owner;
-- No public/user-facing fixture accessor or grant. Reviewed sessions load this
-- local-admin-owned row before SET ROLE, then exercise only the real user RPC.
insert into auth.users(id) values('dddddddd-1111-4111-8111-111111111111');
insert into public.projects(id,name) values('dddddddd-2222-4222-8222-222222222222','EPS LOCAL LOGO SQL POLICY RACE V1');
insert into public.project_memberships(project_id,principal_id,can_write)
  values('dddddddd-2222-4222-8222-222222222222','dddddddd-1111-4111-8111-111111111111',true);
insert into public.app_capability_grants(principal_id,capability)
  select 'dddddddd-1111-4111-8111-111111111111'::uuid,capability from unnest(array['projects.read','workspaces.read','workspaces.write']) capability;
insert into eps.workspaces(id,project_id) values('dddddddd-3333-4333-8333-333333333333','dddddddd-2222-4222-8222-222222222222');
insert into eps.logo_verification_keys(key_id,secret,not_before,not_after)
  values('eps-local-logo-race-v1',decode(repeat('09',32),'hex'),now()-interval '1 day',now()+interval '1 day');
set local role authenticated;
do $$ begin
  perform set_config('request.jwt.claim.sub','dddddddd-1111-4111-8111-111111111111',true);
  perform set_config('request.jwt.claims','{"sub":"dddddddd-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
  perform set_config('eps.logo_race.reservation',public.eps_reserve_logo_upload(
    '{"workspace_id":"dddddddd-3333-4333-8333-333333333333","purpose":"client_logo","filename":"eps-local-logo-sql-race.png","mime_type":"image/png","size_bytes":1234}',
    'eps-local-logo-race-reserve')::text,true);
end $$;
reset role;
do $$ declare reservation jsonb; claims jsonb; bytes bytea; issued bigint; begin
  reservation:=current_setting('eps.logo_race.reservation')::jsonb;
  if reservation->>'status'<>'open' or reservation->'asset'->>'status'<>'uploading'
    or reservation->>'principal_id'<>'dddddddd-1111-4111-8111-111111111111'
    or reservation->>'workspace_id'<>'dddddddd-3333-4333-8333-333333333333'
  then raise exception 'LOGO_RACE_RESERVATION_INVALID'; end if;
  issued:=floor(extract(epoch from clock_timestamp()))::bigint;
  claims:=jsonb_build_object('schema_version','1.0','audience','eps.logo-verification.v1','purpose','client_logo','key_id','eps-local-logo-race-v1',
    'verification_id',reservation->>'verification_id','upload_id',reservation->>'upload_id','asset_id',reservation->'asset'->>'id',
    'principal_id',reservation->>'principal_id','workspace_id',reservation->>'workspace_id','reservation_revision',(reservation->>'reservation_revision')::bigint,
    'bucket',reservation->>'bucket','object_key',reservation->>'object_key','size_bytes',1234,'sha256',repeat('b',64),
    'mime_type','image/png','width',128,'height',64,'issued_at',issued,'expires_at',issued+120);
  bytes:=convert_to(claims::text,'UTF8');
  insert into eps_local_guard.logo_race_fixture(fixture_id,marker,principal_id,project_id,workspace_id,upload_id,asset_id,reservation,completion_input,proof_payload,proof_mac)
    values(1,'EPS LOCAL LOGO SQL POLICY RACE V1','dddddddd-1111-4111-8111-111111111111','dddddddd-2222-4222-8222-222222222222','dddddddd-3333-4333-8333-333333333333',
      (reservation->>'upload_id')::uuid,(reservation->'asset'->>'id')::uuid,reservation,'{"actual_size_bytes":1234,"start_processing":false}',
      rtrim(translate(replace(encode(bytes,'base64'),E'\n',''),'+/','-_'),'='),
      rtrim(translate(replace(encode(extensions.hmac(bytes,decode(repeat('09',32),'hex'),'sha256'),'base64'),E'\n',''),'+/','-_'),'='));
end $$;
commit;
