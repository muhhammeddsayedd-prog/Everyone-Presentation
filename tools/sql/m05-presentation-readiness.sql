-- Fixed read-only operational metadata for the root-owned local worker restart.
-- Waiting jobs are counted separately and are not claimed or changed here.
begin isolation level repeatable read read only;
set local search_path='';set local timezone='UTC';set local statement_timeout='15s';
select jsonb_build_object('schema_version','1.0','query_role',current_user,'database',current_database(),
 'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'presentation_processing',(select to_jsonb(c)from eps.presentation_processing_config c where id),
 'review_processing',(select to_jsonb(c)from eps.review_processing_config c where id),
 'template',(select jsonb_build_object('key',key,'version',version,'content_sha256',content_sha256,'font_key',font_key,'registered',registered,
  'row_sha256',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))from eps.presentation_templates t where key='everyone-casting'and version='1.1.0'),
 'active_jobs',jsonb_build_object('queued',(select count(*)from eps.jobs where status='queued'),'running',(select count(*)from eps.jobs where status='running'),
  'by_kind',(select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'status',status,'count',amount)order by kind,status),'[]')from
   (select kind,status,count(*)amount from eps.jobs where status in('queued','running')group by kind,status)counts)),
 'waiting_jobs',(select count(*)from eps.jobs where status='waiting_for_input'),
 'protected_m02',(select jsonb_build_object('id',id,'status',status,'row_sha256',encode(sha256(convert_to(to_jsonb(j)::text,'UTF8')),'hex'))
  from eps.jobs j where id='b3f90268-147d-41d4-8875-2a6435df1496'))as m05_presentation_readiness;
rollback;
