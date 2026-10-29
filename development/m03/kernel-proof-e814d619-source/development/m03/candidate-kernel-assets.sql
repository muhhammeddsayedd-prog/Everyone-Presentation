-- Narrow candidate exact-object grants and immutable derivative operations.
grant select on eps.jobs,eps.media_assets to eps_candidate_assets_owner;
grant insert(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms) on eps.media_assets to eps_candidate_assets_owner;
grant update(status,sha256,width,height,duration_ms) on eps.media_assets to eps_candidate_assets_owner;
grant execute on function eps.input_uuid(text),eps.logo_integer(jsonb,bigint,bigint),eps.fail(text,text,integer,bigint),eps.specs_stage_assert(boolean,text),eps.specs_stage_shape(jsonb,text[],text[]) to eps_candidate_assets_owner;
create policy candidate_asset_job_read on eps.jobs for select to eps_candidate_assets_owner using(kind='candidate_scan');
create policy candidate_asset_service_read on eps.media_assets for select to eps_candidate_assets_owner using(purpose in('candidate_video','audio','transcript','candidate_frame'));
create policy candidate_asset_service_insert on eps.media_assets for insert to eps_candidate_assets_owner with check(purpose in('audio','transcript','candidate_frame') and status='uploading'
 and bucket='eps-candidate-outputs' and sha256 is null and eps.candidate_stage_live(producing_job_id,producing_attempt_id,(select j.input_hash from eps.jobs j where j.id=producing_job_id)));
create policy candidate_asset_service_complete on eps.media_assets for update to eps_candidate_assets_owner using(purpose in('audio','transcript','candidate_frame') and status='uploading'
 and eps.candidate_stage_live(producing_job_id,producing_attempt_id,(select j.input_hash from eps.jobs j where j.id=producing_job_id))) with check(status='ready' and sha256 is not null);

create function eps.candidate_prior_asset(p_job eps.jobs,p_asset eps.media_assets) returns boolean language sql volatile security invoker set search_path='' as $$
 select exists(select 1 from eps.candidate_stage_payloads p where p.job_id=p_job.id and p.input_hash=p_job.input_hash and p.attempt_id=p_asset.producing_attempt_id and p.stage=p_asset.output_stage
  and exists(select 1 from jsonb_array_elements(p_job.completed_stages) completed where completed#>>'{result,stage_output_id}'=p.id::text and completed->>'attempt_id'=p.attempt_id::text)
  and (p.payload#>>'{transcript_asset,asset_id}'=p_asset.id::text
   or exists(select 1 from jsonb_array_elements(coalesce(p.payload->'audio_chunks','[]')) item where item->>'asset_id'=p_asset.id::text)
   or exists(select 1 from jsonb_array_elements(coalesce(p.payload->'sampled_frames','[]')) item where item->>'frame_asset_id'=p_asset.id::text)))
$$;
create function eps.get_candidate_asset_access(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;asset eps.media_assets;permission text;token_value text;at_value timestamptz;expiry timestamptz;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','access'],array['job_id','attempt_id','lease_token','asset_id']));
 job:=eps.candidate_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 permission:=coalesce(p_input->>'access','read');perform eps.specs_stage_assert(permission in('read','write'));
 select * into asset from eps.media_assets a where a.id=eps.input_uuid(p_input->>'asset_id') and a.origin_workspace_id=job.workspace_id;
 if not found or not(permission='read' and asset.id=job.input_asset_id and asset.purpose='candidate_video'
  and (asset.status='ready' or asset.status='uploading' and job.stage='prepare_candidate')
  or asset.source_asset_id=job.input_asset_id and asset.producing_job_id=job.id and asset.purpose in('audio','transcript','candidate_frame')
   and (asset.producing_attempt_id=job.current_attempt_id and asset.output_stage=job.stage and asset.status in('uploading','ready') and (permission='read' or asset.status='uploading')
    or permission='read' and asset.status='ready' and eps.candidate_prior_asset(job,asset)))
 then perform eps.fail('RESOURCE_NOT_FOUND','Asset not available to this candidate stage.',404);end if;
 at_value:=clock_timestamp();expiry:=least(job.lease_expires_at,at_value+interval '60 seconds');perform eps.specs_stage_assert(expiry>at_value,'STALE_STAGE_LEASE');
 token_value:=rtrim(translate(replace(encode(extensions.gen_random_bytes(32),'base64'),E'\n',''),'+/','-_'),'=');
 insert into eps.candidate_asset_grants(token_digest,job_id,attempt_id,input_hash,asset_id,bucket,object_key,permission,created_at,expires_at)
 values(encode(sha256(convert_to(token_value,'UTF8')),'hex'),job.id,job.current_attempt_id,job.input_hash,asset.id,asset.bucket,asset.object_key,permission,at_value,expiry);
 return jsonb_build_object('asset_id',asset.id,'bucket',asset.bucket,'object_key',asset.object_key,'permission',permission,'grant_token',token_value,'expires_at',expiry,'mime_type',asset.mime_type,'size_bytes',asset.size_bytes,'sha256',asset.sha256);
end $$;
create function eps.reserve_candidate_job_output(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;existing eps.media_assets;asset_id_value uuid:=gen_random_uuid();expected_size bigint;kind text;key_value text;mime text;extension text;timestamp_value bigint;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','output_key','asset_kind','filename','mime_type','expected_size_bytes','parent_asset_id','time_offset_ms']));
 job:=eps.candidate_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 kind:=p_input->>'asset_kind';key_value:=p_input->>'output_key';mime:=p_input->>'mime_type';
 perform eps.specs_stage_assert(p_input->>'parent_asset_id'=job.input_asset_id::text and jsonb_typeof(p_input->'filename')='string' and length(p_input->>'filename') between 1 and 255 and p_input->>'filename'!~E'[/\\[:cntrl:]]');
 if kind='audio' then perform eps.specs_stage_assert(job.stage='prepare_candidate' and key_value~'^audio_([0-9]|1[0-5])$' and mime='audio/mpeg' and p_input->'time_offset_ms'='null');extension:='mp3';
 elsif kind='candidate_frame' then perform eps.specs_stage_assert(job.stage='prepare_candidate' and key_value~'^frame_([0-9]|1[01])$' and mime='image/jpeg');
  timestamp_value:=eps.logo_integer(p_input->'time_offset_ms',0,1800000);extension:='jpg';
 elsif kind='transcript' then perform eps.specs_stage_assert(job.stage='transcribe_candidate' and key_value='transcript' and mime='application/json' and p_input->'time_offset_ms'='null');extension:='json';
 else perform eps.fail('INVALID_REQUEST','Unsupported candidate output purpose.',400);end if;
 expected_size:=eps.logo_integer(p_input->'expected_size_bytes',1,case when kind='transcript' then 2097152 else 20971520 end);
 select * into existing from eps.media_assets where producing_job_id=job.id and producing_attempt_id=job.current_attempt_id and output_key=key_value;
 if found then
  if existing.purpose<>kind or existing.size_bytes<>expected_size or existing.mime_type<>mime or existing.filename<>p_input->>'filename'
   or existing.source_asset_id<>job.input_asset_id or existing.output_stage<>job.stage or existing.source_timestamp_ms is distinct from timestamp_value
  then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Logical candidate output metadata changed.',409);end if;
 else
  insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status,source_asset_id,producing_job_id,producing_attempt_id,output_stage,output_key,source_timestamp_ms)
  values(asset_id_value,job.workspace_id,kind,p_input->>'filename',mime,'eps-candidate-outputs','jobs/'||job.id||'/attempts/'||job.current_attempt_id||'/'||asset_id_value||'.'||extension,
   expected_size,'uploading',job.input_asset_id,job.id,job.current_attempt_id,job.stage,key_value,timestamp_value) returning * into existing;
 end if;
 return jsonb_build_object('asset',eps.candidate_asset_dto(existing),'bucket',existing.bucket,'object_key',existing.object_key);
end $$;
create function eps.complete_candidate_job_output(p_input jsonb) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare job eps.jobs;asset eps.media_assets;w integer;h integer;duration bigint;begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_input,array['job_id','attempt_id','lease_token','asset_id','sha256','actual_size_bytes','width','height','duration_ms']));
 job:=eps.candidate_stage_current(eps.input_uuid(p_input->>'job_id'),eps.input_uuid(p_input->>'attempt_id'),p_input->>'lease_token');
 -- The current parent job lock serializes all completion attempts. Read a Ready
 -- replay before taking an UPDATE row policy restricted to uploading outputs.
 select * into asset from eps.media_assets a where a.id=eps.input_uuid(p_input->>'asset_id') and a.producing_job_id=job.id and a.producing_attempt_id=job.current_attempt_id and a.output_stage=job.stage;
 if not found or asset.purpose not in('audio','transcript','candidate_frame') or asset.source_asset_id<>job.input_asset_id then perform eps.fail('RESOURCE_NOT_FOUND','Candidate output not in active attempt.',404);end if;
 perform eps.specs_stage_assert(p_input->>'sha256'~'^[a-f0-9]{64}$' and eps.logo_integer(p_input->'actual_size_bytes',1,20971520)=asset.size_bytes);
 if asset.purpose='candidate_frame' then w:=eps.logo_integer(p_input->'width',1,4096);h:=eps.logo_integer(p_input->'height',1,4096);perform eps.specs_stage_assert(p_input->'duration_ms'='null');
 else perform eps.specs_stage_assert(p_input->'width'='null' and p_input->'height'='null');
  if asset.purpose='audio' and p_input->'duration_ms'<>'null' then duration:=eps.logo_integer(p_input->'duration_ms',1,120000);else perform eps.specs_stage_assert(p_input->'duration_ms'='null');end if;
 end if;
 if asset.status='ready' then
  if asset.sha256 is distinct from p_input->>'sha256' or asset.width is distinct from w or asset.height is distinct from h or asset.duration_ms is distinct from duration
  then perform eps.fail('IDEMPOTENCY_KEY_REUSED','Candidate output was completed with different verified bytes.',409);end if;
 else
  perform eps.specs_stage_assert(asset.status='uploading','INVALID_TRANSITION');
  update eps.media_assets set status='ready',sha256=p_input->>'sha256',width=w,height=h,duration_ms=duration where id=asset.id returning * into asset;
 end if;
 return eps.candidate_asset_dto(asset);
end $$;
create function eps.candidate_capability_allowed(p_bucket text,p_key text,p_permission text) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare headers jsonb;token_value text;begin
 if p_bucket not in('eps-candidate-assets','eps-candidate-outputs') or p_permission not in('read','write') then return false;end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;
 token_value:=headers->>'x-eps-asset-grant';if jsonb_typeof(headers)<>'object' or token_value is null or token_value!~'^[A-Za-z0-9_-]{43}$' then return false;end if;
 return exists(select 1 from eps.candidate_asset_grants g join eps.media_assets a on a.id=g.asset_id join eps.jobs j on j.id=g.job_id
  where g.token_digest=encode(sha256(convert_to(token_value,'UTF8')),'hex') and g.bucket=p_bucket and g.object_key=p_key and g.permission=p_permission
   and g.expires_at>clock_timestamp() and g.revoked_at is null and a.bucket=p_bucket and a.object_key=p_key and a.origin_workspace_id=j.workspace_id
   and eps.candidate_stage_live(j.id,g.attempt_id,g.input_hash)
   and (p_permission='read' and (a.id=j.input_asset_id and a.purpose='candidate_video' and (a.status='ready' or a.status='uploading' and j.stage='prepare_candidate')
     or a.source_asset_id=j.input_asset_id and a.producing_job_id=j.id and a.status in('uploading','ready') and (a.producing_attempt_id=j.current_attempt_id and a.output_stage=j.stage or a.status='ready' and eps.candidate_prior_asset(j,a)))
    or p_permission='write' and p_bucket='eps-candidate-outputs' and a.status='uploading' and a.source_asset_id=j.input_asset_id and a.producing_job_id=j.id
     and a.producing_attempt_id=j.current_attempt_id and a.output_stage=j.stage and headers->>'x-upsert'='false' and headers->>'content-type'=a.mime_type));
end $$;
grant create on schema eps to eps_candidate_assets_owner;
do $$declare routine regprocedure;begin
 foreach routine in array array['eps.candidate_prior_asset(eps.jobs,eps.media_assets)'::regprocedure,'eps.get_candidate_asset_access(jsonb)'::regprocedure,
 'eps.reserve_candidate_job_output(jsonb)'::regprocedure,'eps.complete_candidate_job_output(jsonb)'::regprocedure,'eps.candidate_capability_allowed(text,text,text)'::regprocedure] loop
  execute format('alter function %s owner to eps_candidate_assets_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
 end loop;
end $$;
revoke create on schema eps from eps_candidate_assets_owner;
grant execute on function eps.get_candidate_asset_access(jsonb),eps.reserve_candidate_job_output(jsonb),eps.complete_candidate_job_output(jsonb) to eps_specs_assets_owner;
grant execute on function eps.candidate_capability_allowed(text,text,text) to anon,authenticated;
