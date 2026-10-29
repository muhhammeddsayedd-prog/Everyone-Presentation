begin isolation level repeatable read read only;
set local statement_timeout='15s';set local search_path='';
with target as(select * from eps.jobs where id='1515e047-9108-4069-a951-71aeec9fc554' and workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069' and kind='specs_extract')
select jsonb_build_object('observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),'target_count',(select count(*) from target),
 'job',(select jsonb_build_object('id',id,'status',status,'stage',stage,'stage_attempts',stage_attempts,'n8n_execution_id',n8n_execution_id,
 'completed_stages',(select jsonb_agg(jsonb_build_object('stage',entry->>'stage','schema',entry->>'result_schema') order by ordinal) from jsonb_array_elements(completed_stages) with ordinality v(entry,ordinal))) from target),
 'source',(select jsonb_build_object('sha256',i.source_hash,'hash_verified',i.source_hash=encode(sha256(convert_to(i.source_text,'UTF8')),'hex'),
 'arabic_preserved',i.source_text~('['||chr(1536)||'-'||chr(1791)||']'),'one_retained_source',(select count(*)=1 from eps.specs_source_inputs where job_id=j.id)) from eps.specs_source_inputs i join target j on i.job_id=j.id),
 'provider',(select jsonb_build_object('provider',p.result#>>'{metadata,provider}','sdk_version',p.result#>>'{metadata,sdk_version}',
 'requested_model',p.result#>>'{metadata,requested_model}','resolved_model',p.result#>>'{metadata,resolved_model}',
 'usage',p.result#>'{metadata,usage}','response_reference_present',length(p.result#>>'{metadata,response_id}')>0,
 'frozen_model_matches',p.result#>>'{metadata,requested_model}'=j.input#>>'{configuration,model_version}') from eps.specs_stage_payloads p join target j on j.id=p.job_id where p.stage='extract_specs'),
 'draft',(select jsonb_build_object('active_roles',(select count(*) from eps.roles where workspace_id=j.workspace_id and archived_at is null),
 'active_slots',(select count(*) from eps.slots where workspace_id=j.workspace_id and archived_at is null),
 'unknown_headcount',bool_and(r.headcount is null),'unknown_age',bool_and(r.requirements->'age_range'='null'::jsonb),
 'unknown_gender',bool_and(r.requirements->'gender_requirement'='null'::jsonb),'unknown_category',bool_and(r.category is null),
 'date_not_invented',bool_and(r.requirements->>'shoot_dates' like '%Friday%' and r.requirements->>'shoot_dates' not like '%2026-%'),
 'clarifications',sum(jsonb_array_length(r.clarifications))) from eps.roles r join target j on j.workspace_id=r.workspace_id where r.archived_at is null group by j.workspace_id),
 'http_attempt_events',jsonb_build_object('heartbeats',(select count(*) from eps.job_events where job_id='1515e047-9108-4069-a951-71aeec9fc554' and attempt_id='3c13b525-d8f2-4d9b-a054-d81102714f5a' and event_type='heartbeat'),
 'deliberate_failures',(select count(*) from eps.job_events where job_id='1515e047-9108-4069-a951-71aeec9fc554' and attempt_id='3c13b525-d8f2-4d9b-a054-d81102714f5a' and event_type='failed')),
 'outbox',(select jsonb_agg(jsonb_build_object('stage',o.stage,'status',o.status,'generation',o.dispatch_generation) order by o.dispatch_generation) from eps.outbox_events o join target j on j.id=o.job_id),
 'protected_source',jsonb_build_object('still_waiting',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496' and status='waiting_for_input' and error->>'code'='INPUT_CHANGED'),
 'manual_note_retained',exists(select 1 from eps.specs where workspace_id='098d5b48-42a3-475b-b562-735c9eafce80' and normalized_instructions like '%Manual verification: preserve this instruction while extraction is pending.%')))
 as proof;
rollback;
