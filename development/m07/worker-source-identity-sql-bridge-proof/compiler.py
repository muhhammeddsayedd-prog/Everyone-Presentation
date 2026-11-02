"""Finite diagnostic bridge composition; frozen admin/State/SQL remain libraries."""
from pathlib import Path
import importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio');ADMIN=MAIN/'development/m07/worker-source-identity-sql-admin-proof'
PLAN='tracking/evidence/m07/worker-source-identity-sql-admin-proof/disabled-owned-plan.json';PLAN_SHA='dd3380e8336c99dbcbe3e5aa8d9385d314ff4f66b883c189458a41c82f28aaa0'
FAILED='tracking/evidence/m07/worker-source-identity-sql-admin-proof/2026-11-02T20-26-27.192Z-727bb36d.json';FAILED_SHA='f576a81b37bcfa8b1ed02ff6070dc6122fd4c80d0105c04a5ce29569ad609eec'

def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def sha(raw):return __import__('hashlib').sha256(raw).hexdigest()
def need(value):
 if not value:raise ValueError('WORKER40_BRIDGE_PROOF_COMPILATION_REFUSED')
def flag(raw):
 a=b'export const EXECUTION_ENABLED=false;';b=b'export const EXECUTION_ENABLED=true;';need(raw.count(a)+raw.count(b)==1);return raw.replace(b,a)

def compile_source(relative):
 match=re.fullmatch(r'\.local/worker-source-identity-sql-bridge-compiled/controller-([a-f0-9-]{36})\.mjs',relative);need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4)
 raw=(MAIN/PLAN).read_bytes();need(sha(raw)==PLAN_SHA);plan=json.loads(raw)
 for name in('compiler.py','entry.mjs','test_correction.py','README.md'):
  raw=(ADMIN/name).read_bytes();need(sha(flag(raw)if name=='entry.mjs'else raw)==plan['source_seals']['development/m07/worker-source-identity-sql-admin-proof/'+name])
 raw=(MAIN/FAILED).read_bytes();need(sha(raw)==FAILED_SHA);failure=json.loads(raw);need(failure['result']=='failed'and failure['checkpoint']=='worker40-actual-phase-and-concurrency'and all(failure[key]is True for key in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 raw=(HERE/'entry.mjs').read_bytes();enabled=b'export const EXECUTION_ENABLED=true;'in raw;flag(raw)
 base=module('worker40_frozen_admin_compiler_library',ADMIN/'compiler.py');old_relative=relative.replace('worker-source-identity-sql-bridge-compiled','worker-source-identity-sql-admin-compiled');source,_,callback,_=base.compile_source(old_relative);original=source;changes=[];before_callback=callback
 def replace(before,after):
  nonlocal source;need(source.count(before)==1);source=source.replace(before,after,1);changes.append((before,after))
 begin=source.index('const cfg=')+len('const cfg=');cfg,length=json.JSONDecoder().raw_decode(source[begin:]);old_cfg=json.dumps(cfg,sort_keys=True)
 concurrency,projection=base.module('worker40_bridge_same_concurrency',base.OLD/'projection.py').project(cfg['sql_contract_sha256'],enabled);concurrency_relative=relative.replace('/controller-','/concurrency-');cfg['source_pins'].pop(cfg['concurrency_file']);cfg['concurrency_file']=str(MAIN/concurrency_relative);cfg['concurrency_sha256']=sha(concurrency.encode());cfg['concurrency_projection']=projection;cfg['source_pins'][cfg['concurrency_file']]=cfg['concurrency_sha256']
 oldflag='export const EXECUTION_ENABLED=true;'if'export const EXECUTION_ENABLED=true;'in callback else'export const EXECUTION_ENABLED=false;';newflag='export const EXECUTION_ENABLED='+str(enabled).lower()+';';need(callback.count(oldflag)==1);callback=callback.replace(oldflag,newflag,1)
 start=callback.index('async function bridge(action,value,ctx){');end=callback.index('function acting(){',start);old_bridge=callback[start:end];new_bridge='async function bridge(action,value,ctx){return diagnosticBridge(action,value,ctx);}\n';callback=callback[:start]+new_bridge+callback[end:]
 added='import { diagnosticBridge } from '+json.dumps((HERE/'bridge.mjs').as_uri())+';\n';callback=added+callback
 inverse=callback.replace(added,'',1).replace(new_bridge,old_bridge,1).replace(newflag,oldflag,1);need(inverse==before_callback)
 cfg['source_pins'].pop(cfg['admin_callback_file']);callback_relative=relative.replace('/controller-','/callback-');cfg['admin_callback_file']=str(MAIN/callback_relative);cfg['admin_callback_sha256']=sha(callback.encode());cfg['source_pins'][cfg['admin_callback_file']]=cfg['admin_callback_sha256']
 for file in sorted(HERE.iterdir()):
  if file.is_file():cfg['source_pins'][str(file)]=sha(file.read_bytes())
 cfg['source_pins'][str(MAIN/PLAN)]=PLAN_SHA;cfg['source_pins'][str(MAIN/FAILED)]=FAILED_SHA;replace('const cfg='+old_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';');replace((ADMIN/'entry.mjs').as_uri(),(HERE/'entry.mjs').as_uri());replace(old_relative,relative)
 for before,after in[("'.local/worker-source-identity-sql-admin-proof'","'.local/worker-source-identity-sql-bridge-proof'"),("'.local/worker-source-identity-sql-admin-once'","'.local/worker-source-identity-sql-bridge-once'"),("'eps.worker40admin.run'","'eps.worker40bridge.run'"),("'eps.worker40admin.workspace'","'eps.worker40bridge.workspace'"),("'eps.worker40admin.purpose'","'eps.worker40bridge.purpose'"),("'worker40-admin-owned-phase-validation'","'worker40-bridge-owned-phase-validation'"),("'eps-w40a-'","'eps-w40b-'"),("'worker40-admin-independent-phase-validation'","'worker40-bridge-independent-phase-validation'"),("'tracking/evidence/m07/worker-source-identity-sql-admin-proof'","'tracking/evidence/m07/worker-source-identity-sql-bridge-proof'")]:replace(before,after)
 replace(json.dumps(old_relative.replace('/controller-','/concurrency-')),json.dumps(concurrency_relative));replace(json.dumps(old_relative.replace('/controller-','/callback-')),json.dumps(callback_relative))
 marker='    report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(' {\n      const bytes = await readFile',start);before=source[start:end-1];records=json.loads(before);records.extend([[str(SOURCE).replace('\\','/'),file.relative_to(SOURCE).as_posix()]for file in sorted(HERE.iterdir())if file.is_file()]);records.extend([[str(MAIN).replace('\\','/'),PLAN],[str(MAIN).replace('\\','/'),FAILED]]);replace(before,json.dumps(records))
 inverse=source
 for before,after in reversed(changes):need(inverse.count(after)==1);inverse=inverse.replace(after,before,1)
 need(inverse==original)
 return source,concurrency,callback,{'compiled_only':True,'execution_dispatched':False,'execution_enabled':enabled,'original_admin_controller_inverse_byte_equal':True,'callback_only_diagnostic_bridge_and_flag_changed':True,'production_State_SQL_hashes':cfg['hashes'],'sql_contract_sha256':cfg['sql_contract_sha256'],'native_pin_value':cfg['native_pin_value'],'source_pins':cfg['source_pins'],'failure':{'path':FAILED,'sha256':FAILED_SHA},'bridge_bounds':{'combined_output_bytes':32*1024**2,'deadline_ms':30000,'same_Python_CLI_and_inherited_environment':True,'retry':False}}

if __name__=='__main__':
 token=str(uuid.uuid4());relative='.local/worker-source-identity-sql-bridge-compiled/controller-'+token+'.mjs';source,concurrency,callback,plan=compile_source(relative)
 for prefix,text in[('concurrency',concurrency),('callback',callback),('controller',source)]:
  file=MAIN/relative.replace('/controller-','/'+prefix+'-');file.parent.mkdir(parents=True,exist_ok=True)
  with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(MAIN/relative),'controller_sha256':sha(source.encode()),'concurrency_sha256':sha(concurrency.encode()),'callback_sha256':sha(callback.encode()),**plan}))
