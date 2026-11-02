"""Finite admin-context fix only. Old dc source/claims are never dispatched."""
from pathlib import Path
import importlib.util,json,re,uuid
HERE=Path(__file__).resolve().parent;SOURCE=HERE.parents[2];MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio');OLD=MAIN/'development/m07/worker-source-identity-sql-proof'
PLAN='tracking/evidence/m07/worker-source-identity-sql-proof/disabled-owned-plan.json';PLAN_SHA='117b45a7d197d4152068e197d6ad3a97f49445e07363f61970b164f172be7575'
FAILED='tracking/evidence/m07/worker-source-identity-sql-proof/2026-11-02T19-56-40.835Z-dc652691.json';FAILED_SHA='43f38baa4fa1ed0e05802d1863068046360e8b026311d7b8d5d7e7e0ebb56440'
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def sha(raw):return __import__('hashlib').sha256(raw).hexdigest()
def need(value):
 if not value:raise ValueError('WORKER40_ADMIN_PROOF_COMPILATION_REFUSED')
def normalized_flag(raw):
 a=b'export const EXECUTION_ENABLED=false;';b=b'export const EXECUTION_ENABLED=true;';need(raw.count(a)+raw.count(b)==1);return raw.replace(b,a)
def compile_source(relative):
 match=re.fullmatch(r'\.local/worker-source-identity-sql-admin-compiled/controller-([a-f0-9-]{36})\.mjs',relative);need(match is not None and str(uuid.UUID(match[1]))==match[1]and uuid.UUID(match[1]).version==4)
 raw=(MAIN/PLAN).read_bytes();need(sha(raw)==PLAN_SHA);plan=json.loads(raw)
 for name in('compiler.py','local.py','projection.py','cases.mjs'):
  raw=(OLD/name).read_bytes();need(sha(normalized_flag(raw)if name=='cases.mjs'else raw)==plan['source_seals']['development/m07/worker-source-identity-sql-proof/'+name])
 raw=(MAIN/FAILED).read_bytes();need(sha(raw)==FAILED_SHA);failure=json.loads(raw);need(failure['result']=='failed'and failure['checkpoint']=='worker40-declared-fixtures'and all(failure[key]is True for key in('all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 enabled=b'export const EXECUTION_ENABLED=true;'in(HERE/'entry.mjs').read_bytes();need(normalized_flag((HERE/'entry.mjs').read_bytes()).count(b'export const EXECUTION_ENABLED=false;')==1)
 old=module('worker40_frozen_failed_compiler_library',OLD/'compiler.py');old_relative=relative.replace('worker-source-identity-sql-admin-compiled','worker-source-identity-sql-compiled');source,_,_=old.compile_source(old_relative);original=source;changes=[]
 def replace(before,after):
  nonlocal source;need(source.count(before)==1);source=source.replace(before,after,1);changes.append((before,after))
 begin=source.index('const cfg=')+len('const cfg=');cfg,length=json.JSONDecoder().raw_decode(source[begin:]);old_cfg=json.dumps(cfg,sort_keys=True)
 concurrency,projection=old.module('worker40_admin_same_concurrency',OLD/'projection.py').project(cfg['sql_contract_sha256'],enabled);concurrency_relative=relative.replace('/controller-','/concurrency-');old_concurrency=cfg['concurrency_file'];cfg['source_pins'].pop(old_concurrency);cfg['concurrency_file']=str(MAIN/concurrency_relative);cfg['concurrency_sha256']=sha(concurrency.encode());cfg['concurrency_projection']=projection;cfg['source_pins'][cfg['concurrency_file']]=cfg['concurrency_sha256']
 callback=(OLD/'cases.mjs').read_text();flag='export const EXECUTION_ENABLED=true;'if b'export const EXECUTION_ENABLED=true;'in(OLD/'cases.mjs').read_bytes()else'export const EXECUTION_ENABLED=false;';newflag='export const EXECUTION_ENABLED='+str(enabled).lower()+';';need(callback.count(flag)==1);callback=callback.replace(flag,newflag,1);bridge="new URL('./local.py',import.meta.url)";absolute='new URL('+json.dumps((OLD/'local.py').as_uri())+')';need(callback.count(bridge)==1);callback=callback.replace(bridge,absolute,1);need(callback.replace(absolute,bridge,1).replace(newflag,flag,1)==(OLD/'cases.mjs').read_text())
 callback_relative=relative.replace('/controller-','/callback-');cfg['admin_callback_file']=str(MAIN/callback_relative);cfg['admin_callback_sha256']=sha(callback.encode());cfg['source_pins'][cfg['admin_callback_file']]=cfg['admin_callback_sha256']
 for file in sorted(HERE.iterdir()):
  if file.is_file():cfg['source_pins'][str(file)]=sha(file.read_bytes())
 cfg['source_pins'][str(MAIN/PLAN)]=PLAN_SHA;cfg['source_pins'][str(MAIN/FAILED)]=FAILED_SHA;replace('const cfg='+old_cfg+';','const cfg='+json.dumps(cfg,sort_keys=True)+';');replace((OLD/'cases.mjs').as_uri(),(HERE/'entry.mjs').as_uri())
 replace(old_relative,relative)
 # Restrict the original admin context to the unchanged q.sql qualification.
 # Config95e9 and every actual State/callback keep explicit postgres context.
 before='    await sql("set session authorization postgres;begin;set local eps.worker39.run="+quote(runId)+";set local eps.reason40fixture.run="+quote(runId)+\';\'+qualified+config+\'commit;\');'
 after="""    const qualificationGuard="do $admin$begin if current_user<>'supabase_admin'or session_user<>'supabase_admin'or not(select rolsuper from pg_roles where rolname=current_user)or current_database()<>'project39'or(pg_control_system()).system_identifier::text<>"+quote(identity.system_identifier)+"or current_setting('eps.worker39.run',true)is distinct from"+quote(runId)+"or(select nspowner from pg_namespace where nspname='project39_proof')is distinct from(select oid from pg_roles where rolname=current_user)then raise exception'WORKER40_ORIGINAL_OWNED_ADMIN_REQUIRED';end if;end$admin$;";
    await sql("reset session authorization;begin;set local eps.worker39.run="+quote(runId)+';'+qualificationGuard+qualified+'commit;');
    await sql("set session authorization postgres;begin;set local eps.reason40fixture.run="+quote(runId)+';'+config+'commit;');
    report.qualification_context={original_current_and_session_supabase_admin:true,super_and_schema_owner_asserted:true,owned_database_system_run_asserted_before_qualification:true,config_and_actual_State_explicit_postgres:true,no_role_grant_or_owner_change:true};"""
 replace(before,after)
 for before,after in[("'.local/worker-source-identity-sql-proof'","'.local/worker-source-identity-sql-admin-proof'"),("'.local/worker-source-identity-sql-once'","'.local/worker-source-identity-sql-admin-once'"),("'eps.worker40.run'","'eps.worker40admin.run'"),("'eps.worker40.workspace'","'eps.worker40admin.workspace'"),("'eps.worker40.purpose'","'eps.worker40admin.purpose'"),("'worker40-owned-phase-validation'","'worker40-admin-owned-phase-validation'"),("'eps-w40-'","'eps-w40a-'"),("'worker40-independent-phase-validation'","'worker40-admin-independent-phase-validation'"),("'tracking/evidence/m07/worker-source-identity-sql-proof'","'tracking/evidence/m07/worker-source-identity-sql-admin-proof'")]:replace(before,after)
 # The two source-record path entries are data, not executable library edits.
 replace(json.dumps(old_relative.replace('/controller-','/concurrency-')),json.dumps(concurrency_relative))
 marker='    report.source_seals = {}; for (const [root, file] of ';start=source.index(marker)+len(marker);end=source.index(' {\n      const bytes = await readFile',start);records=json.loads(source[start:end-1]);before=source[start:end-1];records.extend([[str(SOURCE).replace('\\','/'),file.relative_to(SOURCE).as_posix()]for file in sorted(HERE.iterdir())if file.is_file()]);records.extend([[str(MAIN).replace('\\','/'),callback_relative],[str(MAIN).replace('\\','/'),PLAN],[str(MAIN).replace('\\','/'),FAILED]]);replace(before,json.dumps(records))
 inverse=source
 for before,after in reversed(changes):need(inverse.count(after)==1);inverse=inverse.replace(after,before,1)
 need(inverse==original);return source,concurrency,callback,{'compiled_only':True,'execution_dispatched':False,'execution_enabled':enabled,'original_controller_inverse_byte_equal':True,'callback_only_flag_and_absolute_bridge_changed':True,'no_cast_read_grant_added':True,'production_State_SQL_hashes':cfg['hashes'],'sql_contract_sha256':cfg['sql_contract_sha256'],'native_pin_value':cfg['native_pin_value'],'source_pins':cfg['source_pins'],'failure':{'path':FAILED,'sha256':FAILED_SHA}}
if __name__=='__main__':
 token=str(uuid.uuid4());relative='.local/worker-source-identity-sql-admin-compiled/controller-'+token+'.mjs';source,concurrency,callback,plan=compile_source(relative)
 for prefix,text in[('concurrency',concurrency),('callback',callback),('controller',source)]:
  file=MAIN/relative.replace('/controller-','/'+prefix+'-');file.parent.mkdir(parents=True,exist_ok=True)
  with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(text)
 print(json.dumps({'controller':str(MAIN/relative),'controller_sha256':sha(source.encode()),'concurrency_sha256':sha(concurrency.encode()),'callback_sha256':sha(callback.encode()),**plan}))
