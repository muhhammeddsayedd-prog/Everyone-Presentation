-- One synthetic hosted brief. Metadata/counts only; no source/evidence/result text.
begin read only;
set local statement_timeout='20s';
set local search_path='';
select jsonb_build_object(
 'read_only',current_setting('transaction_read_only')='on',
 'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'job',(select jsonb_build_object('id',id,'kind',kind,'status',status,'stage',stage,
  'attempt',attempt,'resource_id',resource_id,'workspace_id',workspace_id,'created_at',created_at,
  'updated_at',updated_at,'n8n_execution_id',n8n_execution_id)from eps.jobs
  where id='35dcef5a-4717-4cdf-8cef-85f6940d0aec' and workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa' and kind='specs_extract'),
 'stages',(select jsonb_agg(jsonb_build_object('stage',stage,'attempt_id',attempt_id,
  'input_hash',input_hash,'result_schema',result_schema,'created_at',created_at,
  'metadata',result->'metadata','provider_metadata',result->'provider_metadata',
  'extraction_method',result->>'extraction_method','paragraph_count',result->'paragraph_count')order by created_at)
  from eps.specs_stage_payloads where job_id='35dcef5a-4717-4cdf-8cef-85f6940d0aec'),
 'role_count',(select count(*)from eps.roles where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'),
 'slot_count',(select count(*)from eps.slots s join eps.roles r on r.id=s.role_id
  where r.workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa')
)as hosted_specs_metadata;
rollback;
