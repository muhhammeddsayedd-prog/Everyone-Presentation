"""Root-executed fixed worker-project VCR credential refresh, no token extraction.

The pinned Vercel CLI mints its own project-scoped token and sends it directly
to Docker stdin. No auth file or helper secret is opened by this controller.
"""
from pathlib import Path
import datetime, hashlib, json, os, subprocess, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
NODE=Path('C:/Program Files/nodejs/node.exe')
DOCKER=Path('C:/Program Files/Docker/Docker/resources/bin/docker.exe')
HELPER=DOCKER.parent/'docker-credential-desktop.exe'
CLI=ROOT/'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js'
GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli'
DOCKER_CONFIG=ROOT/'.local/m07-pilot/docker-config'
PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1';REPO='repo_OpIvBNiZ8vPVROs68HxcMb39W6yz'
PRIVATE=ROOT/'.local/m03-english-image34';CLAIM=PRIVATE/'vcr-login.claim.json'
OLD_IMAGE='vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:77eee0ee51159c6420fffefcdce39406a47350ddae682f4ec86891fe7ec08ed8'
FAILURE=ROOT/'tracking/evidence/m03/native-probe34/2026-10-31T16-45-38-995626Z-native-build-push-failure.json'
FAILURE_SHA='b2d3cb1874c5f61610b9e9dda27ddc5814e7872706ad0ff665981ef20355024c'
PINS={
 'vc.js':'5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493',
 'chunks/login-EPBJQDEK.js':'36608450dc87f554a3b0570a0f6deab24b82581c3178731e20130e4b311f26fb',
 'chunks/chunk-KDRCBWRY.js':'79d75b4c54d42c0779cee699f2e37ed84dcadb6c6e178315d740a5d264952807',
 'chunks/chunk-3AXMZRAB.js':'e43d8d2565d33655855c44a145778dd9070488df18701673018807cf62c48298'}

def need(value):
 if not value:raise ValueError('ENGLISH34_VCR_LOGIN_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sources():
 for relative,digest in PINS.items():need(sha((CLI.parent/relative).read_bytes())==digest)
 for path,digest in [(NODE,'9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de'),(DOCKER,'e768033e4b3f0dc760162f417a80360094644d16cd9fb12ad65c9d97508c076f'),(HELPER,'2856e226b29ae2a9c67dd2419adbd527c03c34a84fc82454856b61f555c2b3b5')]:
  need(path.is_file()and not path.is_symlink()and path.resolve()==path and sha(path.read_bytes())==digest)
 need(DOCKER_CONFIG.is_dir()and not DOCKER_CONFIG.is_symlink()and DOCKER_CONFIG.resolve()==DOCKER_CONFIG)
 config=DOCKER_CONFIG/'config.json';need(config.is_file()and not config.is_symlink()and config.resolve()==config and config.stat().st_size<=65536)
 need(sha(FAILURE.read_bytes())==FAILURE_SHA)
 failure=json.loads(FAILURE.read_text(encoding='utf8'));need(failure['status']=='failed'and failure['completed_steps']==failure['total_steps']==27 and failure['underlying_http_status']==403 and failure['failure_stage']=='registry_push_blob_head')
 return {**PINS,'operator_sha256':sha(Path(__file__).read_bytes()),'failure_receipt_sha256':FAILURE_SHA}
def environment(ambient=os.environ):
 value={k:ambient[k]for k in ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG']if k in ambient}
 value.update({'PATH':str(DOCKER.parent),'NODE_ENV':'production','CI':'1','VERCEL_TELEMETRY_DISABLED':'1','VERCEL_CLI_USE_NATIVE_BINARY':'0','NO_COLOR':'1','DOCKER_CONFIG':str(DOCKER_CONFIG)})
 return value
def cli(arguments):return [str(NODE),str(CLI),*arguments,'--scope','muhammed-abdelrahman','--global-config',GLOBAL]
def run(command,limit=256*1024):
 # No raw diagnostics are printed or persisted; the process deadline is bounded.
 value=subprocess.run(command,cwd=ROOT,env=environment(),stdin=subprocess.DEVNULL,capture_output=True,text=True,encoding='utf8',errors='replace',timeout=45)
 need(len(value.stdout.encode())<=limit and len(value.stderr.encode())<=limit)
 return value
def metadata():
 project=run(cli(['api','/v9/projects/'+PROJECT+'?teamId='+TEAM,'--raw']));need(project.returncode==0);project=json.loads(project.stdout)
 need(project.get('id')==PROJECT and project.get('accountId')==TEAM and project.get('name')=='everyone-presentation-worker-pilot')
 repository=run(cli(['api','/v1/vcr/repository/'+REPO+'?projectId='+PROJECT+'&teamId='+TEAM,'--raw']));need(repository.returncode==0);repository=json.loads(repository.stdout).get('repository')
 need(type(repository)is dict and repository.get('id')==REPO and repository.get('projectId')==PROJECT and repository.get('name')=='native'and repository.get('public')is False)
 return {'project_id':PROJECT,'team_id':TEAM,'repository_id':REPO,'repository_private':True,'cli_control_plane_read_authorized':True,'registry_push_permission_proven':False}
def login_result(value):
 need(value=={'status':'success','engine':'docker','registry':'vcr.vercel.com','username':'oidc','validForHours':12});return value
def registry_read():
 try:
  result=run([str(DOCKER),'manifest','inspect',OLD_IMAGE],1024*1024)
  if result.returncode!=0:return {'result':'unconfirmed','read_succeeded':False,'push_permission_proven':False,'raw_diagnostics_persisted':False}
  value=json.loads(result.stdout);need(value.get('schemaVersion')==2 and value.get('mediaType')in('application/vnd.oci.image.manifest.v1+json','application/vnd.docker.distribution.manifest.v2+json'))
  need(type(value.get('layers'))is list and 1<=len(value['layers'])<=64)
  return {'result':'passed','read_succeeded':True,'push_permission_proven':False,'layer_count':len(value['layers']),'raw_diagnostics_persisted':False}
 except Exception:return {'result':'unconfirmed','read_succeeded':False,'push_permission_proven':False,'raw_diagnostics_persisted':False}
def save(action,value):
 directory=ROOT/'tracking/evidence/m03/english-image34';directory.mkdir(parents=True,exist_ok=True)
 path=directory/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-vcr-'+action+'.json')
 document={'schema_version':'1.0','observed_at':stamp(),'action':action,'project_id':PROJECT,'team_id':TEAM,'credentials_or_raw_diagnostics_persisted':False,'token_extracted_by_operator':False,'secrets_in_arguments':False,'debug_forwarded':False,'new_build_or_push_performed':False,'cli_internal_auth_maintenance_possible':True,'wire_attempt_count_claimed':False,**value}
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(document,sort_keys=True,indent=2)+'\n')
 return path.relative_to(ROOT).as_posix()
def main():
 need(len(sys.argv)==2 and sys.argv[1]in('inspect','refresh','registry-read'));action=sys.argv[1];pins=sources()
 if action=='registry-read':
  result=registry_read();path=save(action,{'source_pins':pins,**result});print(json.dumps({'result':result['result'],'receipt':path}));need(result['result']=='passed');return
 before=metadata()
 if action=='inspect':
  path=save(action,{'result':'passed','source_pins':pins,'metadata':before,'auth_refresh_performed':False,'credential_expiry_determined':False});print(json.dumps({'result':'passed','receipt':path}));return
 need(not CLAIM.exists());PRIVATE.mkdir(parents=True,exist_ok=True);need(PRIVATE.resolve()==PRIVATE and not PRIVATE.is_symlink())
 with CLAIM.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps({'claimed_at':stamp(),'project_id':PROJECT,'team_id':TEAM,'source_pins':pins,'metadata':before,'dispatch_may_have_occurred':True},sort_keys=True)+'\n');stream.flush();os.fsync(stream.fileno())
 need(sources()==pins);returned=False;success=False;safe_result=None
 try:
  result=run(cli(['vcr','login','docker','--project',PROJECT,'--format','json']));returned=True
  need(result.returncode==0);safe_result=login_result(json.loads(result.stdout));success=True
 except Exception:pass
 after=None;read=None
 if success:
  try:after=metadata();need(after==before and sources()==pins);read=registry_read()
  except Exception:success=False
 passed=success and read is not None and read['read_succeeded']is True
 path=save(action,{'result':'passed'if passed else'unconfirmed','source_pins':pins,'before':before,'after':after,'claim_retained':True,'normal_cli_process_return_observed':returned,'scoped_login_success':safe_result,'auth_refresh_performed':success,'registry_read':read,'original_403_cause_proven':False,'credential_expiry_determined':False,'automatic_login_retry':False})
 print(json.dumps({'result':'passed'if passed else'unconfirmed','receipt':path,'claim_retained':True}));need(passed)
if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_VCR_LOGIN_UNCONFIRMED');sys.exit(1)
