-- Real SQL ownership/RLS on synthetic metadata; no file-byte IO claim.
set local role postgres;
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,width,height,duration_ms)values
 ('8a8a0000-0000-4000-8000-000000000001',current_setting('eps.casting.fixture.workspace')::uuid,'candidate_video','synthetic-m05.mp4','video/mp4','eps-candidate-assets','assets/8a8a0000-0000-4000-8000-000000000001/original.mp4',1000,repeat('a',64),'ready',640,480,5000),
 ('8a8a0000-0000-4000-8000-000000000005',current_setting('eps.casting.fixture.workspace')::uuid,'client_logo','synthetic-m05.png','image/png','eps-brand-assets','assets/8a8a0000-0000-4000-8000-000000000005/logo.png',1000,repeat('d',64),'ready',320,120,null);
insert into eps.jobs(id,workspace_id,requested_by,kind,status,stage,resource_id,input_asset_id,input,input_hash,input_hash_version,dedupe_key,correlation_id)values('8a9a0000-0000-4000-8000-000000000001',current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.casting.fixture.actor')::uuid,'candidate_scan','succeeded','apply_candidate','8aaa0000-0000-4000-8000-000000000001','8a8a0000-0000-4000-8000-000000000001','{"synthetic_metadata_only":true}',repeat('a',64),'eps.candidate-input.pg-jsonb.v1',repeat('a',64),'m05-synthetic-lineage');
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,width,height,source_asset_id,source_timestamp_ms,producing_job_id,producing_attempt_id,output_stage,output_key)
 select('8a8a0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,current_setting('eps.casting.fixture.workspace')::uuid,'candidate_frame','synthetic-m05.jpg','image/jpeg','eps-candidate-outputs','synthetic-m05/frame-'||n||'.jpg',1000,repeat(n::text,64),'ready',320,240,'8a8a0000-0000-4000-8000-000000000001',n*100,'8a9a0000-0000-4000-8000-000000000001','8aba0000-0000-4000-8000-000000000001','prepare_candidate','frame_'||n from generate_series(2,3)n;
insert into eps.candidate_media(id,candidate_id,source_asset_id)values('8aaa0000-0000-4000-8000-000000000001','8a5a0000-0000-4000-8000-000000000001','8a8a0000-0000-4000-8000-000000000001');
insert into eps.candidate_media_frames(candidate_media_id,asset_id)select'8aaa0000-0000-4000-8000-000000000001',('8a8a0000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid from generate_series(2,3)n;
update eps.workspace_candidates set selected_candidate_media_id='8aaa0000-0000-4000-8000-000000000001',selected_frame_asset_ids=array['8a8a0000-0000-4000-8000-000000000003'::uuid,'8a8a0000-0000-4000-8000-000000000002'::uuid]where id='8a6a0000-0000-4000-8000-000000000001';
update eps.workspaces set logo_asset_id='8a8a0000-0000-4000-8000-000000000005',logo_placement='every_slide'where id=current_setting('eps.casting.fixture.workspace')::uuid;
update eps.review_fit_results f set input_fingerprint=eps.review_snapshot_data(f.workspace_id,f.series_id,null)->>'input_fingerprint'where f.workspace_id=current_setting('eps.casting.fixture.workspace')::uuid;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare review jsonb;ack jsonb;begin
 review:=public.eps_get_workspace_review(current_setting('eps.casting.fixture.workspace')::uuid,current_setting('eps.m05.selection')::uuid,null);
 ack:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,jsonb_build_object('expected_workspace_row_version',public.eps_get_workspace(current_setting('eps.casting.fixture.workspace')::uuid)->'row_version','expected_draft_revision',review->'draft_revision','expected_input_fingerprint',review->'input_fingerprint','generation_note','Private synthetic generation audit note.'),'m05-capture-with-media');perform set_config('eps.m05.media.version',ack->>'resource_id',true);perform set_config('eps.m05.media.job',ack->>'job_id',true);
 if position('Private synthetic generation audit note.'in public.eps_get_version((ack->>'resource_id')::uuid)::text)>0 then raise exception'M05_PRIVATE_GENERATION_NOTE_EXPOSED';end if;
end$$;
set local role postgres;
do $$declare v eps.presentation_versions;begin
 select * into v from eps.presentation_versions where id=current_setting('eps.m05.media.version')::uuid;
 if jsonb_array_length(v.snapshot->'asset_inventory')<>4 or v.snapshot#>>'{slides,1,frames,0,asset_id}'<>'8a8a0000-0000-4000-8000-000000000003'or v.snapshot#>>'{slides,3,video_asset_id}'<>'8a8a0000-0000-4000-8000-000000000001'or v.snapshot#>>'{slides,7,logo_asset_id}'<>'8a8a0000-0000-4000-8000-000000000005'then raise exception'M05_EXACT_MEDIA_INVENTORY_ORDER_REPEAT_OR_LOGO_FAILED';end if;
 begin update eps.media_assets set sha256=repeat('f',64)where id='8a8a0000-0000-4000-8000-000000000002';raise exception'M05_RETAINED_FRAME_MUTATED';exception when raise_exception then if sqlerrm<>'RETAINED_VERSION_ASSET'then raise;end if;end;
 perform set_config('eps.m05.media.hash',(select input_hash from eps.jobs where id=current_setting('eps.m05.media.job')::uuid),true);
end$$;
-- Later defaults/selected media/soft archive cannot repoint the captured inventory.
update eps.workspace_candidates set selected_candidate_media_id=null,selected_frame_asset_ids='{}'where id='8a6a0000-0000-4000-8000-000000000001';
update eps.workspaces set logo_asset_id=null where id=current_setting('eps.casting.fixture.workspace')::uuid;
update eps.candidates set archived_at=clock_timestamp()where id='8a5a0000-0000-4000-8000-000000000001';
update eps.media_assets set status='archived'where id in('8a8a0000-0000-4000-8000-000000000001','8a8a0000-0000-4000-8000-000000000002','8a8a0000-0000-4000-8000-000000000003','8a8a0000-0000-4000-8000-000000000005');
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_jobs_executor;
do $$declare lease jsonb;input jsonb;grant_value jsonb;begin
 lease:=eps.claim_job_stage(jsonb_build_object('job_id',current_setting('eps.m05.media.job'),'stage','prepare_presentation','input_hash',current_setting('eps.m05.media.hash')));input:=eps.get_specs_stage_input((lease->>'job_id')::uuid,(lease->>'attempt_id')::uuid,lease->>'lease_token');
 perform set_config('eps.m05.media.lease',lease::text,true);
 if jsonb_array_length(input#>'{snapshot,asset_inventory}')<>4 then raise exception'M05_ARCHIVE_REBUILT_IMMUTABLE_INPUT';end if;
 execute'set local role eps_specs_assets_executor';grant_value:=eps.get_job_asset_access(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id','8a8a0000-0000-4000-8000-000000000001'));execute'set local role eps_jobs_executor';perform set_config('eps.m05.media.readgrant',grant_value::text,true);
end$$;
set local role postgres;
insert into storage.objects(bucket_id,name)values('eps-candidate-assets','assets/8a8a0000-0000-4000-8000-000000000001/original.mp4'),('eps-candidate-outputs','synthetic-m05/frame-2.jpg'),('eps-brand-assets','assets/8a8a0000-0000-4000-8000-000000000005/logo.png');
select set_config('request.headers',jsonb_build_object('x-eps-asset-grant',current_setting('eps.m05.media.readgrant')::jsonb->>'grant_token')::text,true),set_config('storage.operation','object.get_authenticated',true);
set local role anon;
do $$begin if(select count(*)from storage.objects where bucket_id='eps-candidate-assets')<>1 then raise exception'M05_ANON_EXACT_READ_CAPABILITY_FAILED';end if;end$$;
select set_config('storage.operation','object.list',true);
do $$begin if exists(select 1 from storage.objects)then raise exception'M05_CAPABILITY_ALLOWED_STORAGE_LIST';end if;end$$;
set local role postgres;
update public.app_capability_grants set active=false where principal_id=current_setting('eps.casting.fixture.actor')::uuid and capability='cast.read';
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role eps_specs_assets_executor;
do $$declare lease jsonb:=current_setting('eps.m05.media.lease')::jsonb;begin
 begin perform eps.get_job_asset_access(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','asset_id','8a8a0000-0000-4000-8000-000000000001'));raise exception'M05_REVOKED_REQUESTER_ASSET_GRANT_ACCEPTED';exception when raise_exception then if sqlerrm<>'PERMISSION_CHANGED'then raise;end if;end;
end$$;
set local role eps_jobs_executor;
do $$declare lease jsonb:=current_setting('eps.m05.media.lease')::jsonb;receipt jsonb;begin
 receipt:=eps.record_job_event(jsonb_build_object('job_id',lease->'job_id','attempt_id',lease->'attempt_id','lease_token',lease->'lease_token','stage',lease->'stage','input_hash',current_setting('eps.m05.media.hash'),'event_id','m05-revoked-requester-callback','sequence',1,'event_type','heartbeat'));if receipt->>'job_status'<>'failed'then raise exception'M05_REVOKED_REQUESTER_CALLBACK_ACCEPTED';end if;
end$$;
set local role postgres;
select set_config('request.headers','{}',true),set_config('storage.operation','object.get_authenticated',true),set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare id uuid:=current_setting('eps.m05.media.version')::uuid;begin
 if public.eps_get_version_asset(id,'8a8a0000-0000-4000-8000-000000000001','video')#>>'{asset,status}'<>'archived'or public.eps_get_version_asset(id,'8a8a0000-0000-4000-8000-000000000002','frame')#>>'{asset,id}'<>'8a8a0000-0000-4000-8000-000000000002'or public.eps_get_version_asset(id,'8a8a0000-0000-4000-8000-000000000005','logo')#>>'{asset,id}'<>'8a8a0000-0000-4000-8000-000000000005'then raise exception'M05_RETAINED_SOURCE_READ_REQUIRES_LIBRARY_PERMISSION';end if;
 if(select count(*)from storage.objects)<>3 then raise exception'M05_RETAINED_AUTHENTICATED_STORAGE_READ_FAILED';end if;
end$$;
select set_config('storage.operation','object.sign',true);
do $$begin if(select count(*)from storage.objects)<>3 then raise exception'M05_RETAINED_STORAGE_SIGN_FAILED';end if;end$$;
select set_config('storage.operation','object.list',true);
do $$begin if exists(select 1 from storage.objects)then raise exception'M05_RETAINED_STORAGE_LIST_ALLOWED';end if;end$$;
set local role postgres;
update public.project_memberships set active=false where project_id='8a0a0000-0000-4000-8000-000000000001'and principal_id=current_setting('eps.casting.fixture.actor')::uuid;
select set_config('storage.operation','object.get_authenticated',true);
set local role authenticated;
do $$begin if exists(select 1 from storage.objects)then raise exception'M05_REVOKED_PROJECT_STORAGE_VISIBLE';end if;begin perform public.eps_get_version(current_setting('eps.m05.media.version')::uuid);raise exception'M05_REVOKED_VERSION_VISIBLE';exception when raise_exception then if sqlerrm<>'RESOURCE_NOT_FOUND'then raise;end if;end;end$$;
set local role postgres;
update public.project_memberships set active=true where project_id='8a0a0000-0000-4000-8000-000000000001'and principal_id=current_setting('eps.casting.fixture.actor')::uuid;
update public.app_capability_grants set active=true where principal_id=current_setting('eps.casting.fixture.actor')::uuid and capability='cast.read';
select'M05_IMMUTABLE_MEDIA_PINS_ARCHIVE_DEFAULT_CHANGES_NARROW_STORAGE_AND_CURRENT_PROJECT_AUTH_PASSED';
