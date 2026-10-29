-- M04 fixed review release compact metadata readback. Only SELECTs in one READ ONLY snapshot.
-- All existing business rows/fields are fingerprinted; personal payloads are never returned.
-- Managed Auth/HMAC secret bytes are excluded. Support key counts + explicit lifecycle
-- metadata only; no secret/key digest, API token or private source URL is projected.
begin isolation level repeatable read read only;
set local statement_timeout='30s';
set local search_path='';
set local timezone='UTC';
do $release$
declare catalogue jsonb; data_counts jsonb:='{}'; data_hashes jsonb:='{}'; relation record;
 amount bigint; checksum text; assets_state jsonb; runtime_state jsonb; source_config jsonb; added_fields_null boolean:=true; remaining_state jsonb; protected_state jsonb; metadata_rows jsonb;
begin
 for relation in select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where c.relkind in('r','p') and (n.nspname='eps' or n.nspname='public' and c.relname in
   ('clients','projects','project_memberships','client_memberships','app_capability_grants')
   or n.nspname='auth' and c.relname='users' or n.nspname='storage' and c.relname in('buckets','objects'))
  order by n.nspname,c.relname loop
  execute format('select count(*) from %I.%I',relation.nspname,relation.relname) into amount;
  data_counts:=data_counts||jsonb_build_object(relation.nspname||'.'||relation.relname,amount);
  -- Never fingerprint managed Auth rows or verification/grant secrets.
  -- Nonsecret key/grant lifecycle metadata is fingerprinted separately below.
  if relation.nspname='auth' or relation.relname in('logo_verification_keys','specs_verification_keys','support_verification_keys','specs_asset_grants') then continue; end if;
  -- Every existing business/media/source/queue/preparation field is fingerprinted.
  execute format('select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(row_value)::text,E''\n'' order by to_jsonb(row_value)::text),''''),''UTF8'')),''hex'') from %I.%I row_value',relation.nspname,relation.relname) into checksum;
  -- All17 candidate fields are now established business data. Preserve every field.
  -- The new support bucket is checked separately; hash every pre-existing bucket row.
  data_hashes:=data_hashes||jsonb_build_object(relation.nspname||'.'||relation.relname,checksum);
 end loop;


 select data_hashes || jsonb_build_object(
  'eps.logo_verification_keys:metadata',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(k)::text,E'\n' order by to_jsonb(k)::text),''),'UTF8')),'hex') from (select key_id,purpose,not_before,not_after,revoked_at,created_at from eps.logo_verification_keys) k),
  'eps.specs_verification_keys:metadata',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(k)::text,E'\n' order by to_jsonb(k)::text),''),'UTF8')),'hex') from (select key_id,purpose,not_before,not_after,revoked_at,created_at from eps.specs_verification_keys) k),
  'eps.specs_asset_grants:metadata',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(g)::text,E'\n' order by to_jsonb(g)::text),''),'UTF8')),'hex') from (select id,job_id,attempt_id,input_hash,asset_id,bucket,object_key,permission,created_at,expires_at,revoked_at from eps.specs_asset_grants) g)
 ) into data_hashes;

 select jsonb_build_object('name',r.rolname,'login',r.rolcanlogin,'inherit',r.rolinherit,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,
  'create_db',r.rolcreatedb,'create_role',r.rolcreaterole,'replication',r.rolreplication,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,
  'parents',(select coalesce(jsonb_agg(jsonb_build_object('name',p.rolname,'grantor',pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by p.rolname),'[]')
    from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=r.oid),
  'incoming',(select coalesce(jsonb_agg(jsonb_build_object('name',p.rolname,'grantor',pg_get_userbyid(m.grantor),'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option) order by p.rolname,m.admin_option,m.inherit_option,m.set_option),'[]')
    from pg_auth_members m join pg_roles p on p.oid=m.member where m.roleid=r.oid),
  'settings',(select coalesce(jsonb_agg(jsonb_build_object('database',s.setdatabase,
    'values',(select coalesce(jsonb_agg(value order by value),'[]') from unnest(s.setconfig) entries(value)
      where split_part(value,'=',1) in('log_statement','log_parameter_max_length','log_parameter_max_length_on_error','log_min_error_statement',
        'log_min_duration_statement','auto_explain.log_min_duration','auto_explain.log_parameter_max_length','auto_explain.log_nested_statements','pg_stat_statements.track')),
    'unknown_setting',exists(select 1 from unnest(s.setconfig) entries(value) where split_part(value,'=',1) not in
      ('log_statement','log_parameter_max_length','log_parameter_max_length_on_error','log_min_error_statement','log_min_duration_statement',
       'auto_explain.log_min_duration','auto_explain.log_parameter_max_length','auto_explain.log_nested_statements','pg_stat_statements.track'))) order by s.setdatabase),'[]')
    from pg_db_role_setting s where s.setrole=r.oid),
  'schema_create',exists(select 1 from pg_namespace n where n.nspname in('eps','public','auth','storage') and has_schema_privilege(r.oid,n.oid,'CREATE')),
  'table_authority',exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p')
    and(n.nspname='eps' or n.nspname='public' and c.relname in('clients','projects','project_memberships','client_memberships','app_capability_grants') or n.nspname='storage' and c.relname in('buckets','objects') or n.nspname='auth' and c.relname='users')
    and(has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN') or has_any_column_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES'))),
  'execute',(select coalesce(jsonb_agg(n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' order by n.nspname,p.proname,oidvectortypes(p.proargtypes)),'[]')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='eps' or n.nspname='public' and p.proname like 'eps\_%' escape '\') and has_function_privilege(r.oid,p.oid,'EXECUTE')))
 into runtime_state from pg_roles r where r.rolname='eps_specs_runtime';

 select to_jsonb(c) into source_config from eps.specs_pipeline_config c where id=1;
 if to_regclass('eps.specs_asset_config') is not null then
  execute $assets$select jsonb_build_object('config',(select to_jsonb(c) from eps.specs_asset_config c where id=1),
   'keys',(select count(*) from eps.specs_verification_keys),'uploads',(select count(*) from eps.specs_upload_sessions),
   'grants',(select count(*) from eps.specs_asset_grants),'preparations',(select count(*) from eps.specs_file_preparations))$assets$ into assets_state;
  execute $pristine$select not exists(select 1 from eps.media_assets where source_asset_id is not null or producing_job_id is not null
    or producing_attempt_id is not null or output_stage is not null or output_key is not null)
   and not exists(select 1 from eps.specs_source_inputs where source_asset_id is not null or source_mime_type is not null or source_size_bytes is not null)$pristine$ into added_fields_null;
 end if;

 remaining_state:=jsonb_build_object('frame_config',null,'support_config',null,'support_verification_keys','[]'::jsonb,
  'support_bucket',(select jsonb_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) from storage.buckets where id='eps-candidate-support'));
 if to_regclass('eps.frame_extraction_config') is not null then
  execute $frame$select to_jsonb(c) from eps.frame_extraction_config c where id$frame$ into metadata_rows;
  remaining_state:=remaining_state||jsonb_build_object('frame_config',metadata_rows);
 end if;
 if to_regclass('eps.candidate_support_config') is not null then
  execute $support$select to_jsonb(c) from eps.candidate_support_config c where id$support$ into metadata_rows;
  remaining_state:=remaining_state||jsonb_build_object('support_config',metadata_rows);
 end if;
 if to_regclass('eps.support_verification_keys') is not null then
  -- Explicit metadata projection only. Do not SELECT, hash or serialize secret bytes.
  execute $keys$select coalesce(jsonb_agg(to_jsonb(k) order by key_id),'[]') from
   (select key_id,purpose,not_before,not_after,revoked_at,created_at from eps.support_verification_keys) k$keys$ into metadata_rows;
  remaining_state:=remaining_state||jsonb_build_object('support_verification_keys',metadata_rows);
  execute $keys_hash$select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(k)::text,E'\n' order by to_jsonb(k)::text),''),'UTF8')),'hex') from
   (select key_id,purpose,not_before,not_after,revoked_at,created_at from eps.support_verification_keys) k$keys_hash$ into checksum;
  data_hashes:=data_hashes||jsonb_build_object('eps.support_verification_keys:metadata',checksum);
 end if;
 select jsonb_build_object('job_id','b3f90268-147d-41d4-8875-2a6435df1496',
  'job_exists',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'job_sha256',(select encode(sha256(convert_to(to_jsonb(j)::text,'UTF8')),'hex') from eps.jobs j where id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'specs_id',(select resource_id from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'specs_sha256',(select encode(sha256(convert_to(to_jsonb(s)::text,'UTF8')),'hex') from eps.specs s join eps.jobs j on j.resource_id=s.id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'manual_note_retained',coalesce((select position('Manual verification: preserve this instruction while extraction is pending.' in coalesce(s.normalized_instructions,''))>0 from eps.specs s join eps.jobs j on j.resource_id=s.id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'),false),
  'source_inputs_count',(select count(*) from eps.specs_source_inputs where job_id='b3f90268-147d-41d4-8875-2a6435df1496'),
  'source_inputs_sha256',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(i)::text,E'\n' order by to_jsonb(i)::text),''),'UTF8')),'hex') from eps.specs_source_inputs i where job_id='b3f90268-147d-41d4-8875-2a6435df1496')) into protected_state;
 perform set_config('eps.read_operation_release.snapshot',jsonb_build_object('query_role',current_user,'database',current_database(),
  'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
  'versions',(select jsonb_agg(version order by version) from supabase_migrations.schema_migrations),
  'candidate_buckets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id),'[]') from storage.buckets where id in('eps-candidate-assets','eps-candidate-outputs')),
  'candidate_processing_issues_pristine',not exists(select 1 from eps.candidate_media m where coalesce(to_jsonb(m)->'processing_issues','[]'::jsonb)<>'[]'::jsonb),
  'schema_defaults',(select jsonb_object_agg(n.nspname,jsonb_build_object(
   'public_usage',exists(select 1 from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner)))a where a.grantee=0 and a.privilege_type='USAGE'),
   'public_create',exists(select 1 from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner)))a where a.grantee=0 and a.privilege_type='CREATE'),
   'authenticated_usage',has_schema_privilege('authenticated',n.oid,'USAGE'),'authenticated_create',has_schema_privilege('authenticated',n.oid,'CREATE'))order by n.nspname)
   from pg_namespace n where n.nspname in('eps','public','auth','storage','extensions')),
  'managed_auth',(select jsonb_build_object('owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'forced_rls',c.relforcerowsecurity,'acl',c.relacl::text,
   'policies',(select coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,
    'roles',(select jsonb_agg(case when roleid=0 then 'PUBLIC'else pg_get_userbyid(roleid)end order by roleid)from unnest(p.polroles)r(roleid)),
    'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid))order by p.polname),'[]')from pg_policy p where p.polrelid=c.oid))
   from pg_class c where c.oid='auth.users'::regclass),
  'remaining',remaining_state,'protected_m02',protected_state,'catalog',catalogue,'counts',data_counts,'data_sha256',data_hashes,'runtime',runtime_state,'source_config',source_config,'assets',assets_state,
  'release_additions_pristine',added_fields_null,
  'buckets',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'public',public,'file_size_limit',file_size_limit,'allowed_mime_types',allowed_mime_types) order by id),'[]') from storage.buckets where id in('eps-specs-assets','eps-specs-outputs')))::text,true);
end $release$;
do $compact_review_catalog$
declare mapped jsonb; protected jsonb; selected jsonb; config jsonb; template jsonb;
 excluded jsonb:='["columns|eps.assignments.id|acl","columns|eps.candidate_media.id|acl","columns|eps.candidate_media_frames.candidate_media_id|acl","columns|eps.candidates.id|acl","columns|eps.jobs.id|acl","columns|eps.media_assets.id|acl","columns|eps.presentation_templates.key|acl","columns|eps.roles.id|acl","columns|eps.slots.id|acl","columns|eps.specs.id|acl","columns|eps.workspace_candidates.id|acl","columns|public.clients.id|acl","columns|public.projects.id|acl","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|acl","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|argument_defaults","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|config","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|definer","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|identity_arguments","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|kind","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|language","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|leakproof","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|owner","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|parallel","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|returns","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|source_sha256","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|strict","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|support","functions|eps.assert_assignment_ai_apply(uuid,jsonb)|volatility","functions|public.eps_update_assignment(uuid,jsonb,text)|source_sha256","policies|eps.assignments.review_apply_source_lock|cmd","policies|eps.assignments.review_apply_source_lock|permissive","policies|eps.assignments.review_apply_source_lock|qual","policies|eps.assignments.review_apply_source_lock|roles","policies|eps.assignments.review_apply_source_lock|with_check","policies|eps.assignments.review_apply_source_no_write|cmd","policies|eps.assignments.review_apply_source_no_write|permissive","policies|eps.assignments.review_apply_source_no_write|qual","policies|eps.assignments.review_apply_source_no_write|roles","policies|eps.assignments.review_apply_source_no_write|with_check","policies|eps.candidate_media.review_apply_source_lock|cmd","policies|eps.candidate_media.review_apply_source_lock|permissive","policies|eps.candidate_media.review_apply_source_lock|qual","policies|eps.candidate_media.review_apply_source_lock|roles","policies|eps.candidate_media.review_apply_source_lock|with_check","policies|eps.candidate_media.review_apply_source_no_write|cmd","policies|eps.candidate_media.review_apply_source_no_write|permissive","policies|eps.candidate_media.review_apply_source_no_write|qual","policies|eps.candidate_media.review_apply_source_no_write|roles","policies|eps.candidate_media.review_apply_source_no_write|with_check","policies|eps.candidate_media_frames.review_apply_source_lock|cmd","policies|eps.candidate_media_frames.review_apply_source_lock|permissive","policies|eps.candidate_media_frames.review_apply_source_lock|qual","policies|eps.candidate_media_frames.review_apply_source_lock|roles","policies|eps.candidate_media_frames.review_apply_source_lock|with_check","policies|eps.candidate_media_frames.review_apply_source_no_write|cmd","policies|eps.candidate_media_frames.review_apply_source_no_write|permissive","policies|eps.candidate_media_frames.review_apply_source_no_write|qual","policies|eps.candidate_media_frames.review_apply_source_no_write|roles","policies|eps.candidate_media_frames.review_apply_source_no_write|with_check","policies|eps.candidates.review_apply_source_lock|cmd","policies|eps.candidates.review_apply_source_lock|permissive","policies|eps.candidates.review_apply_source_lock|qual","policies|eps.candidates.review_apply_source_lock|roles","policies|eps.candidates.review_apply_source_lock|with_check","policies|eps.candidates.review_apply_source_no_write|cmd","policies|eps.candidates.review_apply_source_no_write|permissive","policies|eps.candidates.review_apply_source_no_write|qual","policies|eps.candidates.review_apply_source_no_write|roles","policies|eps.candidates.review_apply_source_no_write|with_check","policies|eps.jobs.review_apply_source_lock|cmd","policies|eps.jobs.review_apply_source_lock|permissive","policies|eps.jobs.review_apply_source_lock|qual","policies|eps.jobs.review_apply_source_lock|roles","policies|eps.jobs.review_apply_source_lock|with_check","policies|eps.jobs.review_apply_source_no_write|cmd","policies|eps.jobs.review_apply_source_no_write|permissive","policies|eps.jobs.review_apply_source_no_write|qual","policies|eps.jobs.review_apply_source_no_write|roles","policies|eps.jobs.review_apply_source_no_write|with_check","policies|eps.media_assets.review_apply_source_lock|cmd","policies|eps.media_assets.review_apply_source_lock|permissive","policies|eps.media_assets.review_apply_source_lock|qual","policies|eps.media_assets.review_apply_source_lock|roles","policies|eps.media_assets.review_apply_source_lock|with_check","policies|eps.media_assets.review_apply_source_no_write|cmd","policies|eps.media_assets.review_apply_source_no_write|permissive","policies|eps.media_assets.review_apply_source_no_write|qual","policies|eps.media_assets.review_apply_source_no_write|roles","policies|eps.media_assets.review_apply_source_no_write|with_check","policies|eps.presentation_templates.review_apply_source_lock|cmd","policies|eps.presentation_templates.review_apply_source_lock|permissive","policies|eps.presentation_templates.review_apply_source_lock|qual","policies|eps.presentation_templates.review_apply_source_lock|roles","policies|eps.presentation_templates.review_apply_source_lock|with_check","policies|eps.presentation_templates.review_apply_source_no_write|cmd","policies|eps.presentation_templates.review_apply_source_no_write|permissive","policies|eps.presentation_templates.review_apply_source_no_write|qual","policies|eps.presentation_templates.review_apply_source_no_write|roles","policies|eps.presentation_templates.review_apply_source_no_write|with_check","policies|eps.roles.review_apply_source_lock|cmd","policies|eps.roles.review_apply_source_lock|permissive","policies|eps.roles.review_apply_source_lock|qual","policies|eps.roles.review_apply_source_lock|roles","policies|eps.roles.review_apply_source_lock|with_check","policies|eps.roles.review_apply_source_no_write|cmd","policies|eps.roles.review_apply_source_no_write|permissive","policies|eps.roles.review_apply_source_no_write|qual","policies|eps.roles.review_apply_source_no_write|roles","policies|eps.roles.review_apply_source_no_write|with_check","policies|eps.slots.review_apply_source_lock|cmd","policies|eps.slots.review_apply_source_lock|permissive","policies|eps.slots.review_apply_source_lock|qual","policies|eps.slots.review_apply_source_lock|roles","policies|eps.slots.review_apply_source_lock|with_check","policies|eps.slots.review_apply_source_no_write|cmd","policies|eps.slots.review_apply_source_no_write|permissive","policies|eps.slots.review_apply_source_no_write|qual","policies|eps.slots.review_apply_source_no_write|roles","policies|eps.slots.review_apply_source_no_write|with_check","policies|eps.specs.review_apply_source_lock|cmd","policies|eps.specs.review_apply_source_lock|permissive","policies|eps.specs.review_apply_source_lock|qual","policies|eps.specs.review_apply_source_lock|roles","policies|eps.specs.review_apply_source_lock|with_check","policies|eps.specs.review_apply_source_no_write|cmd","policies|eps.specs.review_apply_source_no_write|permissive","policies|eps.specs.review_apply_source_no_write|qual","policies|eps.specs.review_apply_source_no_write|roles","policies|eps.specs.review_apply_source_no_write|with_check","policies|eps.workspace_candidates.review_apply_source_lock|cmd","policies|eps.workspace_candidates.review_apply_source_lock|permissive","policies|eps.workspace_candidates.review_apply_source_lock|qual","policies|eps.workspace_candidates.review_apply_source_lock|roles","policies|eps.workspace_candidates.review_apply_source_lock|with_check","policies|eps.workspace_candidates.review_apply_source_no_write|cmd","policies|eps.workspace_candidates.review_apply_source_no_write|permissive","policies|eps.workspace_candidates.review_apply_source_no_write|qual","policies|eps.workspace_candidates.review_apply_source_no_write|roles","policies|eps.workspace_candidates.review_apply_source_no_write|with_check","policies|public.clients.review_apply_source_lock|cmd","policies|public.clients.review_apply_source_lock|permissive","policies|public.clients.review_apply_source_lock|qual","policies|public.clients.review_apply_source_lock|roles","policies|public.clients.review_apply_source_lock|with_check","policies|public.clients.review_apply_source_no_write|cmd","policies|public.clients.review_apply_source_no_write|permissive","policies|public.clients.review_apply_source_no_write|qual","policies|public.clients.review_apply_source_no_write|roles","policies|public.clients.review_apply_source_no_write|with_check","policies|public.projects.review_apply_source_lock|cmd","policies|public.projects.review_apply_source_lock|permissive","policies|public.projects.review_apply_source_lock|qual","policies|public.projects.review_apply_source_lock|roles","policies|public.projects.review_apply_source_lock|with_check","policies|public.projects.review_apply_source_no_write|cmd","policies|public.projects.review_apply_source_no_write|permissive","policies|public.projects.review_apply_source_no_write|qual","policies|public.projects.review_apply_source_no_write|roles","policies|public.projects.review_apply_source_no_write|with_check"]'::jsonb;
begin
-- Metadata only. No source bodies, Auth identities, credentials or business rows.
-- Caller fixes search_path and owns the transaction. Object keys exclude OIDs.
with nested as(select jsonb_build_object(
 'functions',(select coalesce(jsonb_object_agg(signature,metadata),'{}')from(
  select p.oid::regprocedure::text signature,jsonb_build_object('owner',p.proowner::regrole::text,'language',(select lanname from pg_language where oid=p.prolang),'returns',pg_get_function_result(p.oid),'identity_arguments',pg_get_function_identity_arguments(p.oid),'argument_defaults',pg_get_expr(p.proargdefaults,0),'strict',p.proisstrict,'parallel',p.proparallel,'leakproof',p.proleakproof,'kind',p.prokind,'support',case when p.prosupport=0 then null else p.prosupport::regproc::text end,'definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'acl',p.proacl::text,'source_sha256',encode(sha256(convert_to(replace(p.prosrc,E'\r\n',E'\n'),'UTF8')),'hex'))metadata
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')or n.nspname='storage'and p.proname in('operation','allow_only_operation','allow_any_operation'))s),
 'tables',(select coalesce(jsonb_object_agg(name,metadata),'{}')from(
  select n.nspname||'.'||c.relname name,jsonb_build_object('owner',c.relowner::regrole::text,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'acl',c.relacl::text)metadata
  from pg_class c join pg_namespace n on n.oid=c.relnamespace where(n.nspname in('eps','public')or n.nspname='storage'and c.relname in('objects','buckets'))and c.relkind='r')s),
 'columns',(select coalesce(jsonb_object_agg(n.nspname||'.'||c.relname||'.'||a.attname,jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'acl',a.attacl::text,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid))),'{}')from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where(n.nspname in('eps','public')or n.nspname='storage'and c.relname in('objects','buckets'))and c.relkind='r'and a.attnum>0 and not a.attisdropped),
 'policies',(select coalesce(jsonb_object_agg(schemaname||'.'||tablename||'.'||policyname,to_jsonb(p)-'schemaname'-'tablename'-'policyname'),'{}')from pg_policies p where schemaname in('eps','public','storage')),
 'constraints',(select coalesce(jsonb_object_agg(n.nspname||'.'||c.relname||'.'||k.conname,jsonb_build_object('definition',replace(pg_get_constraintdef(k.oid),E'\r\n',E'\n'))),'{}')from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('eps','public')or n.nspname='storage'and c.relname in('objects','buckets')),
 'indexes',(select coalesce(jsonb_object_agg(n.nspname||'.'||c.relname,jsonb_build_object('definition',replace(pg_get_indexdef(c.oid),E'\r\n',E'\n'),'valid',i.indisvalid,'ready',i.indisready,'live',i.indislive)),'{}')from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace join pg_class t on t.oid=i.indrelid where n.nspname in('eps','public')or n.nspname='storage'and t.relname in('objects','buckets')),
 'triggers',(select coalesce(jsonb_object_agg(n.nspname||'.'||c.relname||'.'||t.tgname,jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)),'{}')from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where(n.nspname in('eps','public')or n.nspname='storage'and c.relname in('objects','buckets'))and not t.tgisinternal),
 'schemas',(select coalesce(jsonb_object_agg(nspname,jsonb_build_object('owner',nspowner::regrole::text,'acl',nspacl::text)),'{}')from pg_namespace where nspname in('eps','public','storage','auth','extensions')),
 'types',(select coalesce(jsonb_object_agg(n.nspname||'.'||t.typname,jsonb_build_object('owner',t.typowner::regrole::text,'kind',t.typtype,'acl',t.typacl::text,'base',case when t.typbasetype=0 then null else format_type(t.typbasetype,t.typtypmod)end,'not_null',t.typnotnull,'default',t.typdefault,'enum_labels',(select jsonb_agg(enumlabel order by enumsortorder)from pg_enum where enumtypid=t.oid))),'{}')from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in('eps','public')and t.typelem=0),
 'default_acl',(select coalesce(jsonb_object_agg(d.defaclrole::regrole::text||'/'||coalesce(n.nspname,'*')||'/'||d.defaclobjtype::text,jsonb_build_object('acl',d.defaclacl::text)),'{}')from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace where n.nspname in('eps','public','storage','auth','extensions')or d.defaclrole::regrole::text like'eps_%'),
 'roles',(select coalesce(jsonb_object_agg(rolname,jsonb_build_object('login',rolcanlogin,'super',rolsuper,'inherit',rolinherit,'bypassrls',rolbypassrls,'create_role',rolcreaterole,'create_db',rolcreatedb,'replication',rolreplication,'connection_limit',rolconnlimit,'valid_until',rolvaliduntil)),'{}')from pg_roles where rolname like'eps_%'),
 'memberships',(select coalesce(jsonb_object_agg(roleid::regrole::text||'>'||member::regrole::text||'/'||grantor::regrole::text,jsonb_build_object('grantor',grantor::regrole::text,'admin',admin_option,'inherit',inherit_option,'set',set_option)),'{}')from pg_auth_members where roleid::regrole::text like'eps_%'or member::regrole::text like'eps_%')
)payload),flat as(select category.key||'|'||object.key||'|'||field.key key,field.value from nested cross join lateral jsonb_each(payload)category cross join lateral jsonb_each(category.value)object cross join lateral jsonb_each(object.value)field)
select coalesce(jsonb_object_agg(key,value),'{}') into mapped from flat;
 select coalesce(jsonb_object_agg(key,value),'{}') into protected from jsonb_each(mapped) where not (excluded?key);
 select coalesce(jsonb_object_agg(key,value),'{}') into selected from jsonb_each(mapped) where excluded?key;
 if to_regclass('eps.review_processing_config')is not null then
  execute 'select to_jsonb(c)from eps.review_processing_config c where id' into config;
 end if;
 if to_regclass('eps.presentation_templates')is not null then
  execute $template$select to_jsonb(t)from eps.presentation_templates t where key='everyone-casting'and version='1.0.0'$template$ into template;
 end if;
 perform set_config('eps.review_release.compact_catalog',jsonb_build_object(
  'catalog_full_sha256',encode(sha256(convert_to(mapped::text,'UTF8')),'hex'),
  'catalog_protected_sha256',encode(sha256(convert_to(protected::text,'UTF8')),'hex'),
  'catalog_count',(select count(*)from jsonb_each(mapped)),
  'catalog_delta_values',selected,
  'review_state',jsonb_build_object('config',config,'template',template))::text,true);
end $compact_review_catalog$;
select (current_setting('eps.read_operation_release.snapshot')::jsonb-'catalog')
 ||current_setting('eps.review_release.compact_catalog')::jsonb as m04_ai_apply_release;
rollback;
