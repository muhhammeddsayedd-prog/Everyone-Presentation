"""Disabled fixed input/output/once-claim custody; existing bounded normal reader and Win32 ACLs."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,re,sys,uuid
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BRIDGE_ENABLED=True
HELPER=MAIN/'tools/provision_logo_verifier.py'
HELPER_SHA='660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c'
READER=MAIN/'development/m07/oauth-attempt-trace/inspect-attempt.py'
READER_SHA='1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'
TARGET='pyibofyctwnqpvktepse'
SQL="""begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';
 select jsonb_build_object('schema_version','pdf47-low-effort-input.v1','job_id',j.id,'source_asset_id',j.input_asset_id,
 'configured_model',j.input#>>'{configuration,model_version}','prepared_text_bytes',octet_length(p.prepared_text),
 'mapped_pages',(select count(distinct x->>'page')filter(where jsonb_typeof(x->'page')='number')from jsonb_array_elements(p.paragraphs)x),
 'prepared_source_verified',j.kind='specs_extract'and j.status='failed'and j.stage='extract_specs'
  and a.id='0fbc905f-c51e-472d-9d03-74664ee9ac86'::uuid and a.purpose='specs'and a.status='ready'and a.size_bytes=3058335
  and a.origin_workspace_id=j.workspace_id and a.sha256=j.input->>'source_hash'and p.input_hash=j.input_hash,
 'input',jsonb_build_object('sourceAssetId',j.input_asset_id,'correlationId',j.correlation_id,'inputHash',j.input_hash,'paragraphs',p.paragraphs))as retained_pdf47
 from eps.jobs j join eps.specs_stage_payloads p on p.job_id=j.id and p.stage='prepare_document'
 join eps.media_assets a on a.id=j.input_asset_id
 where j.id='47f86513-8999-4946-b5d9-f2fd6a18fd00'::uuid;rollback;"""

def need(value):
 if not value:raise ValueError('PDF47_EVALUATION_PRIVATE_REFUSED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def strict(raw,limit):
 need(type(raw)is bytes and 0<len(raw)<=limit)
 def pairs(items):
  value={}
  for key,item in items:need(key not in value);value[key]=item
  return value
 return json.loads(raw.decode('utf8'),object_pairs_hook=pairs)
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

class Store:
 def __init__(self,run):
  need(str(uuid.UUID(run))==run and sha(HELPER.read_bytes())==HELPER_SHA)
  prior=list(sys.path)
  try:sys.path.insert(0,str(MAIN/'tools'));security=module('pdf47_existing_private_guard',HELPER)
  finally:sys.path[:]=prior
  self.guard=security.WindowsPrivateFiles();self.root=MAIN/'.local/pdf47-low-effort-evaluation'/run;self.run=run
  security.safe_path(self.root);self.root.mkdir(parents=True,exist_ok=True);security.safe_path(self.root)
 def path(self,name):
  need(name in('source.sql','input.json','dispatch.claim.json','output.json'))
  result=self.root/name;need(result.resolve().parent==self.root.resolve());return result
 def write(self,name,value):
  raw=(json.dumps(value,separators=(',',':'))+'\n').encode();need(0<len(raw)<=5*1024**2)
  with self.guard.create(self.path(name))as stream:stream.write(raw);stream.flush();os.fsync(stream.fileno());self.guard.verify_open(stream)
 def read(self,name,limit):
  file=self.path(name);self.guard.verify(file)
  with file.open('rb')as stream:
   self.guard.verify_open(stream);raw=stream.read(limit+1);self.guard.verify_open(stream)
  return strict(raw,limit)
 def prepare(self):
  need(not self.path('input.json').exists()and not self.path('dispatch.claim.json').exists())
  need((MAIN/'supabase/.temp/project-ref').read_text().strip()==TARGET and sha(READER.read_bytes())==READER_SHA)
  need(not any(os.environ.get(k)for k in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD')))
  import pglast;pglast.parse_sql(SQL)
  with self.guard.create(self.path('source.sql'))as stream:stream.write(SQL.encode());stream.flush();os.fsync(stream.fileno());self.guard.verify_open(stream)
  reader=module('pdf47_existing_bounded_reader',READER)
  args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(self.path('source.sql')),'--output-format','json','--workdir',str(MAIN)]
  code,timeout,overflow,out,err=reader.bounded(args,reader.environment());need(code==0 and not timeout and not overflow)
  value=strict(out.encode(),256*1024);rows=value if type(value)is list else value.get('rows');need(type(rows)is list and len(rows)==1 and set(rows[0])=={'retained_pdf47'})
  value=rows[0]['retained_pdf47'];validate_input(value);self.write('input.json',value)
  return{'prepared':True,'provider_requests':0,'input_file_sha256':sha((json.dumps(value,separators=(',',':'))+'\n').encode())}
 def claim(self,value):
  validate_input(self.read('input.json',256*1024))
  need(type(value)is dict and value.get('run_id')==self.run and value.get('purpose')=='one_retained_pdf47_low_effort_evaluation')
  self.write('dispatch.claim.json',{'claimed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'request':value})
  return{'claimed':True,'automatic_replay':False}
 def persist(self,value):
  claim=self.read('dispatch.claim.json',65536);need(claim['request']['run_id']==self.run)
  need(type(value)is dict and set(value)=={'result','metadata'})
  self.write('output.json',value);return{'persisted_privately':True}

def validate_input(value):
 need(type(value)is dict and set(value)=={'schema_version','job_id','source_asset_id','configured_model','prepared_text_bytes','mapped_pages','prepared_source_verified','input'})
 need(value['schema_version']=='pdf47-low-effort-input.v1'and value['job_id']=='47f86513-8999-4946-b5d9-f2fd6a18fd00'and value['source_asset_id']=='0fbc905f-c51e-472d-9d03-74664ee9ac86')
 need(value['configured_model']=='gpt-6.1-sol'and value['prepared_text_bytes']==12807 and value['mapped_pages']==24 and value['prepared_source_verified']is True)
 item=value['input'];need(type(item)is dict and set(item)=={'sourceAssetId','correlationId','inputHash','paragraphs'}and item['sourceAssetId']==value['source_asset_id'])
 need(type(item['inputHash'])is str and re.fullmatch('[a-f0-9]{64}',item['inputHash'])and type(item['correlationId'])is str and re.fullmatch('[A-Za-z0-9._:-]{1,200}',item['correlationId']))
 need(type(item['paragraphs'])is list and len(item['paragraphs'])==219)
 return value

def main():
 need(BRIDGE_ENABLED)
 need(len(sys.argv)==1);value=strict(sys.stdin.buffer.read(6*1024**2+1),6*1024**2)
 need(type(value)is dict and set(value)<=set(('run','operation','value'))and value.get('operation')in('prepare','read','claim','persist'))
 store=Store(value['run']);operation=value['operation']
 if operation=='prepare':result=store.prepare()
 elif operation=='read':result=validate_input(store.read('input.json',256*1024))
 elif operation=='claim':result=store.claim(value['value'])
 else:result=store.persist(value['value'])
 sys.stdout.write(json.dumps({'ok':True,'value':result},separators=(',',':'))+'\n')
if __name__=='__main__':
 try:main()
 except Exception:sys.stdout.write('{"ok":false,"code":"PDF47_EVALUATION_PRIVATE_REFUSED"}\n');raise SystemExit(1)from None
