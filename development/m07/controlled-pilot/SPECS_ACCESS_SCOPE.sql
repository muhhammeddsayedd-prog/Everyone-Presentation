-- Local claims model the existing actual actor for SELECT diagnostics only.
-- This is not an issued token, Auth mutation or invocation of submit_specs.
begin read only;
set local "request.jwt.claim.sub"='0a79a703-caba-47e5-93d4-42e32197037a';
set local "request.jwt.claims"='{"sub":"0a79a703-caba-47e5-93d4-42e32197037a","role":"authenticated","is_anonymous":false}';
set local role __ROLE__;
select jsonb_build_object('role',current_user,'actor_id',auth.uid(),
 'projects_read',eps.has_capability('projects.read'),
 'workspaces_write',eps.has_capability('workspaces.write'),
 'project_write',eps.project_scope('6da14b82-8458-451f-aa21-28cb6c85bdc5',true),
 'workspace_read',eps.specs_scope('86936940-b48d-497d-b1ff-8e0da0913afa',false),
 'workspace_write',eps.specs_scope('86936940-b48d-497d-b1ff-8e0da0913afa',true)
)as specs_access_scope;
rollback;
