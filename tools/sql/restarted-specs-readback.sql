-- Completed queued-before-launch app request. No source/provider payloads.
begin isolation level repeatable read read only;
set local statement_timeout='15s';
set local search_path='';
set local timezone='UTC';
with target as(select j.* from eps.jobs j join eps.workspaces w on w.id=j.workspace_id
 where j.id='1e1104aa-2e0f-4f6f-8bd3-7e04ac09e7ed' and j.kind='specs_extract' and j.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'
  and w.project_id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463'),
original as(select i.* from eps.specs_source_inputs i where i.job_id='3ba110dd-711c-4c7f-aa89-0f4578310543')
select jsonb_build_object('query_role',current_user,'database',current_database(),'target_count',(select count(*) from target),
 'job',(select jsonb_build_object('job_id',id,'workspace_id',workspace_id,'spec_id',resource_id,'status',status,'stage',stage,
   'attempt',attempt,'stage_attempts',stage_attempts,'last_n8n_execution_id',n8n_execution_id,'result',result,
   'completed_stages',(select jsonb_agg(jsonb_build_object('stage',value->'stage','attempt_id',value->'attempt_id','result_schema',value->'result_schema','completed_at',value->'completed_at') order by ordinal)
      from jsonb_array_elements(completed_stages) with ordinality entries(value,ordinal))) from target),
 'source',(select jsonb_build_object('source_sha256',i.source_hash,'bytes',octet_length(i.source_text),'source_row_version',i.source_row_version,
   'original_hash_verified',i.source_hash=j.input->>'source_hash' and i.source_hash=encode(sha256(convert_to(i.source_text,'UTF8')),'hex'),
   'original_input_retained',old.source_hash='2d267edd68d6b3e3bc1f0a0bf280abafdbc4a7148071f3528a4539673fb3d4fa'
      and old.source_hash=encode(sha256(convert_to(old.source_text,'UTF8')),'hex'),
   'matches_original_plus_label',i.source_text=old.source_text||E'\nSynthetic local worker restart and outbox recovery check, 2026-10-29. Requirements remain the same.',
   'matches_lf_normalized_original_plus_label',i.source_text=replace(replace(old.source_text,E'\r\n',E'\n'),E'\r',E'\n')||E'\nSynthetic local worker restart and outbox recovery check, 2026-10-29. Requirements remain the same.',
   'no_manufactured_asset',i.source_asset_id is null and j.input_asset_id is null,
   'arabic_preserved',i.source_text~('['||chr(1536)||'-'||chr(1791)||']'))
   from eps.specs_source_inputs i join target j on j.id=i.job_id cross join original old),
 'provider',(select jsonb_build_object('provider',p.result#>'{metadata,provider}','sdk_version',p.result#>'{metadata,sdk_version}',
   'requested_model',p.result#>'{metadata,requested_model}','resolved_model',p.result#>'{metadata,resolved_model}',
   'prompt_version',p.result#>'{metadata,prompt_version}','schema_version',p.result#>'{metadata,schema_version}',
   'prompt_sha256',p.result#>'{metadata,prompt_sha256}','schema_sha256',p.result#>'{metadata,schema_sha256}',
   'provider_schema_sha256',p.result#>'{metadata,provider_schema_sha256}','usage',p.result#>'{metadata,usage}',
   'response_reference_present',length(p.result#>>'{metadata,response_id}')>0,
   'frozen_model_matches',p.result#>>'{metadata,requested_model}'=j.input#>>'{configuration,model_version}',
   'input_hash_matches',p.result#>>'{metadata,input_sha256}'=j.input_hash)
   from eps.specs_stage_payloads p join target j on j.id=p.job_id where p.stage='extract_specs'),
 'outbox',(select jsonb_agg(jsonb_build_object('id',o.id,'stage',o.stage,'status',o.status,'generation',o.dispatch_generation,
   'attempt_count',o.attempt_count,'delivered_at',o.delivered_at,'input_hash_matches',o.input_hash=j.input_hash) order by o.dispatch_generation)
   from eps.outbox_events o join target j on j.id=o.job_id),
 'draft',(select jsonb_build_object('spec_id',s.id,'row_version',s.row_version,'source_row_version',s.source_row_version,
   'current_job_is_target',s.processing_job_id=j.id,'extraction_origin_is_target',s.source_extraction_job_id=j.id,
   'untouched_current_machine_facts',eps.specs_machine_baseline(s),
   'active_roles',(select count(*) from eps.roles where workspace_id=s.workspace_id and archived_at is null),
   'active_slots',(select count(*) from eps.slots where workspace_id=s.workspace_id and archived_at is null),
   'archived_roles',(select count(*) from eps.roles where workspace_id=s.workspace_id and archived_at is not null),
   'archived_slots',(select count(*) from eps.slots where workspace_id=s.workspace_id and archived_at is not null),
   'active_origins',(select coalesce(bool_and(r.source_job_id=j.id and r.row_version=1),false) from eps.roles r where r.workspace_id=s.workspace_id and r.archived_at is null),
   'original_roles_retained',(select count(*)=3 and bool_and(r.archived_at is not null and r.row_version=2
     and exists(select 1 from eps.specs_stage_payloads p cross join lateral jsonb_array_elements(p.result#>'{result,roles}') role(value)
      where p.job_id='3ba110dd-711c-4c7f-aa89-0f4578310543' and p.stage='extract_specs' and role.value=r.source_role))
      from eps.roles r where r.workspace_id=s.workspace_id and r.source_job_id='3ba110dd-711c-4c7f-aa89-0f4578310543'),
   'original_slots_retained',(select count(*)=5 and bool_and(t.archived_at is not null and t.row_version=2) from eps.slots t join eps.roles r on r.id=t.role_id
      where r.workspace_id=s.workspace_id and r.source_job_id='3ba110dd-711c-4c7f-aa89-0f4578310543')) from eps.specs s join target j on j.resource_id=s.id),
 'cancelled_predecessor',(select jsonb_build_object('job_id',j.id,'status',j.status,'attempt',j.attempt,'stage_attempts',j.stage_attempts,
   'n8n_execution_id',j.n8n_execution_id,'payloads',(select count(*) from eps.specs_stage_payloads p where p.job_id=j.id),
   'outbox_attempts',(select coalesce(sum(attempt_count),0) from eps.outbox_events o where o.job_id=j.id),
   'outbox_deliveries',(select count(*) from eps.outbox_events o where o.job_id=j.id and o.delivered_at is not null))
   from eps.jobs j where j.id='64788c14-ffab-44a5-94e1-5b7e512979c1' and j.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80')
) as restarted_specs;
rollback;
