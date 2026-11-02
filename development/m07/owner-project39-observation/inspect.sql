-- Metadata-only observation of the owner's actual planned-project create.
-- No identity, actor impersonation, key, body, name or credentials are returned.
begin isolation level repeatable read read only;
set local search_path='';
set local timezone='UTC';
set local statement_timeout='30s';
with project as (
  select * from public.projects where id='09f4286a-d46d-4245-9255-67a6ee8e54f5'::uuid
), intent as (
  select i.* from eps.project_creation_intents i join project p on p.id=i.project_id
), workspaces as (
  select w.id from eps.workspaces w join project p on p.id=w.project_id
), receipts as (
  select r.* from eps.idempotency_records r join intent i on i.created_by=r.principal_id
  where r.operation='create_project' and r.response->>'id'='09f4286a-d46d-4245-9255-67a6ee8e54f5'
), audits as (
  select a.* from eps.audit_events a join project p on p.id=a.resource_id
  where a.action='create_project'
)
select jsonb_build_object(
  'database',current_database(),'operator',current_user,
  'project_id','09f4286a-d46d-4245-9255-67a6ee8e54f5',
  'project_count',(select count(*) from project),
  'active_row1_client_null',exists(select 1 from project where archived_at is null and row_version=1 and client_id is null),
  'same_name_project_count',(select count(*) from public.projects p where p.name=(select name from project)),
  'intent_count',(select count(*) from intent),
  'storyboard_intent',exists(select 1 from intent where presentation_type='storyboard'),
  'membership_count',(select count(*) from public.project_memberships m join project p on p.id=m.project_id),
  'creator_active_writer_count',(select count(*) from public.project_memberships m join intent i on i.project_id=m.project_id and i.created_by=m.principal_id where m.active and m.can_write),
  'create_audit_count',(select count(*) from audits),
  'original_create_audit_bound',exists(select 1 from audits a join intent i on i.created_by=a.principal_id where a.request_id='5cf2962f-5b7e-46fc-90ef-36980f15dd68' and a.client_type='mcp'),
  'idempotency_receipt_count',(select count(*) from receipts),
  'canonical_body_hash_and_receipt_match',exists(
    select 1 from receipts r cross join project p cross join intent i
    where r.request_hash=encode(sha256(convert_to(jsonb_build_object('name',p.name,'presentation_type',i.presentation_type)::text,'UTF8')),'hex')
      and r.response=jsonb_build_object('id',p.id,'name',p.name,'client_id',null,'client_name',null,'client_logo_asset_id',null,'row_version',p.row_version,'client_row_version',null,'casting_workspace_id',null,'can_edit',true,'presentation_type',i.presentation_type)
      and r.expires_at>r.created_at
  ),
  'resources',jsonb_build_object(
    'workspaces',(select count(*) from workspaces),
    'specs',(select count(*) from eps.specs s where s.workspace_id in(select id from workspaces)),
    'roles',(select count(*) from eps.roles r where r.workspace_id in(select id from workspaces)),
    'slots',(select count(*) from eps.slots s where s.workspace_id in(select id from workspaces)),
    'candidate_pool',(select count(*) from eps.workspace_candidates c where c.workspace_id in(select id from workspaces)),
    'jobs',(select count(*) from eps.jobs j where j.workspace_id in(select id from workspaces)),
    'series',(select count(*) from eps.presentation_series s where s.workspace_id in(select id from workspaces)),
    'versions',(select count(*) from eps.presentation_versions v join eps.presentation_series s on s.id=v.series_id where s.workspace_id in(select id from workspaces)),
    'origin_media',(select count(*) from eps.media_assets a where a.origin_workspace_id in(select id from workspaces))
  )
) as owner_project39_observation;
rollback;
