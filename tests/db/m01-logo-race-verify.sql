-- LOCAL-ONLY verification after two actual independent PostgreSQL sessions.
begin read only;
do $$ declare fixture eps_local_guard.logo_race_fixture; records integer; responses integer; begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
  select * into strict fixture from eps_local_guard.logo_race_fixture where fixture_id=1 and marker='EPS LOCAL LOGO SQL POLICY RACE V1';
  if (select count(*) from eps.media_assets where origin_workspace_id=fixture.workspace_id)<>1
    or not exists(select 1 from eps.media_assets where id=fixture.asset_id and origin_workspace_id=fixture.workspace_id and status='ready' and sha256=repeat('b',64) and size_bytes=1234 and width=128 and height=64)
    or (select count(*) from eps.upload_sessions where workspace_id=fixture.workspace_id)<>1
    or not exists(select 1 from eps.upload_sessions where id=fixture.upload_id and asset_id=fixture.asset_id and principal_id=fixture.principal_id and status='completed' and completed_at is not null and reservation_revision=1)
  then raise exception 'LOGO_RACE_EXPECTED_ONE_READY_ASSET_AND_COMPLETED_RESERVATION'; end if;
  select count(*),count(distinct response::text) into records,responses from eps.idempotency_records where principal_id=fixture.principal_id and operation='complete_upload';
  if records<>2 or responses<>1 or (select count(*) from eps.idempotency_records where principal_id=fixture.principal_id and operation='complete_upload' and key in('eps-local-logo-race-a','eps-local-logo-race-b')
    and request_hash=encode(sha256(convert_to(jsonb_build_object('id',fixture.upload_id,'input',fixture.completion_input)::text,'UTF8')),'hex')
    and response->>'status'='ready' and response->'asset'->>'id'=fixture.asset_id::text)<>2
  then raise exception 'LOGO_RACE_EXPECTED_TWO_KEYS_SAME_IMMUTABLE_RESPONSE'; end if;
  if (select count(*) from eps.audit_events where principal_id=fixture.principal_id and action='complete_upload')<>1
    or not exists(select 1 from eps.audit_events where principal_id=fixture.principal_id and action='complete_upload' and resource_id=fixture.asset_id)
  then raise exception 'LOGO_RACE_EXPECTED_ONE_READY_TRANSITION_AUDIT'; end if;
  if exists(select 1 from storage.objects where bucket_id='eps-brand-assets' and name=fixture.reservation->>'object_key') then raise exception 'LOGO_RACE_UNEXPECTED_STORAGE_BYTES_METADATA'; end if;
end $$;
select 'Two distinct-key completion claims produced one Ready transition, one audit and two equal replay records; SQL proof fixture only, no Storage HTTP/image-byte acceptance.' as result;
rollback;
