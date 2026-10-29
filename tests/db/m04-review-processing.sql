-- Injected provider/layout results under synthetic Auth claims. No OpenAI/n8n/browser IO.
set local role postgres;
insert into public.app_capability_grants(principal_id,capability)select current_setting('eps.casting.fixture.actor')::uuid,value from unnest(array['cast.read','presentations.generate','operations.retry'])value;
insert into eps.audience_presets(id,key,label,scope)values('8a7a0000-0000-4000-8000-000000000001','m04-processing-internal','Synthetic processing','internal');
set local role authenticated;
do $$declare w uuid:=current_setting('eps.casting.fixture.workspace')::uuid;assignment jsonb;body jsonb;ack jsonb;begin
 assignment:=public.eps_create_assignment(w,jsonb_build_object('slot_id',current_setting('eps.casting.fixture.slot'),'workspace_candidate_id',current_setting('eps.casting.fixture.pool'),'expected_slot_row_version',1,'presentation_notes','A supplied concise note with no new facts.'),'m04-processing-assignment');
 body:=jsonb_build_object('workspace_id',w,'capability','slide_shorten','target_type','assignment','target_id',assignment->>'id','target_row_version',1,'field','presentation_notes','instruction','Shorten the supplied note without changing its facts.');
 begin perform public.eps_create_ai_suggestion(body,'m04-processing-disabled');raise exception'DISABLED_PROCESSING_ACCEPTED';exception when raise_exception then if sqlerrm<>'REVIEW_PROCESSING_UNAVAILABLE'then raise;end if;end;
 perform set_config('eps.review.proc.body',body::text,true);perform set_config('eps.review.proc.assignment',assignment->>'id',true);
end$$;
set local role postgres;
update eps.review_processing_config set enabled=true where id;
set local role authenticated;
do $$declare body jsonb:=current_setting('eps.review.proc.body')::jsonb;ack jsonb;begin
 ack:=public.eps_create_ai_suggestion(body,'m04-processing-ai-main');
 if ack<>public.eps_create_ai_suggestion(body,'m04-processing-ai-main')then raise exception'AI_ENQUEUE_REPLAY_FAILED';end if;
 perform set_config('eps.review.proc.job',ack->>'job_id',true);perform set_config('eps.review.proc.suggestion',ack->>'resource_id',true);
 if public.eps_get_ai_suggestion((ack->>'resource_id')::uuid)->'suggested_text'<>'null'then raise exception'QUEUED_AI_PROPOSAL_EXPOSED';end if;
 begin perform public.eps_create_ai_suggestion(body||'{"field":"internal_notes"}','m04-processing-private-field');raise exception'PRIVATE_SOURCE_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 begin perform public.eps_create_ai_suggestion(body||'{"source_text":"Fabricated source"}','m04-processing-wrong-source');raise exception'CALLER_SOURCE_ACCEPTED';exception when raise_exception then if sqlerrm<>'INPUT_CHANGED'then raise;end if;end;
end$$;
set local role postgres;
do $$begin perform set_config('eps.review.proc.hash',(select input_hash from eps.jobs where id=current_setting('eps.review.proc.job')::uuid),true);end$$;
-- Explicitly empty JWT claims: service processing never impersonates the requester.
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare job uuid:=current_setting('eps.review.proc.job')::uuid;hash text:=current_setting('eps.review.proc.hash');lease jsonb;source jsonb;event jsonb;result jsonb;proposal jsonb;stage text;schema text;begin
 foreach stage in array array['prepare_suggestion','generate_suggestion','validate_suggestion']loop
  if stage='prepare_suggestion'then lease:=eps.claim_job_stage_replay(jsonb_build_object('job_id',job,'stage',stage,'input_hash',hash,'workflow_execution_id','synthetic-wf05'),'synthetic-review-claim-replay','synthetic-key',repeat('a',64));if lease<>eps.claim_job_stage_replay(jsonb_build_object('job_id',job,'stage',stage,'input_hash',hash,'workflow_execution_id','synthetic-wf05'),'synthetic-review-claim-replay','synthetic-key',repeat('a',64))then raise exception'AI_CLAIM_REPLAY_FAILED';end if;else lease:=eps.claim_job_stage(jsonb_build_object('job_id',job,'stage',stage,'input_hash',hash,'workflow_execution_id','synthetic-wf05'));end if;
  source:=eps.get_specs_stage_input(job,(lease->>'attempt_id')::uuid,lease->>'lease_token');
  if (select count(*)from jsonb_object_keys(source))<>17 or source->>'source_text'<>'A supplied concise note with no new facts.'or source->>'field'<>'presentation_notes'or source->'budget'<>'{"max_characters":96,"max_lines":2}'::jsonb then raise exception'AI_SCOPED_INPUT_FAILED';end if;
  if stage='prepare_suggestion'then schema:='suggestion-preparation.v1';result:=jsonb_build_object('schema_version','1.0','target_id',source->'target_id','target_row_version',source->'target_row_version','field',source->'field','source_text',source->'source_text');
  else
   schema:=case stage when'generate_suggestion'then'contextual-suggestion.v1'else'suggestion-validation.v1'end;
   proposal:=jsonb_build_object('schema_version','1.0','suggested_text','Supplied concise note.','proposed_changes',jsonb_build_array(jsonb_build_object('field','presentation_notes','old_value',source->>'source_text','new_value','Supplied concise note.')),'warnings','[]'::jsonb,
    'metadata',jsonb_build_object('provider','openai','sdk_version','7.45.1','requested_model','gpt-6.1-sol','resolved_model','gpt-6.1-sol','request_id','synthetic-local-request','response_id','synthetic-local-response','prompt_version','contextual_suggestion_v1','input_sha256',hash,'usage',jsonb_build_object('input_tokens',10,'output_tokens',5,'total_tokens',15),'prompt_sha256','8480a63823dc9be53ff4898c42df82f6e5b70ccc72100d141392d6c99766c242','schema_sha256',repeat('b',64)));
   if stage='validate_suggestion'and source->'generated'<>proposal then raise exception'AI_GENERATED_BINDING_FAILED';end if;result:=proposal;
  end if;
  event:=jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage',stage,'input_hash',hash,'event_id','synthetic-'||stage,'sequence',1,'event_type','succeeded','result_schema',schema,'result',result);
  result:=eps.record_job_event(event);if result->'applied'<>'true'or result->'stale'<>'false'then raise exception'AI_STAGE_COMMIT_FAILED';end if;
  if eps.record_job_event(event)->'duplicate'<>'true'then raise exception'AI_CALLBACK_REPLAY_FAILED';end if;
 end loop;
end$$;
set local role postgres;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare proposal jsonb;begin
 proposal:=public.eps_get_ai_suggestion(current_setting('eps.review.proc.suggestion')::uuid);
 if proposal->>'status'<>'succeeded'or proposal->>'suggested_text'<>'Supplied concise note.'then raise exception'AI_PROPOSAL_NOT_PUBLISHED';end if;
 if not exists(select 1 from jsonb_array_elements(public.eps_list_assignments(current_setting('eps.casting.fixture.workspace')::uuid,'selection',null,100)->'data')a where a->>'id'=current_setting('eps.review.proc.assignment')and a->>'presentation_notes'='A supplied concise note with no new facts.'and a->>'row_version'='1')then raise exception'AI_MUTATED_BUSINESS_TEXT';end if;
 perform set_config('eps.review.proc.stalejob',(public.eps_create_ai_suggestion(current_setting('eps.review.proc.body')::jsonb,'m04-processing-ai-stale')->>'job_id'),true);
end$$;
select'M04_AI_DURABLE_THREE_STAGES_SOURCE_BINDING_REPLAY_AND_NO_AUTOAPPLY_PASSED';
set local role postgres;
do $$begin perform set_config('eps.review.proc.stalehash',(select input_hash from eps.jobs where id=current_setting('eps.review.proc.stalejob')::uuid),true);end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare job uuid:=current_setting('eps.review.proc.stalejob')::uuid;hash text:=current_setting('eps.review.proc.stalehash');stage text;lease jsonb;source jsonb;result jsonb;proposal jsonb;begin
 foreach stage in array array['prepare_suggestion','generate_suggestion']loop
  lease:=eps.claim_job_stage(jsonb_build_object('job_id',job,'stage',stage,'input_hash',hash));source:=eps.get_specs_stage_input(job,(lease->>'attempt_id')::uuid,lease->>'lease_token');
  if stage='prepare_suggestion'then result:=jsonb_build_object('schema_version','1.0','target_id',source->'target_id','target_row_version',source->'target_row_version','field',source->'field','source_text',source->'source_text');
  else proposal:=jsonb_build_object('schema_version','1.0','suggested_text','Supplied concise note.','proposed_changes',jsonb_build_array(jsonb_build_object('field','presentation_notes','old_value',source->>'source_text','new_value','Supplied concise note.')),'warnings','[]'::jsonb,'metadata',jsonb_build_object('provider','openai','sdk_version','7.45.1','requested_model','gpt-6.1-sol','resolved_model','gpt-6.1-sol','request_id','synthetic-stale-request','response_id','synthetic-stale-response','prompt_version','contextual_suggestion_v1','input_sha256',hash,'usage',null,'prompt_sha256','8480a63823dc9be53ff4898c42df82f6e5b70ccc72100d141392d6c99766c242','schema_sha256',repeat('b',64)));result:=proposal;end if;
  perform eps.record_job_event(jsonb_build_object('job_id',job,'attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage',stage,'input_hash',hash,'event_id','synthetic-stale-'||stage,'sequence',1,'event_type','succeeded','result_schema',case stage when'prepare_suggestion'then'suggestion-preparation.v1'else'contextual-suggestion.v1'end,'result',result));
 end loop;
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',job,'stage','validate_suggestion','input_hash',hash));perform set_config('eps.review.proc.stalelease',lease::text,true);perform set_config('eps.review.proc.staleproposal',proposal::text,true);
end$$;
set local role postgres;
-- Assignment row version and selected note stay fixed; shared source changes anyway.
update eps.candidates set facts=jsonb_set(facts,'{height_measurements}','"181 cm"')where id='8a5a0000-0000-4000-8000-000000000001';
set local role eps_jobs_executor;
do $$declare lease jsonb:=current_setting('eps.review.proc.stalelease')::jsonb;result jsonb;begin
 result:=eps.record_job_event(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','validate_suggestion','input_hash',current_setting('eps.review.proc.stalehash'),'event_id','synthetic-stale-final','sequence',1,'event_type','succeeded','result_schema','suggestion-validation.v1','result',current_setting('eps.review.proc.staleproposal')::jsonb));
 if result->>'job_status'<>'waiting_for_input'then raise exception'AI_SHARED_SOURCE_CHANGE_PUBLISHED';end if;
end$$;
set local role postgres;
do $$begin if(select proposal is not null from eps.ai_suggestions where job_id=current_setting('eps.review.proc.stalejob')::uuid)then raise exception'STALE_PROPOSAL_STORED';end if;end$$;
select'M04_AI_SHARED_SOURCE_CHANGE_WITHOUT_ASSIGNMENT_REVISION_BLOCKS_PUBLISH_PASSED';
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare series jsonb;review jsonb;ack jsonb;begin
 series:=public.eps_create_presentation_series(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'output_type','selection','audience_preset_id','8a7a0000-0000-4000-8000-000000000001'),'m04-fit-series');
 review:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,(series->>'id')::uuid,null);
 ack:=public.eps_request_workspace_review_fit(current_setting('eps.casting.fixture.workspace')::uuid,(series->>'id')::uuid,jsonb_build_object('expected_input_fingerprint',review->>'input_fingerprint'),'m04-fit-request');
 perform set_config('eps.review.proc.fitjob',ack->>'job_id',true);perform set_config('eps.review.proc.series',series->>'id',true);perform set_config('eps.review.proc.fingerprint',review->>'input_fingerprint',true);
end$$;
set local role postgres;
do $$begin perform set_config('eps.review.proc.fithash',(select input_hash from eps.jobs where id=current_setting('eps.review.proc.fitjob')::uuid),true);end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare lease jsonb;source jsonb;result jsonb;begin
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.review.proc.fitjob'),'stage','measure_review_fit','input_hash',current_setting('eps.review.proc.fithash')));
 source:=eps.get_specs_stage_input((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 if source#>>'{review,input_fingerprint}'<>current_setting('eps.review.proc.fingerprint')or jsonb_array_length(source#>'{review,slides}')<>2 then raise exception'FIT_SNAPSHOT_BOUNDARY_FAILED';end if;
 perform set_config('eps.review.proc.fitlease',lease::text,true);
end$$;
set local role postgres;
do $$declare result jsonb;begin
 result:=jsonb_build_object('schema_version','1.0','input_fingerprint',current_setting('eps.review.proc.fingerprint'),'template_content_sha256','8cfc99e874b2810d782f0a447628039e52e48a337fe1ce5b6286799c56e90001','renderer_version','everyone-casting-fit-v1','chromium_version','synthetic-layout-fixture','font_hashes',(select font_hashes from eps.presentation_templates where key='everyone-casting'and version='1.0.0'),'overflows','[]'::jsonb,'measured_at',clock_timestamp());perform set_config('eps.review.proc.fitresult',result::text,true);
end$$;
set local role eps_jobs_executor;
do $$declare lease jsonb:=current_setting('eps.review.proc.fitlease')::jsonb;result jsonb;begin
 result:=eps.record_job_event(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','measure_review_fit','input_hash',current_setting('eps.review.proc.fithash'),'event_id','synthetic-fit-result','sequence',1,'event_type','succeeded','result_schema','review-fit-measurement.v1','result',current_setting('eps.review.proc.fitresult')::jsonb));
 if result->>'job_status'<>'succeeded'then raise exception'FIT_RESULT_NOT_COMMITTED';end if;
end$$;
set local role postgres;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare review jsonb;begin
 review:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.proc.series')::uuid,null);
 if review#>>'{fit,status}'<>'measured'or review->'can_generate'<>'true'then raise exception'VALID_FIT_DID_NOT_PRESERVE_MISSING_CONTENT_FLEXIBILITY';end if;
end$$;
select'M04_NATIVE_FIT_JOB_HASH_FONT_FENCE_AND_MISSING_CONTENT_FLEXIBILITY_PASSED';
set local role postgres;
update public.projects set name='Synthetic changed canonical title'where id='8a0a0000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare review jsonb;begin
 review:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.proc.series')::uuid,null);
 if review->>'input_fingerprint'=current_setting('eps.review.proc.fingerprint')or review#>>'{fit,status}'<>'unmeasured'or review->'can_generate'<>'false'then raise exception'CANONICAL_TITLE_DID_NOT_INVALIDATE_FIT';end if;
 begin perform public.eps_request_workspace_review_fit(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.proc.series')::uuid,jsonb_build_object('expected_input_fingerprint',current_setting('eps.review.proc.fingerprint')),'m04-fit-stale-request');raise exception'STALE_FIT_REQUEST_ACCEPTED';exception when raise_exception then if sqlerrm<>'INPUT_CHANGED'then raise;end if;end;
 if has_function_privilege('authenticated','eps.review_snapshot_data(uuid,uuid,text)','EXECUTE')or has_table_privilege('authenticated','eps.ai_suggestions','SELECT')or has_table_privilege('service_role','eps.review_stage_payloads','SELECT')then raise exception'REVIEW_PRIVATE_SERVICE_AUTHORITY_LEAK';end if;
end$$;
select'M04_FIT_CANONICAL_CHANGED_INPUT_AND_PRIVATE_SERVICE_SCOPE_PASSED';
-- Exercise the established public job operations against a genuine new-kind
-- queue/lease. Callback payloads below remain injected synthetic provider work.
do $$declare ack jsonb;begin
 ack:=public.eps_create_ai_suggestion(current_setting('eps.review.proc.body')::jsonb,'m04-public-cancel-job');perform set_config('eps.review.proc.canceljob',ack->>'job_id',true);
 ack:=public.eps_create_ai_suggestion(current_setting('eps.review.proc.body')::jsonb,'m04-public-retry-job');perform set_config('eps.review.proc.retryjob',ack->>'job_id',true);
end$$;
set local role postgres;
do $$begin
 perform set_config('eps.review.proc.cancelhash',(select input_hash from eps.jobs where id=current_setting('eps.review.proc.canceljob')::uuid),true);
 perform set_config('eps.review.proc.retryhash',(select input_hash from eps.jobs where id=current_setting('eps.review.proc.retryjob')::uuid),true);
end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare key text;lease jsonb;receipt jsonb;begin
 foreach key in array array['cancel','retry']loop
  lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.review.proc.'||key||'job'),'stage','prepare_suggestion','input_hash',current_setting('eps.review.proc.'||key||'hash')));
  receipt:=eps.record_job_event(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','prepare_suggestion','input_hash',current_setting('eps.review.proc.'||key||'hash'),'event_id','synthetic-public-'||key||'-failure','sequence',1,'event_type','failed','error',jsonb_build_object('code','DEPENDENCY_UNAVAILABLE','message','Injected synthetic transient failure.','details','{}'::jsonb,'retryable',true)));
  if receipt->>'job_status'<>'queued'then raise exception'NEW_KIND_TRANSIENT_FAILURE_NOT_QUEUED';end if;
  perform set_config('eps.review.proc.'||key||'lease',lease::text,true);
 end loop;
end$$;
set local role postgres;
-- Public retry's existing contract accepts failed/retryable attempts below the
-- cap. Model an operator-visible dispatch failure, without inventing output.
update eps.jobs set status='failed',error=eps.specs_stage_error('DISPATCH_UNAVAILABLE',true),row_version=row_version+1 where id=current_setting('eps.review.proc.retryjob')::uuid;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare job_id uuid;body jsonb;ack jsonb;before jsonb;begin
 job_id:=current_setting('eps.review.proc.canceljob')::uuid;before:=public.eps_get_job(job_id);body:=jsonb_build_object('row_version',before->'row_version','reason','Synthetic queued cancellation check.');
 ack:=public.eps_cancel_job(job_id,body,'m04-public-cancel');if ack->>'status'<>'cancelled'or ack<>public.eps_cancel_job(job_id,body,'m04-public-cancel')then raise exception'NEW_KIND_PUBLIC_CANCEL_REPLAY_FAILED';end if;
 job_id:=current_setting('eps.review.proc.retryjob')::uuid;before:=public.eps_get_job(job_id);body:=jsonb_build_object('row_version',before->'row_version','reason','Synthetic dispatch retry check.');
 ack:=public.eps_retry_job(job_id,body,'m04-public-retry');if ack->>'id'<>job_id::text or ack->>'status'<>'queued'or ack<>public.eps_retry_job(job_id,body,'m04-public-retry')then raise exception'NEW_KIND_PUBLIC_RETRY_REPLAY_FAILED';end if;
 begin perform public.eps_retry_job(job_id,body,'m04-public-retry-stale');raise exception'NEW_KIND_STALE_RETRY_ACCEPTED';exception when raise_exception then if sqlerrm<>'STALE_RESOURCE_VERSION'then raise;end if;end;
end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare key text;lease jsonb;receipt jsonb;next_lease jsonb;begin
 foreach key in array array['cancel','retry']loop
  lease:=current_setting('eps.review.proc.'||key||'lease')::jsonb;
  receipt:=eps.record_job_event(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage','prepare_suggestion','input_hash',current_setting('eps.review.proc.'||key||'hash'),'event_id','synthetic-public-'||key||'-late','sequence',2,'event_type','heartbeat'));
  if receipt->'stale'<>'true'or receipt->'applied'<>'false'then raise exception'NEW_KIND_LATE_CALLBACK_APPLIED';end if;
 end loop;
 next_lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.review.proc.retryjob'),'stage','prepare_suggestion','input_hash',current_setting('eps.review.proc.retryhash')));
 if next_lease->>'attempt_id'=current_setting('eps.review.proc.retrylease')::jsonb->>'attempt_id'then raise exception'NEW_KIND_RETRY_REUSED_OLD_LEASE';end if;
 perform eps.get_specs_stage_input((next_lease->>'job_id')::uuid,(next_lease->>'attempt_id')::uuid,next_lease->>'lease_token');
end$$;
set local role postgres;
do $$begin
 if exists(select 1 from eps.ai_suggestions where job_id in(current_setting('eps.review.proc.canceljob')::uuid,current_setting('eps.review.proc.retryjob')::uuid)and proposal is not null)
 or(select count(*)from eps.ai_suggestions where job_id=current_setting('eps.review.proc.retryjob')::uuid)<>1
 or exists(select 1 from eps.jobs where id in(current_setting('eps.review.proc.canceljob')::uuid,current_setting('eps.review.proc.retryjob')::uuid)and result is not null)then raise exception'PUBLIC_RETRY_CANCEL_CREATED_OUTPUT';end if;
end$$;
select'M04_PUBLIC_NEW_KIND_CANCEL_RETRY_REPLAY_AND_LATE_CALLBACK_PASSED';
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare value jsonb;field text;begin
 foreach value in array array['null'::jsonb,'1'::jsonb,'{}'::jsonb,'[]'::jsonb,'""'::jsonb]loop
  begin perform public.eps_create_ai_suggestion(current_setting('eps.review.proc.body')::jsonb||jsonb_build_object('capability',value),'m04-direct-invalid-ai-'||value::text);raise exception'INVALID_DIRECT_AI_CAPABILITY_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
  begin perform public.eps_request_workspace_review_fit(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.review.proc.series')::uuid,jsonb_build_object('expected_input_fingerprint',value),'m04-direct-invalid-fit-'||value::text);raise exception'INVALID_DIRECT_FIT_FINGERPRINT_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
  begin perform public.eps_create_presentation_series(jsonb_build_object('workspace_id',current_setting('eps.casting.fixture.workspace'),'audience_preset_id','8a7a0000-0000-4000-8000-000000000001','output_type',value),'m04-direct-invalid-series-'||value::text);raise exception'INVALID_DIRECT_SERIES_OUTPUT_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
  foreach field in array array['workspace_id','output_type','limit','cursor']loop
   if field='limit'and value='1'::jsonb then continue;end if;
   begin perform public.eps_list_presentation_series(jsonb_build_object(field,value));raise exception'INVALID_DIRECT_SERIES_FILTER_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
  end loop;
 end loop;
 begin perform public.eps_list_presentation_series('{"limit":1.5}');raise exception'NONINTEGER_LIMIT_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
 begin perform public.eps_list_presentation_series('{"cursor":"*:*|8a7a0000-0000-4000-8000-000000000001|extra"}');raise exception'EXTRA_CURSOR_SEGMENT_ACCEPTED';exception when raise_exception then if sqlerrm<>'VALIDATION_FAILED'then raise;end if;end;
end$$;
select'M04_DIRECT_RPC_NULL_AND_WRONG_TYPE_INPUTS_REJECTED_PASSED';
