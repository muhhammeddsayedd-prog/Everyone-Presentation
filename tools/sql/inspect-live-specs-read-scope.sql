-- Read-only diagnosis of ONE existing owner-authorized PDF reservation.
-- No JWT/GUC/SET ROLE impersonation, source bytes, principal ID or key output.
begin read only;
set local statement_timeout='10s';
set local search_path='';
do $$ begin
 if current_user<>'postgres' or current_database()<>'postgres'
  or not exists(select 1 from pg_catalog.pg_roles where rolname=current_user and (rolsuper or rolbypassrls))
  or (select array_agg(version order by version) from supabase_migrations.schema_migrations) is distinct from
   array['20261028010943','20261028013324','20261028013655','20261028024205','20261028072515','20261028162702','20261028162800','20261028172320','20261028184145','20261028222030','20261029001520','20261029003941']::text[]
  or not exists(select 1 from eps.specs_upload_sessions u join eps.workspaces w on w.id=u.workspace_id
    where u.id='e2b251a0-a25c-4919-a722-28c6ff84f408' and u.asset_id='64e07944-43b9-46a0-aef2-92430a38773c'
     and w.id='098d5b48-42a3-475b-b562-735c9eafce80' and w.project_id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463')
 then raise exception 'LIVE_SPECS_READ_SCOPE_TARGET_UNCONFIRMED'; end if;
end $$;
with target as (
 select u.*,a.status asset_status,a.origin_workspace_id,a.purpose,a.size_bytes,a.mime_type,a.bucket asset_bucket,a.object_key asset_key,
  w.archived_at workspace_archived,p.archived_at project_archived,p.id project_id,s.row_version current_spec_version
 from eps.specs_upload_sessions u join eps.media_assets a on a.id=u.asset_id join eps.workspaces w on w.id=u.workspace_id
 join public.projects p on p.id=w.project_id join eps.specs s on s.workspace_id=w.id
 where u.id='e2b251a0-a25c-4919-a722-28c6ff84f408' and a.id='64e07944-43b9-46a0-aef2-92430a38773c'
), helpers as (
 select p.oid,p.oid::regprocedure::text identity,p.proowner::regrole::text owner,p.prosecdef,p.provolatile,p.proconfig,
  encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') definition_sha256
 from pg_catalog.pg_proc p where p.oid in('storage.allow_only_operation(text)'::regprocedure,'storage.operation()'::regprocedure,'eps.specs_storage_original_read(text,text)'::regprocedure)
)
select jsonb_build_object('observed_at',pg_catalog.clock_timestamp(),'query_role',current_user,'writes_requested',false,'user_impersonation_requested',false,
 'stored_principal_predicates',(select jsonb_build_object('bound_to_first_actual_requester',u.principal_id=(select requested_by from eps.jobs where id='3ba110dd-711c-4c7f-aa89-0f4578310543'),
  'current_auth_eligible',eps.job_requester_active(u.principal_id),'workspace_active',u.workspace_archived is null,'project_active',u.project_archived is null,
  'workspaces_read',exists(select 1 from public.app_capability_grants g where g.principal_id=u.principal_id and g.capability='workspaces.read' and g.active),
  'workspaces_write',exists(select 1 from public.app_capability_grants g where g.principal_id=u.principal_id and g.capability='workspaces.write' and g.active),
  'projects_read',exists(select 1 from public.app_capability_grants g where g.principal_id=u.principal_id and g.capability='projects.read' and g.active),
  'active_project_membership',exists(select 1 from public.project_memberships m where m.principal_id=u.principal_id and m.project_id=u.project_id and m.active),
  'writable_project_membership',exists(select 1 from public.project_memberships m where m.principal_id=u.principal_id and m.project_id=u.project_id and m.active and m.can_write),
  'session_open',u.status='open','session_unexpired',u.expires_at>pg_catalog.clock_timestamp(),'session_expires_at',u.expires_at,
  'spec_version_matches',u.spec_row_version=u.current_spec_version,'asset_uploading',u.asset_status='uploading','original_purpose',u.purpose='specs',
  'asset_workspace_matches',u.origin_workspace_id=u.workspace_id,'asset_path_matches',u.asset_bucket=u.bucket and u.asset_key=u.object_key) from target u),
 'object_metadata',(select jsonb_build_object('present',true,'size_matches',o.metadata->>'size'=u.expected_size_bytes::text,
   'mime_matches',o.metadata->>'mimetype'=u.expected_mime_type,
   'etag_matches_local_fixture_md5',lower(trim(both '"' from coalesce(o.metadata->>'eTag',o.metadata->>'etag','')))='58b7bd6382403580f6f1531a90983765')
  from storage.objects o join target u on o.bucket_id=u.bucket and o.name=u.object_key),
 'helper_catalog',(select jsonb_agg(jsonb_build_object('identity',h.identity,'owner',h.owner,'security_definer',h.prosecdef,'volatility',h.provolatile,
  'empty_search_path',coalesce(h.proconfig@>array['search_path=""'] or h.proconfig@>array['search_path='],false),
  'unexpected_function_settings',exists(select 1 from unnest(h.proconfig) config(value) where value not in('search_path=""','search_path=')),
  'definition_sha256',h.definition_sha256,
  'historical_definition_matches',case h.identity when 'storage.allow_only_operation(text)' then h.definition_sha256='a12f88ff4e00a9a63c24a93ea5b120e790be63a3555e840656c6525ff6dc0a85'
    when 'storage.operation()' then h.definition_sha256='45b3c213bf286ff7601da09fd91d246339d8c79e0bd573bfb6984d806841fcde' else null end) order by h.identity) from helpers h),
 'effective_helper_access',jsonb_build_object('authenticated_eps_usage',has_schema_privilege('authenticated','eps','USAGE'),
  'authenticated_original_read_execute',has_function_privilege('authenticated','eps.specs_storage_original_read(text,text)','EXECUTE'),
  'authenticated_operation_execute',has_function_privilege('authenticated','storage.allow_only_operation(text)','EXECUTE'),
  'owner_auth_usage',has_schema_privilege('eps_specs_upload_owner','auth','USAGE'),'owner_auth_uid_execute',has_function_privilege('eps_specs_upload_owner','auth.uid()','EXECUTE'),
  'owner_logo_scope_execute',has_function_privilege('eps_specs_upload_owner','eps.logo_scope(uuid,boolean)','EXECUTE'),
  'owner_media_select',has_table_privilege('eps_specs_upload_owner','eps.media_assets','SELECT'),
  'owner_upload_select',has_table_privilege('eps_specs_upload_owner','eps.specs_upload_sessions','SELECT')),
 'relations',(select jsonb_agg(jsonb_build_object('identity',c.oid::regclass::text,'owner',c.relowner::regrole::text,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity) order by c.oid::regclass::text) from pg_catalog.pg_class c where c.oid in('eps.media_assets'::regclass,'eps.specs_upload_sessions'::regclass,'storage.objects'::regclass)),
 'read_policies',(select jsonb_agg(jsonb_build_object('name',p.polname,'relation',p.polrelid::regclass::text,'permissive',p.polpermissive,'command',p.polcmd,
   'roles',(select jsonb_agg(case when role_id=0 then 'public' else role_id::regrole::text end order by role_id) from unnest(p.polroles) r(role_id)),
   'using_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polqual,p.polrelid),''),'UTF8')),'hex')) order by p.polname)
  from pg_catalog.pg_policy p where p.polname in('specs_upload_read','specs_original_read','eps_specs_original_read','eps_specs_read_guard','eps_specs_owners_no_objects'))
) as live_specs_read_scope;
rollback;
