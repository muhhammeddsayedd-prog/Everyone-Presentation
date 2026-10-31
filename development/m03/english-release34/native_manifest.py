"""Same-ID public manifest environment adoption; root execution only.

Never reads a sensitive value or writes a credential. Existing metadata validators
are reused as pure functions; all completed old operators remain unchanged.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, subprocess, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
release=module('english34_release_metadata',HERE/'release.py')
native=module('english34_native_metadata',HERE/'native_admission.py')
OLD_HELPER=ROOT/'development/m07/controlled-pilot/worker-forward31.py'
OLD_HELPER_SHA='39741d783962e4a9fde38915578ba4cc84432a7dacb84ec6c8b78f1468541e18'
old=module('english34_frozen_environment_validation',OLD_HELPER)
PRIVATE=release.PRIVATE;CLAIM=PRIVATE/'native-manifest.claim.json';RETURNED=PRIVATE/'native-manifest.process-returned.json'
KEY='EPS_NATIVE_MANIFEST_SHA256';LAST_ERROR=None
CLI=ROOT/'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js'
NODE=Path('C:/Program Files/nodejs/node.exe');GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli'

def need(value):
 if not value:raise ValueError('ENGLISH34_MANIFEST_ADOPTION_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def sources():
 pins=release.sources();need(sha(OLD_HELPER.read_bytes())==OLD_HELPER_SHA)
 need(sha(NODE.read_bytes())==old.NODE_SHA256)
 for relative,digest in old.CLI_PINS.items():need(sha((CLI.parent/relative).read_bytes())==digest)
 return {**pins,OLD_HELPER.relative_to(ROOT).as_posix():OLD_HELPER_SHA,**{(HERE/name).relative_to(ROOT).as_posix():sha((HERE/name).read_bytes())for name in ['native_manifest.py','native_admission.py','native_pin.py']}}
def environment():
 # Construct a narrow child environment. Ambient DEBUG and provider secrets are
 # neither forwarded nor emitted. Credentials stay in the existing CLI store.
 result={k:os.environ[k]for k in ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG']if k in os.environ}
 result.update({'PATH':'','NODE_ENV':'production','CI':'1','VERCEL_TELEMETRY_DISABLED':'1','VERCEL_CLI_USE_NATIVE_BINARY':'0'});return result
def exclusive(path,value):
 need(path.parent==PRIVATE and not path.exists());PRIVATE.mkdir(parents=True,exist_ok=True)
 need(PRIVATE.resolve()==PRIVATE and not PRIVATE.is_symlink())
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True)+'\n');stream.flush();os.fsync(stream.fileno())

class API:
 def __init__(self):self.commands=0
 def call(self,endpoint,body=None,on_return=None):
  need(self.commands<12);self.commands+=1
  args=[str(NODE),str(CLI),'api',endpoint,'--scope','muhammed-abdelrahman','--raw','--global-config',GLOBAL]
  if body is not None:args+=['--method','PATCH','--input','-']
  # Fixed provider endpoints below contain only public project/env IDs.
  process=subprocess.run(args,cwd=ROOT,env=environment(),input=None if body is None else json.dumps(body),capture_output=True,text=True,encoding='utf8',errors='replace',timeout=30,stdin=subprocess.DEVNULL if body is None else None)
  if on_return is not None:on_return()
  need(process.returncode==0 and len(process.stdout.encode())<=2*1024*1024 and len(process.stderr.encode())<=1024*1024)
  return json.loads(process.stdout)
 def observe(self):
  metadata=old.project_metadata(self.call('/v10/projects/'+native.PROJECT+'/env?teamId='+native.TEAM+'&decrypt=false'))
  row=next(r for r in metadata if r['key']==KEY)
  value=old.project_public_value(self.call('/v1/projects/'+native.PROJECT+'/env/'+row['id']+'?teamId='+native.TEAM),row)
  return {'metadata':metadata,'manifest_sha256':value}
def outcome(before,first,second,new_hash,returned):
 passed=returned and first==second and first is not None and old.preserved_metadata(before['metadata'],first['metadata'])and first['manifest_sha256']==new_hash
 return {'result':'passed'if passed else'unconfirmed','normal_process_return_observed':returned,'independent_readback_equal':first is not None and first==second,'metadata_and_all_28_ids_preserved':first is not None and old.preserved_metadata(before['metadata'],first['metadata']),'before':before,'first':first,'second':second,'claim_retained':True,'automatic_dispatch_retry':False}
def main():
 need(len(sys.argv)==2 and sys.argv[1]in('inspect','apply','readback'));action=sys.argv[1];pins=sources();plan=native.plan();api=API()
 project=api.call('/v9/projects/'+native.PROJECT+'?teamId='+native.TEAM)
 need(project.get('id')==native.PROJECT and project.get('accountId')==native.TEAM and project.get('name')=='everyone-presentation-worker-pilot'and project.get('nodeVersion')=='24.x'and project.get('rootDirectory')is None and project.get('oidcTokenConfig',{}).get('enabled')is True)
 new_hash=plan['next']['manifest_sha256']
 if action=='inspect':
  observed=api.observe();need(observed['manifest_sha256']==native.OLD_MANIFEST);report={'result':'observed','inspection':observed,'dispatch_attempted':False}
 elif action=='readback':
  data=json.loads(CLAIM.read_text(encoding='utf8'));need(data['target']==native.TARGET and data['source_pins']==pins and data['plan']==plan)
  returned=False
  if RETURNED.exists():
   returned_doc=json.loads(RETURNED.read_text(encoding='utf8'));returned=returned_doc=={'claim_sha256':sha(CLAIM.read_bytes()),'new_manifest_sha256':new_hash,'process_returned':True}
  first=api.observe();second=api.observe();report={**outcome(data['before'],first,second,new_hash,returned),'dispatch_attempted':False}
 else:
  need(not CLAIM.exists()and not RETURNED.exists());before=api.observe();need(before['manifest_sha256']==native.OLD_MANIFEST)
  # The exact canonical33 proof/drain is also checked directly before dispatch.
  canonical=release.read_state(False);release.check_before(canonical)
  exclusive(CLAIM,{'target':native.TARGET,'source_pins':pins,'plan':plan,'before':before,'canonical_before':canonical,'claimed_at':release.stamp(),'dispatch_may_have_occurred':True})
  need(api.observe()==before and native.plan()==plan and sources()==pins)
  need(release.read_state(False)==canonical)
  row=next(r for r in before['metadata']if r['key']==KEY);need(re.fullmatch('[A-Za-z0-9_-]{1,128}',row['id']))
  returned=False
  def on_return():
   nonlocal returned
   exclusive(RETURNED,{'claim_sha256':sha(CLAIM.read_bytes()),'new_manifest_sha256':new_hash,'process_returned':True});returned=True
  try:api.call('/v9/projects/'+native.PROJECT+'/env/'+row['id']+'?teamId='+native.TEAM,{'value':new_hash},on_return)
  except Exception:pass
  first=second=None
  try:first=api.observe();second=api.observe()
  except Exception:pass
  report={**outcome(before,first,second,new_hash,returned),'dispatch_attempted':True}
  try:need(release.read_state(False)==canonical and sources()==pins and native.plan()==plan)
  except Exception:report['result']='unconfirmed'
 path=release.receipt('native-manifest-'+action,{'project_id':native.PROJECT,'team_id':native.TEAM,'source_pins':pins,'plan':plan,'cli_commands_attempted':api.commands,'secrets_transferred':False,'deployment_performed':False,'cli_internal_same_value_patch_retries_possible':True,'exact_wire_attempt_count_claimed':False,**report})
 print(json.dumps({'result':report['result'],'receipt':path,'claim_retained':CLAIM.exists()}));need(report['result']in('passed','observed'))
if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_MANIFEST_ADOPTION_UNCONFIRMED');sys.exit(1)
