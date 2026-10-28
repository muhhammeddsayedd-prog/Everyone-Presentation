begin;
set local application_name='eps_specs_revoke_b';
set local lock_timeout='10s';
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
select set_config('eps.specs.input',(select role_input::text from eps_local_guard.specs_local_fixture where id=1 and marker='EPS SPECS LOCAL V1'),true);
select set_config('request.jwt.claim.sub','7a720000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7a720000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select jsonb_build_object('phase','started','session_pid',pg_backend_pid(),'at',clock_timestamp());
set local role authenticated;
do $$ begin
 begin perform public.eps_create_role('7c710000-0000-4000-8000-000000000001',current_setting('eps.specs.input')::jsonb,'specs-local-create');
 exception when others then if sqlerrm='RESOURCE_NOT_FOUND' then return; else raise; end if; end;
 raise exception 'SPECS_LOCAL_REVOKED_REPLAY_EXPOSED';
end $$;
reset role;
select jsonb_build_object('phase','returned','session_pid',pg_backend_pid(),'at',clock_timestamp(),'revoked_replay_denied',true);
commit;
