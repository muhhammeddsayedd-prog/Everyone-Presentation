"""Fresh paired-image registry purpose. DISABLED pending Root source review.

Only pure validators/security helpers are reused; no historical state/main runs.
"""
from pathlib import Path
import datetime, importlib.util, json, os, re, sys
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
b=module('completion_registry_local_build',HERE/'build.py')
REGISTRY_ENABLED=False
MAIN=b.SOURCE_ROOT;ROOT=b.ROOT;EVIDENCE=b.EVIDENCE
PRIVATE=MAIN/'.local/completion-worker-registry'/b.RUN
DOCKER_CONFIG=PRIVATE/'docker-client';CONFIG=PRIVATE/'regctl-config.json'
CONFIG_BYTES=b'{"hosts":{"vcr.vercel.com":{"blobChunk":16777216,"blobMax":16777216}},"incDockerCred":true,"incDockerCert":false}\n'
PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1'
REPO='repo_OpIvBNiZ8vPVROs68HxcMb39W6yz';DAEMON_REPO='repo_4pE99mGA4WLDm9q9wUqA56Qd5p9K'
DIGESTS={'native':'sha256:46de2f0c0772e10d712fba514788d24041d6741faa8966b6fe9c554fe47e4af4','daemon':'sha256:2d66eed2c5f584f3f261d2f241062cbb9fa088bbbc32437aed1ce0b6adf2c594'}
KNOWN_NATIVE='sha256:50082f72d4438653d4c831a1f9a360d61e64d19b3568ed1c2a2456d486f0d77c'
NODE=Path('C:/Program Files/nodejs/node.exe');CLI=MAIN/'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js'
GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli'
REGCTL=MAIN/'.local/m07-pilot/tooling/regctl-v0.11.7.exe'
HELPERS=MAIN/'development/m07/specs-diagnostic-worker38/registry.py';HELPERS_SHA='5d7a4090e307d7c4eafa45e4effac090b9c516f824a93da6cc5d8d1d6c467b11'
EXPORT_HELPER=MAIN/'development/m03/english-oci34/export.py';EXPORT_HELPER_SHA='ed386e1e0fa8fa5f31b1af089e36f43b4cd1f9d95fb65b3a739e60335b763f53'
API={'project':'/v9/projects/'+PROJECT+'?teamId='+TEAM,'repository':'/v1/vcr/repository/'+REPO+'?projectId='+PROJECT+'&teamId='+TEAM,'daemon_repository':'/v1/vcr/repository/'+DAEMON_REPO+'?projectId='+PROJECT+'&teamId='+TEAM,'images':'/v1/vcr/repository/'+REPO+'/images?projectId='+PROJECT+'&teamId='+TEAM+'&limit=50'}
need=b.need;sha=b.sha;load=b.load
_helpers=None
def helpers():
 global _helpers
 need(sha(load(HELPERS))==HELPERS_SHA and sha(load(EXPORT_HELPER))==EXPORT_HELPER_SHA)
 if _helpers is None:_helpers=module('completion_registry_pure_helpers',HELPERS)
 return _helpers
def phase(kind,action):return PRIVATE/(b.kind_value(kind)+'-'+action+'.json')
def environment():
 value=b.environment();value.update(DOCKER_CONFIG=str(DOCKER_CONFIG),REGCTL_CONFIG=str(CONFIG),NODE_ENV='production',VERCEL_TELEMETRY_DISABLED='1',VERCEL_CLI_USE_NATIVE_BINARY='0')
 return value
def cli(arguments):return [str(NODE),str(CLI),*arguments,'--scope','muhammed-abdelrahman','--global-config',GLOBAL]
def refresh_command():return cli(['vcr','login','docker','--project',PROJECT,'--format','json'])
def api_command(operation):need(operation in API);return cli(['api',API[operation],'--method','GET','--raw'])
def copy_command(kind,proof):
 b.kind_value(kind);need(proof['index_digest']==DIGESTS[kind])
 relative=(b.PRIVATE/(kind+'-oci')).relative_to(MAIN).as_posix()
 return [str(REGCTL),'image','copy','ocidir://'+relative+'@'+DIGESTS[kind],b.target(kind)]
def get_command(reference):
 need(type(reference)is str and re.fullmatch(re.escape(b.PREFIX)+r'(?:native|daemon)(?:@sha256:[a-f0-9]{64}|:'+re.escape(b.TAG)+')',reference))
 return [str(REGCTL),'manifest','get',reference,'--format','raw-body']
def sources():
 pins=b.pins();r=helpers()
 for file,pin in [(HELPERS,HELPERS_SHA),(EXPORT_HELPER,EXPORT_HELPER_SHA),(MAIN/r.TRANSFER,r.TRANSFER_SHA),(MAIN/r.SECURITY,r.SECURITY_SHA),(MAIN/r.ACL,r.ACL_SHA),*[(MAIN/name,pin)for name,pin in r.SECURITY_IMPORTS.items()]]:
  need(sha(load(file))==pin);pins[str(file)]=pin
 for file,pin in [(REGCTL,'70f195ff4923082340738c796880864f66a296e6c5d3296bf743310653ad761f'),(r.HELPER,'2856e226b29ae2a9c67dd2419adbd527c03c34a84fc82454856b61f555c2b3b5'),(NODE,'9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de')]:need(sha(load(file,128*1024**2))==pin);pins[str(file)]=pin
 for name,pin in r.transport().oci.base.refresh.PINS.items():need(sha(load(CLI.parent/name))==pin);pins[str(CLI.parent/name)]=pin
 need(json.loads(load(CLI.parent.parent/'package.json'))['version']=='65.8.0')
 need(r.POWERSHELL.is_file()and not r.POWERSHELL.is_symlink()and r.POWERSHELL.resolve()==r.POWERSHELL and r.POWERSHELL.stat().st_nlink==2 and sha(r.POWERSHELL.read_bytes())==r.POWERSHELL_SHA);pins[str(r.POWERSHELL)]=r.POWERSHELL_SHA
 for file in [Path(__file__).resolve(),HERE/'test_registry.py',HERE/'REGISTRY.md']:pins[str(file)]=sha(load(file))
 return pins
def private_write(file,value,raw=False):
 need(file.parent in(PRIVATE,DOCKER_CONFIG)and file.resolve()==file and not file.exists());guard=helpers().private_security()
 body=value if raw else(json.dumps(value,sort_keys=True)+'\n').encode()
 with guard.create(file)as stream:guard.verify_open(stream);stream.write(body);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
def private_json(file):helpers().private_security().verify(file);return json.loads(load(file,2*1024**2))
def run(command,timeout=45):return b.base().mechanisms().bounded(command,environment(),timeout,'completion_registry')
def checked_response(value):return helpers().check_response(value)
def directory_acl(file,create=False):
 need(file in(PRIVATE,DOCKER_CONFIG,DOCKER_CONFIG/'config.json')and file.resolve()==file and not file.is_symlink())
 need(not create or file in(PRIVATE,DOCKER_CONFIG));r=helpers();env=environment();env['EPS_ACK31_RELEASE_PRIVATE']=str(file)
 result=b.base().mechanisms().bounded([str(r.POWERSHELL),'-NoProfile','-NonInteractive','-Command',r.acl_helper().program(create)],env,15,'completion_private_acl')
 value=json.loads(checked_response(result))
 r.validate_docker_config_acl(value)if file==DOCKER_CONFIG/'config.json'else r.acl_helper().validate(value)
def configs(create=False):
 owner={'purpose':'completion-worker-registry','run':b.RUN,'source_sha256':b.SOURCE,'project_id':PROJECT,'team_id':TEAM}
 if create and not PRIVATE.exists():
  PRIVATE.mkdir(parents=True);need(PRIVATE.resolve()==PRIVATE and not PRIVATE.is_symlink());directory_acl(PRIVATE,True);private_write(PRIVATE/'owner.json',owner)
 else:directory_acl(PRIVATE);need(private_json(PRIVATE/'owner.json')==owner)
 if create and not DOCKER_CONFIG.exists():DOCKER_CONFIG.mkdir();directory_acl(DOCKER_CONFIG,True)
 else:directory_acl(DOCKER_CONFIG)
 if create and not CONFIG.exists():private_write(CONFIG,CONFIG_BYTES,True)
 if create and not(DOCKER_CONFIG/'config.json').exists():private_write(DOCKER_CONFIG/'config.json',{'credsStore':'desktop','auths':{}})
 helpers().private_security().verify(CONFIG);need(load(CONFIG,4096)==CONFIG_BYTES);directory_acl(DOCKER_CONFIG/'config.json')
 value=json.loads(load(DOCKER_CONFIG/'config.json',16384));need(set(value)=={'credsStore','auths'}and value['credsStore']=='desktop'and value['auths']in({}, {'vcr.vercel.com':{}}))
def exported(kind):
 b.kind_value(kind);b.context('daemon');pointer=json.loads(load(b.artifact(kind,'export.success.json'),4096));file=ROOT/pointer['receipt']
 need(file.parent==EVIDENCE and sha(load(file,2*1024**2))==pointer['sha256']);value=json.loads(load(file,2*1024**2))
 need(value['result']=='passed'and value['kind']==kind and value['run']==b.RUN and value['source_sha256']==b.SOURCE and value['source_pins']==b.pins()and value['runtime_digest']==DIGESTS[kind])
 proof=value['archive'];folder=b.PRIVATE/(kind+'-oci');need(folder.resolve()==folder and not folder.is_symlink())
 expected={'oci-layout','index.json'}|{'blobs/sha256/'+row['digest'][7:]for row in proof['blobs']};actual=set()
 for file in folder.rglob('*'):
  need(not file.is_symlink()and file.resolve().is_relative_to(folder))
  if file.is_file():actual.add(file.relative_to(folder).as_posix())
 need(actual==expected and json.loads(load(folder/'oci-layout',4096))=={'imageLayoutVersion':'1.0.0'})
 index=json.loads(load(folder/'index.json',2*1024**2));need(index.get('schemaVersion')==2 and len(index.get('manifests',[]))==1)
 descriptor=index['manifests'][0];need(descriptor.get('digest')==DIGESTS[kind]and descriptor.get('mediaType')in(b.base().mechanisms().INDEX,b.base().mechanisms().MANIFEST)and descriptor.get('urls')in(None,[])and'data'not in descriptor)
 need(descriptor.get('size')==next(row['bytes']for row in proof['blobs']if row['digest']==DIGESTS[kind]))
 for row in proof['blobs']:
  observed,size=helpers().transport().file_hash(folder/'blobs/sha256'/row['digest'][7:]);need(observed==row['digest'][7:]and size==row['bytes'])
 return value,pointer

class Ports:
 def pins(self):return sources()
 def exported(self,kind):return exported(kind)
 def prepare(self,kind):configs(True)
 def exists(self,kind,action):return phase(kind,action+'.claim').exists()
 def claim(self,kind,action,value):private_write(phase(kind,action+'.claim'),value)
 def claimed(self,kind,action):return private_json(phase(kind,action+'.claim'))
 def returned(self,kind,action,value):private_write(phase(kind,action+'.returned'),value)
 def normal(self,kind,action):return private_json(phase(kind,action+'.returned'))if phase(kind,action+'.returned').exists()else None
 def claim_hash(self,kind,action):return sha(load(phase(kind,action+'.claim')))
 def admit(self,kind,value):private_write(phase(kind,'refresh.admitted'),value)
 def admitted_exists(self,kind):return phase(kind,'refresh.admitted').exists()
 def prepared(self,kind):
  value,ref=self.exported(kind);claim=self.claimed(kind,'prepare');need(claim['pins']==self.pins()and claim['export']==ref);configs();return value,ref
 def login_admitted(self,kind):
  value=private_json(phase(kind,'refresh.admitted'));claim=self.claimed(kind,'refresh');normal=self.normal(kind,'refresh')
  need(normal and normal['normal_return']is True and value==normal and claim['pins']==normal['pins']==self.pins()and normal['export']==claim['export']and normal['metadata']==claim['metadata']and normal['claim_sha256']==self.claim_hash(kind,'refresh'))
  need(datetime.timedelta(0)<=datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(normal['observed_at'])<datetime.timedelta(hours=11));configs()
 def run(self,command,timeout=45):return run(command,timeout)
 def api(self,operation):return json.loads(checked_response(self.run(api_command(operation))))
 def metadata(self):return helpers().project_metadata(self.api('project'),self.api('repository'),self.api('daemon_repository'))
 def remote(self,reference,expected):return helpers().remote_manifest(self.run(get_command(reference)),expected)
 def save(self,action,kind,value):
  file=EVIDENCE/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+kind+'-registry-'+action+'.json')
  b.exclusive(file,{'schema_version':'1.0','observed_at':b.stamp(),'action':action,'kind':kind,'run':b.RUN,'source_sha256':b.SOURCE,'project_id':PROJECT,'team_id':TEAM,'credentials_extracted':False,'raw_logs_or_credentials_persisted':False,'worker_deployed':False,'cli_internal_auth_maintenance_possible':True,'exact_wire_attempt_count_claimed':False,**value})
  return {'result':value['result'],'receipt':file.relative_to(ROOT).as_posix(),'action':action,'kind':kind}

def prepare(kind,p):
 need(REGISTRY_ENABLED);pins=p.pins();value,ref=p.exported(kind);need(not p.exists(kind,'prepare'));p.prepare(kind)
 p.claim(kind,'prepare',{'pins':pins,'export':ref,'prepared_at':b.stamp(),'automatic_retry':False})
 need(p.pins()==pins and p.exported(kind)==(value,ref))
 return p.save('prepare',kind,{'result':'passed','pins':pins,'export':ref,'provider_called':False})
def refresh(kind,p):
 need(REGISTRY_ENABLED);pins=p.pins();value,ref=p.prepared(kind);before=p.metadata();need(not p.exists(kind,'refresh'))
 p.claim(kind,'refresh',{'pins':pins,'export':ref,'metadata':before,'dispatch_may_have_occurred':True,'automatic_retry':False})
 normal=False;status='unconfirmed';failure=None
 try:
  need(p.pins()==pins and p.metadata()==before);login=helpers().login_result(checked_response(p.run(refresh_command())))
  returned={'normal_return':True,'pins':pins,'export':ref,'metadata':before,'claim_sha256':p.claim_hash(kind,'refresh'),'observed_at':b.stamp(),'login':login};p.returned(kind,'refresh',returned);normal=True
  p.remote(b.PREFIX+'native@'+KNOWN_NATIVE,KNOWN_NATIVE);need(p.metadata()==before and p.pins()==pins);p.admit(kind,returned);status='passed'
 except Exception as error:failure=helpers().safe_failure(error)
 return p.save('refresh',kind,{'result':status,'pins':pins,'export':ref,'normal_cli_return_observed':normal,'claim_retained':True,'automatic_login_retry':False,'failure_code':failure})
def copy_or_readback(action,kind,p):
 need(REGISTRY_ENABLED);pins=p.pins();value,ref=p.prepared(kind);proof=value['archive'];refresh_claim=p.claimed(kind,'refresh')
 need(refresh_claim['pins']==pins and refresh_claim['export']==ref);metadata=refresh_claim['metadata'];normal=None;failure=None
 if action=='copy':
  need(not p.exists(kind,'copy'));p.login_admitted(kind);need(p.metadata()==metadata);p.remote(b.PREFIX+'native@'+KNOWN_NATIVE,KNOWN_NATIVE)
  p.claim(kind,'copy',{'pins':pins,'export':ref,'metadata':metadata,'target':b.target(kind),'index_digest':proof['index_digest'],'runtime_digest':proof['runtime_digest'],'copy_may_have_occurred':True,'automatic_retry':False})
  try:
   need(p.pins()==pins and p.prepared(kind)==(value,ref)and p.metadata()==metadata);result=p.run(copy_command(kind,proof),1800)
   confirmed=result['exit_code']==0 and not result['timed_out']and not result['output_limit_exceeded']
   normal={'normal_return':confirmed,'claim_sha256':p.claim_hash(kind,'copy'),'exit_code':result['exit_code'],'timed_out':result['timed_out'],'output_limit_exceeded':result['output_limit_exceeded'],'failure_code':None if confirmed else helpers().transport().classify(result['stderr'],result['timed_out'],result['output_limit_exceeded'])};p.returned(kind,'copy',normal)
  except Exception as error:failure=helpers().safe_failure(error)
 else:need(action=='readback'and p.exists(kind,'copy'));normal=p.normal(kind,'copy')
 claim=p.claimed(kind,'copy');need(claim['pins']==pins and claim['export']==ref and claim['metadata']==metadata and claim['target']==b.target(kind))
 reads=[];status='unconfirmed'
 try:
  for unused in range(2):reads.append({'index_digest':p.remote(b.target(kind),proof['index_digest']),'runtime_digest':p.remote(b.PREFIX+kind+'@'+proof['runtime_digest'],proof['runtime_digest'])})
  need(reads[0]==reads[1]and p.pins()==pins and p.prepared(kind)==(value,ref)and p.metadata()==metadata and normal and normal['normal_return']is True and normal['claim_sha256']==p.claim_hash(kind,'copy'));status='passed'
 except Exception as error:failure=failure or helpers().safe_failure(error)
 return p.save(action,kind,{'result':status,'pins':pins,'export':ref,'target':b.target(kind),'index_digest':proof['index_digest'],'runtime_digest':proof['runtime_digest'],'normal_copy_return_observed':bool(normal and normal['normal_return']),'remote_readbacks':reads,'two_remote_reads_equal':len(reads)==2 and reads[0]==reads[1],'claim_retained':True,'automatic_copy_retry':False,'registry_ready_verified':False,'copy_failure_code':normal.get('failure_code')if normal else failure,'readback_failure_code':failure})
def refresh_readback(kind,p):
 need(REGISTRY_ENABLED and p.exists(kind,'refresh'));pins=p.pins();claim=p.claimed(kind,'refresh');value,ref=p.prepared(kind);normal=p.normal(kind,'refresh');status='unconfirmed';failure=None
 need(claim['pins']==pins and claim['export']==ref)
 try:
  need(p.metadata()==claim['metadata']);p.remote(b.PREFIX+'native@'+KNOWN_NATIVE,KNOWN_NATIVE)
  need(normal and normal['normal_return']is True and normal['claim_sha256']==p.claim_hash(kind,'refresh')and normal['pins']==pins and normal['export']==ref and normal['metadata']==claim['metadata']and p.pins()==pins)
  need(datetime.timedelta(0)<=datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(normal['observed_at'])<datetime.timedelta(hours=11))
  if not p.admitted_exists(kind):p.admit(kind,normal)
  p.login_admitted(kind);status='passed'
 except Exception as error:failure=helpers().safe_failure(error)
 return p.save('refresh-readback',kind,{'result':status,'pins':pins,'export':ref,'read_only':True,'login_submitted':False,'normal_cli_return_observed':bool(normal and normal['normal_return']),'claim_retained':True,'failure_code':failure})
def ready(kind,p):
 need(REGISTRY_ENABLED and kind=='native');pins=p.pins();value,ref=p.prepared(kind);observed={};status='unconfirmed';failure=None
 try:
  metadata=p.metadata();observed=helpers().project_ready(p.api('repository'),p.api('images'),DIGESTS['native']);need(p.pins()==pins and p.prepared(kind)==(value,ref)and p.metadata()==metadata);status='observed'
 except Exception as error:failure=helpers().safe_failure(error)
 return p.save('ready',kind,{'result':status,'pins':pins,'export':ref,'read_only':True,'provider_mutations':False,'expected_runtime_digest':DIGESTS['native'],'native_task_or_daemon_startup_proven':False,'failure_code':failure,**observed})
def main():
 need(REGISTRY_ENABLED and len(sys.argv)==3 and sys.argv[1]in('prepare','refresh','refresh-readback','copy','readback','ready'));action,kind=sys.argv[1:];b.kind_value(kind);p=Ports()
 result=prepare(kind,p)if action=='prepare'else refresh(kind,p)if action=='refresh'else refresh_readback(kind,p)if action=='refresh-readback'else ready(kind,p)if action=='ready'else copy_or_readback(action,kind,p)
 print(json.dumps(result),flush=True);need(result['result']in('passed','observed'))
if __name__=='__main__':
 try:main()
 except Exception:print('COMPLETION_REGISTRY_UNCONFIRMED',flush=True);sys.exit(1)
