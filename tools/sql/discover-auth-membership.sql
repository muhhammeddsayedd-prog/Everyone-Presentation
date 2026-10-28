begin read only;
set local statement_timeout = '10s';
select jsonb_build_object('authenticated_membership',(
  select jsonb_build_object('admin',admin_option,'inherit',inherit_option,'set',set_option)
  from pg_auth_members where roleid=(select oid from pg_roles where rolname='authenticated')
    and member=(select oid from pg_roles where rolname='postgres')
)) as membership;
rollback;
