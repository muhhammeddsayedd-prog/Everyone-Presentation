-- Rollback-only composed Storage RLS proof. Owner setup injects synthetic asset
-- and retained-pin metadata into the existing synthetic Ready fixture; no real
-- files, native render, Storage HTTP, identities or cloud acceptance is claimed.
-- No existing Ready version row/content is changed. The actual SELECTs below
-- run as anon/authenticated SECURITY INVOKER, never as a table owner.
set local role postgres;
do $$begin if current_setting('eps.m06.rls.worker_checks')::integer<>4 then raise exception'M06_STORAGE_FOUR_EXISTING_WORKER_READS_REQUIRED';end if;end$$;
select'M06_STORAGE_EXISTING_WORKER_COMPOSED_READ_PRESERVED_PASSED';
select set_config('eps.m06.rls.version',current_setting('eps.m05.selection.version'),true);
select set_config('eps.m06.rls.link',current_setting('eps.m06.admission.link'),true);
select set_config('eps.m06.rls.ready_before',(select eps.presentation_hash(to_jsonb(v))from eps.presentation_versions v where id=current_setting('eps.m06.rls.version')::uuid),true);
insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,width,height,duration_ms,status,source_asset_id,source_timestamp_ms,producing_job_id,producing_attempt_id,output_stage,output_key)values
 ('8a9e0000-0000-4000-8000-000000000001',current_setting('eps.casting.fixture.workspace')::uuid,'client_logo','synthetic-logo.png','image/png','eps-brand-assets','m06-27/logo.png',100,repeat('1',64),100,100,null,'ready',null,null,null,null,null,null),
 ('8a9e0000-0000-4000-8000-000000000002',current_setting('eps.casting.fixture.workspace')::uuid,'candidate_video','synthetic-video.mp4','video/mp4','eps-candidate-assets','m06-27/video.mp4',100,repeat('2',64),640,480,1000,'ready',null,null,null,null,null,null),
 ('8a9e0000-0000-4000-8000-000000000003',current_setting('eps.casting.fixture.workspace')::uuid,'candidate_frame','synthetic-frame.jpg','image/jpeg','eps-candidate-outputs','m06-27/frame.jpg',100,repeat('3',64),640,480,null,'ready','8a9e0000-0000-4000-8000-000000000002',500,current_setting('eps.m05.selection.job')::uuid,gen_random_uuid(),'extract_frames','frame-1');
insert into eps.presentation_version_assets(version_id,asset_id,asset_kind,bucket,object_key,mime_type,byte_size,sha256,width,height,duration_ms,source_asset_id,timestamp_ms,filename,asset_created_at)
 select current_setting('eps.m06.rls.version')::uuid,a.id,a.purpose,a.bucket,a.object_key,a.mime_type,a.size_bytes,a.sha256,a.width,a.height,a.duration_ms,a.source_asset_id,a.source_timestamp_ms,a.filename,a.created_at from eps.media_assets a where a.id in('8a9e0000-0000-4000-8000-000000000001','8a9e0000-0000-4000-8000-000000000002','8a9e0000-0000-4000-8000-000000000003');
do $$declare v eps.presentation_versions;l eps.review_links;j uuid:=gen_random_uuid();e uuid:=gen_random_uuid();a uuid:=gen_random_uuid();g uuid:=gen_random_uuid();attempt uuid:=gen_random_uuid();input jsonb;begin
 select * into v from eps.presentation_versions where id=current_setting('eps.m06.rls.version')::uuid;select * into l from eps.review_links where id=current_setting('eps.m06.rls.link')::uuid;
 input:=jsonb_build_object('schema_version','1.0','workspace_id',v.workspace_id,'series_id',v.series_id,'version_id',v.id,'export_id',e,'review_link_id',l.id,'export_revision',l.export_revision,'token_generation',l.token_generation,'snapshot_sha256',v.snapshot_sha256,'manifest_sha256',v.manifest_sha256,'inventory_sha256',v.inventory_sha256,'configuration',v.snapshot->'render_configuration');
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status,current_attempt_id)
 values(j,v.workspace_id,l.created_by,'presentation_export',e,input,eps.presentation_hash(input),'eps.presentation-export-input.cast-canonical.v1',eps.presentation_hash(to_jsonb(j)),'render_export','synthetic-storage-rls','succeeded',attempt);
 insert into eps.presentation_exports(id,version_id,review_link_id,template_version,export_revision,parent_token_generation,job_id)values(e,v.id,l.id,v.snapshot#>>'{template,version}',l.export_revision,l.token_generation,j);
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,producing_job_id,producing_attempt_id,output_stage,output_key)
 values(a,v.workspace_id,'presentation_pdf','synthetic-export.pdf','application/pdf','eps-presentation-outputs','jobs/'||j||'/attempts/'||attempt||'/'||a||'.pdf',100,repeat('4',64),'ready',j,attempt,'render_export','presentation_pdf');
 insert into eps.review_media_grants(id,review_link_id,version_id,export_id,parent_token_generation,token_digest,expires_at,producing_attempt_id)values(g,l.id,v.id,e,l.token_generation,repeat('8',64),l.expires_at,attempt);
 update eps.presentation_exports set status='ready',pdf_asset_id=a,media_grant_id=g,ready_at=clock_timestamp()where id=e;
 perform set_config('eps.m06.rls.export',e::text,true);perform set_config('eps.m06.rls.media_grant',g::text,true);
 insert into eps.review_links(id,series_id,label,expires_at,download_enabled,token_digest,token_generation,export_revision,created_by)values('8a9e0000-0000-4000-8000-000000000009',l.series_id,'Synthetic foreign link',l.expires_at,true,repeat('9',64),l.token_generation,l.export_revision,l.created_by);
end$$;
insert into storage.objects(bucket_id,name)
 select bucket,object_key from eps.media_assets where id in('8a9e0000-0000-4000-8000-000000000001','8a9e0000-0000-4000-8000-000000000002','8a9e0000-0000-4000-8000-000000000003')or id=(select pdf_asset_id from eps.presentation_exports where id=current_setting('eps.m06.rls.export')::uuid)or id=current_setting('eps.m05.selection.pdf')::uuid on conflict(bucket_id,name)do nothing;
create function pg_temp.m06_rls_read(p_target text,p_token text,p_operation text,p_expected integer)returns void language plpgsql volatile security invoker set search_path=''as $$declare actual integer;begin
 if current_user not in('anon','authenticated')then raise exception'M06_STORAGE_REAL_UNPRIVILEGED_ROLE_REQUIRED';end if;
 perform set_config('storage.operation',p_operation,true);perform set_config('request.headers',jsonb_build_object('x-eps-review-asset-grant',current_setting('eps.m06.rls.token.'||p_token))::text,true);
 select count(*)into actual from storage.objects where bucket_id=current_setting('eps.m06.rls.bucket.'||p_target)and name=current_setting('eps.m06.rls.key.'||p_target);
 if actual<>p_expected then raise exception'M06_STORAGE_COMPOSED_SELECT_MISMATCH:%:%:%:%',current_user,p_target,p_operation,actual;end if;
end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare purpose text;asset uuid;data jsonb;request jsonb;begin
 foreach purpose in array array['logo','frame','video','pdf','pdf_video']loop
  asset:=case purpose when'logo'then'8a9e0000-0000-4000-8000-000000000001'when'frame'then'8a9e0000-0000-4000-8000-000000000003'else'8a9e0000-0000-4000-8000-000000000002'end;
  if purpose='pdf'then data:=pg_temp.m06_call('get_export_asset',jsonb_build_object('session_digest',repeat('1',64),'export_id',current_setting('eps.m06.rls.export')));
  elsif purpose='pdf_video'then data:=pg_temp.m06_call('grant_asset',jsonb_build_object('media_grant_digest',repeat('8',64),'version_id',current_setting('eps.m06.rls.version'),'asset_id',asset));
  else data:=pg_temp.m06_call('get_asset',jsonb_build_object('session_digest',repeat('1',64),'version_id',current_setting('eps.m06.rls.version'),'asset_id',asset,'purpose',purpose));end if;
  perform set_config('eps.m06.rls.token.'||purpose,data->>'grant_token',true);perform set_config('eps.m06.rls.bucket.'||purpose,data->>'bucket',true);perform set_config('eps.m06.rls.key.'||purpose,data->>'object_key',true);
 end loop;
end$$;
do $$declare purpose text;operation text;begin
 foreach purpose in array array['frame','logo','video','pdf','pdf_video']loop
  foreach operation in array array['object.get_authenticated','object.get_authenticated_info']loop perform pg_temp.m06_rls_read(purpose,purpose,operation,1);end loop;
  foreach operation in array array['object.list','object.sign','object.upload','object.delete']loop perform pg_temp.m06_rls_read(purpose,purpose,operation,0);end loop;
 end loop;
end$$;
set local role authenticated;
do $$declare purpose text;begin foreach purpose in array array['frame','logo','video','pdf','pdf_video']loop perform pg_temp.m06_rls_read(purpose,purpose,'object.get_authenticated',1);perform pg_temp.m06_rls_read(purpose,purpose,'object.get_authenticated_info',1);perform pg_temp.m06_rls_read(purpose,purpose,'object.sign',0);perform pg_temp.m06_rls_read(purpose,purpose,'object.list',0);end loop;end$$;
select'M06_STORAGE_REAL_ANON_AUTHENTICATED_FRAME_LOGO_VIDEO_PDF_GET_INFO_ONLY_PASSED';
set local role anon;
do $$declare purpose text;actual integer;begin
 foreach purpose in array array['frame','logo','video','pdf']loop
  perform set_config('storage.operation','object.get_authenticated',true);perform set_config('request.headers','{}',true);
  select count(*)into actual from storage.objects where bucket_id=current_setting('eps.m06.rls.bucket.'||purpose)and name=current_setting('eps.m06.rls.key.'||purpose);if actual<>0 then raise exception'M06_STORAGE_MISSING_GRANT_ACCEPTED';end if;
  perform set_config('request.headers',jsonb_build_object('x-eps-asset-grant',current_setting('eps.m06.rls.token.'||purpose))::text,true);
  select count(*)into actual from storage.objects where bucket_id=current_setting('eps.m06.rls.bucket.'||purpose)and name=current_setting('eps.m06.rls.key.'||purpose);if actual<>0 then raise exception'M06_STORAGE_WRONG_HEADER_ACCEPTED';end if;
 end loop;
 perform pg_temp.m06_rls_read('video','frame','object.get_authenticated',0);perform pg_temp.m06_rls_read('pdf','logo','object.get_authenticated',0);
end$$;
savepoint m06_expired_grant;
set local role postgres;
update eps.guest_asset_grants set created_at=clock_timestamp()-interval'90seconds',expires_at=clock_timestamp()-interval'31seconds'where token_digest=encode(sha256(convert_to(current_setting('eps.m06.rls.token.frame'),'UTF8')),'hex');
set local role anon;
select pg_temp.m06_rls_read('frame','frame','object.get_authenticated',0);
rollback to savepoint m06_expired_grant;
savepoint m06_cross_version;
set local role postgres;
update eps.guest_asset_grants set version_id=current_setting('eps.m05.selection_v2.version')::uuid where token_digest=encode(sha256(convert_to(current_setting('eps.m06.rls.token.frame'),'UTF8')),'hex');
set local role anon;
select pg_temp.m06_rls_read('frame','frame','object.get_authenticated',0);
rollback to savepoint m06_cross_version;
savepoint m06_cross_link;
set local role postgres;
update eps.guest_asset_grants set review_link_id='8a9e0000-0000-4000-8000-000000000009'where token_digest=encode(sha256(convert_to(current_setting('eps.m06.rls.token.frame'),'UTF8')),'hex');
set local role anon;
select pg_temp.m06_rls_read('frame','frame','object.get_authenticated',0);
rollback to savepoint m06_cross_link;
savepoint m06_expired_session;
set local role postgres;
update eps.guest_sessions set expires_at=clock_timestamp()-interval'1second'where review_link_id=current_setting('eps.m06.rls.link')::uuid;
set local role anon;
select pg_temp.m06_rls_read('frame','frame','object.get_authenticated',0);
rollback to savepoint m06_expired_session;
savepoint m06_expired_parent;
set local role postgres;
update eps.review_links set expires_at=clock_timestamp()-interval'1second'where id=current_setting('eps.m06.rls.link')::uuid;
set local role anon;
select pg_temp.m06_rls_read('video','video','object.get_authenticated',0);
rollback to savepoint m06_expired_parent;
savepoint m06_revoked_parent;
set local role postgres;
update eps.review_links set revoked_at=clock_timestamp()where id=current_setting('eps.m06.rls.link')::uuid;
set local role anon;
select pg_temp.m06_rls_read('frame','frame','object.get_authenticated',0);
select pg_temp.m06_rls_read('pdf','pdf','object.get_authenticated',0);
rollback to savepoint m06_revoked_parent;
savepoint m06_rotated_parent;
set local role postgres;
update eps.review_links set token_generation=token_generation+1 where id=current_setting('eps.m06.rls.link')::uuid;
set local role anon;
select pg_temp.m06_rls_read('frame','frame','object.get_authenticated',0);
select pg_temp.m06_rls_read('pdf_video','pdf_video','object.get_authenticated',0);
rollback to savepoint m06_rotated_parent;
savepoint m06_revoked_media;
set local role postgres;
update eps.review_media_grants set revoked_at=clock_timestamp()where id=current_setting('eps.m06.rls.media_grant')::uuid;
set local role anon;
select pg_temp.m06_rls_read('pdf_video','pdf_video','object.get_authenticated',0);
select pg_temp.m06_rls_read('pdf','pdf','object.get_authenticated',0);
select pg_temp.m06_rls_read('video','video','object.get_authenticated',1);
rollback to savepoint m06_revoked_media;
savepoint m06_download_disabled;
set local role postgres;
update eps.review_links set download_enabled=false where id=current_setting('eps.m06.rls.link')::uuid;
set local role anon;
select pg_temp.m06_rls_read('pdf','pdf','object.get_authenticated',0);
select pg_temp.m06_rls_read('frame','frame','object.get_authenticated',1);
select pg_temp.m06_rls_read('video','video','object.get_authenticated',1);
select pg_temp.m06_rls_read('pdf_video','pdf_video','object.get_authenticated',1);
rollback to savepoint m06_download_disabled;
select'M06_STORAGE_PARENT_SESSION_GRANT_SCOPE_EXPIRY_REVOKE_ROTATION_DOWNLOAD_DISABLE_COMPOSED_DENIAL_PASSED';
set local role postgres;
select set_config('eps.m06.rls.canonical.bucket',bucket,true),set_config('eps.m06.rls.canonical.key',object_key,true)from eps.media_assets where id=current_setting('eps.m05.selection.pdf')::uuid;
create function pg_temp.m06_internal_rls(p_export boolean,p_operation text,p_expected integer)returns void language plpgsql volatile security invoker set search_path=''as $$declare n integer;begin
 if current_user<>'authenticated'then raise exception'M06_STORAGE_INTERNAL_REAL_ROLE_REQUIRED';end if;
 perform set_config('storage.operation',p_operation,true);perform set_config('request.headers','{}',true);
 select count(*)into n from storage.objects where bucket_id=current_setting(case when p_export then'eps.m06.rls.bucket.pdf'else'eps.m06.rls.canonical.bucket'end)and name=current_setting(case when p_export then'eps.m06.rls.key.pdf'else'eps.m06.rls.canonical.key'end);
 if n<>p_expected then raise exception'M06_STORAGE_INTERNAL_SCOPE_MISMATCH:%:%:%',p_export,p_operation,n;end if;
end$$;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare op text;begin
 perform public.eps_get_pdf_export_asset(current_setting('eps.m06.rls.export')::uuid);
 foreach op in array array['object.get_authenticated','object.get_authenticated_info','object.sign']loop perform pg_temp.m06_internal_rls(true,op,1);perform pg_temp.m06_internal_rls(false,op,1);end loop;perform pg_temp.m06_internal_rls(true,'object.list',0);
end$$;
select set_config('request.jwt.claim.sub',current_setting('eps.casting.fixture.actor2'),true),set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('eps.casting.fixture.actor2'),'role','authenticated')::text,true);
set local role authenticated;
do $$declare op text;begin foreach op in array array['object.get_authenticated','object.get_authenticated_info','object.sign']loop perform pg_temp.m06_internal_rls(true,op,0);perform pg_temp.m06_internal_rls(false,op,1);end loop;end$$;
set local role postgres;
do $$begin if(select eps.presentation_hash(to_jsonb(v))from eps.presentation_versions v where id=current_setting('eps.m06.rls.version')::uuid)<>current_setting('eps.m06.rls.ready_before')then raise exception'M06_STORAGE_CHANGED_FROZEN_READY_VERSION';end if;end$$;
select'M06_STORAGE_INTERNAL_MANAGE_EXPORT_GET_INFO_SIGN_READER_DENIED_CANONICAL_READER_PRESERVED_PASSED';
