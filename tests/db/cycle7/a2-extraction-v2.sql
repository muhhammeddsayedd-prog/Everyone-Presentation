-- A2 specs extraction v2 validators (m17_specs_extraction_v2). Run after every migration as supabase_admin.
-- Synthetic data only; everything happens inside one transaction that is rolled back. Any failed check raises.
begin;
set local search_path='';

create function pg_temp.a2_expect(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'A2_CHECK_FAILED expected % from: %', p_code, left(p_sql, 160);
exception when others then
  if sqlerrm like 'A2_CHECK_FAILED%' then raise; end if;
  if sqlerrm<>p_code then raise exception 'A2_CHECK_FAILED expected % but got % from: %', p_code, sqlerrm, left(p_sql, 160); end if;
end $$;

create function pg_temp.a2_paragraphs(p_paged boolean) returns jsonb language sql as $$
  select jsonb_agg(jsonb_build_object('index', ordinal - 1, 'page', case when p_paged then to_jsonb(ordinal) else 'null'::jsonb end, 'text', text) order by ordinal)
  from unnest(array[
    'SCENE 1 - INT. KITCHEN - NIGHT. The young father cooks dinner.',
    'SCENE 3A - EXT. GARDEN - DAY. The old father waters the roses. Two waiters pass by.',
    'The old father is the same character as the young father, decades later.']) with ordinality entries(text, ordinal)
$$;

-- Builds evidence for pasted text (p_asset null) or a document (asset id + page = paragraph + 1).
create function pg_temp.a2_ref(p_asset uuid, p_paragraph integer, p_quote text) returns jsonb language sql as $$
  select jsonb_build_object('asset_id', to_jsonb(p_asset), 'page', case when p_asset is null then 'null'::jsonb else to_jsonb(p_paragraph + 1) end,
    'paragraph', p_paragraph, 'segment_index', null, 'start_ms', null, 'end_ms', null, 'quote', p_quote)
$$;

create function pg_temp.a2_requirements(p_scenes text[]) returns jsonb language sql as $$
  select jsonb_build_object('age_range', null, 'gender_requirement', null, 'appearance_performance', null, 'languages', '[]'::jsonb,
    'accents', '[]'::jsonb, 'skills', '[]'::jsonb, 'scene_references', to_jsonb(p_scenes), 'shoot_dates', '[]'::jsonb, 'location', null,
    'availability_requirements', null, 'other_instructions', null)
$$;

create function pg_temp.a2_v1(p_asset uuid) returns jsonb language sql as $$
  select jsonb_build_object('schema_version', '1.0', 'source_asset_id', to_jsonb(p_asset), 'source_language_codes', '["en"]'::jsonb,
    'roles', jsonb_build_array(jsonb_build_object('source_role_key', 'waiters', 'name', 'Waiter', 'headcount', 2, 'category', null,
      'requirements', pg_temp.a2_requirements(array['3A']), 'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 1, 'Two waiters pass by.')),
      'clarifications', '[]'::jsonb)),
    'general_instructions', null, 'clarifications', '[]'::jsonb)
$$;

create function pg_temp.a2_v2(p_asset uuid) returns jsonb language sql as $$
  select jsonb_build_object('schema_version', '2.0', 'source_asset_id', to_jsonb(p_asset), 'source_language_codes', '["en"]'::jsonb,
    'roles', jsonb_build_array(
      jsonb_build_object('source_role_key', 'father-young', 'name', 'Father (young)', 'headcount', 1, 'category', null,
        'requirements', pg_temp.a2_requirements(array['1']), 'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 0, 'The young father cooks dinner.')),
        'clarifications', '[]'::jsonb,
        'occurrences', jsonb_build_array(jsonb_build_object('scene_key', 'scene-1', 'display_title', 'Father (young)',
          'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 0, 'The young father cooks dinner.')))),
        'same_character_as', null),
      jsonb_build_object('source_role_key', 'father-old', 'name', 'Father (old)', 'headcount', 1, 'category', null,
        'requirements', pg_temp.a2_requirements(array['3A']), 'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 1, 'The old father waters the roses.')),
        'clarifications', jsonb_build_array(jsonb_build_object('field_path', 'same_character_as',
          'reason', 'The source may describe the same character as "Father (young)". Roles stay separately cast unless you link this role to the same scenes explicitly.',
          'source', pg_temp.a2_ref(p_asset, 2, 'The old father is the same character as the young father'))),
        'occurrences', jsonb_build_array(jsonb_build_object('scene_key', 'scene-3a', 'display_title', null,
          'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 1, 'The old father waters the roses.')))),
        'same_character_as', jsonb_build_object('source_role_key', 'father-young',
          'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 2, 'The old father is the same character as the young father')))),
      jsonb_build_object('source_role_key', 'waiters', 'name', 'Waiter', 'headcount', 2, 'category', 'Background',
        'requirements', pg_temp.a2_requirements(array['3A']), 'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 1, 'Two waiters pass by.')),
        'clarifications', '[]'::jsonb,
        'occurrences', jsonb_build_array(jsonb_build_object('scene_key', 'scene-3a', 'display_title', null,
          'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 1, 'Two waiters pass by.')))),
        'same_character_as', null)),
    'scenes', jsonb_build_array(
      jsonb_build_object('scene_key', 'scene-1', 'scene_number', '1', 'title', 'Kitchen at night', 'sequence_label', null,
        'setting', 'INT. KITCHEN - NIGHT', 'notes', null, 'requirements', '[]'::jsonb,
        'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 0, 'SCENE 1 - INT. KITCHEN - NIGHT.'))),
      jsonb_build_object('scene_key', 'scene-3a', 'scene_number', '3A', 'title', 'Garden by day', 'sequence_label', null,
        'setting', 'EXT. GARDEN - DAY', 'notes', null, 'requirements', '["Roses in bloom"]'::jsonb,
        'evidence', jsonb_build_array(pg_temp.a2_ref(p_asset, 1, 'SCENE 3A - EXT. GARDEN - DAY.')))),
    'general_instructions', null,
    'clarifications', jsonb_build_array(jsonb_build_object('field_path', 'scenes[1].scene_number', 'reason', 'Scene 2 is not described.', 'source', null)))
$$;

do $$
declare
  asset uuid:='11111111-1111-4111-8111-111111111111';
  pasted jsonb:=pg_temp.a2_paragraphs(false); paged jsonb:=pg_temp.a2_paragraphs(true);
  v2 jsonb:=pg_temp.a2_v2(null); bad jsonb; checks integer:=0;
  call_stage text:='select eps.specs_stage_extract(%L::jsonb,%L::jsonb)';
  config jsonb:=jsonb_build_object('document_preparation_version','document-preparation.v1','model_version','synthetic-model',
    'prompt_version','spec_extract_v2.0.0','result_schema_version','2.0');
  job eps.jobs; metadata jsonb;
begin
  -- Accepted: v1 and v2, pasted text and document evidence.
  perform eps.specs_stage_extract(pg_temp.a2_v1(null), pasted); checks:=checks+1;
  perform eps.specs_document_extract(pg_temp.a2_v1(asset), paged, asset); checks:=checks+1;
  perform eps.specs_stage_extract(v2, pasted); checks:=checks+1;
  perform eps.specs_document_extract(pg_temp.a2_v2(asset), paged, asset); checks:=checks+1;
  bad:=jsonb_set(v2,'{scenes}','[]'); bad:=jsonb_set(bad,'{roles}',(select jsonb_agg(jsonb_set(jsonb_set(r,'{occurrences}','[]'),'{same_character_as}','null')) from jsonb_array_elements(v2->'roles') r));
  perform eps.specs_stage_extract(bad, pasted); checks:=checks+1; -- empty scenes/occurrences are valid

  -- Rejected v2 shapes (each raises RESULT_INVALID).
  foreach bad in array array[
    jsonb_set(v2,'{roles,0,occurrences,0,scene_key}','"scene-2"'),                                      -- dangling scene_key
    jsonb_set(v2,'{roles,1,same_character_as,source_role_key}','"father-old"'),                         -- self link
    jsonb_set(v2,'{roles,1,same_character_as,source_role_key}','"grandfather"'),                        -- unknown role
    jsonb_set(v2,'{roles,0,occurrences,0,evidence}','[]'),                                              -- occurrence without evidence
    jsonb_set(v2,'{scenes,0,evidence}','[]'),                                                           -- scene without evidence
    jsonb_set(v2,'{roles,1,same_character_as,evidence}','[]'),                                          -- link without evidence
    jsonb_set(v2,'{roles,1,clarifications}','[]'),                                                      -- link without clarification
    jsonb_set(v2,'{roles,2,occurrences}',(v2#>'{roles,2,occurrences}')||(v2#>'{roles,2,occurrences}')), -- duplicate occurrence
    jsonb_set(v2,'{scenes,1,scene_key}','"scene-1"'),                                                   -- duplicate scene key
    jsonb_set(v2,'{scenes,0,title}','" "'),                                                             -- blank title
    jsonb_set(v2,'{scenes,0,scene_number}','1'),                                                        -- non-text scene number
    jsonb_set(v2,'{scenes,0,evidence,0,quote}','"An invented scene heading"'),                          -- invented quote
    jsonb_set(v2,'{scenes,0,extra}','"x"'),                                                             -- extra scene key
    v2 #- '{roles,0,same_character_as}',                                                                -- missing role field
    v2 #- '{scenes}',                                                                                   -- missing scenes
    jsonb_set(v2,'{schema_version}','"1.0"'),                                                           -- v2 fields under 1.0
    jsonb_set(pg_temp.a2_v1(null),'{schema_version}','"2.0"')                                           -- v1 shape under 2.0
  ] loop
    perform pg_temp.a2_expect(format(call_stage, bad, pasted), 'RESULT_INVALID'); checks:=checks+1;
  end loop;
  perform pg_temp.a2_expect(format('select eps.specs_document_extract(%L::jsonb,%L::jsonb,%L::uuid)',
    jsonb_set(pg_temp.a2_v2(asset),'{scenes,1,evidence,0,page}','3'), paged, asset), 'RESULT_INVALID'); checks:=checks+1;
  perform pg_temp.a2_expect(format('select eps.specs_document_extract(%L::jsonb,%L::jsonb,%L::uuid)',
    jsonb_set(pg_temp.a2_v2(asset),'{roles,0,occurrences,0,evidence,0,asset_id}','null'), paged, asset), 'RESULT_INVALID'); checks:=checks+1;

  -- Configuration: only the reviewed pairs.
  perform eps.specs_stage_configuration(config); checks:=checks+1;
  perform eps.specs_stage_configuration(config||'{"prompt_version":"spec_extract_v1.0.0","result_schema_version":"1.0"}'); checks:=checks+1;
  perform pg_temp.a2_expect(format('select eps.specs_stage_configuration(%L::jsonb)', config||'{"result_schema_version":"1.0"}'), 'FEATURE_NOT_IMPLEMENTED'); checks:=checks+1;
  perform pg_temp.a2_expect(format('select eps.specs_stage_configuration(%L::jsonb)', config||'{"prompt_version":"spec_extract_v1.0.0"}'), 'FEATURE_NOT_IMPLEMENTED'); checks:=checks+1;
  perform pg_temp.a2_expect(format('select eps.specs_stage_configuration(%L::jsonb)', config||'{"prompt_version":"spec_extract_v3.0.0","result_schema_version":"3.0"}'), 'FEATURE_NOT_IMPLEMENTED'); checks:=checks+1;

  -- Metadata: v2 pins accepted only for a v2 job; v1 pins unchanged.
  job.input_hash:=repeat('c',64); job.correlation_id:='request-fixture-v2'; job.input_asset_id:=null;
  job.input:=jsonb_build_object('configuration',config);
  metadata:=jsonb_build_object('provider','openai','sdk_version','7.45.1','requested_model','synthetic-model','resolved_model','resolved-test-snapshot',
    'response_id','resp_v2_fixture','request_id',null,'correlation_id','request-fixture-v2','input_sha256',repeat('c',64),
    'prepared_source_sha256',eps.specs_document_prepared_hash(null,pasted),'prompt_version','spec_extract_v2.0.0',
    'prompt_sha256','65575b1c5b9e509f73b64dd44ae94c9151502e081b0a4b0cfdfb73693374d745','schema_version','2.0',
    'schema_sha256','a50665e17b53d11c2eb741483cae4e0081d4461e3711b3d06a5b4358dca51fc1',
    'provider_schema_sha256','cd80820db66ad4e22d3cce7dc9dbfb07f2da6aee4e74697d2f81fe9c5b5123fc','usage',null);
  perform eps.specs_stage_metadata(metadata, job, pasted); checks:=checks+1;
  perform pg_temp.a2_expect(format('select eps.specs_stage_metadata(%L::jsonb,%L::eps.jobs,%L::jsonb)',
    metadata||'{"schema_sha256":"e8ffee51eee20f687abbfc12c2476248ccb5a59c1122fde418bc89db3ff58085"}', job, pasted), 'RESULT_INVALID'); checks:=checks+1;
  perform pg_temp.a2_expect(format('select eps.specs_stage_metadata(%L::jsonb,%L::eps.jobs,%L::jsonb)',
    metadata||'{"schema_version":"1.0"}', job, pasted), 'RESULT_INVALID'); checks:=checks+1;
  job.input:=jsonb_build_object('configuration',config||'{"result_schema_version":"1.0"}');
  perform pg_temp.a2_expect(format('select eps.specs_stage_metadata(%L::jsonb,%L::eps.jobs,%L::jsonb)', metadata, job, pasted), 'RESULT_INVALID'); checks:=checks+1;
  job.input:=jsonb_build_object('configuration',config||'{"prompt_version":"spec_extract_v1.0.0","result_schema_version":"1.0"}');
  metadata:=metadata||'{"prompt_version":"spec_extract_v1.0.0","schema_version":"1.0","prompt_sha256":"ab03fd026edb3d139fd93fdd51cb475474d6c4e3c8f6395b65014574e7e29eee","schema_sha256":"e8ffee51eee20f687abbfc12c2476248ccb5a59c1122fde418bc89db3ff58085","provider_schema_sha256":"d73a11450f2714c5649ab9a663f0a3483f68feefd1f482bc62575a9a608a1216"}';
  perform eps.specs_stage_metadata(metadata, job, pasted); checks:=checks+1;
  perform pg_temp.a2_expect(format('select eps.specs_stage_metadata(%L::jsonb,%L::eps.jobs,%L::jsonb)',
    metadata||'{"prompt_sha256":"65575b1c5b9e509f73b64dd44ae94c9151502e081b0a4b0cfdfb73693374d745"}', job, pasted), 'RESULT_INVALID'); checks:=checks+1;

  -- Validator ownership/ACL survived CREATE OR REPLACE.
  if (select count(*) from pg_proc p where p.oid in('eps.specs_stage_configuration(jsonb)'::regprocedure,'eps.specs_stage_extract(jsonb,jsonb)'::regprocedure,
      'eps.specs_document_extract(jsonb,jsonb,uuid)'::regprocedure,'eps.specs_stage_metadata(jsonb,eps.jobs,jsonb)'::regprocedure)
      and pg_get_userbyid(p.proowner)='eps_specs_stage_owner' and not has_function_privilege('public',p.oid,'execute'))<>4
    or not has_function_privilege('eps_specs_apply_owner','eps.specs_document_extract(jsonb,jsonb,uuid)','execute')
    or not has_function_privilege('eps_specs_apply_owner','eps.specs_stage_extract(jsonb,jsonb)','execute') then
    raise exception 'A2_CHECK_FAILED validator owner or grants changed';
  end if;
  checks:=checks+1;
  perform set_config('eps.a2_checks', checks::text, true);
end $$;

select json_build_object('result','passed','file','a2-extraction-v2','checks',current_setting('eps.a2_checks')::integer);
rollback;
