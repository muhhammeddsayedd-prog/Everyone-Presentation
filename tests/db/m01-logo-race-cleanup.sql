-- LOCAL-ONLY scoped cleanup, also valid after either concurrent claim fails.
-- Unexpected data is preserved; there is no CASCADE, reset or byte deletion.
begin;
do $$ declare fixture eps_local_guard.logo_race_fixture; begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
  select * into strict fixture from eps_local_guard.logo_race_fixture where fixture_id=1 and marker='EPS LOCAL LOGO SQL POLICY RACE V1';
  if (select count(*) from eps_local_guard.logo_race_fixture)<>1
    or fixture.principal_id<>'dddddddd-1111-4111-8111-111111111111' or fixture.project_id<>'dddddddd-2222-4222-8222-222222222222' or fixture.workspace_id<>'dddddddd-3333-4333-8333-333333333333'
    or fixture.upload_id is distinct from (fixture.reservation->>'upload_id')::uuid or fixture.asset_id is distinct from (fixture.reservation->'asset'->>'id')::uuid
    or not exists(select 1 from public.projects where id=fixture.project_id and name=fixture.marker and client_id is null and archived_at is null and row_version=1)
    or (select count(*) from eps.workspaces where project_id=fixture.project_id)<>1
    or not exists(select 1 from eps.workspaces where id=fixture.workspace_id and project_id=fixture.project_id and logo_asset_id is null and archived_at is null and row_version=1 and draft_revision=0)
    or (select count(*) from public.project_memberships where principal_id=fixture.principal_id or project_id=fixture.project_id)<>1
    or not exists(select 1 from public.project_memberships where principal_id=fixture.principal_id and project_id=fixture.project_id and active and can_write)
    or exists(select 1 from public.client_memberships where principal_id=fixture.principal_id)
    or (select count(*) from public.app_capability_grants where principal_id=fixture.principal_id)<>3
    or exists(select 1 from public.app_capability_grants where principal_id=fixture.principal_id and (not active or capability not in('projects.read','workspaces.read','workspaces.write')))
    or exists(select 1 from eps.user_workspace_preferences where principal_id=fixture.principal_id or workspace_id=fixture.workspace_id)
    or (select count(*) from eps.media_assets where origin_workspace_id=fixture.workspace_id)<>1
    or not exists(select 1 from eps.media_assets where id=fixture.asset_id and origin_workspace_id=fixture.workspace_id and client_id is null and purpose='client_logo' and filename='eps-local-logo-sql-race.png' and mime_type='image/png' and size_bytes=1234
      and bucket='eps-brand-assets' and object_key=fixture.reservation->>'object_key' and (status='uploading' and sha256 is null and width is null and height is null or status='ready' and sha256=repeat('b',64) and width=128 and height=64))
    or (select count(*) from eps.upload_sessions where principal_id=fixture.principal_id or workspace_id=fixture.workspace_id)<>1
    or not exists(select 1 from eps.upload_sessions where id=fixture.upload_id and asset_id=fixture.asset_id and workspace_id=fixture.workspace_id and principal_id=fixture.principal_id and reservation_revision=1
      and verification_id=(fixture.reservation->>'verification_id')::uuid and purpose='client_logo' and expected_size_bytes=1234 and expected_mime_type='image/png' and expected_sha256 is null
      and bucket='eps-brand-assets' and object_key=fixture.reservation->>'object_key' and status in('open','completed'))
    or not exists(select 1 from eps.upload_sessions upload join eps.media_assets asset on asset.id=upload.asset_id where upload.id=fixture.upload_id
      and (upload.status='open' and asset.status='uploading' or upload.status='completed' and asset.status='ready'))
    or not exists(select 1 from eps.logo_verification_keys where key_id='eps-local-logo-race-v1' and purpose='client_logo' and secret=decode(repeat('09',32),'hex') and revoked_at is null)
    or exists(select 1 from public.clients where logo_asset_id=fixture.asset_id)
    or exists(select 1 from eps.workspaces where logo_asset_id=fixture.asset_id)
    or exists(select 1 from storage.objects where bucket_id='eps-brand-assets' and name=fixture.reservation->>'object_key')
    or exists(select 1 from eps.audit_events where principal_id=fixture.principal_id and not(action='create_upload_session' and resource_id=fixture.upload_id or action='complete_upload' and resource_id=fixture.asset_id))
    or (select count(*) from eps.audit_events where principal_id=fixture.principal_id and action='create_upload_session')<>1
    or (select count(*) from eps.audit_events where principal_id=fixture.principal_id and action='complete_upload')>1
    or exists(select 1 from eps.idempotency_records where principal_id=fixture.principal_id and not(operation='create_upload_session' and key='eps-local-logo-race-reserve' or operation='complete_upload' and key in('eps-local-logo-race-a','eps-local-logo-race-b')))
    or (select count(*) from eps.idempotency_records where principal_id=fixture.principal_id and operation='create_upload_session')<>1
    or (select count(*) from eps.idempotency_records where principal_id=fixture.principal_id and operation='complete_upload')>2
  then raise exception 'LOGO_RACE_FIXTURE_OWNERSHIP_MISMATCH_PRESERVE_DATA'; end if;
  delete from eps.audit_events where principal_id=fixture.principal_id;
  delete from eps.idempotency_records where principal_id=fixture.principal_id;
  delete from eps.upload_sessions where id=fixture.upload_id;
  delete from eps.media_assets where id=fixture.asset_id;
  delete from eps.workspaces where id=fixture.workspace_id;
  delete from public.project_memberships where principal_id=fixture.principal_id and project_id=fixture.project_id;
  delete from public.app_capability_grants where principal_id=fixture.principal_id;
  delete from public.projects where id=fixture.project_id;
  delete from eps.logo_verification_keys where key_id='eps-local-logo-race-v1';
  delete from auth.users where id=fixture.principal_id;
end $$;
drop table eps_local_guard.logo_race_fixture;
commit;
