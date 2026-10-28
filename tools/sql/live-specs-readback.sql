-- Fixed labelled synthetic sample; metadata and facts counts only.
begin read only;
set local statement_timeout='15s';
set local search_path='';
with target as (select j.* from eps.jobs j join eps.specs_source_inputs i on i.job_id=j.id
 where i.source_hash='2d267edd68d6b3e3bc1f0a0bf280abafdbc4a7148071f3528a4539673fb3d4fa'),
sample as (select * from target order by created_at limit 1)
select jsonb_build_object(
 'query_role',current_user,'database',current_database(),
 'sample_job_count',(select count(*) from target),
 'job',(select jsonb_build_object('id',id,'workspace_id',workspace_id,'resource_id',resource_id,'status',status,'stage',stage,
  'stage_attempts',stage_attempts,'completed_stages',completed_stages,'row_version',row_version,'n8n_execution_id',n8n_execution_id,
  'created_at',created_at,'updated_at',updated_at,'error_code',error->>'code') from sample),
 'source',(select jsonb_build_object('original_sha256',source_hash,'bytes',octet_length(source_text),
  'original_hash_verified',source_hash=encode(sha256(convert_to(source_text,'UTF8')),'hex'),
  'arabic_preserved',source_text like '%تعليمات عامة%','retained_rows',(select count(*) from eps.specs_source_inputs s where s.job_id=i.job_id))
  from eps.specs_source_inputs i join sample j on j.id=i.job_id),
 'stages',(select jsonb_agg(jsonb_build_object('stage',p.stage,'result_schema',p.result_schema,'attempt_id',p.attempt_id,
  'result_sha256',encode(sha256(convert_to(p.result::text,'UTF8')),'hex'),'created_at',p.created_at) order by p.created_at)
  from eps.specs_stage_payloads p join sample j on j.id=p.job_id),
 'provider',(select jsonb_build_object('provider',p.result#>>'{metadata,provider}','sdk_version',p.result#>>'{metadata,sdk_version}',
  'requested_model',p.result#>>'{metadata,requested_model}','resolved_model',p.result#>>'{metadata,resolved_model}',
  'prompt_version',p.result#>>'{metadata,prompt_version}','prompt_sha256',p.result#>>'{metadata,prompt_sha256}',
  'schema_version',p.result#>>'{metadata,schema_version}','schema_sha256',p.result#>>'{metadata,schema_sha256}',
  'provider_schema_sha256',p.result#>>'{metadata,provider_schema_sha256}','usage',p.result#>'{metadata,usage}',
  'response_reference_present',length(p.result#>>'{metadata,response_id}')>0,
  'request_reference_present',length(p.result#>>'{metadata,request_id}')>0)
  from eps.specs_stage_payloads p join sample j on j.id=p.job_id where p.stage='extract_specs'),
 'draft',(select jsonb_build_object('spec_id',s.id,'source_row_version',s.source_row_version,'row_version',s.row_version,
  'language_codes',s.source_language_codes,'origin_job_matches',s.source_extraction_job_id=j.id,
  'current_job_matches',s.processing_job_id=j.id,'normalized_english_present',length(s.normalized_instructions)>0,
  'role_count',(select count(*) from eps.roles r where r.workspace_id=s.workspace_id and r.archived_at is null),
  'slot_count',(select count(*) from eps.slots t where t.workspace_id=s.workspace_id and t.archived_at is null),
  'roles',(select jsonb_agg(jsonb_build_object('name',r.name,'headcount',r.headcount,'active_slots',
    (select count(*) from eps.slots t where t.role_id=r.id and t.archived_at is null),
    'scene_count',jsonb_array_length(r.requirements->'scene_references'),'gender_unprovided',r.requirements->'gender_requirement'='null'::jsonb,
    'availability_unprovided',r.requirements->'availability_requirements'='null'::jsonb,'origin_job_matches',r.source_job_id=j.id,
    'row_version',r.row_version) order by r.sort_order,r.id) from eps.roles r where r.workspace_id=s.workspace_id and r.archived_at is null))
  from eps.specs s join sample j on j.resource_id=s.id),
 'events',(select jsonb_agg(jsonb_build_object('stage',e.stage,'type',e.event_type,'sequence',e.sequence,'receipt_status',e.receipt->>'job_status','created_at',e.created_at)
   order by e.created_at) from eps.job_events e join sample j on j.id=e.job_id),
 'outbox',(select jsonb_agg(jsonb_build_object('status',o.status,'dispatch_generation',o.dispatch_generation,'attempt_count',o.attempt_count,'delivered_at',o.delivered_at)
  order by o.dispatch_generation) from eps.outbox_events o join sample j on j.id=o.job_id)
) as live_specs;
rollback;
