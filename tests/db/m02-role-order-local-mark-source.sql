begin;
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
set local application_name='eps_order_source_a';
do $$ declare changed integer; begin
 if not exists(select 1 from eps_local_guard.role_order_fixture where id=1 and marker='EPS ROLE ORDER LOCAL V1') then raise exception 'ROLE_ORDER_LOCAL_FIXTURE_REQUIRED'; end if;
 perform 1 from eps.workspaces where id='7c940000-0000-4000-8000-000000000001' for update;
 perform 1 from eps.specs where workspace_id='7c940000-0000-4000-8000-000000000001' for update;
 update eps.specs set source_text='SYNTHETIC ROLE ORDER SOURCE - CLEANUP MUST PRESERVE'
  where workspace_id='7c940000-0000-4000-8000-000000000001' and source_text is null and row_version=1 and source_row_version=1;
 get diagnostics changed=row_count; if changed<>1 then raise exception 'ROLE_ORDER_LOCAL_SOURCE_NOT_OWNED'; end if;
end $$;
select jsonb_build_object('phase','holding','session_pid',pg_backend_pid(),'at',clock_timestamp());
select pg_sleep(6);
commit;
