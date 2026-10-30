-- Metadata only: no role password, verifier key, bearer digest or Auth payload.
begin isolation level repeatable read read only;set local search_path='';set local statement_timeout='15s';
select jsonb_build_object('query_role',current_user,'database',current_database(),'unrestricted_visibility',(select rolsuper or rolbypassrls from pg_roles where rolname=current_user),
 'runtime',(select jsonb_build_object('name',r.rolname,'login',r.rolcanlogin,'inherit',r.rolinherit,'superuser',r.rolsuper,'bypass_rls',r.rolbypassrls,'create_db',r.rolcreatedb,'create_role',r.rolcreaterole,'replication',r.rolreplication,'connection_limit',r.rolconnlimit,'valid_until',r.rolvaliduntil,
 'parents',(select coalesce(jsonb_agg(jsonb_build_object('name',p.rolname,'admin',m.admin_option,'inherit',m.inherit_option,'set',m.set_option)order by p.rolname),'[]')from pg_auth_members m join pg_roles p on p.oid=m.roleid where m.member=r.oid),
 'execute',(select coalesce(jsonb_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text),'[]')from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public')and p.prokind='f'and has_function_privilege(r.oid,p.oid,'EXECUTE')))
 from pg_roles r where r.rolname='eps_specs_runtime'),
 'protected_m02',jsonb_build_object('exists',exists(select 1 from eps.jobs where id='b3f90268-147d-41d4-8875-2a6435df1496'),'manual_note_retained',coalesce((select position('Manual verification: preserve this instruction while extraction is pending.'in coalesce(s.normalized_instructions,''))>0 from eps.specs s join eps.jobs j on j.resource_id=s.id where j.id='b3f90268-147d-41d4-8875-2a6435df1496'),false)))as m06_admission;
rollback;
