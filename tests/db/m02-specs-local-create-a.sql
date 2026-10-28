begin;
set local application_name='eps_specs_create_a';
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
select set_config('eps.specs.input',(select role_input::text from eps_local_guard.specs_local_fixture where id=1 and marker='EPS SPECS LOCAL V1'),true);
select set_config('request.jwt.claim.sub','7a720000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"7a720000-0000-4000-8000-000000000001","role":"authenticated","is_anonymous":false}',true);
select jsonb_build_object('phase','started','session_pid',pg_backend_pid(),'at',clock_timestamp());
set local role authenticated;
do $$ declare response jsonb; begin response:=public.eps_create_role('7c710000-0000-4000-8000-000000000001',current_setting('eps.specs.input')::jsonb,'specs-local-create'); perform set_config('eps.specs.role',response->>'id',true); end $$;
reset role;
do $$ declare changed integer; begin
 update eps_local_guard.specs_local_fixture set role_id=current_setting('eps.specs.role')::uuid where id=1 and (role_id is null or role_id=current_setting('eps.specs.role')::uuid);
 get diagnostics changed=row_count; if changed<>1 then raise exception 'SPECS_LOCAL_DIFFERENT_REPLAY_ID'; end if;
end $$;
select jsonb_build_object('phase','returned','session_pid',pg_backend_pid(),'at',clock_timestamp(),'role_id',current_setting('eps.specs.role'));
select pg_sleep(6);
commit;
