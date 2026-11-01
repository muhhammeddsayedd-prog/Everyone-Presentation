"""Pure project39 admission/projection. Construction reads source/evidence only."""
from pathlib import Path
import copy, hashlib, importlib.util, json, re

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse';VERSION='20261101223342'
MIGRATION='supabase/migrations/20261101223342_m07_project_creation.sql'
SEQUENTIAL='tracking/evidence/m07/project-creation39-proof/2026-11-01T22-51-16.947Z-70b3b36e.json'
RACE='tracking/evidence/m07/project-creation39-race/2026-11-01T22-59-30.771Z-9e589ba0.json'
READY='tracking/evidence/m07/completion-release/reader-baseline-ready.json'
BACKUP='tracking/evidence/m07/completion-release/canonical38-private-snapshot.json'
ROLE='eps_project_creator'
DIAGNOSTIC='tracking/evidence/m07/project-creation39-release/diagnostic-9be2ab0a-7528-43d6-bcf6-68e98feda29a.json'
DIAGNOSTIC_SHA='2089d760677c9466ccc6cc04871f593ff9ae29373ed02332b53d87fdcd96c0d9'
PROJECTION='.local/m07-project39-diagnostic/projection-eb55a906-5285-474d-b788-4707f9191d9d.json'
PROJECTION_SHA='1e3a7011bdb3aa9b54e0f5443cc19dbb82e0d5e7c356d3384273145c402a0184'
PUBLIC_ACL_KEY='schemas|public|acl'
PUBLIC_USAGE='=U/pg_database_owner'
def need(value):
 if not value:raise ValueError('PROJECT39_STATE_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(path,maximum=16*1024*1024):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and path.stat().st_size<=maximum);return path.read_bytes()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

class Context:
 def __init__(self,root=ROOT,own=HERE):
  self.root=Path(root).resolve();self.own=Path(own).resolve();self.proof_root=self.own.parents[2]
  self.s=module('project39_pure38',self.root/'development/m07/job-batch-filter38-release/state.py');self.b=self.s.b
  self.adoption=module('project39_pure_processing',self.root/'development/m07/specs-diagnostic-worker38-adoption/state.py')
  self.sequential=json.loads(load(self.proof_root/SEQUENTIAL));self.race=json.loads(load(self.proof_root/RACE))
  for proof in(self.sequential,self.race):
   need(proof['result']=='passed'and proof['cloud_called']is False and proof['provider_called']is False and proof['original_data_catalogue_and_global_roles_unchanged']is True and proof['shared_lock_released']is True)
  need(self.sequential['owned_database_absent']is True and self.sequential['sql_assertions']['assertions']==32 and self.sequential['all_restore_and39_ddl_rolled_back']is True)
  need(self.race['all_owned_resources_absent']is True and self.race['same_key']['advisory_blocking_observed']is True and self.race['same_key']['identical_saved_receipt']is True and self.race['different_keys']['both_results_before_either_commit']is True and self.race['different_keys']['two_advisory_holders_observed']is True and self.race['changed_body_same_key_denied']is True)
  need(self.race['exact_committed_counts']==dict.fromkeys(('projects','memberships','intents','audit','receipts'),3))
  self.source=load(self.root/MIGRATION);self.migration_sha=sha(self.source)
  need(self.migration_sha==self.race['migration_sha256']==self.sequential['source_seals'][MIGRATION])
  self.delta=copy.deepcopy(self.race['catalogue39_delta']);need(len(self.delta)==143 and all(not row['removed']for row in self.delta.values()))
  diagnostic=load(self.root/DIAGNOSTIC);need(sha(diagnostic)==DIAGNOSTIC_SHA);receipt=json.loads(diagnostic)
  need(receipt['valid_projection']is True and receipt['exit_code']==0 and receipt['timed_out']is False and receipt['output_limit_exceeded']is False and receipt['cloud_mutation']is False and receipt['protected_projection']==PROJECTION)
  self.b.security().verify(self.root/PROJECTION);raw=load(self.root/PROJECTION);need(sha(raw)==PROJECTION_SHA);canonical=json.loads(raw)
  # The sole canonical-vs-synthetic difference is existing PUBLIC USAGE. Keep
  # it in both exact images and all old catalogue/identity/OAuth hashes.
  before={key:{'present':not row['added'],'value':copy.deepcopy(row['before'])}for key,row in self.delta.items()}
  need(PUBLIC_USAGE not in self.delta[PUBLIC_ACL_KEY]['before']and PUBLIC_USAGE not in self.delta[PUBLIC_ACL_KEY]['after'])
  for side in('before','after'):self.delta[PUBLIC_ACL_KEY][side]=sorted([PUBLIC_USAGE,*self.delta[PUBLIC_ACL_KEY][side]])
  before[PUBLIC_ACL_KEY]['value']=self.delta[PUBLIC_ACL_KEY]['before']
  need(canonical['project39']['delta']==before and canonical['base']['history']==sorted(path.name[:14]for path in(self.root/'supabase/migrations').glob('*.sql')if path.name[:14]<VERSION))
  self.canonical_acl_anchor={'diagnostic':{'path':DIAGNOSTIC,'sha256':DIAGNOSTIC_SHA},'protected_projection_sha256':PROJECTION_SHA,'existing_public_usage_preserved':True}
  self.keys=sorted(self.delta);self.optional=[key for key in self.keys if key.startswith('memberships|eps_project_creator>postgres/supabase_admin|')];need(len(self.optional)==4)
  catalogue_raw=load(self.own/'catalogue.sql');need(sha(catalogue_raw)=='896e1ae0c17798470233ea4d4947b1b20070927cc4a5075d98a0a41a3d39cc26');self.catalogue=catalogue_raw.decode('utf8').strip()
  need(self.catalogue.endswith(';'));self.catalogue=self.catalogue[:-1]
  self.history=sorted(path.name[:14]for path in(self.root/'supabase/migrations').glob('*.sql')if path.name[:14]<VERSION)
  need(len(self.history)==38 and self.history[-1]=='20261101110939'and len(self.b.TABLES)==74)
  self.inventory=self.expected_inventory()

 def expected_inventory(self):
  result=[];mapping={'a':'INSERT','r':'SELECT','U':'USAGE','X':'EXECUTE'}
  for key,row in self.delta.items():
   if not key.endswith('|acl')or type(row['after'])is not list:continue
   category,identity,_=key.split('|');kind={'columns':'column','tables':'table','functions':'function','schemas':'schema'}.get(category)
   for acl in row['after']:
    match=re.fullmatch(ROLE+r'=([^/]+)/([a-z_]+)',acl)
    if not match:continue
    need(kind is not None and '*'not in match[1])
    for privilege in match[1]:
     need(privilege in mapping);result.append({'kind':kind,'identity':identity,'grantor':match[2],'privilege':mapping[privilege],'grantable':False})
  need(len(result)==21);return sorted(result,key=lambda v:(v['kind'],v['identity'],v['grantor'],v['privilege']))

 def project(self,installed,bootstrap=True):
  return {key:{'present':not row['removed']if installed else not row['added'],'value':copy.deepcopy(row['after']if installed else row['before'])}
   if bootstrap or key not in self.optional else {'present':False,'value':None}for key,row in self.delta.items()}

 def normalized_oauth(self):
  original=self.s.prior.old.normalized_oauth_sql(self.b)
  roles="(select coalesce(jsonb_agg(item.value order by item.ordinality),'[]'::jsonb)from jsonb_array_elements(q.value#>'{base,catalogue,roles}')with ordinality item(value,ordinality)where item.value->>'name'<>'eps_project_creator')"
  acl="(select coalesce(jsonb_agg(item.value order by item.ordinality),'[]'::jsonb)from jsonb_array_elements(ns.value->'acl')with ordinality item(value,ordinality)where item.value->>'grantee'<>'eps_project_creator')"
  public_acl="(select case when n.nspacl is null then 'null'::jsonb else(select coalesce(jsonb_agg(item::text order by ordinal),'[]'::jsonb)from unnest(n.nspacl)with ordinality entries(item,ordinal)where split_part(item::text,'=',1)<>'eps_project_creator')end from pg_namespace n where nspname='public')"
  namespaces="(select jsonb_agg(case when ns.value->>'name'='eps'then jsonb_set(ns.value,'{acl}',"+acl+")when ns.value->>'name'='public'then jsonb_set(ns.value,'{acl}',"+public_acl+")else ns.value end order by ns.ordinality)from jsonb_array_elements(q.value->'namespace')with ordinality ns(value,ordinality))"
  return original,"(select case when jsonb_typeof(q.value#>'{base,catalogue,roles}')='array'and jsonb_typeof(q.value->'namespace')='array'then jsonb_set(jsonb_set(q.value,'{base,catalogue,roles}',"+roles+"),'{namespace}',"+namespaces+")else null end from(select "+original+" as value)q)"

 def inventory_sql(self):
  queries=[];role="to_regrole('eps_project_creator')"
  for kind,identity,catalog,alias,acl,join in[
   ('schema','n.nspname','pg_namespace','n','n.nspacl',''),
   ('function','p.oid::regprocedure::text','pg_proc','p','p.proacl',''),
   ('table',"n.nspname||'.'||c.relname",'pg_class','c','c.relacl','join pg_namespace n on n.oid=c.relnamespace'),
   ('column',"n.nspname||'.'||c.relname||'.'||a.attname",'pg_attribute','a','a.attacl','join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace')]:
   queries.append("select "+self.b.literal(kind)+" kind,"+identity+" identity,pg_get_userbyid(x.grantor)grantor,x.privilege_type privilege,x.is_grantable grantable from "+catalog+' '+alias+' '+join+' cross join lateral aclexplode('+acl+')x where x.grantee='+role)
  return "(select coalesce(jsonb_agg(to_jsonb(v)order by kind collate \"C\",identity collate \"C\",grantor collate \"C\",privilege collate \"C\"),'[]'::jsonb)from("+' union all '.join(queries)+')v)'

 def owners_sql(self):
  role="to_regrole('eps_project_creator')";queries=[]
  for kind,identity,catalog,alias,owner,join in[
   ('schema','n.nspname','pg_namespace','n','n.nspowner',''),('function','p.oid::regprocedure::text','pg_proc','p','p.proowner',''),
   ('table',"n.nspname||'.'||c.relname",'pg_class','c','c.relowner','join pg_namespace n on n.oid=c.relnamespace'),
   ('type',"n.nspname||'.'||t.typname",'pg_type','t','t.typowner','join pg_namespace n on n.oid=t.typnamespace')]:
   queries.append('select '+self.b.literal(kind)+' kind,'+identity+' identity from '+catalog+' '+alias+' '+join+' where '+owner+'='+role)
  return "(select coalesce(jsonb_agg(to_jsonb(v)order by kind,identity),'[]'::jsonb)from("+' union all '.join(queries)+')v)'

 def functions_sql(self):
  metadata="jsonb_build_object('retset',p.proretset,'defaults',p.pronargdefaults,'variadic',p.provariadic::bigint,'support',p.prosupport::oid::bigint,'cost',p.procost,'rows',p.prorows,'transforms',p.protrftypes,'binary',p.probin,'sql_body_absent',p.prosqlbody is null,'argument_modes',p.proargmodes,'all_argument_types',p.proallargtypes)"
  return "(select jsonb_object_agg(signature,case when p.oid is null then null else "+metadata+"end)from(values('public.eps_create_project(jsonb,text)'),('public.eps_list_project_clients(text,text,integer)'))v(signature)left join pg_proc p on p.oid=to_regprocedure(v.signature))"
 def expected_functions(self,installed):
  common={'retset':False,'defaults':0,'variadic':0,'support':0,'cost':100,'rows':0,'transforms':None,'binary':None,'sql_body_absent':True,'argument_modes':None,'all_argument_types':None}
  return {'public.eps_create_project(jsonb,text)':copy.deepcopy(common)if installed else None,'public.eps_list_project_clients(text,text,integer)':{**common,'defaults':3}if installed else None}

 def identity_sql(self):
  scope="n.nspname in('eps','public','auth','storage','extensions')";newtable="to_regclass('eps.project_creation_intents')";queries=[]
  def acl_row(alias,field):
   acl="case when "+alias+'.'+field+" is null then 'null'::jsonb else(select coalesce(jsonb_agg(item::text order by ordinal),'[]'::jsonb)from unnest("+alias+'.'+field+")with ordinality entry(item,ordinal)where split_part(item::text,'=',1)<>'eps_project_creator')end"
   return "jsonb_set(to_jsonb("+alias+"),'{"+field+"}',"+acl+')'
  for catalog,alias,namespace,identity,predicate in[
   ('pg_proc','p','p.pronamespace','p.oid::regprocedure::text',"not(n.nspname='public'and p.proname in('eps_create_project','eps_list_project_clients'))"),
   ('pg_class','c','c.relnamespace',"n.nspname||'.'||c.relname","not(n.nspname='eps'and c.relname in('project_creation_intents','project_creation_intents_pkey'))"),
   ('pg_type','t','t.typnamespace',"n.nspname||'.'||t.typname","not(n.nspname='eps'and t.typname in('project_creation_intents','_project_creation_intents'))"),
   ('pg_constraint','c','c.connamespace',"c.conrelid::regclass::text||'.'||c.conname",'c.conrelid is distinct from '+newtable)]:
   metadata='to_jsonb('+alias+')'
   if catalog=='pg_proc':
    plain=acl_row('p','proacl');metadata="case when p.oid=to_regprocedure('eps.project_dto(uuid)')then "+plain+"-'prosrc'else "+plain+'end'
   if catalog=='pg_class':
    plain=acl_row('c','relacl')+"-array['relpages','reltuples','relallvisible','relallfrozen','relfrozenxid','relminmxid']::text[]"
    metadata="case when c.oid in(to_regclass('public.projects'),to_regclass('auth.users'))then "+plain+"-'relhastriggers'else "+plain+'end'
   queries.append("select '"+catalog+":'||"+identity+" k,"+metadata+" v from "+catalog+' '+alias+' join pg_namespace n on n.oid='+namespace+' where '+scope+' and '+predicate)
  for catalog,alias,relation in[('pg_attribute','a','a.attrelid'),('pg_attrdef','d','d.adrelid'),('pg_trigger','t','t.tgrelid'),('pg_policy','p','p.polrelid'),('pg_index','i','i.indrelid'),('pg_rewrite','r','r.ev_class')]:
   metadata=acl_row('a','attacl')if catalog=='pg_attribute'else'to_jsonb('+alias+')'
   suffix={'pg_trigger':'.tgname','pg_policy':'.polname','pg_attrdef':'.adnum::text','pg_index':'.indexrelid::text','pg_rewrite':'.rulename'}
   name="c.oid::text||':'||a.attname"if catalog=='pg_attribute'else"c.oid::text||':'||"+alias+suffix[catalog]
   extra=''
   if catalog=='pg_trigger':extra='and not exists(select 1 from pg_constraint constraint_row where constraint_row.oid=t.tgconstraint and constraint_row.conrelid='+newtable+')'
   if catalog=='pg_policy':extra="and p.polname not in('project_intent_read','project_intent_insert','new_project_insert','creator_membership_insert','project_creator_idempotency','project_creator_audit')"
   queries.append("select '"+catalog+":'||"+name+' k,'+metadata+' v from '+catalog+' '+alias+' join pg_class c on c.oid='+relation+' join pg_namespace n on n.oid=c.relnamespace where '+scope+' and c.oid is distinct from '+newtable+"and not(n.nspname='eps'and c.relname='project_creation_intents_pkey')"+extra)
  role="case when r.oid=17603 and r.rolname='cli_login_postgres'then jsonb_set(to_jsonb(r)-'rolpassword','{rolvaliduntil}','null'::jsonb)else to_jsonb(r)-'rolpassword'end"
  queries +=["select 'role:'||oid::text,"+role+" from pg_roles r where rolname<>'eps_project_creator'", "select 'membership:'||roleid::text||':'||member::text||':'||grantor::text,to_jsonb(m)from pg_auth_members m where roleid is distinct from to_regrole('eps_project_creator')and member is distinct from to_regrole('eps_project_creator')", "select 'namespace:'||oid::text,"+acl_row('n','nspacl')+' from pg_namespace n where '+scope,"select 'default_acl:'||oid::text,to_jsonb(d)from pg_default_acl d", "select 'enum:'||e.oid::text,to_jsonb(e)from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where "+scope]
  return "(select jsonb_build_object('count',count(*),'sha256',"+self.b.digest_sql("coalesce(string_agg(k||':'||"+self.b.digest_sql('v')+",E'\\n'order by k collate \"C\"),'')")+")from("+' union all '.join(queries)+')identities)'

 def state_sql(self,installed=False):
  original,normalized=self.normalized_oauth();base=self.s.state_sql(False);need(base.count(original)==2);base=base.replace(original,normalized)
  keys='array['+','.join(self.b.literal(k)for k in self.keys)+']::text[]'
  normalized_matrix="select coalesce(jsonb_object_agg(key,case when key like '%|acl'and jsonb_typeof(value)='string'then(select coalesce(jsonb_agg(acl order by acl collate \"C\"),'[]'::jsonb)from unnest(string_to_array(trim(both '{}'from value#>>'{}'),','))acl)else value end),'{}'::jsonb)catalog from matrix cross join lateral jsonb_each(matrix.catalog)"
  projection="(select jsonb_object_agg(key,jsonb_build_object('present',catalog?key,'value',catalog->key))from unnest("+keys+")key)"
  remaining="jsonb_build_object('count',jsonb_object_length(catalog-"+keys+"),'sha256',"+self.b.digest_sql('catalog-'+keys)+')'
  # PostgreSQL has no jsonb_object_length; count the bounded metadata keys explicitly.
  remaining=remaining.replace('jsonb_object_length(catalog-'+keys+')','(select count(*)from jsonb_object_keys(catalog-'+keys+'))')
  intent="(select count(*)from eps.project_creation_intents)"if installed else'null::bigint'
  new="jsonb_build_object('remaining_catalogue',"+remaining+",'delta',"+projection+",'old_identities',"+self.identity_sql()+",'creator_direct_grants',"+self.inventory_sql()+",'creator_owners',"+self.owners_sql()+",'new_function_metadata',"+self.functions_sql()+",'creator_no_create',coalesce(not has_schema_privilege(to_regrole('eps_project_creator'),'public','CREATE')and not has_schema_privilege(to_regrole('eps_project_creator'),'eps','CREATE'),true),'intent_rows',"+intent+")"
  return "with matrix as("+self.catalogue+"),normalized as("+normalized_matrix+")select(select jsonb_build_object('base',q.value-array['catalogue','schema']::text[],'project39',"+new+",'processing_config',"+self.adoption.config_sql()+",'lifecycle',"+self.adoption.lifecycle_sql()+")from("+base+" as value)q cross join normalized)"

 def check(self,value,installed=False):
  need(type(value)is dict and set(value)=={'base','project39','processing_config','lifecycle'});base=value['base'];meta=value['project39']
  need(base['database']==base['operator']==base['session_user']=='postgres'and base['cli_role_safe']is True and base['history']==self.history+([VERSION]if installed else[]))
  need(base['protected_m02_integrity']is True and base['protected_m02']==self.b.old.PROTECTED_M02 and base['english']=={'flags':['1.0'],'security':True})
  need(set(base['data'])==set(self.b.TABLES)and len(base['data'])==74 and base['trace_rows']['count']>=0)
  need(base['eps_tables']==sorted(self.b.EPS_TABLES+['job_stage_attempts']+(['project_creation_intents']if installed else[])))
  need(all(type(count)is int and count==0 for count in value['lifecycle'].values())and set(value['lifecycle'])==set(self.adoption.COUNTERS))
  need(set(value['processing_config'])==set(self.adoption.CONFIG)and all(row['shape_valid']is True and row['public']['enabled']is True for row in value['processing_config'].values()))
  need(set(meta)=={'remaining_catalogue','delta','old_identities','creator_direct_grants','creator_owners','new_function_metadata','creator_no_create','intent_rows'})
  need(meta['delta']==self.project(installed)or installed and meta['delta']==self.project(True,False))
  need(meta['creator_direct_grants']==(self.inventory if installed else[])and meta['creator_owners']==([{'kind':'function','identity':'public.eps_create_project(jsonb,text)'}]if installed else[])and meta['creator_no_create']is True and meta['intent_rows']==(0 if installed else None))
  need(meta['new_function_metadata']==self.expected_functions(installed))
  for row in[meta['remaining_catalogue'],meta['old_identities'],base['trace_rows'],*base['data'].values()]:need(type(row)is dict and set(row)=={'count','sha256'}and type(row['count'])is int and row['count']>=0 and re.fullmatch('[a-f0-9]{64}',row['sha256']))

 def after(self,before,bootstrap=True):
  value=copy.deepcopy(before);value['base']['history']+=[VERSION];value['base']['eps_tables']=sorted(value['base']['eps_tables']+['project_creation_intents']);value['project39'].update(delta=self.project(True,bootstrap),creator_direct_grants=copy.deepcopy(self.inventory),creator_owners=[{'kind':'function','identity':'public.eps_create_project(jsonb,text)'}],new_function_metadata=self.expected_functions(True),intent_rows=0);return value
 def transition(self,before,after):
  self.check(before);self.check(after,True);need(after==self.after(before)or after==self.after(before,False));return {'all74_business_hashes_unchanged':True,'trace_hash_unchanged':True,'old_metadata_and_OIDs_unchanged':True,'complete_new_role_grant_inventory_checked':True,'only_proved39_metadata_delta_and_history_added':True}

 def source_pins(self):
  pins=self.s.projection_sources()
  for relative in[MIGRATION,'development/m07/specs-diagnostic-worker38-adoption/state.py','development/m07/oauth-attempt-trace/inspect-attempt.py','tools/provision_logo_verifier.py',READY,BACKUP,DIAGNOSTIC]:pins[relative]=sha(load(self.root/relative))
  for relative in[SEQUENTIAL,RACE]:pins[relative]=sha(load(self.proof_root/relative))
  for name in['catalogue.sql','state.py','release.py','test_release.py','validate_local.py','README.md']:
   pins[(self.own/name).relative_to(self.proof_root).as_posix()]=sha(load(self.own/name))
  return dict(sorted(pins.items()))
