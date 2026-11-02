"""New fixed namespace. Reuse frozen custody methods, never the consumed entry."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,sys,uuid
MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
BRIDGE_ENABLED=False
BASE=Path(__file__).resolve().parent.parent/'pdf47-streaming-evaluation/private_bridge.py'
BASE_SHA='ac8a6d1c219d82781aa78fbfa84dbbf1c80a4098215162bd3a7784b28ee34b22'
SCHEMA='pdf47-budget32k-input.v1'
PURPOSE='one_retained_pdf47_budget32k_evaluation'
def need(value):
 if not value:raise ValueError('PDF47_BUDGET32K_PRIVATE_REFUSED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
need(sha(BASE.read_bytes())==BASE_SHA)
base=module('pdf47_frozen_streaming_custody_library',BASE)
SQL=base.SQL.replace('pdf47-streaming-input.v1',SCHEMA)
need(SQL.replace(SCHEMA,'pdf47-streaming-input.v1')==base.SQL and SQL!=base.SQL)
HELPER,HELPER_SHA,READER,READER_SHA,TARGET=base.HELPER,base.HELPER_SHA,base.READER,base.READER_SHA,base.TARGET
strict=base.strict
def validate_input(value):
 need(type(value)is dict and value.get('schema_version')==SCHEMA)
 base.validate_input({**value,'schema_version':'pdf47-streaming-input.v1'})
 return value
class Store(base.Store):
 def __init__(self,run):
  need(str(uuid.UUID(run))==run and sha(HELPER.read_bytes())==HELPER_SHA)
  prior=list(sys.path)
  try:sys.path.insert(0,str(MAIN/'tools'));security=module('pdf47_existing_private_guard_32k',HELPER)
  finally:sys.path[:]=prior
  self.guard=security.WindowsPrivateFiles();self.root=MAIN/'.local/pdf47-budget32k-evaluation'/run;self.run=run
  security.safe_path(self.root);self.root.mkdir(parents=True,exist_ok=True);security.safe_path(self.root)
 def prepare(self):
  need(not self.path('input.json').exists()and not self.path('dispatch.claim.json').exists())
  need((MAIN/'supabase/.temp/project-ref').read_text().strip()==TARGET and sha(READER.read_bytes())==READER_SHA)
  need(not any(os.environ.get(k)for k in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD')))
  import pglast;pglast.parse_sql(SQL)
  with self.guard.create(self.path('source.sql'))as stream:stream.write(SQL.encode());stream.flush();os.fsync(stream.fileno());self.guard.verify_open(stream)
  reader=module('pdf47_existing_bounded_reader_32k',READER)
  args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',TARGET,'--file',str(self.path('source.sql')),'--output-format','json','--workdir',str(MAIN)]
  code,timeout,overflow,out,err=reader.bounded(args,reader.environment());need(code==0 and not timeout and not overflow)
  value=strict(out.encode(),256*1024);rows=value if type(value)is list else value.get('rows');need(type(rows)is list and len(rows)==1 and set(rows[0])=={'retained_pdf47'})
  value=rows[0]['retained_pdf47'];validate_input(value);self.write('input.json',value)
  return{'prepared':True,'provider_requests':0,'input_file_sha256':sha((json.dumps(value,separators=(',',':'))+'\n').encode())}
 def claim(self,value):
  validate_input(self.read('input.json',256*1024));need(type(value)is dict and value.get('run_id')==self.run and value.get('purpose')==PURPOSE)
  self.write('dispatch.claim.json',{'claimed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'request':value})
  return{'claimed':True,'automatic_replay':False}
def main():
 need(BRIDGE_ENABLED);need(Path(__file__).resolve()==MAIN/'development/m07/pdf47-budget32k-evaluation/private_bridge.py')
 need(len(sys.argv)==1);value=strict(sys.stdin.buffer.read(6*1024**2+1),6*1024**2)
 need(type(value)is dict and set(value)<=set(('run','operation','value'))and value.get('operation')in('prepare','read','claim','persist_response','persist'))
 store=Store(value['run']);operation=value['operation']
 if operation=='prepare':result=store.prepare()
 elif operation=='read':result=validate_input(store.read('input.json',256*1024))
 elif operation=='claim':result=store.claim(value['value'])
 elif operation=='persist_response':result=store.persist_response(value['value'])
 else:result=store.persist(value['value'])
 sys.stdout.write(json.dumps({'ok':True,'value':result},separators=(',',':'))+'\n')
if __name__=='__main__':
 try:main()
 except Exception:sys.stdout.write('{"ok":false,"code":"PDF47_BUDGET32K_PRIVATE_REFUSED"}\n');raise SystemExit(1)from None
