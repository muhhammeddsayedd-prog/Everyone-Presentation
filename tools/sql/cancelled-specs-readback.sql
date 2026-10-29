-- One app-confirmed cancellation; metadata/boolean/hash output only.
begin isolation level repeatable read read only;
set local statement_timeout='15s';
set local search_path='';
set local timezone='UTC';
with target as(select j.* from eps.jobs j join eps.workspaces w on w.id=j.workspace_id
 where j.id='64788c14-ffab-44a5-94e1-5b7e512979c1' and j.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'
 and w.project_id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463' and j.kind='specs_extract'),
original as(select j.* from eps.jobs j where j.id='3ba110dd-711c-4c7f-aa89-0f4578310543'
 and j.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and j.kind='specs_extract')
select jsonb_build_object('query_role',current_user,'database',current_database(),'target_count',(select count(*) from target),
 'job',(select jsonb_build_object('id',id,'workspace_id',workspace_id,'resource_id',resource_id,'status',status,'stage',stage,
   'attempt',attempt,'stage_attempts',stage_attempts,'cancel_requested',cancel_requested_at is not null,'row_version',row_version,
   'n8n_execution_id',n8n_execution_id,'completed_stage_count',jsonb_array_length(completed_stages),'result_is_null',result is null) from target),
 'stage_event_count',(select count(*) from eps.job_events e join target j on j.id=e.job_id),
 'provider_or_preparation_payload_count',(select count(*) from eps.specs_stage_payloads p join target j on j.id=p.job_id),
 'private_file_preparation_count',(select count(*) from eps.specs_file_preparations p join target j on j.id=p.job_id),
 'outbox',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'stage',o.stage,'status',o.status,'attempt_count',o.attempt_count,
   'delivered',o.delivered_at is not null,'leased',o.lease_token_digest is not null) order by o.dispatch_generation),'[]') from eps.outbox_events o join target j on j.id=o.job_id),
 'original',(select jsonb_build_object('job_id',j.id,'status',j.status,'source_sha256',i.source_hash,
   'original_hash_verified',i.source_hash='2d267edd68d6b3e3bc1f0a0bf280abafdbc4a7148071f3528a4539673fb3d4fa'
    and i.source_hash=encode(sha256(convert_to(i.source_text,'UTF8')),'hex'),
   'source_version',i.source_row_version,'immutable_rows',(select count(*) from eps.specs_source_inputs r where r.job_id=j.id))
   from original j join eps.specs_source_inputs i on i.job_id=j.id),
 'draft',(select jsonb_build_object('spec_id',s.id,'row_version',s.row_version,'source_row_version',s.source_row_version,
   'current_job_is_cancelled_target',s.processing_job_id=j.id,'extraction_origin_job_id',s.source_extraction_job_id,
   'original_extraction_matches',s.source_extraction=(select p.result->'result' from eps.specs_stage_payloads p join original old on old.id=p.job_id where p.stage='extract_specs'),
   'untouched_machine_facts',eps.specs_machine_baseline(s),
   'active_role_count',(select count(*) from eps.roles r where r.workspace_id=s.workspace_id and r.archived_at is null),
   'active_slot_count',(select count(*) from eps.slots t where t.workspace_id=s.workspace_id and t.archived_at is null),
   'archived_role_count',(select count(*) from eps.roles r where r.workspace_id=s.workspace_id and r.archived_at is not null),
   'archived_slot_count',(select count(*) from eps.slots t where t.workspace_id=s.workspace_id and t.archived_at is not null),
   'role_origins',(select coalesce(jsonb_agg(jsonb_build_object('role_id',r.id,'source_job_id',r.source_job_id,'row_version',r.row_version,
      'source_role_matches',exists(select 1 from jsonb_array_elements(s.source_extraction->'roles') role(value) where role.value=r.source_role),
      'active_slots',(select count(*) from eps.slots t where t.role_id=r.id and t.archived_at is null),
      'slot_versions_unchanged',not exists(select 1 from eps.slots t where t.role_id=r.id and t.row_version<>1)) order by r.sort_order,r.id),'[]')
      from eps.roles r where r.workspace_id=s.workspace_id and r.archived_at is null)) from eps.specs s join target j on j.resource_id=s.id)
) as cancelled_specs;
rollback;
