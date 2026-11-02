"""NEW default-off web-only purpose; no historical main or claim is replayed."""
from pathlib import Path
import datetime, importlib.util, json, os, re, sys
HERE=Path(__file__).resolve().parent;ROOT=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio');RELEASE_ENABLED=True
spec=importlib.util.spec_from_file_location('logo_failure_trace_web_gates',HERE/'gates.py');g=importlib.util.module_from_spec(spec);spec.loader.exec_module(g)

def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
def legacy(root):
 folder=root/'development/m07/production-web-release'
 for name,digest in g.FROZEN.items():g.need(g.sha(g.load(folder/name))==digest)
 return module('review_link_reason_frozen_web_functions',folder/'release.py')
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()

class Operator:
 def __init__(self,run,root=ROOT,own=HERE):
  g.need(RELEASE_ENABLED);self.run_id=g.run_id(run);self.root=Path(root).resolve();self.own=Path(own).resolve();g.need(self.root==ROOT.resolve())
  self.r=legacy(self.root);self.inherited=self.r.Operator(self.root,self.root/'development/m07/production-web-release');self.base=self.inherited.base;self.old=self.inherited.old;self.guard=self.inherited.guard
  self.private=self.root/'.local/logo-failure-trace-web-release'/self.run_id;self.plan=self.private/'plan.json';self.build_file=self.private/'build.json';self.returned=self.private/'deploy.returned.json'
 def exists(self,path):return path.exists()
 def write(self,path,value):
  g.need(path.is_relative_to(self.private)and path.resolve()==path);self.inherited.write(path,value)
 def read(self,path):
  g.need(path.is_relative_to(self.private)and path.resolve()==path);return self.inherited.read(path)
 def file_sha(self,path):return g.sha(g.load(path))
 def pins(self):
  pins=self.inherited.pins()
  for name,expected in g.PREDECESSOR.items():
   file='development/m07/mcp-diagnostic-web-release/'+name;g.need(g.sha(g.load(self.root/file))==expected);pins[file]=expected
  for name in('release.py','gates.py','stage.py','scan-stage.mjs','preflight.py','inputs.template.json','test_release.py','README.md'):pins['development/m07/logo-failure-trace-web-release/'+name]=g.sha(g.load(self.own/name))
  reader='development/m07/oauth-attempt-trace/inspect-attempt.py';g.need(g.sha(g.load(self.root/reader))=='1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c');pins[reader]='1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'
  return dict(sorted(pins.items()))
 def run(self,*args,**kwargs):g.need(RELEASE_ENABLED);return self.inherited.run(*args,**kwargs)
 def api(self,endpoint):
  g.need(RELEASE_ENABLED);allowed=endpoint in('/v9/projects/'+g.PROJECT+'?teamId='+g.TEAM,'/v10/projects/'+g.PROJECT+'/env?teamId='+g.TEAM+'&decrypt=false')or re.fullmatch('/v13/deployments/[A-Za-z0-9_.-]+\\?teamId='+g.TEAM,endpoint)
  g.need(allowed);args=[str(self.old.NODE),str(self.old.CLI),'api',endpoint,'--method','GET','--raw','--scope',g.SLUG,'--global-config',self.old.GLOBAL]
  value=json.loads(self.run(args));g.need(type(value)is dict and'error'not in value);return value
 def direct(self,identity):return self.r.s.deployment(self.api('/v13/deployments/'+identity+'?teamId='+g.TEAM))
 def observe(self):return {'project':self.base.project_settings(self.api('/v9/projects/'+g.PROJECT+'?teamId='+g.TEAM)),'environment':self.r.s.environment_rows(self.api('/v10/projects/'+g.PROJECT+'/env?teamId='+g.TEAM+'&decrypt=false')),'deployment':self.direct(g.ALIAS)}
 def baseline(self,value):
  approved=g.reference(self.root,g.BASELINE_RECEIPT);g.need(approved['result']=='passed'and approved['normal_process_return_observed']is True and approved['two_independent_reads_equal']is True and approved['stable_alias_matches']is True and approved['deployment']['id']==g.BASELINE and value==approved['deployment']and value['state']=='READY'and value['meta']['epsSourceCommit']==g.BASE_COMMIT and value['meta']['epsSourceManifest']==g.BASE_MANIFEST)
 def gates(self):
  value=self.read(self.private/'inputs.json');g.need(set(value)=={'run_id','source_receipt','quality_receipt','canonical_key','canonical_receipt','public_build_environment'}and value['run_id']==self.run_id)
  source=g.reference(self.root,value['source_receipt']);rows=source['files'];self.base.validate_rows(rows)
  g.need(source['result']=='passed'and source['run_id']==self.run_id and source['archive_source']is True and source['private_hits']==0 and source['private_inputs_stable']is True and source['private_input_families']==14 and source['private_input_files']==10 and source['project_id']==g.PROJECT and source['team_id']==g.TEAM and source['stage_source_pins']==self.pins())
  commit=source['source_commit'];g.need(re.fullmatch('[a-f0-9]{40}',commit)and source['source_sha256']==g.digest(rows)and source['entries']==len(rows)and rows==sorted(rows,key=lambda row:row['path']))
  stage_claim=self.private/'stage.claim.json';g.need(self.file_sha(stage_claim)==source['stage_claim_sha256']and self.read(stage_claim)=={'run_id':self.run_id,'source_commit':commit,'source_pins':source['stage_source_pins'],'automatic_retry':False})
  expected='.local/logo-failure-trace-web-release/'+self.run_id+'/source';g.need(source['source_root']==expected);folder=self.root/expected
  for row in rows:raw=g.load(folder/row['path']);g.need(len(raw)==row['bytes']and g.sha(raw)==row['sha256'])
  g.need(self.base.sealed_source_files(folder)==sorted([row['path']for row in rows]+['.vercel/project.json'])and json.loads(g.load(folder/'.vercel/project.json'))=={'projectId':g.PROJECT,'orgId':g.TEAM,'projectName':'everyone-presentation-pilot'})
  self.git_source(commit,[row['path']for row in rows]);quality=g.quality(self.root,source,value['quality_receipt']);canonical=g.canonical(self.root,value['canonical_key'],value['canonical_receipt'],self.guard.verify)
  public=value['public_build_environment'];fixed={'APP_ENV':'production','EPS_RELEASE_MODE':'production','NODE_ENV':'production','CENTRAL_ADAPTER_MODE':'supabase','APP_BASE_URL':'https://'+g.ALIAS,'SUPABASE_URL':'https://'+g.TARGET+'.supabase.co'}
  g.need(type(public)is dict and set(public)==set(fixed)|{'SUPABASE_PUBLISHABLE_KEY'}and all(public[k]==v for k,v in fixed.items())and re.fullmatch('sb_publishable_[A-Za-z0-9_-]{8,4096}',public['SUPABASE_PUBLISHABLE_KEY']))
  return {'source':value['source_receipt'],'quality':quality,'canonical':canonical,'source_commit':commit,'source_sha256':source['source_sha256'],'source_root':source['source_root'],'files':rows,'public_build_environment':public}
 def git_source(self,commit,paths):return self.inherited.git_source(commit,paths)
 def verify(self,plan):
  claim=self.private/'prepare.claim.json';g.need(plan['run_id']==self.run_id and plan['source_pins']==self.pins()and plan['gates']==self.gates()and self.file_sha(claim)==plan['prepare_claim_sha256']);g.need(self.read(claim)=={'run_id':self.run_id,'source_pins':plan['source_pins'],'gates_sha256':g.digest(plan['gates']),'automatic_retry':False});self.baseline(plan['before']['deployment']);self.r.s.production_environment(plan['before']['environment'])
 def prepare(self):
  g.need(RELEASE_ENABLED);pins=self.pins();gates=self.gates();claim=self.private/'prepare.claim.json';g.need(not self.exists(self.plan)and not self.exists(claim));self.write(claim,{'run_id':self.run_id,'source_pins':pins,'gates_sha256':g.digest(gates),'automatic_retry':False})
  first,second=self.observe(),self.observe();g.need(first==second and self.direct(g.BASELINE)==self.direct(g.BASELINE)==first['deployment']);self.baseline(first['deployment']);self.r.s.production_environment(first['environment'])
  plan={'run_id':self.run_id,'source_pins':pins,'gates':gates,'before':first,'prepared_at':stamp(),'prepare_claim_sha256':self.file_sha(claim)};self.write(self.plan,plan)
  return {'result':'prepared','source_commit':gates['source_commit'],'source_sha256':gates['source_sha256'],'rollback_anchor':g.BASELINE,'cloud_mutation':False}
 def build(self):
  g.need(RELEASE_ENABLED);value=self.r.Operator.build(self);plan=self.read(self.plan);finished=stamp();self.write(self.private/'build.finished.json',{'plan_sha256':self.file_sha(self.plan),'build_sha256':self.file_sha(self.build_file),'build_claim_sha256':self.file_sha(self.private/'build.claim.json'),'finished_at':finished})
  return {**value,'source_commit':plan['gates']['source_commit'],'source_sha256':plan['gates']['source_sha256'],'build_finished_at':finished,'build_receipt_sha256':self.file_sha(self.build_file)}
 def built(self,plan):
  value=self.r.Operator.built(self,plan);finished=self.read(self.private/'build.finished.json');claim=self.private/'build.claim.json';g.need(set(finished)=={'plan_sha256','build_sha256','build_claim_sha256','finished_at'}and finished['plan_sha256']==self.file_sha(self.plan)and finished['build_sha256']==self.file_sha(self.build_file)and finished['build_claim_sha256']==self.file_sha(claim)and self.read(claim)=={'run_id':self.run_id,'automatic_retry':False});timestamp=datetime.datetime.fromisoformat(finished['finished_at']);g.need(timestamp.tzinfo is not None and timestamp>=datetime.datetime.fromisoformat(plan['prepared_at'])and timestamp<=datetime.datetime.now(datetime.timezone.utc)+datetime.timedelta(seconds=60));return {**value,'finished_at':finished['finished_at']}
 def metadata(self,plan):return {'epsSourceCommit':plan['gates']['source_commit'],'epsSourceManifest':plan['gates']['source_sha256'],'epsProductionWebRun':self.run_id,'epsProductionWebBuild':self.file_sha(self.build_file),'epsProductionWebCanonical':plan['gates']['canonical']['ref']['sha256']}
 def deploy(self):
  g.need(RELEASE_ENABLED);plan=self.read(self.plan);self.verify(plan);built=self.built(plan);g.need(self.observe()==plan['before']);preflight=self.read(self.private/'deploy-inputs.json');g.need(set(preflight)=={'preflight_receipt'});g.preflight(self.root,preflight['preflight_receipt'],plan,datetime.datetime.now(datetime.timezone.utc),built['finished_at'])
  claim=self.private/'deploy.claim.json';g.need(not self.exists(claim)and not self.exists(self.returned));self.write(claim,{'run_id':self.run_id,'plan_sha256':self.file_sha(self.plan),'build_sha256':self.file_sha(self.build_file),'preflight_receipt':preflight['preflight_receipt'],'claimed_at':stamp(),'dispatch_may_have_occurred':True,'automatic_retry':False})
  try:
   self.verify(plan);g.need(self.observe()==plan['before']);g.preflight(self.root,preflight['preflight_receipt'],plan,datetime.datetime.now(datetime.timezone.utc),built['finished_at']);meta=self.metadata(plan);args=[str(self.old.NODE),str(self.old.CLI),'deploy',str(self.root/plan['gates']['source_root']),'--prod','--yes','--no-wait','--project',g.PROJECT,'--scope',g.SLUG,'--global-config',self.old.GLOBAL]
   for key,value in meta.items():args+=['--meta',key+'='+value]
   url=self.old.deployment_url(self.run(args));self.write(self.returned,{'claim_sha256':self.file_sha(claim),'url':url,'normal_process_return_observed':True,'meta':meta});return {'result':'submitted','url':url,'ready_verified':False,'claim_retained':True,'automatic_retry':False}
  except Exception:return {'result':'unconfirmed','safe_error_code':'LOGO_FAILURE_TRACE_DEPLOY_UNCONFIRMED','claim_retained':True,'automatic_retry':False}
 def readback(self):
  g.need(RELEASE_ENABLED);plan=self.read(self.plan);self.verify(plan);built=self.built(plan);claim=self.private/'deploy.claim.json';g.need(self.exists(claim));claimed=self.read(claim);g.need(claimed['run_id']==self.run_id and claimed['plan_sha256']==self.file_sha(self.plan)and claimed['build_sha256']==self.file_sha(self.build_file));g.preflight(self.root,claimed['preflight_receipt'],plan,datetime.datetime.fromisoformat(claimed['claimed_at']),built['finished_at'])
  first,second=self.observe(),self.observe();g.need(first==second and first['project']==plan['before']['project']and first['environment']==plan['before']['environment']);self.r.s.production_environment(first['environment']);direct=first['deployment'];expected=self.metadata(plan)
  if direct['meta']!=expected or direct['state']!='READY':return {'result':'unconfirmed','claim_retained':True,'normal_return_not_inferred':True,'automatic_retry':False}
  g.need(direct['id']!=g.BASELINE and self.direct(direct['id'])==self.direct(direct['id'])==direct);normal=self.read(self.returned)if self.exists(self.returned)else None
  confirmed=normal is not None and normal=={'claim_sha256':self.file_sha(claim),'url':'https://'+direct['url'],'normal_process_return_observed':True,'meta':expected}
  return {'result':'passed'if confirmed else'observed_ready','deployment':direct,'two_independent_reads_equal':True,'stable_alias_matches':True,'normal_return_not_inferred':True,'normal_process_return_observed':confirmed,'rollback_anchor':g.BASELINE,'environment_or_database_or_worker_mutated':False,'application_acceptance':False,'automatic_retry':False}

def public(value):return {key:value[key]for key in('result','safe_error_code','source_commit','source_sha256','build_finished_at','build_receipt_sha256','url','ready_verified','claim_retained','automatic_retry','deployment','two_independent_reads_equal','stable_alias_matches','normal_return_not_inferred','normal_process_return_observed','rollback_anchor','environment_or_database_or_worker_mutated','application_acceptance','cloud_mutation')if key in value}
def main():
 g.need(RELEASE_ENABLED and len(sys.argv)==3 and sys.argv[2]in('prepare','build','deploy','readback'));run=g.run_id(sys.argv[1]);action=sys.argv[2];operator=Operator(run)
 try:value=getattr(operator,action)()
 except Exception:value={'result':'unconfirmed','safe_error_code':'LOGO_FAILURE_TRACE_WEB_UNCONFIRMED','automatic_retry':False,'claim_retained':True}
 result=public(value);result.update(run_id=run,action=action,observed_at=stamp(),project_id=g.PROJECT,team_id=g.TEAM,credentials_or_raw_cli_persisted=False)
 folder=ROOT/'tracking/evidence/m07/logo-failure-trace-web-release';folder.mkdir(parents=True,exist_ok=True);path=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+run+'-'+action+'.json')
 with path.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(result,sort_keys=True,indent=2)+'\n')
 print(json.dumps({'result':value['result'],'receipt':path.relative_to(ROOT).as_posix()}));g.need(value['result']in('prepared','passed','submitted','observed_ready'))
if __name__=='__main__':
 try:main()
 except Exception:print('LOGO_FAILURE_TRACE_WEB_UNCONFIRMED',file=sys.stderr);sys.exit(1)
