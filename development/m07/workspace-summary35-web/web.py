"""Source-only compatible Summary35 web wrapper; main is root-only and disabled."""
from pathlib import Path
import copy,datetime,hashlib,importlib.util,json,os,re,sys,uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
LEGACY=ROOT/'development/m03/english-web-release34/web.py';LEGACY_SHA='51453cae704ed3a59dfc7fe58c9f86ccdeea951f77b911b72e2cea4b33f60cc1'
def need(value):
 if not value:raise ValueError('SUMMARY35_WEB_UNCONFIRMED')
def sha(raw):return hashlib.sha256(raw).hexdigest()
need(sha(LEGACY.read_bytes())==LEGACY_SHA)
spec=importlib.util.spec_from_file_location('summary35_frozen_web',LEGACY);old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
PRIVATE=ROOT/'.local/m07-workspace-summary35-web';PLAN=PRIVATE/'plan.json';INSPECT=PRIVATE/'provider-before.json'
BUILD_CLAIM=PRIVATE/'build.claim.json';BUILD=PRIVATE/'build.json';CLAIM=PRIVATE/'deploy.claim.json';RETURNED=PRIVATE/'deploy.returned.json'
ADMISSION=PRIVATE/'canonical-admission.json'
DEPLOY_ENABLED=True;CURRENT='dpl_5vEMBfsnD23cGL3ontWm8AUAErKr'
STAGE_SHA='2aaf2e6885cd77b7ee6bc77c20fe28d39fc2bb14bd75307e54eb930abc45ecd4'
CLI_HELPERS={
 'chunks/chunk-2PYFJXKS.js':'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b'}
NPM=old.NODE.parent/'node_modules/npm/bin/npm-cli.js';NPM_SHA='3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e'
CANONICAL_HELPER='development/m07/workspace-summary35-release/release.py'
REQUIRED=old.REQUIRED|{'packages/domain/src/workspace-summary.ts','apps/web/lib/workspace-summary-http.ts',
 'packages/central/src/studio.ts','apps/web/lib/mcp.ts','apps/web/app/api/v1/[...segments]/route.ts','contracts/mcp-tool-catalog.json'}
old.REQUIRED=REQUIRED
SETTINGS=['framework','rootDirectory','nodeVersion','sourceFilesOutsideRootDirectory','buildCommand','installCommand','outputDirectory','devCommand','createdAt']
def exclusive(path,value):old.exclusive(path,value)
def digest(value):return sha(json.dumps(value,sort_keys=True,separators=(',',':')).encode())
def source_pins():
 need(sha(old.load(LEGACY))==LEGACY_SHA and sha(old.load(old.STAGE))==STAGE_SHA and sha(old.load(NPM))==NPM_SHA)
 need(json.loads(old.load(NPM.parent.parent/'package.json'))['version']=='11.16.0')
 for path,digest_value in CLI_HELPERS.items():need(sha(old.load(old.CLI.parent/path))==digest_value)
 old.tool_pins()
 return {**old.helpers(),**{str(p.relative_to(ROOT).as_posix()):sha(old.load(p))for p in [LEGACY,Path(__file__),HERE/'test_web.py',HERE/'README.md',HERE/'inputs.template.json']},
  **{'cli_helper:'+path:digest_value for path,digest_value in CLI_HELPERS.items()},'npm_cli_sha256':NPM_SHA}
def public_environment(value):
 fixed={'EPS_RELEASE_MODE':'controlled_pilot','APP_ENV':'staging','APP_BASE_URL':'https://'+old.ALIAS,'CENTRAL_ADAPTER_MODE':'supabase',
  'NODE_ENV':'production','EPS_PILOT_OWNER_CONTROLLED':'true','SUPABASE_URL':'https://pyibofyctwnqpvktepse.supabase.co'}
 need(type(value)is dict and set(value)==set(fixed)|{'SUPABASE_PUBLISHABLE_KEY'}and all(value.get(k)==v for k,v in fixed.items()))
 need(type(value['SUPABASE_PUBLISHABLE_KEY'])is str and len(value['SUPABASE_PUBLISHABLE_KEY'])<=4096 and re.fullmatch('sb_publishable_[A-Za-z0-9_-]{8,}',value['SUPABASE_PUBLISHABLE_KEY']))
 return copy.deepcopy(value)
def public_plan_receipt(value,plan_sha):
 public=public_environment(value['public_build_environment'])
 return {'run_id':value['run_id'],'source':value['source'],'plan_sha256':plan_sha,'source_pins':value['source_pins'],
  'public_environment_keys':sorted(public),'public_environment_sha256':digest(public),'publishable_key_present':True,'environment_values_persisted':False,'deployed':False}
def build_environment(public,folder):
 value={k:os.environ[k]for k in ['PATH','SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG']if k in os.environ}
 value.update(public_environment(public));value.update({'CI':'1','VERCEL_TELEMETRY_DISABLED':'1','VERCEL_CLI_USE_NATIVE_BINARY':'0',
  'NPM_CONFIG_USERCONFIG':str(folder/'empty-npmrc'),'NPM_CONFIG_GLOBALCONFIG':str(folder/'empty-global-npmrc')});return value
def environment_rows(value):
 need(type(value)is dict and type(value.get('envs'))is list and 1<=len(value['envs'])<=200 and(value.get('pagination')is None or value['pagination'].get('next')is None))
 rows=[];ids=set();keys=set()
 for row in value['envs']:
  need(type(row)is dict and re.fullmatch('[A-Za-z0-9_-]{1,200}',row.get('id',''))and re.fullmatch('[A-Z][A-Z0-9_]{0,127}',row.get('key','')))
  need(row['id']not in ids and row['key']not in keys and row.get('type')in('plain','sensitive','encrypted','system'));ids.add(row['id']);keys.add(row['key'])
  targets=row.get('target');need(type(targets)is list and targets and len(set(targets))==len(targets)and set(targets)<={'production','preview','development'})
  need(row.get('gitBranch')is None and row.get('customEnvironmentIds',[])==[])
  rows.append({k:copy.deepcopy(row.get(k))for k in ['id','key','type','target','createdAt','updatedAt']});rows[-1]['target']=sorted(targets)
 return sorted(rows,key=lambda row:row['key'])
def validate_rows(rows):
 need(type(rows)is list and REQUIRED<={r['path']for r in rows}and len(rows)==len({r['path']for r in rows}))
 for row in rows:
  path=row['path'];need(type(path)is str and not path.startswith('/')and '..'not in path.split('/')and '\\'not in path and ':'not in path)
  need(not re.search(r'(?:^|/)(?:\.env[^/]*|\.local|\.git|Screenshots|redesign-output|node_modules|\.next[^/]*)(?:/|$)',path))
  need(set(row)=={'path','bytes','sha256'}and type(row['bytes'])is int and 0<=row['bytes']<8*1024*1024 and re.fullmatch('[a-f0-9]{64}',row['sha256']))
def reference(value):
 need(type(value)is dict and set(value)=={'path','sha256'});actual,doc=old.reference(value['path']);need(actual==value);return doc
def sealed_source_files(folder):
 need(folder.is_dir()and folder.resolve()==folder and not folder.is_symlink()and not folder.is_junction())
 files=[];pending=[folder];seen=0
 while pending:
  directory=pending.pop()
  for entry in directory.iterdir():
   seen+=1;need(seen<=5000 and not entry.is_symlink()and not entry.is_junction()and entry.resolve()==entry and entry.resolve().is_relative_to(folder))
   if entry.is_dir():pending.append(entry)
   else:need(entry.is_file());files.append(entry.relative_to(folder).as_posix())
 return sorted(files)
def stage(plan):
 report=reference(plan['source']);validate_rows(report['files']);need(report['files']==old.source_rows())
 need(report['result']=='passed'and report['project_id']==old.PROJECT and report['team_id']==old.TEAM and report['origin']=='https://'+old.ALIAS)
 need(report['source_stable']is True and report['private_input_stable']is True and report['private_hits']==0 and report['deployed']is False and report['harness_sha256']==STAGE_SHA)
 need(report['entries']==len(report['files'])and 100<len(report['files'])<1000)
 need(re.fullmatch(r'\.local/m07-pilot/web-source-[A-Za-z0-9TZ.-]+-[a-f0-9]{8}',report['source_root']))
 folder=ROOT/report['source_root'];need(folder.is_dir()and folder.resolve()==folder and not folder.is_symlink())
 for row in report['files']:need(len(old.load(folder/row['path']))==row['bytes']and sha(old.load(folder/row['path']))==row['sha256'])
 need(json.loads(old.load(folder/'.vercel/project.json'))=={'projectId':old.PROJECT,'orgId':old.TEAM,'projectName':'everyone-presentation-pilot'})
 actual=sealed_source_files(folder);need(actual==sorted([r['path']for r in report['files']]+['.vercel/project.json']))
 return report,folder
def canonical(reference_value,live=False):
 doc=reference(reference_value);need(doc.get('target')=='pyibofyctwnqpvktepse'and doc.get('action')=='apply'and doc.get('result')=='passed')
 need(doc.get('normal_return_marker_observed')is True and doc.get('independent_readback_verified')is True and doc.get('claim_retained')is True and doc['first']==doc['second'])
 path=ROOT/CANONICAL_HELPER;need(sha(old.load(path))==doc['source_pins'][CANONICAL_HELPER])
 spec=importlib.util.spec_from_file_location('summary35_applied_metadata',path);helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
 need(helper.VERSION=='20261031182038'and helper.MIGRATION_SHA=='cbb12610603318bce68ced4a58d0a9a01ee07737838c99a2ea0e6214e5e933e0');helper.check_after(doc['first'],doc['before'])
 need(type(doc.get('static_schema_after'))is dict and doc['static_schema_after']==doc['first']['static_schema']and doc['static_schema_before']==doc['before']['static_schema'])
 if live:need(helper.read_static_state()==doc['static_schema_after'])
 return digest(doc['static_schema_after'])
def api_env():
 endpoint='/v10/projects/'+old.PROJECT+'/env?teamId='+old.TEAM+'&decrypt=false'
 return environment_rows(json.loads(old.command([str(old.NODE),str(old.CLI),'api',endpoint,'--scope',old.SLUG,'--method','GET','--raw','--global-config',old.GLOBAL],True,30)))
def project_settings(value):
 need(value.get('id')==old.PROJECT and value.get('accountId')==old.TEAM and value.get('name')=='everyone-presentation-pilot')
 result={k:copy.deepcopy(value.get(k))for k in SETTINGS};need(result['framework']=='nextjs'and result['rootDirectory']=='apps/web'and result['nodeVersion']=='24.x'and result['sourceFilesOutsideRootDirectory']is True)
 for key in ['buildCommand','installCommand','outputDirectory','devCommand']:need(result[key]is None or type(result[key])is str and len(result[key])<=1000)
 return {'settings':result,'project_link_sha256':digest(value.get('link'))}
def deployment(value):
 result=old.deployment(value);meta=value.get('meta',{})
 for key,target in [('epsSummary35Source','source_sha256'),('epsSummary35Quality','quality_sha256'),('epsSummary35Canonical','canonical_sha256')]:
  marker=meta.get(key);need(marker is None or type(marker)is str and re.fullmatch('[a-f0-9]{64}',marker));result[target]=marker
 return result
def observe():
 return {'project':project_settings(old.api('/v9/projects/'+old.PROJECT+'?teamId='+old.TEAM)),
  'environment':api_env(),'deployment':deployment(old.api('/v13/deployments/'+old.ALIAS+'?teamId='+old.TEAM))}
def plan():
 value=json.loads(old.load(PLAN));need(value['source_pins']==source_pins()and str(uuid.UUID(value['run_id']))==value['run_id']);public_environment(value['public_build_environment']);stage(value);return value
def admission(value,live=False):
 doc=json.loads(old.load(ADMISSION));need(set(doc)=={'plan_sha256','canonical','canonical_schema_sha256','source_pins'}and doc['plan_sha256']==sha(old.load(PLAN))and doc['source_pins']==source_pins())
 need(canonical(doc['canonical'],live)==doc['canonical_schema_sha256']);return doc
def build_root(value):return PRIVATE/value['run_id']/'build'
def build_commands(folder):
 return [str(old.NODE),str(NPM),'ci','--include=dev','--ignore-scripts'],[str(old.NODE),str(NPM),'run','build','--workspace','@eps/web']
def local_command(args,cwd,public,folder):
 previous=old.environment
 try:old.environment=lambda provider=False:build_environment(public,folder);return old.command(args,timeout=900,cwd=cwd)
 finally:old.environment=previous
def quality_output(folder):
 output=folder/'apps/web/.next';need(output.is_dir()and output.resolve()==output and not output.is_symlink())
 raw=old.load(output/'BUILD_ID',1024);need(re.fullmatch(rb'[A-Za-z0-9_-]{1,200}\s*',raw))
 return {'build_id_sha256':sha(raw),'build_id_bytes':len(raw),'hosted_artifact':False,'quality_only':True}
def build_receipt(value):
 doc=json.loads(old.load(BUILD));need(doc['result']=='passed'and doc['plan_sha256']==sha(old.load(PLAN))and doc['source_pins']==source_pins())
 report,_=stage(value);old.validate_stage(report,doc);need(quality_output(build_root(value))==doc['quality_output']and doc['no_prebuilt_acceptance']is True);return doc
def deploy_command(source_folder,source_hash,quality_hash,canonical_hash):
 return [str(old.NODE),str(old.CLI),'deploy',str(source_folder),'--prod','--yes','--no-wait','--scope',old.SLUG,'--project',old.PROJECT,
  '--meta','epsSummary35Source='+source_hash,'--meta','epsSummary35Quality='+quality_hash,'--meta','epsSummary35Canonical='+canonical_hash,'--global-config',old.GLOBAL]
def ready(direct,alias,source_hash,quality_hash,canonical_hash):
 need(direct==alias and direct['state']=='READY'and direct['id']!=CURRENT and direct['source_sha256']==source_hash and direct['quality_sha256']==quality_hash and direct['canonical_sha256']==canonical_hash);return direct
def save(action,value):
 path=ROOT/'tracking/evidence/m07/workspace-summary35-web'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
 exclusive(path,{'schema_version':'1.0','action':action,'project_id':old.PROJECT,'team_id':old.TEAM,'source_only_author':True,'worker_or_oauth_or_environment_mutations':False,
  'deployment_method':'provider_source_build','no_prebuilt_acceptance':True,'raw_cli_or_credentials_persisted':False,**value});return path.relative_to(ROOT).as_posix()
def main():
 need(DEPLOY_ENABLED and len(sys.argv)in(2,3));action=sys.argv[1]
 if action=='prepare':
  need(len(sys.argv)==3 and not PLAN.exists());inputs=json.loads(old.load(Path(sys.argv[2]).resolve()));need(set(inputs)=={'source_receipt','public_build_environment'})
  value={'run_id':str(uuid.uuid4()),'source':inputs['source_receipt'],'public_build_environment':public_environment(inputs['public_build_environment']),'source_pins':source_pins()};stage(value);exclusive(PLAN,value)
  print(json.dumps({'result':'prepared','receipt':save('prepare',public_plan_receipt(value,sha(old.load(PLAN))))}));return
 value=plan();report,source=stage(value);folder=build_root(value)
 if action=='bind-canonical':
  need(len(sys.argv)==3 and not ADMISSION.exists()and not CLAIM.exists());build_receipt(value);ref=json.loads(old.load(Path(sys.argv[2]).resolve()));state=canonical(ref,True)
  exclusive(ADMISSION,{'plan_sha256':sha(old.load(PLAN)),'canonical':ref,'canonical_schema_sha256':state,'source_pins':source_pins()})
  print(json.dumps({'result':'bound','receipt':save('canonical-admission',{'canonical':ref,'canonical_schema_sha256':state,'deployed':False})}));return
 need(len(sys.argv)==2)
 if action=='inspect':
  need(not INSPECT.exists()and not CLAIM.exists());before=observe();need(before['deployment']['id']==CURRENT and before['deployment']['state']=='READY'and observe()==before);exclusive(INSPECT,before)
  print(json.dumps({'result':'passed','receipt':save('inspect',{'before':before,'deployed':False})}));return
 before=json.loads(old.load(INSPECT))
 if action=='build':
  need(not BUILD_CLAIM.exists()and not BUILD.exists()and observe()==before and folder.resolve()==folder and not folder.exists());exclusive(BUILD_CLAIM,{'plan_sha256':sha(old.load(PLAN)),'source_pins':source_pins(),'dispatch_may_have_occurred':True,'automatic_retry':False});folder.mkdir(parents=True,exist_ok=False);need(folder.resolve()==folder and not folder.is_symlink())
  for row in report['files']:
   target=folder/row['path'];target.parent.mkdir(parents=True,exist_ok=True);raw=old.load(source/row['path']);need(sha(raw)==row['sha256'])
   with target.open('xb')as stream:stream.write(raw)
  for name in ['empty-npmrc','empty-global-npmrc']:(folder/name).write_text('',encoding='utf8')
  install,build=build_commands(folder);local_command(install,folder,value['public_build_environment'],folder);local_command(build,folder,value['public_build_environment'],folder)
  generated=[]
  for row in report['files']:
   actual=sha(old.load(folder/row['path']))
   if actual!=row['sha256']:
    need(row['path']=='apps/web/next-env.d.ts');generated.append({'path':row['path'],'staged_sha256':row['sha256'],'framework_sha256':actual})
  project=folder/'apps/web';need(all(not list(base.glob('.env*'))for base in [folder,folder/'.vercel',project,project/'.vercel'])and observe()==before and plan()==value)
  doc={'result':'passed','action':'build','files':report['files'],'source_sha256':digest(report['files']),'quality_output':quality_output(folder),
   'framework_generated_deltas':generated,'plan_sha256':sha(old.load(PLAN)),'source_pins':source_pins(),'isolated':True,'private_environment_transferred':False,'exit_code':0,'no_prebuilt_acceptance':True};exclusive(BUILD,doc)
  print(json.dumps({'result':'passed','receipt':save('build',doc)}));return
 doc=build_receipt(value)
 if action=='deploy':
  need(not CLAIM.exists()and not RETURNED.exists()and observe()==before);bound=admission(value,True)
  exclusive(CLAIM,{'plan_sha256':sha(old.load(PLAN)),'build_sha256':sha(old.load(BUILD)),'canonical_admission_sha256':sha(old.load(ADMISSION)),'source_pins':source_pins(),'before':before,'dispatch_may_have_occurred':True,'automatic_retry':False})
  need(plan()==value and build_receipt(value)==doc and observe()==before and admission(value,True)==bound)
  raw=old.command(deploy_command(source,doc['source_sha256'],sha(old.load(BUILD)),bound['canonical']['sha256']),True,60)
  url=old.deployment_url(raw);exclusive(RETURNED,{'claim_sha256':sha(old.load(CLAIM)),'url':url,'process_returned':True});print(json.dumps({'result':'submitted','url':url,'claim_retained':True,'ready_verified':False}));return
 need(action=='readback');bound=admission(value,True);claim=json.loads(old.load(CLAIM));returned=json.loads(old.load(RETURNED));need(claim['plan_sha256']==sha(old.load(PLAN))and claim['build_sha256']==sha(old.load(BUILD))and claim['canonical_admission_sha256']==sha(old.load(ADMISSION))and claim['source_pins']==source_pins()and returned['claim_sha256']==sha(old.load(CLAIM))and returned['process_returned']is True)
 url=returned['url'];need(old.deployment_url(url)==url);current=observe();direct=deployment(old.api('/v13/deployments/'+url.removeprefix('https://')+'?teamId='+old.TEAM))
 ready(direct,current['deployment'],doc['source_sha256'],sha(old.load(BUILD)),bound['canonical']['sha256']);need(current['project']==before['project']and current['environment']==before['environment']);admission(value,True)
 need(observe()==current and plan()==value and build_receipt(value)==doc)
 print(json.dumps({'result':'passed','receipt':save('ready',{'deployment':direct,'stable_alias_matches':True,'environment_ids_targets_preserved':True,'project_settings_link_preserved':True,'canonical35_preserved':True,'claim_retained':True,'application_acceptance':False})}))
if __name__=='__main__':
 try:main()
 except Exception:print('SUMMARY35_WEB_UNCONFIRMED');sys.exit(1)
