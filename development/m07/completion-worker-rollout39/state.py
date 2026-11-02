"""NEW pure canonical39 processing transition; never runs an old operator."""
from pathlib import Path
import copy,hashlib,importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
TARGET='pyibofyctwnqpvktepse'
SOURCE='0566342ec367efef328885aac513adeb5a942048ba01c88e1af63e4d636b6730'
NATIVE='sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4'
DAEMON='sha256:2d66eed2c5f584f3f261d2f241062cbb9fa088bbbc32437aed1ce0b6adf2c594'
MANIFEST='a317b0c7398ab12d960271f9d9d8ce98d846ed390a77fc0bb02c50b9b6df9943'
OLD_NATIVE='sha256:50082f72d4438653d4c831a1f9a360d61e64d19b3568ed1c2a2456d486f0d77c'
OLD_DAEMON='sha256:ce23af3ba163199c1e35f224f71a281ab450d7acfc0f4ab85b6044df5246431c'
OLD_MANIFEST='3e20f7b1c795ab2e825a02327c4a4a241b97a57a8bf3d28e2a265f7eba8630f9'
OLD_DEPLOYMENT='dpl_G6CVBYjPxYwh8zNaAYLu4pURoVG4'
CONTEXT_SOURCE='development/m07/project-creation39-canonical-release/state.py'
CONTEXT_SHA='52beee5cb7d6143af858db5d8f5d2fc62f00708f2703f29f44f1e2c9b8ffd082'
APPLIED='tracking/evidence/m07/project-creation39-canonical-release/2026-11-01T23-46-11-679664Z-apply.json'
APPLIED_SHA='badbed58027c49897734251edb3aba666571eb57aa6b4e3f6e053c88dc264864'
def need(v):
 if not v:raise ValueError('COMPLETION_ROLLOUT39_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def load(file,maximum=16*1024**2):
 need(file.is_file()and not file.is_symlink()and file.resolve()==file and file.stat().st_nlink==1 and 0<file.stat().st_size<=maximum);return file.read_bytes()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v);return v

class State:
 def __init__(self):
  need(sha(load(MAIN/CONTEXT_SOURCE))==CONTEXT_SHA)
  self.m=module('completion_rollout39_existing_pure_projector',MAIN/CONTEXT_SOURCE)
  self.c=self.m.Context(root=MAIN,own=MAIN/'development/m07/project-creation39-canonical-release');self.b=self.c.b;self.a=self.c.adoption
  raw=load(MAIN/APPLIED);need(sha(raw)==APPLIED_SHA);proof=json.loads(raw)
  need(proof['result']=='passed'and proof['normal_return_marker_observed']is True and proof['two_independent_readbacks_equal']is True and proof['first']==proof['second'])
  self.anchor=proof['first'];self.c.check(self.anchor,True)
  need(self.anchor['processing_config']['frame_extraction_config']['public']['native_image_id']==OLD_NATIVE)
  self.config=self.a.CONFIG;self.counters=self.a.COUNTERS
 def source_pins(self):
  pins={str(MAIN/name):value for name,value in self.c.source_pins().items()}
  pins[str(MAIN/CONTEXT_SOURCE)]=CONTEXT_SHA;pins[str(MAIN/APPLIED)]=APPLIED_SHA
  for file in sorted(HERE.glob('*')):
   if file.is_file():pins[str(file)]=sha(load(file))
  return pins
 def state_sql(self):
  # The old projector covers all74 existing business tables, trace, protected
  # M02 and normalized OAuth/identity plus exact143 schema39 metadata additions.
  # Add all new intent data bytes as an opaque SQL-side hash, not count alone.
  intents="(select jsonb_build_object('count',count(*),'sha256',"+self.b.digest_sql("coalesce(jsonb_agg(to_jsonb(t)order by project_id),'[]'::jsonb)")+")from eps.project_creation_intents t)"
  return "select(select jsonb_build_object('canonical',q.value,'intent_data',"+intents+")from("+self.c.state_sql(True)+" as value)q)"
 def check(self,value):
  need(type(value)is dict and set(value)=={'canonical','intent_data'})
  canonical=value['canonical'];normalized=copy.deepcopy(canonical)
  for row in normalized['processing_config'].values():row['public']['enabled']=True
  self.c.check(normalized,True)
  need(len(canonical['base']['history'])==39 and canonical['base']['history'][-1]==self.m.VERSION)
  for table,(_,fields)in self.config.items():
   row=canonical['processing_config'][table]
   need(set(row)=={'public','shape_valid','fixed_sha256','table_hash'}and row['shape_valid']is True and set(row['public'])==set(fields.split())and type(row['public']['enabled'])is bool)
   for key in('fixed_sha256','table_hash'):need(type(row[key])is str and re.fullmatch('[a-f0-9]{64}',row[key]))
   need(canonical['base']['data'][table]=={'count':1,'sha256':row['table_hash']})
  need(canonical['processing_config']['candidate_asset_config']['public']['english_transcript_version']=='1.0'
   and canonical['processing_config']['frame_extraction_config']['public']['implementation_version']=='frame-extraction.v1')
  intent=value['intent_data'];need(set(intent)=={'count','sha256'}and type(intent['count'])is int and intent['count']==canonical['project39']['intent_rows']and re.fullmatch('[a-f0-9]{64}',intent['sha256']))
  return value
 def comparable(self,value):
  value=copy.deepcopy(value)
  for table in self.config:
   del value['canonical']['base']['data'][table];del value['canonical']['processing_config'][table]['table_hash']
  return value
 def initial(self,value):
  self.check(value);need(value['canonical']==self.anchor)
  need(all(row['public']['enabled']is True for row in value['canonical']['processing_config'].values()))
  need(value['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']==OLD_NATIVE)
  return value
 def expected(self,before,phase):
  self.check(before);need(phase in('pause','pin','resume','unwind'))
  enabled=phase=='pause';image=NATIVE if phase=='resume'else OLD_NATIVE
  need(all(row['public']['enabled']is enabled for row in before['canonical']['processing_config'].values()))
  need(before['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']==image)
  after=self.comparable(before)
  if phase=='pin':after['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=NATIVE
  else:
   for row in after['canonical']['processing_config'].values():row['public']['enabled']=phase in('resume','unwind')
  return after
 def transition(self,before,after,phase):self.check(after);need(self.comparable(after)==self.expected(before,phase));return True
 def prefix(self):
  configs=','.join('eps.'+name for name in sorted(self.config))
  others=sorted(set(self.b.TABLES)-set(self.config));tables=','.join(name if name.startswith('public.')else'eps.'+name for name in others)
  return "begin isolation level repeatable read;set local search_path='';set local timezone='UTC';set local lock_timeout='5s';set local statement_timeout='45s';lock table "+configs+" in access exclusive mode;lock table supabase_migrations.schema_migrations in share mode;lock table "+tables+",eps.job_stage_attempts,eps.project_creation_intents in share mode;\n"
 def comparable_sql(self):
  value='q.value'
  for table in self.config:value+=" #- '{canonical,base,data,"+table+"}' #- '{canonical,processing_config,"+table+",table_hash}'"
  return 'select(select '+value+' from('+self.state_sql()+' as value)q)'
 def render(self,before,phase,marker):
  need(str(uuid.UUID(marker))==marker);after=self.expected(before,phase)
  sql=self.prefix()+self.b.old.assertion(self.state_sql(),before,'COMPLETION39_PREFLIGHT_CHANGED')
  for table in ['frame_extraction_config']if phase=='pin'else sorted(self.config):
   assignment='native_image_id='+self.b.literal(NATIVE)if phase=='pin'else'enabled='+str(phase in('resume','unwind')).lower()
   sql+="do $completion39$declare changed integer;begin update eps."+table+' set '+assignment+";get diagnostics changed=row_count;if changed<>1 then raise exception'COMPLETION39_ONE_CONFIG_REQUIRED';end if;end$completion39$;\n"
  sql+=self.b.old.assertion(self.comparable_sql(),after,'COMPLETION39_POSTCONDITION_FAILED')
  return sql+"commit;select jsonb_build_object('phase',"+self.b.literal(phase)+",'marker',"+self.b.literal(marker)+")as completion39_rollout;"
 def sql_contract_sha256(self):return sha(load(Path(__file__).resolve()))
