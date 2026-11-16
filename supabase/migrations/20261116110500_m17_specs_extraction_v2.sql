-- m17 specs extraction v2 (spec_extract_v2.0.0, result schema 2.0). Additive and guarded.
--
-- The stage validators accept a second reviewed extraction contract next to v1:
--   * eps.specs_stage_configuration  accepts (spec_extract_v1.0.0, '1.0') or (spec_extract_v2.0.0, '2.0');
--   * eps.specs_stage_extract / eps.specs_document_extract keep the exact v1 checks and, for schema_version
--     '2.0', additionally validate scenes[], role occurrences[] and same_character_as (shapes, key references,
--     source evidence through the existing reference validators);
--   * eps.specs_stage_metadata keeps the exact v1 pins and adds the v2 prompt/schema/provider-schema hashes.
-- The stage envelope name stays specs-extraction-stage.v1, so eps.record_job_event is unchanged.
-- v1 behaviour is byte-for-byte the same check set: every v2 branch is only reachable with schema_version '2.0'.
-- Owner (eps_specs_stage_owner), grants, security invoker, IMMUTABLE and search_path='' are preserved by
-- CREATE OR REPLACE and re-asserted at the end. eps.specs_stage_apply is not touched here, and
-- eps.specs_pipeline_config is NOT switched (see the note at the end of this file).
--
-- v2 semantics enforced here (mirrors packages/integrations/src/specs-schema.ts validateSpecsExtractionV2):
--   scenes[]: {scene_key non-blank unique, scene_number|null, title non-blank, sequence_label|null, setting|null,
--              notes|null, requirements string[], evidence >= 1}
--   roles[].occurrences[]: {scene_key referencing scenes[].scene_key, unique per role, display_title|null, evidence >= 1}
--   roles[].same_character_as: null | {source_role_key = another role's key (never itself), evidence >= 1}; when set,
--              the role carries a clarification with field_path 'same_character_as' (the worker adapter adds it).
do $$
declare routine text; begin
  foreach routine in array array['eps.specs_stage_configuration(jsonb)','eps.specs_stage_extract(jsonb,jsonb)',
    'eps.specs_document_extract(jsonb,jsonb,uuid)','eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)',
    'eps.specs_stage_reference(jsonb,jsonb)','eps.specs_document_reference(jsonb,jsonb,uuid)',
    'eps.specs_stage_clarifications(jsonb,jsonb)','eps.specs_document_clarifications(jsonb,jsonb,uuid)',
    'eps.specs_stage_shape(jsonb,text[],text[])','eps.specs_stage_text(jsonb,boolean)','eps.specs_stage_strings(jsonb)',
    'eps.specs_stage_nonblank(text)','eps.specs_stage_integer(jsonb,bigint,bigint)','eps.specs_stage_assert(boolean,text)'] loop
    if to_regprocedure(routine) is null then raise exception 'M17_SPECS_V2_PREREQUISITES_MISSING: %', routine; end if;
  end loop;
  if (select count(*) from pg_proc p where p.oid in(to_regprocedure('eps.specs_stage_configuration(jsonb)'),to_regprocedure('eps.specs_stage_extract(jsonb,jsonb)'),
      to_regprocedure('eps.specs_document_extract(jsonb,jsonb,uuid)'),to_regprocedure('eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)'))
      and pg_get_userbyid(p.proowner)='eps_specs_stage_owner')<>4 then
    raise exception 'M17_SPECS_V2_PREREQUISITES_MISSING: unexpected validator owner';
  end if;
  if position('ab03fd026edb3d139fd93fdd51cb475474d6c4e3c8f6395b65014574e7e29eee' in pg_get_functiondef('eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)'::regprocedure))=0 then
    raise exception 'M17_SPECS_V2_PREREQUISITES_MISSING: v1 metadata pins not found';
  end if;
  if position('spec_extract_v2.0.0' in pg_get_functiondef('eps.specs_stage_configuration(jsonb)'::regprocedure))>0 then
    raise exception 'M17_SPECS_V2_ALREADY_APPLIED';
  end if;
  -- The four validators below are replaced whole: only the exact reviewed pre-v2 bodies (CRLF-normalised) qualify.
  if exists(select 1 from (values
      ('eps.specs_stage_configuration(jsonb)','7310e5be3cdeb6744621fbfffcfefe2f8a31a534c9b979800befd7b70fc7f877'),
      ('eps.specs_stage_extract(jsonb,jsonb)','85be350115863cd541ce373f71959f0ac07389c07c5b95e768797fe01dc1e8dc'),
      ('eps.specs_document_extract(jsonb,jsonb,uuid)','de252b1f2ee803feca3b45c95aa49bd207422fcfbee41476075243d0c26ebe98'),
      ('eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)','0503ca79216d543e10de6708c6421b7f3c8b1771800e73c1d296a2d83e8df438')) v(signature,expected)
    where encode(sha256(convert_to(replace((select prosrc from pg_proc where oid=v.signature::regprocedure),E'\r\n',E'\n'),'UTF8')),'hex') is distinct from v.expected) then
    raise exception 'M17_SPECS_V2_PREIMAGE_REQUIRED';
  end if;
end $$;

create or replace function eps.specs_stage_configuration(p_configuration jsonb) returns void language plpgsql immutable security invoker set search_path='' as $function$ begin
 -- Reviewed installed worker/prompt/schema manifest, not caller-selected hashes. Only reviewed prompt/result pairs.
 if not coalesce(eps.specs_stage_shape(p_configuration,array['document_preparation_version','model_version','prompt_version','result_schema_version'],array['document_preparation_version','model_version','prompt_version','result_schema_version'])
  and p_configuration->>'document_preparation_version'='document-preparation.v1'
  and (p_configuration->>'prompt_version'='spec_extract_v1.0.0' and p_configuration->>'result_schema_version'='1.0'
   or p_configuration->>'prompt_version'='spec_extract_v2.0.0' and p_configuration->>'result_schema_version'='2.0')
  and jsonb_typeof(p_configuration->'model_version')='string' and (p_configuration->>'model_version')~'^[A-Za-z0-9._:-]{1,200}$',false)
 then perform eps.fail('FEATURE_NOT_IMPLEMENTED','This processing configuration is not available.',503); end if;
end $function$;

create or replace function eps.specs_stage_extract(p_value jsonb, p_paragraphs jsonb) returns void language plpgsql immutable security invoker set search_path='' as $function$
declare role_value jsonb; requirements jsonb; reference jsonb; field text; scene_value jsonb; occurrence jsonb; link jsonb;
 v2 boolean:=coalesce(jsonb_typeof(p_value)='object' and p_value->>'schema_version'='2.0',false);
 top_keys text[]:=array['schema_version','source_asset_id','source_language_codes','roles','general_instructions','clarifications']||case when v2 then array['scenes'] else array[]::text[] end;
 role_keys text[]:=array['source_role_key','name','headcount','category','requirements','evidence','clarifications']||case when v2 then array['occurrences','same_character_as'] else array[]::text[] end;
begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,top_keys,top_keys)
  and p_value->>'schema_version' in('1.0','2.0') and p_value->'source_asset_id'='null'::jsonb and eps.specs_stage_strings(p_value->'source_language_codes')
  and jsonb_typeof(p_value->'roles')='array' and eps.specs_stage_text(p_value->'general_instructions',true),'RESULT_INVALID');
 perform eps.specs_stage_clarifications(p_value->'clarifications',p_paragraphs);
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_value->'roles') entries(value) group by entries.value->>'source_role_key' having count(*)>1),'RESULT_INVALID');
 for role_value in select value from jsonb_array_elements(p_value->'roles') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(role_value,role_keys,role_keys)
   and eps.specs_stage_text(role_value->'source_role_key') and length(role_value->>'source_role_key')>0 and eps.specs_stage_text(role_value->'name',true)
   and eps.specs_stage_text(role_value->'category',true) and (role_value->'headcount'='null'::jsonb or eps.specs_stage_integer(role_value->'headcount',1))
   and jsonb_typeof(role_value->'evidence')='array'
   and eps.specs_stage_nonblank(role_value->>'source_role_key'),'RESULT_INVALID');
  perform eps.specs_stage_assert(jsonb_array_length(role_value->'evidence')>0,'RESULT_INVALID');
  requirements:=role_value->'requirements';
  perform eps.specs_stage_assert(eps.specs_stage_shape(requirements,array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions'],array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions']),'RESULT_INVALID');
  foreach field in array array['age_range','gender_requirement','appearance_performance','location','availability_requirements','other_instructions'] loop
   perform eps.specs_stage_assert(eps.specs_stage_text(requirements->field,true),'RESULT_INVALID'); end loop;
  foreach field in array array['languages','accents','skills','scene_references','shoot_dates'] loop
   perform eps.specs_stage_assert(eps.specs_stage_strings(requirements->field),'RESULT_INVALID'); end loop;
  for reference in select value from jsonb_array_elements(role_value->'evidence') loop perform eps.specs_stage_reference(reference,p_paragraphs); end loop;
  perform eps.specs_stage_clarifications(role_value->'clarifications',p_paragraphs);
 end loop;
 if not v2 then return; end if;
 -- v2: scenes, occurrences and explicit same-character links.
 perform eps.specs_stage_assert(jsonb_typeof(p_value->'scenes')='array','RESULT_INVALID');
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_value->'scenes') entries(value) group by entries.value->>'scene_key' having count(*)>1),'RESULT_INVALID');
 for scene_value in select value from jsonb_array_elements(p_value->'scenes') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(scene_value,array['scene_key','scene_number','title','sequence_label','setting','notes','requirements','evidence'],array['scene_key','scene_number','title','sequence_label','setting','notes','requirements','evidence'])
   and eps.specs_stage_text(scene_value->'scene_key') and eps.specs_stage_nonblank(scene_value->>'scene_key')
   and eps.specs_stage_text(scene_value->'title') and eps.specs_stage_nonblank(scene_value->>'title')
   and eps.specs_stage_text(scene_value->'scene_number',true) and eps.specs_stage_text(scene_value->'sequence_label',true)
   and eps.specs_stage_text(scene_value->'setting',true) and eps.specs_stage_text(scene_value->'notes',true)
   and eps.specs_stage_strings(scene_value->'requirements')
   and jsonb_typeof(scene_value->'evidence')='array' and jsonb_array_length(scene_value->'evidence')>0,'RESULT_INVALID');
  for reference in select value from jsonb_array_elements(scene_value->'evidence') loop perform eps.specs_stage_reference(reference,p_paragraphs); end loop;
 end loop;
 for role_value in select value from jsonb_array_elements(p_value->'roles') loop
  perform eps.specs_stage_assert(jsonb_typeof(role_value->'occurrences')='array'
   and not exists(select 1 from jsonb_array_elements(role_value->'occurrences') entries(value) group by entries.value->>'scene_key' having count(*)>1),'RESULT_INVALID');
  for occurrence in select value from jsonb_array_elements(role_value->'occurrences') loop
   perform eps.specs_stage_assert(eps.specs_stage_shape(occurrence,array['scene_key','display_title','evidence'],array['scene_key','display_title','evidence'])
    and eps.specs_stage_text(occurrence->'scene_key')
    and exists(select 1 from jsonb_array_elements(p_value->'scenes') scenes(value) where scenes.value->'scene_key'=occurrence->'scene_key')
    and eps.specs_stage_text(occurrence->'display_title',true)
    and jsonb_typeof(occurrence->'evidence')='array' and jsonb_array_length(occurrence->'evidence')>0,'RESULT_INVALID');
   for reference in select value from jsonb_array_elements(occurrence->'evidence') loop perform eps.specs_stage_reference(reference,p_paragraphs); end loop;
  end loop;
  link:=role_value->'same_character_as';
  if link<>'null'::jsonb then
   perform eps.specs_stage_assert(eps.specs_stage_shape(link,array['source_role_key','evidence'],array['source_role_key','evidence'])
    and eps.specs_stage_text(link->'source_role_key') and link->'source_role_key'<>role_value->'source_role_key'
    and exists(select 1 from jsonb_array_elements(p_value->'roles') roles(value) where roles.value->'source_role_key'=link->'source_role_key')
    and jsonb_typeof(link->'evidence')='array' and jsonb_array_length(link->'evidence')>0
    and exists(select 1 from jsonb_array_elements(role_value->'clarifications') entries(value) where entries.value->>'field_path'='same_character_as'),'RESULT_INVALID');
   for reference in select value from jsonb_array_elements(link->'evidence') loop perform eps.specs_stage_reference(reference,p_paragraphs); end loop;
  end if;
 end loop;
end $function$;

create or replace function eps.specs_document_extract(p_value jsonb, p_paragraphs jsonb, p_source_asset uuid) returns void language plpgsql immutable security invoker set search_path='' as $function$
declare role_value jsonb; requirements jsonb; reference jsonb; field text; scene_value jsonb; occurrence jsonb; link jsonb;
 v2 boolean:=coalesce(jsonb_typeof(p_value)='object' and p_value->>'schema_version'='2.0',false);
 top_keys text[]:=array['schema_version','source_asset_id','source_language_codes','roles','general_instructions','clarifications']||case when v2 then array['scenes'] else array[]::text[] end;
 role_keys text[]:=array['source_role_key','name','headcount','category','requirements','evidence','clarifications']||case when v2 then array['occurrences','same_character_as'] else array[]::text[] end;
begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,top_keys,top_keys)
  and p_value->>'schema_version' in('1.0','2.0') and p_source_asset is not null and p_value->'source_asset_id'=to_jsonb(p_source_asset) and eps.specs_stage_strings(p_value->'source_language_codes')
  and jsonb_typeof(p_value->'roles')='array' and eps.specs_stage_text(p_value->'general_instructions',true),'RESULT_INVALID');
 perform eps.specs_document_clarifications(p_value->'clarifications',p_paragraphs,p_source_asset);
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_value->'roles') entries(value) group by entries.value->>'source_role_key' having count(*)>1),'RESULT_INVALID');
 for role_value in select value from jsonb_array_elements(p_value->'roles') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(role_value,role_keys,role_keys)
   and eps.specs_stage_text(role_value->'source_role_key') and length(role_value->>'source_role_key')>0 and eps.specs_stage_text(role_value->'name',true)
   and eps.specs_stage_text(role_value->'category',true) and (role_value->'headcount'='null'::jsonb or eps.specs_stage_integer(role_value->'headcount',1))
   and jsonb_typeof(role_value->'evidence')='array'
   and eps.specs_stage_nonblank(role_value->>'source_role_key'),'RESULT_INVALID');
  perform eps.specs_stage_assert(jsonb_array_length(role_value->'evidence')>0,'RESULT_INVALID');
  requirements:=role_value->'requirements';
  perform eps.specs_stage_assert(eps.specs_stage_shape(requirements,array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions'],array['age_range','gender_requirement','appearance_performance','languages','accents','skills','scene_references','shoot_dates','location','availability_requirements','other_instructions']),'RESULT_INVALID');
  foreach field in array array['age_range','gender_requirement','appearance_performance','location','availability_requirements','other_instructions'] loop
   perform eps.specs_stage_assert(eps.specs_stage_text(requirements->field,true),'RESULT_INVALID'); end loop;
  foreach field in array array['languages','accents','skills','scene_references','shoot_dates'] loop
   perform eps.specs_stage_assert(eps.specs_stage_strings(requirements->field),'RESULT_INVALID'); end loop;
  for reference in select value from jsonb_array_elements(role_value->'evidence') loop perform eps.specs_document_reference(reference,p_paragraphs,p_source_asset); end loop;
  perform eps.specs_document_clarifications(role_value->'clarifications',p_paragraphs,p_source_asset);
 end loop;
 if not v2 then return; end if;
 -- v2: scenes, occurrences and explicit same-character links.
 perform eps.specs_stage_assert(jsonb_typeof(p_value->'scenes')='array','RESULT_INVALID');
 perform eps.specs_stage_assert(not exists(select 1 from jsonb_array_elements(p_value->'scenes') entries(value) group by entries.value->>'scene_key' having count(*)>1),'RESULT_INVALID');
 for scene_value in select value from jsonb_array_elements(p_value->'scenes') loop
  perform eps.specs_stage_assert(eps.specs_stage_shape(scene_value,array['scene_key','scene_number','title','sequence_label','setting','notes','requirements','evidence'],array['scene_key','scene_number','title','sequence_label','setting','notes','requirements','evidence'])
   and eps.specs_stage_text(scene_value->'scene_key') and eps.specs_stage_nonblank(scene_value->>'scene_key')
   and eps.specs_stage_text(scene_value->'title') and eps.specs_stage_nonblank(scene_value->>'title')
   and eps.specs_stage_text(scene_value->'scene_number',true) and eps.specs_stage_text(scene_value->'sequence_label',true)
   and eps.specs_stage_text(scene_value->'setting',true) and eps.specs_stage_text(scene_value->'notes',true)
   and eps.specs_stage_strings(scene_value->'requirements')
   and jsonb_typeof(scene_value->'evidence')='array' and jsonb_array_length(scene_value->'evidence')>0,'RESULT_INVALID');
  for reference in select value from jsonb_array_elements(scene_value->'evidence') loop perform eps.specs_document_reference(reference,p_paragraphs,p_source_asset); end loop;
 end loop;
 for role_value in select value from jsonb_array_elements(p_value->'roles') loop
  perform eps.specs_stage_assert(jsonb_typeof(role_value->'occurrences')='array'
   and not exists(select 1 from jsonb_array_elements(role_value->'occurrences') entries(value) group by entries.value->>'scene_key' having count(*)>1),'RESULT_INVALID');
  for occurrence in select value from jsonb_array_elements(role_value->'occurrences') loop
   perform eps.specs_stage_assert(eps.specs_stage_shape(occurrence,array['scene_key','display_title','evidence'],array['scene_key','display_title','evidence'])
    and eps.specs_stage_text(occurrence->'scene_key')
    and exists(select 1 from jsonb_array_elements(p_value->'scenes') scenes(value) where scenes.value->'scene_key'=occurrence->'scene_key')
    and eps.specs_stage_text(occurrence->'display_title',true)
    and jsonb_typeof(occurrence->'evidence')='array' and jsonb_array_length(occurrence->'evidence')>0,'RESULT_INVALID');
   for reference in select value from jsonb_array_elements(occurrence->'evidence') loop perform eps.specs_document_reference(reference,p_paragraphs,p_source_asset); end loop;
  end loop;
  link:=role_value->'same_character_as';
  if link<>'null'::jsonb then
   perform eps.specs_stage_assert(eps.specs_stage_shape(link,array['source_role_key','evidence'],array['source_role_key','evidence'])
    and eps.specs_stage_text(link->'source_role_key') and link->'source_role_key'<>role_value->'source_role_key'
    and exists(select 1 from jsonb_array_elements(p_value->'roles') roles(value) where roles.value->'source_role_key'=link->'source_role_key')
    and jsonb_typeof(link->'evidence')='array' and jsonb_array_length(link->'evidence')>0
    and exists(select 1 from jsonb_array_elements(role_value->'clarifications') entries(value) where entries.value->>'field_path'='same_character_as'),'RESULT_INVALID');
   for reference in select value from jsonb_array_elements(link->'evidence') loop perform eps.specs_document_reference(reference,p_paragraphs,p_source_asset); end loop;
  end if;
 end loop;
end $function$;

create or replace function eps.specs_stage_metadata(p_value jsonb, p_job eps.jobs, p_paragraphs jsonb) returns void language plpgsql immutable security invoker set search_path='' as $function$
declare field text; usage_value jsonb; begin
 perform eps.specs_stage_assert(eps.specs_stage_shape(p_value,array['provider','sdk_version','requested_model','resolved_model','response_id','request_id','correlation_id','input_sha256','prepared_source_sha256','prompt_version','prompt_sha256','schema_version','schema_sha256','provider_schema_sha256','usage'],array['provider','sdk_version','requested_model','resolved_model','response_id','request_id','correlation_id','input_sha256','prepared_source_sha256','prompt_version','prompt_sha256','schema_version','schema_sha256','provider_schema_sha256','usage'])
  and p_value->>'provider'='openai' and p_value->>'sdk_version'='7.45.1' and p_value->>'schema_version' in('1.0','2.0')
  and p_value->>'input_sha256'=p_job.input_hash and p_value->>'prepared_source_sha256'=eps.specs_document_prepared_hash(p_job.input_asset_id,p_paragraphs)
  and p_value->>'requested_model'=p_job.input#>>'{configuration,model_version}'
  and p_value->>'prompt_version'=p_job.input#>>'{configuration,prompt_version}' and p_value->>'correlation_id'=p_job.correlation_id,'RESULT_INVALID');
 -- Reviewed prompt/schema manifests. v1 pins are unchanged from m02; v2 pins come from
 -- packages/integrations/src/prompts/specs-v2.ts and contracts/json-schema/specs-extraction-v2.schema.json
 -- (tests/integrations/specs-v2.test.ts asserts these literals equal the TypeScript hashes).
 perform eps.specs_stage_assert((p_value->>'prompt_version'='spec_extract_v1.0.0' and p_value->>'schema_version'='1.0'
  and p_value->>'prompt_sha256'='ab03fd026edb3d139fd93fdd51cb475474d6c4e3c8f6395b65014574e7e29eee'
  and p_value->>'schema_sha256'='e8ffee51eee20f687abbfc12c2476248ccb5a59c1122fde418bc89db3ff58085'
  and p_value->>'provider_schema_sha256'='d73a11450f2714c5649ab9a663f0a3483f68feefd1f482bc62575a9a608a1216')
  or (p_value->>'prompt_version'='spec_extract_v2.0.0' and p_value->>'schema_version'='2.0'
  and p_job.input#>>'{configuration,result_schema_version}'='2.0'
  and p_value->>'prompt_sha256'='65575b1c5b9e509f73b64dd44ae94c9151502e081b0a4b0cfdfb73693374d745'
  and p_value->>'schema_sha256'='a50665e17b53d11c2eb741483cae4e0081d4461e3711b3d06a5b4358dca51fc1'
  and p_value->>'provider_schema_sha256'='cd80820db66ad4e22d3cce7dc9dbfb07f2da6aee4e74697d2f81fe9c5b5123fc'),'RESULT_INVALID');
 foreach field in array array['requested_model','resolved_model','response_id','correlation_id','prompt_version'] loop
  perform eps.specs_stage_assert(jsonb_typeof(p_value->field)='string' and (p_value->>field)~'^[A-Za-z0-9._:-]{1,200}$','RESULT_INVALID'); end loop;
 perform eps.specs_stage_assert(p_value->'request_id'='null' or jsonb_typeof(p_value->'request_id')='string' and (p_value->>'request_id')~'^[A-Za-z0-9._:-]{1,200}$','RESULT_INVALID');
 foreach field in array array['prompt_sha256','schema_sha256','provider_schema_sha256'] loop
  perform eps.specs_stage_assert(jsonb_typeof(p_value->field)='string' and (p_value->>field)~'^[a-f0-9]{64}$','RESULT_INVALID'); end loop;
 usage_value:=p_value->'usage';
 if usage_value<>'null' then
  perform eps.specs_stage_assert(eps.specs_stage_shape(usage_value,array['input_tokens','output_tokens','total_tokens'],array['input_tokens','output_tokens','total_tokens'])
   and eps.specs_stage_integer(usage_value->'input_tokens') and eps.specs_stage_integer(usage_value->'output_tokens') and eps.specs_stage_integer(usage_value->'total_tokens'),'RESULT_INVALID');
 end if;
end $function$;

-- CREATE OR REPLACE keeps owner and ACL; fail the migration if anything drifted.
do $$ begin
  if (select count(*) from pg_proc p where p.oid in(to_regprocedure('eps.specs_stage_configuration(jsonb)'),to_regprocedure('eps.specs_stage_extract(jsonb,jsonb)'),
      to_regprocedure('eps.specs_document_extract(jsonb,jsonb,uuid)'),to_regprocedure('eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)'))
      and pg_get_userbyid(p.proowner)='eps_specs_stage_owner' and not p.prosecdef and p.provolatile='i'
      and p.proconfig=array['search_path=""']
      and not has_function_privilege('public',p.oid,'execute'))<>4 then
    raise exception 'M17_SPECS_V2_VALIDATOR_STATE_INVALID';
  end if;
end $$;

-- Pipeline switch (deliberately NOT executed here). Deploy the worker that knows spec_extract_v2.0.0 first;
-- a v2 job claimed by an older worker fails STAGE_INPUT_INVALID. Only after that worker is live, and only
-- once eps.specs_stage_apply understands v2 results (m17 apply), switch new jobs with:
--   update eps.specs_pipeline_config set prompt_version='spec_extract_v2.0.0', result_schema_version='2.0' where id=1;
-- Rollback for new jobs: set them back to 'spec_extract_v1.0.0' / '1.0'. Existing jobs keep their frozen configuration.
