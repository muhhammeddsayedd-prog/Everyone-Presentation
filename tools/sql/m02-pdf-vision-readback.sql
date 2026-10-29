-- Fixed actual image-only English/Arabic fixture submitted through the app.
-- Metadata, checksums and expected-fixture booleans only; no text/quotes/images.
begin isolation level repeatable read read only;
set local statement_timeout='15s';set local search_path='';set local timezone='UTC';
do $scope$begin
 if current_user<>'postgres' or current_database()<>'postgres' or
  (select count(*) from eps.jobs j join eps.workspaces w on w.id=j.workspace_id
   where j.id='e7316bb7-4c40-4460-8d17-15503ba12315' and j.kind='specs_extract'
    and j.input_asset_id='c7a82096-7a56-415c-9ba1-eeb4bbb0e708'
    and j.workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
    and w.project_id='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c')<>1
 then raise exception 'PDF_VISION_READBACK_SCOPE_UNCONFIRMED';end if;
end $scope$;
with target as(select j.*,w.project_id from eps.jobs j join eps.workspaces w on w.id=j.workspace_id where j.id='e7316bb7-4c40-4460-8d17-15503ba12315'),
prepared as(select p.*,a.sha256 derivative_sha256,a.size_bytes derivative_bytes,a.status derivative_status,a.object_key,
 pending.payload_utf8 from eps.specs_stage_payloads p join target j on j.id=p.job_id
 join eps.media_assets a on a.id::text=p.result->>'text_asset_id'
 join eps.specs_file_preparations pending on pending.job_id=p.job_id and pending.attempt_id=p.attempt_id and pending.asset_id=a.id
 where p.stage='prepare_document'),
extracted as(select p.* from eps.specs_stage_payloads p join target j on j.id=p.job_id where p.stage='extract_specs'),
refs as(
 select p.job_id,item.value reference from extracted p cross join lateral jsonb_array_elements(p.result#>'{result,roles}') role(value)
  cross join lateral jsonb_array_elements(role.value->'evidence') item(value)
 union all select p.job_id,item.value->'source' from extracted p cross join lateral jsonb_array_elements(p.result#>'{result,clarifications}') item(value) where item.value->'source'<>'null'::jsonb
 union all select p.job_id,item.value->'source' from extracted p cross join lateral jsonb_array_elements(p.result#>'{result,roles}') role(value)
  cross join lateral jsonb_array_elements(role.value->'clarifications') item(value) where item.value->'source'<>'null'::jsonb),
grounded as(select r.job_id,r.reference,
 r.reference->>'asset_id'=j.input_asset_id::text and exists(select 1 from jsonb_array_elements(p.paragraphs) paragraph(value)
  where (r.reference->'paragraph'='null'::jsonb or r.reference->'paragraph'=paragraph.value->'index')
   and (r.reference->'page'='null'::jsonb or r.reference->'page'=paragraph.value->'page')
   and (r.reference->'paragraph'<>'null'::jsonb or r.reference->'page'<>'null'::jsonb)
   and (r.reference->'quote'='null'::jsonb or nullif(btrim(r.reference->>'quote'),'') is not null and position(r.reference->>'quote' in paragraph.value->>'text')>0)) valid
 from refs r join target j on j.id=r.job_id join prepared p on p.job_id=r.job_id)
select jsonb_build_object('observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'target_count',(select count(*) from target),
 'job',(select jsonb_build_object('id',id,'workspace_id',workspace_id,'project_id',project_id,'spec_id',resource_id,'input_sha256',input_hash,'status',status,'stage',stage,
  'stage_attempts',stage_attempts,'n8n_execution_id',n8n_execution_id,
  'completed_stages',(select jsonb_agg(jsonb_build_object('stage',entry->>'stage','attempt_id',entry->>'attempt_id','schema',entry->>'result_schema','completed_at',entry->'completed_at') order by ordinal)
   from jsonb_array_elements(completed_stages) with ordinality v(entry,ordinal))) from target),
 'source',(select jsonb_build_object('asset_id',a.id,'status',a.status,'mime_type',a.mime_type,'size_bytes',a.size_bytes,'sha256',a.sha256,
  'fixed_fixture_hash_matches',a.sha256='2f1508bf45a46ae81f3459b1507db58f1e9af41591a0367b643dce973823225f',
  'frozen_source_matches',i.source_asset_id=a.id and i.source_hash=a.sha256 and i.source_hash=j.input->>'source_hash' and i.source_mime_type=a.mime_type and i.source_size_bytes=a.size_bytes and i.input_hash=j.input_hash and i.source_text is null,
  'private_path_bound',a.bucket='eps-specs-assets' and a.object_key='assets/'||a.id::text||'/original.pdf')
  from target j join eps.specs_source_inputs i on i.job_id=j.id join eps.media_assets a on a.id=j.input_asset_id),
 'preparation',(select jsonb_build_object('attempt_id',p.attempt_id,'method',p.result->>'extraction_method','text_asset_id',p.result->>'text_asset_id',
  'derivative_sha256',p.derivative_sha256,'derivative_bytes',p.derivative_bytes,'private_json_sha256',encode(sha256(convert_to(p.payload_utf8,'UTF8')),'hex'),
  'ready_derivative_matches_exact_json',p.derivative_status='ready' and p.derivative_bytes=octet_length(p.payload_utf8) and p.derivative_sha256=encode(sha256(convert_to(p.payload_utf8,'UTF8')),'hex'),
  'derivative_path_bound',p.object_key='jobs/'||p.job_id::text||'/attempts/'||p.attempt_id::text||'/'||(p.result->>'text_asset_id')||'.json',
  'original_asset_and_hash_bound',(p.payload_utf8::jsonb)->>'sourceAssetId'=j.input_asset_id::text and (p.payload_utf8::jsonb)->>'sourceSha256'=j.input->>'source_hash',
  'arabic_preserved',p.prepared_text~('['||chr(1536)||'-'||chr(1791)||']'),
  'pages',(select jsonb_agg(page order by page) from(select distinct (item->>'page')::integer page from jsonb_array_elements(p.paragraphs) item) pages),
  'paragraph_count',jsonb_array_length(p.paragraphs),'prepared_characters',length(p.prepared_text),
  'paragraphs',(select jsonb_agg(jsonb_build_object('index',item->'index','page',item->'page','start',item->'start','end',item->'end') order by ordinal)
   from jsonb_array_elements(p.paragraphs) with ordinality v(item,ordinal))) from prepared p join target j on j.id=p.job_id),
 'provider',(select jsonb_build_object('provider',p.result#>>'{metadata,provider}','sdk_version',p.result#>>'{metadata,sdk_version}',
  'requested_model',p.result#>>'{metadata,requested_model}','resolved_model',p.result#>>'{metadata,resolved_model}','usage',p.result#>'{metadata,usage}',
  'prompt_version',p.result#>>'{metadata,prompt_version}','prompt_sha256',p.result#>>'{metadata,prompt_sha256}','schema_sha256',p.result#>>'{metadata,schema_sha256}',
  'response_reference_present',length(p.result#>>'{metadata,response_id}')>0,
  'frozen_model_matches',p.result#>>'{metadata,requested_model}'=j.input#>>'{configuration,model_version}',
  'input_hash_matches',p.result#>>'{metadata,input_sha256}'=j.input_hash)
  from extracted p join target j on j.id=p.job_id),
 'references',(select jsonb_build_object('count',count(*),'all_grounded',coalesce(bool_and(valid),false),
  'pages',coalesce(jsonb_agg(distinct reference->'page') filter(where reference->'page'<>'null'::jsonb),'[]'::jsonb),
  'locators',coalesce(jsonb_agg(jsonb_build_object('asset_id',reference->'asset_id','page',reference->'page','paragraph',reference->'paragraph','grounded',valid)),'[]'::jsonb)) from grounded),
 'draft',(select jsonb_build_object('current_job_is_target',s.processing_job_id=j.id,'extraction_origin_is_target',s.source_extraction_job_id=j.id,
  'active_roles',(select count(*) from eps.roles where workspace_id=j.workspace_id and archived_at is null),
  'active_slots',(select count(*) from eps.slots where workspace_id=j.workspace_id and archived_at is null),
  'provisional_slots',(select count(*) from eps.slots where workspace_id=j.workspace_id and archived_at is null and provisional),
  'role_fixture_checks',(select jsonb_build_object('archive_clerk',lower(r.name) like '%archive clerk%','headcount_not_invented',r.headcount is null,
   'age_not_invented',r.requirements->'age_range'='null'::jsonb,
   'arabic_required',exists(select 1 from jsonb_array_elements_text(r.requirements->'languages') v(value) where lower(value) in('arabic','ar','العربية')),
   'english_required',exists(select 1 from jsonb_array_elements_text(r.requirements->'languages') v(value) where lower(value) in('english','en','الإنجليزية')),
   'cairo_retained',lower(r.requirements->>'location') like '%cairo%' or r.requirements->>'location' like '%القاهرة%',
   'scene_9_retained',(r.requirements->'scene_references')::text~'(^|[^0-9])9([^0-9]|$)',
   'scene_11_retained',(r.requirements->'scene_references')::text~'(^|[^0-9])11([^0-9]|$)',
   'relative_monday_retained',concat((r.requirements->'shoot_dates')::text,' ',r.requirements->>'availability_requirements')~*'Monday|الاثنين',
   'calendar_date_not_invented',concat((r.requirements->'shoot_dates')::text,' ',r.requirements->>'availability_requirements')!~'[0-9]{4}[-/][0-9]{1,2}[-/][0-9]{1,2}',
   'date_clarification_present',exists(select 1 from jsonb_array_elements(p.result#>'{result,roles}') role(value) cross join lateral jsonb_array_elements(role.value->'clarifications') c(value) where c.value->>'field_path' like '%shoot_dates%' or c.value->>'field_path' like '%availability_requirements%')
    or exists(select 1 from jsonb_array_elements(p.result#>'{result,clarifications}') c(value) where c.value->>'field_path' like '%shoot_dates%' or c.value->>'field_path' like '%availability_requirements%'))
   from eps.roles r cross join extracted p where r.workspace_id=j.workspace_id and r.archived_at is null and r.source_job_id=j.id))
  from eps.specs s join target j on j.resource_id=s.id),
 'outbox',(select jsonb_agg(jsonb_build_object('stage',o.stage,'status',o.status,'generation',o.dispatch_generation,'attempt_count',o.attempt_count,
  'input_hash_matches',o.input_hash=j.input_hash) order by o.dispatch_generation) from eps.outbox_events o join target j on j.id=o.job_id),
 'protected_source',jsonb_build_object('still_waiting',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496' and status='waiting_for_input' and error->>'code'='INPUT_CHANGED'),
  'manual_note_retained',exists(select 1 from eps.specs where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and normalized_instructions like '%Manual verification: preserve this instruction while extraction is pending.%'))
) as proof;
rollback;
