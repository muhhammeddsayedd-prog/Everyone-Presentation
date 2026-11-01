"""Source-only preparation of a fixed canonical34->35 release operator.

Imports and tests are offline. Root owns inspection and a single claimed apply.
Raw CLI output is bounded in RAM; ambiguous dispatch is reconciled read-only.
"""
from pathlib import Path
import copy, datetime, hashlib, importlib.util, json, os, re, sys, uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse';VERSION='20261031182038';APPLY_ENABLED=True
MIGRATION=ROOT/'supabase/migrations/20261031182038_m07_workspace_summary.sql'
MIGRATION_SHA='cbb12610603318bce68ced4a58d0a9a01ee07737838c99a2ea0e6214e5e933e0'
FIXTURE_SHA='275b430fc401ea84a66e432c908cc9bdde77d17e362801ea39d15ed9209e7efe'
PROOF='tracking/evidence/m07/workspace-summary35-proof/2026-10-31T18-47-07-800Z-ef4cb6c2.json'
PROOF_SHA='417d1f32cc1b417c51107899e7b6e529e22ffa7b5be7e713b50f58901dac67a9'
DRIFT_PROOF='tracking/evidence/m07/workspace-summary35-release/2026-11-01-cli-role-validity-drift.json'
DRIFT_PROOF_SHA='389ac7e34a49f0cb49301869ebe7d27c58eed20f70248a122c0a0ee51f61f125'
PRIVATE=ROOT/'.local/m07-workspace-summary35-release';PLAN=PRIVATE/'plan.json';CLAIM=PRIVATE/'apply.claim.json'
FROZEN={
 'development/m03/english-release34/release.py':'cfb1de71b308d6bfe7b9115980a67d84341b014f06babf1fac84aa3c9806364a',
 'development/m07/oauth-attempt-trace/inspect-attempt.py':'1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c',
 'tools/provision_logo_verifier.py':'660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
 'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_logo.py':'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4'}
ARCHIVED={
 'source-history/3a3c9e26c73556fffb9de79f985226c74143e7dd171c8095e896a59fc48b4670-release-enabled.py.txt':'3a3c9e26c73556fffb9de79f985226c74143e7dd171c8095e896a59fc48b4670',
 'source-history/8d8da522e6f9ba84437dda9b886e9e33c321663d5f225703457d0dbffa103edc-release-disabled.py.txt':'8d8da522e6f9ba84437dda9b886e9e33c321663d5f225703457d0dbffa103edc',
 'source-history/1861074e18eef8a915f6c1320ef21f3950e897cad4b6ac2a0e52ae1df33923d6-catalogue-union.sql.txt':'1861074e18eef8a915f6c1320ef21f3950e897cad4b6ac2a0e52ae1df33923d6'}
STATIC_KEYS=('database','operator','history','protected_m02','protected_m02_integrity','english','catalogue','eps_tables','owner_no_public_create','review_owner_safe','cast','summary','oauth_static_sha256')
CONTROL_TABLES=('app_settings','candidate_asset_config','candidate_support_config','frame_extraction_config','presentation_processing_config','presentation_templates','review_gateway_config','review_processing_config','specs_asset_config','specs_pipeline_config')
def need(value):
 if not value:raise ValueError('SUMMARY35_RELEASE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(path,maximum=4*1024*1024):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and path.stat().st_size<=maximum);return path.read_bytes()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
for _file,_digest in FROZEN.items():need(sha(load(ROOT/_file))==_digest)
old=module('summary35_frozen_english',ROOT/'development/m03/english-release34/release.py')
literal=old.literal;json_sql=old.json_sql
SOURCE=load(MIGRATION).decode('utf8').replace('\r\n','\n');need(sha(load(MIGRATION))==MIGRATION_SHA)
HISTORY=re.findall(r"'([0-9]{14})'",re.search(r'array\[(.*?)\]::text\[\]',SOURCE,re.S)[1]);need(len(HISTORY)==34)
MIGRATIONS=sorted(path for path in(ROOT/'supabase/migrations').glob('*.sql')if path.name[:14]in HISTORY)
need([p.name[:14]for p in MIGRATIONS]==HISTORY)
EPS_TABLES=sorted({name.lower()for p in MIGRATIONS for name in re.findall(r'create table (?:if not exists )?eps\.([a-z_]+)',p.read_text(encoding='utf8'),re.I)})
TABLES=sorted(EPS_TABLES+['public.'+name for name in('clients','projects','project_memberships','client_memberships','app_capability_grants')])
SIGNATURE='public.eps_get_workspace_summary(uuid)';CAST='eps.cast_is_reviewed(eps.candidates)'
body=lambda text,name:re.search(r'create function '+re.escape(name)+r'\(.*?\bas \$\$(.*?)\$\$;',text,re.S)[1]
SUMMARY_BODY_SHA=sha(body(SOURCE,'public.eps_get_workspace_summary').encode())
CAST_BODY_SHA=sha(body((ROOT/'supabase/migrations/20261029090724_m03_candidate_library.sql').read_text(encoding='utf8').replace('\r\n','\n'),'eps.cast_is_reviewed').encode())
SUMMARY={'owner':'eps_review_owner','definer':True,'volatility':'s','config':['search_path=""'],'returns':'jsonb','language':'plpgsql','strict':False,'parallel':'u','leakproof':False,'source_sha256':SUMMARY_BODY_SHA,
 'acl':[{'grantee':'authenticated','grantor':'eps_review_owner','privilege':'EXECUTE','grantable':False},{'grantee':'eps_review_owner','grantor':'eps_review_owner','privilege':'EXECUTE','grantable':False}]}

def sources():
 for file,digest in FROZEN.items():need(sha(load(ROOT/file))==digest)
 for file,digest in ARCHIVED.items():need(sha(load(HERE/file))==digest)
 need(sha(load(MIGRATION))==MIGRATION_SHA)
 return {**FROZEN,**old.sources(),**{p.relative_to(ROOT).as_posix():sha(load(p))for p in [*MIGRATIONS,MIGRATION,Path(__file__),HERE/'test_release.py',HERE/'README.md',HERE/'admission.template.json',HERE/'catalogue_diagnostic.py',HERE/'test_catalogue_diagnostic.py',*[HERE/file for file in ARCHIVED]]}}
def validate_proof(value):
 need(value['run_id']=='ef4cb6c2-3f4a-4869-a71a-d747f1db99ca'and value['result']=='passed'and value['checkpoint']=='complete')
 for key in ['cloud_called','provider_called','canonical_business_writes']:need(value[key]is False)
 for key in ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released']:need(value[key]is True)
 need(value.get('cleanup_unconfirmed')is not True)
 need(value['actual_disposable_database_absence']=={'eps_m07_r33_source_ef4cb6c23f4a4869a71ad747f1db99ca':False,'eps_m07_r33_restore_ef4cb6c23f4a4869a71ad747f1db99ca':False})
 sql=value['summary35_sql'];need(sql['result']=='passed'and sql['actual35_sha256']==MIGRATION_SHA and sql['ddl_data_catalogue_rolled_back']is True and sql['history35_inserted']is False)
 need(sql['fixture_markers']==['SUMMARY35_FIXTURE_ASSERTIONS_PASSED_SYNTHETIC_ONLY']and value['source_seals']['tests/db/m07-workspace-summary.sql']==FIXTURE_SHA)
 return {'path':PROOF,'sha256':PROOF_SHA,'run_id':value['run_id'],'result':'passed','cleanup_verified':True}
def proof():
 raw=load(ROOT/PROOF);need(sha(raw)==PROOF_SHA);value=validate_proof(json.loads(raw))
 drift=load(ROOT/DRIFT_PROOF);need(sha(drift)==DRIFT_PROOF_SHA);validate_cli_drift(json.loads(drift))
 return {**value,'cli_expiry_evidence':{'path':DRIFT_PROOF,'sha256':DRIFT_PROOF_SHA}}
def cli_observation(value):
 """Validate the actual read-only diagnostic evidence without retaining clocks."""
 need(type(value)is dict and set(value)=={'oid','name','can_login','superuser','create_role','create_db','bypassrls','current_user','session_user','observed_at','valid_until'})
 need(value['oid']=='17603'and value['name']=='cli_login_postgres'and value['can_login']is True)
 need(all(value[k]is False for k in ['superuser','create_role','create_db','bypassrls']))
 need(value['current_user']==value['session_user']=='postgres')
 try:
  observed=datetime.datetime.fromisoformat(value['observed_at'].replace('Z','+00:00'));expiry=datetime.datetime.fromisoformat(value['valid_until'].replace('Z','+00:00'))
  need(observed.tzinfo is not None and expiry.tzinfo is not None and 0<(expiry-observed).total_seconds()<=600)
 except (ValueError,TypeError,AttributeError):need(False)
 return {k:v for k,v in value.items()if k not in('observed_at','valid_until')}
def validate_cli_drift(value):
 need(value['changed_group']=='role'and value['changed_key']=='role:17603'and value['changed_field']=='rolvaliduntil')
 need(value['other_business_and_permission_admission_checks_passed']is True)
 need(all(value[k]is False for k in ['plan_created','apply_claim_created','migration_dispatched','private_password_config_payloads_exposed']))
 need(cli_observation(value['first'])==cli_observation(value['second']))
def cli_role_guard_sql():
 return "exists(select 1 from pg_roles where oid=17603 and rolname='cli_login_postgres'and rolcanlogin and not rolsuper and not rolcreaterole and not rolcreatedb and not rolbypassrls and isfinite(rolvaliduntil)and rolvaliduntil>statement_timestamp()and rolvaliduntil<=statement_timestamp()+interval '10 minutes')"
def acl_sql(alias):
 return "(select coalesce(jsonb_agg(jsonb_build_object('grantee',case when a.grantee=0 then 'PUBLIC'else pg_get_userbyid(a.grantee)end,'grantor',pg_get_userbyid(a.grantor),'privilege',a.privilege_type,'grantable',a.is_grantable)order by case when a.grantee=0 then 'PUBLIC'else pg_get_userbyid(a.grantee)end,pg_get_userbyid(a.grantor),a.privilege_type),'[]'::jsonb)from aclexplode(coalesce("+alias+".proacl,acldefault('f',"+alias+".proowner)))a)"
def digest_sql(expression):return "encode(sha256(convert_to(("+expression+")::text,'UTF8')),'hex')"
def catalogue_sql():
 # Hash catalog rows in PostgreSQL. No function bodies or Auth row payloads leave it.
 scope="n.nspname in('eps','public','auth','storage','extensions')"
 queries=["select 'procedure:'||p.oid::text k,(case when p.oid=to_regprocedure('"+CAST+"')then to_jsonb(p)-'proacl'else to_jsonb(p)end) v from pg_proc p join pg_namespace n on n.oid=p.pronamespace where "+scope+"and p.oid is distinct from to_regprocedure('"+SIGNATURE+"')"]
 for catalog,alias,join in [('pg_class','c','c.relnamespace'),('pg_type','t','t.typnamespace'),('pg_constraint','c','c.connamespace')]:
  projection='to_jsonb('+alias+')'
  if catalog=='pg_class':projection+="-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']::text[]"
  queries.append("select '"+catalog+":'||"+alias+".oid::text,"+projection+"from "+catalog+' '+alias+' join pg_namespace n on n.oid='+join+' where '+scope)
 for catalog,alias,relation in [('pg_policy','p','p.polrelid'),('pg_trigger','t','t.tgrelid'),('pg_index','i','i.indrelid'),('pg_attribute','a','a.attrelid'),('pg_attrdef','d','d.adrelid'),('pg_rewrite','r','r.ev_class')]:
  key=alias+".attrelid::text||':'||a.attnum::text"if catalog=='pg_attribute'else(alias+'.indexrelid::text'if catalog=='pg_index'else alias+'.oid::text')
  queries.append("select '"+catalog+":'||"+key+',to_jsonb('+alias+')from '+catalog+' '+alias+' join pg_class c on c.oid='+relation+' join pg_namespace n on n.oid=c.relnamespace where '+scope)
 role="case when r.oid=17603 and r.rolname='cli_login_postgres' then jsonb_set(to_jsonb(r)-'rolpassword','{rolvaliduntil}','null'::jsonb)else to_jsonb(r)-'rolpassword'end"
 queries +=["select 'enum:'||e.oid::text,to_jsonb(e)from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where "+scope,"select 'namespace:'||oid::text,to_jsonb(n)from pg_namespace n where nspname in('eps','public','auth','storage','extensions')","select 'role:'||oid::text,"+role+" from pg_roles r","select 'membership:'||roleid::text||':'||member::text||':'||grantor::text,to_jsonb(m)from pg_auth_members m","select 'default_acl:'||oid::text,to_jsonb(d)from pg_default_acl d"]
 return "(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(k||':'||"+digest_sql('v')+",E'\\n'order by k collate \"C\"),''),'UTF8')),'hex'))from("+' union all '.join(queries)+')catalogue)'
def static_schema(value):return {**{key:copy.deepcopy(value[key])for key in STATIC_KEYS},'control_plane':{name:copy.deepcopy(value['data'][name])for name in CONTROL_TABLES}}
def state_sql(static_only=False):
 need(type(static_only)is bool)
 data=[]
 for name in (CONTROL_TABLES if static_only else TABLES):
  table=name if name.startswith('public.')else'eps.'+name
  data.append('('+literal(name)+",(select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(string_agg(h,E'\\n'order by h),''),'UTF8')),'hex'))from(select "+digest_sql('to_jsonb(t)')+'h from '+table+' t)hashed_rows))')
 summary="(select jsonb_build_object('owner',pg_get_userbyid(p.proowner),'definer',p.prosecdef,'volatility',p.provolatile,'config',p.proconfig,'returns',format_type(p.prorettype,null),'language',(select lanname from pg_language where oid=p.prolang),'strict',p.proisstrict,'parallel',p.proparallel,'leakproof',p.proleakproof,'source_sha256',"+digest_sql("replace(p.prosrc,E'\\r\\n',E'\\n')")+",'acl',"+acl_sql('p')+")from pg_proc p where p.oid=to_regprocedure('"+SIGNATURE+"'))"
 cast="(select jsonb_build_object('owner',pg_get_userbyid(p.proowner),'source_sha256',"+digest_sql("replace(p.prosrc,E'\\r\\n',E'\\n')")+",'acl',"+acl_sql('p')+")from pg_proc p where p.oid=to_regprocedure('"+CAST+"'))"
 oauth="(select jsonb_build_object('sha256',"+digest_sql('v')+",'coordinator_auth_usage',v->'coordinator_auth_usage')from(select "+old.oauth_sql()+' v)q)'
 oauth_static="(select "+digest_sql("v-'claims_count'")+"from(select "+old.oauth_sql()+' v)q)'
 data_sql="(select jsonb_object_agg(k,v)from(values"+','.join(data)+")d(k,v))"
 drain="jsonb_build_object('other_active_jobs',(select count(*)from eps.jobs where status in('queued','running','waiting_for_input')and id<>'"+old.PROTECTED_M02['id']+"'),'leased_outbox',(select count(*)from eps.outbox_events where status='leased'))"if not static_only else "'{}'::jsonb"
 if static_only:oauth="'{}'::jsonb"
 base="select jsonb_build_object('database',current_database(),'operator',current_user,'cli_role_safe',"+cli_role_guard_sql()+",'history',(select jsonb_agg(version order by version)from supabase_migrations.schema_migrations),'protected_m02',(select jsonb_build_object('id',id,'status',status,'stage',stage,'attempt',attempt,'row_version',row_version)from eps.jobs where id='"+old.PROTECTED_M02['id']+"'),'protected_m02_integrity',"+old.protected_m02_integrity_sql()+",'drain',"+drain+",'english',jsonb_build_object('flags',(select jsonb_agg(english_transcript_version order by id)from eps.candidate_asset_config),'security',"+old.security_sql()+"),'oauth',"+oauth+",'oauth_static_sha256',"+oauth_static+",'catalogue',"+catalogue_sql()+",'data',"+data_sql+",'eps_tables',(select jsonb_agg(c.relname order by c.relname)from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='eps'and c.relkind='r'),'owner_no_public_create',not has_schema_privilege('eps_review_owner','public','CREATE'),'review_owner_safe',exists(select 1 from pg_roles where rolname='eps_review_owner'and not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreaterole and not rolcreatedb),'cast',"+cast+",'summary',"+summary+")value"
 controls="(select jsonb_object_agg(k,v)from jsonb_each(b.value->'data')d(k,v)where k=any(array["+','.join(literal(k)for k in CONTROL_TABLES)+"]::text[]))"
 return "select(select b.value||jsonb_build_object('static_schema',(b.value-array['data','drain','oauth','cli_role_safe']::text[])||jsonb_build_object('control_plane',"+controls+"))from("+base+")b)"
def static_schema_sql():return "select(select case when q.value->'cli_role_safe'='true'::jsonb then q.value->'static_schema'else null end from("+state_sql(True)+"as value)q)"
def check_before(value):
 need(type(value)is dict and set(value)=={'database','operator','cli_role_safe','history','protected_m02','protected_m02_integrity','drain','english','oauth','oauth_static_sha256','catalogue','data','eps_tables','owner_no_public_create','review_owner_safe','cast','summary','static_schema'})
 need(value['database']=='postgres'and value['operator']=='postgres'and value['cli_role_safe']is True and value['history']==HISTORY and value['summary']is None)
 need(value['protected_m02']==old.PROTECTED_M02 and value['protected_m02_integrity']is True and value['drain']=={'other_active_jobs':0,'leased_outbox':0})
 need(value['english']=={'flags':['1.0'],'security':True}and value['oauth']['coordinator_auth_usage']is False)
 need(value['owner_no_public_create']is True and value['review_owner_safe']is True and value['eps_tables']==EPS_TABLES)
 need(set(value['data'])==set(TABLES))
 for row in [value['catalogue'],*value['data'].values()]:need(type(row)is dict and set(row)=={'count','sha256'}and type(row['count'])is int and row['count']>=0 and re.fullmatch('[a-f0-9]{64}',row['sha256']))
 need(value['cast']['owner']=='eps_cast_owner'and value['cast']['source_sha256']==CAST_BODY_SHA and type(value['cast']['acl'])is list)
 need(type(value['oauth_static_sha256'])is str and re.fullmatch('[a-f0-9]{64}',value['oauth_static_sha256'])and value['static_schema']==static_schema(value))
def expected_after(before):
 check_before(before);value=copy.deepcopy(before);value['history'].append(VERSION);value['summary']=SUMMARY
 acl=value['cast']['acl'];existing=[a for a in acl if a['grantee']=='eps_review_owner']
 need(not existing or existing==[{'grantee':'eps_review_owner','grantor':'eps_cast_owner','privilege':'EXECUTE','grantable':False}])
 if not existing:acl.append({'grantee':'eps_review_owner','grantor':'eps_cast_owner','privilege':'EXECUTE','grantable':False})
 acl.sort(key=lambda a:(a['grantee'],a['grantor'],a['privilege']));value['static_schema']=static_schema(value);return value
def check_after(value,before):need(value==expected_after(before))
def render(before,marker):
 need(type(marker)is str and str(uuid.UUID(marker))==marker);check_before(before)
 tables=','.join(name if name.startswith('public.')else'eps.'+name for name in TABLES)
 return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table "+tables+" in share mode;\n"+old.assertion(state_sql(),before,'SUMMARY35_PREFLIGHT_CHANGED')+SOURCE+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+VERSION+"',array[]::text[],'m07_workspace_summary');\n"+old.assertion(state_sql(),expected_after(before),'SUMMARY35_POSTCONDITION_FAILED')+"commit;select jsonb_build_object('version','"+VERSION+"','marker','"+marker+"','migration_sha256','"+MIGRATION_SHA+"')as summary35_release;"
def security():
 prior=list(sys.path)
 try:sys.path.insert(0,str(ROOT/'tools'));value=module('summary35_windows',ROOT/'tools/provision_logo_verifier.py')
 finally:sys.path[:]=prior
 return value.WindowsPrivateFiles()
def protected_write(path,raw):
 PRIVATE.mkdir(parents=True,exist_ok=True);guard=security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
def private_json(path):
 security().verify(path);return json.loads(load(path))
def query(sql,label):
 need((ROOT/'supabase/.temp/project-ref').read_text().strip()==TARGET)
 reader=module('summary35_cli',ROOT/'development/m07/oauth-attempt-trace/inspect-attempt.py')
 path=PRIVATE/(label+'-'+str(uuid.uuid4())+'.sql');protected_write(path,sql.encode())
 command=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(path),'--output-format','json','--workdir',str(ROOT)]
 code,timeout,overflow,stdout,stderr=reader.bounded(command,reader.environment());need(code==0 and not timeout and not overflow)
 payload=json.loads(stdout);rows=payload if type(payload)is list else payload.get('rows')if type(payload)is dict else None
 need(type(rows)is list and len(rows)==1 and set(rows[0])=={'summary35_release'});return rows[0]['summary35_release']
def read_state():return query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+state_sql()+"as summary35_release;rollback;",'inspect')
def read_static_state():
 value=query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+static_schema_sql()+"as summary35_release;rollback;",'static-inspect')
 need(type(value)is dict and set(value)==set(STATIC_KEYS)|{'control_plane'}and type(value['control_plane'])is dict and set(value['control_plane'])==set(CONTROL_TABLES));return value
def save(action,value):
 path=ROOT/'tracking/evidence/m07/workspace-summary35-release'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json');path.parent.mkdir(parents=True,exist_ok=True)
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps({'schema_version':'1.0','target':TARGET,'observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'action':action,'raw_cli_persisted':False,'automatic_dispatch_retry':False,**value},sort_keys=True,indent=2)+'\n')
 return path.relative_to(ROOT).as_posix()
def claim(value):protected_write(CLAIM,(json.dumps(value,sort_keys=True)+'\n').encode())
def apply_plan(plan,pins):
 need(APPLY_ENABLED and plan['target']==TARGET and plan['source_pins']==pins and plan['local_proof']==proof());need(not CLAIM.exists())
 before=read_state();check_before(before);need(before==plan['before']and sources()==pins)
 marker=str(uuid.uuid4());claim({'target':TARGET,'version':VERSION,'marker':marker,'source_pins':pins,'migration_sha256':MIGRATION_SHA,'before':before,'local_proof':plan['local_proof'],'dispatch_may_have_occurred':True,'automatic_retry':False})
 returned=False;verified=False;first=second=None
 try:
  need(read_state()==before and sources()==pins);result=query(render(before,marker),'apply');returned=result=={'version':VERSION,'marker':marker,'migration_sha256':MIGRATION_SHA}
 except Exception:pass
 try:first=read_state();second=read_state();check_after(first,before);check_after(second,before);need(first==second and sources()==pins);verified=True
 except Exception:pass
 result={'result':'passed'if returned and verified else'unconfirmed','normal_return_marker_observed':returned,'independent_readback_verified':verified,'claim_retained':True,'source_pins':pins,'local_proof':plan['local_proof'],'before':before,'first':first,'second':second,'static_schema_before':static_schema(before),'static_schema_after':first['static_schema']if verified else None}
 return {**{k:result[k]for k in('result','normal_return_marker_observed','independent_readback_verified','claim_retained')},'receipt':save('apply',result)}
def main():
 need(len(sys.argv)==2 and sys.argv[1]in('inspect','apply','readback'));action=sys.argv[1];pins=sources();local_proof=proof()
 if action=='inspect':
  need(not PLAN.exists()and not CLAIM.exists());before=read_state();check_before(before);need(read_state()==before and sources()==pins)
  plan={'target':TARGET,'migration_sha256':MIGRATION_SHA,'source_pins':pins,'local_proof':local_proof,'before':before};protected_write(PLAN,(json.dumps(plan,sort_keys=True)+'\n').encode())
  print(json.dumps({'result':'passed','dispatch_attempted':False,'receipt':save('inspect',plan)}));return
 if action=='apply':
  result=apply_plan(private_json(PLAN),pins);print(json.dumps(result));need(result['result']=='passed');return
 data=private_json(CLAIM);need(data['target']==TARGET and data['migration_sha256']==MIGRATION_SHA and data['source_pins']==pins and data['local_proof']==local_proof)
 first=read_state();second=read_state();check_after(first,data['before']);need(first==second and sources()==pins)
 print(json.dumps({'result':'observed_applied','claim_retained':True,'receipt':save('readback',{'source_pins':pins,'first':first,'second':second,'static_schema_after':first['static_schema'],'claim_retained':True})}))

if __name__=='__main__':
 try:main()
 except Exception:print('SUMMARY35_RELEASE_UNCONFIRMED');sys.exit(1)
