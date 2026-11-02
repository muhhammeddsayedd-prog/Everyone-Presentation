"""New normal-CLI adapters. No dispatch at import; controller is default-off."""
from pathlib import Path
import datetime,hashlib,importlib.util,json,os,re,subprocess,time,uuid
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v);return v
s=module('completion39_provider_state',HERE/'state.py');e=module('completion39_provider_environment',HERE/'environment.py');need=s.need
RUN='67305390-0d94-4896-b924-e11229400bb8'
PRIVATE=s.MAIN/'.local/completion-worker-production39'/RUN
PROJECT=e.PROJECT;TEAM=e.TEAM
REGISTRY=s.ROOT/'development/m07/completion-worker/registry.py';REGISTRY_SHA='809561e1585f164bba92363a9fb854fc55d1efc4f1d6343acc461c3ae3fbd50c'
RUNTIME=s.MAIN/'development/m07/controlled-pilot/daemon-runtime.mjs';RUNTIME_SHA='528072b8e21ee0dfe79911a42ceeffeaf43b631688f16c0c6ddf5ce025b86263'
EMITTER=s.MAIN/'tools/worker-hosting-build.mjs';EMITTER_SHA='3f27ca1bf039579905763365c592b4d6e94754437753a3f645c4bad85e7bcb69'
OBSERVER=s.MAIN/'development/m07/production-worker-startup-observer/observe.py'
CHECKPOINT_SHA='273ad36c1b65177b63780162b82892e131eb095ace9ff2b49d824d82335fe518'
OUTPUT=s.MAIN/'.local/worker-hosting/8b559ebe-1b6c-4741-b371-9498c5855976/deployment'
CLI_PINS={'commands/deploy/index.js':'87147e9eda4f3f43f156a93b54b157ac356f7108a196027692120efb71c40ee2','commands-routing.js':'1314ff6bb482b556ac540e12bf87d899b15e2e30ed1c907e54d5b664dea5ba90','commands-deployments.js':'5309d52278f46cf3cd7764690873038b4054c0b702ff885b9878a67ee6ff218a','chunks/chunk-CJHVHB2F.js':'c9301bc282bed45b0d8b127bf70cbc951c9d2ccf00be71289b331560445d03a0','chunks/chunk-OLAG7Y3P.js':'96356f41ba1d0a364761c04470e831dea6365ca51744f19d4dc710c728927b52','chunks/chunk-2PYFJXKS.js':'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b','chunks/chunk-YIOT5B5Z.js':'36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661','chunks/chunk-QZEZCUUZ.js':'d81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a'}
REFS={
 'native_admitted':('completion-native/2026-11-01T23-55-native-admission.json','cf00f0e11fc07625b8c932f9fc963721525ce0efa6156734033bd0e16a5ea84a'),
 'native_ready':('completion-worker/2026-11-01T23-38-34-463049Z-native-registry-ready.json','9c5c6ed9f6cf74df71dd60981666fd03b5849b4ce8ca15358d308f455d1e2742'),
 'daemon_copy':('completion-worker/2026-11-01T23-56-52-879008Z-daemon-registry-continuation-copy.json','b9e1455e369678b14925cf28002dbcab9347c0b9eaf7b4d7829a6be289c37382'),
 'daemon_ready':('completion-worker/2026-11-01T23-58-24-466619Z-daemon-registry-continuation-ready.json','26b8881b8ca07f877788ffffeac9886e286eb9024903177882da74e0a4845d15')}
def bindings():return {'source_sha256':s.SOURCE,'native_digest':s.NATIVE,'daemon_digest':s.DAEMON,'manifest_sha256':s.MANIFEST}
def meta(marker):
 need(str(uuid.UUID(marker))==marker)
 return {'epsCompletionSource':s.SOURCE,'epsCompletionNative':s.NATIVE,'epsCompletionDaemon':s.DAEMON,'epsCompletionManifest':s.MANIFEST,'epsCompletionRun':marker}

def check_native_concurrency(value,sql_contract):
 need(value['result']=='passed'and value['cloud_called']is False and value['provider_called']is False and value['sql_contract_sha256']==sql_contract)
 need(all(value[k]is True for k in('cached_intake_waited_before_snapshot','fresh_intake_denied_after_pause','retry_lifecycle_not_hidden_by_pause','committed_intake_visible_to_first_snapshot','committed_intake_preimage_refused_before_updates','actual_committed_intake_job_preserved','all_other_cloned_rows_preserved','all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released')))
 need(value['all_five_actual_config_locks_held']=={'config_access_exclusive':5})
 pids=value['distinct_backend_pids'];need(type(pids)is list and len(pids)==6 and all(type(pid)is int and pid>0 for pid in pids)and len(set(pids))==6)
 checked=value['checkpoint_query_validation'];need(checked['query_sha256']==CHECKPOINT_SHA and checked['application_tables']==76 and checked['same_state_before_after']is True and checked['table_counts_match_state']is True and checked['history_count']==39 and checked['raw_rows_persisted']is False and checked['maximum_capture_bytes']==32*1024**2 and checked['owned_session_authorization']=='postgres'and type(checked['stdout_bytes'])is int and 0<checked['stdout_bytes']<=32*1024**2)

class Provider:
 def __init__(self):
  need(s.sha(s.load(REGISTRY))==REGISTRY_SHA);self.r=module('completion39_existing_bounded_transport',REGISTRY)
  self.s=s.State();self.e=e;self.inputs=json.loads(s.load(HERE/'inputs.json'))
  expected=self.inputs['startup_observer_sha256'];need(type(expected)is str and re.fullmatch('[a-f0-9]{64}',expected)and s.sha(s.load(OBSERVER))==expected)
  self.observer=module('completion39_new_data_only_startup_observer',OBSERVER)
 def pins(self):
  pins={**self.s.source_pins(),**self.r.sources()}
  checkpoint=self.checkpoint_sql().encode();need(s.sha(checkpoint)==CHECKPOINT_SHA and s.load(HERE/'checkpoint-query.sql')==checkpoint)
  for file,digest in[(RUNTIME,RUNTIME_SHA),(EMITTER,EMITTER_SHA)]:need(s.sha(s.load(file))==digest);pins[str(file)]=digest
  need(s.sha(s.load(OBSERVER))==self.inputs['startup_observer_sha256']);pins.update({str(s.MAIN/key):value for key,value in self.observer.pins().items()})
  for name,digest in CLI_PINS.items():file=self.r.CLI.parent/name;need(s.sha(s.load(file))==digest);pins[str(file)]=digest
  return pins
 def _ensure(self):
  owner={'owner':'eps-completion-worker-production39','run':RUN,'project':PROJECT,'team':TEAM,'target':s.TARGET,'source_sha256':s.SOURCE}
  if not PRIVATE.exists():
   PRIVATE.mkdir(parents=True,exist_ok=False);need(PRIVATE.resolve()==PRIVATE and not PRIVATE.is_symlink());self._create(PRIVATE/'owner.json',owner)
  else:need(PRIVATE.resolve()==PRIVATE and not PRIVATE.is_symlink()and self.read('owner.json')==owner)
 def _create(self,file,value):
  need(file.parent==PRIVATE and not file.exists());raw=value if type(value)is bytes else(json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'))+'\n').encode();guard=self.r.helpers().private_security()
  with guard.create(file)as stream:guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
 def exists(self,name):need(re.fullmatch('[A-Za-z0-9_.-]+',name));return(PRIVATE/name).exists()
 def write(self,name,value):self._ensure();need(re.fullmatch('[A-Za-z0-9_.-]+',name));self._create(PRIVATE/name,value)
 def read(self,name):
  need(re.fullmatch('[A-Za-z0-9_.-]+',name));file=PRIVATE/name;self.r.helpers().private_security().verify(file);return json.loads(s.load(file))
 def hash(self,name):self.r.helpers().private_security().verify(PRIVATE/name);return s.sha(s.load(PRIVATE/name))
 def run(self,args,timeout=45):return self.r.checked_response(self.r.run(args,timeout))
 def api(self,method,endpoint,body=None,header=None):
  env_create='/v10/projects/'+PROJECT+'/env?teamId='+TEAM
  env_meta=env_create+'&decrypt=false'
  get_values=re.fullmatch('/v1/projects/'+PROJECT+r'/env/[A-Za-z0-9_-]{1,128}\?teamId='+TEAM,endpoint)
  patch_values=re.fullmatch('/v9/projects/'+PROJECT+r'/env/[A-Za-z0-9_-]{1,128}\?teamId='+TEAM,endpoint)
  get_deployment=re.fullmatch(r'/v13/deployments/(?:dpl_[A-Za-z0-9]{10,80}|everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app)\?teamId='+TEAM,endpoint)
  registry={url for key,url in self.r.API.items()if key in('repository','daemon_repository','images')}
  registry.add('/v1/vcr/repository/'+self.r.DAEMON_REPO+'/images?projectId='+PROJECT+'&teamId='+TEAM+'&limit=50')
  deployment_list='/v7/deployments?projectId='+PROJECT+'&target=production&limit=20&teamId='+TEAM
  need((method=='GET'and body is None and header is None and(endpoint in registry or endpoint==env_meta or endpoint==deployment_list or endpoint=='/v9/projects/'+PROJECT+'?teamId='+TEAM or get_values or get_deployment))
   or(method=='PATCH'and patch_values and type(body)is dict and set(body)=={'value'}and type(body['value'])is str and len(body['value'])<=4096 and header is None)
   or(method=='POST'and endpoint==env_create and body=={'key':'APP_ENV','value':'production','type':'plain','target':['production']}and header is None)
   or(method=='POST'and endpoint==self.observer.ENDPOINT and type(body)is dict and header==self.observer.HEADER))
  args=['api',endpoint,'--method',method,'--raw']
  if header is not None:need(method=='POST'and endpoint==self.observer.ENDPOINT and header==self.observer.HEADER);args+=['--header',header]
  if body is not None:
   name='request-'+str(uuid.uuid4())+'.json';self.write(name,body);args+=['--input',str(PRIVATE/name)]
  return json.loads(self.run(self.r.cli(args)))
 def query(self,sql,*,checkpoint=False):
  need((s.MAIN/'supabase/.temp/project-ref').read_text().strip()==s.TARGET and not any(os.environ.get(key)for key in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD')))
  reader=module('completion39_existing_normal_sql_reader',s.MAIN/'development/m07/oauth-attempt-trace/inspect-attempt.py')
  name='query-'+str(uuid.uuid4())+'.sql';self.write(name,sql.encode())
  args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',s.TARGET,'--file',str(PRIVATE/name),'--output-format','json','--workdir',str(s.MAIN)]
  if checkpoint:
   capture=module('completion39_checkpoint_only_capture',HERE/'capture.py');code,timeout,overflow,out,_=capture.bounded_checkpoint(args,reader.environment(),cwd=s.MAIN)
  else:code,timeout,overflow,out,_=reader.bounded(args,reader.environment())
  need(code==0 and not timeout and not overflow)
  value=json.loads(out);rows=value if type(value)is list else value.get('rows')if type(value)is dict else None
  need(type(rows)is list and len(rows)==1 and set(rows[0])=={'completion39_rollout'});return rows[0]['completion39_rollout']
 def snapshot(self):
  value=self.query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='30s';"+self.s.state_sql()+" as completion39_rollout;rollback;");return self.s.check(value)
 def checkpoint_sql(self):
  tables=sorted(set(self.s.b.TABLES)|{'job_stage_attempts','project_creation_intents'});terms=[]
  for table in tables:
   relation=table if table.startswith('public.')else'eps.'+table
   terms+=[self.s.b.literal(table),"(select coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]'::jsonb)from "+relation+' t)']
  # jsonb_build_object accepts at most100 arguments (50 key/value pairs).
  data='('+'||'.join('jsonb_build_object('+','.join(terms[index:index+100])+')'for index in range(0,len(terms),100))+')'
  expression="select jsonb_build_object('state',("+self.s.state_sql()+"),'application_tables',"+data+",'catalogue',(select catalog from("+self.s.c.catalogue+")c))"
  return "begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='60s';"+expression+" as completion39_rollout;rollback;"
 def schema_capsule(self):
  capsule_bytes=s.load(s.MAIN/self.s.m.BACKUP);capsule=json.loads(capsule_bytes)
  relative=Path(capsule['protected_file']);need(not relative.is_absolute()and relative.parts[:2]==('.local','completion-release')and'..'not in relative.parts and capsule['result']=='passed'and capsule['history_count']==38)
  capsule_file=s.MAIN/relative;self.r.helpers().private_security().verify(capsule_file);need(s.sha(s.load(capsule_file))==capsule['sha256'])
  return {'schema38_capsule_receipt':{'path':self.s.m.BACKUP,'sha256':s.sha(capsule_bytes)},'additive39_migration_sha256':self.s.c.migration_sha}
 def checkpoint(self,before):
  schema=self.schema_capsule()
  tables=sorted(set(self.s.b.TABLES)|{'job_stage_attempts','project_creation_intents'})
  value=self.query(self.checkpoint_sql(),checkpoint=True)
  need(value['state']==before and set(value['application_tables'])==set(tables)and len(tables)==76)
  self.write('canonical39-checkpoint.json',value)
  return {'protected_file':(PRIVATE/'canonical39-checkpoint.json').relative_to(s.MAIN).as_posix(),'sha256':self.hash('canonical39-checkpoint.json'),'history_count':39,'tables':76,
   **schema,
   'same_transaction_state_bound':True,'managed_auth_and_storage_bytes_included':False,'private_runtime_configuration_included':False,'restore_verified':False}
 def environment(self):
  rows=e.metadata(self.api('GET','/v10/projects/'+PROJECT+'/env?teamId='+TEAM+'&decrypt=false'));values={}
  for key in e.PUBLIC:
   row=e.selected(rows,key,key not in('APP_ENV','EPS_PILOT_EXPIRES_AT','EPS_PILOT_OWNER_CONTROLLED'))
   if row is None:continue
   item=self.api('GET','/v1/projects/'+PROJECT+'/env/'+row['id']+'?teamId='+TEAM);need(item.get('id')==row['id']and item.get('key')==key and type(item.get('value'))is str);values[key]=item['value']
  return e.projection(rows,values)
 def update_environment(self,action):
  need(action['key']in e.EDITABLE)
  endpoint=('/v9/projects/'+PROJECT+'/env/'+action['id']if action['method']=='PATCH'else'/v10/projects/'+PROJECT+'/env')+'?teamId='+TEAM
  result=self.api(action['method'],endpoint,action['body']);need(type(result)is dict and 'error'not in result and 'errors'not in result)
  if action['method']=='POST':need(result.get('failed')==[]and type(result.get('created'))is dict);item=result['created']
  else:item=result
  need(type(item.get('id'))is str and re.fullmatch('[A-Za-z0-9_-]{1,128}',item['id'])and item.get('key')==action['key']and item.get('type')=='plain'and item.get('target')==['production']and item.get('gitBranch')is None and item.get('value')==action['body']['value'])
  if action['method']=='PATCH':need(item['id']==action['id'])
  return {'normal_return_observed':True,'response_id':item['id']}
 def env_proof(self,parent):
  current=parent['before']
  for index,action in enumerate(parent['actions']):
   name='env-'+str(index);claim=self.read(name+'.claim.json');returned=self.read(name+'.normal.json')
   need(claim['pins']==self.pins()and claim['before']==current and claim['action']==action and claim['parent_claim_sha256']==self.hash('env.claim.json')and returned['claim_sha256']==self.hash(name+'.claim.json')and returned['normal_return_observed']is True)
   # A future stage's before-image preserves the prior stage's postcondition.
   after=self.read('env-'+str(index+1)+'.claim.json')['before']if index+1<len(parent['actions'])else self.environment();e.preserved(current,after,action);need(returned['value']['response_id']==after['ids'][action['key']]);current=after
  one,two=self.environment(),self.environment();need(one==two==current);e.production(one);return one
 def reconcile_environment(self,parent):
  one,two=self.environment(),self.environment();need(one==two);current=parent['before'];prefix=0;normal_count=0
  for index,action in enumerate(parent['actions']):
   if current==one:break
   name='env-'+str(index);claim=self.read(name+'.claim.json');need(claim['pins']==self.pins()and claim['before']==current and claim['action']==action and claim['parent_claim_sha256']==self.hash('env.claim.json'))
   after=self.read('env-'+str(index+1)+'.claim.json')['before']if self.exists('env-'+str(index+1)+'.claim.json')else one;e.preserved(current,after,action)
   if self.exists(name+'.normal.json'):
    returned=self.read(name+'.normal.json');need(returned['normal_return_observed']is True and returned['claim_sha256']==self.hash(name+'.claim.json')and returned['value']['response_id']==after['ids'][action['key']]);normal_count+=1
   prefix+=1;current=after
  need(current==one)
  return {'applied_prefix':prefix,'normal_per_key_returns_observed':normal_count,'all_actions_observed':prefix==len(parent['actions']),'environment_sha256':s.sha(json.dumps(one,sort_keys=True).encode()),'normal_returns_not_synthesized':True}
 def js(self,kind,payload):
  need(kind in('daemon','native'));file=RUNTIME if kind=='daemon'else s.ROOT/'development/m07/completion-native/admit-native-probe.mjs'
  program="import fs from'node:fs';const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const m=await import("+json.dumps(file.as_uri())+");process.stdout.write(JSON.stringify("+('m.projectDaemon(p.value,p.deployment)'if kind=='daemon'else'm.admitNativeProbe(p.receipt,p.plan)')+"));"
  name='project-'+str(uuid.uuid4())+'.json';self.write(name,(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n').encode());return json.loads(self.run([str(self.r.NODE),'--input-type=module','-e',program,str(PRIVATE/name)]))
 def inspect(self,deployment):return self.js('daemon',{'value':json.loads(self.run(self.r.cli(['daemons','inspect','worker','--project',PROJECT,'--json']))),'deployment':deployment})
 def healthy(self,value,deployment,digest):
  now=int(time.time()*1000);need(value['project_id']==PROJECT and value['team_id']==TEAM and value['daemon']=='worker'and value['deployment_id']==deployment and value['environment']=='production'and value['status']=='ready'
   and value['requested_image']['digest']==value['resolved_image']['digest']==digest and value['configured_instances']=={'dub1':1}and value['configured_override']is None and value['memory_mib']==2048 and value['termination_grace_seconds']==300
   and value['desired']==value['ready']==value['total']==1 and len(value['instances'])==1)
  row=value['instances'][0];need(row['alive']is True and row['image']['digest']==digest and row['region']=='dub1'and row['memory_mib']==2048 and row['stopped_at_ms']is None and type(row['started_at_ms'])is int and 0<row['started_at_ms']<=row['last_checked_at_ms']and now-60000<=row['last_checked_at_ms']<=now+60000)
  return {'instance_id':row['id'],'id':row['id'],'started_at_ms':row['started_at_ms'],'deployment_id':deployment,'digest':digest}
 def old_ready(self):return self.healthy(self.inspect(s.OLD_DEPLOYMENT),s.OLD_DEPLOYMENT,s.OLD_DAEMON)
 def inventory(self):
  value=json.loads(self.run(self.r.cli(['daemons','instances','ls','--project',PROJECT,'--json'])));need(type(value)is dict and set(value)=={'instances'}and type(value['instances'])is list and len(value['instances'])<=4)
  ids=[]
  for row in value['instances']:need(row.get('daemon')=='worker'and re.fullmatch('dmni_[0-9a-hjkmnp-tv-z]{26}',row.get('id','')));ids.append(row['id'])
  need(len(ids)==len(set(ids)));return sorted(ids)
 def old_matches(self,expected):
  first,second=self.old_ready(),self.old_ready();need(first==second==expected and self.inventory()==[expected['instance_id']])
 def output(self):
  need(OUTPUT.resolve()==OUTPUT and not OUTPUT.is_symlink())
  expected={'.vercel/output/config.json':{'version':3,'daemons':{'worker':{}}},'.vercel/output/daemons/worker/.vc-config.json':{'runtime':'container','image':self.r.b.PREFIX+'daemon@'+s.DAEMON,'instances':{'dub1':1},'resources':{'requests':{'memory':'2Gi'}},'terminationGracePeriodSeconds':300},'.vercel/project.json':{'projectId':PROJECT,'orgId':TEAM,'projectName':'everyone-presentation-worker-pilot'}}
  project=OUTPUT/'.vercel/project.json'
  if not project.exists():self.r.b.exclusive(project,expected['.vercel/project.json'])
  actual=[];result=[]
  for file in OUTPUT.rglob('*'):
   need(not file.is_symlink()and file.resolve().is_relative_to(OUTPUT))
   if file.is_file():actual.append(file.relative_to(OUTPUT).as_posix())
  need(set(actual)==set(expected))
  for name,value in expected.items():raw=s.load(OUTPUT/name);need(json.loads(raw)==value);result.append({'path':name,'sha256':s.sha(raw),'bytes':len(raw)})
  return result
 def admission(self,phase):
  need(self.observer.OBSERVE_ENABLED is True);refs={};docs={}
  for key,(relative,digest)in REFS.items():
   file=s.ROOT/'tracking/evidence/m07'/relative;raw=s.load(file);need(s.sha(raw)==digest);refs[key]={'path':file.relative_to(s.ROOT).as_posix(),'sha256':digest};docs[key]=json.loads(raw)
  admitted=docs['native_admitted'];receipt=json.loads(s.load(s.ROOT/admitted['actual_receipt']['path']));plan=json.loads(s.load(s.ROOT/admitted['execution_plan']['path']))
  need(s.sha(s.load(s.ROOT/admitted['actual_receipt']['path']))==admitted['actual_receipt']['sha256']and s.sha(s.load(s.ROOT/admitted['execution_plan']['path']))==admitted['execution_plan']['sha256']);proof=self.js('native',{'receipt':receipt,'plan':plan});need(proof==admitted['admitted'])
  need(docs['daemon_copy']['result']=='passed'and docs['daemon_copy']['normal_copy_return_observed']is True and docs['daemon_ready']['result']=='observed'and docs['daemon_ready']['image']['runtime_digest']==s.DAEMON)
  exported,export_ref=self.r.exported('daemon');need(exported['source_sha256']==s.SOURCE and exported['runtime_digest']==s.DAEMON and exported['source']['manifest_sha256']==s.MANIFEST and exported['production_import_gate']=={'completed':True,'build_exit_code':0,'cached':False,'step':'#22','user':'1000:1000','network':'none'})
  # Exact fresh repository/image reads supplement immutable upload receipts.
  self.r.helpers().project_ready(self.api('GET',self.r.API['repository']),self.api('GET',self.r.API['images']),s.NATIVE)
  daemon_repo=self.api('GET',self.r.API['daemon_repository']);self.r.helpers().repository_metadata(daemon_repo,self.r.DAEMON_REPO,'daemon')
  images=self.api('GET','/v1/vcr/repository/'+self.r.DAEMON_REPO+'/images?projectId='+PROJECT+'&teamId='+TEAM+'&limit=50');need(type(images.get('images'))is list and len(images['images'])<=50)
  found=[row for row in images['images']if row.get('manifestDigest')==s.DAEMON];need(len(found)==1 and found[0].get('repositoryId')==self.r.DAEMON_REPO and found[0].get('kind')=='manifest'and found[0].get('status')=='ready'and found[0].get('arch')=='amd64'and found[0].get('platform')=='linux')
  need(self.r.b.context('daemon')['source_sha256']==s.SOURCE)
  if phase in('pause','deploy'):
   ref=self.inputs['native_concurrency'];need(type(ref)is dict and set(ref)=={'path','sha256'}and ref['path'].startswith('tracking/evidence/')and'..'not in Path(ref['path']).parts)
   raw=s.load(s.MAIN/ref['path']);need(s.sha(raw)==ref['sha256']);value=json.loads(raw)
   check_native_concurrency(value,self.s.sql_contract_sha256());refs['native_concurrency']=ref
  return {'references':refs,'source_sha256':s.SOURCE,'native_digest':s.NATIVE,'daemon_digest':s.DAEMON,'manifest_sha256':s.MANIFEST,'daemon_import':export_ref,'native_cleanup_confirmed':True,'actual_AT069_or_queued_replacement_claimed':False}
 def before_pause_availability(self,plan):
  need(self.environment()==plan['environment']);self.old_matches(plan['old']);self.write('forward-availability.json',{'pins':self.pins(),'plan_sha256':self.hash('plan.json'),'old':plan['old'],'deploy_claim_must_be_absent':True})
 def unwind_environment(self,plan):
  guard=self.read('forward-availability.json');need(guard['pins']==self.pins()and guard['plan_sha256']==self.hash('plan.json')and not self.exists('deploy.claim.json'));self.old_matches(plan['old'])
  one,two=self.environment(),self.environment();need(one==two)
  if one==plan['environment']:return
  parent=self.read('env.claim.json');current=parent['before'];need(current==plan['environment'])
  for index,action in enumerate(parent['actions']):
   claim=self.read('env-'+str(index)+'.claim.json');need(claim['before']==current and claim['action']==action and claim['pins']==self.pins())
   if one['public'].get(action['key'])==action['body']['value']:
    after=self.read('env-'+str(index+1)+'.claim.json')['before']if self.exists('env-'+str(index+1)+'.claim.json')else one;e.preserved(current,after,action);current=after
   if current==one:return
  need(False)
 def deploy(self,marker):
  args=['deploy',str(OUTPUT),'--prebuilt','--prod','--yes','--no-wait','--project',PROJECT]
  for key,value in meta(marker).items():args+=['--meta',key+'='+value]
  raw=self.run(self.r.cli(args),120).decode();urls=set(re.findall(r'https://everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app(?=[\s"\x1b]|$)',raw));need(len(urls)==1);return {'url':next(iter(urls))}
 def deployment_metadata(self,value,marker):
  need(value.get('project',{}).get('id')==PROJECT and value.get('team',{}).get('id')==TEAM and value.get('name')=='everyone-presentation-worker-pilot'and value.get('target')=='production'
   and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',value.get('id',''))and value['id']!=s.OLD_DEPLOYMENT and all(value.get('meta',{}).get(key)==wanted for key,wanted in meta(marker).items()))
  return {'deployment_id':value['id'],'provider_state':value.get('readyState'),'metadata_bound_to_new_claim':True,'worker_ready_or_startup_claimed':False}
 def reconcile_deployment(self,claim,returned):
  if returned:identifier=returned['value']['url'].removeprefix('https://')
  else:
   payload=self.api('GET','/v7/deployments?projectId='+PROJECT+'&target=production&limit=20&teamId='+TEAM)
   need(type(payload.get('deployments'))is list and len(payload['deployments'])<=20 and type(payload.get('pagination'))is dict and'next'in payload['pagination']and payload['pagination']['next']is None)
   found=[row for row in payload['deployments']if all(row.get('meta',{}).get(key)==wanted for key,wanted in meta(claim['marker']).items())];need(len(found)==1)
   identifier=found[0].get('uid',found[0].get('id'));need(type(identifier)is str and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',identifier))
  one=self.deployment_metadata(self.api('GET','/v13/deployments/'+identifier+'?teamId='+TEAM),claim['marker'])
  two=self.deployment_metadata(self.api('GET','/v13/deployments/'+identifier+'?teamId='+TEAM),claim['marker']);need(one==two)
  return {**one,'two_equal_metadata_reads':True,'deployment_resubmitted':False}
 def ready(self,url,marker):
  need(re.fullmatch(r'https://everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app',url))
  value=self.api('GET','/v13/deployments/'+url.removeprefix('https://')+'?teamId='+TEAM)
  self.deployment_metadata(value,marker);need(value.get('readyState')=='READY')
  deployment=value['id'];first,second=self.healthy(self.inspect(deployment),deployment,s.DAEMON),self.healthy(self.inspect(deployment),deployment,s.DAEMON);need(first==second and self.inventory()==[first['instance_id']])
  need(self.observer.OBSERVE_ENABLED is True);scope={'deployment':deployment,'instance':{'id':first['id'],'started_at_ms':first['started_at_ms']},'bindings':bindings()};now=int(time.time()*1000)
  need(now>=first['started_at_ms']+600000);request=self.observer.request(scope);payload=self.api('POST',self.observer.ENDPOINT,request,self.observer.HEADER);startup=self.observer.startup(scope,payload,now)
  need(not(self.r.MAIN/'.local/m07-pilot/native-probe.lock.json').exists());self.old_absent_again(first,deployment)
  return {'new_deployment_ready':True,'old_instances_absent':True,'native_cleanup_confirmed':True,**bindings(),'deployment_id':deployment,'instance_id':first['id'],'startup':startup,'ready_alive_instances':1,'memory_mib':2048,'region':'dub1'}
 def old_absent_again(self,expected,deployment):need(self.healthy(self.inspect(deployment),deployment,s.DAEMON)==expected and self.inventory()==[expected['instance_id']])
 def save(self,action,value):
  file=s.ROOT/'tracking/evidence/m07/completion-worker'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-rollout39-'+action.replace(':','-')+'.json')
  self.r.b.exclusive(file,{'schema_version':'1.0','observed_at':self.r.b.stamp(),'action':action,'run':RUN,'project_id':PROJECT,'team_id':TEAM,'target':s.TARGET,**bindings(),'raw_cli_logs_persisted':False,'private_application_checkpoint_only_in_protected_local_file':True,'runtime_env_or_auth_store_copied':False,'provider_rollback_or_AT069_performed':False,**value})
  return {'result':value['result'],'receipt':file.relative_to(s.ROOT).as_posix(),'action':action}
