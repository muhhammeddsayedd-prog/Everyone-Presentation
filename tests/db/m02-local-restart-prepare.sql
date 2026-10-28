begin;
do $$ begin
 if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local'
   or not exists(select 1 from eps_local_guard.m02_fixture where id=1 and marker='EPS M02 LOCAL DURABILITY V1')
   or (select count(*) from eps.jobs)<>2 or (select count(*) from eps.outbox_events where status='delivered')<>2
 then raise exception 'M02_RESTART_FIXTURE_STATE_INVALID'; end if;
end $$;
-- Restore only this intentionally revoked synthetic membership, never live users.
update public.project_memberships set active=true where principal_id='7a111111-1111-4111-8111-111111111111' and project_id='7b111111-1111-4111-8111-111111111111' and not active;
select set_config('request.jwt.claim.sub','7a111111-1111-4111-8111-111111111111',true);
select set_config('request.jwt.claims','{"sub":"7a111111-1111-4111-8111-111111111111","role":"authenticated","is_anonymous":false}',true);
select set_config('eps.m02.input',(select jsonb_set(input,'{specs_id}','"7d333333-3333-4333-8333-333333333333"')::text from eps_local_guard.m02_fixture),true);
set local role eps_jobs_owner;
do $$ begin perform eps.m02_enqueue_specs_job('7c111111-1111-4111-8111-111111111111',current_setting('eps.m02.input')::jsonb,'m02-local-restart'); end $$;
reset role;
commit;
