"""Root-executed compatible web rollout; imports are offline and inert.

Uses only the established logged-in Vercel CLI store. No token extraction,
environment transfer, Git mutation, or automatic deployment replay.
"""
from pathlib import Path
import datetime, hashlib, importlib.util, json, os, re, subprocess, sys, time

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
PRIVATE=ROOT/'.local/m03-english-web-release34';PLAN=PRIVATE/'plan.json';CLAIM=PRIVATE/'deploy.claim.json';RETURNED=PRIVATE/'deploy.returned.json'
PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1';SLUG='muhammed-abdelrahman'
ALIAS='everyone-presentation-pilot.vercel.app';OLD='dpl_CcwVabZ5PkadAPaeANRLJD4GqVg3'
NODE=Path('C:/Program Files/nodejs/node.exe');CLI=ROOT/'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js'
GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli'
STAGE=ROOT/'development/m07/controlled-pilot/stage-web.mjs'
SOURCE_RECEIPT='tracking/evidence/m07/controlled-pilot/2026-10-31T16-50-08-878Z-36c50faa-web-source.json'
REQUIRED={'apps/web/components/english-transcript.tsx','apps/web/components/SourceTranscript.tsx','packages/domain/src/english-transcript.ts','packages/central/src/presentation-transcript.ts','apps/web/lib/generated-contracts.json'}
CLI_PINS={'vc.js':'5724f20cc65bb0e13c7a0668af107770ddb101bb72dd3fd6160aca672ea2a493','commands/deploy/index.js':'87147e9eda4f3f43f156a93b54b157ac356f7108a196027692120efb71c40ee2','chunks/chunk-YIOT5B5Z.js':'36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661','chunks/chunk-QZEZCUUZ.js':'d81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a'}

def need(value):
 if not value:raise ValueError('ENGLISH_WEB_RELEASE_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def load(path,limit=8*1024*1024):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_size<=limit);return path.read_bytes()
def exclusive(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);need(path.parent.resolve()==path.parent and not path.parent.is_symlink())
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n');stream.flush();os.fsync(stream.fileno())
def evidence(action,value):
 path=ROOT/'tracking/evidence/m03/english-web-release34'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 exclusive(path,{'schema_version':'1.0','observed_at':stamp(),'action':action,'project_id':PROJECT,'team_id':TEAM,'origin':'https://'+ALIAS,'credentials_or_raw_cli_persisted':False,**value});return path.relative_to(ROOT).as_posix()
def reference(relative):
 need(type(relative)is str and relative.startswith('tracking/evidence/')and '..'not in relative and '\\'not in relative)
 path=ROOT/relative;need(path.resolve().is_relative_to(ROOT/'tracking/evidence'));raw=load(path)
 return {'path':relative,'sha256':sha(raw)},json.loads(raw)
def environment(provider=False):
 if provider:
  result={k:os.environ[k]for k in ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG']if k in os.environ}
  result.update({'PATH':'','NODE_ENV':'production','CI':'1','VERCEL_TELEMETRY_DISABLED':'1','VERCEL_CLI_USE_NATIVE_BINARY':'0'});return result
 return {k:v for k,v in os.environ.items()if k.upper()not in {'DEBUG','NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','VERCEL_TOKEN'}}
def command(args,provider=False,timeout=60,cwd=ROOT):
 result=subprocess.run(args,cwd=cwd,env=environment(provider),capture_output=True,timeout=timeout,stdin=subprocess.DEVNULL)
 need(result.returncode==0 and len(result.stdout)<=8*1024*1024 and len(result.stderr)<=2*1024*1024);return result.stdout.decode('utf8')
def source_rows():
 paths=command(['git','ls-files','-z','--','apps/web','packages','contracts/json-schema','contracts/mcp-tool-catalog.json','package.json','package-lock.json','tsconfig.json','CONTRACT_BASELINE.md','tools/start-web.mjs']).split('\0')
 selected=sorted({p for p in paths if p and not re.search(r'(?:^|/)(?:test|tests|__tests__)(?:/|$)',p)}|{'apps/web/lib/hosting-pilot.ts','tools/start-pilot-web.mjs','apps/worker/package.json','apps/web/components/english-transcript.tsx'})
 need(100<len(selected)<1000 and REQUIRED.issubset(selected))
 rows=[]
 for relative in selected:
  need(not re.search(r'(?:^|/)(?:\.env[^/]*|\.local|\.git|Screenshots|redesign-output|node_modules|\.next[^/]*)(?:/|$)',relative))
  raw=load(ROOT/relative);rows.append({'path':relative,'bytes':len(raw),'sha256':sha(raw)})
 return rows
def tool_pins():
 need(sha(load(NODE,128*1024*1024))=='9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de')
 need(json.loads(load(CLI.parent.parent/'package.json'))['version']=='65.8.0')
 for relative,digest in CLI_PINS.items():need(sha(load(CLI.parent/relative))==digest)
 return {str(relative):digest for relative,digest in CLI_PINS.items()}
def release():
 spec=importlib.util.spec_from_file_location('english_web_release34_database',ROOT/'development/m03/english-release34/release.py');value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def helpers():
 return {p.relative_to(ROOT).as_posix():sha(load(p))for p in [Path(__file__),HERE/'test_web.py',STAGE,ROOT/'development/m03/english-release34/release.py']}
def validate_stage(report,build):
 need(report.get('result')=='passed'and report.get('project_id')==PROJECT and report.get('team_id')==TEAM and report.get('origin')=='https://'+ALIAS and report.get('deployed')is False)
 need(report.get('source_stable')is True and report.get('private_input_stable')is True and report.get('private_hits')==0)
 need(build.get('result')=='passed'and build.get('action')=='build'and build.get('files')==report.get('files')==source_rows())
 need(build.get('source_sha256')==sha(json.dumps(build['files'],sort_keys=True,separators=(',',':')).encode()))
 need(report.get('harness_sha256')==sha(load(STAGE)))
 relative=report.get('source_root');need(type(relative)is str and re.fullmatch(r'\.local/m07-pilot/web-source-[A-Za-z0-9TZ.-]+-[a-f0-9]{8}',relative))
 folder=ROOT/relative;need(folder.is_dir()and folder.resolve()==folder and not folder.is_symlink())
 for row in report['files']:need(sha(load(folder/row['path']))==row['sha256'])
 need(json.loads(load(folder/'.vercel/project.json'))=={'projectId':PROJECT,'orgId':TEAM,'projectName':'everyone-presentation-pilot'})
 actual=sorted(p.relative_to(folder).as_posix()for p in folder.rglob('*')if p.is_file())
 need(actual==sorted([row['path']for row in report['files']]+['.vercel/project.json']))
 return folder
def plan():
 value=json.loads(load(PLAN));need(value['project_id']==PROJECT and value['team_id']==TEAM and value['helpers']==helpers()and value['cli_pins']==tool_pins())
 source_ref,source=reference(value['source']['path']);build_ref,build=reference(value['build']['path']);need(source_ref==value['source']and build_ref==value['build']);return value,validate_stage(source,build)
def api(endpoint):
 need(re.fullmatch(r'/v(?:9/projects|13/deployments)/[A-Za-z0-9_.-]+\?teamId='+TEAM,endpoint))
 raw=command([str(NODE),str(CLI),'api',endpoint,'--scope',SLUG,'--method','GET','--raw','--global-config',GLOBAL],True,30);return json.loads(raw)
def project():
 value=api('/v9/projects/'+PROJECT+'?teamId='+TEAM)
 need(value.get('id')==PROJECT and value.get('accountId')==TEAM and value.get('name')=='everyone-presentation-pilot'and value.get('rootDirectory')=='apps/web'and value.get('nodeVersion')=='24.x'and value.get('framework')=='nextjs')
 return {'id':PROJECT,'team_id':TEAM,'root_directory':'apps/web','node_version':'24.x','framework':'nextjs'}
def deployment(value):
 need(type(value)is dict and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',value.get('id',''))and value.get('name')=='everyone-presentation-pilot'and value.get('project',{}).get('id')==PROJECT and value.get('team',{}).get('id')==TEAM)
 need(value.get('readyState')in ['READY','BUILDING','INITIALIZING','QUEUED','ERROR','CANCELED','BLOCKED']and re.fullmatch(r'everyone-presentation-pilot(?:-[a-z0-9-]+)?\.vercel\.app',value.get('url','')))
 source=value.get('meta',{}).get('epsEnglishWeb34');need(source is None or type(source)is str and re.fullmatch('[a-f0-9]{64}',source))
 return {'id':value['id'],'state':value['readyState'],'url':value['url'],'project_id':PROJECT,'team_id':TEAM,'source_sha256':source}
def ready_pair(direct,alias):
 need(direct==alias and direct['state']=='READY'and direct['id']!=OLD);return direct
def deployment_url(raw):
 urls=set(re.findall(r'https://everyone-presentation-pilot-[a-z0-9-]+\.vercel\.app(?=[\s"\x1b]|$)',raw));need(len(urls)==1);return next(iter(urls))
def main():
 need(len(sys.argv)>=2);action=sys.argv[1]
 if action=='build':
  need(len(sys.argv)==2);before=source_rows();started=time.monotonic();command(['npm.cmd','run','build'],timeout=180);need(source_rows()==before)
  path=evidence('build',{'result':'passed','environment':'local production build','debug_forwarded':False,'exit_code':0,'elapsed_seconds':round(time.monotonic()-started,3),'files':before,'source_sha256':sha(json.dumps(before,sort_keys=True,separators=(',',':')).encode()),'provider_actions':False,'harness_sha256':sha(load(Path(__file__)))})
  print(json.dumps({'result':'passed','receipt':path}));return
 if action=='prepare':
  need(len(sys.argv)==3 and not PLAN.exists());build_ref,build=reference(sys.argv[2]);need(build.get('files')==source_rows())
  source_ref,source=reference(SOURCE_RECEIPT);validate_stage(source,build)
  value={'project_id':PROJECT,'team_id':TEAM,'source':source_ref,'build':build_ref,'helpers':helpers(),'cli_pins':tool_pins(),'prepared_at':stamp()};exclusive(PLAN,value)
  print(json.dumps({'result':'prepared','source_receipt':source_ref['path'],'source_root':source['source_root'],'deployment_performed':False}));return
 need(action in ['inspect','deploy','readback']and len(sys.argv)==2);value,folder=plan();project()
 if action=='inspect':
  current=deployment(api('/v13/deployments/'+ALIAS+'?teamId='+TEAM));need(current['id']==OLD and current['state']=='READY')
  db=release();state=db.read_state(False);db.check_before(state);print(json.dumps({'result':'passed','receipt':evidence('inspect',{'result':'passed','plan':value,'current':current,'canonical33_english_disabled':True,'deployment_performed':False})}));return
 if action=='deploy':
  need(not CLAIM.exists()and not RETURNED.exists());current=deployment(api('/v13/deployments/'+ALIAS+'?teamId='+TEAM));need(current['id']==OLD and current['state']=='READY')
  db=release();before=db.read_state(False);db.check_before(before)
  exclusive(CLAIM,{'project_id':PROJECT,'team_id':TEAM,'plan':value,'canonical_before':before,'claimed_at':stamp(),'dispatch_may_have_occurred':True,'automatic_retry':False})
  need(plan()==(value,folder)and db.read_state(False)==before)
  # Exactly one helper dispatch. CLI/provider internal retries are not characterized.
  _,build=reference(value['build']['path'])
  raw=command([str(NODE),str(CLI),'deploy',str(folder),'--prod','--yes','--no-wait','--scope',SLUG,'--project',PROJECT,'--meta','epsEnglishWeb34='+build['source_sha256'],'--global-config',GLOBAL],True,60)
  url=deployment_url(raw);exclusive(RETURNED,{'claim_sha256':sha(load(CLAIM)),'url':url,'process_returned':True})
  print(json.dumps({'result':'submitted','url':url,'claim_retained':True,'ready_verified':False,'automatic_retry':False}));return
 claim=json.loads(load(CLAIM));returned=json.loads(load(RETURNED));need(claim['plan']==value and returned['claim_sha256']==sha(load(CLAIM))and returned['process_returned']is True)
 url=returned['url'];need(deployment_url(url)==url)
 direct=deployment(api('/v13/deployments/'+url.removeprefix('https://')+'?teamId='+TEAM));alias=deployment(api('/v13/deployments/'+ALIAS+'?teamId='+TEAM));ready=ready_pair(direct,alias)
 _,build=reference(value['build']['path']);need(ready['source_sha256']==build['source_sha256'])
 db=release();first=db.read_state(False);second=db.read_state(False);need(first==second==claim['canonical_before']and plan()==(value,folder))
 print(json.dumps({'result':'passed','receipt':evidence('ready',{'result':'passed','plan':value,'deployment':ready,'stable_alias':ALIAS,'stable_alias_matches':True,'canonical33_english_disabled':True,'canonical_state_preserved':True,'read_only':True,'application_acceptance':False,'claim_retained':True,'automatic_retry':False})}))

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH_WEB_RELEASE_UNCONFIRMED');sys.exit(1)
