-- Four-stage durable rendering, scoped to immutable captured versions.
do $$declare item record;definition text;begin
 for item in select conname,pg_get_constraintdef(oid)body,conrelid::regclass tab from pg_constraint where connamespace='eps'::regnamespace and conname in('jobs_kind_check','jobs_stage_check','jobs_kind_stage_check','jobs_input_hash_version_check','job_events_stage_check','outbox_events_stage_check')loop
  definition:=item.body;
  if item.conname='jobs_kind_check'then definition:=replace(definition,'''review_fit''::text','''review_fit''::text,''presentation_render''::text');
  elsif item.conname='jobs_kind_stage_check'then definition:='CHECK ('||substring(definition from 7)||' OR(kind=''presentation_render''and stage in(''prepare_presentation'',''render_presentation'',''validate_presentation'',''publish_presentation'')))';
  elsif item.conname='jobs_input_hash_version_check'then definition:=replace(definition,'''eps.review-job-input.pg-jsonb.v1''::text','''eps.review-job-input.pg-jsonb.v1''::text,''eps.presentation-job-input.cast-canonical.v1''::text');
  else definition:=replace(definition,'''measure_review_fit''::text','''measure_review_fit''::text,''prepare_presentation''::text,''render_presentation''::text,''validate_presentation''::text,''publish_presentation''::text');end if;
  if definition=item.body then raise exception'M05_STAGE_CONSTRAINT_ANCHOR_REQUIRED';end if;
  execute format('alter table %s drop constraint %I',item.tab,item.conname);execute format('alter table %s add constraint %I %s',item.tab,item.conname,definition);
 end loop;
end$$;
create function eps.presentation_timestamp_valid(p_value jsonb)returns boolean language plpgsql volatile security invoker set search_path=''as $$declare value text;at_value timestamptz;begin
 if jsonb_typeof(p_value)is distinct from'string'then return false;end if;value:=p_value#>>'{}';
 if value!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([.][0-9]{1,6})?Z$'then return false;end if;
 begin at_value:=value::timestamptz;exception when invalid_datetime_format or datetime_field_overflow then return false;end;
 return isfinite(at_value)and at_value<=clock_timestamp()+interval'5minutes';
end$$;
create function eps.presentation_output_ref(p_ref jsonb,p_job eps.jobs,p_attempt uuid,p_purpose text)returns boolean language sql volatile security invoker set search_path=''as $$
 select eps.specs_stage_shape(p_ref,array['asset_id','sha256','size_bytes','mime_type'])and exists(select 1 from eps.media_assets a where a.id=eps.input_uuid(p_ref->>'asset_id')and a.producing_job_id=p_job.id and a.producing_attempt_id=p_attempt and a.origin_workspace_id=p_job.workspace_id and a.output_stage='render_presentation'and a.output_key=p_purpose and a.purpose=p_purpose and a.status='ready'and a.bucket='eps-presentation-outputs'and a.object_key='jobs/'||p_job.id||'/attempts/'||p_attempt||'/'||a.id||case when p_purpose='presentation_pdf'then'.pdf'else'.json'end and a.sha256=p_ref->>'sha256'and to_jsonb(a.size_bytes)=p_ref->'size_bytes'and a.mime_type=p_ref->>'mime_type'and a.width is null and a.height is null and a.duration_ms is null and a.source_asset_id is null and a.source_timestamp_ms is null)
$$;
create function eps.presentation_validate_result(p_job eps.jobs,p_value jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$
declare version eps.presentation_versions;proof jsonb;rendered jsonb;validated jsonb;render_attempt uuid;candidate_count integer;pending_count integer;frame_count integer;logo_count integer;video_count integer;link_hash text;begin
 select * into version from eps.presentation_versions where id=p_job.resource_id and generation_job_id=p_job.id;perform eps.specs_stage_assert(found,'SNAPSHOT_INVALID');
 select count(*)filter(where s->>'kind'='candidate'),count(*)filter(where s->>'kind'='pending'),coalesce(sum(jsonb_array_length(s->'frames')),0),count(*)filter(where s->>'logo_asset_id'is not null),count(*)filter(where s->>'video_asset_id'is not null)
 into candidate_count,pending_count,frame_count,logo_count,video_count from jsonb_array_elements(version.snapshot->'slides')s;
 select eps.presentation_hash(coalesce(jsonb_agg(to_jsonb((version.snapshot#>>'{render_configuration,application_origin}')||'/presentations/versions/'||version.id||'/media/'||(s->>'video_asset_id'))order by ord),'[]'::jsonb))into link_hash from jsonb_array_elements(version.snapshot->'slides')with ordinality a(s,ord)where s->>'video_asset_id'is not null;
 if p_job.stage='publish_presentation'then
  select payload into validated from eps.review_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='validate_presentation';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['version_id','manifest_asset_id','pdf_asset_id','pdf_sha256','page_count','template_version','validation_passed','overflow_count','renderer_build'])and p_value->>'version_id'=version.id::text and p_value->>'manifest_asset_id'=validated#>>'{manifest_asset,asset_id}'and p_value->>'pdf_asset_id'=validated#>>'{pdf_asset,asset_id}'and p_value->>'pdf_sha256'=validated#>>'{pdf_asset,sha256}'and p_value->'page_count'=to_jsonb(version.page_count)and p_value->>'template_version'=version.snapshot#>>'{template,version}'and p_value->'validation_passed'='true'and p_value->'overflow_count'='0'and p_value->>'renderer_build'=version.snapshot#>>'{render_configuration,renderer_version}','RESULT_INVALID');return;
 end if;
 perform eps.specs_stage_assert(p_value->>'schema_version'='1.0'and p_value->>'version_id'=version.id::text and p_value->>'snapshot_sha256'=version.snapshot_sha256 and p_value->>'manifest_sha256'=version.manifest_sha256 and p_value->>'inventory_sha256'=version.inventory_sha256,'RESULT_INVALID');
 if p_job.stage='prepare_presentation'then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','version_id','snapshot_sha256','manifest_sha256','inventory_sha256','template_content_sha256','font_hashes','renderer_version','prepared_at'])and p_value->>'template_content_sha256'=version.snapshot#>>'{template,content_sha256}'and p_value->'font_hashes'=version.snapshot#>'{template,font_hashes}'and p_value->>'renderer_version'=version.snapshot#>>'{render_configuration,renderer_version}'and eps.presentation_timestamp_valid(p_value->'prepared_at'),'RESULT_INVALID');return;
 end if;
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','version_id','snapshot_sha256','manifest_sha256','inventory_sha256','manifest_asset','pdf_asset','proof']),'RESULT_INVALID');proof:=p_value->'proof';
 if p_job.stage='render_presentation'then
  perform eps.specs_stage_assert(eps.presentation_output_ref(p_value->'manifest_asset',p_job,p_job.current_attempt_id,'presentation_manifest')and eps.presentation_output_ref(p_value->'pdf_asset',p_job,p_job.current_attempt_id,'presentation_pdf')and p_value#>>'{manifest_asset,sha256}'=version.manifest_sha256,'RESULT_INVALID');
  perform eps.specs_stage_assert(eps.specs_stage_shape(proof,array['renderer_version','chromium_version','template_content_sha256','font_hashes','page_count','width_css_px','height_css_px','overflow_count','candidate_field_count','frame_draw_count','logo_draw_count','video_link_count','fonts_ready','images_ready','rendered_at','link_targets_sha256'])and proof->>'renderer_version'=version.snapshot#>>'{render_configuration,renderer_version}'and jsonb_typeof(proof->'chromium_version')='string'and length(proof->>'chromium_version')between 1 and 100 and proof->>'template_content_sha256'=version.snapshot#>>'{template,content_sha256}'and proof->'font_hashes'=version.snapshot#>'{template,font_hashes}'and proof->'page_count'=to_jsonb(version.page_count)and proof->'width_css_px'='1600'and proof->'height_css_px'='900'and proof->'overflow_count'='0'and proof->'candidate_field_count'=to_jsonb(candidate_count*10)and proof->'frame_draw_count'=to_jsonb(frame_count)and proof->'logo_draw_count'=to_jsonb(logo_count)and proof->'video_link_count'=to_jsonb(video_count)and proof->'fonts_ready'='true'and proof->'images_ready'='true'and eps.presentation_timestamp_valid(proof->'rendered_at')and proof->>'link_targets_sha256'=link_hash,'RESULT_INVALID');
 else
  select payload,attempt_id into rendered,render_attempt from eps.review_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='render_presentation';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  perform eps.specs_stage_assert(p_value->'manifest_asset'=rendered->'manifest_asset'and p_value->'pdf_asset'=rendered->'pdf_asset'and eps.presentation_output_ref(p_value->'manifest_asset',p_job,render_attempt,'presentation_manifest')and eps.presentation_output_ref(p_value->'pdf_asset',p_job,render_attempt,'presentation_pdf'),'RESULT_INVALID');
  perform eps.specs_stage_assert(eps.specs_stage_shape(proof,array['pdf_sha256','page_count','width_points','height_points','text_regions_checked','image_draws_checked','video_links_checked','embedded_font_count','validated_at'])and proof->>'pdf_sha256'=p_value#>>'{pdf_asset,sha256}'and proof->'page_count'=to_jsonb(version.page_count)and jsonb_typeof(proof->'width_points')='number'and abs((proof->>'width_points')::numeric-1200)<=0.5 and jsonb_typeof(proof->'height_points')='number'and abs((proof->>'height_points')::numeric-675)<=0.5 and proof->'text_regions_checked'=to_jsonb(3+candidate_count*23+pending_count*27)and proof->'image_draws_checked'=to_jsonb(frame_count+logo_count)and proof->'video_links_checked'=to_jsonb(video_count)and eps.specs_stage_integer(proof->'embedded_font_count',1,6000)and eps.presentation_timestamp_valid(proof->'validated_at'),'RESULT_INVALID');
 end if;
end$$;
create function eps.presentation_commit_result(p_job eps.jobs,p_value jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$
declare prior text;version eps.presentation_versions;begin
 prior:=current_setting('eps.presentation.lifecycle_job',true);perform set_config('eps.presentation.lifecycle_job',p_job.id::text,true);
 if p_job.stage='render_presentation'then
  insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
  select p_job.resource_id,a.id,a.purpose,a.bucket,a.object_key,a.mime_type,a.size_bytes,a.sha256,a.width,a.height,a.duration_ms,a.source_asset_id,a.source_timestamp_ms,a.filename,a.created_at
  from eps.media_assets a where a.id in((p_value#>>'{manifest_asset,asset_id}')::uuid,(p_value#>>'{pdf_asset,asset_id}')::uuid);
 elsif p_job.stage='publish_presentation'then
  update eps.presentation_versions set status='ready',manifest_asset_id=(p_value->>'manifest_asset_id')::uuid,pdf_asset_id=(p_value->>'pdf_asset_id')::uuid,ready_at=clock_timestamp(),failure_code=null,row_version=row_version+1,updated_at=clock_timestamp()where id=p_job.resource_id and generation_job_id=p_job.id and status<>'ready'returning * into version;
  perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
  update eps.presentation_series set latest_ready_version_id=version.id,latest_ready_version_no=version.version_number,row_version=row_version+1,updated_at=clock_timestamp()where id=version.series_id and coalesce(latest_ready_version_no,0)<version.version_number;
 end if;
 perform set_config('eps.presentation.lifecycle_job',coalesce(prior,''),true);
end$$;
create function eps.record_presentation_job_event(p_event jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;previous eps.job_events;receipt jsonb;digest text;attempt uuid;sequence_value bigint;at_value timestamptz;safe_error jsonb;payload_id uuid;next_stage text;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])and octet_length(p_event::text)<=1048576 and p_event->>'stage'in('prepare_presentation','render_presentation','validate_presentation','publish_presentation')and p_event->>'event_type'in('heartbeat','progress','succeeded','failed')and eps.specs_stage_integer(p_event->'sequence',1)and length(p_event->>'event_id')between 1 and 200 and p_event->>'lease_token'~'^[a-f0-9]{64}$'and p_event->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.presentation_stage_lock((p_event->>'job_id')::uuid,false);at_value:=clock_timestamp();attempt:=(p_event->>'attempt_id')::uuid;sequence_value:=(p_event->>'sequence')::bigint;digest:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=attempt and event_id=p_event->>'event_id';
 if found then perform eps.specs_stage_assert(previous.payload_digest=digest,'EVENT_ID_CONFLICT');return previous.receipt||'{"duplicate":true,"applied":false}'::jsonb;end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=attempt and sequence=sequence_value),'EVENT_SEQUENCE_CONFLICT');
 receipt:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running'or job.cancel_requested_at is not null or job.current_attempt_id<>attempt or job.stage<>p_event->>'stage'or job.lease_expires_at<=at_value then return receipt||'{"stale":true}'::jsonb;end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');if sequence_value<=job.last_event_sequence then return receipt||'{"stale":true}'::jsonb;end if;
 if not eps.presentation_stage_can_write(job.requested_by,job.workspace_id)then safe_error:=eps.presentation_error('PERMISSION_CHANGED');
 elsif not eps.presentation_stage_matches(job)then safe_error:=eps.presentation_error('SNAPSHOT_INVALID');
 elsif p_event->>'event_type'='heartbeat'then
  perform eps.specs_stage_assert(not(p_event?'result')and not(p_event?'result_schema')and coalesce(p_event->'error','null')='null');job.heartbeat_at:=at_value;job.lease_expires_at:=at_value+interval'90seconds';
 elsif p_event->>'event_type'='progress'then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_event->'result',array['progress_completed','progress_total'])and eps.specs_stage_integer(p_event#>'{result,progress_completed}',job.progress_completed)and(p_event#>'{result,progress_total}'='null'or eps.specs_stage_integer(p_event#>'{result,progress_total}',(p_event#>>'{result,progress_completed}')::bigint)),'INVALID_PROGRESS');job.progress_completed:=(p_event#>>'{result,progress_completed}')::bigint;job.progress_total:=(p_event#>>'{result,progress_total}')::bigint;
 elsif p_event->>'event_type'='failed'then
  perform eps.specs_stage_assert(not(p_event?'result')and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'])and jsonb_typeof(p_event#>'{error,code}')='string'and jsonb_typeof(p_event#>'{error,retryable}')='boolean');safe_error:=eps.presentation_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean);
 else
  begin
   perform eps.specs_stage_assert(p_event->>'result_schema'=case job.stage when'prepare_presentation'then'presentation-preparation.v1'when'render_presentation'then'presentation-rendering.v1'when'validate_presentation'then'presentation-validation.v1'else'presentation-render-result.v1'end,'RESULT_INVALID');perform eps.presentation_validate_result(job,p_event->'result');
   insert into eps.review_stage_payloads(job_id,workspace_id,stage,attempt_id,input_hash,result_schema,payload)values(job.id,job.workspace_id,job.stage,attempt,job.input_hash,p_event->>'result_schema',p_event->'result')returning id into payload_id;
   perform eps.presentation_commit_result(job,p_event->'result');
  exception when raise_exception then if sqlerrm in('RESULT_INVALID','INVALID_REQUEST')then safe_error:=eps.presentation_error('PDF_OUTPUT_UNVERIFIED');else raise;end if;end;
  if safe_error is null then
   job.completed_stages:=job.completed_stages||jsonb_build_array(jsonb_build_object('stage',job.stage,'attempt_id',attempt,'input_hash',job.input_hash,'result_schema',p_event->>'result_schema','result',jsonb_build_object('stage_output_id',payload_id),'completed_at',at_value));
   next_stage:=case job.stage when'prepare_presentation'then'render_presentation'when'render_presentation'then'validate_presentation'when'validate_presentation'then'publish_presentation'else null end;
   if next_stage is null then job.status:='succeeded';job.result:=p_event->'result';else job.status:='queued';job.stage:=next_stage;job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value;job.progress_completed:=0;job.progress_total:=null;end if;job.lease_token_digest:=null;job.lease_expires_at:=null;
  end if;
 end if;
 if safe_error is not null then
  job.error:=safe_error;job.lease_token_digest:=null;job.lease_expires_at:=null;
  if safe_error->'retryable'='true'and coalesce((job.stage_attempts->>job.stage)::integer,0)<3 then job.status:='queued';job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';else job.status:='failed';end if;
 end if;
 update eps.jobs set status=job.status,stage=job.stage,completed_stages=job.completed_stages,result=job.result,error=job.error,last_event_sequence=sequence_value,heartbeat_at=job.heartbeat_at,lease_expires_at=job.lease_expires_at,lease_token_digest=job.lease_token_digest,available_at=job.available_at,dispatch_generation=job.dispatch_generation,progress_completed=job.progress_completed,progress_total=job.progress_total,row_version=row_version+1,updated_at=at_value where id=job.id;
 if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;
 receipt:=receipt||jsonb_build_object('applied',true,'job_status',job.status);insert into eps.job_events(job_id,attempt_id,event_id,sequence,stage,event_type,payload_digest,receipt)values(job.id,attempt,p_event->>'event_id',sequence_value,p_event->>'stage',p_event->>'event_type',digest,receipt);return receipt;
end$$;
create function eps.recover_presentation_job_stages(p_limit integer)returns integer language plpgsql volatile security definer set search_path=''as $$
declare item record;job eps.jobs;recovered integer:=0;obsolete boolean;at_value timestamptz;begin
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for item in select id,workspace_id from eps.jobs where kind='presentation_render'and status in('queued','running')order by lease_expires_at nulls last,id limit 1000 loop
  exit when recovered>=p_limit;perform 1 from eps.workspaces where id=item.workspace_id for update skip locked;if not found then continue;end if;
  job:=eps.presentation_stage_lock(item.id,false);if job.status not in('queued','running')or job.cancel_requested_at is not null then continue;end if;at_value:=clock_timestamp();
  if not eps.presentation_stage_can_write(job.requested_by,job.workspace_id)then job.status:='failed';job.error:=eps.presentation_error('PERMISSION_CHANGED');
  elsif not eps.presentation_stage_matches(job)then job.status:='failed';job.error:=eps.presentation_error('SNAPSHOT_INVALID');
  elsif job.status='queued'or job.lease_expires_at>at_value then continue;
  elsif coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then job.status:='failed';job.error:=eps.presentation_error('RETRY_EXHAUSTED');
  else job.status:='queued';job.error:=eps.presentation_error('LEASE_EXPIRED',true);job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;recovered:=recovered+1;
 end loop;return recovered;
end$$;
create policy presentation_jobs_service_read on eps.jobs for select to eps_review_stage_owner using(kind='presentation_render');
create policy presentation_jobs_service_update on eps.jobs for update to eps_review_stage_owner using(kind='presentation_render')with check(kind='presentation_render');
create function eps.presentation_is_job(p_job uuid)returns boolean language sql volatile security definer set search_path=''as $$select exists(select 1 from eps.jobs where id=p_job and kind='presentation_render')$$;
create function eps.presentation_stage_can_write(p_principal uuid,p_workspace uuid)returns boolean language sql volatile security invoker set search_path=''as $$
 select eps.review_stage_can_write(p_principal,p_workspace,'presentation_render')and exists(select 1 from public.app_capability_grants where principal_id=p_principal and capability='presentations.generate'and active)
$$;
create function eps.presentation_stage_matches(p_job eps.jobs)returns boolean language sql volatile security definer set search_path=''as $$
 select p_job.kind='presentation_render'and p_job.input_hash_version='eps.presentation-job-input.cast-canonical.v1'and p_job.input_hash=eps.presentation_hash(p_job.input)
 and exists(select 1 from eps.presentation_versions v where v.id=p_job.resource_id and v.generation_job_id=p_job.id and v.workspace_id=p_job.workspace_id
  and p_job.input=jsonb_build_object('schema_version','1.0','workspace_id',v.workspace_id,'series_id',v.series_id,'version_id',v.id,'snapshot_sha256',v.snapshot_sha256,'manifest_sha256',v.manifest_sha256,'inventory_sha256',v.inventory_sha256,'configuration',v.snapshot->'render_configuration')
  and v.snapshot_sha256=eps.presentation_hash(v.snapshot)and v.manifest_sha256=eps.presentation_hash(v.manifest)and v.inventory_sha256=eps.presentation_hash(v.snapshot->'asset_inventory'))
$$;
create function eps.presentation_stage_lock(p_job uuid,p_require_access boolean default true)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$
declare identity eps.jobs;job eps.jobs;begin
 select * into identity from eps.jobs where id=p_job and kind='presentation_render';if not found then perform eps.fail('RESOURCE_NOT_FOUND','Presentation job not found.',404);end if;
 perform 1 from eps.workspaces where id=identity.workspace_id for update;
 select * into job from eps.jobs where id=p_job and workspace_id=identity.workspace_id and resource_id=identity.resource_id and kind='presentation_render'for update;
 perform eps.specs_stage_assert(found,'RESOURCE_NOT_FOUND');
 if p_require_access and not eps.presentation_stage_can_write(job.requested_by,job.workspace_id)then perform eps.fail('PERMISSION_CHANGED','The requester no longer has presentation generation authority.',403);end if;
 return job;
end$$;
create function eps.presentation_stage_current(p_job uuid,p_attempt uuid,p_token text)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$declare job eps.jobs;begin
 job:=eps.presentation_stage_lock(p_job);perform eps.specs_stage_assert(job.status='running'and job.current_attempt_id=p_attempt and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_token~'^[a-f0-9]{64}$'and job.lease_token_digest=encode(sha256(convert_to(p_token,'UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(eps.presentation_stage_matches(job),'SNAPSHOT_INVALID');return job;
end$$;
create function eps.presentation_stage_live(p_job uuid,p_attempt uuid,p_hash text)returns boolean language sql volatile security definer set search_path=''as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='presentation_render'and j.current_attempt_id=p_attempt and j.input_hash=p_hash and j.status='running'and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp()and eps.presentation_stage_can_write(j.requested_by,j.workspace_id)and eps.presentation_stage_matches(j))
$$;
create function eps.presentation_error(p_code text,p_retryable boolean default false)returns jsonb language sql immutable security invoker set search_path=''as $$
 select jsonb_build_object('code',case when p_code=any(array['PDF_SOURCE_UNAVAILABLE','PDF_TEMPLATE_UNAVAILABLE','PDF_LAYOUT_OVERFLOW','PDF_INVALID','PDF_PAGE_COUNT_MISMATCH','PDF_LINKS_INVALID','PDF_OUTPUT_UNVERIFIED','PDF_BUDGET_EXCEEDED','SNAPSHOT_INVALID','PERMISSION_CHANGED','RETRY_EXHAUSTED','JOB_CANCELLED','PROCESSING_FAILED','DEPENDENCY_UNAVAILABLE','LEASE_EXPIRED','DISPATCH_UNAVAILABLE'])then p_code else'PROCESSING_FAILED'end,'message','Presentation processing could not complete. The captured version was retained.','details','{}'::jsonb,'retryable',p_retryable and p_code in('DEPENDENCY_UNAVAILABLE','LEASE_EXPIRED','DISPATCH_UNAVAILABLE'))
$$;
create function eps.presentation_job_lifecycle()returns trigger language plpgsql security definer set search_path=''as $$
declare prior text;state text;begin
 if new.kind<>'presentation_render'or new.status=old.status then return new;end if;
 prior:=current_setting('eps.presentation.lifecycle_job',true);perform set_config('eps.presentation.lifecycle_job',new.id::text,true);
 state:=case when new.status='running'then'rendering'when new.status in('failed','cancelled','waiting_for_input')then'failed'when new.status='queued'then'queued'else null end;
 if state is not null then
  update eps.presentation_versions set status=state,failure_code=case when state='failed'then case when new.status='cancelled'then'JOB_CANCELLED'else coalesce(new.error->>'code','PROCESSING_FAILED')end else null end,row_version=row_version+1,updated_at=clock_timestamp()
  where generation_job_id=new.id and status<>'ready';
 end if;
 perform set_config('eps.presentation.lifecycle_job',coalesce(prior,''),true);return new;
end$$;
create trigger presentation_job_lifecycle after update of status on eps.jobs for each row execute function eps.presentation_job_lifecycle();
create function eps.claim_presentation_job_stage(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;completed jsonb;token text;attempts integer;at_value timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash'])and p_input->>'stage'in('prepare_presentation','render_presentation','validate_presentation','publish_presentation')and p_input->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.presentation_stage_lock((p_input->>'job_id')::uuid);at_value:=clock_timestamp();
 perform eps.specs_stage_assert(exists(select 1 from eps.presentation_processing_config where id and enabled),'DEPENDENCY_UNAVAILABLE');
 perform eps.specs_stage_assert(eps.presentation_stage_matches(job),'SNAPSHOT_INVALID');perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 if job.status='cancelled'or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','Presentation processing was cancelled.',409);end if;
 select value into completed from jsonb_array_elements(job.completed_stages)value where value->>'stage'=p_input->>'stage'and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id','lease_token','','lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result'));end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running'and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','This stage already has an active lease.',409);end if;
 perform eps.specs_stage_assert(job.status in('queued','running')and job.available_at<=at_value,'JOB_NOT_AVAILABLE');attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);perform eps.specs_stage_assert(attempts<3,'RETRY_EXHAUSTED');token:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token,'UTF8')),'hex'),lease_expires_at=at_value+interval'90seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token,'lease_expires_at',job.lease_expires_at,'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash));
end$$;
create function eps.get_presentation_stage_input(p_job_id uuid,p_attempt_id uuid,p_lease_token text)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;snapshot jsonb;prepared jsonb;rendered jsonb;validated jsonb;begin
 job:=eps.presentation_stage_lock(p_job_id);perform eps.specs_stage_assert(job.status='running'and job.current_attempt_id=p_attempt_id and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_lease_token~'^[a-f0-9]{64}$'and job.lease_token_digest=encode(sha256(convert_to(p_lease_token,'UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(eps.presentation_stage_matches(job),'SNAPSHOT_INVALID');
 select v.snapshot into snapshot from eps.presentation_versions v where v.id=job.resource_id and v.generation_job_id=job.id;
 select payload into prepared from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='prepare_presentation';
 select payload into rendered from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='render_presentation';
 select payload into validated from eps.review_stage_payloads where job_id=job.id and input_hash=job.input_hash and stage='validate_presentation';
 if job.stage<>'prepare_presentation'then perform eps.specs_stage_assert(prepared is not null,'STAGE_STATE_INVALID');end if;
 if job.stage in('validate_presentation','publish_presentation')then perform eps.specs_stage_assert(rendered is not null,'STAGE_STATE_INVALID');end if;
 if job.stage='publish_presentation'then perform eps.specs_stage_assert(validated is not null,'STAGE_STATE_INVALID');end if;
 return job.input||jsonb_build_object('job_id',job.id,'attempt_id',p_attempt_id,'stage',job.stage,'input_hash',job.input_hash,'snapshot',snapshot,'prepared',prepared,'rendered',rendered,'validated',validated);
end$$;
