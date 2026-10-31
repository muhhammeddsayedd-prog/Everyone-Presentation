-- Pure SELECT fragment. Renderer supplies only pinned public source manifests.
with expected_functions as(select * from jsonb_to_recordset(convert_from(decode('__FUNCTIONS_B64__','base64'),'UTF8')::jsonb)
 as f(name text,nargs integer,language text,security_definer boolean,volatility text,sha256 text,search_path_empty boolean)),
actual_functions as(select n.nspname||'.'||p.proname as name,p.pronargs::integer as nargs,l.lanname as language,
 p.prosecdef as security_definer,p.provolatile::text as volatility,
 encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex')as sha256,
 coalesce(p.proconfig=array['search_path=""']or p.proconfig=array['search_path='],false)as search_path_empty
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
 where n.nspname||'.'||p.proname in(select name from expected_functions)),
expected_triggers as(select * from jsonb_to_recordset(convert_from(decode('__TRIGGERS_B64__','base64'),'UTF8')::jsonb)
 as t("table" text,name text,"function" text,"type" integer,enabled text,nargs integer)),
actual_triggers as(select n.nspname||'.'||c.relname as "table",t.tgname::text as name,
 fn.nspname||'.'||p.proname as "function",t.tgtype::integer as "type",t.tgenabled::text as enabled,t.tgnargs::integer as nargs
 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 join pg_proc p on p.oid=t.tgfoid join pg_namespace fn on fn.oid=p.pronamespace
 where not t.tgisinternal and n.nspname||'.'||c.relname in(select jsonb_array_elements_text(convert_from(decode('__TABLES_B64__','base64'),'UTF8')::jsonb))),
function_difference as((select * from actual_functions except select * from expected_functions)
 union all(select * from expected_functions except select * from actual_functions)),
trigger_difference as((select * from actual_triggers except select * from expected_triggers)
 union all(select * from expected_triggers except select * from actual_triggers))
select jsonb_build_object('database',current_database(),'operator',current_user,
 'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'actor_id','0a79a703-caba-47e5-93d4-42e32197037a','project_id','6da14b82-8458-451f-aa21-28cb6c85bdc5','workspace_id','86936940-b48d-497d-b1ff-8e0da0913afa',
 'trust',jsonb_build_object('functions_count',(select count(*)from actual_functions),'functions_match',not exists(select 1 from function_difference),
  'triggers_count',(select count(*)from actual_triggers),'triggers_match',not exists(select 1 from trigger_difference)),
 'state',jsonb_build_object('spec_count',(select count(*)from eps.specs where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'),
  'spec_id',(select id from eps.specs where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'),
  'spec_row_version',(select row_version from eps.specs where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'),
  'source_present',(select source_text is not null or source_asset_id is not null from eps.specs where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'),
  'workspace_jobs',(select count(*)from eps.jobs where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'),
  'diagnostic_idempotency',(select count(*)from eps.idempotency_records where principal_id='0a79a703-caba-47e5-93d4-42e32197037a'and key='m07-specs-rollback-86936940-v1')),
 'fingerprints',jsonb_build_object(
  'spec',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n'order by s.id),''),'UTF8')),'hex'))from eps.specs s where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'),
  'jobs',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('id',j.id,'workspace_id',j.workspace_id,'resource_id',j.resource_id,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version)::text,E'\n'order by j.id),''),'UTF8')),'hex'))from eps.jobs j where workspace_id='86936940-b48d-497d-b1ff-8e0da0913afa'),
  'idempotency',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('principal_id',i.principal_id,'operation',i.operation,'response',i.response,'created_at',i.created_at,'expires_at',i.expires_at)::text,E'\n'order by i.operation,i.created_at,i.response::text),''),'UTF8')),'hex'))from eps.idempotency_records i where i.principal_id='0a79a703-caba-47e5-93d4-42e32197037a'and(i.key='m07-specs-rollback-86936940-v1'or i.response->>'resource_id'='3fc9b7a0-1d5d-41c3-8868-dff995ee861c')),
  'versions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(v)::text,E'\n'order by v.id),''),'UTF8')),'hex'))from eps.presentation_versions v),
  'slides',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(s)::text,E'\n'order by s.id),''),'UTF8')),'hex'))from eps.version_slides s),
  'pins',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(p)::text,E'\n'order by p.version_id,p.asset_id),''),'UTF8')),'hex'))from eps.presentation_version_assets p),
  'ready_asset_metadata',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('version_id',v.id,'asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'status',a.status)::text,E'\n'order by v.id,a.id),''),'UTF8')),'hex'))from eps.presentation_versions v join eps.presentation_version_assets p on p.version_id=v.id join eps.media_assets a on a.id=p.asset_id where v.status='ready'),
  'protected_m02',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('id',j.id,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,'resource_id',j.resource_id,'spec',to_jsonb(s))::text,E'\n'order by j.id),''),'UTF8')),'hex'))from eps.jobs j left join eps.specs s on s.id=j.resource_id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'))
)as specs_submit_state
