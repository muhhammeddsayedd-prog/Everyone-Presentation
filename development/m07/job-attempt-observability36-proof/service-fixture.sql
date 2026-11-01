-- UNEXECUTED synthetic real-routine proof; parent owns all rollback/target fences.
-- Requires actual34/35/candidate36 plus the pinned actor/session/series fixtures.
-- No provider, storage bytes, renderer or n8n request is executed.
set local role authenticated;
do $$declare review jsonb;body jsonb;ack jsonb;begin
 review:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.m05.selection')::uuid,null);
 body:=jsonb_build_object('expected_workspace_row_version',public.eps_get_workspace(current_setting('eps.casting.fixture.workspace')::uuid)->'row_version',
  'expected_draft_revision',review->'draft_revision','expected_input_fingerprint',review->'input_fingerprint');
 ack:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body,'attempt36-generate-version');
 if jsonb_typeof(ack) is distinct from 'object'
 or ack is distinct from public.eps_generate_version(current_setting('eps.m05.selection')::uuid,body,'attempt36-generate-version')then raise exception 'ATTEMPT36_GENERATION_REPLAY_FAILED';end if;
 perform set_config('eps.attempt36.job',ack->>'job_id',true);perform set_config('eps.attempt36.version',ack->>'resource_id',true);
end$$;
set local role postgres;
select set_config('eps.attempt36.hash',(select input_hash from eps.jobs where id=current_setting('eps.attempt36.job')::uuid),true);
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare request jsonb;lease jsonb;source jsonb;event jsonb;receipt jsonb;job uuid:=current_setting('eps.attempt36.job')::uuid;begin
 request:=jsonb_build_object('job_id',job,'stage','prepare_presentation','input_hash',current_setting('eps.attempt36.hash'),'workflow_execution_id','synthetic-attempt36-prepare');
 lease:=eps.claim_job_stage_replay(request,'attempt36-claim-prepare','synthetic-key',repeat('a',64));
 if jsonb_typeof(lease) is distinct from 'object'
 or lease is distinct from eps.claim_job_stage_replay(request,'attempt36-claim-prepare','synthetic-key',repeat('a',64))then raise exception 'ATTEMPT36_CLAIM_REPLAY_FAILED';end if;
 source:=eps.get_specs_stage_input(job,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 event:=jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','prepare_presentation',
  'input_hash',current_setting('eps.attempt36.hash'),'event_id','attempt36-heartbeat','sequence',1,'event_type','heartbeat');
 receipt:=eps.record_job_event(event);
 if receipt->'applied' is distinct from 'true'::jsonb or receipt->'stale' is distinct from 'false'::jsonb
 or eps.record_job_event(event)->'duplicate' is distinct from 'true'::jsonb then raise exception 'ATTEMPT36_HEARTBEAT_REPLAY_FAILED';end if;
 event:=event||jsonb_build_object('event_id','attempt36-prepare-success','sequence',2,'event_type','succeeded','result_schema','presentation-preparation.v1',
  'result',jsonb_build_object('schema_version','1.0','version_id',source->'version_id','snapshot_sha256',source->'snapshot_sha256',
   'manifest_sha256',source->'manifest_sha256','inventory_sha256',source->'inventory_sha256','template_content_sha256',source#>'{snapshot,template,content_sha256}',
   'font_hashes',source#>'{snapshot,template,font_hashes}','renderer_version',source#>'{configuration,renderer_version}','prepared_at','2026-11-01T00:00:00.000000Z'));
 receipt:=eps.record_job_event(event);
 if receipt->'applied' is distinct from 'true'::jsonb or receipt->'stale' is distinct from 'false'::jsonb
 or receipt->>'job_status' is distinct from 'queued' or eps.record_job_event(event)->'duplicate' is distinct from 'true'::jsonb
 then raise exception 'ATTEMPT36_PREPARE_CALLBACK_FAILED';end if;
 request:=request||jsonb_build_object('stage','render_presentation','workflow_execution_id','synthetic-attempt36-render-first');
 lease:=eps.claim_job_stage_replay(request,'attempt36-claim-render-first','synthetic-key',repeat('a',64));
 perform set_config('eps.attempt36.old_render_lease',lease::text,true);
 event:=jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','render_presentation',
  'input_hash',current_setting('eps.attempt36.hash'),'event_id','attempt36-render-failed','sequence',1,'event_type','failed',
  'error',jsonb_build_object('code','PDF_BUDGET_EXCEEDED','message','Sensitive synthetic failure sentinel must not persist.',
   'details',jsonb_build_object('secret','sensitive-synthetic-sentinel'),'retryable',false));
 receipt:=eps.record_job_event(event);
 if receipt->'applied' is distinct from 'true'::jsonb or receipt->>'job_status' is distinct from 'failed'
 or eps.record_job_event(event)->'duplicate' is distinct from 'true'::jsonb
 then raise exception 'ATTEMPT36_FAILED_CALLBACK_REPLAY_FAILED';end if;
end$$;
set local role postgres;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),
 set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated','aud','authenticated',
  'is_anonymous',false,'session_id','33000000-0000-4000-8000-000000000002')::text,true);
set local role authenticated;
do $$declare job jsonb;body jsonb;ack jsonb;begin
 job:=public.eps_get_job(current_setting('eps.attempt36.job')::uuid);
 if job->'can_retry' is distinct from 'true'::jsonb or job#>>'{error,code}' is distinct from 'PDF_BUDGET_EXCEEDED'
 or job#>'{error,details}' is distinct from '{}'::jsonb
 or position('sensitive'in lower(job::text))>0 then raise exception 'ATTEMPT36_SAFE_ACTIONABLE_ERROR_REQUIRED';end if;
 body:=jsonb_build_object('row_version',job->'row_version');ack:=public.eps_retry_job((job->>'id')::uuid,body,'attempt36-real-manual-retry');
 if jsonb_typeof(ack) is distinct from 'object'
 or ack is distinct from public.eps_retry_job((job->>'id')::uuid,body,'attempt36-real-manual-retry')then raise exception 'ATTEMPT36_MANUAL_RETRY_REPLAY_FAILED';end if;
end$$;
set local role postgres;
do $$begin
 if not exists(select 1 from eps.jobs where id=current_setting('eps.attempt36.job')::uuid and attempt=2 and status='queued'
  and not(stage_attempts?'render_presentation'))then raise exception 'ATTEMPT36_REAL_RETRY_STAGE_RESET_REQUIRED';end if;
end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare request jsonb;lease jsonb;old jsonb:=current_setting('eps.attempt36.old_render_lease')::jsonb;receipt jsonb;begin
 request:=jsonb_build_object('job_id',current_setting('eps.attempt36.job'),'stage','render_presentation','input_hash',current_setting('eps.attempt36.hash'),
  'workflow_execution_id','synthetic-attempt36-render-retry');
 lease:=eps.claim_job_stage_replay(request,'attempt36-claim-render-retry','synthetic-key',repeat('a',64));
 if jsonb_typeof(lease) is distinct from 'object'
 or lease is distinct from eps.claim_job_stage_replay(request,'attempt36-claim-render-retry','synthetic-key',repeat('a',64))
 or lease->>'attempt_id' is null or old->>'attempt_id' is null or lease->>'attempt_id'=old->>'attempt_id'
 then raise exception 'ATTEMPT36_FRESH_RETRY_CLAIM_REQUIRED';end if;
 begin
  perform eps.claim_job_stage_replay(request||jsonb_build_object('workflow_execution_id','synthetic-changed-reference'),
   'attempt36-claim-render-retry','synthetic-key',repeat('a',64));raise exception 'ATTEMPT36_CHANGED_REPLAY_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'IDEMPOTENCY_KEY_REUSED'then raise;end if;end;
 receipt:=eps.record_job_event(jsonb_build_object('job_id',old->'job_id','attempt_id',old->'attempt_id','lease_token',old->'lease_token','stage','render_presentation',
  'input_hash',current_setting('eps.attempt36.hash'),'event_id','attempt36-stale-old-render','sequence',2,'event_type','heartbeat'));
 if receipt->'stale' is distinct from 'true'::jsonb or receipt->'applied' is distinct from 'false'::jsonb then raise exception 'ATTEMPT36_OLD_ATTEMPT_FENCE_FAILED';end if;
end$$;
set local role postgres;
do $$declare job uuid:=current_setting('eps.attempt36.job')::uuid;begin
 if(select array_agg(attempt order by attempt)from eps.job_stage_attempts where job_id=job) is distinct from array[1,2,3]
 or(select array_agg(stage_attempt order by attempt)from eps.job_stage_attempts where job_id=job) is distinct from array[1,1,1]
 or(select array_agg(workflow_execution_id order by attempt)from eps.job_stage_attempts where job_id=job)
  is distinct from array['synthetic-attempt36-prepare','synthetic-attempt36-render-first','synthetic-attempt36-render-retry']
 or(select count(distinct attempt_id)from eps.job_stage_attempts where job_id=job)<>3
 then raise exception 'ATTEMPT36_DURABLE_REAL_ATTEMPT_BINDINGS_REQUIRED';end if;
 if(select count(*)from eps.job_events e join eps.job_stage_attempts a on a.job_id=e.job_id and a.attempt_id=e.attempt_id
  where a.job_id=job)<>3 or not exists(select 1 from eps.job_events e join eps.job_stage_attempts a on a.job_id=e.job_id and a.attempt_id=e.attempt_id
  where a.job_id=job and a.attempt=1 and e.event_type='succeeded')or not exists(select 1 from eps.job_events e join eps.job_stage_attempts a
  on a.job_id=e.job_id and a.attempt_id=e.attempt_id where a.job_id=job and a.attempt=2 and e.event_type='failed')
 then raise exception 'ATTEMPT36_REAL_EVENT_ATTEMPT_BINDINGS_REQUIRED';end if;
 if exists(select 1 from eps.job_stage_attempts where to_jsonb(job_stage_attempts)::text like '%sensitive%')
 then raise exception 'ATTEMPT36_PRIVATE_PAYLOAD_COPIED';end if;
end$$;
