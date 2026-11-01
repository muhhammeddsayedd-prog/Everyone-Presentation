"""Pure catalogue36 delta projection; no IO, SQL dispatch or import side effects.

This is NOT new-schema acceptance. Call Name's independently reviewed schema
gate in the SAME transaction/snapshot: it must validate every excluded new
object, role membership/ACL and both expected FK RI triggers. This adapter
preserves the full frozen35 catalogue outside that exact identity closure.
Only jobs.relhastriggers and the named new role's direct eps ACL are normalized;
validate_delta separately admits their expected change and freezes old triggers.

PG17 creator memberships may include the documented bootstrap-superuser grant
plus the explicit postgres grant. The schema gate must check their exact safe
options; no other member/grantor relationship is excluded here. See:
https://www.postgresql.org/docs/17/role-attributes.html
https://www.postgresql.org/docs/17/catalog-pg-trigger.html
"""
import hashlib, re

BASE_SQL_SHA='8a68f7a1a6f32ad57fdeb9981fe423d65973d347631519bbc52bb61ec534fcb7'
TRACE="to_regclass('eps.job_stage_attempts')"
JOBS="to_regclass('eps.jobs')"
ROLE="to_regrole('eps_job_trace_owner')"
FUNCTION="to_regprocedure('eps.capture_job_stage_attempt()')"
SCOPE="n.nspname in('eps','public','auth','storage','extensions')"
STATS="-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']::text[]"

def need(value):
 if not value:raise ValueError('ATTEMPT36_CATALOGUE_DELTA_UNCONFIRMED')

def relation_is_new(expression):
 # No hard regclass casts: this expression must also run on the actual35 state.
 return '('+expression+'='+TRACE+' or exists(select 1 from pg_index trace_index where trace_index.indrelid='+TRACE+' and trace_index.indexrelid='+expression+'))'

def new_jobs_trigger(alias='t'):
 # Do not hide unrelated old jobs triggers, including other internal FK triggers.
 user="(not "+alias+".tgisinternal and "+alias+".tgname='capture_job_stage_attempt' and "+alias+'.tgconstraint=0 and '+alias+'.tgfoid='+FUNCTION+')'
 fk="("+alias+".tgisinternal and exists(select 1 from pg_constraint fk where fk.oid="+alias+".tgconstraint and fk.conname='job_stage_attempts_job_id_fkey' and fk.contype='f' and fk.conrelid="+TRACE+' and fk.confrelid='+JOBS+'))'
 return '('+alias+'.tgrelid='+JOBS+' and ('+user+' or '+fk+'))'

def normalized_namespace():
 # Canonicalize only eps ACLs, so implicit/default vs explicit owner grants do
 # not differ when USAGE materializes the ACL. Preserve every old ACL tuple.
 acl="(select coalesce(jsonb_agg(jsonb_build_object('grantee',a.grantee,'grantor',a.grantor,'privilege',a.privilege_type,'grantable',a.is_grantable)order by a.grantee,a.grantor,a.privilege_type,a.is_grantable),'[]'::jsonb)from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner)))a where a.grantee is distinct from "+ROLE+')'
 return "case when n.nspname='eps'then jsonb_set(to_jsonb(n),'{nspacl}',"+acl+')else to_jsonb(n)end'

def normalized_catalogue_sql(base_sql):
 """Scalar count/SHA projection from the byte-pinned, unchanged35 expression.

 Excludes the new table and its own indexes/row+array types/constraints,
 relation-owned catalogue entries, trigger function, named new role and the
 finite postgres creator memberships. New FK triggers on OLD jobs are excluded
 only by that FK constraint's full identity; all other old jobs rows stay.
 Default ACLs, all old policies/defaults/types, namespace ownership and the
 frozen35 cli-role-expiry normalization remain fully included.
 """
 need(type(base_sql)is str and hashlib.sha256(base_sql.encode()).hexdigest()==BASE_SQL_SHA)
 sql=base_sql
 def change(old,new):
  nonlocal sql
  need(sql.count(old)==1);sql=sql.replace(old,new,1)
 change('where '+SCOPE+'and p.oid is distinct from ',
  'where '+SCOPE+'and p.oid is distinct from '+FUNCTION+' and p.oid is distinct from ')
 change('to_jsonb(c)'+STATS+'from pg_class c join pg_namespace n on n.oid=c.relnamespace where '+SCOPE,
  '(case when c.oid='+JOBS+"then to_jsonb(c)-'relhastriggers'else to_jsonb(c)end)"+STATS+'from pg_class c join pg_namespace n on n.oid=c.relnamespace where '+SCOPE+' and '+relation_is_new('c.oid')+' is not true')
 change('from pg_type t join pg_namespace n on n.oid=t.typnamespace where '+SCOPE,
  'from pg_type t join pg_namespace n on n.oid=t.typnamespace where '+SCOPE+' and not exists(select 1 from pg_class trace_table join pg_type trace_type on trace_type.oid=trace_table.reltype where trace_table.oid='+TRACE+' and t.oid in(trace_table.reltype,trace_type.typarray))')
 change('from pg_constraint c join pg_namespace n on n.oid=c.connamespace where '+SCOPE,
  'from pg_constraint c join pg_namespace n on n.oid=c.connamespace where '+SCOPE+' and c.conrelid is distinct from '+TRACE)
 for catalog,alias,relation in [('pg_policy','p','p.polrelid'),('pg_trigger','t','t.tgrelid'),('pg_index','i','i.indrelid'),
  ('pg_attribute','a','a.attrelid'),('pg_attrdef','d','d.adrelid'),('pg_rewrite','r','r.ev_class')]:
  old='from '+catalog+' '+alias+' join pg_class c on c.oid='+relation+' join pg_namespace n on n.oid=c.relnamespace where '+SCOPE
  extra=' and '+relation_is_new(relation)+' is not true'
  if catalog=='pg_trigger':extra+=' and '+new_jobs_trigger(alias)+' is not true'
  change(old,old+extra)
 change("select 'namespace:'||oid::text,to_jsonb(n)from pg_namespace n where ",
  "select 'namespace:'||oid::text,"+normalized_namespace()+' from pg_namespace n where ')
 change('from pg_roles r union all ',"from pg_roles r where r.rolname<>'eps_job_trace_owner' union all ")
 change('from pg_auth_members m union all ',
  'from pg_auth_members m where (m.roleid='+ROLE+" and m.member=to_regrole('postgres') and m.grantor in(to_regrole('postgres'),to_regrole('supabase_admin')))is not true union all ")
 return sql

def digest_sql(expression):
 return "encode(sha256(convert_to(("+expression+")::text,'UTF8')),'hex')"

def delta_metadata_sql():
 """Scalar closed metadata; old trigger bodies remain server-side hashes.

 Direct named-role schema grants across ALL schemas are counted, with at most33
 rows returned (acceptance requires exactly one). The retained trigger inventory
 includes every old jobs trigger and excludes only the exact new closure above.
 Enabled/disabled recovery of the new user trigger is checked by the schema gate,
 not ignored for any old trigger by this metadata or catalogue projection.
 """
 direct="select n.nspname schema,pg_get_userbyid(a.grantor)grantor,a.privilege_type privilege,a.is_grantable grantable from pg_namespace n cross join lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner)))a where a.grantee="+ROLE
 acl="jsonb_build_object('count',(select count(*)from direct_acl),'rows',(select coalesce(jsonb_agg(to_jsonb(v)order by v.schema,v.grantor,v.privilege,v.grantable),'[]'::jsonb)from(select *from direct_acl order by schema,grantor,privilege,grantable limit 33)v))"
 retained="(select jsonb_build_object('count',count(*),'sha256',"+digest_sql("coalesce(string_agg(t.oid::text||':'||"+digest_sql('to_jsonb(t)')+",E'\\n'order by t.oid),'')")+")from pg_trigger t where t.tgrelid="+JOBS+' and '+new_jobs_trigger()+' is not true)'
 return "(with direct_acl as("+direct+")select jsonb_build_object('eps_oid',(select oid::bigint from pg_namespace where nspname='eps'),'eps_owner_oid',(select nspowner::bigint from pg_namespace where nspname='eps'),'trace_schema_acl',"+acl+",'jobs_oid',"+JOBS+"::oid::bigint,'jobs_has_triggers',(select relhastriggers from pg_class where oid="+JOBS+"),'retained_jobs_triggers',"+retained+'))'

def metadata_shape(value):
 need(type(value)is dict and set(value)=={'eps_oid','eps_owner_oid','trace_schema_acl','jobs_oid','jobs_has_triggers','retained_jobs_triggers'})
 for key in ['eps_oid','eps_owner_oid','jobs_oid']:need(type(value[key])is int and 0<value[key]<2**32)
 need(type(value['jobs_has_triggers'])is bool)
 acl=value['trace_schema_acl'];need(type(acl)is dict and set(acl)=={'count','rows'}and type(acl['count'])is int and 0<=acl['count']<=32 and type(acl['rows'])is list and len(acl['rows'])==acl['count'])
 triggers=value['retained_jobs_triggers'];need(type(triggers)is dict and set(triggers)=={'count','sha256'}and type(triggers['count'])is int and 0<=triggers['count']<=10000 and type(triggers['sha256'])is str and re.fullmatch('[a-f0-9]{64}',triggers['sha256']))
 if value['jobs_has_triggers']is False:need(triggers['count']==0)

def validate_delta(before,after):
 """Require with equal normalized catalogue and separate exact new-schema gate."""
 metadata_shape(before);metadata_shape(after)
 for key in ['eps_oid','eps_owner_oid','jobs_oid','retained_jobs_triggers']:need(before[key]==after[key])
 need(before['trace_schema_acl']=={'count':0,'rows':[]})
 need(after['trace_schema_acl']=={'count':1,'rows':[{'schema':'eps','grantor':'postgres','privilege':'USAGE','grantable':False}]})
 # relhastriggers may be sticky true after dropped triggers; retain that valid
 # prestate, while a real newly installed jobs trigger requires poststate true.
 need(after['jobs_has_triggers']is True)
