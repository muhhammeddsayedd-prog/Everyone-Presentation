-- Fixed canonical scope. The companion tool substitutes only reviewed UUIDs
-- into one metadata-only array marker. No source, quote, key or lease returned.
begin isolation level repeatable read read only;
set local statement_timeout='20s';
set local search_path='';
set local timezone='UTC';
do $scope$
declare ids uuid[]:=array['c50391c2-da84-4ee0-9fd8-a2782eed234e','ff514619-4106-4221-8663-6429241f687b']::uuid[];
begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or cardinality(ids) not between 1 and 4 or cardinality(ids)<>(select count(distinct item) from unnest(ids) entries(item))
  or not exists(select 1 from eps.workspaces where id='098d5b48-42a3-475b-b562-735c9eafce80'
    and project_id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463' and archived_at is null)
  or (select count(*) from eps.jobs where id=any(ids) and workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'
    and kind='specs_extract' and input_asset_id is not null)<>cardinality(ids)
 then raise exception 'LIVE_FILE_METADATA_SCOPE_UNCONFIRMED'; end if;
 perform set_config('eps.live_file_metadata.jobs',to_jsonb(ids)::text,true);
end $scope$;
with wanted as (select value::uuid id from jsonb_array_elements_text(current_setting('eps.live_file_metadata.jobs')::jsonb)),
target as (select j.* from eps.jobs j join wanted w on w.id=j.id),
prepared as (select p.*,a.sha256 asset_sha256,a.size_bytes asset_bytes,a.status asset_status,
  pending.payload_utf8 from eps.specs_stage_payloads p join target j on j.id=p.job_id
  left join eps.media_assets a on a.id::text=p.result->>'text_asset_id'
  left join eps.specs_file_preparations pending on pending.job_id=p.job_id and pending.attempt_id=p.attempt_id and pending.asset_id=a.id
  where p.stage='prepare_document'),
extracted as (select p.* from eps.specs_stage_payloads p join target j on j.id=p.job_id where p.stage='extract_specs'),
refs as (
 select p.job_id,item.value reference from extracted p cross join lateral jsonb_array_elements(p.result#>'{result,roles}') role(value)
  cross join lateral jsonb_array_elements(role.value->'evidence') item(value)
 union all select p.job_id,item.value->'source' from extracted p
  cross join lateral jsonb_array_elements(p.result#>'{result,clarifications}') item(value) where item.value->'source'<>'null'::jsonb
 union all select p.job_id,item.value->'source' from extracted p cross join lateral jsonb_array_elements(p.result#>'{result,roles}') role(value)
  cross join lateral jsonb_array_elements(role.value->'clarifications') item(value) where item.value->'source'<>'null'::jsonb),
grounded as (select r.job_id,r.reference,
 (r.reference->>'asset_id'=j.input_asset_id::text and exists(select 1 from jsonb_array_elements(p.paragraphs) paragraph(value)
   where (r.reference->'paragraph'='null'::jsonb or r.reference->'paragraph'=paragraph.value->'index')
    and (r.reference->'page'='null'::jsonb or r.reference->'page'=paragraph.value->'page')
    and (r.reference->'paragraph'<>'null'::jsonb or r.reference->'page'<>'null'::jsonb)
    and (r.reference->'quote'='null'::jsonb or eps.specs_stage_nonblank(r.reference->>'quote') and position(r.reference->>'quote' in paragraph.value->>'text')>0))) valid
 from refs r join target j on j.id=r.job_id join prepared p on p.job_id=r.job_id)
select jsonb_build_object(
 'query_role',current_user,'database',current_database(),'workspace_id','098d5b48-42a3-475b-b562-735c9eafce80',
 'project_id','4b70c8ce-18bd-4a8c-b5a9-bc1156c06463',
 'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'scope','Canonical file workflow metadata only. Stored hashes are not a fresh HTTP byte-download proof. Only the latest job n8n execution ID is persisted.',
 'workspace_jobs',(select coalesce(jsonb_agg(jsonb_build_object('job_id',id,'resource_id',resource_id,'source_asset_id',input_asset_id,
   'source_kind',case when input_asset_id is null then 'pasted_text' else 'asset' end,'status',status,'stage',stage,
   'source_row_version',input->'source_row_version','source_sha256',input->'source_hash','input_sha256',input_hash,
   'created_at',created_at,'updated_at',updated_at) order by created_at,id),'[]') from eps.jobs
   where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and kind='specs_extract'),
 'retained_inputs',(select coalesce(jsonb_agg(jsonb_build_object('job_id',i.job_id,'spec_id',i.spec_id,'source_row_version',i.source_row_version,
   'source_asset_id',i.source_asset_id,'source_sha256',i.source_hash,'input_sha256',i.input_hash,'mime_type',i.source_mime_type,'size_bytes',i.source_size_bytes,
   'has_text_original',i.source_text is not null,'has_asset_original',i.source_asset_id is not null,
   'source_metadata_matches',case when i.source_asset_id is null then i.source_hash=encode(sha256(convert_to(i.source_text,'UTF8')),'hex')
     else a.sha256=i.source_hash and a.mime_type=i.source_mime_type and a.size_bytes=i.source_size_bytes and a.status='ready' end)
   order by i.created_at,i.job_id),'[]') from eps.specs_source_inputs i left join eps.media_assets a on a.id=i.source_asset_id
   where i.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
 'assets',(select coalesce(jsonb_agg(jsonb_build_object('asset_id',a.id,'purpose',a.purpose,'status',a.status,'mime_type',a.mime_type,
   'size_bytes',a.size_bytes,'stored_sha256',a.sha256,'source_asset_id',a.source_asset_id,'producing_job_id',a.producing_job_id,
   'producing_attempt_id',a.producing_attempt_id,'stage',a.output_stage,'output_key',a.output_key,'bucket',a.bucket,
   'path_bound',case when a.purpose='document_text' then a.object_key='jobs/'||a.producing_job_id::text||'/attempts/'||a.producing_attempt_id::text||'/'||a.id::text||'.json'
    else a.object_key='assets/'||a.id::text||'/original.'||case a.mime_type when 'application/pdf' then 'pdf' when 'text/plain' then 'txt' else 'docx' end end)
   order by a.created_at,a.id),'[]') from eps.media_assets a where a.origin_workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'
   and a.purpose in('specs','document_text')),
 'file_jobs',(select jsonb_agg(jsonb_build_object('job_id',j.id,'resource_id',j.resource_id,'source_asset_id',j.input_asset_id,
   'status',j.status,'stage',j.stage,'stage_attempts',j.stage_attempts,'row_version',j.row_version,'error_code',j.error->>'code',
   'last_n8n_execution_id',j.n8n_execution_id,'configuration',j.input->'configuration','source_sha256',j.input->>'source_hash','input_sha256',j.input_hash,
   'completed_stages',(select coalesce(jsonb_agg(jsonb_build_object('stage',stage.value->'stage','attempt_id',stage.value->'attempt_id',
     'result_schema',stage.value->'result_schema','completed_at',stage.value->'completed_at') order by ordinal),'[]')
      from jsonb_array_elements(j.completed_stages) with ordinality stage(value,ordinal)),
   'source_binding',(select jsonb_build_object('retained',i.job_id=j.id and i.spec_id=j.resource_id and i.input_hash=j.input_hash
      and i.source_asset_id=j.input_asset_id and i.source_hash=j.input->>'source_hash',
      'ready_original_matches',a.status='ready' and a.sha256=i.source_hash and a.size_bytes=i.source_size_bytes and a.mime_type=i.source_mime_type)
      from eps.specs_source_inputs i join eps.media_assets a on a.id=i.source_asset_id where i.job_id=j.id),
   'preparation',(select jsonb_build_object('attempt_id',p.attempt_id,'result_schema',p.result_schema,'text_asset_id',p.result->'text_asset_id',
      'method',p.result->'extraction_method','paragraph_count',jsonb_array_length(p.paragraphs),
      'prepared_characters',length(p.prepared_text),'arabic_present',p.prepared_text~('['||chr(1536)||'-'||chr(1791)||']'),
      'private_json_stored',p.payload_utf8 is not null,'private_json_bytes',octet_length(p.payload_utf8),
      'ready_derivative_matches_exact_json',p.asset_status='ready' and p.asset_bytes=octet_length(p.payload_utf8)
        and p.asset_sha256=encode(sha256(convert_to(p.payload_utf8,'UTF8')),'hex'),
      'source_id_matches',p.result->>'source_asset_id'=j.input_asset_id::text,
      'paragraphs',(select jsonb_agg(jsonb_build_object('index',item.value->'index','page',item.value->'page','start',item.value->'start','end',item.value->'end') order by ordinal)
        from jsonb_array_elements(p.paragraphs) with ordinality item(value,ordinal))) from prepared p where p.job_id=j.id),
   'provider',(select jsonb_build_object('provider',p.result#>'{metadata,provider}','sdk_version',p.result#>'{metadata,sdk_version}',
      'requested_model',p.result#>'{metadata,requested_model}','resolved_model',p.result#>'{metadata,resolved_model}',
      'prompt_version',p.result#>'{metadata,prompt_version}','prompt_sha256',p.result#>'{metadata,prompt_sha256}',
      'schema_version',p.result#>'{metadata,schema_version}','schema_sha256',p.result#>'{metadata,schema_sha256}',
      'provider_schema_sha256',p.result#>'{metadata,provider_schema_sha256}','input_sha256',p.result#>'{metadata,input_sha256}',
      'prepared_source_sha256',p.result#>'{metadata,prepared_source_sha256}','usage',p.result#>'{metadata,usage}',
      'response_reference_present',length(p.result#>>'{metadata,response_id}')>0,'request_reference_present',length(p.result#>>'{metadata,request_id}')>0)
      from extracted p where p.job_id=j.id),
   'references',(select jsonb_build_object('count',count(*),'all_grounded',coalesce(bool_and(g.valid),false),
      'locators',coalesce(jsonb_agg(jsonb_build_object('asset_id',g.reference->'asset_id','page',g.reference->'page',
       'paragraph',g.reference->'paragraph','quote_present',g.reference->'quote'<>'null'::jsonb,'grounded',g.valid)),'[]'))
      from grounded g where g.job_id=j.id),
   'clarifications',(select jsonb_build_object('spec_count',jsonb_array_length(p.result#>'{result,clarifications}'),
      'role_count',(select coalesce(sum(jsonb_array_length(role.value->'clarifications')),0) from jsonb_array_elements(p.result#>'{result,roles}') role(value))) from extracted p where p.job_id=j.id),
   'events',(select coalesce(jsonb_agg(jsonb_build_object('event_id',e.event_id,'attempt_id',e.attempt_id,'stage',e.stage,
      'type',e.event_type,'sequence',e.sequence,'applied',e.receipt->'applied','stale',e.receipt->'stale','status',e.receipt->'job_status','created_at',e.created_at)
      order by e.created_at,e.sequence),'[]') from eps.job_events e where e.job_id=j.id),
   'outbox',(select coalesce(jsonb_agg(jsonb_build_object('event_id',o.id,'stage',o.stage,'status',o.status,'generation',o.dispatch_generation,
      'attempt_count',o.attempt_count,'delivered_at',o.delivered_at,'dispatch_bound',o.topic='jobs.stage.ready' and o.input_hash=j.input_hash
       and o.dedupe_key=j.id::text||':'||o.dispatch_generation::text) order by o.dispatch_generation),'[]') from eps.outbox_events o where o.job_id=j.id))
   order by j.created_at,j.id) from target j),
 'current_draft',(select jsonb_build_object('spec_id',s.id,'row_version',s.row_version,'source_row_version',s.source_row_version,
    'current_job_id',s.processing_job_id,'source_asset_id',s.source_asset_id,'extraction_origin_job_id',s.source_extraction_job_id,
    'origin_resolves',exists(select 1 from eps.specs_source_inputs i where i.job_id=s.source_extraction_job_id and i.spec_id=s.id),
    'active_roles',(select count(*) from eps.roles where workspace_id=s.workspace_id and archived_at is null),
    'archived_roles',(select count(*) from eps.roles where workspace_id=s.workspace_id and archived_at is not null),
    'active_slots',(select count(*) from eps.slots where workspace_id=s.workspace_id and archived_at is null),
    'archived_slots',(select count(*) from eps.slots where workspace_id=s.workspace_id and archived_at is not null),
    'clarification_count',jsonb_array_length(s.clarifications),
    'role_origins',(select coalesce(jsonb_agg(jsonb_build_object('role_id',r.id,'origin_job_id',r.source_job_id,'archived',r.archived_at is not null,
      'row_version',r.row_version,'headcount',r.headcount,'origin_known',r.source_job_id is not null,
      'origin_resolves',r.source_job_id is not null and exists(select 1 from eps.specs_source_inputs i where i.job_id=r.source_job_id and i.spec_id=s.id),
      'slots',(select jsonb_build_object('active',count(*) filter(where t.archived_at is null),'archived',count(*) filter(where t.archived_at is not null),
       'provisional',count(*) filter(where t.archived_at is null and t.provisional)) from eps.slots t where t.role_id=r.id)) order by r.created_at,r.id),'[]')
      from eps.roles r where r.workspace_id=s.workspace_id)) from eps.specs s where s.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80')
) as live_specs_files;
rollback;
