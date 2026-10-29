-- Candidate16 composed user/storage boundary. After kernel tables; before or
-- after service helpers (PLpgSQL enqueue lookup occurs at invocation). No enable.
set local lock_timeout='5s'; set local statement_timeout='30s'; set local search_path='';
alter table eps.media_assets drop constraint media_assets_typed_purpose_check;
alter table eps.media_assets add constraint media_assets_typed_purpose_check check((case purpose
 when 'client_logo' then mime_type in('image/png','image/jpeg','image/webp') and size_bytes between 1 and 5242880
  and source_asset_id is null and producing_job_id is null and producing_attempt_id is null and output_stage is null and output_key is null
  and (status<>'ready' or sha256 is not null and width is not null and height is not null and width::bigint*height::bigint<=40000000)
 when 'specs' then mime_type in('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain')
  and size_bytes between 1 and 20971520 and width is null and height is null and client_id is null and origin_workspace_id is not null
  and source_asset_id is null and producing_job_id is null and producing_attempt_id is null and output_stage is null and output_key is null
  and (status<>'ready' or sha256 is not null)
 when 'document_text' then mime_type='application/json' and size_bytes between 1 and 20971520
  and width is null and height is null and client_id is null and origin_workspace_id is not null and source_asset_id is not null
  and producing_job_id is not null and producing_attempt_id is not null and output_stage='prepare_document' and output_key='document_text'
  and (status<>'ready' or sha256 is not null)
 when 'candidate_video' then mime_type in('video/mp4','video/quicktime','video/webm','video/x-matroska') and size_bytes between 1 and 268435456
  and bucket='eps-candidate-assets' and client_id is null and origin_workspace_id is not null
  and source_asset_id is null and producing_job_id is null and producing_attempt_id is null and output_stage is null and output_key is null
  and source_timestamp_ms is null and (status<>'ready' or sha256 is not null and width between 1 and 4096 and height between 1 and 4096 and duration_ms between 1 and 1800000)
 when 'audio' then mime_type='audio/mpeg' and size_bytes between 1 and 20971520 and width is null and height is null and source_timestamp_ms is null
  and bucket='eps-candidate-outputs' and client_id is null and origin_workspace_id is not null and source_asset_id is not null
  and producing_job_id is not null and producing_attempt_id is not null and output_stage='prepare_candidate' and length(output_key) between 1 and 100
  and (status<>'ready' or sha256 is not null)
 when 'transcript' then mime_type='application/json' and size_bytes between 1 and 2097152 and width is null and height is null and source_timestamp_ms is null and duration_ms is null
  and bucket='eps-candidate-outputs' and client_id is null and origin_workspace_id is not null and source_asset_id is not null
  and producing_job_id is not null and producing_attempt_id is not null and output_stage='transcribe_candidate' and length(output_key) between 1 and 100
  and (status<>'ready' or sha256 is not null)
 when 'candidate_frame' then mime_type='image/jpeg' and size_bytes between 1 and 20971520 and duration_ms is null
  and bucket='eps-candidate-outputs' and client_id is null and origin_workspace_id is not null and source_asset_id is not null
  and producing_job_id is not null and producing_attempt_id is not null and output_stage in('prepare_candidate','extract_frames') and length(output_key) between 1 and 100
  and (status<>'ready' or sha256 is not null and width between 1 and 4096 and height between 1 and 4096 and source_timestamp_ms between 0 and 1800000)
 else false end) is true);

grant select on eps.workspaces,eps.media_assets,eps.candidates,eps.candidate_media,eps.candidate_media_frames to eps_candidate_upload_owner;
grant update(row_version) on eps.workspaces to eps_candidate_upload_owner;
grant insert(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status) on eps.media_assets to eps_candidate_upload_owner;
grant select,insert on eps.candidate_uploads to eps_candidate_upload_owner;
grant update(status,reservation_revision,expected_sha256) on eps.candidate_uploads to eps_candidate_upload_owner;
grant select,insert on eps.idempotency_records to eps_candidate_upload_owner;
grant insert on eps.audit_events to eps_candidate_upload_owner;
grant execute on function eps.has_capability(text),eps.require_capability(text),eps.logo_scope(uuid,boolean),eps.project_scope(uuid,boolean),eps.fail(text,text,integer,bigint),eps.input_uuid(text),eps.check_input(jsonb,text[]),eps.logo_integer(jsonb,bigint,bigint),eps.idempotency_begin(text,text,jsonb),eps.finish_mutation(text,text,jsonb,jsonb,uuid) to eps_candidate_upload_owner;
create function eps.candidate_upload_scope(p_workspace uuid) returns boolean language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and eps.has_capability('cast.upload') and eps.has_capability('cast.read') and eps.logo_scope(p_workspace,true)
$$;
create policy candidate_upload_workspace_read on eps.workspaces for select to eps_candidate_upload_owner using(eps.logo_scope(id,false) or eps.logo_scope(id,true));
create policy candidate_upload_workspace_lock on eps.workspaces for update to eps_candidate_upload_owner using(eps.candidate_upload_scope(id)) with check(false);
create policy candidate_upload_candidate_read on eps.candidates for select to eps_candidate_upload_owner using(eps.has_capability('cast.read'));
create policy candidate_upload_media_read on eps.candidate_media for select to eps_candidate_upload_owner using(eps.has_capability('cast.read'));
create policy candidate_upload_frames_read on eps.candidate_media_frames for select to eps_candidate_upload_owner using(eps.has_capability('cast.read'));
create policy candidate_upload_assets_read on eps.media_assets for select to eps_candidate_upload_owner using(
 purpose in('candidate_video','audio','transcript','candidate_frame') and eps.has_capability('cast.read') and
 (eps.logo_scope(origin_workspace_id,false) or eps.logo_scope(origin_workspace_id,true)
  or exists(select 1 from eps.candidate_media m where m.source_asset_id=media_assets.id or m.preview_asset_id=media_assets.id or m.transcript_asset_id=media_assets.id)
  or exists(select 1 from eps.candidate_media_frames f where f.asset_id=media_assets.id)));
create policy candidate_upload_asset_insert on eps.media_assets for insert to eps_candidate_upload_owner with check(
 purpose='candidate_video' and status='uploading' and eps.candidate_upload_scope(origin_workspace_id));
create policy candidate_upload_actor_read on eps.candidate_uploads for select to eps_candidate_upload_owner using(principal_id=auth.uid() and eps.candidate_upload_scope(workspace_id));
create policy candidate_upload_actor_insert on eps.candidate_uploads for insert to eps_candidate_upload_owner with check(principal_id=auth.uid() and status='open' and job_id is null and eps.candidate_upload_scope(workspace_id));
create policy candidate_upload_actor_cancel on eps.candidate_uploads for update to eps_candidate_upload_owner using(principal_id=auth.uid() and status='open' and eps.candidate_upload_scope(workspace_id)) with check(principal_id=auth.uid() and status='cancelled' and job_id is null and eps.candidate_upload_scope(workspace_id));
create policy candidate_upload_actor_hash on eps.candidate_uploads for update to eps_candidate_upload_owner using(principal_id=auth.uid() and status='open' and eps.candidate_upload_scope(workspace_id)) with check(principal_id=auth.uid() and status='open' and job_id is null and eps.candidate_upload_scope(workspace_id));
create policy candidate_upload_idempotency on eps.idempotency_records for all to eps_candidate_upload_owner using(principal_id=auth.uid() and operation in('candidate.reserve_upload','candidate.complete_upload','candidate.cancel_upload')) with check(principal_id=auth.uid() and operation in('candidate.reserve_upload','candidate.complete_upload','candidate.cancel_upload'));
create policy candidate_upload_audit on eps.audit_events for insert to eps_candidate_upload_owner with check(principal_id=auth.uid() and action in('candidate.reserve_upload','candidate.complete_upload','candidate.cancel_upload'));

create function eps.candidate_asset_dto(p_asset eps.media_assets) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',p_asset.id,'purpose',p_asset.purpose,'filename',p_asset.filename,'mime_type',p_asset.mime_type,'size_bytes',p_asset.size_bytes,'sha256',p_asset.sha256,'status',p_asset.status,'duration_ms',p_asset.duration_ms,'width',p_asset.width,'height',p_asset.height,'source_asset_id',p_asset.source_asset_id,'source_timestamp_ms',p_asset.source_timestamp_ms,'created_at',p_asset.created_at)
$$;
create function eps.candidate_upload_dto(p_upload uuid) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('upload_id',u.id,'asset',eps.candidate_asset_dto(a),'principal_id',u.principal_id,'workspace_id',u.workspace_id,
  'bucket',u.bucket,'object_key',u.object_key,'expected_size_bytes',u.expected_size_bytes,'expected_mime_type',u.expected_mime_type,'expected_sha256',u.expected_sha256,
  'expires_at',u.expires_at,'status',case when u.status='open' and u.expires_at<=clock_timestamp() then 'expired' else u.status end)
 from eps.candidate_uploads u join eps.media_assets a on a.id=u.asset_id where u.id=p_upload
$$;
create function eps.candidate_upload_require(p_upload uuid) returns eps.candidate_uploads language plpgsql volatile security invoker set search_path='' as $$
declare item eps.candidate_uploads; begin
 select * into item from eps.candidate_uploads where id=p_upload;
 if not found or item.principal_id is distinct from auth.uid() or not eps.candidate_upload_scope(item.workspace_id) then perform eps.fail('RESOURCE_NOT_FOUND','Candidate upload not found.',404); end if;
 return item;
end $$;
create function public.eps_reserve_candidate_upload(p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare ws uuid;asset_id_value uuid:=gen_random_uuid();upload_id_value uuid:=gen_random_uuid();mime text;ext text;size bigint;replay jsonb;target uuid;target_version bigint;batch uuid; begin
 perform eps.check_input(p_input,array['workspace_id','candidate_id','batch_id','purpose','filename','mime_type','size_bytes','sha256']);
 ws:=eps.input_uuid(p_input->>'workspace_id'); mime:=p_input->>'mime_type';
 if not eps.candidate_upload_scope(ws) then perform eps.fail('RESOURCE_NOT_FOUND','Writable candidate workspace not found.',404);end if;
 if p_input->>'purpose' is distinct from 'candidate_video' or jsonb_typeof(p_input->'filename') is distinct from 'string' or length(btrim(p_input->>'filename')) not between 1 and 255
  or p_input->>'filename'~E'[/\\\\[:cntrl:]]' or mime not in('video/mp4','video/quicktime','video/webm','video/x-matroska')
  or p_input?'sha256' and (jsonb_typeof(p_input->'sha256') is distinct from 'string' or p_input->>'sha256'!~'^[a-f0-9]{64}$')
 then perform eps.fail('INVALID_REQUEST','Provide a supported video and simple filename.',400); end if;
 size:=eps.logo_integer(p_input->'size_bytes',1,268435456);
 if p_input?'batch_id' then batch:=eps.input_uuid(p_input->>'batch_id');end if;
 if p_input?'candidate_id' then target:=eps.input_uuid(p_input->>'candidate_id');select row_version into target_version from eps.candidates where id=target and archived_at is null and merged_into_candidate_id is null;if not found then perform eps.fail('RESOURCE_NOT_FOUND','Candidate not found.',404);end if;end if;
 replay:=eps.idempotency_begin('candidate.reserve_upload',p_idempotency_key,p_input);
 if replay is not null then perform eps.candidate_upload_require((replay->>'upload_id')::uuid);return eps.candidate_upload_dto((replay->>'upload_id')::uuid);end if;
 if not exists(select 1 from eps.candidate_asset_config where id and enabled) then perform eps.fail('FEATURE_NOT_IMPLEMENTED','Candidate video uploads are not enabled.',503);end if;
 ext:=case mime when 'video/mp4' then 'mp4' when 'video/quicktime' then 'mov' when 'video/webm' then 'webm' else 'mkv' end;
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,status)
 values(asset_id_value,ws,'candidate_video',p_input->>'filename',mime,'eps-candidate-assets','assets/'||asset_id_value||'/original.'||ext,size,'uploading');
 insert into eps.candidate_uploads(id,asset_id,principal_id,workspace_id,bucket,object_key,expected_size_bytes,expected_mime_type,expected_sha256,target_candidate_id,target_candidate_row_version,batch_id)
 values(upload_id_value,asset_id_value,auth.uid(),ws,'eps-candidate-assets','assets/'||asset_id_value||'/original.'||ext,size,mime,p_input->>'sha256',target,target_version,batch);
 return eps.finish_mutation('candidate.reserve_upload',p_idempotency_key,p_input,eps.candidate_upload_dto(upload_id_value),asset_id_value);
end $$;
create function public.eps_get_candidate_upload(p_upload_id uuid) returns jsonb language plpgsql volatile security definer set search_path='' as $$ begin
 perform eps.candidate_upload_require(p_upload_id); return eps.candidate_upload_dto(p_upload_id);
end $$;
create function public.eps_complete_candidate_upload(p_upload_id uuid,p_input jsonb,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare item eps.candidate_uploads;replay jsonb;payload jsonb:=jsonb_build_object('id',p_upload_id,'input',p_input);job jsonb;asset eps.media_assets;result jsonb;begin
 item:=eps.candidate_upload_require(p_upload_id);perform eps.check_input(p_input,array['sha256','actual_size_bytes','start_processing']);
 if jsonb_typeof(p_input->'start_processing') is distinct from 'boolean' or p_input->'start_processing'<>'true'::jsonb
  or eps.logo_integer(p_input->'actual_size_bytes',1,268435456)<>item.expected_size_bytes
  or p_input?'sha256' and (jsonb_typeof(p_input->'sha256') is distinct from 'string' or p_input->>'sha256'!~'^[a-f0-9]{64}$' or item.expected_sha256 is not null and p_input->>'sha256'<>item.expected_sha256)
 then perform eps.fail('INVALID_REQUEST','Complete this reserved video with matching size/hash and processing enabled.',400);end if;
 replay:=eps.idempotency_begin('candidate.complete_upload',p_idempotency_key,payload);
 item:=eps.candidate_upload_require(p_upload_id);
 if replay is not null then return replay;end if;
 if item.status='cancelled' or item.status='open' and item.expires_at<=clock_timestamp() then perform eps.fail('UPLOAD_EXPIRED','This upload is cancelled or expired.',409);end if;
 -- Same lock order as enqueue: workspace, then upload intent. A completion-only
 -- checksum becomes a frozen assertion before any native/provider work starts.
 if item.status='open' then
  perform 1 from eps.workspaces where id=item.workspace_id for update;
  select * into item from eps.candidate_uploads where id=p_upload_id for update;
  if not found or not eps.candidate_upload_scope(item.workspace_id) or item.status<>'open' or item.expires_at<=clock_timestamp() then perform eps.fail('UPLOAD_EXPIRED','This video upload is no longer open.',409);end if;
  if p_input?'sha256' then
   if item.expected_sha256 is not null and item.expected_sha256<>p_input->>'sha256' then perform eps.fail('INVALID_REQUEST','The completion checksum differs from its reservation.',400);end if;
   if item.expected_sha256 is null then update eps.candidate_uploads set expected_sha256=p_input->>'sha256' where id=p_upload_id;end if;
  end if;
 end if;
 job:=eps.enqueue_candidate_scan(p_upload_id);
 select * into asset from eps.media_assets where id=item.asset_id;
 result:=jsonb_build_object('asset',eps.candidate_asset_dto(asset),'processing_job_id',job->>'job_id','status','queued');
 return eps.finish_mutation('candidate.complete_upload',p_idempotency_key,payload,result,item.asset_id);
end $$;
create function public.eps_cancel_candidate_upload(p_upload_id uuid,p_idempotency_key text) returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare item eps.candidate_uploads;replay jsonb;payload jsonb:=jsonb_build_object('id',p_upload_id);result jsonb;begin
 item:=eps.candidate_upload_require(p_upload_id);replay:=eps.idempotency_begin('candidate.cancel_upload',p_idempotency_key,payload);item:=eps.candidate_upload_require(p_upload_id);
 if replay is not null then return replay;end if;
 if item.status='completed' then perform eps.fail('INVALID_TRANSITION','This video already has a processing job. Cancel it in Processing.',409);end if;
 update eps.candidate_uploads set status='cancelled',reservation_revision=reservation_revision+1 where id=p_upload_id and status='open';
 result:=jsonb_build_object('success',true,'affected_ids',jsonb_build_array(p_upload_id));return eps.finish_mutation('candidate.cancel_upload',p_idempotency_key,payload,result,item.asset_id);
end $$;
create function public.eps_get_candidate_asset(p_asset_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare asset eps.media_assets;begin
 perform eps.require_capability('cast.read');select * into asset from eps.media_assets where id=p_asset_id and purpose in('candidate_video','candidate_frame','audio','transcript') and status='ready';
 if not found then perform eps.fail('RESOURCE_NOT_FOUND','Ready candidate media not found.',404);end if;
 return jsonb_build_object('asset',eps.candidate_asset_dto(asset),'bucket',asset.bucket,'object_key',asset.object_key);
end $$;
create function eps.candidate_storage_insert_allowed(p_bucket text,p_key text) returns boolean language plpgsql volatile security definer set search_path='' as $$
declare headers jsonb;begin
 if p_bucket is distinct from 'eps-candidate-assets' or auth.uid() is null then return false;end if;
 begin headers:=nullif(current_setting('request.headers',true),'')::jsonb;exception when others then return false;end;
 if jsonb_typeof(headers) is distinct from 'object' or headers->>'x-upsert' is distinct from 'false' then return false;end if;
 return exists(select 1 from eps.candidate_uploads u join eps.media_assets a on a.id=u.asset_id where u.principal_id=auth.uid() and u.bucket=p_bucket and u.object_key=p_key and u.status='open' and u.expires_at>clock_timestamp() and a.status='uploading' and eps.candidate_upload_scope(u.workspace_id));
end $$;
create function eps.candidate_storage_read_allowed(p_bucket text,p_key text) returns boolean language sql volatile security definer set search_path='' as $$
 select auth.uid() is not null and eps.has_capability('cast.read') and exists(select 1 from eps.media_assets a where a.bucket=p_bucket and a.object_key=p_key and a.status='ready' and a.purpose in('candidate_video','candidate_frame','audio','transcript'))
$$;

grant create on schema eps,public to eps_candidate_upload_owner;
do $$declare routine regprocedure;begin
 foreach routine in array array['eps.candidate_upload_scope(uuid)'::regprocedure,'eps.candidate_asset_dto(eps.media_assets)'::regprocedure,'eps.candidate_upload_dto(uuid)'::regprocedure,'eps.candidate_upload_require(uuid)'::regprocedure,
 'public.eps_reserve_candidate_upload(jsonb,text)'::regprocedure,'public.eps_get_candidate_upload(uuid)'::regprocedure,'public.eps_complete_candidate_upload(uuid,jsonb,text)'::regprocedure,'public.eps_cancel_candidate_upload(uuid,text)'::regprocedure,'public.eps_get_candidate_asset(uuid)'::regprocedure,
 'eps.candidate_storage_insert_allowed(text,text)'::regprocedure,'eps.candidate_storage_read_allowed(text,text)'::regprocedure] loop
 execute format('alter function %s owner to eps_candidate_upload_owner',routine);execute format('revoke all on function %s from public,anon,authenticated,service_role',routine);
 if routine::text like 'eps_%' or routine::text like 'public.eps_%' then execute format('grant execute on function %s to authenticated',routine);end if;
 end loop;
end $$;
revoke create on schema eps,public from eps_candidate_upload_owner;
grant execute on function eps.candidate_storage_insert_allowed(text,text),eps.candidate_storage_read_allowed(text,text) to authenticated;
grant execute on function eps.candidate_asset_dto(eps.media_assets) to eps_candidate_assets_owner,eps_candidate_stage_owner;

do $$declare bucket_id text;mimes text[];maximum bigint;begin
 foreach bucket_id in array array['eps-candidate-assets','eps-candidate-outputs'] loop
 mimes:=case when bucket_id='eps-candidate-assets' then array['video/mp4','video/quicktime','video/webm','video/x-matroska'] else array['audio/mpeg','image/jpeg','application/json'] end;
 maximum:=case when bucket_id='eps-candidate-assets' then 268435456 else 20971520 end;
 if exists(select 1 from storage.buckets b where b.id=bucket_id) then raise exception 'NEW_CANDIDATE_BUCKET_REQUIRED';end if;
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values(bucket_id,bucket_id,false,maximum,mimes);
 end loop;
end $$;
create policy eps_candidate_user_insert on storage.objects for insert to authenticated with check(bucket_id='eps-candidate-assets' and (storage.allow_only_operation('object.upload') or storage.allow_only_operation('object.sign_upload_url')) and eps.candidate_storage_insert_allowed(bucket_id,name));
create policy eps_candidate_user_read on storage.objects for select to authenticated using(bucket_id in('eps-candidate-assets','eps-candidate-outputs') and (storage.allow_only_operation('object.get_authenticated') or storage.allow_only_operation('object.get_authenticated_info') or storage.allow_only_operation('object.sign')) and eps.candidate_storage_read_allowed(bucket_id,name));
-- Service policies are composed after eps.candidate_capability_allowed exists.
notify pgrst,'reload schema';
