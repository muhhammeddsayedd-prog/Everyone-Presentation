"""Offline source and actual native-proof binding for the English worker graph."""
from pathlib import Path
import hashlib, json, os, re, subprocess, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
TARGET='pyibofyctwnqpvktepse';PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1'
RUN='4186fd1e-55c7-4ea5-956e-ad9ad92f64b1'
SOURCE='b3489d64fb1bb207e0a1020fadac3db14490c94ba6d2aedf9c6a358ebb36f181'
OLD_IMAGE='sha256:77eee0ee51159c6420fffefcdce39406a47350ddae682f4ec86891fe7ec08ed8'
OLD_MANIFEST='083f81c7320c0c509d5d7775e9f810e29ef0bdbde9f731c281328c5c34c07173'
PLAN=ROOT/'.local/m03-english-release34/native-admission.json'
FILE_COUNT=160
NATIVE_ADMIT=ROOT/'development/m03/native-probe34/admit-native-probe34.mjs'
NATIVE_ADMIT_SHA='cf2e9b9cc481a09a0364865993f8f0c6662be418b428991ca75e7c67375f84d5'
NATIVE_RELEASE=ROOT/'development/m03/native-probe34/native-probe34-release.mjs'
NATIVE_RELEASE_SHA='9930e6d34ea9f8ff82ae5d2f992cda4dc63787406c180d7ae98e8a4b35ac65f8'

def need(value):
 if not value:raise ValueError('ENGLISH34_NATIVE_ADMISSION_UNCONFIRMED')
def sha(value):return hashlib.sha256(value).hexdigest()
def load(path,limit=2*1024*1024):
 need(path.is_file()and not path.is_symlink()and path.resolve()==path and path.stat().st_size<=limit)
 return path.read_bytes()
def reference(relative):
 need(type(relative)is str and relative.startswith('tracking/evidence/')and '..'not in relative and '\\'not in relative)
 path=ROOT/relative;raw=load(path);return {'path':relative,'sha256':sha(raw)},json.loads(raw)
def source():
 context=ROOT/'.local/worker-hosting'/RUN/'context';need(context.resolve()==context and not context.is_symlink())
 owner=json.loads(load(context.parent/'owner.json',4096));need(owner=={'owner':'eps-worker-hosting-build','run':RUN,'source_sha256':SOURCE})
 seal=json.loads(load(context/'apps/worker/native-source.json'));need(set(seal)=={'source_sha256','files'}and seal['source_sha256']==SOURCE)
 files=seal['files'];need(type(files)is list and len(files)==FILE_COUNT and sha(json.dumps(files,separators=(',',':'),ensure_ascii=False).encode())==SOURCE)
 pattern=r'(?:package(?:-lock)?\.json|apps/(?:web|worker)/package\.json|apps/worker/Dockerfile\.(?:daemon|native-sandbox)|packages/(?:domain|jobs|integrations|central)/package\.json|(?:apps/worker/src|packages/(?:domain|jobs|integrations|central)/src|packages/templates/(?:src|versions))/[A-Za-z0-9_./-]+\.(?:ts|mjs|json)|contracts/json-schema/(?:specs-extraction|candidate-extraction|frame-selection|slide-wording)\.schema\.json|packages/templates/registry\.json|apps/web/public/fonts/IBMPlexSans(?:Arabic)?-(?:Regular\.woff2|Medium\.woff2|SemiBold\.woff2|LICENSE\.txt)|apps/web/public/brand/everyone-logotype(?:-white)?\.svg)'
 previous=''
 for row in files:
  need(type(row)is dict and set(row)=={'path','sha256','bytes'})
  relative=row['path'];need(type(relative)is str and re.fullmatch(pattern,relative)and '..'not in relative and relative>previous and type(row['bytes'])is int and 0<row['bytes']<=16*1024*1024 and re.fullmatch('[a-f0-9]{64}',row['sha256']))
  raw=load(context/relative,16*1024*1024);need(len(raw)==row['bytes']and sha(raw)==row['sha256']);previous=relative
 need({'apps/worker/src/candidate-english.ts','packages/integrations/src/openai-transcript-english.ts','packages/domain/src/english-transcript.ts'}.issubset({r['path']for r in files}))
 raw=load(context/'apps/worker/native-sandbox-manifest.json',4096);manifest=json.loads(raw)
 need(set(manifest)=={'schema_version','transport','protocol','image','region','source_sha256'}and manifest['schema_version']=='1.0'and manifest['transport']=='vercel_sandbox'and manifest['protocol']=='eps-native-files-v1'and manifest['region']=='dub1'and manifest['source_sha256']==SOURCE)
 prefix='muhammed-abdelrahman/everyone-presentation-worker-pilot/native@';need(type(manifest['image'])is str and manifest['image'].startswith(prefix))
 image=manifest['image'][len(prefix):];need(re.fullmatch('sha256:[a-f0-9]{64}',image)and image!=OLD_IMAGE)
 return {'run':RUN,'context':context.relative_to(ROOT).as_posix(),'source_sha256':SOURCE,'file_count':FILE_COUNT,'native_image_id':image,'manifest_sha256':sha(raw)}

def validate_proofs(next_value,ready,daemon,smoke):
 need(ready.get('read_only')is True and ready.get('provider_mutations')is False and ready.get('team_id')==TEAM)
 need(ready.get('repository',{}).get('project_id')==PROJECT and ready['repository'].get('public')is False)
 need(any(row.get('manifest_digest')==next_value['native_image_id']and row.get('status')=='ready'and row.get('architecture')=='amd64'and row.get('platform')=='linux'for row in ready.get('images',{}).get('images',[])))
 need(daemon.get('result')=='ready_image_and_import_gate_observed'and daemon.get('run')==RUN and daemon.get('source_sha256')==SOURCE and daemon.get('native_runtime_digest')==next_value['native_image_id']and daemon.get('baked_manifest_sha256')==next_value['manifest_sha256'])
 need(daemon.get('registry_repository_private')is True and daemon.get('daemon_status')=='ready'and daemon.get('architecture')=='amd64'and re.fullmatch('sha256:[a-f0-9]{64}',daemon.get('daemon_runtime_digest','')))
 gate=daemon.get('production_import_gate',{});need(gate.get('user')=='1000:1000'and gate.get('network')=='none'and gate.get('completed')is True and gate.get('build_exit_code')==0)
 need(smoke.get('result')=='passed'and smoke.get('project_id')==PROJECT and smoke.get('team_id')==TEAM and smoke.get('source_sha256')==SOURCE and smoke.get('image')=='muhammed-abdelrahman/everyone-presentation-worker-pilot/native@'+next_value['native_image_id'])
 for key in ['cleanup_confirmed','initial_current_cleanup_sessions_equal','lock_released']:need(smoke.get(key)is True)
 for key in ['private_media_used','worker_polling','db_jobs_or_openai_n8n_calls','token_persisted']:need(smoke.get(key)is False)
 probe=smoke.get('probe_release',{});need(probe.get('source_sha256')==SOURCE and probe.get('context_relative')==next_value['context']and probe.get('file_count')==FILE_COUNT and probe.get('native_uid')==65432)
 phases=smoke.get('phases');expected=['image_source_seal','boundary','image_control_user','network_denial','smoke_document','smoke_document','smoke_pdf_raster','smoke_video','smoke_review_fit','smoke_presentation_render','smoke_presentation_validate','smoke_presentation_export_render','smoke_presentation_export_validate']
 need(type(phases)is list and [p.get('phase')for p in phases]==expected and all(p.get('result')=='passed'for p in phases))
 resources=smoke.get('resources');need(type(resources)is list and len(resources)==10)
 need(all(type(row)is dict and all(row.get(key)is True for key in ['identity_observed','initial_current_cleanup_session_equal','absence_verified','snapshot_absence_verified'])and row.get('session_consistency_failed')is False for row in resources))
 # Reuse the independently reviewed substantive proof validator. This is local
 # JSON validation only: the imported module has no I/O or provider capability.
 need(sha(load(NATIVE_ADMIT))==NATIVE_ADMIT_SHA and sha(load(NATIVE_RELEASE))==NATIVE_RELEASE_SHA)
 node=Path('C:/Program Files/nodejs/node.exe');need(sha(load(node,128*1024*1024))=='9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de')
 program="import fs from'node:fs';const{admitNativeProbe34}=await import("+json.dumps(NATIVE_ADMIT.as_uri())+");const input=JSON.parse(fs.readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(admitNativeProbe34(input.receipt,input.image)));"
 environment={k:os.environ[k]for k in ['SystemRoot','WINDIR','TEMP','TMP']if k in os.environ};environment.update({'PATH':'','NODE_ENV':'production'})
 result=subprocess.run([str(node),'--input-type=module','-e',program],cwd=ROOT,env=environment,input=json.dumps({'receipt':smoke,'image':smoke['image']}),capture_output=True,text=True,encoding='utf8',errors='replace',timeout=15)
 need(result.returncode==0 and len(result.stdout.encode())<=4096 and len(result.stderr.encode())<=4096)
 validated=json.loads(result.stdout);need(validated.get('result')=='passed'and validated.get('source_sha256')==SOURCE and validated.get('image')==smoke['image']and validated.get('native_tasks_passed')==9)

def plan():
 value=json.loads(load(PLAN));need(set(value)=={'target','current','next','references'}and value['target']==TARGET and value['current']=={'native_image_id':OLD_IMAGE,'manifest_sha256':OLD_MANIFEST})
 next_value=source();need(value['next']==next_value and type(value['references'])is dict and set(value['references'])=={'native_ready','daemon_import','native_smoke'})
 documents={}
 for key,row in value['references'].items():
  expected,document=reference(row['path']);need(row==expected);documents[key]=document
 validate_proofs(next_value,documents['native_ready'],documents['daemon_import'],documents['native_smoke'])
 return value
def prepare(paths):
 need(len(paths)==3 and not PLAN.exists());next_value=source();refs={};docs={}
 for key,path in zip(['native_ready','daemon_import','native_smoke'],paths):refs[key],docs[key]=reference(path)
 validate_proofs(next_value,docs['native_ready'],docs['daemon_import'],docs['native_smoke'])
 value={'target':TARGET,'current':{'native_image_id':OLD_IMAGE,'manifest_sha256':OLD_MANIFEST},'next':next_value,'references':refs}
 PLAN.parent.mkdir(parents=True,exist_ok=True)
 with PLAN.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(value,sort_keys=True,indent=2)+'\n')
 return value
if __name__=='__main__':
 try:
  need(len(sys.argv)==4);prepare(sys.argv[1:]);print(json.dumps({'result':'prepared','plan':PLAN.relative_to(ROOT).as_posix(),'provider_actions':False}))
 except Exception:print('ENGLISH34_NATIVE_ADMISSION_UNCONFIRMED');sys.exit(1)
