-- Fixed read-only readiness metadata, never source text or runtime credentials.
begin isolation level repeatable read read only;
set local search_path='';set local timezone='UTC';
select jsonb_build_object('schema_version','1.0','migration_version',(select max(version)from supabase_migrations.schema_migrations),'migration_count',(select count(*)from supabase_migrations.schema_migrations),
 'review_processing',(select to_jsonb(c)from eps.review_processing_config c where id),
 'template',(select jsonb_build_object('key',key,'version',version,'content_sha256',content_sha256,'font_key',font_key,'registered',registered,'row_sha256',encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'))from eps.presentation_templates t where key='everyone-casting'and version='1.0.0'));
rollback;
