-- Real-role frozen-source read/capture protocol only. No native/PDF byte claim.
set local role authenticated;
do $$declare data jsonb;ack jsonb;begin
 data:=public.eps_get_version_asset(current_setting('eps.t28.legacy')::uuid,current_setting('eps.t28.video')::uuid,'video');
 if not(data?'transcript')then raise exception'M06_TRANSCRIPT_PLAYBACK_COMPANION_MISSING';end if;
 if data->'transcript'<>jsonb_build_object('version_id',current_setting('eps.t28.legacy'),'asset_id',current_setting('eps.t28.video'),'status','not_captured','original_text',null,'source_sha256',null,'languages','[]'::jsonb,'source_kind','source_transcript')
 then raise exception'M06_TRANSCRIPT_LEGACY_LIVE_FALLBACK';end if;
 ack:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,current_setting('eps.t28.legacy_body')::jsonb,'m06-transcript-legacy-original');
 if ack<>current_setting('eps.t28.legacy_ack')::jsonb then raise exception'M06_TRANSCRIPT_OLD_ACK_CHANGED';end if;
 begin perform eps.capture_presentation_video_transcripts(current_setting('eps.t28.legacy')::uuid);raise exception'M06_TRANSCRIPT_AUTH_CAPTURE_EXECUTE';exception when insufficient_privilege then null;end;
 begin perform eps.presentation_video_transcript(current_setting('eps.t28.legacy')::uuid,current_setting('eps.t28.video')::uuid);raise exception'M06_TRANSCRIPT_AUTH_PRIVATE_READ_EXECUTE';exception when insufficient_privilege then null;end;
end$$;
set local role postgres;
do $$begin
 if exists(select 1 from eps.presentation_video_transcripts)then raise exception'M06_TRANSCRIPT_OLD_ACK_BACKFILLED';end if;
 if has_table_privilege('anon','eps.presentation_video_transcripts','SELECT')or has_table_privilege('authenticated','eps.presentation_video_transcripts','SELECT')
 or has_table_privilege('service_role','eps.presentation_video_transcripts','SELECT')
 or exists(select 1 from pg_roles where rolname='eps_specs_runtime'and has_table_privilege(oid,'eps.presentation_video_transcripts','SELECT'))
 then raise exception'M06_TRANSCRIPT_BROAD_TABLE_READ';end if;
end$$;
set local role eps_review_owner;
do $$begin
 begin perform eps.capture_presentation_video_transcripts(current_setting('eps.t28.legacy')::uuid);raise exception'M06_TRANSCRIPT_READY_CAPTURE_ALLOWED';
 exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;
 perform set_config('eps.presentation.transcript_capture_version',current_setting('eps.t28.legacy'),true);
 begin
  insert into eps.presentation_video_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,languages,captured_at)
   select v.id,current_setting('eps.t28.video')::uuid,current_setting('eps.t28.media')::uuid,1,'not_provided','{}',v.created_at from eps.presentation_versions v where id=current_setting('eps.t28.legacy')::uuid;
  raise exception'M06_TRANSCRIPT_READY_INSERT_RLS_ALLOWED';
 exception when insufficient_privilege then null;end;
 perform set_config('eps.presentation.transcript_capture_version','',true);
end$$;
set local role postgres;
select'M06_TRANSCRIPT_LEGACY_EXPLICIT_ABSENCE_CACHED_ACK_NO_BACKFILL_PRIVATE_BOUNDARY_PASSED';
set local role authenticated;
do $$declare ack jsonb;again jsonb;begin
 ack:=pg_temp.t28_generate('m06-transcript-frozen-source');
 perform set_config('eps.t28.frozen',ack->>'resource_id',true);
 perform set_config('eps.t28.frozen_body',current_setting('eps.t28.lastbody'),true);
 again:=public.eps_generate_version(current_setting('eps.m05.selection')::uuid,current_setting('eps.t28.frozen_body')::jsonb,'m06-transcript-frozen-source');
 if ack<>again then raise exception'M06_TRANSCRIPT_FRESH_ACK_REPLAY_CHANGED';end if;
 perform pg_temp.t28_ready((ack->>'resource_id')::uuid);
end$$;
set local role postgres;
do $$declare item eps.presentation_video_transcripts;v eps.presentation_versions;expected text;begin
 select * into item from eps.presentation_video_transcripts where version_id=current_setting('eps.t28.frozen')::uuid;
 select * into v from eps.presentation_versions where id=item.version_id;
 select original_transcript into expected from eps.candidate_media where id=current_setting('eps.t28.media')::uuid;
 if item.status<>'available'or item.original_text<>expected or item.source_sha256<>encode(sha256(convert_to(expected,'UTF8')),'hex')
 or item.languages<>array['ar','AR','ar']or item.video_asset_id<>current_setting('eps.t28.video')::uuid
 or item.candidate_media_id<>current_setting('eps.t28.media')::uuid or item.captured_at<>v.created_at
 or(select count(*)from eps.presentation_video_transcripts where version_id=v.id)<>1
 or(select count(*)from eps.version_slides d where d.version_id=v.id and d.snapshot->>'video_asset_id'=item.video_asset_id::text)<2
 then raise exception'M06_TRANSCRIPT_FRESH_CAPTURE_EXACT_SOURCE_OR_REPEATED_ASSIGNMENT_FAILED';end if;
 if v.snapshot::text like'%PRIVATE_TRANSCRIPT_%'or v.manifest::text like'%PRIVATE_TRANSCRIPT_%'
 or exists(select 1 from eps.jobs j where j.resource_id=v.id and(j.input::text like'%PRIVATE_TRANSCRIPT_%'or j.completed_stages::text like'%PRIVATE_TRANSCRIPT_%'))
 or exists(select 1 from eps.outbox_events o join eps.jobs j on j.id=o.job_id where j.resource_id=v.id and to_jsonb(o)::text like'%PRIVATE_TRANSCRIPT_%')
 or exists(select 1 from jsonb_array_elements(v.manifest->'slides')s where s->>'kind'='candidate'and(select count(*)from jsonb_object_keys(s->'fields'))<>10)
 then raise exception'M06_TRANSCRIPT_LEAKED_INTO_RENDER_FIELDS_OR_JOB';end if;
 perform set_config('eps.t28.frozen_text',item.original_text,true);perform set_config('eps.t28.frozen_hash',item.source_sha256,true);
 perform set_config('eps.t28.frozen_row',eps.presentation_hash(to_jsonb(item)),true);
 perform set_config('eps.t28.frozen_version',eps.presentation_hash(to_jsonb(v)),true);
end$$;
update eps.candidate_media set original_transcript='PRIVATE_LATER_LIBRARY_TEXT',languages=array['changed'],row_version=row_version+1 where id=current_setting('eps.t28.media')::uuid;
set local role authenticated;
do $$declare data jsonb;begin
 data:=public.eps_get_version_asset(current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid,'video')->'transcript';
 if(select count(*)from jsonb_object_keys(data))<>7 or data->>'original_text'<>current_setting('eps.t28.frozen_text')
 or data->>'source_sha256'<>current_setting('eps.t28.frozen_hash')or data->'languages'<>to_jsonb(array['ar','AR','ar'])
 or data->>'source_kind'<>'source_transcript'or data::text like'%PRIVATE_INTERNAL_NOTE%'or data::text like'%PRIVATE_LATER_LIBRARY_TEXT%'
 then raise exception'M06_TRANSCRIPT_NOT_FROZEN_OR_CLOSED';end if;
 if public.eps_get_version_asset(current_setting('eps.t28.frozen')::uuid,(public.eps_get_version(current_setting('eps.t28.frozen')::uuid)->>'pdf_asset_id')::uuid,'pdf')?'transcript'
 then raise exception'M06_TRANSCRIPT_ADDED_TO_PDF_METADATA';end if;
end$$;
set local role postgres;
do $$begin
 begin update eps.presentation_video_transcripts set original_text='PRIVATE_IMMUTABLE_CHANGE'where version_id=current_setting('eps.t28.frozen')::uuid;raise exception'M06_TRANSCRIPT_MUTABLE_UPDATE';exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;
 begin delete from eps.presentation_video_transcripts where version_id=current_setting('eps.t28.frozen')::uuid;raise exception'M06_TRANSCRIPT_MUTABLE_DELETE';exception when raise_exception then if sqlerrm<>'IMMUTABLE_VERSION'then raise;end if;end;
 if(select eps.presentation_hash(to_jsonb(t))from eps.presentation_video_transcripts t where version_id=current_setting('eps.t28.frozen')::uuid)<>current_setting('eps.t28.frozen_row')
 then raise exception'M06_TRANSCRIPT_IMMUTABLE_ROW_CHANGED';end if;
end$$;
select'M06_TRANSCRIPT_ACTUAL_GENERATE_UTF8_HASH_LANGUAGE_ORDER_ONCE_FROZEN_RENDER_SEPARATION_PASSED';

-- Missing source is captured explicitly; stale source SHA still fences Generate.
savepoint transcript_missing;
set local role postgres;
update eps.candidate_media set original_transcript=null,row_version=row_version+1 where id=current_setting('eps.t28.media')::uuid;
set local role authenticated;
do $$declare ack jsonb;data jsonb;begin
 ack:=pg_temp.t28_generate('m06-transcript-not-provided');perform pg_temp.t28_ready((ack->>'resource_id')::uuid);
 data:=public.eps_get_version_asset((ack->>'resource_id')::uuid,current_setting('eps.t28.video')::uuid,'video')->'transcript';
 if data->>'status'<>'not_provided'or data->'original_text'<>'null'or data->'source_sha256'<>'null'or data->'languages'<>'[]'
 then raise exception'M06_TRANSCRIPT_MISSING_SOURCE_NOT_EXPLICIT';end if;
end$$;
rollback to savepoint transcript_missing;
-- Exact ECMAScript whitespace semantics: permitted blank text is absent; C1 is
-- content. No trim/normalization is applied to an available companion.
set local role postgres;
create function pg_temp.t28_blank_source(p_text text,p_key text)returns void language plpgsql volatile security definer set search_path=''as $$
declare ack jsonb;item eps.presentation_video_transcripts;begin
 update eps.candidate_media set original_transcript=p_text,languages=array['ar'],row_version=row_version+1 where id=current_setting('eps.t28.media')::uuid;
 ack:=pg_temp.t28_generate(p_key);
 select * into item from eps.presentation_video_transcripts where version_id=(ack->>'resource_id')::uuid;
 if item.status<>'not_provided'or item.original_text is not null or item.source_sha256 is not null or item.languages<>'{}'then raise exception'M06_TRANSCRIPT_BLANK_SOURCE_PARITY_FAILED';end if;
end$$;
savepoint transcript_blank;
select pg_temp.t28_blank_source(E'\t\n\r ','m06-transcript-blank-ascii');
select pg_temp.t28_blank_source(U&'\00A0\FEFF','m06-transcript-blank-unicode');
rollback to savepoint transcript_blank;
set local role postgres;
create function pg_temp.t28_invalid_source(p_text text,p_languages text[],p_key text)returns void language plpgsql volatile security definer set search_path=''as $$
declare detail text;before_versions bigint;begin
 update eps.candidate_media set original_transcript=p_text,languages=p_languages,row_version=row_version+1 where id=current_setting('eps.t28.media')::uuid;
 select count(*)into before_versions from eps.presentation_versions;
 begin perform pg_temp.t28_generate(p_key);raise exception'M06_TRANSCRIPT_INVALID_SOURCE_ACCEPTED';
 exception when raise_exception then
  get stacked diagnostics detail=pg_exception_detail;
  if sqlerrm<>'SNAPSHOT_INVALID'or coalesce(detail,'')like'%PRIVATE_INVALID_TRANSCRIPT%'then raise exception'M06_TRANSCRIPT_INVALID_SOURCE_DETAIL_UNSAFE';end if;
 end;
 if(select count(*)from eps.presentation_versions)<>before_versions then raise exception'M06_TRANSCRIPT_INVALID_CAPTURE_LEFT_VERSION';end if;
end$$;
savepoint transcript_invalid;
select pg_temp.t28_invalid_source('PRIVATE_INVALID_TRANSCRIPT'||chr(1),array['ar'],'m06-transcript-invalid-control');
select pg_temp.t28_invalid_source(E'\t '||chr(1),array['ar'],'m06-transcript-blank-invalid-control');
select pg_temp.t28_invalid_source(repeat('x',200001),array['ar'],'m06-transcript-invalid-length');
select pg_temp.t28_invalid_source('PRIVATE_INVALID_TRANSCRIPT',array[E'ar\n'],'m06-transcript-invalid-language-lf');
select pg_temp.t28_invalid_source('PRIVATE_INVALID_TRANSCRIPT',array[E'ar\r'],'m06-transcript-invalid-language-cr');
select pg_temp.t28_invalid_source('PRIVATE_INVALID_TRANSCRIPT',array[E'ar\t'],'m06-transcript-invalid-language-tab');
rollback to savepoint transcript_invalid;
set local role authenticated;
do $$declare r jsonb;begin
 begin perform public.eps_generate_version(current_setting('eps.m05.selection')::uuid,current_setting('eps.t28.frozen_body')::jsonb,'m06-transcript-stale-source-sha');raise exception'M06_TRANSCRIPT_STALE_SOURCE_SHA_ACCEPTED';
 exception when raise_exception then if sqlerrm<>'INPUT_CHANGED'then raise;end if;end;
end$$;
select'M06_TRANSCRIPT_UNAVAILABLE_SOURCE_STALE_SHA_AND_PRECHECKED_INVALID_SOURCE_NO_ROW_DETAIL_PASSED';

-- Synthetic backend proof and exact session/PDF-grant scope, no raw token SQL.
set local role postgres;
update eps.review_gateway_config set backend_key=decode(repeat('17',32),'hex'),enabled=true where id;
create function pg_temp.t28_call(p_operation text,p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare issued bigint:=floor(extract(epoch from clock_timestamp())*1000);nonce text:=encode(extensions.gen_random_bytes(16),'hex');signature text;begin
 signature:=encode(extensions.hmac(convert_to(eps.cast_canonical(jsonb_build_object('operation',p_operation,'input',p_input,'issued_at',issued,'nonce',nonce)),'UTF8'),(select backend_key from eps.review_gateway_config where id),'sha256'),'hex');
 return public.eps_guest_operation(p_operation,p_input,jsonb_build_object('issued_at',issued,'nonce',nonce,'signature',signature));
end$$;
-- Gateway call itself runs as anon, not the proof function owner.
create function pg_temp.t28_proof(p_operation text,p_input jsonb)returns jsonb language plpgsql volatile security definer set search_path=''as $$
declare issued bigint:=floor(extract(epoch from clock_timestamp())*1000);nonce text:=encode(extensions.gen_random_bytes(16),'hex');signature text;begin
 signature:=encode(extensions.hmac(convert_to(eps.cast_canonical(jsonb_build_object('operation',p_operation,'input',p_input,'issued_at',issued,'nonce',nonce)),'UTF8'),(select backend_key from eps.review_gateway_config where id),'sha256'),'hex');
 return jsonb_build_object('issued_at',issued,'nonce',nonce,'signature',signature);
end$$;
create or replace function pg_temp.t28_call(p_operation text,p_input jsonb)returns jsonb language sql volatile security invoker set search_path=''as $$
 select public.eps_guest_operation(p_operation,p_input,pg_temp.t28_proof(p_operation,p_input))
$$;
insert into eps.review_links(id,series_id,label,token_digest,expires_at,created_by)
 values('8a9f0000-0000-4000-8000-000000000010',current_setting('eps.m05.selection')::uuid,'Synthetic transcript link',repeat('a',64),clock_timestamp()+interval'30days',current_setting('eps.casting.fixture.actor')::uuid);
insert into eps.guest_sessions(id,review_link_id,session_token_digest,link_token_generation,expires_at)
 values('8a9f0000-0000-4000-8000-000000000011','8a9f0000-0000-4000-8000-000000000010',repeat('1',64),1,clock_timestamp()+interval'1hour');
do $$declare v eps.presentation_versions;j uuid:=gen_random_uuid();e uuid:=gen_random_uuid();g uuid:=gen_random_uuid();a uuid:=gen_random_uuid();attempt uuid:=gen_random_uuid();begin
 select * into v from eps.presentation_versions where id=current_setting('eps.t28.frozen')::uuid;
 insert into eps.jobs(id,workspace_id,requested_by,kind,resource_id,input,input_hash,input_hash_version,dedupe_key,stage,correlation_id,status,current_attempt_id)
 values(j,v.workspace_id,current_setting('eps.casting.fixture.actor')::uuid,'presentation_export',e,'{}',repeat('a',64),'eps.presentation-export-input.cast-canonical.v1',eps.presentation_hash(to_jsonb(j)),'render_export','synthetic-transcript-grant','succeeded',attempt);
 insert into eps.presentation_exports(id,version_id,review_link_id,template_version,export_revision,parent_token_generation,job_id)
 values(e,v.id,'8a9f0000-0000-4000-8000-000000000010',v.snapshot#>>'{template,version}',1,1,j);
 insert into eps.media_assets(id,origin_workspace_id,purpose,filename,mime_type,bucket,object_key,size_bytes,sha256,status,producing_job_id,producing_attempt_id,output_stage,output_key)
 values(a,v.workspace_id,'presentation_pdf','synthetic-export.pdf','application/pdf','eps-presentation-outputs','jobs/'||j||'/attempts/'||attempt||'/'||a||'.pdf',100,repeat('4',64),'ready',j,attempt,'render_export','presentation_pdf');
 insert into eps.review_media_grants(id,review_link_id,version_id,export_id,parent_token_generation,token_digest,expires_at,producing_attempt_id)
 values(g,'8a9f0000-0000-4000-8000-000000000010',v.id,e,1,repeat('8',64),clock_timestamp()+interval'30days',attempt);
 update eps.presentation_exports set status='ready',pdf_asset_id=a,media_grant_id=g,ready_at=clock_timestamp()where id=e;
 perform set_config('eps.t28.media_grant',g::text,true);
end$$;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
set local role anon;
do $$declare input jsonb;data jsonb;kind text;begin
 data:=pg_temp.t28_call('get_asset',jsonb_build_object('version_id',current_setting('eps.t28.legacy'),'asset_id',current_setting('eps.t28.video'),'session_digest',repeat('1',64),'purpose','video'))->'transcript';
 if data->>'status'<>'not_captured'or data->'original_text'<>'null'then raise exception'M06_TRANSCRIPT_GUEST_LEGACY_LIVE_FALLBACK';end if;
 foreach kind in array array['get_asset','grant_asset']loop
  input:=jsonb_build_object('version_id',current_setting('eps.t28.frozen'),'asset_id',current_setting('eps.t28.video'))
   ||case kind when'get_asset'then jsonb_build_object('session_digest',repeat('1',64),'purpose','video')else jsonb_build_object('media_grant_digest',repeat('8',64))end;
  data:=pg_temp.t28_call(kind,input)->'transcript';
  if data->>'original_text'<>current_setting('eps.t28.frozen_text')or data->>'source_sha256'<>current_setting('eps.t28.frozen_hash')
  or data->>'version_id'<>current_setting('eps.t28.frozen')or data->>'asset_id'<>current_setting('eps.t28.video')
  then raise exception'M06_TRANSCRIPT_GUEST_OR_PDF_GRANT_NOT_FIXED';end if;
 end loop;
 begin perform public.eps_get_version_asset(current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid,'video');raise exception'M06_TRANSCRIPT_ANON_INTERNAL_READ';exception when insufficient_privilege then null;end;
 begin perform eps.presentation_video_transcript(current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);raise exception'M06_TRANSCRIPT_ANON_PRIVATE_READ';exception when insufficient_privilege then null;end;
end$$;
select'M06_TRANSCRIPT_REAL_GUEST_AND_PDF_GRANT_SAME_FROZEN_VIDEO_PRIVATE_TABLE_BOUNDARY_PASSED';
set local role postgres;
create function pg_temp.t28_denied(p_grant boolean,p_version uuid,p_asset uuid)returns void language plpgsql volatile security invoker set search_path=''as $$
declare input jsonb;begin
 input:=jsonb_build_object('version_id',p_version,'asset_id',p_asset)||case when p_grant then jsonb_build_object('media_grant_digest',repeat('8',64))else jsonb_build_object('session_digest',repeat('1',64),'purpose','video')end;
 begin perform pg_temp.t28_call(case when p_grant then'grant_asset'else'get_asset'end,input);raise exception'M06_TRANSCRIPT_SCOPE_DENIAL_MISSING';
 exception when raise_exception then if sqlerrm not in('REVIEW_UNAVAILABLE','RESOURCE_NOT_FOUND')then raise;end if;end;
end$$;
set local role anon;
select pg_temp.t28_denied(true,current_setting('eps.t28.legacy')::uuid,current_setting('eps.t28.video')::uuid);
select pg_temp.t28_denied(false,current_setting('eps.t28.frozen')::uuid,gen_random_uuid());
set local role postgres;
savepoint transcript_downloads;
update eps.review_links set download_enabled=false where id='8a9f0000-0000-4000-8000-000000000010';
set local role anon;
do $$declare input jsonb;begin
 input:=jsonb_build_object('version_id',current_setting('eps.t28.frozen'),'asset_id',current_setting('eps.t28.video'),'media_grant_digest',repeat('8',64));
 if pg_temp.t28_call('grant_asset',input)#>>'{transcript,status}'<>'available'then raise exception'M06_TRANSCRIPT_DOWNLOAD_DISABLE_BLOCKED_VIEW';end if;
end$$;
rollback to savepoint transcript_downloads;
savepoint transcript_revoked;
set local role postgres;
update eps.review_links set revoked_at=clock_timestamp()where id='8a9f0000-0000-4000-8000-000000000010';
set local role anon;
select pg_temp.t28_denied(false,current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);
select pg_temp.t28_denied(true,current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);
rollback to savepoint transcript_revoked;
savepoint transcript_rotated;
set local role postgres;
update eps.review_links set token_generation=2 where id='8a9f0000-0000-4000-8000-000000000010';
set local role anon;
select pg_temp.t28_denied(false,current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);
select pg_temp.t28_denied(true,current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);
rollback to savepoint transcript_rotated;
savepoint transcript_expired;
set local role postgres;
update eps.review_links set expires_at=clock_timestamp()-interval'1second'where id='8a9f0000-0000-4000-8000-000000000010';
set local role anon;
select pg_temp.t28_denied(false,current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);
select pg_temp.t28_denied(true,current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);
rollback to savepoint transcript_expired;
savepoint transcript_session_expired;
set local role postgres;
update eps.guest_sessions set expires_at=clock_timestamp()-interval'1second'where id='8a9f0000-0000-4000-8000-000000000011';
set local role anon;
select pg_temp.t28_denied(false,current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);
rollback to savepoint transcript_session_expired;
savepoint transcript_grant_expired;
set local role postgres;
update eps.review_media_grants set expires_at=clock_timestamp()-interval'1second'where id=current_setting('eps.t28.media_grant')::uuid;
set local role anon;
select pg_temp.t28_denied(true,current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);
rollback to savepoint transcript_grant_expired;
savepoint transcript_grant_revoked;
set local role postgres;
update eps.review_media_grants set revoked_at=clock_timestamp()where id=current_setting('eps.t28.media_grant')::uuid;
set local role anon;
select pg_temp.t28_denied(true,current_setting('eps.t28.frozen')::uuid,current_setting('eps.t28.video')::uuid);
rollback to savepoint transcript_grant_revoked;
set local role postgres;
do $$begin
 if(select eps.presentation_hash(to_jsonb(v))from eps.presentation_versions v where id=current_setting('eps.t28.frozen')::uuid)<>current_setting('eps.t28.frozen_version')
 then raise exception'M06_TRANSCRIPT_READ_CHANGED_FROZEN_VERSION';end if;
 if exists(select 1 from jsonb_each_text(current_setting('eps.t28.old_versions')::jsonb)old
  left join eps.presentation_versions v on v.id=old.key::uuid where v.id is null or eps.presentation_hash(to_jsonb(v))<>old.value)
 then raise exception'M06_TRANSCRIPT_PREVIOUS_VERSION_CHANGED';end if;
end$$;
select'M06_TRANSCRIPT_FOREIGN_SCOPE_ROTATION_REVOCATION_EXPIRY_DOWNLOAD_VIEW_AND_READY_PRESERVATION_PASSED';
