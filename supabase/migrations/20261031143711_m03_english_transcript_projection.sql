-- Additive34: English display projection; original evidence and all old versions remain untouched.
-- Canonical33 function discovery archive SHA256:
-- 530383505920427743f61798b2260bb71d6f070e2e15afe386a3c83f0cef8384.
-- Config remains NULL. Runtime activation is separate from this migration.
set local search_path='';set local lock_timeout='5s';set local statement_timeout='45s';
do $english34_target$begin
 if current_user<>'postgres' or(current_database()<>'postgres'and not(
  current_database()~'^eps_english34_[a-f0-9]{32}$'
  and coalesce(current_setting('eps.english34_test_run',true)~'^[a-f0-9]{32}$',false)
  and current_database()='eps_english34_'||current_setting('eps.english34_test_run',true)
  and coalesce(current_setting('eps.english34_test_oid',true)~'^[1-9][0-9]{0,9}$',false)
  and exists(select 1 from pg_database where datname=current_database()
   and oid::text=current_setting('eps.english34_test_oid',true)and datdba='postgres'::regrole
   and shobj_description(oid,'pg_database')='eps-english34-owned:'||current_setting('eps.english34_test_run',true))))
 or(select array_agg(version order by version)from supabase_migrations.schema_migrations)is distinct from array[
 '20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320',
 '20261028184145','20261028222030','20261029001520','20261029003941','20261029070038','20261029090500','20261029090724','20261029094600',
 '20261029100500','20261029133455','20261029135318','20261029174841','20261029180953','20261029202629','20261029203953','20261029215218',
 '20261030002634','20261030004643','20261030013832','20261030030717','20261030111549','20261030154824','20261031010000','20261031104603','20261031130207']::text[]
 or to_regclass('eps.presentation_video_english_transcripts')is not null
 or exists(select 1 from pg_attribute where attrelid='eps.candidate_media'::regclass and attname='english_transcript_status'and not attisdropped)
 then raise exception'ENGLISH_TRANSCRIPT_EXACT33_ADDITIVE_TARGET_REQUIRED';end if;
end$english34_target$;

create function eps.english_transcript_text_valid(p_text text)returns boolean
language sql immutable security invoker set search_path=''as $$
 select coalesce(p_text is not null and length(p_text)between 1 and 200000
  and octet_length(p_text)<=800000
  and p_text!~U&'[\0001-\0008\000B\000C\000E-\001F\007F]'
  and p_text~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]',false)
$$;
alter table eps.candidate_asset_config add column english_transcript_version text
 check(english_transcript_version is null or english_transcript_version='1.0');
alter table eps.candidate_media
 add column english_transcript text,
 add column english_transcript_status text not null default'not_captured',
 add column english_transcript_source_sha256 text,
 add column english_transcript_input_hash text,
 add column english_transcript_metadata jsonb not null default'[]'::jsonb,
 add constraint candidate_media_english_transcript_check check(
  jsonb_typeof(english_transcript_metadata)='array'and jsonb_array_length(english_transcript_metadata)<=64
  and octet_length(english_transcript_metadata::text)<=131072
  and((english_transcript_status='not_captured'and english_transcript is null
    and english_transcript_source_sha256 is null and english_transcript_input_hash is null and english_transcript_metadata='[]'::jsonb)
   or(english_transcript_status='not_provided'and english_transcript is null and english_transcript_source_sha256 is null
    and english_transcript_input_hash is not null and english_transcript_input_hash~'^[a-f0-9]{64}$'
    and english_transcript_metadata='[]'::jsonb and(original_transcript is null
     or original_transcript!~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'))
   or(english_transcript_status in('available','unavailable')and english_transcript_source_sha256 is not null
    and english_transcript_source_sha256~'^[a-f0-9]{64}$'and english_transcript_source_sha256=encode(sha256(convert_to(original_transcript,'UTF8')),'hex')
    and original_transcript is not null and english_transcript_input_hash is not null and english_transcript_input_hash~'^[a-f0-9]{64}$'
    and((english_transcript_status='available'and english_transcript is not null and eps.english_transcript_text_valid(english_transcript)
      and jsonb_array_length(english_transcript_metadata)>=1)
     or(english_transcript_status='unavailable'and english_transcript is null))))) ;
alter table eps.candidate_media drop constraint candidate_media_processing_issues_check;
alter table eps.candidate_media add constraint candidate_media_processing_issues_check
 check(cardinality(processing_issues)<=6 and processing_issues<@array['NO_AUDIO','TRANSCRIPTION_FAILED','EXTRACTION_FAILED','INSUFFICIENT_FRAMES','FRAME_SELECTION_UNAVAILABLE','ENGLISH_TRANSCRIPT_UNAVAILABLE']::text[]);
alter table eps.presentation_versions add column english_transcript_version text
 check(english_transcript_version is null or english_transcript_version='1.0');
comment on column eps.presentation_versions.english_transcript_version is 'Future-only English companion cohort. Existing immutable versions retain NULL; existing whole-row immutability trigger protects this column.';

create function eps.validate_candidate_english_transcript(p_job eps.jobs,p_schema text,p_payload jsonb,p_original jsonb)returns void
language plpgsql volatile security definer set search_path=''as $$
declare item jsonb;metadata jsonb;raw_text text;status text;begin
 if p_job.input#>>'{configuration,english_transcript_version}'is null then
  perform eps.specs_stage_assert(p_schema='candidate-extraction-stage.v1'and not(p_payload?'english_transcript'),'RESULT_INVALID');return;
 end if;
 perform eps.specs_stage_assert(p_job.kind='candidate_scan'and p_job.input#>>'{configuration,english_transcript_version}'='1.0'
  and p_schema='candidate-extraction-stage.v2'and p_payload->>'source_asset_id'=p_job.input_asset_id::text
  and p_job.input_hash=eps.candidate_job_hash(p_job.input),'RESULT_INVALID');
 item:=p_payload->'english_transcript';perform eps.specs_stage_assert(eps.specs_stage_shape(item,array['status','text','source_sha256','metadata','failure_code'])
  and item->>'status'in('available','not_provided','unavailable')and jsonb_typeof(item->'metadata')='array'
  and jsonb_array_length(item->'metadata')<=64 and octet_length((item->'metadata')::text)<=131072,'RESULT_INVALID');
 status:=item->>'status';raw_text:=p_original->>'original_text';
 if p_original<>'null'::jsonb and p_original is not null then
  perform eps.specs_stage_assert(jsonb_typeof(p_original)='object'and p_original->>'source_asset_id'=p_job.input_asset_id::text,'RESULT_INVALID');
 end if;
 if raw_text is null or raw_text!~U&'[^\0009\000A\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]'then
  perform eps.specs_stage_assert(status='not_provided'and item->'text'='null'::jsonb and item->'source_sha256'='null'::jsonb
   and item->'metadata'='[]'::jsonb and item->'failure_code'='null'::jsonb,'RESULT_INVALID');return;
 end if;
 -- Existing transcribe/apply guards remain the raw-evidence validation boundary.
 -- A normalizer input refusal must not turn partial English failure into loss of
 -- otherwise accepted facts. The display validator applies only to English.
 perform eps.specs_stage_assert(status in('available','unavailable')
  and item->>'source_sha256'=encode(sha256(convert_to(raw_text,'UTF8')),'hex'),'RESULT_INVALID');
 if status='available'then
  perform eps.specs_stage_assert(jsonb_typeof(item->'text')='string'and eps.english_transcript_text_valid(item->>'text')
   and jsonb_array_length(item->'metadata')>=1 and item->'failure_code'='null'::jsonb,'RESULT_INVALID');
 else
  perform eps.specs_stage_assert(item->'text'='null'::jsonb and item->>'failure_code'='ENGLISH_TRANSCRIPT_UNAVAILABLE','RESULT_INVALID');
 end if;
 for metadata in select value from jsonb_array_elements(item->'metadata')loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(metadata,
    array['provider','task','sdk_version','requested_model','resolved_model','request_id','response_id','prompt_version','input_sha256','usage','prompt_sha256','schema_sha256'],
    array['provider','task','sdk_version','requested_model','resolved_model','request_id','response_id','prompt_version','input_sha256','usage'])
   and metadata->>'provider'='openai'and metadata->>'task'='transcript_english'and metadata->>'sdk_version'='7.45.1'
   and metadata->>'requested_model'=p_job.input#>>'{configuration,extraction_model}'
   and metadata->>'prompt_version'='transcript-english.v1'and metadata->>'input_sha256'~'^[a-f0-9]{64}$'
   and(metadata->'resolved_model'='null'::jsonb or metadata->>'resolved_model'~'^[A-Za-z0-9._:-]{1,200}$')
   and(metadata->'request_id'='null'::jsonb or metadata->>'request_id'~'^[A-Za-z0-9._:-]{1,200}$')
   and(metadata->'response_id'='null'::jsonb or metadata->>'response_id'~'^[A-Za-z0-9._:-]{1,200}$'),'RESULT_INVALID');
  if metadata?'prompt_sha256'then perform eps.specs_stage_assert(metadata->>'prompt_sha256'='5acd4200c0210c372dd280702488f1fec9094b3c2e2793aa60a83112cb2aadef','RESULT_INVALID');end if;
  if metadata?'schema_sha256'then perform eps.specs_stage_assert(metadata->>'schema_sha256'='dbf6ded402301f4c93af1525a981a98eca025f1776f08978758088222823f04f','RESULT_INVALID');end if;
  if metadata->'usage'<>'null'::jsonb then
   perform eps.specs_stage_assert(eps.specs_stage_shape(metadata->'usage',array['input_tokens','output_tokens','total_tokens']),'RESULT_INVALID');
   for status in select key from jsonb_each(metadata->'usage')loop
    perform eps.specs_stage_assert(eps.specs_stage_integer(metadata#>array['usage',status],0,9007199254740991),'RESULT_INVALID');
   end loop;
  end if;
 end loop;
end$$;

create table eps.presentation_video_english_transcripts(
 version_id uuid not null,video_asset_id uuid not null,
 candidate_media_id uuid not null references eps.candidate_media(id)on delete restrict,
 source_media_row_version bigint not null check(source_media_row_version between 1 and 9007199254740991),
 status text not null check(status in('available','not_provided','unavailable','not_captured')),
 english_text text,source_sha256 text,english_sha256 text,captured_at timestamptz not null,
 primary key(version_id,video_asset_id),
 foreign key(version_id,video_asset_id)references eps.presentation_video_transcripts(version_id,video_asset_id)on delete restrict,
 check((status='available'and english_text is not null and eps.english_transcript_text_valid(english_text)
   and source_sha256 is not null and source_sha256~'^[a-f0-9]{64}$'and english_sha256 is not null
   and english_sha256=encode(sha256(convert_to(english_text,'UTF8')),'hex'))
  or(status='unavailable'and english_text is null and english_sha256 is null and source_sha256 is not null and source_sha256~'^[a-f0-9]{64}$')
  or(status in('not_provided','not_captured')and english_text is null and english_sha256 is null and source_sha256 is null))
);
create index presentation_video_english_source on eps.presentation_video_english_transcripts(candidate_media_id,version_id);
alter table eps.presentation_video_english_transcripts enable row level security;
alter table eps.presentation_video_english_transcripts force row level security;
revoke all on eps.presentation_video_english_transcripts from public,anon,authenticated,service_role;
grant select,insert on eps.presentation_video_english_transcripts to eps_review_owner;
grant select on eps.presentation_video_english_transcripts to eps_guest_owner;
create policy presentation_video_english_internal_read on eps.presentation_video_english_transcripts for select to eps_review_owner using(
 exists(select 1 from eps.presentation_versions v where v.id=presentation_video_english_transcripts.version_id and eps.presentation_scope(v.workspace_id)));
create policy presentation_video_english_guest_read on eps.presentation_video_english_transcripts for select to eps_guest_owner using(true);
create policy presentation_video_english_capture on eps.presentation_video_english_transcripts for insert to eps_review_owner with check(
 version_id::text=current_setting('eps.presentation.english_transcript_capture_version',true)
 and exists(select 1 from eps.presentation_versions v
  join eps.presentation_video_transcripts t on t.version_id=v.id and t.video_asset_id=presentation_video_english_transcripts.video_asset_id
  join eps.candidate_media m on m.id=t.candidate_media_id and m.source_asset_id=t.video_asset_id
  where v.id=presentation_video_english_transcripts.version_id and v.status='queued'and v.english_transcript_version='1.0'
   and v.generated_by=auth.uid()and eps.presentation_scope(v.workspace_id,true)
   and presentation_video_english_transcripts.candidate_media_id=t.candidate_media_id
   and presentation_video_english_transcripts.source_media_row_version=t.source_media_row_version
   and t.source_media_row_version=m.row_version and presentation_video_english_transcripts.captured_at=v.created_at
   and presentation_video_english_transcripts.status=m.english_transcript_status
   and presentation_video_english_transcripts.english_text is not distinct from m.english_transcript
   and presentation_video_english_transcripts.source_sha256 is not distinct from m.english_transcript_source_sha256
   and(presentation_video_english_transcripts.status in('not_captured','not_provided')or presentation_video_english_transcripts.source_sha256=t.source_sha256)));
create trigger presentation_video_english_immutable before update or delete on eps.presentation_video_english_transcripts
 for each row execute function eps.presentation_immutable_row();

create function eps.capture_presentation_video_english_transcripts(p_version uuid)returns integer
language plpgsql volatile security invoker set search_path=''as $$
declare version eps.presentation_versions;raw eps.presentation_video_transcripts;media eps.candidate_media;prior_context text;captured integer:=0;
begin
 select * into version from eps.presentation_versions where id=p_version;
 if not found or version.status<>'queued'or version.english_transcript_version is distinct from'1.0'
  or version.generated_by is distinct from auth.uid()or not eps.presentation_scope(version.workspace_id,true)
 then perform eps.fail('IMMUTABLE_VERSION','English companions require a fresh authorized generation.',409);end if;
 if exists(select 1 from eps.presentation_video_english_transcripts where version_id=p_version)
 then perform eps.fail('IMMUTABLE_VERSION','English companions are already captured.',409);end if;
 prior_context:=current_setting('eps.presentation.english_transcript_capture_version',true);
 perform set_config('eps.presentation.english_transcript_capture_version',p_version::text,true);
 for raw in select * from eps.presentation_video_transcripts where version_id=p_version order by video_asset_id loop
  select * into media from eps.candidate_media where id=raw.candidate_media_id and source_asset_id=raw.video_asset_id for share;
  if not found or media.row_version<>raw.source_media_row_version
   or(media.english_transcript_status in('available','unavailable')and media.english_transcript_source_sha256 is distinct from raw.source_sha256)
   or(media.english_transcript_status='not_provided'and raw.status<>'not_provided')
  then perform eps.fail('SNAPSHOT_INVALID','The selected English transcript cannot be captured.',503);end if;
  insert into eps.presentation_video_english_transcripts(version_id,video_asset_id,candidate_media_id,source_media_row_version,status,english_text,source_sha256,english_sha256,captured_at)
   values(p_version,raw.video_asset_id,media.id,raw.source_media_row_version,media.english_transcript_status,media.english_transcript,
    media.english_transcript_source_sha256,case when media.english_transcript_status='available'then encode(sha256(convert_to(media.english_transcript,'UTF8')),'hex')end,version.created_at);
  captured:=captured+1;
 end loop;
 if captured<>(select count(*)from eps.presentation_version_assets where version_id=p_version and asset_kind='candidate_video')
 then perform eps.fail('SNAPSHOT_INVALID','English transcript capture is incomplete.',503);end if;
 perform set_config('eps.presentation.english_transcript_capture_version',coalesce(prior_context,''),true);return captured;
end$$;
create function eps.presentation_video_english_transcript(p_version uuid,p_asset uuid)returns jsonb
language plpgsql stable security invoker set search_path=''as $$
declare item eps.presentation_video_english_transcripts;begin
 if not exists(select 1 from eps.presentation_version_assets where version_id=p_version and asset_id=p_asset and asset_kind='candidate_video')
 then perform eps.fail('RESOURCE_NOT_FOUND','Fixed-version original video not found.',404);end if;
 select * into item from eps.presentation_video_english_transcripts where version_id=p_version and video_asset_id=p_asset;
 if not found then return jsonb_build_object('english_text',null,'english_status','not_captured','english_sha256',null);end if;
 return jsonb_build_object('english_text',item.english_text,'english_status',item.status,'english_sha256',item.english_sha256);
end$$;

-- New helpers remain private. Existing public/guest scope checks and owners stay.
do $english34_owner_transfer$declare prior_acl aclitem[];begin
 select nspacl into prior_acl from pg_namespace where nspname='eps';
 if has_schema_privilege('eps_candidate_stage_owner','eps','CREATE')or has_schema_privilege('eps_review_owner','eps','CREATE')
 then raise exception'ENGLISH_TRANSCRIPT_EXISTING_PRIVATE_OWNER_CREATE_DENIED_REQUIRED';end if;
grant create on schema eps to eps_candidate_stage_owner,eps_review_owner;
alter function eps.english_transcript_text_valid(text)owner to eps_candidate_stage_owner;
alter function eps.validate_candidate_english_transcript(eps.jobs,text,jsonb,jsonb)owner to eps_candidate_stage_owner;
alter function eps.capture_presentation_video_english_transcripts(uuid)owner to eps_review_owner;
alter function eps.presentation_video_english_transcript(uuid,uuid)owner to eps_review_owner;
revoke create on schema eps from eps_candidate_stage_owner,eps_review_owner;
 if(select nspacl from pg_namespace where nspname='eps')is distinct from prior_acl
 then raise exception'ENGLISH_TRANSCRIPT_EPS_SCHEMA_ACL_CHANGED';end if;
end$english34_owner_transfer$;
revoke all on function eps.english_transcript_text_valid(text),eps.validate_candidate_english_transcript(eps.jobs,text,jsonb,jsonb),
 eps.capture_presentation_video_english_transcripts(uuid),eps.presentation_video_english_transcript(uuid,uuid)from public,anon,authenticated,service_role;
grant execute on function eps.english_transcript_text_valid(text)to eps_candidate_apply_owner,eps_cast_owner,eps_review_owner;
grant execute on function eps.validate_candidate_english_transcript(eps.jobs,text,jsonb,jsonb)to eps_candidate_apply_owner;
grant execute on function eps.presentation_video_english_transcript(uuid,uuid)to eps_guest_owner;

-- Exact-source guarded port patches follow. No activation/config update, backfill,
-- raw transcript rewrite, snapshot/manifest/PDF update or old companion mutation.
-- BEGIN EXACT CANONICAL33 PORT PATCHES
do $english34_ports$declare routine regprocedure;source text;definition text;original_source text;old_text text;new_text text;before_attributes jsonb;begin
 -- eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)
 routine:='eps.apply_candidate_scan(uuid,uuid,text,text,jsonb)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc'into source,definition,before_attributes from pg_proc p where oid=routine;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'4dcd22600e0024f57e3f1520e6976beb043fc201ca4f7c2043a954fd155f4874' or before_attributes->>'proowner' is distinct from('eps_candidate_apply_owner'::regrole::oid)::text
 or before_attributes->'prosecdef'is distinct from'true'::jsonb or before_attributes->'proconfig'is distinct from '["search_path=\"\""]'::jsonb
 or(select proacl::text from pg_proc where oid=routine)is distinct from '{eps_candidate_apply_owner=X/eps_candidate_apply_owner,eps_candidate_stage_owner=X/eps_candidate_apply_owner}'
 then raise exception'ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED';end if;
 old_text:=$old34_0$extracted.result_schema='candidate-extraction-stage.v1'$old34_0$;new_text:=$new34_0$extracted.result_schema=case when job.input#>>'{configuration,english_transcript_version}'='1.0'then'candidate-extraction-stage.v2'else'candidate-extraction-stage.v1'end$new34_0$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 old_text:=$old34_1$ transcript:=transcribed.payload->'original_transcript'; extraction:=extracted.payload->'result';$old34_1$;new_text:=$new34_1$ transcript:=transcribed.payload->'original_transcript'; extraction:=extracted.payload->'result';
 perform eps.validate_candidate_english_transcript(job,extracted.result_schema,extracted.payload,transcript);$new34_1$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 old_text:=$old34_2$ if selected.payload->>'selection_method'='manual_required' then issues:=array_append(issues,'FRAME_SELECTION_UNAVAILABLE');end if;$old34_2$;new_text:=$new34_2$ if selected.payload->>'selection_method'='manual_required' then issues:=array_append(issues,'FRAME_SELECTION_UNAVAILABLE');end if;
 if extracted.payload#>>'{english_transcript,status}'='unavailable'then issues:=array_append(issues,'ENGLISH_TRANSCRIPT_UNAVAILABLE');end if;$new34_2$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 old_text:=$old34_3$insert into eps.candidate_media(id,candidate_id,source_asset_id,transcript_asset_id,original_transcript,transcript_segments,languages,extraction,source_job_id,selected_frame_asset_ids,processing_issues)$old34_3$;new_text:=$new34_3$insert into eps.candidate_media(id,candidate_id,source_asset_id,transcript_asset_id,original_transcript,transcript_segments,languages,extraction,source_job_id,selected_frame_asset_ids,processing_issues,english_transcript,english_transcript_status,english_transcript_source_sha256,english_transcript_input_hash,english_transcript_metadata)$new34_3$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 old_text:=$old34_4$nullif(extraction,'null'::jsonb),job.id,chosen_frames,issues);$old34_4$;new_text:=$new34_4$nullif(extraction,'null'::jsonb),job.id,chosen_frames,issues,extracted.payload#>>'{english_transcript,text}',coalesce(extracted.payload#>>'{english_transcript,status}','not_captured'),extracted.payload#>>'{english_transcript,source_sha256}',case when job.input#>>'{configuration,english_transcript_version}'='1.0'then job.input_hash end,coalesce(extracted.payload#>'{english_transcript,metadata}','[]'::jsonb));$new34_4$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'ffd7c9fb5c05923c1a61a6a2a8170daca99dba308ab5b804d65d69cd205287b2'then raise exception'ENGLISH_TRANSCRIPT_COMPILED_PORT_REQUIRED';end if;
 select replace(prosrc,E'\r\n',E'\n')into original_source from pg_proc where oid=routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source)then raise exception'ENGLISH_TRANSCRIPT_DEFINITION_SEAM_CHANGED';end if;
 execute replace(definition,original_source,source);
 if(select to_jsonb(p)-'prosrc'from pg_proc p where oid=routine)is distinct from before_attributes then raise exception'ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED';end if;
 -- eps.candidate_validate_stage(eps.jobs,text,jsonb)
 routine:='eps.candidate_validate_stage(eps.jobs,text,jsonb)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc'into source,definition,before_attributes from pg_proc p where oid=routine;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'0a219c30d21030638fdf0a2647b73bf98e9850b4c4c860568f5fdf1826a9820a' or before_attributes->>'proowner' is distinct from('eps_candidate_stage_owner'::regrole::oid)::text
 or before_attributes->'prosecdef'is distinct from'true'::jsonb or before_attributes->'proconfig'is distinct from '["search_path=\"\""]'::jsonb
 or(select proacl::text from pg_proc where oid=routine)is distinct from '{eps_candidate_stage_owner=X/eps_candidate_stage_owner}'
 then raise exception'ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED';end if;
 old_text:=$old34_0$p_schema='candidate-extraction-stage.v1' and eps.specs_stage_shape(p_payload,array['source_asset_id','result','metadata','manual_profile_required','provider_metadata','missing_extraction_reason','provider_error_code'],array['source_asset_id','result'])$old34_0$;new_text:=$new34_0$p_schema=case when p_job.input#>>'{configuration,english_transcript_version}'='1.0'then'candidate-extraction-stage.v2'else'candidate-extraction-stage.v1'end and eps.specs_stage_shape(p_payload,array['source_asset_id','result','metadata','manual_profile_required','provider_metadata','missing_extraction_reason','provider_error_code']||case when p_job.input#>>'{configuration,english_transcript_version}'='1.0'then array['english_transcript']else'{}'::text[]end,array['source_asset_id','result']||case when p_job.input#>>'{configuration,english_transcript_version}'='1.0'then array['english_transcript']else'{}'::text[]end)$new34_0$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 old_text:=$old34_1$  select * into strict transcribed from eps.candidate_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='transcribe_candidate';$old34_1$;new_text:=$new34_1$  select * into strict transcribed from eps.candidate_stage_payloads where job_id=p_job.id and input_hash=p_job.input_hash and stage='transcribe_candidate';
  perform eps.validate_candidate_english_transcript(p_job,p_schema,p_payload,transcribed.payload->'original_transcript');$new34_1$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'eddd5c3281d525717a929191d6ff315bf7d384448e96401ecd8e9f557bf72c66'then raise exception'ENGLISH_TRANSCRIPT_COMPILED_PORT_REQUIRED';end if;
 select replace(prosrc,E'\r\n',E'\n')into original_source from pg_proc where oid=routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source)then raise exception'ENGLISH_TRANSCRIPT_DEFINITION_SEAM_CHANGED';end if;
 execute replace(definition,original_source,source);
 if(select to_jsonb(p)-'prosrc'from pg_proc p where oid=routine)is distinct from before_attributes then raise exception'ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED';end if;
 -- eps.capture_presentation_video_transcripts(uuid)
 routine:='eps.capture_presentation_video_transcripts(uuid)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc'into source,definition,before_attributes from pg_proc p where oid=routine;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'c6bb3252211990359ef879356fc81fdaa9ba49bf5fbcb8bdc8483091a67538d3' or before_attributes->>'proowner' is distinct from('eps_review_owner'::regrole::oid)::text
 or before_attributes->'prosecdef'is distinct from'false'::jsonb or before_attributes->'proconfig'is distinct from '["search_path=\"\""]'::jsonb
 or(select proacl::text from pg_proc where oid=routine)is distinct from '{eps_review_owner=X/eps_review_owner}'
 then raise exception'ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED';end if;
 old_text:=$old34_0$ perform set_config('eps.presentation.transcript_capture_version',coalesce(prior_context,''),true);$old34_0$;new_text:=$new34_0$ if version.english_transcript_version='1.0'then perform eps.capture_presentation_video_english_transcripts(version.id);end if;
 perform set_config('eps.presentation.transcript_capture_version',coalesce(prior_context,''),true);$new34_0$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187'then raise exception'ENGLISH_TRANSCRIPT_COMPILED_PORT_REQUIRED';end if;
 select replace(prosrc,E'\r\n',E'\n')into original_source from pg_proc where oid=routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source)then raise exception'ENGLISH_TRANSCRIPT_DEFINITION_SEAM_CHANGED';end if;
 execute replace(definition,original_source,source);
 if(select to_jsonb(p)-'prosrc'from pg_proc p where oid=routine)is distinct from before_attributes then raise exception'ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED';end if;
 -- eps.cast_media_dto(uuid)
 routine:='eps.cast_media_dto(uuid)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc'into source,definition,before_attributes from pg_proc p where oid=routine;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'f6399ea4ba49e23ec33182a7cb6d11f2549c670f1ad8dd5d3000fb93a46c228b' or before_attributes->>'proowner' is distinct from('eps_cast_owner'::regrole::oid)::text
 or before_attributes->'prosecdef'is distinct from'false'::jsonb or before_attributes->'proconfig'is distinct from '["search_path=\"\""]'::jsonb
 or(select proacl::text from pg_proc where oid=routine)is distinct from '{eps_cast_owner=X/eps_cast_owner}'
 then raise exception'ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED';end if;
 old_text:=$old34_0$'processing_issues',to_jsonb(media.processing_issues),'row_version',media.row_version)$old34_0$;new_text:=$new34_0$'processing_issues',to_jsonb(media.processing_issues),'english_transcript',media.english_transcript,'english_transcript_status',media.english_transcript_status,'row_version',media.row_version)$new34_0$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'8b8293ffd22cc0c81647dc3cb1c9429970ab1b4fca891c6dfe2f08002bd23f7e'then raise exception'ENGLISH_TRANSCRIPT_COMPILED_PORT_REQUIRED';end if;
 select replace(prosrc,E'\r\n',E'\n')into original_source from pg_proc where oid=routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source)then raise exception'ENGLISH_TRANSCRIPT_DEFINITION_SEAM_CHANGED';end if;
 execute replace(definition,original_source,source);
 if(select to_jsonb(p)-'prosrc'from pg_proc p where oid=routine)is distinct from before_attributes then raise exception'ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED';end if;
 -- eps.enqueue_candidate_scan(uuid)
 routine:='eps.enqueue_candidate_scan(uuid)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc'into source,definition,before_attributes from pg_proc p where oid=routine;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'0a9de1f27007935f44caf862832464bfbaa1ab88e06e4864fa8b06126cb4fc7e' or before_attributes->>'proowner' is distinct from('eps_candidate_upload_owner'::regrole::oid)::text
 or before_attributes->'prosecdef'is distinct from'true'::jsonb or before_attributes->'proconfig'is distinct from '["search_path=\"\""]'::jsonb
 or(select proacl::text from pg_proc where oid=routine)is distinct from '{eps_candidate_upload_owner=X/eps_candidate_upload_owner}'
 then raise exception'ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED';end if;
 old_text:=$old34_0$'schema_version',config.schema_version,'media_implementation_version',config.media_implementation_version));$old34_0$;new_text:=$new34_0$'schema_version',config.schema_version,'media_implementation_version',config.media_implementation_version)||case when config.english_transcript_version is null then '{}'::jsonb else jsonb_build_object('english_transcript_version',config.english_transcript_version)end);$new34_0$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'c317d00e8b3e294ea849969c67abbd33e92dba4f58c94bdd378588c3fc605d5f'then raise exception'ENGLISH_TRANSCRIPT_COMPILED_PORT_REQUIRED';end if;
 select replace(prosrc,E'\r\n',E'\n')into original_source from pg_proc where oid=routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source)then raise exception'ENGLISH_TRANSCRIPT_DEFINITION_SEAM_CHANGED';end if;
 execute replace(definition,original_source,source);
 if(select to_jsonb(p)-'prosrc'from pg_proc p where oid=routine)is distinct from before_attributes then raise exception'ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED';end if;
 -- public.eps_generate_version(uuid,jsonb,text)
 routine:='public.eps_generate_version(uuid,jsonb,text)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc'into source,definition,before_attributes from pg_proc p where oid=routine;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'24ca35b55309fb8522b0ee04b65e7eee231204a2cf9d334a3cf2318703d8c68d' or before_attributes->>'proowner' is distinct from('eps_review_owner'::regrole::oid)::text
 or before_attributes->'prosecdef'is distinct from'true'::jsonb or before_attributes->'proconfig'is distinct from '["search_path=\"\""]'::jsonb
 or(select proacl::text from pg_proc where oid=routine)is distinct from '{eps_review_owner=X/eps_review_owner,authenticated=X/eps_review_owner}'
 then raise exception'ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED';end if;
 old_text:=$old34_0$generation_note,created_at)$old34_0$;new_text:=$new34_0$generation_note,created_at,english_transcript_version)$new34_0$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 old_text:=$old34_1$job_id,auth.uid(),note,created_at);$old34_1$;new_text:=$new34_1$job_id,auth.uid(),note,created_at,'1.0');$new34_1$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08'then raise exception'ENGLISH_TRANSCRIPT_COMPILED_PORT_REQUIRED';end if;
 select replace(prosrc,E'\r\n',E'\n')into original_source from pg_proc where oid=routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source)then raise exception'ENGLISH_TRANSCRIPT_DEFINITION_SEAM_CHANGED';end if;
 execute replace(definition,original_source,source);
 if(select to_jsonb(p)-'prosrc'from pg_proc p where oid=routine)is distinct from before_attributes then raise exception'ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED';end if;
 -- eps.get_candidate_stage_input(uuid,uuid,text)
 routine:='eps.get_candidate_stage_input(uuid,uuid,text)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc'into source,definition,before_attributes from pg_proc p where oid=routine;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'242f9e3d9f7ecd79300a3e844ffec8e2e836000558811714f506051629f2d983' or before_attributes->>'proowner' is distinct from('eps_candidate_stage_owner'::regrole::oid)::text
 or before_attributes->'prosecdef'is distinct from'true'::jsonb or before_attributes->'proconfig'is distinct from '["search_path=\"\""]'::jsonb
 or(select proacl::text from pg_proc where oid=routine)is distinct from '{eps_candidate_stage_owner=X/eps_candidate_stage_owner,eps_specs_stage_owner=X/eps_candidate_stage_owner}'
 then raise exception'ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED';end if;
 old_text:=$old34_0$'prompt_version','candidate_extract_v1','result_schema_version','1.0'),$old34_0$;new_text:=$new34_0$'prompt_version','candidate_extract_v1','result_schema_version','1.0')||case when job.input#>>'{configuration,english_transcript_version}'='1.0'then jsonb_build_object('english_transcript_version','1.0')else'{}'::jsonb end,$new34_0$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'848c8b2dccc8585b57fe85261886507fc153e2f29dbb1ff29364b89c5eb80b3d'then raise exception'ENGLISH_TRANSCRIPT_COMPILED_PORT_REQUIRED';end if;
 select replace(prosrc,E'\r\n',E'\n')into original_source from pg_proc where oid=routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source)then raise exception'ENGLISH_TRANSCRIPT_DEFINITION_SEAM_CHANGED';end if;
 execute replace(definition,original_source,source);
 if(select to_jsonb(p)-'prosrc'from pg_proc p where oid=routine)is distinct from before_attributes then raise exception'ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED';end if;
 -- eps.presentation_video_transcript(uuid,uuid)
 routine:='eps.presentation_video_transcript(uuid,uuid)'::regprocedure;
 select replace(prosrc,E'\r\n',E'\n'),replace(pg_get_functiondef(oid),E'\r\n',E'\n'),to_jsonb(p)-'prosrc'into source,definition,before_attributes from pg_proc p where oid=routine;
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'325cbcb4ee88da51a6402294a4a9dc21440243302e91a9e516e334c2b7b93df3' or before_attributes->>'proowner' is distinct from('eps_review_owner'::regrole::oid)::text
 or before_attributes->'prosecdef'is distinct from'false'::jsonb or before_attributes->'proconfig'is distinct from '["search_path=\"\""]'::jsonb
 or(select proacl::text from pg_proc where oid=routine)is distinct from '{eps_review_owner=X/eps_review_owner,eps_guest_owner=X/eps_review_owner}'
 then raise exception'ENGLISH_TRANSCRIPT_EXACT33_PORT_REQUIRED';end if;
 old_text:=$old34_0$'original_text',null,'languages','[]'::jsonb,'source_kind','source_transcript','source_sha256',null);end if;$old34_0$;new_text:=$new34_0$'original_text',null,'languages','[]'::jsonb,'source_kind','source_transcript','source_sha256',null)||eps.presentation_video_english_transcript(p_version,p_asset);end if;$new34_0$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 old_text:=$old34_1$'original_text',item.original_text,'languages',to_jsonb(item.languages),'source_kind','source_transcript','source_sha256',item.source_sha256);$old34_1$;new_text:=$new34_1$'original_text',item.original_text,'languages',to_jsonb(item.languages),'source_kind','source_transcript','source_sha256',item.source_sha256)||eps.presentation_video_english_transcript(p_version,p_asset);$new34_1$;
 if length(source)-length(replace(source,old_text,''))<>length(old_text)then raise exception'ENGLISH_TRANSCRIPT_PORT_SEAM_CHANGED';end if;source:=replace(source,old_text,new_text);
 if encode(sha256(convert_to(source,'UTF8')),'hex')<>'10cbe953cbbcdd8cdb7ffee69a8f736c3c8e12d65fbbdb6d31c2f69039933e1b'then raise exception'ENGLISH_TRANSCRIPT_COMPILED_PORT_REQUIRED';end if;
 select replace(prosrc,E'\r\n',E'\n')into original_source from pg_proc where oid=routine;
 if length(definition)-length(replace(definition,original_source,''))<>length(original_source)then raise exception'ENGLISH_TRANSCRIPT_DEFINITION_SEAM_CHANGED';end if;
 execute replace(definition,original_source,source);
 if(select to_jsonb(p)-'prosrc'from pg_proc p where oid=routine)is distinct from before_attributes then raise exception'ENGLISH_TRANSCRIPT_PORT_AUTHORITY_CHANGED';end if;
end$english34_ports$;
