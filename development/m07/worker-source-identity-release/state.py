"""New schema40 worker state. Pure SQL construction, no dispatch or flag edits."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
COUNTERS=('queued','running','waiting_for_input','generic_retry_lifecycle','presentation_retry_lifecycle','pending_outbox','leased_outbox')
CONFIG=('candidate_asset_config','frame_extraction_config','presentation_processing_config','review_processing_config','specs_pipeline_config')
CONTEXT='development/m07/review-link-reason40-forward-baseline/proposal.py'
CONTEXT_SHA='b68b2b063094111cdf9c7887e589b657f03152746b2a3db9c4ee652bcb76079c'

def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
a=module('worker_identity_anchor_only',HERE/'admission.py')
need=a.need
def sha(raw):return hashlib.sha256(raw).hexdigest()
def literal(value):return "'"+str(value).replace("'","''")+"'"
def json_sql(value):return literal(json.dumps(value,separators=(',',':'),ensure_ascii=False))+'::jsonb'
def digest(expression):return "encode(sha256(convert_to(("+expression+")::text,'UTF8')),'hex')"
def once(text,old,new):need(text.count(old)==1);return text.replace(old,new)
def load(file):
 need(file.is_file()and not file.is_symlink()and file.resolve()==file and file.stat().st_nlink==1 and 0<file.stat().st_size<=16*1024**2);return file.read_bytes()

class State:
 def __init__(self,new_native,*,context=None,approved=None):
  need(type(new_native)is str and re.fullmatch('sha256:[a-f0-9]{64}',new_native)and new_native!=a.OLD['native_digest']);self.new_native=new_native
  if approved is None:
   raw=load(MAIN/a.APPLY['path']);need(sha(raw)==a.APPLY['sha256']);approved=json.loads(raw)
  a.canonical40(approved);self.anchor=copy.deepcopy(approved['first'])
  if context is None:
   need(sha(load(MAIN/CONTEXT))==CONTEXT_SHA);m=module('worker_identity_frozen_accepted40_context',MAIN/CONTEXT);context=m.ProposedContext(root=MAIN,source=MAIN)
  self.context=context
 def check(self,value):
  need(type(value)is dict and set(value)=={'schema40','lifecycle','oauth_count_only'})
  need(type(value['lifecycle'])is dict and set(value['lifecycle'])==set(COUNTERS)and all(type(n)is int and n==0 for n in value['lifecycle'].values()))
  current=value['schema40'];need(type(current)is dict and set(current)==set(self.anchor))
  for field in('history','functions','authority','dependencies','history_identity'):need(current[field]==self.anchor[field])
  reason=current['reason'];need(type(reason)is dict and set(reason)=={'present','shape_valid','historical_nonnull'}and reason['present']is True and reason['shape_valid']is True
   and type(reason['historical_nonnull'])is int and 0<=reason['historical_nonnull']<=current['canonical']['base']['data']['audit_events']['count'])
  oauth=value['oauth_count_only'];base=current['canonical']['base'];anchor=self.anchor['canonical']['base']
  need(type(oauth)is dict and set(oauth)=={'claims_count','full_sha256','static_sha256','reconstructed_anchor_full_sha256'}
   and type(oauth['claims_count'])is int and oauth['claims_count']>=anchor['data']['oauth_consent_claims']['count']
   and oauth['claims_count']==base['data']['oauth_consent_claims']['count']and type(oauth['full_sha256'])is str and re.fullmatch('[a-f0-9]{64}',oauth['full_sha256'])and oauth['full_sha256']==base['oauth']['sha256']
   and oauth['static_sha256']==base['oauth_static_sha256']==anchor['oauth_static_sha256']and oauth['reconstructed_anchor_full_sha256']==anchor['oauth']['sha256'])
  configs=current['canonical']['processing_config'];need(set(configs)==set(CONFIG))
  need(all(type(row['public']['enabled'])is bool for row in configs.values()))
  need(configs['frame_extraction_config']['public']['native_image_id']in(a.OLD['native_digest'],self.new_native))
  # Only a validation copy resets mutable controls and the old migration-only
  # reason-null observation. Real counts and full audit hashes stay in value.
  normalized=copy.deepcopy(current);normalized['reason']['historical_nonnull']=0
  normalized['canonical']['base']['oauth']['sha256']=self.context.anchor['base']['oauth']['sha256']
  for row in normalized['canonical']['processing_config'].values():row['public']['enabled']=True
  normalized['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=a.OLD['native_digest']
  self.context.check(normalized,True)
  return value
 def initial(self,value):
  self.check(value);config=value['schema40']['canonical']['processing_config']
  need(all(row['public']['enabled']is True for row in config.values())and config['frame_extraction_config']['public']['native_image_id']==a.OLD['native_digest']);return value
 def comparable(self,value):
  result=copy.deepcopy(value);canonical=result['schema40']['canonical']
  for table in CONFIG:del canonical['base']['data'][table];del canonical['processing_config'][table]['table_hash']
  return result
 def expected(self,before,phase):
  self.check(before);need(phase in('pause','pin','resume'));configs=before['schema40']['canonical']['processing_config']
  need(all(row['public']['enabled']is(phase=='pause')for row in configs.values()))
  need(configs['frame_extraction_config']['public']['native_image_id']==(self.new_native if phase=='resume'else a.OLD['native_digest']))
  after=self.comparable(before);configs=after['schema40']['canonical']['processing_config']
  if phase=='pin':configs['frame_extraction_config']['public']['native_image_id']=self.new_native
  else:
   for row in configs.values():row['public']['enabled']=phase=='resume'
  return after
 def transition(self,before,after,phase):self.check(after);need(self.comparable(after)==self.expected(before,phase));return True
 def state_sql(self):
  # Exactly one inherited audit-table hash changes from migration old-column
  # comparison to the genuine full current row, including optional reason.
  old="(to_jsonb(t)-'reason')::text,'UTF8')),'hex')h from eps.audit_events t"
  sql=once(self.context.state_sql(),old,"(to_jsonb(t))::text,'UTF8')),'hex')h from eps.audit_events t")
  oauth=self.context.c.normalized_oauth()[1];count=self.anchor['canonical']['base']['data']['oauth_consent_claims']['count']
  observed="jsonb_build_object('claims_count',v->'claims_count','full_sha256',"+digest('v')+",'static_sha256',"+digest("v-'claims_count'")+",'reconstructed_anchor_full_sha256',"+digest("jsonb_set(v,'{claims_count}',to_jsonb("+str(count)+"::bigint))")+")"
  return "select jsonb_build_object('schema40',("+sql+"),'lifecycle',"+self.context.c.adoption.lifecycle_sql()+",'oauth_count_only',(select "+observed+" from(select "+oauth+" v)worker_identity_oauth))"
 def prefix(self):
  configs=','.join('eps.'+table for table in CONFIG);others=','.join(table if table.startswith('public.')else'eps.'+table for table in self.context.tables if table not in CONFIG)
  return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='60s';lock table "+configs+" in access exclusive mode;lock table supabase_migrations.schema_migrations in share mode;lock table "+others+" in share mode;\n"
 def comparable_sql(self):
  term='q.value'
  for table in CONFIG:term+=" #- '{schema40,canonical,base,data,"+table+"}' #- '{schema40,canonical,processing_config,"+table+",table_hash}'"
  return 'select(select '+term+' from('+self.state_sql()+' as value)q)'
 def render(self,before,phase,marker):
  need(str(uuid.UUID(marker))==marker);after=self.expected(before,phase)
  def assertion(sql,expected,tag):return 'do $worker_identity$declare observed jsonb;begin '+sql+' into observed;if observed is distinct from '+json_sql(expected)+"then raise exception'"+tag+"';end if;end$worker_identity$;\n"
  sql=self.prefix()+assertion(self.state_sql(),before,'WORKER_IDENTITY_PREIMAGE_CHANGED')
  for table in('frame_extraction_config',)if phase=='pin'else CONFIG:
   assignment='native_image_id='+literal(self.new_native)if phase=='pin'else'enabled='+str(phase=='resume').lower()
   sql+="do $worker_identity_update$declare changed integer;begin update eps."+table+' set '+assignment+";get diagnostics changed=row_count;if changed<>1 then raise exception'WORKER_IDENTITY_ONE_CONFIG_REQUIRED';end if;end$worker_identity_update$;\n"
  sql+=assertion(self.comparable_sql(),after,'WORKER_IDENTITY_POSTIMAGE_CHANGED')
  return sql+"commit;select jsonb_build_object('phase',"+literal(phase)+",'marker',"+literal(marker)+")as worker_identity_release;"
 def checkpoint_sql(self):
  pairs=[literal(table)+",(select coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)from "+(table if table.startswith('public.')else'eps.'+table)+' t)'for table in self.context.tables]
  tables='('+'||'.join('jsonb_build_object('+','.join(pairs[i:i+50])+')'for i in range(0,len(pairs),50))+')'
  return "select jsonb_build_object('state',("+self.state_sql()+"),'application_tables',"+tables+",'catalogue',(select catalog from("+self.context.original_catalogue+")worker_identity_catalogue))"
 def checkpoint_check(self,value):
  need(type(value)is dict and set(value)=={'state','application_tables','catalogue'});self.check(value['state']);need(set(value['application_tables'])==set(self.context.tables))
  state=value['state']['schema40']
  for table,rows in value['application_tables'].items():
   count=state['intents']['count']if table=='project_creation_intents'else state['canonical']['base']['trace_rows']['count']if table=='job_stage_attempts'else state['canonical']['base']['data'][table]['count']
   need(type(rows)is list and len(rows)==count)
  return value
 def sql_contract_sha256(self):return sha(load(Path(__file__).resolve()))
 def source_pins(self):
  pins=self.context.source_pins();pins[str(MAIN/CONTEXT)]=CONTEXT_SHA;pins[str(MAIN/a.APPLY['path'])]=a.APPLY['sha256']
  for file in sorted(HERE.iterdir()):
   if file.is_file():pins[str(file)]=sha(load(file))
  return dict(sorted(pins.items()))
