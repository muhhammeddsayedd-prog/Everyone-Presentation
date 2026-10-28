begin;
set local application_name='eps_specs_conflict_a';
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
select set_config('eps.specs.role',(select role_id::text from eps_local_guard.specs_local_fixture where id=1 and marker='EPS SPECS LOCAL V1'),true);
select set_config('request.jwt.claim.sub','7a720000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7a720000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select jsonb_build_object('phase','started','session_pid',pg_backend_pid(),'at',clock_timestamp());
set local role authenticated;
do $$ begin
 begin perform public.eps_update_role(current_setting('eps.specs.role')::uuid,'{"row_version":1,"name":"Concurrent rename"}','specs-local-rename'); perform set_config('eps.specs.outcome','applied',true);
 exception when others then if sqlerrm='STALE_RESOURCE_VERSION' then perform set_config('eps.specs.outcome','stale',true); else raise; end if; end;
end $$;
reset role;
select jsonb_build_object('phase','returned','session_pid',pg_backend_pid(),'at',clock_timestamp(),'outcome',current_setting('eps.specs.outcome'));
select pg_sleep(6);
commit;
