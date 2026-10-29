-- Fixed metadata only: no source/fact/quote/provider payload, credential or lease.
begin isolation level repeatable read read only;
set local statement_timeout='20s';
set local search_path='';
set local timezone='UTC';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941','20261029070038']::text[]
  or not exists(select 1 from eps.specs s join eps.workspaces w on w.id=s.workspace_id join public.projects p on p.id=w.project_id
   where s.id='73a1a500-acfe-48cc-91ba-53a83b895118' and w.id='098d5b48-42a3-475b-b562-735c9eafce80'
    and p.id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463' and w.archived_at is null and p.archived_at is null)
 then raise exception 'SPECS_PROTECTION_FIXED_SCOPE_UNCONFIRMED'; end if;
end $$;
select jsonb_build_object('query_role',current_user,'database',current_database(),
 'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
 'workspace_id','098d5b48-42a3-475b-b562-735c9eafce80','project_id','4b70c8ce-18bd-4a8c-b5a9-bc1156c06463',
 'workspace',(select jsonb_build_object('row_version',w.row_version,'draft_revision',w.draft_revision)
  from eps.workspaces w where w.id='098d5b48-42a3-475b-b562-735c9eafce80'),
 'spec',(select jsonb_build_object('spec_id',s.id,'row_version',s.row_version,'source_row_version',s.source_row_version,
  'source_asset_id',s.source_asset_id,'processing_job_id',s.processing_job_id,'source_extraction_job_id',s.source_extraction_job_id,
  'source_text_sha256',encode(sha256(convert_to(s.source_text,'UTF8')),'hex'),
  'general_instructions_sha256',encode(sha256(convert_to(s.normalized_instructions,'UTF8')),'hex'),
  'clarifications_sha256',encode(sha256(convert_to(s.clarifications::text,'UTF8')),'hex'),
  'source_extraction_sha256',encode(sha256(convert_to(s.source_extraction::text,'UTF8')),'hex'))
  from eps.specs s where s.id='73a1a500-acfe-48cc-91ba-53a83b895118'),
 'roles',(select coalesce(jsonb_agg(jsonb_build_object('role_id',r.id,'spec_id',r.spec_id,'row_version',r.row_version,
  'archived',r.archived_at is not null,'sort_order',r.sort_order,'headcount',r.headcount,'source_job_id',r.source_job_id,
  'name_sha256',encode(sha256(convert_to(r.name,'UTF8')),'hex'),
  'requirements_sha256',encode(sha256(convert_to(r.requirements::text,'UTF8')),'hex'),
  'clarifications_sha256',encode(sha256(convert_to(r.clarifications::text,'UTF8')),'hex'),
  'source_role_sha256',encode(sha256(convert_to(r.source_role::text,'UTF8')),'hex'),
  'evidence_sha256',encode(sha256(convert_to((r.source_role->'evidence')::text,'UTF8')),'hex')) order by r.id),'[]')
  from eps.roles r where r.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
 'slots',(select coalesce(jsonb_agg(jsonb_build_object('slot_id',s.id,'role_id',s.role_id,'row_version',s.row_version,
  'archived',s.archived_at is not null,'ordinal',s.ordinal,'sort_order',s.sort_order,'provisional',s.provisional,
  'label_sha256',encode(sha256(convert_to(s.label,'UTF8')),'hex')) order by s.id),'[]')
  from eps.slots s where s.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'),
 'jobs',(select coalesce(jsonb_agg(jsonb_build_object('job_id',j.id,'row_version',j.row_version,'status',j.status,'stage',j.stage,
  'source_asset_id',j.input_asset_id,'source_row_version',j.input->'source_row_version','current_attempt_id',j.current_attempt_id,
  'error_code',case when j.error is null then null when j.error->>'code' in('INPUT_CHANGED','INPUT_HASH_MISMATCH','RESULT_INVALID',
    'DEPENDENCY_UNAVAILABLE','SOURCE_UNREADABLE','RETRY_EXHAUSTED','JOB_CANCELLED','STAGE_FAILED','DOCUMENT_VISION_REQUIRED')
    then j.error->>'code' else 'UNRECOGNIZED' end,
  'stage_attempts',jsonb_build_object('prepare_document',coalesce(j.stage_attempts->'prepare_document','0'),
    'extract_specs',coalesce(j.stage_attempts->'extract_specs','0'),'apply_specs',coalesce(j.stage_attempts->'apply_specs','0')),
  'completed_stages',(select coalesce(jsonb_agg(v.value->>'stage' order by v.ordinal),'[]')
    from jsonb_array_elements(j.completed_stages) with ordinality v(value,ordinal)),
  'provider_usage',(select jsonb_build_object('metadata_rows',count(*),
    'input_tokens',coalesce(sum((p.result#>>'{metadata,usage,input_tokens}')::bigint),0),
    'output_tokens',coalesce(sum((p.result#>>'{metadata,usage,output_tokens}')::bigint),0),
    'total_tokens',coalesce(sum((p.result#>>'{metadata,usage,total_tokens}')::bigint),0))
    from eps.specs_stage_payloads p where p.job_id=j.id and p.stage='extract_specs'),
  'created_at',j.created_at,'updated_at',j.updated_at) order by j.created_at,j.id),'[]')
  from eps.jobs j where j.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'
   and j.resource_id='73a1a500-acfe-48cc-91ba-53a83b895118' and j.kind='specs_extract'),
 'uploads',(select coalesce(jsonb_agg(jsonb_build_object('upload_id',u.id,'asset_id',a.id,'status',u.status,'asset_status',a.status,
  'reservation_revision',u.reservation_revision,'spec_row_version',u.spec_row_version,'mime_type',u.expected_mime_type,
  'expected_size_bytes',u.expected_size_bytes,'expected_sha256',u.expected_sha256,'stored_sha256',a.sha256,
  'created_at',u.created_at,'expires_at',u.expires_at,'completed_at',u.completed_at) order by u.created_at,u.id),'[]')
  from eps.specs_upload_sessions u join eps.media_assets a on a.id=u.asset_id
  where u.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80')
) as specs_protection;
rollback;
