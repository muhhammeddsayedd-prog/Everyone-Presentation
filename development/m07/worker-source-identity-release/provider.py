"""New bounded normal-CLI adapters. Import never opens inputs or providers."""
from pathlib import Path
import copy,datetime,hashlib,importlib.util,json,os,re,time,uuid
HERE=Path(__file__).resolve().parent;MAIN=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1'
PREFIX='muhammed-abdelrahman/everyone-presentation-worker-pilot/'
RUNTIME=MAIN/'development/m07/controlled-pilot/daemon-runtime.mjs';RUNTIME_SHA='528072b8e21ee0dfe79911a42ceeffeaf43b631688f16c0c6ddf5ce025b86263'
READER=MAIN/'development/m07/oauth-attempt-trace/inspect-attempt.py';READER_SHA='1359373d078ee67d5dd644d1717a048f274c98f3617bb57c3668a45866c4c03c'
CAPTURE=MAIN/'development/m07/completion-worker-rollout39/capture.py';CAPTURE_SHA='7145afd1a856e3c3fdec53c71bd7c37240873ebece5e1088b71f9d5e9c66e07d'
HEALTH=MAIN/'development/m07/completion-worker-rollout39/platform_health.py';HEALTH_SHA='9775979ede101b291ed860dca66deb578f8ec51a83817d676c422fb5947a5cd5'
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
s=module('worker_identity_provider_state',HERE/'state.py');e=module('worker_identity_provider_env',HERE/'environment.py');need=s.need
def exact_object(value,keys):need(type(value)is dict and set(value)==set(keys))
def ref(value):
 exact_object(value,('path','sha256'));need(type(value['path'])is str and re.fullmatch(r'tracking/evidence/[A-Za-z0-9_./-]+\.json',value['path'])and'..'not in Path(value['path']).parts and re.fullmatch('[a-f0-9]{64}',value['sha256']));return value
def read_ref(value):
 ref(value);raw=s.load(MAIN/value['path']);need(s.sha(raw)==value['sha256']);return json.loads(raw)
def require_normal_sql(sql,linked_target,environment):
 need(linked_target==s.a.TARGET and not any(environment.get(key)for key in('SUPABASE_ACCESS_TOKEN','SUPABASE_DB_PASSWORD'))
  and type(sql)is str and(sql.startswith('begin isolation level repeatable read;')or sql.startswith('begin isolation level repeatable read read only;')))
def validate_inputs(value):
 exact_object(value,('run','build_run','source','native','daemon','native_probe','worker_sql_proof'));need(all(type(value[key])is str and str(uuid.UUID(value[key]))==value[key]and uuid.UUID(value[key]).version==4 for key in('run','build_run')))
 source=value['source'];exact_object(source,('commit','tree','archive','source_sha256','files','native_graph_sha256','daemon_graph_sha256','quality'))
 need(all(type(source[key])is str and re.fullmatch('[a-f0-9]{40}',source[key])for key in('commit','tree'))and all(type(source[key])is str and re.fullmatch('[a-f0-9]{64}',source[key])for key in('source_sha256','native_graph_sha256','daemon_graph_sha256')));ref(source['quality'])
 exact_object(source['archive'],('path','sha256'));need(type(source['archive']['path'])is str and re.fullmatch(r'\.local/[A-Za-z0-9_./-]+\.tar',source['archive']['path'])and'..'not in Path(source['archive']['path']).parts and re.fullmatch('[a-f0-9]{64}',source['archive']['sha256']))
 need(type(source['files'])is list and 0<len(source['files'])<=1000);previous=''
 for row in source['files']:
  exact_object(row,('path','sha256','bytes'));need(list(row)==['path','sha256','bytes']and type(row['path'])is str and row['path']>previous and '..'not in row['path']and re.fullmatch(r'(?:package(?:-lock)?\.json|(?:apps|packages|contracts)/[A-Za-z0-9_./-]+)',row['path'])
   and type(row['bytes'])is int and 0<row['bytes']<=16*1024**2 and type(row['sha256'])is str and re.fullmatch('[a-f0-9]{64}',row['sha256']));previous=row['path']
 need(s.sha(json.dumps(source['files'],ensure_ascii=False,separators=(',',':')).encode())==source['source_sha256']and source['source_sha256']!=s.a.OLD['source_sha256'])
 for kind in('native','daemon'):
  keys=('digest','source_sha256','export','registry_copy','ready')+(('manifest_sha256','compatibility_sha256','graph_sha256')if kind=='native'else())
  row=value[kind];exact_object(row,keys);need(type(row['digest'])is str and re.fullmatch('sha256:[a-f0-9]{64}',row['digest'])and row['digest']!=s.a.OLD[kind+'_digest']and row['source_sha256']==source['source_sha256'])
  for key in('export','registry_copy','ready'):ref(row[key])
 need(value['native']['graph_sha256']==source['native_graph_sha256']and all(type(value['native'][key])is str and re.fullmatch('[a-f0-9]{64}',value['native'][key])for key in('manifest_sha256','compatibility_sha256')))
 ref(value['worker_sql_proof']);exact_object(value['native_probe'],('receipt','plan','release','admitted'))
 for item in value['native_probe'].values():ref(item)
 return value

class Provider:
 def __init__(self):
  need(HERE.parents[2].resolve()==MAIN);m=module('worker_identity_existing_functions',HERE/'mechanisms.py');self.l=m.Libraries();self.guard=self.l.guard()
  file=MAIN/'.local/worker-source-identity-release/inputs.json';self.guard.verify(file);raw=s.load(file);self.inputs=validate_inputs(json.loads(raw));self.input_ref={'path':file.relative_to(MAIN).as_posix(),'sha256':s.sha(raw)}
  self.private=MAIN/s.a.PRIVATE_NAMESPACE/self.inputs['run'];self.s=s.State(self.inputs['native']['digest']);self.e=e;self.o=module('worker_identity_startup_data',HERE/'startup.py')
  self.cached_health=[]
 def bindings(self):
  native=self.inputs['native'];source=self.inputs['source']
  return {'daemon_source_sha256':source['source_sha256'],'native_source_sha256':native['source_sha256'],'native_graph_sha256':native['graph_sha256'],'daemon_graph_sha256':source['daemon_graph_sha256'],
   'native_manifest_sha256':native['manifest_sha256'],'native_compatibility_sha256':native['compatibility_sha256'],'native_digest':native['digest'],'daemon_digest':self.inputs['daemon']['digest'],
   'environment':{'EPS_NATIVE_MANIFEST_SHA256':native['manifest_sha256'],'EPS_DAEMON_SOURCE_SHA256':source['source_sha256'],'EPS_NATIVE_COMPATIBILITY_SHA256':native['compatibility_sha256']}}
 def pins(self):
  need(s.sha(s.load(MAIN/self.input_ref['path']))==self.input_ref['sha256']);pins={**self.s.source_pins(),**self.l.pins(),str(MAIN/self.input_ref['path']):self.input_ref['sha256']}
  for file,digest in((RUNTIME,RUNTIME_SHA),(READER,READER_SHA),(CAPTURE,CAPTURE_SHA),(HEALTH,HEALTH_SHA)):
   need(s.sha(s.load(file))==digest);pins[str(file)]=digest
  for kind in('native','daemon'):
   for key in('export','registry_copy','ready'):v=self.inputs[kind][key];read_ref(v);pins[str(MAIN/v['path'])]=v['sha256']
  for v in(*self.inputs['native_probe'].values(),self.inputs['worker_sql_proof'],self.inputs['source']['quality']):read_ref(v);pins[str(MAIN/v['path'])]=v['sha256']
  return dict(sorted(pins.items()))
 def _path(self,name):need(type(name)is str and name not in('.','..')and re.fullmatch('[A-Za-z0-9_.-]+',name));return self.private/name
 def _create(self,name,value):
  file=self._path(name);need(not file.exists()and file.parent.resolve()==self.private and not file.parent.is_symlink());raw=value if type(value)is bytes else(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n').encode();need(0<len(raw)<=16*1024**2)
  with self.guard.create(file)as stream:self.guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());self.guard.verify_open(stream)
 def _ensure(self):
  owner={'owner':'eps-worker-separate-source-identity-release','run':self.inputs['run'],'project':PROJECT,'team':TEAM,'target':s.a.TARGET,'bindings':self.bindings()}
  if not self.private.exists():self.private.mkdir(parents=True,exist_ok=False);need(self.private.resolve()==self.private and not self.private.is_symlink());self._create('owner.json',owner)
  else:need(self.private.resolve()==self.private and not self.private.is_symlink()and self.read('owner.json')==owner)
 def exists(self,name):return self._path(name).exists()
 def write(self,name,value):self._ensure();self._create(name,value)
 def read(self,name):file=self._path(name);self.guard.verify(file);return json.loads(s.load(file))
 def hash(self,name):file=self._path(name);self.guard.verify(file);return s.sha(s.load(file))
 def run(self,args,timeout=45):return self.l.run(args,timeout)
 def api(self,method,endpoint,body=None,header=None):
  env='/v10/projects/'+PROJECT+'/env?teamId='+TEAM
  get_env=re.fullmatch('/v1/projects/'+PROJECT+r'/env/[A-Za-z0-9_-]{1,128}\?teamId='+TEAM,endpoint)
  patch_env=re.fullmatch('/v9/projects/'+PROJECT+r'/env/[A-Za-z0-9_-]{1,128}\?teamId='+TEAM,endpoint)
  deployment=re.fullmatch(r'/v13/deployments/(?:dpl_[A-Za-z0-9]{10,80}|everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app)\?teamId='+TEAM,endpoint)
  gets={env+'&decrypt=false','/v9/projects/'+PROJECT+'?teamId='+TEAM,'/v7/deployments?projectId='+PROJECT+'&target=production&limit=20&teamId='+TEAM,*self.l.registry.API.values(),'/v1/vcr/repository/'+self.l.registry.DAEMON_REPO+'/images?projectId='+PROJECT+'&teamId='+TEAM+'&limit=50'}
  create=method=='POST'and endpoint==env and type(body)is dict and set(body)=={'key','value','type','target'}and body['key']in s.a.PUBLIC_DIGESTS and body['type']=='plain'and body['target']==['production']and type(body['value'])is str and re.fullmatch('[a-f0-9]{64}',body['value'])and header is None
  patch=method=='PATCH'and patch_env and type(body)is dict and set(body)=={'value'}and type(body['value'])is str and re.fullmatch('[a-f0-9]{64}',body['value'])and header is None
  observe=method=='POST'and endpoint==self.o.ENDPOINT and header==self.o.HEADER and type(body)is dict and self.o.OBSERVE_ENABLED is True
  if observe:need(body.get('event')=='vercel.log'and body.get('scope')=={'ownerId':TEAM,'projectIds':[PROJECT]}and body.get('select')==self.o.base().SELECT and body.get('order')=='asc'and body.get('limit')==100 and type(body.get('filter'))is str and len(body['filter'])<=1000)
  need((method=='GET'and body is None and header is None and(endpoint in gets or get_env or deployment))or create or patch or observe)
  args=['api',endpoint,'--method',method,'--raw']
  if header is not None:args+=['--header',header]
  if body is not None:name='request-'+str(uuid.uuid4())+'.json';self.write(name,body);args+=['--input',str(self._path(name))]
  return json.loads(self.run(self.l.cli(args)))
 def query(self,sql,checkpoint=False):
  require_normal_sql(sql,(MAIN/'supabase/.temp/project-ref').read_text().strip(),os.environ)
  need(s.sha(s.load(READER))==READER_SHA and s.sha(s.load(CAPTURE))==CAPTURE_SHA)
  reader=module('worker_identity_same_normal_SQL_reader',READER);name='query-'+str(uuid.uuid4())+'.sql';self.write(name,sql.encode())
  args=['npx.cmd','--yes','supabase@2.122.0','db','query','--linked','--project-ref',s.a.TARGET,'--file',str(self._path(name)),'--output-format','json','--workdir',str(MAIN)]
  if checkpoint:capture=module('worker_identity_same_checkpoint_capture',CAPTURE);code,timeout,overflow,out,_=capture.bounded_checkpoint(args,reader.environment(),cwd=MAIN)
  else:code,timeout,overflow,out,_=reader.bounded(args,reader.environment())
  need(code==0 and not timeout and not overflow);value=json.loads(out);rows=value if type(value)is list else value.get('rows')if type(value)is dict else None
  need(type(rows)is list and len(rows)==1 and set(rows[0])=={'worker_identity_release'});return rows[0]['worker_identity_release']
 def snapshot(self):return self.s.check(self.query("begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='60s';"+self.s.state_sql()+" as worker_identity_release;rollback;"))
 def checkpoint(self,before):
  sql="begin isolation level repeatable read read only;set local search_path='';set local timezone='UTC';set local statement_timeout='60s';"+self.s.checkpoint_sql()+" as worker_identity_release;rollback;"
  value=self.s.checkpoint_check(self.query(sql,True));need(value['state']==before and self.snapshot()==before);self.write('canonical40-checkpoint.json',value)
  return {'path':self._path('canonical40-checkpoint.json').relative_to(MAIN).as_posix(),'sha256':self.hash('canonical40-checkpoint.json'),'history_path':['state','schema40','history'],'tables':76,'scope':'before_worker_pause','restore_verified':False}
 def environment(self):
  old=e.base();payload=self.api('GET','/v10/projects/'+PROJECT+'/env?teamId='+TEAM+'&decrypt=false');rows=old.metadata(payload);values={}
  for key in(*old.PUBLIC,*s.a.PUBLIC_DIGESTS):
   selected=old.selected(rows,key,key not in('APP_ENV','EPS_PILOT_EXPIRES_AT','EPS_PILOT_OWNER_CONTROLLED'))if key in old.PUBLIC else e.selected(rows,key)
   if selected is None:continue
   result=self.api('GET','/v1/projects/'+PROJECT+'/env/'+selected['id']+'?teamId='+TEAM);need(result.get('id')==selected['id']and result.get('key')==key and type(result.get('value'))is str);values[key]=result['value']
  return e.projection(rows,values)
 def update_environment(self,action):
  need(action['key']in e.EDITABLE and action['body']['value']==self.bindings()['environment'][action['key']]);before=self.environment();row=e.selected(before['metadata'],action['key'])
  if action['method']=='PATCH':need(row is not None and row['id']==action['id']);endpoint='/v9/projects/'+PROJECT+'/env/'+action['id']+'?teamId='+TEAM
  else:need(action['method']=='POST'and row is None and action['key']in s.a.PUBLIC_DIGESTS);endpoint='/v10/projects/'+PROJECT+'/env?teamId='+TEAM
  value=self.api(action['method'],endpoint,action['body'])
  if action['method']=='POST':need(type(value.get('envs'))is list and len(value['envs'])==1 and value.get('failed')==[]);created=value['envs'][0];need(created.get('key')==action['key']and created.get('value')==action['body']['value']and created.get('type')=='plain'and created.get('target')==['production'])
  else:need(value.get('id')==action['id']and value.get('key')==action['key']and value.get('value')==action['body']['value'])
  return {'normal_return_observed':True}
 def js(self,payload):
  need(s.sha(s.load(RUNTIME))==RUNTIME_SHA);name='daemon-metadata-'+str(uuid.uuid4())+'.json';self.write(name,payload)
  program="import fs from'node:fs';const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const m=await import("+json.dumps(RUNTIME.as_uri())+");process.stdout.write(JSON.stringify(m.projectDaemon(p.value,p.deployment)));"
  return json.loads(self.run([str(self.l.registry.NODE),'--input-type=module','-e',program,str(self._path(name))]))
 def inspect(self,deployment):return self.js({'value':json.loads(self.run(self.l.cli(['daemons','inspect','worker','--project',PROJECT,'--json']))),'deployment':deployment})
 def healthy(self,value,deployment,digest):
  need(s.sha(s.load(HEALTH))==HEALTH_SHA);health=module('worker_identity_original_cached_health',HEALTH);identity,cached=health.control_plane_ready(value,deployment,digest)
  need(len(self.cached_health)<64);self.cached_health.append(cached);return identity
 def old_ready(self):return self.healthy(self.inspect(s.a.OLD['deployment_id']),s.a.OLD['deployment_id'],s.a.OLD['daemon_digest'])
 def inventory(self):
  value=json.loads(self.run(self.l.cli(['daemons','instances','ls','--project',PROJECT,'--json'])));need(type(value)is dict and set(value)=={'instances'}and type(value['instances'])is list and len(value['instances'])<=4)
  ids=[]
  for row in value['instances']:need(row.get('daemon')=='worker'and re.fullmatch('dmni_[0-9a-hjkmnp-tv-z]{26}',row.get('id','')));ids.append(row['id'])
  need(len(ids)==len(set(ids)));return sorted(ids)
 def old_matches(self,expected):need(self.old_ready()==self.old_ready()==expected and self.inventory()==[expected['instance_id']])
 def build(self):return module('worker_identity_new_local_build',HERE/'build.py').Build(self.inputs,libraries=self.l)
 def output(self):
  self.build().context('daemon');root=MAIN/'.local/worker-hosting'/self.inputs['build_run']/'deployment';need(root.resolve()==root and not root.is_symlink())
  expected={'.vercel/output/config.json':{'version':3,'daemons':{'worker':{}}},'.vercel/output/daemons/worker/.vc-config.json':{'runtime':'container','image':'vcr.vercel.com/'+PREFIX+'daemon@'+self.inputs['daemon']['digest'],'instances':{'dub1':1},'resources':{'requests':{'memory':'2Gi'}},'terminationGracePeriodSeconds':300},'.vercel/project.json':{'projectId':PROJECT,'orgId':TEAM,'projectName':'everyone-presentation-worker-pilot'}}
  actual=[]
  for file in root.rglob('*'):
   need(not file.is_symlink()and file.resolve().is_relative_to(root))
   if file.is_file():actual.append(file.relative_to(root).as_posix())
  need(set(actual)==set(expected));result=[]
  for name,wanted in expected.items():raw=s.load(root/name);need(json.loads(raw)==wanted);result.append({'path':name,'sha256':s.sha(raw),'bytes':len(raw)})
  return result
 def admission(self,phase):
  need(self.o.OBSERVE_ENABLED is True);self.build().source_admission();source=self.build().context('daemon');need(source['daemon_source_sha256']==self.bindings()['daemon_source_sha256'])
  self.build().accepted_export('native');self.build().accepted_export('daemon')
  for kind in('native','daemon'):
   copy_proof=read_ref(self.inputs[kind]['registry_copy']);ready_proof=read_ref(self.inputs[kind]['ready'])
   need(copy_proof['result']=='passed'and copy_proof['normal_copy_return_observed']is True and copy_proof['runtime_digest']==self.inputs[kind]['digest']and copy_proof['source_sha256']==self.inputs['source']['source_sha256'])
   need(ready_proof['result']=='observed'and ready_proof['image']['runtime_digest']==self.inputs[kind]['digest'])
  registry=module('worker_identity_same_registry_normal_records',HERE/'registry.py');ports=registry.Ports(self.build())
  for kind in('native','daemon'):
   claim=ports.read(kind+'-copy.claim.json');returned=registry.normal(ports,kind+'-copy');need(claim['source_pins']==ports.pins()and returned is not None and returned['normal_copy_return_observed']is True and returned['runtime_digest']==self.inputs[kind]['digest'])
  probe=module('worker_identity_new_native_probe_admission',HERE/'native_probe.py').admit_reference(self.inputs['native_probe'],self.inputs,self.l,self.write)
  need(probe['cleanup_confirmed']is True and probe['source_sha256']==self.inputs['native']['source_sha256']and probe['image']==PREFIX+'native@'+self.inputs['native']['digest'])
  proof=read_ref(self.inputs['worker_sql_proof']);need(proof['result']=='passed'and proof['sql_contract_sha256']==self.s.sql_contract_sha256()and proof['history_count']==40)
  for key in('full76_rows_preserved','full_nonnull_audit_reason_preserved','unknown_metadata_ACL_value_refused','cached_intake_waited_before_snapshot','fresh_intake_denied_after_pause','retry_lifecycle_not_hidden_by_pause','all_owned_resources_absent','original_data_catalogue_and_global_roles_unchanged','shared_lock_released'):need(proof[key]is True)
  need(proof['native_pin_value']==self.inputs['native']['digest']and proof['cloud_called']is False and proof['provider_called']is False)
  helper=self.l.registry.helpers();helper.project_ready(self.api('GET',self.l.registry.API['repository']),self.api('GET',self.l.registry.API['images']),self.inputs['native']['digest'])
  repo=self.api('GET',self.l.registry.API['daemon_repository']);helper.repository_metadata(repo,self.l.registry.DAEMON_REPO,'daemon')
  images=self.api('GET','/v1/vcr/repository/'+self.l.registry.DAEMON_REPO+'/images?projectId='+PROJECT+'&teamId='+TEAM+'&limit=50');need(type(images.get('images'))is list and len(images['images'])<=50)
  matches=[row for row in images['images']if row.get('manifestDigest')==self.inputs['daemon']['digest']];need(len(matches)==1 and matches[0].get('repositoryId')==self.l.registry.DAEMON_REPO and matches[0].get('kind')=='manifest'and matches[0].get('status')=='ready'and matches[0].get('architecture',matches[0].get('arch'))=='amd64'and matches[0].get('platform')=='linux')
  return {'bindings':self.bindings(),'canonical40':copy.deepcopy(s.a.APPLY),'functional_SQL40':copy.deepcopy(s.a.FUNCTIONAL),'collector_validation':copy.deepcopy(s.a.COLLECTOR),'current40_worker_SQL':copy.deepcopy(self.inputs['worker_sql_proof']),'native_probe':copy.deepcopy(self.inputs['native_probe']),'checkpoint_is_not_restore_proof':True,'phase':phase}
 def meta(self,marker):
  need(str(uuid.UUID(marker))==marker);b=self.bindings()
  return {'epsWorkerIdentityDaemonSource':b['daemon_source_sha256'],'epsWorkerIdentityNativeSource':b['native_source_sha256'],'epsWorkerIdentityNativeGraph':b['native_graph_sha256'],'epsWorkerIdentityDaemonGraph':b['daemon_graph_sha256'],'epsWorkerIdentityManifest':b['native_manifest_sha256'],'epsWorkerIdentityCompatibility':b['native_compatibility_sha256'],'epsWorkerIdentityNative':b['native_digest'],'epsWorkerIdentityDaemon':b['daemon_digest'],'epsWorkerIdentityRun':marker}
 def deploy(self,marker):
  output=MAIN/'.local/worker-hosting'/self.inputs['build_run']/'deployment';self.output();args=['deploy',str(output),'--prebuilt','--prod','--yes','--no-wait','--project',PROJECT]
  for key,value in self.meta(marker).items():args+=['--meta',key+'='+value]
  raw=self.run(self.l.cli(args),120).decode();urls=set(re.findall(r'https://everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app(?=[\s"\x1b]|$)',raw));need(len(urls)==1);return {'url':next(iter(urls))}
 def deployment_metadata(self,value,marker):
  need(value.get('project',{}).get('id')==PROJECT and value.get('team',{}).get('id')==TEAM and value.get('name')=='everyone-presentation-worker-pilot'and value.get('target')=='production'and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',value.get('id',''))and value['id']!=s.a.OLD['deployment_id']and all(value.get('meta',{}).get(key)==wanted for key,wanted in self.meta(marker).items()))
  return {'deployment_id':value['id'],'provider_state':value.get('readyState'),'metadata_bound_to_new_claim':True}
 def reconcile_deployment(self,claim,returned):
  if returned:identifier=returned['value']['url'].removeprefix('https://')
  else:
   payload=self.api('GET','/v7/deployments?projectId='+PROJECT+'&target=production&limit=20&teamId='+TEAM);need(type(payload.get('deployments'))is list and len(payload['deployments'])<=20 and type(payload.get('pagination'))is dict and'next'in payload['pagination']and payload['pagination']['next']is None)
   found=[row for row in payload['deployments']if all(row.get('meta',{}).get(key)==wanted for key,wanted in self.meta(claim['marker']).items())];need(len(found)==1);identifier=found[0].get('uid',found[0].get('id'));need(type(identifier)is str and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',identifier))
  one=self.deployment_metadata(self.api('GET','/v13/deployments/'+identifier+'?teamId='+TEAM),claim['marker']);two=self.deployment_metadata(self.api('GET','/v13/deployments/'+identifier+'?teamId='+TEAM),claim['marker']);need(one==two)
  return {**one,'two_equal_metadata_reads':True,'deployment_resubmitted':False}
 def reconcile_environment(self,claim):
  current=claim['before'];one,two=self.environment(),self.environment();need(one==two);normal_returns=[]
  for index,action in enumerate(claim['actions']):
   name='env-'+str(index)
   if not self.exists(name+'.claim.json'):break
   child=self.read(name+'.claim.json');need(child['before']==current and child['action']==action and child['pins']==self.pins());normal_returns.append(self.exists(name+'.normal.json'))
   if self.exists(name+'.readback.json'):after=self.read(name+'.readback.json');need(after['claim_sha256']==self.hash(name+'.claim.json'));e.preserved(current,after['after'],action);current=after['after']
   elif one!=current:e.preserved(current,one,action);current=one;break
  need(current==one);return {'public_environment_observed':True,'normal_child_return_records_present':normal_returns,'normal_return_not_inferred':True,'environment_resubmitted':False}
 def ready(self,url,marker):
  need(type(url)is str and re.fullmatch(r'https://everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app',url));value=self.api('GET','/v13/deployments/'+url.removeprefix('https://')+'?teamId='+TEAM);self.deployment_metadata(value,marker);need(value.get('readyState')=='READY')
  deployment=value['id'];digest=self.inputs['daemon']['digest'];first=self.healthy(self.inspect(deployment),deployment,digest);second=self.healthy(self.inspect(deployment),deployment,digest);need(first==second and self.inventory()==[first['instance_id']])
  need(self.o.OBSERVE_ENABLED is True);bindings=self.bindings();scope={'deployment':deployment,'instance':{'id':first['id'],'started_at_ms':first['started_at_ms']},'bindings':{key:bindings[key]for key in(*self.o.FIELDS,'native_digest','daemon_digest')}}
  now=int(time.time()*1000);need(now>=first['started_at_ms']+600000);payload=self.api('POST',self.o.ENDPOINT,self.o.request(scope),self.o.HEADER);startup=self.o.startup(scope,payload,now)
  need(not(MAIN/'.local/m07-pilot/native-probe.lock.json').exists());self.admission('ready');need(self.healthy(self.inspect(deployment),deployment,digest)==first and self.inventory()==[first['instance_id']])
  return {'new_deployment_ready':True,'old_instances_absent':True,'native_cleanup_confirmed':True,'source_identities_verified':True,'bindings':bindings,'deployment_id':deployment,'instance_id':first['id'],'startup':startup,'native_cleanup_basis':'new probe exact absence and deployed source boot global-idle assertion; no new client session inventory claimed'}
 def save(self,action,value):
  result={'schema_version':'1.0','observed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'action':action,'purpose':'first_worker_separate_source_identity_release','run':self.inputs['run'],'project_id':PROJECT,'team_id':TEAM,'target':s.a.TARGET,'bindings':self.bindings(),'cached_platform_health_metadata':self.cached_health,'fresh_application_heartbeat_claimed':False,'raw_cli_logs_persisted':False,'private_checkpoint_is_restore_proof':False,'rollback_or_AT069_performed':False,**value}
  folder=MAIN/s.a.EVIDENCE_NAMESPACE;folder.mkdir(parents=True,exist_ok=True);need(folder.resolve()==folder and not folder.is_symlink());file=folder/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action.replace(':','-')+'.json')
  with file.open('x',encoding='utf8',newline='\n')as stream:stream.write(json.dumps(result,ensure_ascii=False,indent=2)+'\n');stream.flush();os.fsync(stream.fileno())
  return {'result':value['result'],'action':action,'receipt':file.relative_to(MAIN).as_posix()}
