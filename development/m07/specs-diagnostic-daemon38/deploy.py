"""Disabled fresh ce23 daemon rollout. No old worker/adoption main is replayed.

Root alone runs. Image observation precedes pause; dispatch/Ready require the
exact preserved paused38 state and same-ID manifest adoption, before DB pin.
"""
from pathlib import Path
import datetime, importlib.util, json, os, re, subprocess, sys, uuid

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
DEPLOY_ENABLED=True
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v);return v
r=module('daemon38_unchanged_registry',ROOT/'development/m07/specs-diagnostic-worker38/registry.py')
need=r.need;sha=r.sha;load=r.load
PROJECT=r.PROJECT;TEAM=r.TEAM;SLUG=r.SLUG;RUN=r.RUN;SOURCE=r.SOURCE;NATIVE=r.NATIVE_DIGEST
DAEMON='sha256:ce23af3ba163199c1e35f224f71a281ab450d7acfc0f4ab85b6044df5246431c'
MANIFEST='3e20f7b1c795ab2e825a02327c4a4a241b97a57a8bf3d28e2a265f7eba8630f9'
OLD='dpl_2uASsbYobSDwWjMptPjGLcVEdCg3';OLD_IMAGE='sha256:430d0992ef3280f13fb52ff206d0ae09eedb2fee0831583f868db77d4012f12f'
NODE=r.NODE;CLI=r.CLI;GLOBAL=r.GLOBAL
PRIVATE=ROOT/'.local/m07-specs-diagnostic-daemon38';PLAN=PRIVATE/'plan.json';PREPARE=PRIVATE/'prepare.claim.json';CLAIM=PRIVATE/'deploy.claim.json';RETURNED=PRIVATE/'deploy.returned.json'
INPUTS=HERE/'inputs.json';TEMPLATE=HERE/'inputs.template.json';OUTPUT=ROOT/'.local/worker-hosting'/RUN/'deployment'
EMITTER=ROOT/'tools/worker-hosting-build.mjs';EMITTER_SHA='3f27ca1bf039579905763365c592b4d6e94754437753a3f645c4bad85e7bcb69'
RUNTIME=ROOT/'development/m07/controlled-pilot/daemon-runtime.mjs';RUNTIME_SHA='528072b8e21ee0dfe79911a42ceeffeaf43b631688f16c0c6ddf5ce025b86263'
CLI_PINS={'commands/deploy/index.js':'87147e9eda4f3f43f156a93b54b157ac356f7108a196027692120efb71c40ee2',
 'commands-routing.js':'1314ff6bb482b556ac540e12bf87d899b15e2e30ed1c907e54d5b664dea5ba90','commands-deployments.js':'5309d52278f46cf3cd7764690873038b4054c0b702ff885b9878a67ee6ff218a',
 'chunks/chunk-CJHVHB2F.js':'c9301bc282bed45b0d8b127bf70cbc951c9d2ccf00be71289b331560445d03a0','chunks/chunk-OLAG7Y3P.js':'96356f41ba1d0a364761c04470e831dea6365ca51744f19d4dc710c728927b52',
 'chunks/chunk-2PYFJXKS.js':'f19e025f07602444e832f4096c829928959f5a315ab09048c66f8505277d189b','chunks/chunk-YIOT5B5Z.js':'36a7d817e495b18babf431a5380e530f3f6ceb262120bafc56b3d9163aaae661',
 'chunks/chunk-QZEZCUUZ.js':'d81dab4301ba45c2d3c786bbca5c29a5027e98976118102de7aa8e99b607d23a'}
CORE=('native_ready','native_probe','native_admitted','daemon_export','daemon_transfer')
LATE=('daemon_image_ready','pause','pause_readback','manifest_adoption')
REPO_API='/v1/vcr/repository/'+r.DAEMON_REPO+'?projectId='+PROJECT+'&teamId='+TEAM
IMAGES_API='/v1/vcr/repository/'+r.DAEMON_REPO+'/images?projectId='+PROJECT+'&teamId='+TEAM+'&limit=50'

def reference(ref):
 need(type(ref)is dict and set(ref)=={'path','sha256'}and type(ref['path'])is str and re.fullmatch(r'tracking/evidence/[A-Za-z0-9_./-]+\.json',ref['path'])and not any(v in('','..','.')for v in ref['path'].split('/'))and re.fullmatch('[a-f0-9]{64}',ref['sha256']))
 raw=load(ROOT/ref['path']);need(sha(raw)==ref['sha256']);return json.loads(raw)

def inputs(phase):
 need(phase in('image','rollout'));v=json.loads(load(INPUTS));template=json.loads(load(TEMPLATE))
 need(set(v)==set(template)and{k:x for k,x in v.items()if k!='references'}=={k:x for k,x in template.items()if k!='references'}and set(v['references'])==set(template['references']))
 for key in CORE:need(v['references'][key]==template['references'][key])
 used=CORE if phase=='image'else CORE+LATE
 return v,{key:reference(v['references'][key])for key in used}

def image_proofs(v,docs):
 need(v['source_sha256']==SOURCE and v['native_image_id']==NATIVE and v['daemon_image_id']==DAEMON and v['manifest_sha256']==MANIFEST)
 export=docs['daemon_export'];transfer=docs['daemon_transfer'];admitted=docs['native_admitted'];probe=docs['native_probe'];ready=docs['native_ready']
 need(export['result']=='passed'and export['kind']=='daemon'and export['run']==RUN and export['source_sha256']==SOURCE and export['runtime_digest']==DAEMON
  and export['normal_build_process_return_observed']is True and export['source_revalidated_after_export']is True and export['source']['file_count']==164 and export['source']['manifest_sha256']==MANIFEST)
 gate=export['production_import_gate'];need(gate['user']=='1000:1000'and gate['network']=='none'and gate['completed']is True and gate['cached']is False and gate['build_exit_code']==0)
 need(transfer['result']=='passed'and transfer['kind']=='daemon'and transfer['source_sha256']==SOURCE and transfer['run']==RUN and transfer['runtime_digest']==DAEMON
  and transfer['export']=={'receipt':v['references']['daemon_export']['path'],'sha256':v['references']['daemon_export']['sha256']}
  and transfer['normal_copy_return_observed']is True and transfer['two_remote_reads_equal']is True and transfer['remote_readbacks']==[{'index_digest':export['archive']['index_digest'],'runtime_digest':DAEMON}]*2)
 need(ready['read_only']is True and ready['provider_mutations']is False and ready['repository']['project_id']==PROJECT and ready['repository']['public']is False
  and sum(row['manifest_digest']==NATIVE and row['status']=='ready'and row['architecture']=='amd64'and row['platform']=='linux'for row in ready['images']['images'])==1)
 need(admitted['result']=='actual_hosted_native38_receipt_admitted'and admitted['receipt']==v['references']['native_probe']['path']and admitted['sha256']==v['references']['native_probe']['sha256'])
 proof=admitted['admitted'];need(proof['result']=='passed'and proof['source_sha256']==SOURCE and proof['image']==r.b.PREFIX.removeprefix('vcr.vercel.com/')+'native@'+NATIVE
  and proof['native_tasks_passed']==9 and proof['named_resources_observed_and_absent']==10 and proof['cleanup_confirmed']is True and proof['lock_released']is True)
 need(probe['result']=='passed'and probe['source_sha256']==SOURCE and probe['cleanup_confirmed']is True and probe['lock_released']is True)
 return export

def adoption():
 a=module('daemon38_live_adoption_readonly',ROOT/'development/m07/specs-diagnostic-worker38-adoption/adoption.py')
 m=module('daemon38_live_manifest_readonly',ROOT/'development/m07/specs-diagnostic-worker38-adoption/manifest.py')
 return a,m

def sources(phase):
 v,docs=inputs(phase);image_proofs(v,docs);pins=r.sources()
 context=r.b.verify_context('daemon');need(context['source_sha256']==SOURCE and context['file_count']==164 and context['manifest_sha256']==MANIFEST)
 pins['current_context_source_sha256']=context['source_sha256'];pins['current_context_seal_sha256']=context['source_seal_sha256'];pins['current_context_manifest_sha256']=context['manifest_sha256']
 need(sha(load(EMITTER))==EMITTER_SHA and sha(load(RUNTIME))==RUNTIME_SHA)
 pins.update({EMITTER.relative_to(ROOT).as_posix():EMITTER_SHA,RUNTIME.relative_to(ROOT).as_posix():RUNTIME_SHA})
 for relative,digest in CLI_PINS.items():need(sha(load(CLI.parent/relative))==digest);pins['cli/'+relative]=digest
 for name in ['deploy.py','test_deploy.py','README.md','inputs.template.json']:pins[(HERE/name).relative_to(ROOT).as_posix()]=sha(load(HERE/name))
 for key in CORE if phase=='image'else CORE+LATE:pins[v['references'][key]['path']]=v['references'][key]['sha256']
 if phase=='rollout':
  a,m=adoption();pins.update(a.s.sources())
 return dict(sorted(pins.items()))

def environment():
 result={k:os.environ[k]for k in ['SystemRoot','WINDIR','USERPROFILE','APPDATA','LOCALAPPDATA','HOMEDRIVE','HOMEPATH','TEMP','TMP','LANG']if k in os.environ}
 result.update(PATH='',NODE_ENV='production',CI='1',VERCEL_TELEMETRY_DISABLED='1',VERCEL_CLI_USE_NATIVE_BINARY='0');return result
def cli(args):return[str(NODE),str(CLI),*args,'--scope',SLUG,'--global-config',GLOBAL]
def api(endpoint):
 need(endpoint in(REPO_API,IMAGES_API,'/v9/projects/'+PROJECT+'?teamId='+TEAM)or re.fullmatch(r'/v13/deployments/(?:dpl_[A-Za-z0-9]{10,80}|everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app)\?teamId='+TEAM,endpoint))
 return cli(['api',endpoint,'--method','GET','--raw'])
def descriptor():return {'config':{'version':3,'daemons':{'worker':{}}},'daemon':{'runtime':'container','image':r.b.PREFIX+'daemon@'+DAEMON,'instances':{'dub1':1},'resources':{'requests':{'memory':'2Gi'}},'terminationGracePeriodSeconds':300}}
def deployment_url(raw):
 urls=set(re.findall(r'https://everyone-presentation-worker-pilot-[a-z0-9-]+\.vercel\.app(?=[\s"\x1b]|$)',raw));need(len(urls)==1);return next(iter(urls))
def metadata(marker):return {'epsSpecsDiagnostics38':SOURCE,'epsDaemonImage38':DAEMON,'epsNativeImage38':NATIVE,'epsManifest38':MANIFEST,'epsDaemonRollout38':marker}
def deploy_command(marker):
 need(type(marker)is str and str(uuid.UUID(marker))==marker)
 args=['deploy',str(OUTPUT),'--prebuilt','--prod','--yes','--no-wait','--project',PROJECT]
 for key,value in metadata(marker).items():args+=['--meta',key+'='+value]
 return cli(args)

def ready_image_projection(repository,payload):
 repo=r.repository_metadata(repository,r.DAEMON_REPO,'daemon');need(type(payload.get('images'))is list and len(payload['images'])<=50)
 found=[row for row in payload['images']if row.get('manifestDigest')==DAEMON]
 need(len(found)==1 and found[0].get('repositoryId')==r.DAEMON_REPO and found[0].get('kind')=='manifest'and found[0].get('status')=='ready'and found[0].get('arch')=='amd64'and found[0].get('platform')=='linux')
 return {'repository':repo,'image':{'runtime_digest':DAEMON,'status':'ready','architecture':'amd64','platform':'linux'},'provider_reads':2,'pagination_followed':False}

def healthy(value,deployment,image,now=None):
 now=int(datetime.datetime.now(datetime.timezone.utc).timestamp()*1000)if now is None else now;need(type(now)is int and now>0)
 need(value['project_id']==PROJECT and value['team_id']==TEAM and value['deployment_id']==deployment and value['daemon']=='worker'and value['environment']=='production'
  and value['status']=='ready'and value['configured_instances']=={'dub1':1}and value['configured_override']is None and value['memory_mib']==2048 and value['termination_grace_seconds']==300
  and value['desired']==value['ready']==value['total']==1 and value['requested_image']['digest']==value['resolved_image']['digest']==image and len(value['instances'])==1)
 item=value['instances'][0];need(item['alive']is True and item['image']['digest']==image and item['region']=='dub1'and item['memory_mib']==2048 and item['stopped_at_ms']is None)
 started=item['started_at_ms'];checked=item['last_checked_at_ms'];need(type(started)is int and type(checked)is int and 0<started<=checked and now-60000<=checked<=now+60000)
 return {'deployment_id':deployment,'image':image,'instance_id':item['id'],'started_at_ms':item['started_at_ms']}
def inventory_ids(value):
 need(type(value)is dict and set(value)=={'instances'}and type(value['instances'])is list and len(value['instances'])<=4)
 ids=[]
 for row in value['instances']:need(row.get('daemon')=='worker'and type(row.get('id'))is str and re.fullmatch('dmni_[0-9a-hjkmnp-tv-z]{26}',row['id']));ids.append(row['id'])
 need(len(ids)==len(set(ids)));return sorted(ids)

def private_write(path,value):
 need(path.parent==PRIVATE);PRIVATE.mkdir(parents=True,exist_ok=True);guard=r.private_security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write((json.dumps(value,sort_keys=True)+'\n').encode());stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
def private_read(path):r.private_security().verify(path);return json.loads(load(path))

class Ports:
 def pins(self,phase='rollout'):return sources(phase)
 def run(self,args,timeout=30):
  v=r.b.mechanisms().bounded(args,environment(),timeout,'daemon38_deployment')
  need(v['exit_code']==0 and v['timed_out']is False and v['output_limit_exceeded']is False);return v['stdout'].decode()
 def api(self,endpoint):return json.loads(self.run(api(endpoint)))
 def project(self):
  v=self.api('/v9/projects/'+PROJECT+'?teamId='+TEAM)
  need(v.get('id')==PROJECT and v.get('accountId')==TEAM and v.get('name')=='everyone-presentation-worker-pilot'and v.get('nodeVersion')=='24.x'and v.get('rootDirectory')is None and v.get('oidcTokenConfig',{}).get('enabled')is True)
 def project_js(self,kind,payload):
  need(kind in('daemon','runtime','output'))
  program="import fs from'node:fs';const p=JSON.parse(fs.readFileSync(0,'utf8'));const m=await import("+json.dumps((EMITTER if kind=='output'else RUNTIME).as_uri())+");process.stdout.write(JSON.stringify("+({'daemon':'m.projectDaemon(p.value,p.deployment)','runtime':'m.projectRuntimeLogs(p.text,p.scope)','output':'m.workerDaemonOutput(p.image)'}[kind])+"));"
  raw=json.dumps(payload).encode();need(len(raw)<=2*1024**2)
  out=subprocess.run([str(NODE),'--input-type=module','-e',program],input=raw,capture_output=True,timeout=15,env=environment(),cwd=ROOT)
  need(out.returncode==0 and len(out.stdout)<=1024**2 and len(out.stderr)<=32768);return json.loads(out.stdout)
 def inspect(self,deployment):return self.project_js('daemon',{'value':json.loads(self.run(cli(['daemons','inspect','worker','--project',PROJECT,'--json']))),'deployment':deployment})
 def inventory(self):return inventory_ids(json.loads(self.run(cli(['daemons','instances','ls','--project',PROJECT,'--json']))))
 def image_ready(self):return ready_image_projection(self.api(REPO_API),self.api(IMAGES_API))
 def gates(self):
  v,docs=inputs('rollout');export=image_proofs(v,docs);a,m=adoption();accepted=a.admission('manifest')
  need(accepted['source_sha256']==SOURCE and accepted['new_native_image_id']==NATIVE and accepted['new_daemon_image_id']==DAEMON and accepted['new_manifest_sha256']==MANIFEST)
  image=docs['daemon_image_ready'];need(image['result']=='ready_image_and_import_gate_observed'and image['source_sha256']==SOURCE and image['daemon_runtime_digest']==DAEMON and image['native_runtime_digest']==NATIVE and image['baked_manifest_sha256']==MANIFEST)
  current=a.read_snapshot();a.s.phase_before(current,'pin',NATIVE);a.prior_phase('manifest',current,accepted)
  pause=docs['pause'];readback=docs['pause_readback'];need(pause['result']=='passed'and pause['phase']=='pause'and pause['target']==a.s.TARGET and pause['normal_return_marker_observed']is True and pause['independent_readback_verified']is True and pause['first']==pause['second']==current)
  need(readback['result']=='observed_applied'and readback['phase']=='pause'and readback['first']==readback['second']==current and readback['normal_return_not_inferred']is True)
  pause_claim=a.private_read(a.PRIVATE/'pause.claim.json');pause_return=a.private_read(a.PRIVATE/'pause.returned.json')
  need(pause_claim['phase']=='pause'and pause_claim['source_pins']==pause['source_pins']==readback['source_pins']==a.source_pins()and pause_return=={'claim_sha256':sha(load(a.PRIVATE/'pause.claim.json')),'normal_return_marker_observed':True})
  a.s.transition(pause_claim['before'],current,'pause',NATIVE)
  adopted=docs['manifest_adoption'];need(adopted['result']=='passed'and adopted['phase']=='manifest'and adopted['project_id']==PROJECT and adopted['target']==a.s.TARGET and adopted['new_manifest_sha256']==MANIFEST
   and all(adopted[k]is True for k in ['same_environment_id_preserved','other_environment_metadata_preserved','normal_return_observed','two_readbacks_equal']))
  claimed=a.private_read(m.CLAIM);returned=a.private_read(m.RETURNED)
  need(claimed['paused']==current and claimed['admission']==accepted and claimed['source_pins']==a.source_pins()and returned=={'claim_sha256':sha(load(m.CLAIM)),'normal_return_observed':True})
  live=m.observe();need(live['environment_id']==a.s.ENVIRONMENT_ID and live['manifest_sha256']==MANIFEST and m.preserved(claimed['before'],live))
  return {'references':v['references'],'paused_state':current,'pause_claim_sha256':sha(load(a.PRIVATE/'pause.claim.json')),'pause_return_sha256':sha(load(a.PRIVATE/'pause.returned.json')),
   'manifest_claim_sha256':sha(load(m.CLAIM)),'manifest_return_sha256':sha(load(m.RETURNED)),'environment':live}
 def output_exists(self):return OUTPUT.exists()
 def emit(self):
  value=json.loads(self.run([str(NODE),str(EMITTER),'emit',RUN,r.b.PREFIX.removeprefix('vcr.vercel.com/')+'daemon@'+DAEMON]))
  need(value=={'source_sha256':SOURCE,'output':OUTPUT.relative_to(ROOT).as_posix()+'/.vercel/output'})
  r.b.exclusive(OUTPUT/'.vercel/project.json',{'projectId':PROJECT,'orgId':TEAM,'projectName':'everyone-presentation-worker-pilot'})
 def output(self):
  expected=descriptor();need(self.project_js('output',{'image':r.b.PREFIX.removeprefix('vcr.vercel.com/')+'daemon@'+DAEMON})==expected)
  files={'.vercel/output/config.json':expected['config'],'.vercel/output/daemons/worker/.vc-config.json':expected['daemon'],'.vercel/project.json':{'projectId':PROJECT,'orgId':TEAM,'projectName':'everyone-presentation-worker-pilot'}}
  actual=[]
  for path in OUTPUT.rglob('*'):
   need(not path.is_symlink()and path.resolve().is_relative_to(OUTPUT))
   if path.is_file():actual.append(path.relative_to(OUTPUT).as_posix())
  need(sorted(actual)==sorted(files));rows=[]
  for relative,value in files.items():raw=load(OUTPUT/relative);need(json.loads(raw)==value);rows.append({'path':relative,'sha256':sha(raw),'bytes':len(raw)})
  return rows
 def claim_exists(self,phase):return(PREPARE if phase=='prepare'else CLAIM).exists()
 def claim(self,phase,value):private_write(PREPARE if phase=='prepare'else CLAIM,value)
 def save_plan(self,value):private_write(PLAN,value)
 def plan(self):return private_read(PLAN)
 def claimed(self):return private_read(CLAIM)
 def returned(self,value):private_write(RETURNED,value)
 def return_value(self):return private_read(RETURNED)
 def claim_sha(self):return sha(load(CLAIM))
 def deployment(self,url,marker):
  v=self.api('/v13/deployments/'+url.removeprefix('https://')+'?teamId='+TEAM)
  need(v.get('name')=='everyone-presentation-worker-pilot'and v.get('project',{}).get('id')==PROJECT and v.get('team',{}).get('id')==TEAM and v.get('readyState')=='READY'and re.fullmatch('dpl_[A-Za-z0-9]{10,80}',v.get('id',''))and v['id']!=OLD)
  need(all(v.get('meta',{}).get(k)==value for k,value in metadata(marker).items()));return v['id']
 def startup(self,deployment,instance):
  now=int(datetime.datetime.now(datetime.timezone.utc).timestamp()*1000);end=min(now,instance['started_at_ms']+600000);window={'start':end-600000,'end':end}
  query='source:daemon AND (environment:"production" OR (attributes/\'scope.type\':"target" AND attributes/\'scope.value\':"production")) AND (daemonName:"worker" OR attributes/\'daemonName\':"worker") AND (daemonInstanceId:"'+instance['id']+'" OR attributes/\'daemonInstanceId\':"'+instance['id']+'")'
  iso=lambda milliseconds:datetime.datetime.fromtimestamp(milliseconds/1000,datetime.timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z')
  text=self.run(cli(['logs','runtime','--project',PROJECT,'--deployment',deployment,'--since',iso(window['start']),'--until',iso(end),'--limit','100','--query',query,'--json']))
  value=self.project_js('runtime',{'text':text,'scope':{'deployment':deployment,'instance':instance,'window':window}})
  need(value['complete_window']is True and value['unbound_records']==value['truncated_records']==0 and value['events']['worker_started']>=1 and value['last_startup_at_ms']is not None and all(value['events'][k]==0 for k in ['worker_unconfirmed','worker_paused','pilot_expired']));return value
 def save(self,action,value):
  path=ROOT/'tracking/evidence/m07/specs-diagnostic-daemon38'/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+action+'.json')
  r.b.exclusive(path,{'schema_version':'1.0','observed_at':r.stamp(),'action':action,'project_id':PROJECT,'team_id':TEAM,'source_sha256':SOURCE,'native_image_id':NATIVE,'daemon_image_id':DAEMON,
   'raw_logs_or_credentials_persisted':False,'environment_transferred':False,'db_pin_or_resume_performed':False,**value});return {'result':value['result'],'receipt':path.relative_to(ROOT).as_posix()}

def observe_image(p):
 need(DEPLOY_ENABLED);pins=p.pins('image');v,docs=inputs('image');export=image_proofs(v,docs);observed=p.image_ready();need(p.pins('image')==pins)
 return p.save('image-ready',{'result':'ready_image_and_import_gate_observed','run':RUN,'native_runtime_digest':NATIVE,'daemon_runtime_digest':DAEMON,'daemon_index_digest':export['archive']['index_digest'],
  'baked_manifest_sha256':MANIFEST,'production_import_gate':export['production_import_gate'],'registry_repository_private':True,'daemon_status':'ready','architecture':'amd64',
  'dockerfile_sha256':'d64e69a5e4925e4a411f41d36ffb5ea5d93d6d37ac8a6a991137e2faa30713ec','deployed':False,'polling':False,'credentials_or_raw_configuration_persisted':False,
  'actual_oci_receipts_used':True,'source_pins':pins,'references':{key:v['references'][key]for key in CORE},'registry_observation':observed,'provider_mutations':False})

def prepare(p):
 need(DEPLOY_ENABLED);pins=p.pins();gates=p.gates();p.project();need(not p.claim_exists('prepare')and not p.output_exists())
 prior=healthy(p.inspect(OLD),OLD,OLD_IMAGE);need(p.inventory()==[prior['instance_id']])
 marker=str(uuid.uuid4());p.claim('prepare',{'source_pins':pins,'gates':gates,'old':prior,'marker':marker,'local_emit_may_have_occurred':True,'deployment_performed':False,'automatic_retry':False})
 p.emit();files=p.output();need(p.pins()==pins and p.gates()==gates and healthy(p.inspect(OLD),OLD,OLD_IMAGE)==prior and p.inventory()==[prior['instance_id']])
 plan={'source_pins':pins,'gates':gates,'old':prior,'marker':marker,'files':files};p.save_plan(plan)
 return p.save('prepare',{'result':'prepared','source_pins':pins,'marker':marker,'old':prior,'files':files,'deployment_performed':False})

def checked_plan(p):
 plan=p.plan();need(plan['source_pins']==p.pins()and plan['gates']==p.gates()and plan['files']==p.output());p.project();return plan
def dispatch(p):
 need(DEPLOY_ENABLED);plan=checked_plan(p);need(not p.claim_exists('deploy')and healthy(p.inspect(OLD),OLD,OLD_IMAGE)==plan['old']and p.inventory()==[plan['old']['instance_id']])
 p.claim('deploy',{**plan,'dispatch_may_have_occurred':True,'automatic_retry':False})
 try:
  need(checked_plan(p)==plan);raw=p.run(deploy_command(plan['marker']),60);url=deployment_url(raw)
  p.returned({'claim_sha256':p.claim_sha(),'normal_process_return_observed':True,'url':url})
  return p.save('submitted',{'result':'submitted','url':url,'claim_retained':True,'ready_verified':False})
 except Exception:return p.save('submitted',{'result':'unconfirmed','claim_retained':True,'automatic_retry':False,'ready_verified':False,'failure_code':'DAEMON38_DISPATCH_UNCONFIRMED'})

def readback(p):
 need(DEPLOY_ENABLED);plan=checked_plan(p);need(p.claimed()=={**plan,'dispatch_may_have_occurred':True,'automatic_retry':False})
 returned=p.return_value();need(returned['claim_sha256']==p.claim_sha()and returned['normal_process_return_observed']is True)
 deployment=p.deployment(returned['url'],plan['marker']);first=p.inspect(deployment);identity=healthy(first,deployment,DAEMON)
 ids1=p.inventory();need(ids1==[identity['instance_id']]and plan['old']['instance_id']not in ids1)
 startup=p.startup(deployment,first['instances'][0]);second=p.inspect(deployment);ids2=p.inventory()
 need(healthy(second,deployment,DAEMON)==identity and ids2==ids1 and checked_plan(p)==plan)
 return p.save('ready',{'result':'passed','source_pins':plan['source_pins'],'deployment_id':deployment,'new_deployment_ready':True,'normal_create_return_observed':True,'old_instance_ids':[plan['old']['instance_id']],
  'old_instances_absent':True,'old_instance_absence_scope':'Absent from two complete current production inventories; no physical deletion proof','current_instance_ids':ids2,'ready_alive_instances':1,'memory_mib':2048,'region':'dub1',
  'native_cleanup_confirmed':True,'startup':startup,'paused38_full_preservation_verified':True,'db_native_pin_still_old':True,'claim_retained':True,'provider_mutations':False})

def main():
 need(DEPLOY_ENABLED and len(sys.argv)==2 and sys.argv[1]in('image-ready','prepare','deploy','readback'))
 p=Ports();action=sys.argv[1];value=observe_image(p)if action=='image-ready'else prepare(p)if action=='prepare'else dispatch(p)if action=='deploy'else readback(p)
 print(json.dumps(value));need(value['result']in('ready_image_and_import_gate_observed','prepared','submitted','passed'))

if __name__=='__main__':
 try:main()
 except Exception:print('DIAGNOSTIC38_DAEMON_RELEASE_UNCONFIRMED');sys.exit(1)
