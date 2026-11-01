"""Disabled source-only web forward purpose; old operator mains are never run."""
from pathlib import Path
import copy, datetime, hashlib, importlib.util, json, os, re, subprocess, sys, threading, uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];DEPLOY_ENABLED=True
CHECKPOINT='0f9ecc066fce6a8a358c17fdc9a8c60535726b7b'
CURRENT='dpl_CUXVUZkWjkrQPBTv7XqmA9tF3y4o';WORKER='dpl_2uASsbYobSDwWjMptPjGLcVEdCg3'
SOURCE='c69b59c8d2ecff87e951340e3306c0bebd89dce98b8cf7dedce88d931693248f';MANIFEST_SHA='f30b3503ee719c3ebb2333fb3086c477807b24715aff19fbfafe138737aaaa09'
BASE='development/m07/workspace-summary35-web/web.py';BASE_SHA='b306de33cbfe1a2d43426d0d9ec8e397618e847d94cd19692a3f6caff3e0a483'
STAGER='development/m07/controlled-pilot/stage-web.mjs';STAGE_SHA='2aaf2e6885cd77b7ee6bc77c20fe28d39fc2bb14bd75307e54eb930abc45ecd4'
TARGET='pyibofyctwnqpvktepse';VERSION='20261101110939';MIGRATION_SHA='47af16421613320b76abc6e7119da92912859f0334b03b047a98492f75f6ea2d'
DB_HELPER='development/m07/job-batch-filter38-release/release.py'
PRIVATE=ROOT/'.local/m07-list-query38-web';INPUTS=PRIVATE/'inputs.json';PLAN=PRIVATE/'plan.json';PREPARE=PRIVATE/'prepare.claim.json';BUILD_CLAIM=PRIVATE/'build.claim.json';BUILD=PRIVATE/'build.json';CLAIM=PRIVATE/'deploy.claim.json';RETURNED=PRIVATE/'deploy.returned.json'
ANCHORS={
 'ready':{'path':'tracking/evidence/m07/job-batch-filter38-web/2026-11-01T17-37-06-827794Z-ready.json','sha256':'0d0ac9aa261b6f4b041fbdf1a9d4a2abf20d5e96c6406b9b5f32caf516808fb8'},
 'source':{'path':'tracking/evidence/m07/controlled-pilot/2026-11-01T17-30-53-679Z-a0438b92-web-source.json','sha256':'f762b18852f60c93353660473b5fd4ef1c10b998e341caa03337491306a02f89'},
 'apply':{'path':'tracking/evidence/m07/job-batch-filter38-release/2026-11-01T17-28-00-388406Z-apply.json','sha256':'6c29313263ab6e1ed62b653b376a5bec6b789deaf03e21ca48c48f7e7d14f94d'},
 'readback':{'path':'tracking/evidence/m07/job-batch-filter38-release/2026-11-01T17-28-42-546410Z-readback.json','sha256':'1950fd161e98e4fdb37fe039a753230b73764c8a6721f1ce6f03f55896371a53'}}
CHANGED={'apps/web/app/api/v1/[...segments]/route.ts':'b50d3be58dcb8ac3ad12dacd99939e274ff5f4cd5481e19c26802e93c34cd07e','packages/integrations/src/openai-specs.ts':'cd80d8a09ea8f5df20f2ed2fe72dc2777849dd5efd1e2f54b9b9f79a1b5ed95a'}
QUALITY_REF={'path':'tracking/evidence/m07/list-query38-web/2026-11-01T18-57-12Z-quality.json','sha256':'351aac7566591a52077b1eadc60fbfee183edde9915e71a540c295d5a7783eb4'}

def need(v):
 if not v:raise ValueError('LIST_QUERY38_WEB_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
def digest(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def load(path,limit=8*1024**2):
 need(path.is_file()and not path.is_symlink()and not path.is_junction()and path.resolve()==path and path.stat().st_nlink==1 and path.stat().st_size<=limit);return path.read_bytes()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
need(sha(load(ROOT/BASE))==BASE_SHA);base=module('list_query38_pure_base35',ROOT/BASE);old=base.old
PROJECT=old.PROJECT;TEAM=old.TEAM;SLUG=old.SLUG;ALIAS=old.ALIAS

def reference(ref):
 need(type(ref)is dict and set(ref)=={'path','sha256'}and type(ref['path'])is str and ref['path'].startswith('tracking/evidence/')and re.fullmatch('[A-Za-z0-9_./-]+\\.json',ref['path'])and not any(p in('','.','..')for p in ref['path'].split('/'))and re.fullmatch('[a-f0-9]{64}',ref['sha256']))
 raw=load(ROOT/ref['path']);need(sha(raw)==ref['sha256']);return json.loads(raw)

def manifest(current=True):
 raw=load(HERE/'source.manifest.json');need(sha(raw)==MANIFEST_SHA);v=json.loads(raw);rows=v['files'];base.validate_rows(rows)
 before=reference(ANCHORS['source']);ready=reference(ANCHORS['ready']);baseline={r['path']:r for r in before['files']};after={r['path']:r for r in rows}
 need(v['checkpoint']==CHECKPOINT and v['source_sha256']==digest(rows)==SOURCE and v['file_count']==len(rows)==285 and v['source_bytes']==sum(r['bytes']for r in rows)==3068962
  and rows==sorted(rows,key=lambda r:r['path'])and set(baseline)==set(after)and v['added']==v['removed']==[]
  and v['baseline_source_sha256']==digest(before['files'])==ready['deployment']['source_sha256']=='4edc5f1a3db2db62cb01d2f804589ae948c46cccb93fbf169f85b0090ccdc0b8'
  and ready['deployment']['id']==CURRENT and ready['stable_alias_matches']is True)
 changed=[{'path':p,'before':baseline[p],'after':after[p]}for p in sorted(after)if baseline[p]!=after[p]]
 need(changed==v['changed']and {r['path']:r['after']['sha256']for r in changed}==CHANGED)
 if current:
  for row in rows:raw=load(ROOT/row['path']);need(len(raw)==row['bytes']and sha(raw)==row['sha256'])
 return v

def static_contract():
 apply=reference(ANCHORS['apply']);readback=reference(ANCHORS['readback'])
 need(apply['result']=='passed'and apply['action']=='apply'and apply['target']==readback['target']==TARGET and apply['version']==readback['version']==VERSION and apply['migration_sha256']==readback['migration_sha256']==MIGRATION_SHA
  and apply['normal_return_marker_observed']is True and apply['independent_readback_verified']is True and apply['claim_retained']is True and apply['first']==apply['second']
  and readback['result']=='observed_applied'and readback['two_static_reads_equal']is True and readback['normal_return_not_inferred']is True and readback['full_business_hashes_rechecked']is False
  and all(value is True for value in apply['preservation'].values())and len(apply['preservation'])==6)
 expected=readback['static_schema_after'];need(expected==apply['static_schema_after']and len(expected['history'])==38 and expected['history'][-1]==VERSION)
 pins=readback['source_pins'];need(DB_HELPER in pins and all(apply['source_pins'].get(path)==value for path,value in pins.items()))
 for path,value in pins.items():need(sha(load(ROOT/path))==value)
 m=module('list_query38_finite_static_reader',ROOT/DB_HELPER)
 need(m.projection_sources()==pins and m.VERSION==VERSION and m.MIGRATION_SHA==MIGRATION_SHA and m.s.static_schema(apply['first'])==expected);m.s.check_static(expected)
 return m,expected,pins

def source_pins():
 manifest();_,_,dbpins=static_contract();pins=base.source_pins();pins.update(dbpins)
 need(sha(load(ROOT/STAGER))==STAGE_SHA)
 for name in ['web.py','test_web.py','README.md','inputs.template.json','source.manifest.json']:pins[(HERE/name).relative_to(ROOT).as_posix()]=sha(load(HERE/name))
 for ref in ANCHORS.values():reference(ref);pins[ref['path']]=ref['sha256']
 quality(QUALITY_REF);pins[QUALITY_REF['path']]=QUALITY_REF['sha256'];pins.update(CHANGED);return dict(sorted(pins.items()))

def quality(ref):
 need(ref==QUALITY_REF);v=reference(ref);need(v['result']=='passed'and v['Main_API_commit']=='0f9ecc0'and v['full_tests']==939 and v['full_skipped']==v['full_failed']==v['full_lint_exit']==v['typecheck_exit']==0
  and v['focused_tests']==12 and v['focused_tests_subset_of_full']is True and v['hosting_or_real_provider_acceptance']is False
  and v['source_pins']=={'apps/web/app/api/v1/[...segments]/route.ts':CHANGED['apps/web/app/api/v1/[...segments]/route.ts'],'tests/server/foundation-list-query.test.ts':'90d68b83e52cf86ec6daeee14858bf6add580de820d655384e15263c6164a95e'})
 counts=v['suite_counts'];need(counts=={'tests':[409,13,19,56,251,191],'pass':[409,13,19,56,251,191],'fail':[0]*6,'skipped':[0]*6}and sum(counts['pass'])==v['full_tests']
  and v['full_test_log_sha256']=='84a19ee3d00dacecf8fa0ada8227df5300133b8760392c24aa09d81a81d58714'and v['full_test_log_bytes']==204596)
 for path,value in v['source_pins'].items():need(sha(load(ROOT/path))==value)
 return v

def stage(ref):
 v=reference(ref);need(v['files']==manifest()['files']and v['entries']==285 and v['bytes']==3068962 and v['result']=='passed'and v['project_id']==PROJECT and v['team_id']==TEAM and v['origin']=='https://'+ALIAS
  and v['source_stable']is True and v['private_input_stable']is True and v['private_hits']==0 and v['deployed']is False and v['private_inputs']==10 and v['private_value_families']==14 and v['harness_sha256']==STAGE_SHA)
 relative=v['source_root'];need(type(relative)is str and re.fullmatch(r'\.local/m07-pilot/web-source-[A-Za-z0-9TZ.-]+-[a-f0-9]{8}',relative));folder=ROOT/relative
 for row in v['files']:raw=load(folder/row['path']);need(len(raw)==row['bytes']and sha(raw)==row['sha256'])
 need(json.loads(load(folder/'.vercel/project.json'))=={'projectId':PROJECT,'orgId':TEAM,'projectName':'everyone-presentation-pilot'}and base.sealed_source_files(folder)==sorted([r['path']for r in v['files']]+['.vercel/project.json']))
 return folder

def metadata(plan,build_sha):return {'epsListQuery38Source':SOURCE,'epsListQuery38Quality':plan['gates']['quality']['sha256'],'epsListQuery38Canonical':plan['gates']['canonical_sha256'],'epsListQuery38Build':build_sha,'epsListQuery38Run':plan['run_id']}
def deploy_command(folder,meta):
 args=[str(old.NODE),str(old.CLI),'deploy',str(folder),'--prod','--yes','--no-wait','--project',PROJECT]
 for key,value in meta.items():args+=['--meta',key+'='+value]
 return args+['--scope',SLUG,'--global-config',old.GLOBAL]
def deployment(value):
 out=old.deployment(value);need(out['project_id']==PROJECT and out['team_id']==TEAM)
 keys=['source_sha256','quality_sha256','canonical_sha256'];prefix='epsBatchFilter38'if out['id']==CURRENT else'epsListQuery38'
 for suffix,key in zip(['Source','Quality','Canonical'],keys):
  marker=value.get('meta',{}).get(prefix+suffix);need(type(marker)is str and re.fullmatch('[a-f0-9]{64}',marker));out[key]=marker
 out['build_sha256']=None if out['id']==CURRENT else value.get('meta',{}).get('epsListQuery38Build');out['run_id']=None if out['id']==CURRENT else value.get('meta',{}).get('epsListQuery38Run')
 if out['id']!=CURRENT:need(type(out['build_sha256'])is str and re.fullmatch('[a-f0-9]{64}',out['build_sha256'])and type(out['run_id'])is str and str(uuid.UUID(out['run_id']))==out['run_id'])
 return out

def private_write(path,value):
 need(path.parent==PRIVATE);PRIVATE.mkdir(parents=True,exist_ok=True);guard=static_contract()[0].b.security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write((json.dumps(value,sort_keys=True)+'\n').encode());stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
def private_read(path):static_contract()[0].b.security().verify(path);return json.loads(load(path))

def bounded(args,environment,timeout,cwd):
 need(type(timeout)is int and 0<timeout<=900)
 process=subprocess.Popen(args,cwd=cwd,env=environment,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
 buffers=[bytearray(),bytearray()];overflow=threading.Event()
 def kill():
  try:process.kill()
  except OSError:pass
 def collect(stream,index,limit):
  try:
   while chunk:=stream.read(4096):
    available=max(0,limit-len(buffers[index]));buffers[index].extend(chunk[:available])
    if len(chunk)>available:overflow.set();kill();break
  except Exception:overflow.set();kill()
  finally:stream.close()
 threads=[threading.Thread(target=collect,args=(process.stdout,0,8*1024**2),daemon=True),threading.Thread(target=collect,args=(process.stderr,1,2*1024**2),daemon=True)]
 for thread in threads:thread.start()
 timed_out=False
 try:process.wait(timeout=timeout)
 except subprocess.TimeoutExpired:timed_out=True;kill();process.wait(timeout=10)
 for thread in threads:thread.join(timeout=5)
 need(all(not thread.is_alive()for thread in threads))
 return {'exit_code':process.returncode,'timed_out':timed_out,'overflow':overflow.is_set(),'stdout':bytes(buffers[0]),'stderr':bytes(buffers[1])}

class Ports:
 def pins(self):return source_pins()
 def gates(self):
  value=private_read(INPUTS);need(set(value)=={'source_receipt','quality_receipt','public_build_environment'});quality(value['quality_receipt']);folder=stage(value['source_receipt']);public=base.public_environment(value['public_build_environment']);m,expected,_=static_contract();need(m.read_static_state()==expected)
  return {'source':value['source_receipt'],'quality':value['quality_receipt'],'stage_root':folder.relative_to(ROOT).as_posix(),'public_build_environment':public,'canonical_sha256':digest(expected)}
 def run(self,args,timeout=60,cwd=ROOT,environment=None):
  value=bounded(args,old.environment(True)if environment is None else environment,timeout,cwd)
  need(value['exit_code']==0 and value['timed_out']is False and value['overflow']is False);return value['stdout'].decode('utf8')
 def api(self,endpoint):
  need(re.fullmatch(r'/v(?:9/projects|13/deployments)/[A-Za-z0-9_.-]+\?teamId='+TEAM,endpoint)or endpoint=='/v10/projects/'+PROJECT+'/env?teamId='+TEAM+'&decrypt=false')
  return json.loads(self.run([str(old.NODE),str(old.CLI),'api',endpoint,'--method','GET','--raw','--scope',SLUG,'--global-config',old.GLOBAL],30))
 def direct(self,identity):return deployment(self.api('/v13/deployments/'+identity+'?teamId='+TEAM))
 def observe(self):return {'project':base.project_settings(self.api('/v9/projects/'+PROJECT+'?teamId='+TEAM)),'environment':base.environment_rows(self.api('/v10/projects/'+PROJECT+'/env?teamId='+TEAM+'&decrypt=false')),'deployment':self.direct(ALIAS)}
 def exists(self,path):return path.exists()
 def write(self,path,value):private_write(path,value)
 def read(self,path):return private_read(path)
 def file_sha(self,path):return sha(load(path))
 def build(self,plan):
  folder=PRIVATE/plan['run_id']/'build';need(not folder.exists()and folder.resolve()==folder);folder.mkdir(parents=True,exist_ok=False)
  for row in manifest()['files']:
   target=folder/row['path'];target.parent.mkdir(parents=True,exist_ok=True);raw=load(ROOT/plan['gates']['stage_root']/row['path']);need(sha(raw)==row['sha256'])
   with target.open('xb')as stream:stream.write(raw)
  for name in ['empty-npmrc','empty-global-npmrc']:(folder/name).write_bytes(b'')
  environment=base.build_environment(plan['gates']['public_build_environment'],folder)
  for command in base.build_commands(folder):self.run(command,900,folder,environment)
  generated=[]
  for row in manifest()['files']:
   actual=sha(load(folder/row['path']))
   if actual!=row['sha256']:need(row['path']=='apps/web/next-env.d.ts');generated.append({'path':row['path'],'staged_sha256':row['sha256'],'framework_sha256':actual})
  need(all(not list(p.glob('.env*'))for p in [folder,folder/'.vercel',folder/'apps/web',folder/'apps/web/.vercel']))
  return {'result':'passed','source_sha256':SOURCE,'plan_sha256':self.file_sha(PLAN),'source_pins':plan['source_pins'],'quality_output':base.quality_output(folder),'framework_generated_deltas':generated,'quality_only':True,'no_prebuilt_acceptance':True}
 def verify_build(self,plan,value):
  need(value['result']=='passed'and value['source_sha256']==SOURCE and value['source_pins']==plan['source_pins']and value['plan_sha256']==self.file_sha(PLAN)and value['quality_only']is True and value['no_prebuilt_acceptance']is True and value['quality_output']==base.quality_output(PRIVATE/plan['run_id']/'build'))
 def save(self,action,value):
  path=ROOT/'tracking/evidence/m07/list-query38-web'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json');old.exclusive(path,{'schema_version':'1.0','action':action,'project_id':PROJECT,'team_id':TEAM,'source_sha256':SOURCE,'checkpoint':CHECKPOINT,'deployment_method':'provider_source_build','worker_or_environment_or_oauth_mutated':False,'raw_cli_or_credentials_persisted':False,**value});return {'result':value['result'],'receipt':path.relative_to(ROOT).as_posix()}

def prepare(p):
 need(DEPLOY_ENABLED);pins=p.pins();gates=p.gates();before=p.observe();baseline=copy.deepcopy(reference(ANCHORS['ready'])['deployment']);baseline.update(build_sha256=None,run_id=None)
 need(not p.exists(PREPARE)and not p.exists(PLAN)and before['deployment']==p.direct(CURRENT)==baseline and p.observe()==before)
 value={'run_id':str(uuid.uuid4()),'source_pins':pins,'gates':gates,'before':before};p.write(PREPARE,{**value,'automatic_retry':False,'deployment_performed':False})
 need(p.pins()==pins and p.gates()==gates and p.observe()==before);p.write(PLAN,value)
 return p.save('prepare',{'result':'prepared','source':gates['source'],'quality':gates['quality'],'canonical_sha256':gates['canonical_sha256'],'source_pins':pins,'deployment_performed':False})

def checked(p):
 plan=p.read(PLAN);need(plan['source_pins']==p.pins()and plan['gates']==p.gates()and str(uuid.UUID(plan['run_id']))==plan['run_id']);return plan
def build(p):
 need(DEPLOY_ENABLED);plan=checked(p);need(not p.exists(BUILD_CLAIM)and not p.exists(BUILD)and p.observe()==plan['before']);p.write(BUILD_CLAIM,{'plan_sha256':p.file_sha(PLAN),'source_pins':plan['source_pins'],'automatic_retry':False})
 value=p.build(plan);need(checked(p)==plan and p.observe()==plan['before']);p.write(BUILD,value);return p.save('build',{'result':'passed','build_sha256':p.file_sha(BUILD),'source_sha256':SOURCE,'quality_only':True,'no_prebuilt_acceptance':True})
def dispatch(p):
 need(DEPLOY_ENABLED);plan=checked(p);built=p.read(BUILD);p.verify_build(plan,built);need(not p.exists(CLAIM)and not p.exists(RETURNED)and p.observe()==plan['before'])
 claim={'plan_sha256':p.file_sha(PLAN),'build_sha256':p.file_sha(BUILD),'source_pins':plan['source_pins'],'before':plan['before'],'dispatch_may_have_occurred':True,'automatic_retry':False};p.write(CLAIM,claim)
 try:
  need(checked(p)==plan and p.observe()==plan['before']);p.verify_build(plan,p.read(BUILD));raw=p.run(deploy_command(ROOT/plan['gates']['stage_root'],metadata(plan,claim['build_sha256'])),60);url=old.deployment_url(raw)
  p.write(RETURNED,{'claim_sha256':p.file_sha(CLAIM),'normal_process_return_observed':True,'url':url});return p.save('submitted',{'result':'submitted','url':url,'claim_retained':True,'ready_verified':False})
 except Exception:return p.save('submitted',{'result':'unconfirmed','claim_retained':True,'automatic_retry':False,'ready_verified':False,'code':'LIST_QUERY38_DISPATCH_UNCONFIRMED'})
def readback(p):
 need(DEPLOY_ENABLED);plan=checked(p);built=p.read(BUILD);p.verify_build(plan,built);claim=p.read(CLAIM);returned=p.read(RETURNED)
 need(claim=={'plan_sha256':p.file_sha(PLAN),'build_sha256':p.file_sha(BUILD),'source_pins':plan['source_pins'],'before':plan['before'],'dispatch_may_have_occurred':True,'automatic_retry':False}and returned['claim_sha256']==p.file_sha(CLAIM)and returned['normal_process_return_observed']is True)
 url=returned['url'];need(old.deployment_url(url)==url);direct=p.direct(url.removeprefix('https://'));first=p.observe();second=p.observe();need(first==second and direct==first['deployment']and direct['id']!=CURRENT and direct['state']=='READY')
 expected={'source_sha256':SOURCE,'quality_sha256':plan['gates']['quality']['sha256'],'canonical_sha256':plan['gates']['canonical_sha256'],'build_sha256':p.file_sha(BUILD),'run_id':plan['run_id']}
 need(all(direct[key]==value for key,value in expected.items())and first['project']==plan['before']['project']and first['environment']==plan['before']['environment']and checked(p)==plan);p.verify_build(plan,p.read(BUILD))
 return p.save('ready',{'result':'passed','deployment':direct,'two_stable_alias_reads_equal':True,'stable_alias_matches':True,'project_and_environment_metadata_preserved':True,'canonical38_static_preserved_before_after':True,'claim_retained':True,'application_acceptance':False,'rollback_performed':False,'rollback_anchor':ANCHORS['ready']})

def main():
 need(DEPLOY_ENABLED and len(sys.argv)==2 and sys.argv[1]in('prepare','build','deploy','readback'));p=Ports();fn={'prepare':prepare,'build':build,'deploy':dispatch,'readback':readback}[sys.argv[1]];result=fn(p);print(json.dumps(result));need(result['result']in('prepared','passed','submitted'))
if __name__=='__main__':
 try:main()
 except Exception:print('LIST_QUERY38_WEB_UNCONFIRMED');sys.exit(1)
