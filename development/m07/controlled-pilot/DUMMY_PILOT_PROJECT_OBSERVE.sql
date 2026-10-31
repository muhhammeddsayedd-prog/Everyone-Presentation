-- Fixed SELECT-only fragment. Used identically by the read-only and create
-- wrappers. Only safe context fields and ordered count/SHA256 fingerprints leave
-- the database; no Auth rows, secrets, grant tokens, leases or raw media leave.
select id into client_uuid from public.clients
 where name='Dummy Client' and archived_at is null;
select id into template_uuid from public.projects
 where name='Dummy Reuse Test' and client_id=client_uuid and archived_at is null;
target_uuid:=null;
if(select count(*)from public.projects where lower(btrim(name))=lower('Dummy Pilot Test'))=1 then
 select id into target_uuid from public.projects where lower(btrim(name))=lower('Dummy Pilot Test');
end if;
select jsonb_build_object(
 'expected_project','pyibofyctwnqpvktepse','acting_user_id','0a79a703-caba-47e5-93d4-42e32197037a',
 'database',current_database(),'operator',current_user,
 'history',(select array_agg(version order by version)from supabase_migrations.schema_migrations),
 'client_matches',(select count(*)from public.clients where lower(btrim(name))=lower('Dummy Client')and archived_at is null),
 'template_matches',(select count(*)from public.projects where lower(btrim(name))=lower('Dummy Reuse Test')and client_id=client_uuid and archived_at is null),
 'target_matches',(select count(*)from public.projects where lower(btrim(name))=lower('Dummy Pilot Test')),
 'client',(select jsonb_build_object('id',id,'name',name,'active',archived_at is null,'row_version',row_version)from public.clients where id=client_uuid),
 'template',(select jsonb_build_object('id',id,'client_id',client_id,'name',name,'archived',archived_at is not null,'row_version',row_version)from public.projects where id=template_uuid),
 'template_membership',(select jsonb_build_object('project_id',project_id,'principal_id',principal_id,'active',active,'can_write',can_write)from public.project_memberships
  where project_id=template_uuid and principal_id='0a79a703-caba-47e5-93d4-42e32197037a'),
 'actor_eligible',exists(select 1 from auth.users where id='0a79a703-caba-47e5-93d4-42e32197037a'and email_confirmed_at is not null
  and last_sign_in_at is not null and not is_anonymous and deleted_at is null and(banned_until is null or banned_until<=clock_timestamp()))
  and(select count(*)from public.app_capability_grants where principal_id='0a79a703-caba-47e5-93d4-42e32197037a'and active and capability in('projects.read','projects.write'))=2,
 'target',(select jsonb_build_object('id',id,'client_id',client_id,'name',name,'archived',archived_at is not null,'row_version',row_version)from public.projects where id=target_uuid),
 'target_memberships',(select coalesce(jsonb_agg(jsonb_build_object('project_id',project_id,'principal_id',principal_id,'active',active,'can_write',can_write)order by principal_id),'[]')from public.project_memberships where project_id=target_uuid),
 'target_workspace_count',(select count(*)from eps.workspaces where project_id=target_uuid),
 'protected_metadata',jsonb_build_object(
  'clients',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from public.clients r),
  'old_projects',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from public.projects r where r.id is distinct from target_uuid),
  'old_project_memberships',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.project_id,r.principal_id),''),'UTF8')),'hex'))from public.project_memberships r where not(r.project_id is not distinct from target_uuid and r.principal_id='0a79a703-caba-47e5-93d4-42e32197037a')),
  'client_memberships',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.client_id,r.principal_id),''),'UTF8')),'hex'))from public.client_memberships r),
  'grants',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.principal_id,r.capability),''),'UTF8')),'hex'))from public.app_capability_grants r),
  'settings',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.singleton),''),'UTF8')),'hex'))from eps.app_settings r),
  'workspaces',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.workspaces r),
  'roles',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.roles r),
  'slots',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.slots r),
  'assignments',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.assignments r),
  'candidates',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.candidates r),
  'candidate_media',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.candidate_media r),
  'candidate_media_frames',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.candidate_media_id,r.asset_id),''),'UTF8')),'hex'))from eps.candidate_media_frames r),
  'workspace_candidates',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.workspace_candidates r),
  'candidate_support',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.candidate_support r),
  'frame_extraction_requests',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.job_id),''),'UTF8')),'hex'))from eps.frame_extraction_requests r),
  'media_assets',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.media_assets r),
  'specs',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.specs r),
  'versions',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.presentation_versions r),
  'slides',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.id),''),'UTF8')),'hex'))from eps.version_slides r),
  'pins',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(to_jsonb(r)::text,E'\n'order by r.version_id,r.asset_id),''),'UTF8')),'hex'))from eps.presentation_version_assets r),
  'ready_asset_metadata',(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(jsonb_build_object('version_id',v.id,'asset_id',a.id,'sha256',a.sha256,'size_bytes',a.size_bytes,'status',a.status)::text,E'\n'order by v.id,a.id),''),'UTF8')),'hex'))from eps.presentation_versions v join eps.presentation_version_assets p on p.version_id=v.id join eps.media_assets a on a.id=p.asset_id where v.status='ready'),
  'protected_m02',(select jsonb_build_object('id',j.id,'status',j.status,'stage',j.stage,'attempt',j.attempt,'row_version',j.row_version,'resource_id',j.resource_id,
   'manual_note_retained',position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0,
   'spec_sha256',encode(sha256(convert_to(jsonb_build_object('id',s.id,'row_version',s.row_version,'normalized_instructions',s.normalized_instructions)::text,'UTF8')),'hex'))from eps.jobs j join eps.specs s on s.id=j.resource_id where j.id='b3f90268-147d-41d4-8875-2a6435df1496')
 ))into observation;
