set local role postgres;
-- Refresh only injected synthetic fit results after the intentional draft edit.
update eps.review_fit_results f set input_fingerprint=eps.review_snapshot_data(f.workspace_id,f.series_id,null)->>'input_fingerprint'where f.workspace_id=current_setting('eps.casting.fixture.workspace')::uuid;
set local role authenticated;
do $$declare r jsonb;body jsonb;ack jsonb;purpose text;begin
 r:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.m05.selection')::uuid,null);body:=jsonb_build_object('expected_workspace_row_version',public.eps_get_workspace(current_setting('eps.casting.fixture.workspace')::uuid)->'row_version','expected_draft_revision',r->'draft_revision','expected_input_fingerprint',r->'input_fingerprint');
 foreach purpose in array array['cancel','retry','recover']loop ack:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body,'m05-lifecycle-'||purpose);perform set_config('eps.m05.'||purpose||'.job',ack->>'job_id',true);perform set_config('eps.m05.'||purpose||'.version',ack->>'resource_id',true);end loop;
 begin perform public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body||'{"expected_input_fingerprint":null}','m05-null-fingerprint');raise exception'M05_NULL_FP_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 begin perform public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body||'{"expected_draft_revision":null}','m05-null-draft');raise exception'M05_NULL_DRAFT_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 begin perform public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body||'{"expected_workspace_row_version":null}','m05-null-rowversion');raise exception'M05_NULL_ROWVERSION_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 begin perform public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body||jsonb_build_object('expected_draft_revision',(body->>'expected_draft_revision')::integer+1),'m05-stale-draft');raise exception'M05_STALE_DRAFT_ACCEPTED';exception when raise_exception then if sqlerrm<>'INPUT_CHANGED'then raise;end if;end;
 begin perform public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body||jsonb_build_object('expected_workspace_row_version',(body->>'expected_workspace_row_version')::integer+1),'m05-stale-rowversion');raise exception'M05_STALE_ROWVERSION_ACCEPTED';exception when raise_exception then if sqlerrm<>'STALE_RESOURCE_VERSION'then raise;end if;end;
 begin perform public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body||jsonb_build_object('expected_input_fingerprint',repeat('f',64)),'m05-stale-full-fingerprint');raise exception'M05_STALE_FP_ACCEPTED';exception when raise_exception then if sqlerrm<>'INPUT_CHANGED'then raise;end if;end;
end$$;
set local role postgres;
do $$declare purpose text;begin foreach purpose in array array['cancel','retry','recover']loop perform set_config('eps.m05.'||purpose||'.hash',(select input_hash from eps.jobs where id=current_setting('eps.m05.'||purpose||'.job')::uuid),true);end loop;end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare lease jsonb;begin lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.m05.cancel.job'),'stage','prepare_presentation','input_hash',current_setting('eps.m05.cancel.hash')));perform set_config('eps.m05.cancel.lease',lease::text,true);end$$;
set local role postgres;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare job jsonb;body jsonb;ack jsonb;begin
 job:=public.eps_get_job(current_setting('eps.m05.cancel.job')::uuid);if job->'can_cancel'<>'true'or job->'can_retry'<>'false'then raise exception'M05_CANCEL_ACTIONS_FAILED';end if;body:=jsonb_build_object('row_version',job->'row_version');ack:=public.eps_cancel_job((job->>'id')::uuid,body,'m05-cancel');if ack<>public.eps_cancel_job((job->>'id')::uuid,body,'m05-cancel')then raise exception'M05_CANCEL_ACK_FAILED';end if;
 if public.eps_get_version(current_setting('eps.m05.cancel.version')::uuid)->>'failure_code'<>'JOB_CANCELLED'then raise exception'M05_CANCEL_VERSION_LIFECYCLE_FAILED';end if;
 begin perform public.eps_retry_job((job->>'id')::uuid,jsonb_build_object('row_version',ack->'row_version'),'m05-retry-cancelled');raise exception'M05_CANCELLED_RETRIED';exception when raise_exception then if sqlerrm<>'INVALID_TRANSITION'then raise;end if;end;
end$$;
set local role postgres;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare lease jsonb:=current_setting('eps.m05.cancel.lease')::jsonb;receipt jsonb;begin
 receipt:=eps.record_job_event(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage',lease->'stage','input_hash',current_setting('eps.m05.cancel.hash'),'event_id','m05-cancelled-late','sequence',1,'event_type','heartbeat'));if receipt->'stale'<>'true'or receipt->'applied'<>'false'then raise exception'M05_CANCEL_LATE_CALLBACK_APPLIED';end if;
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.m05.retry.job'),'stage','prepare_presentation','input_hash',current_setting('eps.m05.retry.hash')));receipt:=eps.record_job_event(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage',lease->'stage','input_hash',current_setting('eps.m05.retry.hash'),'event_id','m05-fail-budget','sequence',1,'event_type','failed','error',jsonb_build_object('code','PDF_BUDGET_EXCEEDED','message','Untrusted detail must not persist.','details',jsonb_build_object('secret','do not persist'),'retryable',false)));if receipt->>'job_status'<>'failed'then raise exception'M05_FAILURE_DID_NOT_FAIL_VERSION';end if;
end$$;
set local role postgres;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare job jsonb;ack jsonb;body jsonb;begin
 job:=public.eps_get_job(current_setting('eps.m05.retry.job')::uuid);if job->'can_retry'<>'true'or job->'can_cancel'<>'false'or job#>>'{error,code}'<>'PDF_BUDGET_EXCEEDED'or position('Untrusted detail'in job::text)>0 or job#>'{error,details}'<>'{}'then raise exception'M05_FAILURE_ACTION_OR_SAFE_ERROR_FAILED';end if;
 body:=jsonb_build_object('row_version',job->'row_version');ack:=public.eps_retry_job((job->>'id')::uuid,body,'m05-explicit-retry');if ack<>public.eps_retry_job((job->>'id')::uuid,body,'m05-explicit-retry')then raise exception'M05_RETRY_ACK_FAILED';end if;
 if public.eps_get_version(current_setting('eps.m05.retry.version')::uuid)->>'status'<>'queued'then raise exception'M05_RETRY_VERSION_RESET_FAILED';end if;
end$$;
set local role postgres;
do $$begin if(select attempt<>1 or stage_attempts?'prepare_presentation'from eps.jobs where id=current_setting('eps.m05.retry.job')::uuid)then raise exception'M05_RETRY_COUNTER_MONOTONICITY_FAILED';end if;end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare lease jsonb;source jsonb;begin
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.m05.retry.job'),'stage','prepare_presentation','input_hash',current_setting('eps.m05.retry.hash')));source:=eps.get_specs_stage_input((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token');if source->>'version_id'<>current_setting('eps.m05.retry.version')or source#>>'{snapshot,slides,1,fields,height_measurements}'<>'181 cm'then raise exception'M05_RETRY_RECAPTURED_LIVE_INPUT';end if;
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.m05.recover.job'),'stage','prepare_presentation','input_hash',current_setting('eps.m05.recover.hash')));source:=eps.get_specs_stage_input((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 perform eps.record_job_event(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage',lease->'stage','input_hash',current_setting('eps.m05.recover.hash'),'event_id','m05-recovery-prepare','sequence',1,'event_type','succeeded','result_schema','presentation-preparation.v1','result',jsonb_build_object('schema_version','1.0','version_id',source->'version_id','snapshot_sha256',source->'snapshot_sha256','manifest_sha256',source->'manifest_sha256','inventory_sha256',source->'inventory_sha256','template_content_sha256',source#>'{snapshot,template,content_sha256}','font_hashes',source#>'{snapshot,template,font_hashes}','renderer_version',source#>'{configuration,renderer_version}','prepared_at','2026-10-29T20:00:00.000000Z')));
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.m05.recover.job'),'stage','render_presentation','input_hash',current_setting('eps.m05.recover.hash')));perform set_config('eps.m05.recover.lease',lease::text,true);
end$$;
set local role eps_specs_assets_executor;
do $$declare lease jsonb:=current_setting('eps.m05.recover.lease')::jsonb;asset jsonb;grant_value jsonb;begin
 asset:=eps.reserve_job_output(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','output_key','presentation_pdf','asset_kind','presentation_pdf','filename','presentation.pdf','mime_type','application/pdf','expected_size_bytes',100,'parent_asset_id',null,'time_offset_ms',null));perform set_config('eps.m05.recover.orphan',asset#>>'{asset,id}',true);
 grant_value:=eps.get_job_asset_access(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',asset#>'{asset,id}','access','write'));perform set_config('eps.m05.recover.oldgrant',grant_value::text,true);
 perform eps.complete_job_output(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',asset#>'{asset,id}','sha256',repeat('b',64),'actual_size_bytes',100,'width',null,'height',null,'duration_ms',null));
end$$;
set local role postgres;
update eps.jobs set lease_expires_at=clock_timestamp()-interval'1second'where id=current_setting('eps.m05.recover.job')::uuid;
set local role eps_jobs_executor;
select eps.recover_job_stages(25);
set local role postgres;
do $$begin if(select status<>'queued'or stage<>'render_presentation'or attempt<>2 or error->>'code'<>'LEASE_EXPIRED'from eps.jobs where id=current_setting('eps.m05.recover.job')::uuid)then raise exception'M05_RECOVERY_STATE_FAILED';end if;end$$;
update eps.jobs set available_at=clock_timestamp()where id=current_setting('eps.m05.recover.job')::uuid;
set local role eps_jobs_executor;
do $$declare lease jsonb;source jsonb;begin
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.m05.recover.job'),'stage','render_presentation','input_hash',current_setting('eps.m05.recover.hash')));source:=eps.get_specs_stage_input((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token');if source->>'version_id'<>current_setting('eps.m05.recover.version')or lease->>'attempt_id'=current_setting('eps.m05.recover.lease')::jsonb->>'attempt_id'or source->'rendered'<>'null'::jsonb or source->'prepared'='null'::jsonb then raise exception'M05_RECOVERY_IMMUTABLE_VERSION_OR_FRESH_ATTEMPT_FAILED';end if;
 execute'set local role eps_specs_assets_executor';
 begin perform eps.get_job_asset_access(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id',current_setting('eps.m05.recover.orphan')));raise exception'M05_UNCOMMITTED_PRIOR_ATTEMPT_READ';exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
 source:=eps.reserve_job_output(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','output_key','presentation_pdf','asset_kind','presentation_pdf','filename','presentation.pdf','mime_type','application/pdf','expected_size_bytes',100,'parent_asset_id',null,'time_offset_ms',null));if source#>>'{asset,id}'=current_setting('eps.m05.recover.orphan')then raise exception'M05_RECOVERY_OVERWROTE_OLD_OUTPUT';end if;execute'set local role eps_jobs_executor';
end$$;
select'M05_STRICT_GENERATE_GUARDS_CANCEL_LATE_CALLBACK_SAFE_FAILURE_EXPLICIT_RETRY_AND_RECOVERY_PASSED';
