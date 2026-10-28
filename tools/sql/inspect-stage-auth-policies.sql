-- Catalog only: no Auth rows, grants, policies or ownership are changed.
begin read only;
set local lock_timeout='3s';
set local statement_timeout='15s';
select jsonb_build_object('query_role',current_user,
 'users_policy_count',(select count(*) from pg_policy where polrelid='auth.users'::regclass),
 'api_owner_bypassrls',(select rolbypassrls from pg_roles where rolname='eps_api_owner'),
 'postgres_bypassrls',(select rolbypassrls from pg_roles where rolname=current_user),
 'postgres_users_owner_member',pg_has_role(current_user,(select relowner from pg_class where oid='auth.users'::regclass),'MEMBER')
) as stage_auth_policies;
rollback;
