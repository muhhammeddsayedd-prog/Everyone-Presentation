-- LOCAL-ONLY verification after the two pairs of real concurrent sessions finish.
begin;
do $$ declare workspaces integer; records integer; audit integer; distinct_ids integer; begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
  select count(*) into workspaces from eps.workspaces where project_id in ('eeeeeeee-2222-4222-8222-222222222221','eeeeeeee-2222-4222-8222-222222222222') and archived_at is null;
  if workspaces<>2 then raise exception 'RACE_EXPECTED_ONE_WORKSPACE_PER_PROJECT: %',workspaces; end if;
  select count(*),count(distinct response->>'id') into records,distinct_ids from eps.idempotency_records where principal_id='eeeeeeee-1111-4111-8111-111111111111' and operation='create_workspace';
  if records<>3 or distinct_ids<>2 then raise exception 'RACE_IDEMPOTENCY_RESULT_MISMATCH: %, %',records,distinct_ids; end if;
  select count(*) into audit from eps.audit_events where principal_id='eeeeeeee-1111-4111-8111-111111111111' and action='create_workspace';
  if audit<>3 then raise exception 'RACE_SIDE_EFFECT_COUNT_MISMATCH: %',audit; end if;
end $$;
select 'Real concurrent same-key and distinct-key workspace assertions passed' as result;
rollback;
