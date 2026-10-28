-- LOCAL-ONLY forward-fix role proof. No fixtures or managed-schema mutations.
begin;
do $test$ declare membership record; begin
  if current_setting('eps.local_fixture_tests',true) is distinct from 'eps-presentation-canonical-pg17-local' then raise exception 'LOCAL_FIXTURE_TARGET_REQUIRED'; end if;
  select m.inherit_option,m.set_option,m.admin_option into membership
    from pg_auth_members m join pg_roles granted on granted.oid=m.roleid join pg_roles member on member.oid=m.member
    where granted.rolname='authenticated' and member.rolname='eps_api_owner';
  if not found or not membership.inherit_option or membership.set_option or membership.admin_option then raise exception 'EXPECTED_NARROW_INHERIT_ONLY_MEMBERSHIP'; end if;
  if pg_has_role('authenticated','eps_api_owner','MEMBER') or pg_has_role('anon','eps_api_owner','MEMBER') then raise exception 'REVERSE_RUNTIME_ROLE_ACCESS'; end if;
  if exists(select 1 from pg_roles where rolname='eps_api_owner' and (rolcanlogin or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole)) then raise exception 'RUNTIME_ROLE_IS_PRIVILEGED'; end if;
  if not has_schema_privilege('eps_api_owner','auth','USAGE')
    or not has_function_privilege('eps_api_owner','auth.uid()','EXECUTE')
    or not has_function_privilege('eps_api_owner','auth.jwt()','EXECUTE')
  then raise exception 'IDENTITY_HELPERS_NOT_ACCESSIBLE'; end if;
end $test$;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
do $unauthenticated$ begin
  begin perform public.eps_get_capabilities();
  exception when raise_exception then
    if sqlerrm='AUTH_REQUIRED' then return; end if;
    raise;
  end;
  raise exception 'AUTH_REQUIRED_NOT_ENFORCED';
end $unauthenticated$;
reset role;
select 'Identity inheritance uses existing Auth privileges without reverse role escalation; unauthenticated RPC is denied' as result;
rollback;
