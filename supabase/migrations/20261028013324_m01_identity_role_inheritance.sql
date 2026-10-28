-- Forward fix after real local role execution exposed an Auth schema permission gap.
-- The cloud postgres role has ADMIN on authenticated, but no grant option on
-- managed auth schema/functions. Inherit the existing managed role permissions
-- in ONE direction; do not alter managed auth owners, RLS or policies.
-- PostgreSQL 17 membership options override the member role's NOINHERIT default:
-- https://www.postgresql.org/docs/17/role-membership.html
-- https://www.postgresql.org/docs/17/sql-grant.html
set local lock_timeout = '5s';
do $guard$ begin
  if exists(select 1 from pg_roles where rolname in ('eps_api_owner','authenticated') and (rolcanlogin or rolsuper or rolbypassrls))
    or not exists(select 1 from pg_roles where rolname='eps_api_owner')
    or not exists(select 1 from pg_roles where rolname='authenticated')
  then raise exception 'UNSAFE_OR_MISSING_IDENTITY_RUNTIME_ROLE'; end if;
  if pg_has_role('authenticated','eps_api_owner','MEMBER') or pg_has_role('anon','eps_api_owner','MEMBER') then raise exception 'UNSAFE_REVERSE_IDENTITY_ROLE_MEMBERSHIP'; end if;
end $guard$;
grant authenticated to eps_api_owner with inherit true, set false, admin false;
do $verify$ begin
  if not has_schema_privilege('eps_api_owner','auth','USAGE')
    or not has_function_privilege('eps_api_owner','auth.uid()','EXECUTE')
    or not has_function_privilege('eps_api_owner','auth.jwt()','EXECUTE')
  then raise exception 'MANAGED_AUTHENTICATED_BASELINE_PRIVILEGES_MISSING'; end if;
  if pg_has_role('authenticated','eps_api_owner','MEMBER')
    or pg_has_role('anon','eps_api_owner','MEMBER')
    or pg_has_role('eps_api_owner','authenticated','SET')
  then raise exception 'UNSAFE_IDENTITY_ROLE_MEMBERSHIP_DIRECTION_OR_SET'; end if;
end $verify$;
