-- Controlled synthetic expiry after a real same-container/volume restart.
begin;
set local search_path='';
select eps_local_guard.native_specs_fixture_require();
do $$ declare job eps.jobs; changed bigint; begin
 perform 1 from eps.workspaces where id='7c980000-0000-4000-8000-000000000004' for update;
 perform 1 from eps.specs where workspace_id='7c980000-0000-4000-8000-000000000004' for update;
 select * into job from eps.jobs where id='7f980000-0000-4000-8000-000000000004' for update;
 if not found or job.status<>'running' or job.stage<>'prepare_document' or job.attempt<>1 or job.dispatch_generation<>1
  or job.current_attempt_id is null or job.completed_stages<>'[]' or not eps.specs_stage_source_matches(job)
 then raise exception 'NATIVE_EXPIRY_STATE_REFUSED'; end if;
 update eps.jobs set lease_expires_at=clock_timestamp()-interval '1 second' where id=job.id and row_version=job.row_version;
 get diagnostics changed=row_count; if changed<>1 then raise exception 'NATIVE_EXPIRY_WRITE_REFUSED'; end if;
end $$;
select jsonb_build_object('expired',true);
commit;
