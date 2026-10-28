begin;
do $$ begin if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_TARGET_REQUIRED'; end if; end $$;
do $$ declare changed integer; begin
 if not exists(select 1 from eps_local_guard.role_order_fixture where id=1 and marker='EPS ROLE ORDER LOCAL V1') then raise exception 'ROLE_ORDER_LOCAL_FIXTURE_REQUIRED'; end if;
 perform 1 from eps.workspaces where id='7c940000-0000-4000-8000-000000000001' for update;
 perform 1 from eps.specs where workspace_id='7c940000-0000-4000-8000-000000000001' for update;
 update eps.specs set source_text=null where workspace_id='7c940000-0000-4000-8000-000000000001'
  and source_text='SYNTHETIC ROLE ORDER SOURCE - CLEANUP MUST PRESERVE' and row_version=1 and source_row_version=1
  and source_asset_id is null and processing_job_id is null;
 get diagnostics changed=row_count; if changed<>1 then raise exception 'ROLE_ORDER_LOCAL_SOURCE_CHANGED_PRESERVE_DATA'; end if;
end $$;
select jsonb_build_object('known_synthetic_source_survived',true,'only_known_sentinel_restored',true);
commit;
