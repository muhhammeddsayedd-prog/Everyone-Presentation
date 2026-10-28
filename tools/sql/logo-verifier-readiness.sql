-- Fixed post-configuration metadata only: no key material or digest.
begin read only;
select jsonb_build_object(
 'observed_at',clock_timestamp(),'query_role',current_user,
 'unrestricted_visibility',(select rolbypassrls or rolsuper from pg_roles where rolname=current_user),
 'key_count',(select count(*) from eps.logo_verification_keys),
 'active_key_count',(select count(*) from eps.logo_verification_keys where purpose='client_logo' and revoked_at is null and not_before<=clock_timestamp() and (not_after is null or not_after>clock_timestamp())),
 'rls',(select relrowsecurity and relforcerowsecurity from pg_class where oid='eps.logo_verification_keys'::regclass),
 'ordinary_key_read',jsonb_build_object(
   'anon',has_table_privilege('anon','eps.logo_verification_keys','SELECT'),
   'authenticated',has_table_privilege('authenticated','eps.logo_verification_keys','SELECT'),
   'api_owner',has_table_privilege('eps_api_owner','eps.logo_verification_keys','SELECT'),
   'service_role',has_table_privilege('service_role','eps.logo_verification_keys','SELECT')),
 'unexpected_select_grants',(select coalesce(jsonb_agg(pg_get_userbyid(a.grantee)),'[]'::jsonb)
   from pg_class c cross join lateral aclexplode(c.relacl) a
   where c.oid='eps.logo_verification_keys'::regclass and a.privilege_type='SELECT' and a.grantee not in('postgres'::regrole,'eps_logo_verify_owner'::regrole)),
 'verifier_nonprivileged',(select not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb from pg_roles where rolname='eps_logo_verify_owner')
) as readiness;
rollback;
