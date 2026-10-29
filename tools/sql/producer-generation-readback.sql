-- Fixed existing Producer only. No email, principal UUID, Auth row or real facts.
begin isolation level repeatable read read only;
set local lock_timeout='3s';set local statement_timeout='15s';set local search_path='';set local timezone='UTC';
with source as (
 select j.* from eps.jobs j join eps.workspaces w on w.id=j.workspace_id
 join public.projects p on p.id=w.project_id join eps.media_assets a on a.id=j.input_asset_id
 where j.id='9a5ddb61-6a9a-4157-b6be-8653cf2eadef' and j.kind='candidate_scan' and j.status='succeeded'
 and j.stage='apply_candidate' and j.workspace_id='e470aefd-e0f7-480c-bf0d-170cb2cb7069'
 and w.project_id='bd14d10f-b1c5-4d6a-8b4d-e5c48208433c' and w.archived_at is null and p.archived_at is null
 and j.input->>'workspace_id'=w.id::text and j.input->>'project_id'=p.id::text and j.input->>'target_candidate_id' is null
 and a.id='5f8a6d53-0da0-4064-aacf-aea6b9c47c81' and a.sha256='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'
 and a.size_bytes=4316429 and a.status='ready'
), grant_state as (
 select count(g.principal_id) amount,bool_or(g.active)active from source j left join public.app_capability_grants g
 on g.principal_id=j.requested_by and g.capability='presentations.generate'
)
select jsonb_build_object(
 'observed_at',clock_timestamp(),'query_role',current_user,'database',current_database(),
 'unrestricted_visibility',exists(select 1 from pg_roles where rolname=current_user and(rolsuper or rolbypassrls)),
 'versions',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),
 'source_job_count',(select count(*)from source),'requester_derived_from_fixed_job',true,
 'verified_active_auth',exists(select 1 from auth.users u join source j on j.requested_by=u.id
  where u.email_confirmed_at is not null and u.last_sign_in_at is not null and u.is_anonymous is false and u.deleted_at is null
  and(u.banned_until is null or u.banned_until<=clock_timestamp())),
 'two_projects_current',(select count(*)=2 from public.projects where id in('4b70c8ce-18bd-4a8c-b5a9-bc1156c06463','bd14d10f-b1c5-4d6a-8b4d-e5c48208433c')
  and archived_at is null and client_id='f4a9937c-f575-4975-bdea-fb83b85e48c3')
  and exists(select 1 from public.clients where id='f4a9937c-f575-4975-bdea-fb83b85e48c3'and archived_at is null),
 'two_writable_memberships_current',(select count(*)=2 from public.project_memberships m join source j on j.requested_by=m.principal_id
  where m.project_id in('4b70c8ce-18bd-4a8c-b5a9-bc1156c06463','bd14d10f-b1c5-4d6a-8b4d-e5c48208433c')and m.active and m.can_write),
 'producer_authority_current',(select count(*)=8 from public.app_capability_grants g join source j on j.requested_by=g.principal_id
  where g.capability in('projects.read','projects.write','workspaces.read','workspaces.write','cast.read','cast.upload','cast.write','cast.review')and g.active),
 'generation_grant',(select jsonb_build_object('count',amount,'active',active,'state',case when amount=0 then'absent'when active then'active'else'inactive'end)from grant_state),
 'preservation',jsonb_build_object(
  'auth_users_count',(select count(*)from auth.users),'grants_count',(select count(*)from public.app_capability_grants),
  'other_grants_sha256',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(g)::text,E'\n'order by to_jsonb(g)::text),''),'UTF8')),'hex')from public.app_capability_grants g
   where not(g.capability='presentations.generate'and g.principal_id=(select requested_by from source))),
  'project_memberships_sha256',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(m)::text,E'\n'order by to_jsonb(m)::text),''),'UTF8')),'hex')from public.project_memberships m),
  'client_memberships_sha256',(select encode(sha256(convert_to(coalesce(string_agg(to_jsonb(m)::text,E'\n'order by to_jsonb(m)::text),''),'UTF8')),'hex')from public.client_memberships m))
)as producer_generation;
rollback;
