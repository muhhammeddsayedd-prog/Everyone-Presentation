-- Synthetic cancellation-state injection, not the public cancellation API.
begin;
set local search_path='';
select eps_local_guard.native_specs_fixture_require();
do $$ declare job eps.jobs; changed bigint; begin
 perform 1 from eps.workspaces where id='7c980000-0000-4000-8000-000000000002' for update;
 perform 1 from eps.specs where workspace_id='7c980000-0000-4000-8000-000000000002' for update;
 select * into job from eps.jobs where id='7f980000-0000-4000-8000-000000000002' for update;
 if not found or job.workspace_id<>'7c980000-0000-4000-8000-000000000002' or job.status<>'running' or job.stage<>'apply_specs'
  or job.attempt<>3 or jsonb_array_length(job.completed_stages)<>2 or not eps.specs_stage_source_matches(job)
 then raise exception 'NATIVE_CANCEL_STATE_REFUSED'; end if;
 update eps.jobs set status='cancelled',cancel_requested_at=clock_timestamp(),lease_token_digest=null,lease_expires_at=null,
  row_version=row_version+1,updated_at=clock_timestamp() where id=job.id and row_version=job.row_version;
 get diagnostics changed=row_count; if changed<>1 then raise exception 'NATIVE_CANCEL_WRITE_REFUSED'; end if;
end $$;
select jsonb_build_object('cancelled',true);
commit;
