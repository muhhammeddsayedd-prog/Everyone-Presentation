"""Pure, finite SQL40 admission and projection. No provider or file writes."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re,uuid

HERE=Path(__file__).resolve().parent
SOURCE=HERE.parents[2]
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
TARGET='pyibofyctwnqpvktepse'
VERSION='20261102085405'
MIGRATION='supabase/migrations/20261102085405_m07_review_link_action_reason.sql'
MIGRATION_SHA='08bf4de8a63823b0e7c9aee75560a6e7de0620eb9b8b3c483c65929578db8212'
PROOF='tracking/evidence/m07/review-link-reason40-preparing-proof/2026-11-02T10-22-01.195Z-51a83db4.json'
PROOF_SHA='d79b1938472a0d943c3c7e993bffeaeff1c51d78a73454e092b16767dbfd4060'
APPLIED39='tracking/evidence/m07/project-creation39-canonical-release/2026-11-01T23-46-11-679664Z-apply.json'
APPLIED39_SHA='badbed58027c49897734251edb3aba666571eb57aa6b4e3f6e053c88dc264864'
RESUMED='tracking/evidence/m07/completion-worker/2026-11-02T02-28-39-166492Z-rollout39-resume.json'
RESUMED_SHA='f1e22e7c71a4b72b64d70eacb4acd33355a0e492a4cbaf65469f6d9f89cb894a'
PARENT='development/m07/project-creation39-canonical-release/state.py'
PARENT_SHA='52beee5cb7d6143af858db5d8f5d2fc62f00708f2703f29f44f1e2c9b8ffd082'
NATIVE='sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4'
MAXIMUM=16*1024*1024

def need(value):
 if not value:raise ValueError('REASON40_CANONICAL_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(path,maximum=MAXIMUM):
 path=Path(path);need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_nlink==1 and 0<path.stat().st_size<=maximum);return path.read_bytes()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def replace_once(text,old,new):
 need(text.count(old)==1);return text.replace(old,new)
def literal(value):return "'"+str(value).replace("'","''")+"'"
def json_sql(value):return literal(json.dumps(value,separators=(',',':')))+'::jsonb'
def digest(expression):return "encode(sha256(convert_to(("+expression+")::text,'UTF8')),'hex')"

class Context:
 def __init__(self,root=MAIN,source=SOURCE):
  self.root=Path(root).resolve();self.source=Path(source).resolve()
  need(sha(load(self.root/PARENT))==PARENT_SHA)
  parent=module('reason40_frozen_project39_projection',self.root/PARENT)
  owner=self
  class Projection(parent.Context):
   def identity_sql(self):return owner.identity_sql(super().identity_sql())
  self.c=Projection(root=self.root,own=self.root/Path(PARENT).parent);self.b=self.c.b
  self.builder=module('reason40_frozen_builder',self.source/'development/m07/review-link-reason/build.py')
  self.migration=load(self.source/MIGRATION);need(sha(self.migration)==MIGRATION_SHA and self.migration.decode()==self.builder.build())
  base=json.loads(load(self.source/'development/m07/review-link-reason/before-functions.json'))
  self.history=base['history'];self.names=self.builder.NAMES;need(len(self.history)==39)
  self.old=dict(zip(self.names,self.builder.SOURCE_HASHES));self.new={}
  for definition in re.findall(r'CREATE OR REPLACE FUNCTION .*?(?=\nCREATE OR REPLACE FUNCTION |\n-- END REASON40)',self.migration.decode(),re.S):
   signature=next(name for name in self.names if definition.startswith('CREATE OR REPLACE FUNCTION '+name.split('(')[0]+'('));self.new[signature]=sha(self.builder.source(definition).encode())
  need(set(self.new)==set(self.names))
  raw=load(self.root/APPLIED39);need(sha(raw)==APPLIED39_SHA);applied=json.loads(raw)
  need(applied['result']=='passed'and applied['normal_return_marker_observed']is True and applied['two_independent_readbacks_equal']is True and applied['first']==applied['second'])
  self.anchor=applied['first'];self.c.check(self.anchor,True)
  raw=load(self.root/RESUMED);need(sha(raw)==RESUMED_SHA);resumed=json.loads(raw)
  need(resumed['result']=='passed'and resumed['phase']=='resume'and resumed['normal_return_observed']is True and resumed['two_equal_readbacks']is True and resumed['native_digest']==NATIVE)
  self.tables=sorted(set(self.b.TABLES)|{'job_stage_attempts','project_creation_intents'});need(len(self.tables)==76)
  self.original_catalogue=self.c.catalogue
  columns=['columns|eps.audit_events.reason|'+key for key in('type','not_null','acl','identity','generated','default')]
  patches={f'functions|{name}|source_sha256':value for name,value in self.old.items()}
  self.c.catalogue='select (catalog-'+json_sql(columns)+')||'+json_sql(patches)+' catalog from('+self.original_catalogue+')reason40_catalogue'

 def identity_sql(self,original):
  signatures=','.join(literal(name)+'::regprocedure'for name in self.builder.NAMES)
  original=replace_once(original,"case when p.oid=to_regprocedure('eps.project_dto(uuid)')then ","case when p.oid in("+signatures+")then to_jsonb(p)-'prosrc'when p.oid=to_regprocedure('eps.project_dto(uuid)')then ")
  prefix="case when c.oid in(to_regclass('public.projects'),to_regclass('auth.users'))then "
  beginning=original.index(prefix)+len(prefix);ending=original.index("-'relhastriggers'else ",beginning);plain=original[beginning:ending]
  # The only existing pg_class field changed by this nullable append is relnatts.
  original=replace_once(original,prefix,"case when c.oid=to_regclass('eps.audit_events')then jsonb_set("+plain+",'{relnatts}',to_jsonb(c.relnatts-(select count(*)::integer from pg_attribute reason40_attribute where reason40_attribute.attrelid=c.oid and reason40_attribute.attname='reason'and not reason40_attribute.attisdropped)))when c.oid in(to_regclass('public.projects'),to_regclass('auth.users'))then ")
  start=original.index("select 'pg_attribute:'");end=original.index(' union all ',start)
  original=original[:end]+" and not(a.attrelid=to_regclass('eps.audit_events')and a.attname='reason')"+original[end:]
  return original

 def function_sql(self):
  values=','.join('('+literal(name)+')'for name in self.names)
  return "(select jsonb_object_agg(signature,jsonb_build_object('identity',to_jsonb(p)-'prosrc','source_sha256',"+digest('p.prosrc')+"))from(values"+values+")v(signature)join pg_proc p on p.oid=to_regprocedure(signature))"

 def reason_sql(self):
  # Compare the complete new pg_attribute row with the existing nullable text
  # request_id column, changing only its name and appended ordinal. No broad
  # omission of audit attributes, dependencies, RLS, ACLs or table metadata.
  return "(select jsonb_build_object('present',a.attname is not null,'shape_valid',coalesce(a.attnum=c.relnatts and a.attnum>reference.attnum and reference.atttypid=25 and not reference.attnotnull and not reference.atthasdef and reference.attacl is null and(to_jsonb(a)-array['attname','attnum']::text[])=(to_jsonb(reference)-array['attname','attnum']::text[]),false),'historical_nonnull',case when a.attname is null then 0 else(select count(*)from eps.audit_events t where to_jsonb(t)->'reason'is distinct from'null'::jsonb)end)from pg_class c join pg_attribute reference on reference.attrelid=c.oid and reference.attname='request_id'left join pg_attribute a on a.attrelid=c.oid and a.attname='reason'and not a.attisdropped where c.oid=to_regclass('eps.audit_events'))"

 def dependency_sql(self):
  owned="d.classid='pg_class'::regclass and d.objid='eps.audit_events'::regclass and d.objsubid in(select attnum from pg_attribute where attrelid='eps.audit_events'::regclass and attname='reason'and not attisdropped)"
  exact="d.refclassid='pg_type'::regclass and d.refobjid=25 and d.refobjsubid=0 and d.deptype='n'"
  return "(select jsonb_build_object('old',jsonb_build_object('count',count(*)filter(where not("+owned+")),'sha256',"+digest("coalesce(jsonb_agg(to_jsonb(d)order by to_jsonb(d)::text)filter(where not("+owned+")),'[]'::jsonb)")+"),'reason_dependencies_valid',coalesce(bool_and("+exact+")filter(where "+owned+"),true))from pg_depend d)"

 def state_sql(self):
  sql=self.c.state_sql(True)
  old="(to_jsonb(t))::text,'UTF8')),'hex')h from eps.audit_events t"
  sql=replace_once(sql,old,"(to_jsonb(t)-'reason')::text,'UTF8')),'hex')h from eps.audit_events t")
  intents="(select jsonb_build_object('count',count(*),'sha256',"+digest("coalesce(jsonb_agg(to_jsonb(t)order by project_id),'[]'::jsonb)")+")from eps.project_creation_intents t)"
  # Also retain creator-role OIDs/memberships, which the historical39 projector
  # excluded while proving that role's original addition. Only the existing
  # normal CLI role's renewable expiry is normalized, exactly as in39.
  role="case when r.oid=17603 and r.rolname='cli_login_postgres'then jsonb_set(to_jsonb(r)-'rolpassword','{rolvaliduntil}','null'::jsonb)else to_jsonb(r)-'rolpassword'end"
  authority="jsonb_build_object('roles',"+digest("(select coalesce(jsonb_agg("+role+" order by oid),'[]'::jsonb)from pg_roles r)")+",'memberships',"+digest("(select coalesce(jsonb_agg(to_jsonb(m)order by roleid,member,grantor),'[]'::jsonb)from pg_auth_members m)")+")"
  history="jsonb_build_object('old_rows',"+digest("(select coalesce(jsonb_agg(to_jsonb(m)order by version),'[]'::jsonb)from supabase_migrations.schema_migrations m where version<>"+literal(VERSION)+")")+",'new_entry_valid',exists(select 1 from supabase_migrations.schema_migrations where version="+literal(VERSION)+"and statements=array[]::text[]and name='m07_review_link_action_reason'))"
  return "select(select jsonb_build_object('history',q.value#>'{base,history}','canonical',q.value,'intents',"+intents+",'functions',"+self.function_sql()+",'reason',"+self.reason_sql()+",'dependencies',"+self.dependency_sql()+",'authority',"+authority+",'history_identity',"+history+")from("+sql+" as value)q)"

 def check(self,value,installed):
  need(type(value)is dict and set(value)=={'history','canonical','intents','functions','reason','dependencies','authority','history_identity'})
  need(value['history']==self.history+([VERSION]if installed else[])and value['canonical']['base']['history']==value['history'])
  normalized=copy.deepcopy(value['canonical']);normalized['base']['history']=self.history;normalized['project39']['intent_rows']=0;self.c.check(normalized,True)
  need(value['intents']['count']==value['canonical']['project39']['intent_rows']and re.fullmatch('[a-f0-9]{64}',value['intents']['sha256']))
  need(value['reason']=={'present':installed,'shape_valid':installed,'historical_nonnull':0})
  need(value['dependencies']['reason_dependencies_valid']is True and set(value['functions'])==set(self.names))
  need(value['history_identity']['new_entry_valid']is installed and re.fullmatch('[a-f0-9]{64}',value['history_identity']['old_rows']))
  need(set(value['authority'])=={'roles','memberships'}and all(re.fullmatch('[a-f0-9]{64}',v)for v in value['authority'].values()))
  for name in self.names:need(value['functions'][name]['source_sha256']==(self.new if installed else self.old)[name])
  legacy=normalized['base']['legacy'];historical=self.anchor['base']['legacy']
  # Exact reviewed forward39 aggregate qualification: these historical business
  # counters may grow, while every freshly captured value remains phase-frozen.
  for item in(legacy,historical):
   need(type(item)is dict and set(item)=={'unsupported_metadata_count','job_count','kinds'}and type(item['unsupported_metadata_count'])is int and item['unsupported_metadata_count']==0)
   need(type(item['job_count'])is int and item['job_count']>=0 and type(item['kinds'])is dict and set(item['kinds'])<=set(('specs_extract','candidate_scan','frame_extract','ai_suggestion','review_fit','presentation_render','presentation_export')))
   need(all(type(n)is int and n>=0 for n in item['kinds'].values())and sum(item['kinds'].values())==item['job_count'])
  need(legacy['job_count']>=historical['job_count']and all(legacy['kinds'].get(kind,0)>=count for kind,count in historical['kinds'].items()))
  static=copy.deepcopy(normalized);anchor=copy.deepcopy(self.anchor)
  for image in(static,anchor):
   del image['base']['data'];del image['base']['trace_rows'];del image['project39']['intent_rows']
   del image['base']['legacy']['job_count'];del image['base']['legacy']['kinds']
   for row in image['processing_config'].values():del row['table_hash']
   image['processing_config']['frame_extraction_config']['public']['native_image_id']=NATIVE
  need(static==anchor and value['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']==NATIVE)
  return value

 def expected(self,before):
  self.check(before,False);after=copy.deepcopy(before);after['history']+=[VERSION];after['canonical']['base']['history']+=[VERSION]
  after['reason']={'present':True,'shape_valid':True,'historical_nonnull':0}
  after['history_identity']['new_entry_valid']=True
  for name in self.names:after['functions'][name]['source_sha256']=self.new[name]
  return after
 def transition(self,before,after):
  self.check(after,True);need(after==self.expected(before))
  return dict.fromkeys(('all76_table_old_column_hashes_unchanged','historical_audit_reasons_null','all_existing_function_OIDs_owners_ACLs_security_unchanged','all_old_catalogue_roles_memberships_RLS_grants_unchanged','only_nullable_reason_four_bodies_and_history_added'),True)

 def checkpoint_sql(self):
  pairs=[literal(table)+",(select coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)from "+(table if table.startswith('public.')else'eps.'+table)+' t)'for table in self.tables]
  chunks=['jsonb_build_object('+','.join(pairs[i:i+50])+')'for i in range(0,len(pairs),50)]
  return "select jsonb_build_object('state',("+self.state_sql()+"),'application_tables',"+'||'.join(chunks)+",'catalogue',(select catalog from("+self.original_catalogue+")c))"
 def checkpoint_check(self,payload,installed):
  need(type(payload)is dict and set(payload)=={'state','application_tables','catalogue'});self.check(payload['state'],installed);need(set(payload['application_tables'])==set(self.tables))
  for table,rows in payload['application_tables'].items():
   need(type(rows)is list)
   expected=payload['state']['intents']['count']if table=='project_creation_intents'else payload['state']['canonical']['base']['trace_rows']['count']if table=='job_stage_attempts'else payload['state']['canonical']['base']['data'][table]['count']
   need(len(rows)==expected)
  return payload

 def render(self,before,marker):
  need(str(uuid.UUID(marker))==marker);after=self.expected(before)
  tables=','.join(table if table.startswith('public.')else'eps.'+table for table in self.tables)
  prefix="begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='60s';lock table supabase_migrations.schema_migrations in share row exclusive mode;lock table "+tables+" in share mode;\n"
  def assertion(expected,tag):return 'do $reason40_assert$declare observed jsonb;begin '+self.state_sql()+' into observed;if observed is distinct from '+json_sql(expected)+" then raise exception'"+tag+"';end if;end$reason40_assert$;\n"
  return prefix+assertion(before,'REASON40_PREIMAGE_CHANGED')+self.migration.decode()+"\ninsert into supabase_migrations.schema_migrations(version,statements,name)values('"+VERSION+"',array[]::text[],'m07_review_link_action_reason');\n"+assertion(after,'REASON40_POSTIMAGE_CHANGED')+"commit;select jsonb_build_object('version','"+VERSION+"','marker','"+marker+"','migration_sha256','"+MIGRATION_SHA+"')as reason40_release;"

 def source_pins(self):
  result={str(self.root/path):value for path,value in self.c.source_pins().items()}
  for path in(MIGRATION,PROOF,'development/m07/review-link-reason/build.py','development/m07/review-link-reason/before-functions.json'):
   result[str(self.source/path)]=sha(load(self.source/path))
  for path in(APPLIED39,RESUMED,'development/m07/completion-worker-rollout39/capture.py'):
   result[str(self.root/path)]=sha(load(self.root/path))
  for path in sorted(HERE.glob('*')):
   if path.is_file():result[str(path)]=sha(load(path))
  return dict(sorted(result.items()))

 def admission(self):
  raw=load(self.source/PROOF);need(sha(raw)==PROOF_SHA);proof=json.loads(raw)
  need(proof['result']=='passed'and proof['all_owned_resources_absent']is True and proof['original_data_catalogue_and_global_roles_unchanged']is True and proof['shared_lock_released']is True and proof['cloud_called']is False and proof['provider_called']is False)
  # The inherited bootstrap receipt's top-level migration_sha256 identifies39.
  # SQL40 is sealed separately; never relabel the historical bootstrap field.
  need(proof['source_seals'][MIGRATION]==MIGRATION_SHA and proof['owned_admission_adapter']['functional_ddl_unchanged']is True and proof['all_preexisting_old_column_rows_preserved']is True and proof['audit_reason_original_rows_null']is True and proof['actual_session_count']==5)
  return {'target':TARGET,'version':VERSION,'migration_sha256':MIGRATION_SHA,'local_proof':{'path':PROOF,'sha256':PROOF_SHA},'canonical39':{'path':APPLIED39,'sha256':APPLIED39_SHA},'worker_resume':{'path':RESUMED,'sha256':RESUMED_SHA},'checkpoint_is_not_restore_proof':True}
