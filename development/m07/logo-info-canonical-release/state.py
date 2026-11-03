"""One-function40→41 Context. Pure collectors/rendering; no transport."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re,uuid

HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2]
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
TARGET='pyibofyctwnqpvktepse';VERSION='20261103031200';MAXIMUM=16*1024**2
MIGRATION='supabase/migrations/20261103031200_m07_logo_info_operation.sql'
MIGRATION_SHA='4af699abab0501cade40f98e2104f2fb2d563ce6a43d0cb06d83744035a278ec'
SIGNATURE='eps.logo_storage_read_allowed(text,text)'
NATIVE='sha256:3d4286db01b27b40ec9078e303158e93003a096d5ddad1c9802130238de6dd80'
OLD='1f3f2a1440bf97400b7042bafd4b49ac98f7960cce8cd815f973ca5a7d166e87'
NEW='c6d72b2aded23a18ea47d6bea419163aca204293b5265ec3e08514463e1d76dd'
STATE='development/m07/worker-source-identity-release/state.py'
STATE_SHA='83b859f8e5cb325c91a77c0b04f492354a0d28ffa6cad324fd2abb20bc9c466c'
PROOF='tracking/evidence/m07/logo-info-owned-proof/2026-11-03T03-03-40.757Z-bc0c30ce.json'
PROOF_SHA='fcfffbb6cd0e4ce6ce5778ed0fa0629c7b1a957e2d7e7e8b64f877f53a4f4a15'
AUDIT='tracking/evidence/m07/logo-info-owned-proof/Root-bc0c30ce-postrun-audit.json'
AUDIT_SHA='331a8b829086d5581eddb64f1ebf1ed514b10a02180c9ac87e1ef675a4e866ea'
TRANSPORT_PINS={
 'development/m07/review-link-reason40-canonical-release/release.py':'d36ec9b7365363c15056eaacb22a7c9157d6eaf6e5f7f36e3fc86f2b3774e047',
 'development/m07/oauth-attempt-trace/inspect-attempt.py':'1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c',
 'development/m07/completion-worker-rollout39/capture.py':'7145afd1a856e3c3fdec53c71bd7c37240873ebece5e1088b71f9d5e9c66e07d',
 'development/m07/production-web-release/release.py':'62ce229284777f01a81589c61738cfef0feeadc1f68ef0049c883b54fdfed337',
 'development/m07/logo-recovery-web-forward-release/projection.py':'cf1d1f3269f004182d7caf44fc4dcf63b93c635706410d47e76b889aae74db46',
}

def need(ok):
 if not ok:raise ValueError('LOGO_INFO41_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(file):
 file=Path(file);need(file.is_file()and not file.is_symlink()and file.resolve()==file and file.stat().st_nlink==1 and 0<file.stat().st_size<=MAXIMUM);return file.read_bytes()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def literal(value):return "'"+str(value).replace("'","''")+"'"
def json_sql(value):return literal(json.dumps(value,separators=(',',':'),ensure_ascii=False))+'::jsonb'
def digest(sql):return "encode(sha256(convert_to(("+sql+")::text,'UTF8')),'hex')"
def replace(text,old,new,count=1):need(text.count(old)==count);return text.replace(old,new)
def qualify_proof_entry(data,expected):
 armed='7d3299a02ef3ffe40a0d4415977832b3b1422d0ebd283f2d9bc0590feb3860ae';closed='cc3c1cf2909ee8d3e9a88c0c0397a40f08ba63f3a945230ccb6f44903b97a3bc'
 need(expected==armed and sha(data)in(armed,closed))
 if sha(data)==closed:
  flag=b'export const EXECUTION_ENABLED = false;';need(data.count(flag)==1);need(sha(data.replace(flag,b'export const EXECUTION_ENABLED = true;'))==armed)
 return True

class Context:
 def __init__(self,root=MAIN,source=SOURCE):
  self.root=Path(root).resolve();self.source=Path(source).resolve();need(sha(load(self.root/STATE))==STATE_SHA)
  self.library=module('logo41_existing_full_reason_state',self.root/STATE);self.compat=self.library.State(NATIVE)
  self.b=self.compat.context.b;self.tables=self.compat.context.tables;need(len(self.tables)==76)
  self.history=copy.deepcopy(self.compat.anchor['history']);need(len(self.history)==40 and VERSION not in self.history)
  file=self.source/'development/m07/logo-info-operation-proof/candidate.py';need(sha(load(file))=='8bc3689f3a6e04f49541891cf228d72141eb2a8f6f68bf56c365a7bdef7eba8c')
  self.candidate=module('logo41_reviewed_candidate',file);self.old_body=self.candidate.baseline();need(sha(self.old_body.encode())==OLD and sha(self.candidate.patch_body(self.old_body).encode())==NEW)
  self.migration=load(self.source/MIGRATION);self.migration_sha=sha(self.migration);need(self.migration_sha==MIGRATION_SHA)
  need(self.migration.decode().count(self.candidate.candidate())==1)
  self.original_catalogue=self.compat.context.original_catalogue

 def normalized(self,text):
  # Qualified target prosrc only; to_jsonb(p) can also describe pg_policy, hence
  # require both target OID and actual pg_proc source key before altering a row.
  condition="p.oid="+literal(SIGNATURE)+"::regprocedure and to_jsonb(p)?'prosrc'"
  body="(case when p.oid="+literal(SIGNATURE)+"::regprocedure then "+literal(self.old_body)+"::text else p.prosrc end)"
  row="(case when "+condition+" then jsonb_set(to_jsonb(p),'{prosrc}',to_jsonb("+literal(self.old_body)+"::text))else to_jsonb(p)end)"
  nsrc=text.count('p.prosrc');nrow=text.count('to_jsonb(p)');need(nsrc>0 and nrow>0)
  result=text.replace('p.prosrc',body).replace('to_jsonb(p)',row)
  # The inserted row contains to_jsonb(p); undo its exact full expression first.
  inverse=result.replace(row,'to_jsonb(p)').replace(body,'p.prosrc');need(inverse==text)
  return result

 def compatibility_sql(self):
  original=self.compat.state_sql();sql=self.normalized(original)
  pattern=r'from supabase_migrations\.schema_migrations\b';count=len(re.findall(pattern,sql));need(count==6)
  sql=re.sub(pattern,'from logo41_history40',sql)
  need(re.sub(r'from logo41_history40\b','from supabase_migrations.schema_migrations',sql)==self.normalized(original))
  return sql

 def function_rows_sql(self,normalized=False):
  row='to_jsonb(p)'
  if normalized:row="case when p.oid="+literal(SIGNATURE)+"::regprocedure then jsonb_set(to_jsonb(p),'{prosrc}',to_jsonb("+literal(self.old_body)+"::text))else to_jsonb(p)end"
  return "select coalesce(jsonb_agg("+row+" order by p.oid),'[]'::jsonb)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public','auth','storage','extensions')"

 def state_sql(self):
  cte="with logo41_history40 as materialized(select * from supabase_migrations.schema_migrations where version<>"+literal(VERSION)+") "
  catalog="select catalog from("+self.original_catalogue+")logo41_catalogue"
  key='functions|'+SIGNATURE+'|source_sha256'
  norm_catalog="jsonb_set(("+catalog+"),array["+literal(key)+"],to_jsonb("+literal(OLD)+"::text))"
  target="(select jsonb_build_object('identity',to_jsonb(p)-'prosrc','source_sha256',"+digest('p.prosrc')+")from pg_proc p where p.oid="+literal(SIGNATURE)+"::regprocedure)"
  history="(select jsonb_build_object('versions',(select array_agg(version order by version)from supabase_migrations.schema_migrations),'old_rows_sha256',"+digest("(select coalesce(jsonb_agg(to_jsonb(m)order by version),'[]'::jsonb)from logo41_history40 m)")+",'new_entry_valid',exists(select 1 from supabase_migrations.schema_migrations m where m.version="+literal(VERSION)+"and to_jsonb(m)="+json_sql({'version':VERSION,'statements':[],'name':'m07_logo_info_operation'})+")))"
  full="jsonb_build_object('function_count',(select count(*)from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('eps','public','auth','storage','extensions')),'functions_normalized_sha256',"+digest('('+self.function_rows_sql(True)+')')+",'catalogue_normalized_sha256',"+digest(norm_catalog)+",'dependencies_sha256',"+digest("(select coalesce(jsonb_agg(to_jsonb(d)order by to_jsonb(d)::text),'[]'::jsonb)from pg_depend d)")+",'audit_attributes_sha256',"+digest("(select coalesce(jsonb_agg(to_jsonb(a)order by attnum),'[]'::jsonb)from pg_attribute a where a.attrelid='eps.audit_events'::regclass)")+")"
  return cte+"select jsonb_build_object('compatibility',("+self.compatibility_sql()+"),'history',"+history+",'target',"+target+",'full_scope',"+full+")"

 def check(self,value,installed):
  need(type(value)is dict and set(value)=={'compatibility','history','target','full_scope'})
  self.compat.check(value['compatibility']);canonical=value['compatibility']['schema40']['canonical']
  need(all(row['public']['enabled']is True for row in canonical['processing_config'].values())and canonical['processing_config']['frame_extraction_config']['public']['native_image_id']==NATIVE)
  h=value['history'];need(set(h)=={'versions','old_rows_sha256','new_entry_valid'}and h['versions']==self.history+([VERSION]if installed else[])and h['new_entry_valid']is installed and re.fullmatch('[a-f0-9]{64}',h['old_rows_sha256']))
  target=value['target'];need(set(target)=={'identity','source_sha256'}and target['source_sha256']==(NEW if installed else OLD)and type(target['identity'])is dict and 'prosrc'not in target['identity'])
  need(target['identity'].get('prosecdef')is True and target['identity'].get('provolatile')=='s')
  full=value['full_scope'];need(set(full)=={'function_count','functions_normalized_sha256','catalogue_normalized_sha256','dependencies_sha256','audit_attributes_sha256'}and type(full['function_count'])is int and full['function_count']>0 and all(re.fullmatch('[a-f0-9]{64}',v)for k,v in full.items()if k!='function_count'))
  return value
 def expected(self,before):
  self.check(before,False);after=copy.deepcopy(before);after['history']['versions'].append(VERSION);after['history']['new_entry_valid']=True;after['target']['source_sha256']=NEW;return after
 def transition(self,before,after):
  self.check(after,True);need(after==self.expected(before));return {'all76_full_rows_including_reason_unchanged':True,'all_function_metadata_OIDs_ACLs_policies_roles_dependencies_unchanged':True,'only_target_prosrc_and_one_history_row_changed':True}
 def checkpoint_sql(self):
  pairs=[literal(table)+",(select coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)from "+(table if table.startswith('public.')else'eps.'+table)+' t)'for table in self.tables]
  tables='('+'||'.join('jsonb_build_object('+','.join(pairs[i:i+50])+')'for i in range(0,len(pairs),50))+')'
  return "select jsonb_build_object('state',("+self.state_sql()+"),'application_tables',"+tables+",'catalogue',(select catalog from("+self.original_catalogue+")logo41_catalogue),'function_rows',("+self.function_rows_sql()+"),'history_rows',(select jsonb_agg(to_jsonb(m)order by version)from supabase_migrations.schema_migrations m))"
 def checkpoint_check(self,value,installed):
  need(type(value)is dict and set(value)=={'state','application_tables','catalogue','function_rows','history_rows'});self.check(value['state'],installed);need(set(value['application_tables'])==set(self.tables))
  for table,rows in value['application_tables'].items():
   current=value['state']['compatibility']['schema40'];count=current['intents']['count']if table=='project_creation_intents'else current['canonical']['base']['trace_rows']['count']if table=='job_stage_attempts'else current['canonical']['base']['data'][table]['count'];need(type(rows)is list and len(rows)==count)
  need(type(value['catalogue'])is dict and type(value['function_rows'])is list and len(value['function_rows'])==value['state']['full_scope']['function_count']and type(value['history_rows'])is list and len(value['history_rows'])==(41 if installed else 40));return value
 def render(self,before,marker):
  need(str(uuid.UUID(marker))==marker);after=self.expected(before)
  tables=','.join(table if table.startswith('public.')else'eps.'+table for table in self.tables)
  prefix="begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='60s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table "+tables+" in share mode;\n"
  def assertion(expected,tag):return 'do $logo41$declare observed jsonb;begin '+self.state_sql()+' into observed;if observed is distinct from '+json_sql(expected)+" then raise exception'"+tag+"';end if;end$logo41$;\n"
  return prefix+assertion(before,'LOGO41_PREIMAGE_CHANGED')+self.migration.decode()+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+VERSION+"',array[]::text[],'m07_logo_info_operation');\n"+assertion(after,'LOGO41_POSTIMAGE_CHANGED')+"commit;select jsonb_build_object('version','"+VERSION+"','marker','"+marker+"','migration_sha256','"+self.migration_sha+"')as reason40_release;"
 def source_pins(self):
  pins=self.compat.source_pins()
  for relative,expected in TRANSPORT_PINS.items():need(sha(load(self.root/relative))==expected);pins[str(self.root/relative)]=expected
  for file in [self.source/MIGRATION,self.root/PROOF,self.root/AUDIT,self.root/STATE,self.source/'development/m07/logo-info-operation-proof/candidate.py',*sorted(HERE.glob('*'))]:
   if file.is_file():pins[str(file)]=sha(load(file))
  return dict(sorted(pins.items()))
 def admission(self):
  raw=load(self.root/PROOF);need(sha(raw)==PROOF_SHA);proof=json.loads(raw)
  need(sha(load(self.root/AUDIT))==AUDIT_SHA)
  need(proof['result']=='passed'and proof['checkpoint']=='complete'and proof['logo_info']['case_count']==39 and proof['logo_info']['normal_child_return']is True and proof['logo_info']['full_clone_rows_catalogue_roles_rollback_exact']is True and proof['logo_info']['hosted_Storage_acceptance']is False)
  need(all(proof[key]is True for key in('all_preexisting_rows_preserved','all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
  need(proof['cloud_called']is False and proof['provider_called']is False and all(v is True for v in proof['cleanup_inventories'].values()))
  need(all(row['passed']is True for row in proof['logo_info']['cases'])and len(proof['source_seals'])==19)
  for relative,expected in proof['source_seals'].items():
   file=Path(relative);need(not file.is_absolute()and'..'not in file.parts);data=load(self.root/file)
   if relative=='development/m07/logo-info-owned-proof/entry.mjs':qualify_proof_entry(data,expected)
   else:need(sha(data)==expected)
  return {'target':TARGET,'version':VERSION,'migration_sha256':MIGRATION_SHA,'local_proof':{'path':PROOF,'sha256':PROOF_SHA},'local_proof_postrun_audit':{'path':AUDIT,'sha256':AUDIT_SHA},'full_reason_preservation':True,'hosted_Storage_acceptance_claimed':False}
