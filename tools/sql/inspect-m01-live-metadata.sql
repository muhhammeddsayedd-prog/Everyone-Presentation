begin read only;
set local statement_timeout='15s';
select jsonb_build_object(
 'query_role',current_user,
 'project_id',project.id,'client_id',client.id,
 'project_name_matches_request',project.name='Dummy Test',
 'client_name_matches_request',client.name='Dummy Client',
 'project_row_version',project.row_version,'client_row_version',client.row_version,
 'project_archived',project.archived_at is not null,'client_archived',client.archived_at is not null,
 'project_write_membership',exists(select 1 from public.project_memberships where project_id=project.id and principal_id='0a79a703-caba-47e5-93d4-42e32197037a' and active and can_write),
 'client_write_membership',exists(select 1 from public.client_memberships where client_id=client.id and principal_id='0a79a703-caba-47e5-93d4-42e32197037a' and active and can_write),
 'm01_active_capabilities',(select jsonb_agg(capability order by capability) from public.app_capability_grants where principal_id='0a79a703-caba-47e5-93d4-42e32197037a' and active and capability in('projects.read','projects.write','workspaces.read','workspaces.write')),
 'workspaces',coalesce((select jsonb_agg(jsonb_build_object('id',id,'row_version',row_version,'logo_selected',logo_asset_id is not null,'placement',logo_placement) order by id) from eps.workspaces where project_id=project.id),'[]'::jsonb),
 'upload_count',(select count(*) from eps.upload_sessions upload join eps.workspaces workspace on workspace.id=upload.workspace_id where workspace.project_id=project.id),
 'ready_logo_count',(select count(distinct asset.id) from eps.media_assets asset join eps.upload_sessions upload on upload.asset_id=asset.id join eps.workspaces workspace on workspace.id=upload.workspace_id where workspace.project_id=project.id and asset.status='ready')
) as metadata from public.projects project join public.clients client on client.id=project.client_id
where project.id='4b70c8ce-18bd-4a8c-b5a9-bc1156c06463' and client.id='f4a9937c-f575-4975-bdea-fb83b85e48c3';
commit;
