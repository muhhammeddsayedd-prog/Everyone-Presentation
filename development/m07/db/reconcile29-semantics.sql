-- Read-only proof of the exact observed dump/restore differences. No mutation.
begin isolation level repeatable read read only;set local search_path='';
select jsonb_build_object(
 'table_acl',(select jsonb_build_object('owner',relowner::regrole::text,'raw_acl',relacl::text,
   'default_acl',acldefault('r',relowner)::text,'explicit_equals_owner_default',relacl=acldefault('r',relowner))
   from pg_class where oid='eps.cast_operation_notes'::regclass),
 'boolean_associativity',(select jsonb_build_object('cases',count(*),'all_equal',bool_and(((a and b)and c)is not distinct from(a and b and c)))
   from unnest(array[true,false,null::boolean])a cross join unnest(array[true,false,null::boolean])b cross join unnest(array[true,false,null::boolean])c),
 'constraint_boundary_values',(select jsonb_build_object('cases',count(*),'all_equal',bool_and(
   ((value is null)or(((length(value)>=1)and(length(value)<=200))and(value=btrim(value))))
   is not distinct from((value is null)or((length(value)>=1)and(length(value)<=200)and(value=btrim(value))))))
   from unnest(array[null::text,'',' ','a',' a','a ',repeat('x',200),repeat('x',201),'synthetic-model-v1'])value),
 'immutable_functions',(select jsonb_object_agg(oid::regprocedure::text,provolatile='i')from pg_proc where oid in('pg_catalog.length(text)'::regprocedure,'pg_catalog.btrim(text)'::regprocedure)),
 'constraint_definitions',(select jsonb_object_agg(conname,pg_get_constraintdef(oid))from pg_constraint
   where conrelid='eps.specs_pipeline_config'::regclass and conname in(
    'specs_pipeline_config_model_version_check','specs_pipeline_config_prompt_version_check',
    'specs_pipeline_config_result_schema_version_check','specs_pipeline_config_document_preparation_version_check')),
 'history_count',(select count(*)from supabase_migrations.schema_migrations),
 'candidate_absent',to_regclass('eps.app_settings')is null and to_regclass('eps.mcp_oauth_resources')is null
)as m07_semantic_comparison;
rollback;
