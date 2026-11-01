"""Disabled web-only production purpose. Imports/tests never contact a provider."""
from pathlib import Path
import copy, datetime, importlib.util, json, os, re, subprocess, sys, threading, uuid
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];RELEASE_ENABLED=True
spec=importlib.util.spec_from_file_location('production_web_state',HERE/'state.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
BASE='development/m07/workspace-summary35-web/web.py';BASE_SHA='b306de33cbfe1a2d43426d0d9ec8e397618e847d94cd19692a3f6caff3e0a483'
SECURITY='tools/provision_logo_verifier.py';SECURITY_SHA='660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c'

def load(path,limit=16*1024**2):
 s.need(path.is_file()and not path.is_symlink()and not path.is_junction()and path.resolve()==path and path.stat().st_nlink==1 and path.stat().st_size<=limit);return path.read_bytes()
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def bounded(args,environment,cwd,timeout=60,body=None):
 s.need(type(timeout)is int and 0<timeout<=900)
 process=subprocess.Popen(args,cwd=cwd,env=environment,stdin=subprocess.PIPE if body is not None else subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0));buffers=[bytearray(),bytearray()];overflow=threading.Event()
 def kill():
  try:process.kill()
  except OSError:pass
 def collect(stream,index,limit):
  try:
   while chunk:=stream.read(4096):
    available=max(0,limit-len(buffers[index]));buffers[index].extend(chunk[:available])
    if len(chunk)>available:overflow.set();kill();break
  finally:stream.close()
 threads=[threading.Thread(target=collect,args=(process.stdout,0,8*1024**2),daemon=True),threading.Thread(target=collect,args=(process.stderr,1,2*1024**2),daemon=True)]
 for thread in threads:thread.start()
 timed_out=False
 try:
  if body is not None:process.stdin.write(body);process.stdin.close()
  process.wait(timeout=timeout)
 except subprocess.TimeoutExpired:timed_out=True;kill();process.wait(timeout=10)
 finally:
  for thread in threads:thread.join(timeout=3)
 s.need(process.returncode==0 and not timed_out and not overflow.is_set()and all(not t.is_alive()for t in threads));return bytes(buffers[0]).decode('utf8')

class Operator:
 def __init__(self,root=ROOT,own=HERE):
  self.root=Path(root).resolve();self.own=Path(own).resolve();self.private=self.root/'.local/production-web-release';self.plan=self.private/'plan.json';self.build_file=self.private/'build.json';self.configured=self.private/'configured.json';self.returned=self.private/'deploy.returned.json'
  s.need(s.sha(load(self.root/BASE))==BASE_SHA and s.sha(load(self.root/SECURITY))==SECURITY_SHA);self.base=module('production_web_pure35',self.root/BASE);self.old=self.base.old
  sys.path.insert(0,str(self.root/'tools'))
  try:self.guard=module('production_web_private_files',self.root/SECURITY).WindowsPrivateFiles()
  finally:sys.path.pop(0)
 def exists(self,path):return path.exists()
 def write(self,path,value):
  path.parent.mkdir(parents=True,exist_ok=True)
  with self.guard.create(path)as stream:self.guard.verify_open(stream);stream.write((json.dumps(value,sort_keys=True)+'\n').encode());stream.flush();os.fsync(stream.fileno());self.guard.verify_open(stream)
 def read(self,path):self.guard.verify(path);return json.loads(load(path))
 def file_sha(self,path):return s.sha(load(path))
 def pins(self):
  pins=self.base.source_pins()
  for name in('release.py','state.py','stage.py','quality.py','scan-stage.mjs','test_release.py','inputs.template.json','README.md'):pins['development/m07/production-web-release/'+name]=s.sha(load(self.own/name))
  path=self.old.CLI.parent/'commands/env/index.js';s.need(s.sha(load(path))=='66890df33a9c3b4e86b154efb200ba71552f3beec5d1a6759ff3cd6946369e8d');pins['cli:commands/env/index.js']=s.sha(load(path))
  pins[SECURITY]=SECURITY_SHA
  for path in('tools/release_foundation.py','tools/release_logo.py','tools/scan-private-values.mjs'):pins[path]=s.sha(load(self.root/path))
  return dict(sorted(pins.items()))
 def run(self,args,timeout=60,cwd=None,environment=None,body=None):
  s.need(not any(os.environ.get(k)for k in('VERCEL_TOKEN','NODE_OPTIONS','NODE_TLS_REJECT_UNAUTHORIZED','NODE_EXTRA_CA_CERTS')))
  return bounded(args,self.old.environment(True)if environment is None else environment,cwd or self.root,timeout,body)
 def api(self,endpoint,method='GET',body=None):
  prefix='/v10/projects/'+s.PROJECT+'/env';read=endpoint in('/v9/projects/'+s.PROJECT+'?teamId='+s.TEAM,prefix+'?teamId='+s.TEAM+'&decrypt=false')or re.fullmatch('/v13/deployments/[A-Za-z0-9_.-]+\\?teamId='+s.TEAM,endpoint)
  write=method=='POST'and endpoint==prefix+'?teamId='+s.TEAM+'&upsert=false'or method=='PATCH'and re.fullmatch(prefix+'/[A-Za-z0-9_-]+\\?teamId='+s.TEAM,endpoint)
  s.need(method=='GET'and read and body is None or write and type(body)is dict)
  args=[str(self.old.NODE),str(self.old.CLI),'api',endpoint,'--method',method,'--raw','--scope',s.SLUG,'--global-config',self.old.GLOBAL]
  if body is not None:args+=['--input','-']
  value=json.loads(self.run(args,body=None if body is None else json.dumps(body).encode()));s.need(type(value)is dict and'error'not in value);return value
 def direct(self,identity):return s.deployment(self.api('/v13/deployments/'+identity+'?teamId='+s.TEAM))
 def observe(self):
  return {'project':self.base.project_settings(self.api('/v9/projects/'+s.PROJECT+'?teamId='+s.TEAM)),'environment':s.environment_rows(self.api('/v10/projects/'+s.PROJECT+'/env?teamId='+s.TEAM+'&decrypt=false')),'deployment':self.direct(s.ALIAS)}
 def reference(self,ref):
  s.need(type(ref)is dict and set(ref)=={'path','sha256'}and type(ref['path'])is str and re.fullmatch(r'tracking/evidence/[A-Za-z0-9_./-]+\.json',ref['path'])and'..'not in ref['path'].split('/')and re.fullmatch('[a-f0-9]{64}',ref['sha256']))
  raw=load(self.root/ref['path']);s.need(s.sha(raw)==ref['sha256']);return json.loads(raw)
 def gates(self):
  value=self.read(self.private/'inputs.json');s.need(set(value)=={'source_receipt','quality_receipt','canonical_receipt','public_build_environment'})
  source=self.reference(value['source_receipt']);rows=source['files'];self.base.validate_rows(rows);s.need(source['result']=='passed'and source['archive_source']is True and source['private_hits']==0 and source['private_inputs_stable']is True and source['project_id']==s.PROJECT and source['team_id']==s.TEAM)
  for name in('stage.py','scan-stage.mjs'):s.need(source['stage_source_pins']['development/m07/production-web-release/'+name]==s.sha(load(self.own/name)))
  commit=source['source_commit'];s.need(re.fullmatch('[a-f0-9]{40}',commit)and source['source_sha256']==s.digest(rows)and source['entries']==len(rows)and rows==sorted(rows,key=lambda row:row['path']))
  folder=self.root/source['source_root'];s.need(re.fullmatch(r'\.local/production-web-release/source-[a-f0-9-]{36}',source['source_root']))
  for row in rows:s.need(len(load(folder/row['path']))==row['bytes']and s.sha(load(folder/row['path']))==row['sha256'])
  s.need(self.base.sealed_source_files(folder)==sorted([row['path']for row in rows]+['.vercel/project.json'])and json.loads(load(folder/'.vercel/project.json'))=={'projectId':s.PROJECT,'orgId':s.TEAM,'projectName':'everyone-presentation-pilot'})
  # Controller/docs may advance main; selected product bytes must stay equal.
  self.git_source(commit,[row['path']for row in rows])
  quality=self.reference(value['quality_receipt']);s.need(quality['result']=='passed'and quality['source_commit']==commit and quality['source_sha256']==source['source_sha256']and quality['failed']==quality['skipped']==0 and set(quality['commands'])=={'test','typecheck','lint','production_guard'}and all(code==0 for code in quality['commands'].values()))
  s.need(quality['source_receipt']==value['source_receipt'])
  carried=module('production_web_quality_admission',self.own/'quality.py');s.need(quality['quality_kind']=='carried_forward_reviewed_product_bytes'and quality['carried_forward_verification']==carried.carry(self.root,source,self.reference(carried.ORIGINAL))and quality['fresh_production_guard']['exit_code']==0 and quality['full_tests_rerun']is False)
  for path,digest in quality['fresh_production_guard']['source_pins'].items():s.need(path in('tools/check-production-guard.ts','apps/web/lib/config.ts','apps/web/lib/hosting-pilot.ts')and s.sha(load(self.root/path))==digest)
  s.need(set(quality['fresh_production_guard']['source_pins'])=={'tools/check-production-guard.ts','apps/web/lib/config.ts','apps/web/lib/hosting-pilot.ts'})
  canonical=self.reference(value['canonical_receipt']);s.need(canonical['result']=='passed'and canonical['target']=='pyibofyctwnqpvktepse'and canonical['version']=='20261101223342'and canonical['normal_return_marker_observed']is True and canonical['two_independent_readbacks_equal']is True and canonical['first']==canonical['second']and len(canonical['first']['base']['history'])==39 and canonical['first']['base']['history'][-1]=='20261101223342')
  public=value['public_build_environment'];fixed={'APP_ENV':'production','EPS_RELEASE_MODE':'production','NODE_ENV':'production','CENTRAL_ADAPTER_MODE':'supabase','APP_BASE_URL':'https://'+s.ALIAS,'SUPABASE_URL':'https://pyibofyctwnqpvktepse.supabase.co'}
  s.need(type(public)is dict and set(public)==set(fixed)|{'SUPABASE_PUBLISHABLE_KEY'}and all(public[k]==v for k,v in fixed.items())and re.fullmatch('sb_publishable_[A-Za-z0-9_-]{8,4096}',public['SUPABASE_PUBLISHABLE_KEY']))
  return {'source':value['source_receipt'],'quality':value['quality_receipt'],'canonical':value['canonical_receipt'],'source_commit':commit,'source_sha256':source['source_sha256'],'source_root':source['source_root'],'files':rows,'public_build_environment':public}
 def git_source(self,commit,paths):
  def git(args):return self.old.command(['git',*args],cwd=self.root).strip()
  s.need(git(['symbolic-ref','--short','HEAD'])=='main');git(['merge-base','--is-ancestor',commit,'HEAD']);s.need(not git(['diff','--name-only',commit,'HEAD','--',*paths])and not git(['status','--porcelain','--untracked-files=no','--',*paths]))
  prefixes=['apps/web','packages','contracts/json-schema','contracts/mcp-tool-catalog.json','package.json','package-lock.json','tsconfig.json','CONTRACT_BASELINE.md','tools/start-web.mjs'];extras={'apps/web/lib/hosting-pilot.ts','tools/start-pilot-web.mjs','apps/worker/package.json'}
  current={p for p in git(['ls-tree','-r','--name-only','HEAD','--',*prefixes]).splitlines()if not re.search(r'(?:^|/)(?:test|tests|__tests__)(?:/|$)',p)}|extras;s.need(current==set(paths))
 def verify(self,plan):
  s.need(plan['source_pins']==self.pins()and plan['gates']==self.gates()and str(uuid.UUID(plan['run_id']))==plan['run_id']and plan['steps']==s.environment_steps(plan['before']['environment']));s.baseline(plan['before']['deployment'])
 def prepare(self):
  s.need(RELEASE_ENABLED);pins=self.pins();gates=self.gates();s.need(not self.exists(self.plan));first=self.observe();second=self.observe();s.need(first==second and self.direct(s.BASELINE)==first['deployment']);s.baseline(first['deployment']);s.environment_steps(first['environment'])
  plan={'run_id':str(uuid.uuid4()),'source_pins':pins,'gates':gates,'before':first,'steps':s.environment_steps(first['environment'])};self.write(self.plan,plan);return {'result':'prepared','source_commit':gates['source_commit'],'source_sha256':gates['source_sha256'],'configuration_steps':plan['steps'],'before':first,'cloud_mutation':False}
 def build(self):
  s.need(RELEASE_ENABLED);plan=self.read(self.plan);self.verify(plan);claim=self.private/'build.claim.json';s.need(not self.exists(claim)and self.observe()==plan['before']);self.write(claim,{'run_id':plan['run_id'],'automatic_retry':False})
  folder=self.private/('build-'+plan['run_id']);s.need(not folder.exists());folder.mkdir()
  for row in plan['gates']['files']:
   target=folder/row['path'];target.parent.mkdir(parents=True,exist_ok=True);raw=load(self.root/plan['gates']['source_root']/row['path']);s.need(s.sha(raw)==row['sha256']);target.write_bytes(raw)
  for name in('empty-npmrc','empty-global-npmrc'):(folder/name).write_bytes(b'')
  env={k:os.environ[k]for k in('PATH','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG')if k in os.environ};env.update(plan['gates']['public_build_environment']);env.update({'CI':'1','NPM_CONFIG_USERCONFIG':str(folder/'empty-npmrc'),'NPM_CONFIG_GLOBALCONFIG':str(folder/'empty-global-npmrc')})
  for args in self.base.build_commands(folder):self.run(args,900,folder,env)
  generated=[]
  for row in plan['gates']['files']:
   actual=s.sha(load(folder/row['path']))
   if actual!=row['sha256']:s.need(row['path']=='apps/web/next-env.d.ts');generated.append({'path':row['path'],'framework_sha256':actual})
  s.need(all(not list(p.glob('.env*'))for p in(folder,folder/'.vercel',folder/'apps/web',folder/'apps/web/.vercel')));self.verify(plan);s.need(self.observe()==plan['before'])
  value={'result':'passed','plan_sha256':self.file_sha(self.plan),'source_pins':plan['source_pins'],'quality_output':self.base.quality_output(folder),'generated':generated,'quality_only':True};self.write(self.build_file,value);return value
 def built(self,plan):
  value=self.read(self.build_file);s.need(value['result']=='passed'and value['quality_only']is True and value['plan_sha256']==self.file_sha(self.plan)and value['source_pins']==plan['source_pins']and value['quality_output']==self.base.quality_output(self.private/('build-'+plan['run_id'])));return value
 def mutate(self,step):
  s.need(step['key']in s.DESIRED)
  if step['kind']=='create':s.need(set(step)=={'kind','key','body'}and step['body']=={'key':step['key'],'value':s.DESIRED[step['key']],'type':'plain','target':['production']})
  else:
   s.need(set(step)=={'kind','key','id','body'}and re.fullmatch('[A-Za-z0-9_-]{1,200}',step['id']))
   if step['kind']=='patch':s.need(step['body']=={'value':s.DESIRED[step['key']]})
   else:s.need(step['kind']=='split'and set(step['body'])=={'target'}and type(step['body']['target'])is list and step['body']['target']and len(set(step['body']['target']))==len(step['body']['target'])and set(step['body']['target'])<={'preview','development'})
  return self.api('/v10/projects/'+s.PROJECT+'/env'+(''if step['kind']=='create'else'/'+step['id'])+'?teamId='+s.TEAM+('&upsert=false'if step['kind']=='create'else''),'POST'if step['kind']=='create'else'PATCH',step['body'])
 def phase(self,plan,index,step,before):
  claim=self.private/('environment-'+str(index)+'.claim.json');normal=self.private/('environment-'+str(index)+'.normal.json');s.need(not self.exists(claim));self.write(claim,{'run_id':plan['run_id'],'step':step,'before':before,'dispatch_may_have_occurred':True,'automatic_retry':False})
  result={'result':'unconfirmed','phase':index,'claim_retained':True,'normal_return_observed':False,'two_readbacks_equal':False,'automatic_retry':False}
  try:
   self.verify(plan);s.need(self.observe()==before);self.mutate(step);self.write(normal,{'claim_sha256':self.file_sha(claim),'normal_return_observed':True});result['normal_return_observed']=True
  except Exception:result['safe_error_code']='PRODUCTION_WEB_ENVIRONMENT_UNCONFIRMED'
  try:
   first,second=self.observe(),self.observe();s.need(first==second);s.transition(before,first,step);result.update(after=first,two_readbacks_equal=True)
  except Exception:result['readback_error_code']='PRODUCTION_WEB_ENVIRONMENT_READBACK_UNCONFIRMED'
  if result['normal_return_observed']and result['two_readbacks_equal']:result['result']='passed'
  return result
 def configure(self):
  s.need(RELEASE_ENABLED);plan=self.read(self.plan);self.verify(plan);self.built(plan);claim=self.private/'configure.claim.json';s.need(not self.exists(claim)and self.observe()==plan['before']);self.write(claim,{'plan_sha256':self.file_sha(self.plan),'automatic_retry':False});before=plan['before'];phases=[]
  for index,step in enumerate(plan['steps']):
   value=self.phase(plan,index,step,before);phases.append(value)
   if value['result']!='passed':return {'result':'unconfirmed','phases':phases,'claim_retained':True,'automatic_retry':False}
   before=value['after']
  s.production_environment(before['environment']);self.verify(plan);s.need(self.observe()==before);value={'result':'passed','plan_sha256':self.file_sha(self.plan),'after':before,'phases':phases,'preview_and_other_metadata_preserved':True,'private_values_not_decrypted_or_written':True};self.write(self.configured,value);return value
 def deploy(self):
  s.need(RELEASE_ENABLED);plan=self.read(self.plan);self.verify(plan);self.built(plan);configured=self.read(self.configured);s.need(configured['result']=='passed'and configured['plan_sha256']==self.file_sha(self.plan)and self.observe()==configured['after']);s.production_environment(configured['after']['environment']);claim=self.private/'deploy.claim.json';s.need(not self.exists(claim)and not self.exists(self.returned));self.write(claim,{'plan_sha256':self.file_sha(self.plan),'build_sha256':self.file_sha(self.build_file),'configured_sha256':self.file_sha(self.configured),'dispatch_may_have_occurred':True,'automatic_retry':False})
  try:
   self.verify(plan);s.need(self.observe()==configured['after']);meta={'epsSourceCommit':plan['gates']['source_commit'],'epsSourceManifest':plan['gates']['source_sha256'],'epsProductionWebRun':plan['run_id'],'epsProductionWebBuild':self.file_sha(self.build_file),'epsProductionWebCanonical':plan['gates']['canonical']['sha256']}
   args=[str(self.old.NODE),str(self.old.CLI),'deploy',str(self.root/plan['gates']['source_root']),'--prod','--yes','--no-wait','--project',s.PROJECT,'--scope',s.SLUG,'--global-config',self.old.GLOBAL]
   for key,value in meta.items():args+=['--meta',key+'='+value]
   url=self.old.deployment_url(self.run(args));self.write(self.returned,{'claim_sha256':self.file_sha(claim),'url':url,'normal_process_return_observed':True,'meta':meta});return {'result':'submitted','url':url,'ready_verified':False,'claim_retained':True,'automatic_retry':False}
  except Exception:return {'result':'unconfirmed','safe_error_code':'PRODUCTION_WEB_DEPLOY_UNCONFIRMED','claim_retained':True,'automatic_retry':False}
 def readback(self):
  plan=self.read(self.plan);self.verify(plan);self.built(plan);claim=self.private/'deploy.claim.json';s.need(self.exists(claim));configured=self.read(self.configured);normal=self.read(self.returned)if self.exists(self.returned)else None
  first,second=self.observe(),self.observe();s.need(first==second and first['project']==configured['after']['project']and first['environment']==configured['after']['environment']);s.production_environment(first['environment']);direct=first['deployment']
  expected={'epsSourceCommit':plan['gates']['source_commit'],'epsSourceManifest':plan['gates']['source_sha256'],'epsProductionWebRun':plan['run_id'],'epsProductionWebBuild':self.file_sha(self.build_file),'epsProductionWebCanonical':plan['gates']['canonical']['sha256']};s.need(direct['meta']==expected and direct['state']=='READY'and direct['id']!=s.BASELINE and self.direct(direct['id'])==direct)
  confirmed=normal is not None and normal=={'claim_sha256':self.file_sha(claim),'url':'https://'+direct['url'],'normal_process_return_observed':True,'meta':expected}
  return {'result':'passed'if confirmed else'observed_ready','deployment':direct,'two_independent_reads_equal':True,'stable_alias_matches':True,'normal_return_not_inferred':True,'normal_process_return_observed':confirmed,'rollback_anchor':s.BASELINE,'worker_or_database_mutated':False,'application_acceptance':False,'automatic_retry':False}
 def reconcile_environment(self):
  plan=self.read(self.plan);self.verify(plan);s.need(self.exists(self.private/'configure.claim.json'));first,second=self.observe(),self.observe();s.need(first==second and first['project']==plan['before']['project']and first['deployment']==plan['before']['deployment']);s.common_environment(first['environment']);complete=False
  try:s.production_environment(first['environment']);complete=True
  except ValueError:pass
  # A split may have committed before a response was lost, leaving a production
  # key temporarily absent. Observation must remain available in that state.
  return {'result':'observed_only','current':first,'environment_metadata_sha256':s.digest(first['environment']),'production_public_values':{key:[row['public_value']for row in first['environment']if row['key']==key and'production'in row['target']]for key in s.DESIRED},'desired_configuration_observed':complete,'normal_return_not_inferred':True,'automatic_retry':False,'claim_retained':True}

def main():
 s.need(len(sys.argv)==2 and sys.argv[1]in('prepare','build','configure','deploy','readback','environment-readback'));action=sys.argv[1]
 # Even prepare/provider reads require the independently reviewed armed source.
 s.need(RELEASE_ENABLED);operator=Operator();value=getattr(operator,'reconcile_environment'if action=='environment-readback'else action)();path=ROOT/'tracking/evidence/m07/production-web-release'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json');path.parent.mkdir(parents=True,exist_ok=True)
 # Public receipts exclude protected plans, build environment and all env values.
 public={k:v for k,v in value.items()if k not in('before','after','phases','current','source_pins')};public.update(observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),action=action,project_id=s.PROJECT,team_id=s.TEAM,credentials_or_raw_cli_persisted=False)
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(public,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':value['result'],'receipt':path.relative_to(ROOT).as_posix()}));s.need(value['result']in('prepared','passed','submitted','observed_ready','observed_only'))
if __name__=='__main__':
 try:main()
 except Exception:print('PRODUCTION_WEB_UNCONFIRMED',file=sys.stderr);sys.exit(1)
