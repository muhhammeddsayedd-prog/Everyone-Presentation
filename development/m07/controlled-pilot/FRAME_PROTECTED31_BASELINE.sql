-- Fixed read-only baseline for the one historical protected M02 job.
-- No source text, input/result JSON or credentials leave this query.
begin isolation level repeatable read read only;
set local search_path='';set local timezone='UTC';set local statement_timeout='30s';
select jsonb_build_object('database',current_database(),'operator',current_user,
 'history',(select array_agg(version order by version)from supabase_migrations.schema_migrations),
 'job_kind',j.kind,
 'job_projection_sha256',encode(sha256(convert_to(jsonb_build_object(
  'id',j.id,'kind',j.kind,'resource_id',j.resource_id,'input_asset_id',j.input_asset_id,
  'input',j.input,'input_hash',j.input_hash,'input_hash_version',j.input_hash_version,
  'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,
  'completed_stages',j.completed_stages,'result',j.result,'error',j.error)::text,'UTF8')),'hex'),
 'protected_m02',jsonb_build_object('id',j.id,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,
  'resource_id',j.resource_id,'manual_note_retained',position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0,
  'spec_sha256',encode(sha256(convert_to(jsonb_build_object('id',s.id,'row_version',s.row_version,'normalized_instructions',s.normalized_instructions)::text,'UTF8')),'hex'))
)as frame_protected31_baseline
from eps.jobs j join eps.specs s on s.id=j.resource_id
where j.id='b3f90268-147d-41d4-8875-2a6435df1496';
rollback;
