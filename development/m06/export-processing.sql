-- M06 frozen Ready export stages. Bearer grants occur only in the authenticated
-- mint response and the private PDF, never job/outbox/manifest/event metadata.
do $$declare item record;definition text;begin
 for item in select conname,pg_get_constraintdef(oid)body,conrelid::regclass tab from pg_constraint where connamespace='eps'::regnamespace and conname in('jobs_kind_check','jobs_stage_check','jobs_kind_stage_check','jobs_input_hash_version_check','job_events_stage_check','outbox_events_stage_check')loop
  definition:=item.body;
  if item.conname='jobs_kind_check'then definition:=replace(definition,'''presentation_render''::text','''presentation_render''::text,''presentation_export''::text');
  elsif item.conname='jobs_kind_stage_check'then definition:='CHECK ('||substring(definition from 7)||' OR(kind=''presentation_export''and stage=''render_export''))';
  elsif item.conname='jobs_input_hash_version_check'then definition:=replace(definition,'''eps.presentation-job-input.cast-canonical.v1''::text','''eps.presentation-job-input.cast-canonical.v1''::text,''eps.presentation-export-input.cast-canonical.v1''::text');
  else definition:=replace(definition,'''publish_presentation''::text','''publish_presentation''::text,''render_export''::text');end if;
  if definition=item.body then raise exception'M06_STAGE_CONSTRAINT_ANCHOR_REQUIRED';end if;
  execute format('alter table %s drop constraint %I',item.tab,item.conname);execute format('alter table %s add constraint %I %s',item.tab,item.conname,definition);
 end loop;
end$$;
create function eps.export_is_job(p_job uuid)returns boolean language sql volatile security definer set search_path=''as $$select exists(select 1 from eps.jobs where id=p_job and kind='presentation_export')$$;
create function eps.export_stage_can_write(p_principal uuid,p_workspace uuid)returns boolean language sql volatile security invoker set search_path=''as $$
 select eps.job_requester_active(p_principal)and exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id join public.project_memberships m on m.project_id=p.id where w.id=p_workspace and w.archived_at is null and p.archived_at is null and m.principal_id=p_principal and m.active and m.can_write)
 and exists(select 1 from public.app_capability_grants where principal_id=p_principal and capability='review_links.manage'and active)
$$;
create function eps.export_stage_matches(p_job eps.jobs)returns boolean language sql volatile security definer set search_path=''as $$
 select p_job.kind='presentation_export'and p_job.stage='render_export'and p_job.input_hash_version='eps.presentation-export-input.cast-canonical.v1'and p_job.input_hash=eps.presentation_hash(p_job.input)
 and exists(select 1 from eps.presentation_exports e join eps.review_links l on l.id=e.review_link_id join eps.presentation_versions v on v.id=e.version_id where e.id=p_job.resource_id and e.job_id=p_job.id and v.workspace_id=p_job.workspace_id and v.status='ready'and e.template_version=v.snapshot#>>'{template,version}' and l.series_id=v.series_id and eps.guest_link_live(l)and l.download_enabled and l.created_by=p_job.requested_by and e.parent_token_generation=l.token_generation and e.export_revision=l.export_revision
 and p_job.input=jsonb_build_object('schema_version','1.0','workspace_id',v.workspace_id,'series_id',v.series_id,'version_id',v.id,'export_id',e.id,'review_link_id',l.id,'export_revision',e.export_revision,'token_generation',l.token_generation,'snapshot_sha256',v.snapshot_sha256,'manifest_sha256',v.manifest_sha256,'inventory_sha256',v.inventory_sha256,'configuration',v.snapshot->'render_configuration')
 and v.snapshot_sha256=eps.presentation_hash(v.snapshot)and v.manifest_sha256=eps.presentation_hash(v.manifest)and v.inventory_sha256=eps.presentation_hash(v.snapshot->'asset_inventory'))
$$;
create function eps.export_stage_lock(p_job uuid,p_require_access boolean default true)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$
declare identity eps.jobs;job eps.jobs;link_id uuid;begin
 select * into identity from eps.jobs where id=p_job and kind='presentation_export';if not found then perform eps.fail('RESOURCE_NOT_FOUND','Guest export job not found.',404);end if;
 perform 1 from eps.workspaces where id=identity.workspace_id for update;select review_link_id into link_id from eps.presentation_exports where id=identity.resource_id;
 perform 1 from eps.review_links where id=link_id for update;perform 1 from eps.presentation_exports where id=identity.resource_id for update;
 select * into job from eps.jobs where id=p_job and workspace_id=identity.workspace_id and resource_id=identity.resource_id and kind='presentation_export'for update;
 perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');if p_require_access and not eps.export_stage_can_write(job.requested_by,job.workspace_id)then perform eps.fail('PERMISSION_CHANGED','The link owner no longer has export authority.',403);end if;return job;
end$$;
create function eps.export_stage_current(p_job uuid,p_attempt uuid,p_token text)returns eps.jobs language plpgsql volatile security definer set search_path=''as $$declare job eps.jobs;begin
 job:=eps.export_stage_lock(p_job);perform eps.specs_stage_assert(job.status='running'and job.current_attempt_id=p_attempt and job.cancel_requested_at is null and job.lease_expires_at>clock_timestamp(),'STALE_STAGE_LEASE');
 perform eps.specs_stage_assert(p_token~'^[a-f0-9]{64}$'and job.lease_token_digest=encode(sha256(convert_to(p_token,'UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(eps.export_stage_matches(job),'SNAPSHOT_INVALID');return job;
end$$;
create function eps.export_stage_live(p_job uuid,p_attempt uuid,p_hash text)returns boolean language sql volatile security definer set search_path=''as $$
 select exists(select 1 from eps.jobs j where j.id=p_job and j.kind='presentation_export'and j.current_attempt_id=p_attempt and j.input_hash=p_hash and j.status='running'and j.cancel_requested_at is null and j.lease_expires_at>clock_timestamp()and eps.export_stage_can_write(j.requested_by,j.workspace_id)and eps.export_stage_matches(j))
$$;
create function eps.mint_review_media_grant(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;export eps.presentation_exports;link eps.review_links;grant_id uuid:=gen_random_uuid();raw_token text;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token']));job:=eps.export_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 select * into export from eps.presentation_exports where id=job.resource_id;select * into link from eps.review_links where id=export.review_link_id;
 perform eps.specs_stage_assert(export.status='rendering'and export.media_grant_id is null,'STAGE_STATE_INVALID');
 update eps.review_media_grants set revoked_at=coalesce(revoked_at,clock_timestamp())where export_id=export.id and revoked_at is null;
 raw_token:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');
 insert into eps.review_media_grants(id,review_link_id,version_id,export_id,parent_token_generation,token_digest,expires_at,producing_attempt_id)values(grant_id,link.id,export.version_id,export.id,link.token_generation,encode(sha256(convert_to(raw_token,'UTF8')),'hex'),link.expires_at,job.current_attempt_id);
 return jsonb_build_object('grant_id',grant_id,'grant_token',raw_token,'version_id',export.version_id,'review_link_id',link.id,'export_id',export.id,'export_revision',export.export_revision,'expires_at',eps.presentation_time(link.expires_at));
end$$;
create function eps.export_validate_result(p_job eps.jobs,p_value jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$
declare version eps.presentation_versions;export eps.presentation_exports;proof jsonb;validation jsonb;candidate_count integer;pending_count integer;frame_count integer;logo_count integer;video_count integer;begin
 select * into export from eps.presentation_exports where id=p_job.resource_id and job_id=p_job.id;perform eps.specs_stage_assert(found,'SNAPSHOT_INVALID');select * into version from eps.presentation_versions where id=export.version_id and status='ready';perform eps.specs_stage_assert(found,'SNAPSHOT_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['schema_version','version_id','export_id','review_link_id','export_revision','grant_id','snapshot_sha256','manifest_sha256','inventory_sha256','pdf_asset','render_proof','validation_proof'])and p_value->>'schema_version'='1.0'and p_value->>'version_id'=version.id::text and p_value->>'export_id'=export.id::text and p_value->>'review_link_id'=export.review_link_id::text and p_value->'export_revision'=to_jsonb(export.export_revision)and p_value->>'snapshot_sha256'=version.snapshot_sha256 and p_value->>'manifest_sha256'=version.manifest_sha256 and p_value->>'inventory_sha256'=version.inventory_sha256,'RESULT_INVALID');
 perform eps.specs_stage_assert(exists(select 1 from eps.review_media_grants g join eps.review_links l on l.id=g.review_link_id where g.id=eps.input_uuid(p_value->>'grant_id')and g.export_id=export.id and g.version_id=version.id and g.review_link_id=export.review_link_id and g.parent_token_generation=export.parent_token_generation and g.parent_token_generation=l.token_generation and g.revoked_at is null and g.expires_at>clock_timestamp()and eps.guest_link_live(l)and g.producing_attempt_id=p_job.current_attempt_id),'RESULT_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value->'pdf_asset',array['asset_id','sha256','size_bytes','mime_type'])and exists(select 1 from eps.media_assets a where a.id=eps.input_uuid(p_value#>>'{pdf_asset,asset_id}')and a.producing_job_id=p_job.id and a.producing_attempt_id=p_job.current_attempt_id and a.origin_workspace_id=p_job.workspace_id and a.output_stage='render_export'and a.output_key='presentation_pdf'and a.purpose='presentation_pdf'and a.status='ready'and a.bucket='eps-presentation-outputs'and a.object_key='jobs/'||p_job.id||'/attempts/'||p_job.current_attempt_id||'/'||a.id||'.pdf'and a.sha256=p_value#>>'{pdf_asset,sha256}'and to_jsonb(a.size_bytes)=p_value#>'{pdf_asset,size_bytes}'and a.mime_type='application/pdf'and p_value#>>'{pdf_asset,mime_type}'='application/pdf'and a.width is null and a.height is null and a.duration_ms is null and a.source_asset_id is null and a.source_timestamp_ms is null),'RESULT_INVALID');
 select count(*)filter(where s->>'kind'='candidate'),count(*)filter(where s->>'kind'='pending'),coalesce(sum(jsonb_array_length(s->'frames')),0),count(*)filter(where s->>'logo_asset_id'is not null),count(*)filter(where s->>'video_asset_id'is not null)into candidate_count,pending_count,frame_count,logo_count,video_count from jsonb_array_elements(version.snapshot->'slides')s;
 proof:=p_value->'render_proof';validation:=p_value->'validation_proof';
 perform eps.specs_stage_assert(eps.specs_stage_shape(proof,array['renderer_version','chromium_version','template_content_sha256','font_hashes','page_count','width_css_px','height_css_px','overflow_count','candidate_field_count','frame_draw_count','logo_draw_count','video_link_count','fonts_ready','images_ready','rendered_at','link_targets_sha256'])and proof->>'renderer_version'=version.snapshot#>>'{render_configuration,renderer_version}'and proof->>'chromium_version'~'^[0-9]+([.][0-9]+){2,3}$'and proof->>'template_content_sha256'=version.snapshot#>>'{template,content_sha256}'and proof->'font_hashes'=version.snapshot#>'{template,font_hashes}'and proof->'page_count'=to_jsonb(version.page_count)and proof->'width_css_px'='1600'and proof->'height_css_px'='900'and proof->'overflow_count'='0'and proof->'candidate_field_count'=to_jsonb(candidate_count*10)and proof->'frame_draw_count'=to_jsonb(frame_count)and proof->'logo_draw_count'=to_jsonb(logo_count)and proof->'video_link_count'=to_jsonb(video_count)and proof->'fonts_ready'='true'and proof->'images_ready'='true'and eps.presentation_timestamp_valid(proof->'rendered_at')and proof->>'link_targets_sha256'~'^[a-f0-9]{64}$','RESULT_INVALID');
 perform eps.specs_stage_assert(eps.specs_stage_shape(validation,array['pdf_sha256','page_count','width_points','height_points','text_regions_checked','image_draws_checked','video_links_checked','embedded_font_count','validated_at'])and validation->>'pdf_sha256'=p_value#>>'{pdf_asset,sha256}'and validation->'page_count'=to_jsonb(version.page_count)and jsonb_typeof(validation->'width_points')='number'and abs((validation->>'width_points')::numeric-1200)<=0.5 and jsonb_typeof(validation->'height_points')='number'and abs((validation->>'height_points')::numeric-675)<=0.5 and validation->'text_regions_checked'=to_jsonb(3+candidate_count*23+pending_count*case when version.snapshot#>>'{template,version}'='1.1.0'then 27 else 4 end)and validation->'image_draws_checked'=to_jsonb(frame_count+logo_count)and validation->'video_links_checked'=to_jsonb(video_count)and eps.specs_stage_integer(validation->'embedded_font_count',1,6000)and eps.presentation_timestamp_valid(validation->'validated_at'),'RESULT_INVALID');
end$$;
create function eps.export_commit_result(p_job eps.jobs,p_value jsonb)returns void language plpgsql volatile security invoker set search_path=''as $$begin
 update eps.presentation_exports set status='ready',pdf_asset_id=eps.input_uuid(p_value#>>'{pdf_asset,asset_id}'),media_grant_id=eps.input_uuid(p_value->>'grant_id'),ready_at=clock_timestamp(),failure_code=null,row_version=row_version+1 where id=p_job.resource_id and job_id=p_job.id and status='rendering';perform eps.specs_stage_assert(found,'STAGE_STATE_INVALID');
end$$;
create function eps.get_export_stage_input(p_job_id uuid,p_attempt_id uuid,p_lease_token text)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare job eps.jobs;snapshot jsonb;begin
 job:=eps.export_stage_current(p_job_id,p_attempt_id,p_lease_token);select v.snapshot into snapshot from eps.presentation_exports e join eps.presentation_versions v on v.id=e.version_id where e.id=job.resource_id and v.status='ready';perform eps.specs_stage_assert(found,'SNAPSHOT_INVALID');
 return job.input||jsonb_build_object('job_id',job.id,'attempt_id',p_attempt_id,'stage','render_export','input_hash',job.input_hash,'snapshot',snapshot);
end$$;
create function eps.export_job_lifecycle()returns trigger language plpgsql security definer set search_path=''as $$declare state text;begin
 if new.kind<>'presentation_export'or new.status=old.status then return new;end if;
 state:=case when new.status='running'then'rendering'when new.status in('failed','cancelled','waiting_for_input')then'failed'when new.status='queued'then'queued'else null end;
 if state is not null then
  update eps.review_media_grants set revoked_at=coalesce(revoked_at,clock_timestamp())where export_id=new.resource_id and revoked_at is null and not exists(select 1 from eps.presentation_exports e where e.id=new.resource_id and e.status='ready');
  update eps.presentation_exports set status=state,pdf_asset_id=null,media_grant_id=null,ready_at=null,failure_code=case when state='failed'then case when new.status='cancelled'then'JOB_CANCELLED'else coalesce(new.error->>'code','PROCESSING_FAILED')end else null end,row_version=row_version+1 where id=new.resource_id and job_id=new.id and status<>'ready';
 end if;return new;
end$$;
create trigger export_job_lifecycle after update of status on eps.jobs for each row execute function eps.export_job_lifecycle();
create function eps.export_asset_member(p_job eps.jobs,p_asset eps.media_assets,p_permission text)returns boolean language plpgsql volatile security invoker set search_path=''as $$begin
 if p_permission='read'and p_asset.status in('ready','archived')and exists(select 1 from eps.presentation_version_assets p where p.version_id=eps.input_uuid(p_job.input->>'version_id')and p.asset_id=p_asset.id and p.asset_kind in('client_logo','candidate_frame')and p.bucket=p_asset.bucket and p.object_key=p_asset.object_key and p.sha256=p_asset.sha256 and p.byte_size=p_asset.size_bytes and p.mime_type=p_asset.mime_type)then return true;end if;
 return p_asset.purpose='presentation_pdf'and p_asset.producing_job_id=p_job.id and p_asset.producing_attempt_id=p_job.current_attempt_id and p_asset.output_stage='render_export'and p_asset.bucket='eps-presentation-outputs'and p_asset.status in('uploading','ready')and(p_permission='read'or p_asset.status='uploading');
end$$;
create function eps.record_export_job_event(p_event jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;previous eps.job_events;receipt jsonb;digest text;attempt uuid;sequence_value bigint;at_value timestamptz;safe_error jsonb;payload_id uuid;next_stage text;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_event,array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash','result_schema','result','error'],array['event_id','job_id','attempt_id','lease_token','stage','sequence','event_type','input_hash'])and octet_length(p_event::text)<=1048576 and p_event->>'stage'='render_export'and p_event->>'event_type'in('heartbeat','progress','succeeded','failed')and eps.specs_stage_integer(p_event->'sequence',1)and length(p_event->>'event_id')between 1 and 200 and p_event->>'lease_token'~'^[a-f0-9]{64}$'and p_event->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.export_stage_lock((p_event->>'job_id')::uuid,false);at_value:=clock_timestamp();attempt:=(p_event->>'attempt_id')::uuid;sequence_value:=(p_event->>'sequence')::bigint;digest:=encode(sha256(convert_to(p_event::text,'UTF8')),'hex');
 select * into previous from eps.job_events where job_id=job.id and attempt_id=attempt and event_id=p_event->>'event_id';
 if found then perform eps.specs_stage_assert(previous.payload_digest=digest,'EVENT_ID_CONFLICT');return previous.receipt||'{"duplicate":true,"applied":false}'::jsonb;end if;
 perform eps.specs_stage_assert(not exists(select 1 from eps.job_events where job_id=job.id and attempt_id=attempt and sequence=sequence_value),'EVENT_SEQUENCE_CONFLICT');
 receipt:=jsonb_build_object('event_id',p_event->>'event_id','applied',false,'duplicate',false,'stale',false,'job_status',job.status);
 if job.status<>'running'or job.cancel_requested_at is not null or job.current_attempt_id<>attempt or job.stage<>p_event->>'stage'or job.lease_expires_at<=at_value then return receipt||'{"stale":true}'::jsonb;end if;
 perform eps.specs_stage_assert(job.lease_token_digest=encode(sha256(convert_to(p_event->>'lease_token','UTF8')),'hex'),'LEASE_INVALID');perform eps.specs_stage_assert(job.input_hash=p_event->>'input_hash','INPUT_HASH_MISMATCH');if sequence_value<=job.last_event_sequence then return receipt||'{"stale":true}'::jsonb;end if;
 if not eps.export_stage_can_write(job.requested_by,job.workspace_id)then safe_error:=eps.presentation_error('PERMISSION_CHANGED');
 elsif not eps.export_stage_matches(job)then safe_error:=eps.presentation_error('SNAPSHOT_INVALID');
 elsif p_event->>'event_type'='heartbeat'then
  perform eps.specs_stage_assert(not(p_event?'result')and not(p_event?'result_schema')and coalesce(p_event->'error','null')='null');job.heartbeat_at:=at_value;job.lease_expires_at:=at_value+interval'90seconds';
 elsif p_event->>'event_type'='progress'then
  perform eps.specs_stage_assert(eps.specs_stage_shape(p_event->'result',array['progress_completed','progress_total'])and eps.specs_stage_integer(p_event#>'{result,progress_completed}',job.progress_completed)and(p_event#>'{result,progress_total}'='null'or eps.specs_stage_integer(p_event#>'{result,progress_total}',(p_event#>>'{result,progress_completed}')::bigint)),'INVALID_PROGRESS');job.progress_completed:=(p_event#>>'{result,progress_completed}')::bigint;job.progress_total:=(p_event#>>'{result,progress_total}')::bigint;
 elsif p_event->>'event_type'='failed'then
  perform eps.specs_stage_assert(not(p_event?'result')and eps.specs_stage_shape(p_event->'error',array['code','message','details','retryable'])and jsonb_typeof(p_event#>'{error,code}')='string'and jsonb_typeof(p_event#>'{error,retryable}')='boolean');safe_error:=eps.presentation_error(p_event#>>'{error,code}',(p_event#>>'{error,retryable}')::boolean);
 else
  begin
   perform eps.specs_stage_assert(p_event->>'result_schema'='presentation-export-result.v1','RESULT_INVALID');perform eps.export_validate_result(job,p_event->'result');
   insert into eps.review_stage_payloads(job_id,workspace_id,stage,attempt_id,input_hash,result_schema,payload)values(job.id,job.workspace_id,job.stage,attempt,job.input_hash,p_event->>'result_schema',p_event->'result')returning id into payload_id;
   perform eps.export_commit_result(job,p_event->'result');
  exception when raise_exception then if sqlerrm in('RESULT_INVALID','INVALID_REQUEST')then safe_error:=eps.presentation_error('PDF_OUTPUT_UNVERIFIED');else raise;end if;end;
  if safe_error is null then
   job.completed_stages:=job.completed_stages||jsonb_build_array(jsonb_build_object('stage',job.stage,'attempt_id',attempt,'input_hash',job.input_hash,'result_schema',p_event->>'result_schema','result',jsonb_build_object('stage_output_id',payload_id),'completed_at',at_value));
   next_stage:=null;
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
create function eps.recover_export_job_stages(p_limit integer)returns integer language plpgsql volatile security definer set search_path=''as $$
declare item record;job eps.jobs;recovered integer:=0;obsolete boolean;at_value timestamptz;begin
 perform eps.guest_cleanup_credentials();
 perform eps.specs_stage_assert(p_limit between 0 and 100);if p_limit=0 then return 0;end if;
 for item in select id,workspace_id from eps.jobs where kind='presentation_export'and status in('queued','running')order by lease_expires_at nulls last,id limit 1000 loop
  exit when recovered>=p_limit;perform 1 from eps.workspaces where id=item.workspace_id for update skip locked;if not found then continue;end if;
  job:=eps.export_stage_lock(item.id,false);if job.status not in('queued','running')or job.cancel_requested_at is not null then continue;end if;at_value:=clock_timestamp();
  if not eps.export_stage_can_write(job.requested_by,job.workspace_id)then job.status:='failed';job.error:=eps.presentation_error('PERMISSION_CHANGED');
  elsif not eps.export_stage_matches(job)then job.status:='failed';job.error:=eps.presentation_error('SNAPSHOT_INVALID');
  elsif job.status='queued'or job.lease_expires_at>at_value then continue;
  elsif coalesce((job.stage_attempts->>job.stage)::integer,0)>=3 then job.status:='failed';job.error:=eps.presentation_error('RETRY_EXHAUSTED');
  else job.status:='queued';job.error:=eps.presentation_error('LEASE_EXPIRED',true);job.dispatch_generation:=job.dispatch_generation+1;job.available_at:=at_value+interval'2seconds';end if;
  update eps.jobs set status=job.status,error=job.error,lease_token_digest=null,lease_expires_at=null,available_at=job.available_at,dispatch_generation=job.dispatch_generation,row_version=row_version+1,updated_at=at_value where id=job.id;
  if job.status='queued'then insert into eps.outbox_events(job_id,stage,input_hash,dispatch_generation,dedupe_key,available_at)values(job.id,job.stage,job.input_hash,job.dispatch_generation,job.id::text||':'||job.dispatch_generation::text,job.available_at);end if;recovered:=recovered+1;
 end loop;return recovered;
end$$;
create function eps.claim_export_job_stage(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;completed jsonb;token text;attempts integer;at_value timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','stage','input_hash','workflow_execution_id'],array['job_id','stage','input_hash'])and p_input->>'stage'='render_export'and p_input->>'input_hash'~'^[a-f0-9]{64}$');
 job:=eps.export_stage_lock((p_input->>'job_id')::uuid);at_value:=clock_timestamp();
 perform eps.specs_stage_assert(exists(select 1 from eps.presentation_processing_config where id and enabled),'DEPENDENCY_UNAVAILABLE');
 perform eps.specs_stage_assert(eps.export_stage_matches(job),'SNAPSHOT_INVALID');perform eps.specs_stage_assert(job.input_hash=p_input->>'input_hash','INPUT_HASH_MISMATCH');
 if job.status='cancelled'or job.cancel_requested_at is not null then perform eps.fail('JOB_CANCELLED','Presentation processing was cancelled.',409);end if;
 select value into completed from jsonb_array_elements(job.completed_stages)value where value->>'stage'=p_input->>'stage'and value->>'input_hash'=job.input_hash;
 if completed is not null then return jsonb_build_object('job_id',job.id,'stage',p_input->>'stage','attempt_id',completed->>'attempt_id','lease_token','','lease_expires_at',completed->>'completed_at','already_completed',true,'input',jsonb_build_object('input_hash',job.input_hash,'result_schema',completed->>'result_schema','result',completed->'result'));end if;
 perform eps.specs_stage_assert(job.stage=p_input->>'stage','STAGE_OUT_OF_ORDER');
 if job.status='running'and job.lease_expires_at>at_value then perform eps.fail('JOB_ALREADY_RUNNING','This stage already has an active lease.',409);end if;
 perform eps.specs_stage_assert(job.status in('queued','running')and job.available_at<=at_value,'JOB_NOT_AVAILABLE');update eps.review_media_grants set revoked_at=coalesce(revoked_at,at_value)where export_id=job.resource_id and revoked_at is null;attempts:=coalesce((job.stage_attempts->>job.stage)::integer,0);perform eps.specs_stage_assert(attempts<3,'RETRY_EXHAUSTED');token:=encode(extensions.gen_random_bytes(32),'hex');
 update eps.jobs set status='running',attempt=attempt+1,current_attempt_id=gen_random_uuid(),lease_token_digest=encode(sha256(convert_to(token,'UTF8')),'hex'),lease_expires_at=at_value+interval'90seconds',heartbeat_at=at_value,last_event_sequence=0,stage_attempts=jsonb_set(stage_attempts,array[stage],to_jsonb(attempts+1)),progress_completed=0,progress_total=null,error=null,n8n_execution_id=p_input->>'workflow_execution_id',row_version=row_version+1,updated_at=at_value where id=job.id returning * into job;
 return jsonb_build_object('job_id',job.id,'stage',job.stage,'attempt_id',job.current_attempt_id,'lease_token',token,'lease_expires_at',job.lease_expires_at,'already_completed',false,'input',job.input||jsonb_build_object('input_hash',job.input_hash));
end$$;
create function eps.get_export_asset_access(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;asset eps.media_assets;permission text;token text;at_value timestamptz;expiry timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','access'],array['job_id','attempt_id','lease_token','asset_id']));
 job:=eps.export_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');permission:=coalesce(p_input->>'access','read');perform eps.specs_stage_assert(permission in('read','write'));
 select * into asset from eps.media_assets where id=eps.input_uuid(p_input->>'asset_id');if not found or not eps.export_asset_member(job,asset,permission)then perform eps.fail('RESOURCE_NOT_FOUND','Asset not available to this captured version stage.',404);end if;
 at_value:=clock_timestamp();expiry:=least(job.lease_expires_at,at_value+interval'60seconds');perform eps.specs_stage_assert(expiry>at_value,'STALE_STAGE_LEASE');token:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');
 insert into eps.presentation_asset_grants(token_digest,job_id,attempt_id,input_hash,version_id,asset_id,bucket,object_key,permission,created_at,expires_at)values(encode(sha256(convert_to(token,'UTF8')),'hex'),job.id,job.current_attempt_id,job.input_hash,eps.input_uuid(job.input->>'version_id'),asset.id,asset.bucket,asset.object_key,permission,at_value,expiry);
 return jsonb_build_object('asset_id',asset.id,'bucket',asset.bucket,'object_key',asset.object_key,'permission',permission,'grant_token',token,'expires_at',expiry,'mime_type',asset.mime_type,'size_bytes',asset.size_bytes,'sha256',asset.sha256);
end$$;
create function eps.reserve_export_job_output(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;existing eps.media_assets;asset_id uuid:=gen_random_uuid();expected_size bigint;kind text;mime text;filename text;extension text;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','output_key','asset_kind','filename','mime_type','expected_size_bytes','parent_asset_id','time_offset_ms']));job:=eps.export_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 kind:=p_input->>'asset_kind';perform eps.specs_stage_assert(job.stage='render_export'and kind='presentation_pdf'and p_input->>'output_key'=kind and p_input->'parent_asset_id'='null'and p_input->'time_offset_ms'='null');
 mime:=case kind when'presentation_pdf'then'application/pdf'else'application/json'end;filename:=case kind when'presentation_pdf'then'presentation.pdf'else'presentation-manifest.json'end;extension:=case kind when'presentation_pdf'then'pdf'else'json'end;
 perform eps.specs_stage_assert(p_input->>'mime_type'=mime and p_input->>'filename'=filename);expected_size:=eps.logo_integer(p_input->'expected_size_bytes',1,case kind when'presentation_pdf'then 67108864 else 8388608 end);
 select * into existing from eps.media_assets where producing_job_id=job.id and producing_attempt_id=job.current_attempt_id and output_key=kind;
 if found then if existing.purpose<>kind or existing.size_bytes<>expected_size or existing.mime_type<>mime or existing.filename<>filename or existing.output_stage<>job.stage then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Logical presentation output metadata changed.',409);end if;
 else insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,producing_job_id,producing_attempt_id,output_stage,output_key)
  values(asset_id,job.workspace_id,kind,filename,mime,'eps-presentation-outputs','jobs/'||job.id||'/attempts/'||job.current_attempt_id||'/'||asset_id||'.'||extension,expected_size,'uploading',job.id,job.current_attempt_id,job.stage,kind)returning * into existing;end if;
 return jsonb_build_object('asset',eps.presentation_media_dto(existing),'bucket',existing.bucket,'object_key',existing.object_key);
end$$;
create function eps.complete_export_job_output(p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare job eps.jobs;asset eps.media_assets;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','sha256','actual_size_bytes','width','height','duration_ms']));job:=eps.export_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 select * into asset from eps.media_assets where id=eps.input_uuid(p_input->>'asset_id')and producing_job_id=job.id and producing_attempt_id=job.current_attempt_id and output_stage=job.stage and purpose='presentation_pdf';if not found or job.stage<>'render_export'then perform eps.fail('RESOURCE_NOT_FOUND','Presentation output is not in the active attempt.',404);end if;
 perform eps.specs_stage_assert(p_input->>'sha256'~'^[a-f0-9]{64}$'and eps.logo_integer(p_input->'actual_size_bytes',1,67108864)=asset.size_bytes and p_input->'width'='null'and p_input->'height'='null'and p_input->'duration_ms'='null');
 if asset.status='ready'then if asset.sha256 is distinct from p_input->>'sha256' then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Presentation output already contains different verified bytes.',409);end if;
 else perform eps.specs_stage_assert(asset.status='uploading','INVALID_TRANSITION');update eps.media_assets set status='ready',sha256=p_input->>'sha256'where id=asset.id returning * into asset;end if;return eps.presentation_media_dto(asset);
end$$;
create function eps.export_capability_allowed(p_bucket text,p_key text,p_permission text)returns boolean language plpgsql volatile security definer set search_path=''as $$
declare headers jsonb;token text;begin
 if p_bucket not in('eps-brand-assets','eps-candidate-assets','eps-candidate-outputs','eps-presentation-outputs')or p_permission not in('read','write')then return false;end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;token:=headers->>'x-eps-asset-grant';if token is null or token!~'^[A-Za-z0-9_-]{43}$'then return false;end if;
 return exists(select 1 from eps.presentation_asset_grants g join eps.jobs j on j.id=g.job_id join eps.media_assets a on a.id=g.asset_id where g.token_digest=encode(sha256(convert_to(token,'UTF8')),'hex')and g.bucket=p_bucket and g.object_key=p_key and g.permission=p_permission and g.version_id=eps.input_uuid(j.input->>'version_id') and g.expires_at>clock_timestamp()and a.bucket=p_bucket and a.object_key=p_key and eps.export_stage_live(j.id,g.attempt_id,g.input_hash)and eps.export_asset_member(j,a,p_permission)
 and(p_permission='read'or p_bucket='eps-presentation-outputs'and headers->>'x-upsert'='false'and headers->>'content-type'=a.mime_type));
end$$;
-- Only the PDF branch accepts the export stage; manifests remain render-only.
do $$declare source text;changed text;begin
 select pg_get_constraintdef(oid)into source from pg_constraint where conrelid='eps.media_assets'::regclass and conname='media_assets_typed_purpose_check';
 changed:=replace(source,'(output_stage = ''render_presentation''::text) AND (output_key = ''presentation_pdf''::text)','(output_stage = ANY(ARRAY[''render_presentation''::text,''render_export''::text])) AND (output_key = ''presentation_pdf''::text)');
 if changed=source then raise exception'M06_PDF_ASSET_CHECK_ANCHOR_REQUIRED';end if;
 alter table eps.media_assets drop constraint media_assets_typed_purpose_check;execute'alter table eps.media_assets add constraint media_assets_typed_purpose_check '||changed;
end$$;
create policy export_jobs_service_read on eps.jobs for select to eps_review_stage_owner using(kind='presentation_export');
create policy export_jobs_service_update on eps.jobs for update to eps_review_stage_owner using(kind='presentation_export')with check(kind='presentation_export');
grant select,insert,update on eps.presentation_exports,eps.review_media_grants to eps_review_stage_owner;
create policy export_stage_rows on eps.presentation_exports for all to eps_review_stage_owner using(true)with check(true);
create policy export_stage_grants on eps.review_media_grants for all to eps_review_stage_owner using(true)with check(true);
grant select,update(id)on eps.review_links to eps_review_stage_owner;
create policy export_stage_link_read on eps.review_links for select to eps_review_stage_owner using(true);
create policy export_stage_link_never_write on eps.review_links as restrictive for update to eps_review_stage_owner using(true)with check(false);
create policy export_asset_jobs_read on eps.jobs for select to eps_candidate_assets_owner using(kind='presentation_export');
create policy export_asset_service_insert on eps.media_assets for insert to eps_candidate_assets_owner with check(purpose='presentation_pdf'and status='uploading'and bucket='eps-presentation-outputs'and output_stage='render_export'and sha256 is null and eps.export_stage_live(producing_job_id,producing_attempt_id,(select input_hash from eps.jobs where id=producing_job_id)));
create policy export_asset_service_complete on eps.media_assets for update to eps_candidate_assets_owner using(purpose='presentation_pdf'and output_stage='render_export'and status='uploading'and eps.export_stage_live(producing_job_id,producing_attempt_id,(select input_hash from eps.jobs where id=producing_job_id)))with check(status='ready'and sha256 is not null);
create policy export_service_storage_read on storage.objects for select to anon using((storage.allow_only_operation('object.get_authenticated')or storage.allow_only_operation('object.get_authenticated_info'))and eps.export_capability_allowed(bucket_id,name,'read'));
create policy export_service_storage_write on storage.objects for insert to anon with check(bucket_id='eps-presentation-outputs'and storage.allow_only_operation('object.upload')and eps.export_capability_allowed(bucket_id,name,'write'));
do $$declare item record;qual text;begin
 for item in select polname,pg_get_expr(polqual,polrelid)body from pg_policy where polrelid='storage.objects'::regclass and polname in('eps_logo_read_guard','eps_candidate_read_guard','presentation_output_read_guard')loop
  qual:='('||item.body||') OR((storage.allow_only_operation(''object.get_authenticated'')OR storage.allow_only_operation(''object.get_authenticated_info''))AND eps.export_capability_allowed(bucket_id,name,''read''))';execute format('alter policy %I on storage.objects using(%s)',item.polname,qual);
 end loop;
 select pg_get_expr(polwithcheck,polrelid)into qual from pg_policy where polrelid='storage.objects'::regclass and polname='presentation_output_insert_guard';
 if qual is null then raise exception'M06_OUTPUT_INSERT_GUARD_REQUIRED';end if;
 execute'alter policy presentation_output_insert_guard on storage.objects with check(('||qual||')OR(bucket_id=''eps-presentation-outputs''AND storage.allow_only_operation(''object.upload'')AND eps.export_capability_allowed(bucket_id,name,''write'')))';
end$$;
create function eps.export_job_actions(p_job eps.jobs)returns jsonb language plpgsql volatile security definer set search_path=''as $$declare operator boolean;principal uuid;begin
 principal:=coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid;
 operator:=eps.job_requester_active(principal)and exists(select 1 from eps.workspaces w join public.projects p on p.id=w.project_id join public.project_memberships m on m.project_id=p.id where w.id=p_job.workspace_id and w.archived_at is null and p.archived_at is null and m.principal_id=principal and m.active and m.can_write)and exists(select 1 from public.app_capability_grants where principal_id=principal and capability='operations.retry'and active);
 return jsonb_build_object('can_retry',coalesce(operator and p_job.status='failed'and p_job.cancel_requested_at is null and p_job.error->>'code'is distinct from'JOB_CANCELLED'and eps.export_stage_can_write(p_job.requested_by,p_job.workspace_id)and eps.export_stage_matches(p_job),false),'can_cancel',coalesce(operator and p_job.status in('queued','running','waiting_for_input'),false));
end$$;
create function eps.export_stage_authorized(p_job eps.jobs)returns boolean language sql volatile security definer set search_path=''as $$select eps.export_stage_can_write(p_job.requested_by,p_job.workspace_id)and eps.export_stage_matches(p_job)$$;
-- Preserve the exact preceding 24 port bodies; only closed export branches are
-- added. Any unexpected predecessor source refuses this additive composition.
do $dispatch$declare item record;source text;definition text;replacement text;at_value integer;begin
 for item in select * from(values
 ('eps.claim_job_stage(jsonb)','7e139435fb01a038b9d4784f0b472651da8ac0527c1d4769a773bdedc4227dc5','if p_input->>''stage''=''render_export''then return eps.claim_export_job_stage(p_input);end if;'),
 ('eps.get_specs_stage_input(uuid,uuid,text)','338808bae51ee21bc1aff2d0c65b3eb8f1ec667b9c507fe8cf0920400766f330','if eps.export_is_job(p_job_id)then return eps.get_export_stage_input(p_job_id,p_attempt_id,p_lease_token);end if;'),
 ('eps.record_job_event(jsonb)','8a839f89c45f946087354e1eae83ccfe2fbed6943b18a54fed1f0a3160f5e10f','if p_event->>''stage''=''render_export''then return eps.record_export_job_event(p_event);end if;'),
 ('eps.get_job_asset_access(jsonb)','fac1a429c888e477f1e0ef30a2604937bed1452bc03d3875ff52fd813fd9b01a','if eps.export_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.get_export_asset_access(p_input);end if;'),
 ('eps.reserve_job_output(jsonb)','0b4340732fb7936e780189ee19186f5fc6e29d6f65ab3c91165c4157b96ca43b','if eps.export_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.reserve_export_job_output(p_input);end if;'),
 ('eps.complete_job_output(jsonb)','e51f4a5583b92557ae009c0a8978c56d5b12149e86011c2ce2ae1649f6422846','if eps.export_is_job(eps.input_uuid(p_input->>''job_id''))then return eps.complete_export_job_output(p_input);end if;'),
 ('eps.recover_job_stages(integer)','6a10aa16f88611f4e6f0a297997f7d3a6cbc2c522d78a6632e0eff5a68cb2581',''),
 ('eps.claim_job_stage_replay(jsonb,text,text,text)','6dae7e05270e69e819640fcaaf510739f5b2f9ce1892ef6d630cf56fa2dc73b4',''),
 ('eps.jobs_dto(uuid)','d74480b632637a5fd74b1b52146cf7969aa2ef87e78e6da1b1f8132b898efac8',''),
 ('public.eps_retry_job(uuid,jsonb,text)','dc039309d507a2831e2fb1cd8326b0bf6abfc88bf3140a92c2c50bb331dfbd74',''),
 ('public.eps_cancel_job(uuid,jsonb,text)','0fe9e90423ac30ca3592291c0d1a5b8dbcda3bc8c937941d8b286aa3008e9b82','')
 )v(signature,expected,dispatch)loop
  select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n')into source,definition from pg_proc where oid=item.signature::regprocedure;
  if encode(sha256(convert_to(source,'UTF8')),'hex')<>item.expected then raise exception'M06_EXACT_PRECEDING_PORT_SOURCE_REQUIRED:%',item.signature;end if;replacement:=source;
  if item.dispatch<>''then at_value:=position('begin'in source);replacement:=overlay(source placing E'begin\n '||item.dispatch||E'\n'from at_value for 6);
  elsif item.signature='eps.recover_job_stages(integer)'then replacement:=replace(source,'recovered:=eps.recover_presentation_job_stages(p_limit);','recovered:=eps.recover_export_job_stages(p_limit);recovered:=recovered+eps.recover_presentation_job_stages(p_limit-recovered);');
  elsif item.signature='eps.claim_job_stage_replay(jsonb,text,text,text)'then
   replacement:=replace(source,'if eps.presentation_is_job(old.job_id)then','if eps.export_is_job(old.job_id)then job:=eps.export_stage_lock(old.job_id);elsif eps.presentation_is_job(old.job_id)then');
   replacement:=replace(replacement,'case when job.kind=''presentation_render''','case when job.kind=''presentation_export''then eps.export_stage_matches(job)when job.kind=''presentation_render''');
  elsif item.signature='eps.jobs_dto(uuid)'then replacement:=replace(source,'||case when kind=''presentation_render''then','||case when kind=''presentation_export''then eps.export_job_actions(jobs)else''{}''::jsonb end'||E'\n    '||'||case when kind=''presentation_render''then');
  elsif item.signature='public.eps_retry_job(uuid,jsonb,text)'then
   replacement:=replace(source,'  if response is not null then return response; end if;',E'  if job.kind=''presentation_export''and not eps.export_stage_authorized(job)then perform eps.fail(''PERMISSION_CHANGED'',''The link owner no longer has export authority.'',403);end if;\n  if response is not null then return response; end if;');
   replacement:=replace(replacement,'or job.kind<>''presentation_render''and(', 'or job.kind=''presentation_export''and(eps.export_job_actions(job)->''can_retry'')is distinct from''true''::jsonb or job.kind not in(''presentation_render'',''presentation_export'')and(');
   replacement:=replace(replacement,'case when kind=''presentation_render''then stage_attempts-stage','case when kind in(''presentation_render'',''presentation_export'')then stage_attempts-stage');
  else replacement:=replace(source,'  if job.status=''succeeded'' then',E'  if job.kind=''presentation_export''and job.status not in(''queued'',''running'',''waiting_for_input'',''cancelled'')then perform eps.fail(''INVALID_TRANSITION'',''This export job cannot be cancelled.'',409);end if;\n  if job.status=''succeeded'' then');end if;
  if replacement=source then raise exception'M06_PORT_DISPATCH_ANCHOR_REQUIRED:%',item.signature;end if;execute replace(definition,source,replacement);
 end loop;
end$dispatch$;
grant create on schema eps to eps_review_stage_owner,eps_candidate_assets_owner;
do $owners$declare item record;owner_name text;begin
 for item in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eps'and p.proname<>'export_storage_read_allowed'and(p.proname like'export_%'or p.proname in('mint_review_media_grant','claim_export_job_stage','get_export_stage_input','record_export_job_event','recover_export_job_stages','get_export_asset_access','reserve_export_job_output','complete_export_job_output'))loop
  owner_name:=case when item.proname in('export_asset_member','export_capability_allowed','get_export_asset_access','reserve_export_job_output','complete_export_job_output')then'eps_candidate_assets_owner'else'eps_review_stage_owner'end;
  execute format('alter function %s owner to %I',item.signature,owner_name);execute format('revoke all on function %s from public,anon,authenticated,service_role',item.signature);
 end loop;
end$owners$;
revoke create on schema eps from eps_review_stage_owner,eps_candidate_assets_owner;
grant execute on function eps.guest_link_live(eps.review_links),eps.presentation_timestamp_valid(jsonb)to eps_review_stage_owner;
grant execute on function eps.export_is_job(uuid),eps.export_stage_lock(uuid,boolean),eps.export_stage_matches(eps.jobs),eps.claim_export_job_stage(jsonb),eps.get_export_stage_input(uuid,uuid,text),eps.record_export_job_event(jsonb),eps.recover_export_job_stages(integer)to eps_specs_stage_owner;
grant execute on function eps.export_is_job(uuid),eps.get_export_asset_access(jsonb),eps.reserve_export_job_output(jsonb),eps.complete_export_job_output(jsonb)to eps_specs_assets_owner;
grant execute on function eps.export_stage_current(uuid,uuid,text),eps.export_stage_live(uuid,uuid,text)to eps_candidate_assets_owner;
grant execute on function eps.export_job_actions(eps.jobs),eps.export_stage_authorized(eps.jobs)to eps_jobs_owner;
grant execute on function eps.export_capability_allowed(text,text,text)to anon,authenticated;
-- One explicit new runtime operation; no login, membership, table or schema
-- privilege is added to the existing worker principal.
grant execute on function eps.mint_review_media_grant(jsonb)to eps_jobs_executor;
