"""Root-executed prebuilt worker rollout. Imports are offline and inert.

No historical deployment operator is replayed. Existing public projection and
same-ID metadata validators are reused; credentials stay in the CLI store.
"""
from pathlib import Path
import copy, importlib.util, json, re, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
web=module('english_worker34_frozen_web_tools',ROOT/'development/m03/english-web-release34/web.py')
release=module('english_worker34_database',ROOT/'development/m03/english-release34/release.py')
native=module('english_worker34_native',ROOT/'development/m03/english-release34/native_admission.py')
manifest=module('english_worker34_manifest',ROOT/'development/m03/english-release34/native_manifest.py')
pin=module('english_worker34_pin',ROOT/'development/m03/english-release34/native_pin.py')
PROJECT=native.PROJECT;TEAM=native.TEAM;SLUG='muhammed-abdelrahman';SOURCE=native.SOURCE;RUN=native.RUN
OLD='dpl_CVDMpdETNwZYxdEyJ8XM66kSppdQ';OLD_IMAGE='sha256:971834e0d3f5c2035550a4c0c964c39af8ce6bf243db404c4baf9fb19f529137'
PREFIX='muhammed-abdelrahman/everyone-presentation-worker-pilot/daemon@'
DIRECTORY=ROOT/'.local/worker-hosting'/RUN;FOLDER=DIRECTORY/'deployment'
PRIVATE=ROOT/'.local/m03-english-worker-release34';PLAN=PRIVATE/'plan.json';PREPARE=PRIVATE/'prepare.claim.json';CLAIM=PRIVATE/'deploy.claim.json';RETURNED=PRIVATE/'deploy.returned.json'
EMITTER=ROOT/'tools/worker-hosting-build.mjs';PROJECTION=ROOT/'development/m07/controlled-pilot/daemon-runtime.mjs'
BUILD_POINTER=ROOT/'.local/m03-english-image34-continuation/daemon-build.success.json'
need=web.need;sha=web.sha;load=web.load;exclusive=web.exclusive;reference=web.reference

def evidence(action,value):
 path=ROOT/'tracking/evidence/m03/english-worker-release34'/(web.datetime.datetime.now(web.datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 exclusive(path,{'schema_version':'1.0','observed_at':web.stamp(),'action':action,'project_id':PROJECT,'team_id':TEAM,'run':RUN,'source_sha256':SOURCE,'credentials_or_raw_cli_persisted':False,**value});return path.relative_to(ROOT).as_posix()
def source_pins():
 files=[Path(__file__),HERE/'test_worker.py',HERE/'README.md',Path(web.__file__),EMITTER,PROJECTION]
 return {**manifest.sources(),**{p.relative_to(ROOT).as_posix():sha(load(p))for p in files},'cli':web.tool_pins()}
def daemon_build(document,plan,import_proof):
 need(document.get('result')=='passed'and document.get('kind')=='daemon'and document.get('run')==RUN and document.get('source_sha256')==SOURCE)
 need(document.get('target')=='vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/daemon:english34-auth2-4186fd1e')
 digest=document.get('runtime_digest');need(type(digest)is str and re.fullmatch('sha256:[a-f0-9]{64}',digest)and digest!=OLD_IMAGE)
 need(document.get('remote_digest_independent_readback_equal')is True and document.get('exit_code')==0 and document.get('timed_out')is False and document.get('output_limit_exceeded')is False)
 need(document.get('source',{}).get('file_count')==160 and document['source'].get('source_sha256')==SOURCE and document['source'].get('manifest_sha256')==plan['next']['manifest_sha256'])
 gate=document.get('production_import_gate',{});need(gate.get('user')=='1000:1000'and gate.get('network')=='none'and gate.get('completed')is True and gate.get('cached')is False and gate.get('build_exit_code')==0)
 need(import_proof.get('result')=='ready_image_and_import_gate_observed'and import_proof.get('daemon_runtime_digest')==digest and import_proof.get('source_sha256')==SOURCE and import_proof.get('run')==RUN and import_proof.get('baked_manifest_sha256')==plan['next']['manifest_sha256'])
 return digest
def gates():
 plan=native.plan();pins=manifest.sources();adopted=pin.environment_adopted(plan,pins)
 claim=json.loads(load(pin.CLAIM));need(claim['target']==native.TARGET and claim['source_pins']==pins and claim['plan']==plan)
 before=release.read_state(False);second=release.read_state(False);need(before==second==pin.expected_after(claim['before'],plan['next']['native_image_id']));release.check_before(before)
 pointer=json.loads(load(BUILD_POINTER,4096));need(set(pointer)=={'receipt','sha256'})
 build_ref,build=reference(pointer['receipt']);need(build_ref['sha256']==pointer['sha256'])
 import_ref,import_proof=reference(plan['references']['daemon_import']['path']);need(import_ref==plan['references']['daemon_import'])
 digest=daemon_build(build,plan,import_proof)
 return {'native_plan':plan,'manifest_adoption':adopted,'native_pin_claim_sha256':sha(load(pin.CLAIM)),'build':build_ref,'daemon_import':import_ref,'daemon_image_digest':digest,'canonical_before':before}
def expected_output(digest):
 need(type(digest)is str and re.fullmatch('sha256:[a-f0-9]{64}',digest))
 return {'config':{'version':3,'daemons':{'worker':{}}},'daemon':{'runtime':'container','image':'vcr.vercel.com/'+PREFIX+digest,'instances':{'dub1':1},'resources':{'requests':{'memory':'2Gi'}},'terminationGracePeriodSeconds':300}}
def output_files(digest):
 need(FOLDER.is_dir()and FOLDER.resolve()==FOLDER and not FOLDER.is_symlink());expected=expected_output(digest)
 files={'.vercel/output/config.json':expected['config'],'.vercel/output/daemons/worker/.vc-config.json':expected['daemon'],'.vercel/project.json':{'projectId':PROJECT,'orgId':TEAM,'projectName':'everyone-presentation-worker-pilot'}}
 actual=[]
 for path in FOLDER.rglob('*'):
  need(not path.is_symlink()and path.resolve().is_relative_to(FOLDER))
  if path.is_file():actual.append(path.relative_to(FOLDER).as_posix())
 need(sorted(actual)==sorted(files));rows=[]
 for relative,value in files.items():
  raw=load(FOLDER/relative);need(json.loads(raw)==value);rows.append({'path':relative,'bytes':len(raw),'sha256':sha(raw)})
 return sorted(rows,key=lambda r:r['path'])
def api(endpoint):
 need(re.fullmatch(r'/v(?:9/projects|13/deployments)/[A-Za-z0-9_.-]+\?teamId='+TEAM,endpoint))
 return json.loads(web.command([str(web.NODE),str(web.CLI),'api',endpoint,'--scope',SLUG,'--method','GET','--raw','--global-config',web.GLOBAL],True,30))
def project():
 row=api('/v9/projects/'+PROJECT+'?teamId='+TEAM)
 need(row.get('id')==PROJECT and row.get('accountId')==TEAM and row.get('name')=='everyone-presentation-worker-pilot'and row.get('rootDirectory')is None and row.get('nodeVersion')=='24.x'and row.get('oidcTokenConfig',{}).get('enabled')is True)
def deployment(row,digest):
 need(type(row)is dict and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',row.get('id',''))and row['id']!=OLD and row.get('name')=='everyone-presentation-worker-pilot'and row.get('project',{}).get('id')==PROJECT and row.get('team',{}).get('id')==TEAM and row.get('readyState')=='READY')
 need(row.get('meta',{}).get('epsEnglishWorker34')==SOURCE and row['meta'].get('epsDaemonImage34')==digest)
 return {'id':row['id'],'state':'READY','source_sha256':SOURCE,'daemon_image_digest':digest,'project_id':PROJECT,'team_id':TEAM}
def deployment_url(raw):
 urls=set(re.findall(r'https://everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app(?=[\s"\x1b]|$)',raw));need(len(urls)==1);return next(iter(urls))
def daemon(deployment_id):
 raw=web.command([str(web.NODE),str(web.CLI),'daemons','inspect','worker','--project',PROJECT,'--scope',SLUG,'--global-config',web.GLOBAL,'--json'],True,30)
 program="import fs from'node:fs';const{projectDaemon}=await import("+json.dumps(PROJECTION.as_uri())+");const value=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(projectDaemon(value,"+json.dumps(deployment_id)+")));"
 result=web.subprocess.run([str(web.NODE),'--input-type=module','-e',program],cwd=ROOT,env=web.environment(True),input=raw.encode(),capture_output=True,timeout=15)
 need(result.returncode==0 and len(result.stdout)<=32768 and len(result.stderr)<=4096);return json.loads(result.stdout)
def healthy_daemon(row,deployment_id,digest):
 need(row.get('deployment_id')==deployment_id and row.get('project_id')==PROJECT and row.get('team_id')==TEAM and row.get('environment')=='production'and row.get('daemon')=='worker'and row.get('status')=='ready')
 need(row.get('configured_instances')=={'dub1':1}and row.get('configured_override')is None and row.get('memory_mib')==2048 and row.get('termination_grace_seconds')==300 and row.get('desired')==row.get('ready')==row.get('total')==1)
 need(row.get('requested_image',{}).get('digest')==digest and row.get('resolved_image',{}).get('digest')==digest and type(row.get('instances'))is list and len(row['instances'])==1)
 item=row['instances'][0];need(item.get('alive')is True and item.get('region')=='dub1'and item.get('memory_mib')==2048 and item.get('image',{}).get('digest')==digest and item.get('stopped_at_ms')is None)
 value=copy.deepcopy(row);value.pop('updated_at_ms',None)
 for instance in value['instances']:instance.pop('last_checked_at_ms',None)
 return value
def plan():
 row=json.loads(load(PLAN));need(row['source_pins']==source_pins()and row['gates']==gates()and row['files']==output_files(row['gates']['daemon_image_digest']));return row
def main():
 need(len(sys.argv)==2 and sys.argv[1]in ['prepare','inspect','deploy','readback']);action=sys.argv[1]
 if action=='prepare':
  need(not PLAN.exists()and not PREPARE.exists()and not FOLDER.exists());pins=source_pins();proof=gates();project();old=healthy_daemon(daemon(OLD),OLD,OLD_IMAGE)
  exclusive(PREPARE,{'source_pins':pins,'gates':proof,'prepared_at':web.stamp(),'local_emit_may_have_occurred':True,'deployment_performed':False})
  image=PREFIX+proof['daemon_image_digest'];result=json.loads(web.command([str(web.NODE),str(EMITTER),'emit',RUN,image],True,30));need(result.get('source_sha256')==SOURCE and result.get('output')==FOLDER.relative_to(ROOT).as_posix()+'/.vercel/output')
  exclusive(FOLDER/'.vercel/project.json',{'projectId':PROJECT,'orgId':TEAM,'projectName':'everyone-presentation-worker-pilot'})
  files=output_files(proof['daemon_image_digest']);need(source_pins()==pins and gates()==proof)
  value={'source_pins':pins,'gates':proof,'files':files,'prior_daemon':old,'prepared_at':web.stamp()};exclusive(PLAN,value)
  print(json.dumps({'result':'prepared','receipt':evidence('prepare',{'result':'prepared','plan':value,'deployment_performed':False,'environment_transferred':False})}));return
 value=plan();project();digest=value['gates']['daemon_image_digest']
 if action=='inspect':
  old=healthy_daemon(daemon(OLD),OLD,OLD_IMAGE);need(old==value['prior_daemon']);print(json.dumps({'result':'passed','receipt':evidence('inspect',{'result':'passed','plan':value,'prior_daemon':old,'read_only':True})}));return
 if action=='deploy':
  need(not CLAIM.exists()and not RETURNED.exists());need(healthy_daemon(daemon(OLD),OLD,OLD_IMAGE)==value['prior_daemon'])
  exclusive(CLAIM,{'project_id':PROJECT,'team_id':TEAM,'plan':value,'claimed_at':web.stamp(),'dispatch_may_have_occurred':True,'automatic_retry':False})
  need(plan()==value)
  raw=web.command([str(web.NODE),str(web.CLI),'deploy',str(FOLDER),'--prebuilt','--prod','--yes','--no-wait','--scope',SLUG,'--project',PROJECT,'--meta','epsEnglishWorker34='+SOURCE,'--meta','epsDaemonImage34='+digest,'--global-config',web.GLOBAL],True,60)
  url=deployment_url(raw);exclusive(RETURNED,{'claim_sha256':sha(load(CLAIM)),'url':url,'process_returned':True});print(json.dumps({'result':'submitted','url':url,'ready_verified':False,'claim_retained':True}));return
 claim=json.loads(load(CLAIM));returned=json.loads(load(RETURNED));need(claim['plan']==value and returned['claim_sha256']==sha(load(CLAIM))and returned['process_returned']is True);url=returned['url'];need(deployment_url(url)==url)
 ready=deployment(api('/v13/deployments/'+url.removeprefix('https://')+'?teamId='+TEAM),digest)
 first=healthy_daemon(daemon(ready['id']),ready['id'],digest);second=healthy_daemon(daemon(ready['id']),ready['id'],digest);need(first==second and plan()==value)
 print(json.dumps({'result':'passed','receipt':evidence('ready',{'result':'passed','plan':value,'deployment':ready,'daemon':second,'one_ready_alive_instance':True,'memory_mib':2048,'region':'dub1','canonical33_english_disabled':True,'canonical_state_preserved':True,'read_only':True,'environment_transferred':False,'startup_logs_verified':False,'job_processing_verified':False,'claim_retained':True,'automatic_retry':False})}))

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH_WORKER_RELEASE_UNCONFIRMED');sys.exit(1)
