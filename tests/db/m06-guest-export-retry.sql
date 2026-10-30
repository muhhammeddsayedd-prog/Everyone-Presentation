-- Rollback-only forward26 protocol proof. Uses the admission fixture's live
-- link/session and actual anon gateway + worker roles. Artifact reservations
-- are synthetic metadata, not a native PDF or Storage/browser acceptance.
set local role postgres;
select set_config('eps.m06.retry.canonical_before',(select eps.presentation_hash(to_jsonb(v))from eps.presentation_versions v where id=current_setting('eps.m05.selection.version')::uuid),true);
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare prepared jsonb;request jsonb:=jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m05.selection.version'),'idempotency_key','m06-26-first-guest-prepare');begin
 begin perform eps.retry_guest_pdf_export(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());raise exception'M06_26_ANON_PRIVATE_RETRY_EXECUTE';exception when insufficient_privilege or undefined_function then null;end;
 prepared:=pg_temp.m06_call('prepare_export',request);
 if prepared#>>'{export,status}'<>'queued'or prepared->'cached'<>'false'then raise exception'M06_26_INITIAL_GUEST_EXPORT_NOT_QUEUED';end if;
 perform set_config('eps.m06.retry.export',prepared#>>'{export,id}',true);perform set_config('eps.m06.retry.job',prepared->>'job_id',true);
 if prepared<>pg_temp.m06_call('prepare_export',request)then raise exception'M06_26_INITIAL_PREPARE_REPLAY_FAILED';end if;
end$$;
set local role postgres;
do $$declare item eps.jobs;begin
 select * into item from eps.jobs where id=current_setting('eps.m06.retry.job')::uuid;
 perform set_config('eps.m06.retry.hash',item.input_hash,true);perform set_config('eps.m06.retry.input',item.input::text,true);
 -- An unrelated completed stage budget is deliberately injected to prove the
 -- helper only removes render_export, rather than resetting every stage.
 update eps.jobs set stage_attempts=stage_attempts||'{"synthetic_retained_stage":2}'::jsonb where id=item.id;
end$$;
set local role eps_jobs_executor;
do $$declare lease jsonb;grant_value jsonb;asset jsonb;job uuid:=current_setting('eps.m06.retry.job')::uuid;begin
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',job,'stage','render_export','input_hash',current_setting('eps.m06.retry.hash')));
 perform set_config('eps.m06.retry.first_attempt',lease->>'attempt_id',true);perform set_config('eps.m06.retry.first_lease',lease->>'lease_token',true);
 grant_value:=eps.mint_review_media_grant(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token'));
 perform set_config('eps.m06.retry.first_grant',grant_value->>'grant_id',true);
 execute'set local role eps_specs_assets_executor';
 asset:=eps.reserve_job_output(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','output_key','presentation_pdf','asset_kind','presentation_pdf','filename','presentation.pdf','mime_type','application/pdf','expected_size_bytes',100,'parent_asset_id',null,'time_offset_ms',null));
 perform set_config('eps.m06.retry.first_asset',asset#>>'{asset,id}',true);
 execute'set local role eps_jobs_executor';
 perform eps.record_job_event(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','render_export','input_hash',current_setting('eps.m06.retry.hash'),'event_id','m06-26-injected-pdf-failure','sequence',1,'event_type','failed','error',jsonb_build_object('code','PDF_INVALID','message','Synthetic PDF validation failure','details','{}'::jsonb,'retryable',false)));
end$$;
set local role postgres;
do $$declare item eps.jobs;begin
 select * into item from eps.jobs where id=current_setting('eps.m06.retry.job')::uuid;
 if item.status<>'failed'or item.attempt<>1 or item.stage_attempts<>'{"render_export":1,"synthetic_retained_stage":2}'::jsonb or not exists(select 1 from eps.presentation_exports where id=current_setting('eps.m06.retry.export')::uuid and status='failed')or not exists(select 1 from eps.review_media_grants where id=current_setting('eps.m06.retry.first_grant')::uuid and revoked_at is not null)then raise exception'M06_26_FAILURE_FIXTURE_OR_GRANT_REVOCATION_FAILED';end if;
 perform set_config('eps.m06.retry.generation_before',item.dispatch_generation::text,true);
 perform set_config('eps.m06.retry.outbox_before',(select count(*)from eps.outbox_events where job_id=item.id)::text,true);
end$$;
set local role anon;
do $$declare request jsonb:=jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m05.selection.version'),'idempotency_key','m06-26-retry-guest-prepare');first jsonb;begin
 first:=pg_temp.m06_call('prepare_export',request);
 if first#>>'{export,id}'<>current_setting('eps.m06.retry.export')or first->>'job_id'<>current_setting('eps.m06.retry.job')or first#>>'{export,status}'<>'queued'or first->'cached'<>'false'then raise exception'M06_26_GUEST_FAILED_EXPORT_NOT_REQUEUED';end if;
 if first<>pg_temp.m06_call('prepare_export',request)then raise exception'M06_26_GUEST_RETRY_LOST_ACK_REPLAY_FAILED';end if;
end$$;
set local role postgres;
do $$declare item eps.jobs;begin
 select * into item from eps.jobs where id=current_setting('eps.m06.retry.job')::uuid;
 if item.status<>'queued'or item.attempt<>1 or item.current_attempt_id<>current_setting('eps.m06.retry.first_attempt')::uuid or item.stage_attempts<>'{"synthetic_retained_stage":2}'::jsonb or item.lease_token_digest is not null or item.lease_expires_at is not null or item.error is not null or item.result is not null or item.input_hash<>current_setting('eps.m06.retry.hash')or item.input<>current_setting('eps.m06.retry.input')::jsonb then raise exception'M06_26_RETRY_CHANGED_FROZEN_JOB_OR_RESET_WRONG_BUDGET';end if;
 if item.dispatch_generation<>current_setting('eps.m06.retry.generation_before')::bigint+1 or(select count(*)from eps.outbox_events where job_id=item.id)<>current_setting('eps.m06.retry.outbox_before')::bigint+1 then raise exception'M06_26_DUPLICATE_RETRY_DISPATCH_EFFECT';end if;
 if(select count(*)from eps.presentation_exports where review_link_id=current_setting('eps.m06.admission.link')::uuid and version_id=current_setting('eps.m05.selection.version')::uuid)<>1 then raise exception'M06_26_RETRY_CREATED_DUPLICATE_EXPORT';end if;
end$$;
select'M06_26_REAL_ANON_FAILED_PREPARE_REQUEUES_SAME_FROZEN_EXPORT_JOB_IDK_ONCE_AND_ONLY_STAGE_BUDGET_PASSED';
set local role eps_jobs_executor;
do $$declare job uuid:=current_setting('eps.m06.retry.job')::uuid;lease jsonb;grant_value jsonb;asset jsonb;begin
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',job,'stage','render_export','input_hash',current_setting('eps.m06.retry.hash')));
 if lease->>'attempt_id'=current_setting('eps.m06.retry.first_attempt')or lease->>'lease_token'=current_setting('eps.m06.retry.first_lease')then raise exception'M06_26_RETRY_REUSED_ATTEMPT_OR_LEASE';end if;
 grant_value:=eps.mint_review_media_grant(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token'));
 if grant_value->>'grant_id'=current_setting('eps.m06.retry.first_grant')then raise exception'M06_26_RETRY_REUSED_GRANT';end if;
 perform set_config('eps.m06.retry.second_grant',grant_value->>'grant_id',true);perform set_config('eps.m06.retry.second_attempt',lease->>'attempt_id',true);
 execute'set local role eps_specs_assets_executor';
 asset:=eps.reserve_job_output(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','output_key','presentation_pdf','asset_kind','presentation_pdf','filename','presentation.pdf','mime_type','application/pdf','expected_size_bytes',100,'parent_asset_id',null,'time_offset_ms',null));
 if asset#>>'{asset,id}'=current_setting('eps.m06.retry.first_asset')then raise exception'M06_26_RETRY_REUSED_ARTIFACT';end if;
 perform set_config('eps.m06.retry.second_asset',asset#>>'{asset,id}',true);
end$$;
set local role postgres;
do $$declare item eps.jobs;first_asset eps.media_assets;second_asset eps.media_assets;begin
 select * into item from eps.jobs where id=current_setting('eps.m06.retry.job')::uuid;
 select * into first_asset from eps.media_assets where id=current_setting('eps.m06.retry.first_asset')::uuid;select * into second_asset from eps.media_assets where id=current_setting('eps.m06.retry.second_asset')::uuid;
 if item.attempt<>2 or item.stage_attempts<>'{"render_export":1,"synthetic_retained_stage":2}'::jsonb or first_asset.object_key=second_asset.object_key or first_asset.producing_attempt_id<>current_setting('eps.m06.retry.first_attempt')::uuid or second_asset.producing_attempt_id<>current_setting('eps.m06.retry.second_attempt')::uuid then raise exception'M06_26_FRESH_ATTEMPT_ARTIFACT_PATH_OR_MONOTONIC_ATTEMPT_FAILED';end if;
 if not exists(select 1 from eps.review_media_grants where id=current_setting('eps.m06.retry.first_grant')::uuid and revoked_at is not null)or not exists(select 1 from eps.review_media_grants where id=current_setting('eps.m06.retry.second_grant')::uuid and revoked_at is null and producing_attempt_id=item.current_attempt_id)then raise exception'M06_26_RETRY_GRANT_LIFECYCLE_FAILED';end if;
 if(select eps.presentation_hash(to_jsonb(v))from eps.presentation_versions v where id=current_setting('eps.m05.selection.version')::uuid)<>current_setting('eps.m06.retry.canonical_before')then raise exception'M06_26_RETRY_CHANGED_CANONICAL_READY_VERSION';end if;
end$$;
select'M06_26_RETRY_MONOTONIC_ATTEMPT_FRESH_LEASE_GRANT_ARTIFACT_PATH_AND_READY_VERSION_UNCHANGED_PASSED';
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare job uuid:=current_setting('eps.m06.retry.job')::uuid;dto jsonb;begin dto:=public.eps_get_job(job);perform public.eps_cancel_job(job,jsonb_build_object('row_version',dto->'row_version'),'m06-26-cancel-guest-export');end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare request jsonb:=jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m05.selection.version'),'idempotency_key','m06-26-retry-after-cancel');begin
 begin perform pg_temp.m06_call('prepare_export',request);raise exception'M06_26_CANCELLED_GUEST_EXPORT_REQUEUED';exception when raise_exception then if sqlerrm<>'JOB_CANCELLED'then raise;end if;end;
 begin perform eps.retry_guest_pdf_export(current_setting('eps.m06.retry.export')::uuid,current_setting('eps.m06.admission.link')::uuid,current_setting('eps.m05.selection.version')::uuid,null);raise exception'M06_26_ANON_ESCAPED_PRIVATE_RETRY_BOUNDARY';exception when insufficient_privilege then null;end;
end$$;
set local role eps_guest_owner;
do $$begin
 begin perform eps.retry_guest_pdf_export(current_setting('eps.m06.retry.export')::uuid,gen_random_uuid(),current_setting('eps.m05.selection.version')::uuid,gen_random_uuid());raise exception'M06_26_FOREIGN_LINK_RETRY_ACCEPTED';exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;
 begin perform eps.retry_guest_pdf_export(current_setting('eps.m06.retry.export')::uuid,current_setting('eps.m06.admission.link')::uuid,current_setting('eps.m05.selection.version')::uuid,gen_random_uuid());raise exception'M06_26_FOREIGN_SESSION_RETRY_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_UNAVAILABLE'then raise;end if;end;
end$$;
set local role postgres;
do $$begin
 if not exists(select 1 from eps.jobs where id=current_setting('eps.m06.retry.job')::uuid and status='cancelled'and attempt=2)or not exists(select 1 from eps.review_media_grants where id=current_setting('eps.m06.retry.second_grant')::uuid and revoked_at is not null)then raise exception'M06_26_CANCEL_TERMINAL_OR_GRANT_REVOCATION_FAILED';end if;
 if has_function_privilege('anon','eps.retry_guest_pdf_export(uuid,uuid,uuid,uuid)','EXECUTE')or has_function_privilege('authenticated','eps.retry_guest_pdf_export(uuid,uuid,uuid,uuid)','EXECUTE')or has_function_privilege('service_role','eps.retry_guest_pdf_export(uuid,uuid,uuid,uuid)','EXECUTE')then raise exception'M06_26_RETRY_EXPOSED_DIRECT_EXECUTE';end if;
end$$;
select'M06_26_CANCELLED_TERMINAL_FOREIGN_LINK_SESSION_PRIVATE_RETRY_DENIAL_AND_GRANT_REVOCATION_PASSED';
