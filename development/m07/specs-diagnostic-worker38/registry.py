"""Disabled fresh-purpose VCR login/copy/GET reconciliation. No auth-store reads.

Only Root executes. Import and fake-port tests never call CLI, Docker or network.
Executed local build files and every historical main/claim remain untouched.
"""
from pathlib import Path
import datetime, importlib.util, json, os, re, sys

HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2]
REGISTRY_ENABLED=True
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v);return v
b=module('diagnostic38_executed_local_build',HERE/'build.py')
RUN=b.RUN;SOURCE=b.SOURCE;PRIVATE=ROOT/'.local/specs-diagnostic-worker38-registry'/RUN
EVIDENCE=b.EVIDENCE
PROJECT='prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6';TEAM='team_gboXPxTevpCOZuaA8eY9PmR1';SLUG='muhammed-abdelrahman'
REPO='repo_OpIvBNiZ8vPVROs68HxcMb39W6yz'
DAEMON_REPO='repo_4pE99mGA4WLDm9q9wUqA56Qd5p9K'
DAEMON_REPO_PROOF='tracking/evidence/m07/controlled-pilot/2026-10-30T21-48-14.726Z-daemon-repository.json'
DAEMON_REPO_PROOF_SHA='4e9e5d2f9e24b703444025149f88f3fe03927988f768ad27671cc40ef5c25aad'
NODE=Path('C:/Program Files/nodejs/node.exe');CLI=ROOT/'.local/m07-pilot/tooling/node_modules/vercel/dist/vc.js'
GLOBAL='C:/Users/iway/AppData/Roaming/xdg.data/com.vercel.cli'
REGCTL=ROOT/'.local/m07-pilot/tooling/regctl-v0.11.7.exe'
POWERSHELL=Path('C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe')
POWERSHELL_SHA='9785001b0dcf755eddb8af294a373c0b87b2498660f724e76c4d53f9c217c7a3'
HELPER=b.DOCKER.parent/'docker-credential-desktop.exe'
CONFIG=PRIVATE/'regctl-config.json';DOCKER_CONFIG=PRIVATE/'docker-client'
CONFIG_BYTES=b'{"hosts":{"vcr.vercel.com":{"blobChunk":16777216,"blobMax":16777216}},"incDockerCred":true,"incDockerCert":false}\n'
NATIVE_EXPORT='tracking/evidence/m07/specs-diagnostic-worker38/2026-11-01T17-58-00-384612Z-native-export.json'
NATIVE_EXPORT_SHA='daa27319405e2734ddf23574ab44b03c45b989c87733f87dc7d3bde2b91215ee'
NATIVE_DIGEST='sha256:50082f72d4438653d4c831a1f9a360d61e64d19b3568ed1c2a2456d486f0d77c'
KNOWN_NATIVE='sha256:795f8f7736594fb51cc0c304d85bae9d29f31861e606eec0c2a83806fff5d3b9'
TRANSFER='development/m03/english-oci34/transfer.py';TRANSFER_SHA='f9694ac52fec08b24ab81c8a25ad4aa4c6ac0986fbfcdfc06d70ab724d23a5e3'
SECURITY='tools/provision_logo_verifier.py';SECURITY_SHA='660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c'
SECURITY_IMPORTS={'tools/release_foundation.py':'02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751','tools/release_logo.py':'efd1de07b3304d8d5c89f29bbeaf77ff2ce1d8d42ffbf885f960c36f506b47f4'}
ACL='development/m07/specs-ack31/canonical_acl.py';ACL_SHA='6f711e8f3940120158982dd338f838a424c2b5b620a721136f06d4587a2682fc'
BUILD_PINS={'build.py':'2548608d9bf12bea7b48b2535e208fc2e9d7452a6113531eaf64b685565834fc','test_build.py':'456f905d32876f4a5c512b75015fef3e2cb9a4d371b70f9c5754e3360b1ed732','README.md':'6a8bc79ceb9d58ec96a21b8daadf6040fdd979b094a8e3ca81fa8e189a94a544'}
API={'project':'/v9/projects/'+PROJECT+'?teamId='+TEAM,'repository':'/v1/vcr/repository/'+REPO+'?projectId='+PROJECT+'&teamId='+TEAM,'daemon_repository':'/v1/vcr/repository/'+DAEMON_REPO+'?projectId='+PROJECT+'&teamId='+TEAM,'images':'/v1/vcr/repository/'+REPO+'/images?projectId='+PROJECT+'&teamId='+TEAM+'&limit=50'}
need=b.need;sha=b.sha;load=b.load;digest=b.digest;stamp=b.stamp;kind_value=b.kind_value

def transport():
 need(sha(load(ROOT/TRANSFER))==TRANSFER_SHA)
 return module('diagnostic38_frozen_pure_registry_transport',ROOT/TRANSFER)

def phase(kind,suffix):return PRIVATE/(kind_value(kind)+'-'+suffix)
def folder(kind):return PRIVATE/(kind_value(kind)+'-oci')
def target(kind):return b.target(kind)

def sources():
 pins=b.source_pins()
 for name,pin in BUILD_PINS.items():need(sha(load(HERE/name))==pin)
 for file,pin in [(ROOT/TRANSFER,TRANSFER_SHA),(ROOT/SECURITY,SECURITY_SHA),(ROOT/ACL,ACL_SHA)]:need(sha(load(file))==pin);pins[file.relative_to(ROOT).as_posix()]=pin
 for relative,pin in SECURITY_IMPORTS.items():need(sha(load(ROOT/relative))==pin);pins[relative]=pin
 for file,pin in [(REGCTL,'70f195ff4923082340738c796880864f66a296e6c5d3296bf743310653ad761f'),(HELPER,'2856e226b29ae2a9c67dd2419adbd527c03c34a84fc82454856b61f555c2b3b5'),(NODE,'9a4eb5f1c29c6a2e93852ead46b999e284a6a5ca8bab4d4e241d587d025a52de')]:need(sha(load(file,128*1024**2))==pin);pins[file.name]=pin
 old=transport().oci.base.refresh
 for relative,pin in old.PINS.items():need(sha(load(CLI.parent/relative))==pin);pins['cli/'+relative]=pin
 need(json.loads(load(CLI.parent.parent/'package.json'))['version']=='65.8.0')
 need(POWERSHELL.is_file()and not POWERSHELL.is_symlink()and POWERSHELL.resolve()==POWERSHELL and POWERSHELL.stat().st_nlink==2 and POWERSHELL.stat().st_size==455680 and sha(POWERSHELL.read_bytes())==POWERSHELL_SHA);pins['powershell_sha256']=POWERSHELL_SHA
 for file in [HERE/'registry.py',HERE/'test_registry.py',HERE/'REGISTRY.md']:pins[file.relative_to(ROOT).as_posix()]=sha(load(file))
 pins[NATIVE_EXPORT]=NATIVE_EXPORT_SHA;need(sha(load(ROOT/NATIVE_EXPORT))==NATIVE_EXPORT_SHA)
 raw=load(ROOT/DAEMON_REPO_PROOF);need(sha(raw)==DAEMON_REPO_PROOF_SHA);proof=json.loads(raw)
 need(proof['result']=='passed'and proof['project_id']==PROJECT and proof['repository']=={'id':DAEMON_REPO,'name':'daemon','public':False});pins[DAEMON_REPO_PROOF]=DAEMON_REPO_PROOF_SHA
 return dict(sorted(pins.items()))

def export_state(kind):
 v=b.load_success(kind);pointer=json.loads(load(b.artifact(kind,'export.success.json'),4096))
 if kind=='native':need(pointer=={'receipt':NATIVE_EXPORT,'sha256':NATIVE_EXPORT_SHA}and v['runtime_digest']==NATIVE_DIGEST)
 # A later manifest is permitted only through the unchanged build validator,
 # tied to this actual local native export. No old795/source relabeling.
 b.verify_context('daemon'if(b.CONTEXT/'apps/worker/native-sandbox-manifest.json').exists()else'native')
 return v,pointer

def verify_directory(kind,proof):
 location=folder(kind);need(location.is_dir()and not location.is_symlink()and location.resolve()==location)
 expected={'oci-layout','index.json'}|{'blobs/sha256/'+r['digest'][7:]for r in proof['blobs']};actual=set()
 for path in location.rglob('*'):
  need(not path.is_symlink()and path.resolve().is_relative_to(location))
  if path.is_file():actual.add(path.relative_to(location).as_posix())
 need(actual==expected and json.loads(load(location/'oci-layout',4096))=={'imageLayoutVersion':'1.0.0'})
 index=json.loads(load(location/'index.json',2*1024**2));need(index.get('schemaVersion')==2 and type(index.get('manifests'))is list and len(index['manifests'])==1)
 desc=index['manifests'][0];need(desc.get('digest')==proof['index_digest']and desc.get('mediaType')in(b.mechanisms().INDEX,b.mechanisms().MANIFEST)and desc.get('urls')in(None,[])and'data'not in desc)
 for row in proof['blobs']:
  got,size=transport().file_hash(location/'blobs/sha256'/row['digest'][7:]);need(got==row['digest'][7:]and size==row['bytes'])
 need(desc.get('size')==next(r['bytes']for r in proof['blobs']if r['digest']==desc['digest']))

def environment(ambient=None):
 result=b.environment(os.environ if ambient is None else ambient)
 result.update(DOCKER_CONFIG=str(DOCKER_CONFIG),REGCTL_CONFIG=str(CONFIG),NODE_ENV='production',VERCEL_TELEMETRY_DISABLED='1',VERCEL_CLI_USE_NATIVE_BINARY='0')
 return result
def cli(arguments):return transport().oci.base.refresh.cli(arguments)
def api_command(operation):need(operation in API);return cli(['api',API[operation],'--method','GET','--raw'])
def refresh_command():return cli(['vcr','login','docker','--project',PROJECT,'--format','json'])
def copy_command(kind,proof):
 relative=folder(kind).relative_to(ROOT).as_posix()
 return [str(REGCTL),'image','copy','ocidir://'+relative+'@'+digest(proof['index_digest']),target(kind)]
def get_command(reference):
 need(type(reference)is str and re.fullmatch(re.escape(b.PREFIX)+r'(?:native|daemon)(?:@sha256:[a-f0-9]{64}|:'+re.escape(b.TAG)+')',reference))
 return [str(REGCTL),'manifest','get',reference,'--format','raw-body']

def security_module():
 need(sha(load(ROOT/SECURITY))==SECURITY_SHA)
 for relative,pin in SECURITY_IMPORTS.items():need(sha(load(ROOT/relative))==pin)
 prior=list(sys.path)
 try:sys.path.insert(0,str(ROOT/'tools'));return module('diagnostic38_registry_private_files',ROOT/SECURITY)
 finally:sys.path[:]=prior
def private_security():return security_module().WindowsPrivateFiles()
def private_write(path,value,raw=False):
 need(path.resolve()==path and path.is_relative_to(PRIVATE)and not path.exists())
 path.parent.mkdir(parents=True,exist_ok=True);need(path.parent.resolve()==path.parent and not path.parent.is_symlink())
 body=value if raw else(json.dumps(value,sort_keys=True)+'\n').encode();guard=private_security()
 with guard.create(path)as stream:guard.verify_open(stream);stream.write(body);stream.flush();os.fsync(stream.fileno());guard.verify_open(stream)
def private_json(path):private_security().verify(path);return json.loads(load(path,2*1024**2))
def acl_helper():
 need(sha(load(ROOT/ACL))==ACL_SHA);return module('diagnostic38_task_acl',ROOT/ACL)
def validate_docker_config_acl(value):
 # Only this source-only helper-routing file may inherit the exact protected
 # parent ACL when Docker atomically replaces it. Other private files stay strict.
 need(type(value)is dict and set(value)=={'current_sid','owner_sid','protected','rules'})
 sid=value['current_sid'];need(type(sid)is str and re.fullmatch(r'S-1-[0-9]+(?:-[0-9]+)+',sid)and value['owner_sid']==sid and type(value['protected'])is bool)
 need(type(value['rules'])is list and len(value['rules'])==2);seen=set()
 for rule in value['rules']:
  need(type(rule)is dict and set(rule)=={'sid','rights','inheritance_flags','propagation_flags','inherited','type'}and rule['sid']in(sid,'S-1-5-18')and rule['sid']not in seen)
  need(all(type(rule[k])is int for k in ['rights','inheritance_flags','propagation_flags','type'])and type(rule['inherited'])is bool)
  need(rule['rights']==0x1f01ff and rule['inheritance_flags']==0 and rule['propagation_flags']==0 and rule['type']==0 and rule['inherited']is not value['protected']);seen.add(rule['sid'])
 need(seen=={sid,'S-1-5-18'})
def directory_acl(path,created=False):
 need(path in(PRIVATE,DOCKER_CONFIG,DOCKER_CONFIG/'config.json')and path.resolve()==path and not path.is_symlink())
 need(type(created)is bool and(not created or path in(PRIVATE,DOCKER_CONFIG)))
 env=environment();env['EPS_ACK31_RELEASE_PRIVATE']=str(path)
 response=b.mechanisms().bounded([str(POWERSHELL),'-NoProfile','-NonInteractive','-Command',acl_helper().program(created)],env,15,'task_private_acl')
 value=json.loads(check_response(response))
 if path==DOCKER_CONFIG/'config.json':validate_docker_config_acl(value)
 else:acl_helper().validate(value)
 return value
def protect_directories():
 for path in [PRIVATE,DOCKER_CONFIG]:
  path.mkdir(parents=True,exist_ok=True);need(path.resolve()==path and path.is_dir()and not path.is_symlink());directory_acl(path,True)
def configs():
 directory_acl(PRIVATE);directory_acl(DOCKER_CONFIG)
 if not CONFIG.exists():private_write(CONFIG,CONFIG_BYTES,True)
 config=DOCKER_CONFIG/'config.json'
 if not config.exists():private_write(config,{'credsStore':'desktop','auths':{}})
 private_security().verify(CONFIG);directory_acl(config)
 need(load(CONFIG,4096)==CONFIG_BYTES)
 # This task-owned configuration contains only helper routing and empty auth
 # descriptors. Credential values remain inside the normal Desktop helper.
 v=json.loads(load(config,16384));need(type(v)is dict and set(v)=={'credsStore','auths'}and v['credsStore']=='desktop'
  and v['auths']in({}, {'vcr.vercel.com':{}}))

def safe_failure(error):
 code=str(error)
 return code if code in {'OPERATION_TIMEOUT','OUTPUT_LIMIT_EXCEEDED','TLS_HANDSHAKE_TIMEOUT','TLS_CERTIFICATE_ERROR','DNS_FAILURE','HTTP_401','HTTP_403','HTTP_404','HTTP_413','HTTP_429','HTTP_5XX','NETWORK_CONNECTION_FAILED','TRANSPORT_UNCONFIRMED','REMOTE_MANIFEST_DIGEST_MISMATCH'}else'REGISTRY_OPERATION_UNCONFIRMED'
def check_response(result):
 if result['exit_code']!=0 or result['timed_out']is not False or result['output_limit_exceeded']is not False:raise ValueError(transport().classify(result['stderr'],result['timed_out'],result['output_limit_exceeded']))
 return result['stdout']
def repository_metadata(repository,identity,name):
 need((identity,name)in((REPO,'native'),(DAEMON_REPO,'daemon')))
 row=repository.get('repository');need(type(row)is dict and row.get('id')==identity and row.get('projectId')==PROJECT and row.get('name')==name and row.get('public')is False)
 return {'id':identity,'project_id':PROJECT,'name':name,'public':False}
def project_metadata(project,native,daemon):
 need(project.get('id')==PROJECT and project.get('accountId')==TEAM and project.get('name')=='everyone-presentation-worker-pilot')
 return {'project_id':PROJECT,'team_id':TEAM,'repositories':{'native':repository_metadata(native,REPO,'native'),'daemon':repository_metadata(daemon,DAEMON_REPO,'daemon')}}
def login_result(raw):
 value=json.loads(raw);need(value=={'status':'success','engine':'docker','registry':'vcr.vercel.com','username':'oidc','validForHours':12});return value
def remote_manifest(result,expected):
 if result['exit_code']!=0 or result['timed_out']or result['output_limit_exceeded']:raise ValueError(transport().classify(result['stderr'],result['timed_out'],result['output_limit_exceeded']))
 parsed=json.loads(transport().body(result['stdout'],digest(expected)))
 need(parsed.get('schemaVersion')==2 and parsed.get('mediaType')in(b.mechanisms().INDEX,b.mechanisms().MANIFEST));return expected

def project_ready(repository,payload,expected):
 row=repository.get('repository');repository_metadata(repository,REPO,'native')
 def time(v):return type(v)is str and len(v)<=40 and re.fullmatch(r'\d{4}-\d{2}-\d{2}T[0-9:.]+Z',v)and datetime.datetime.fromisoformat(v.replace('Z','+00:00'))
 need(time(row.get('createdAt'))and time(row.get('updatedAt'))and type(payload.get('images'))is list and len(payload['images'])<=50)
 need('nextCursor'not in payload or type(payload['nextCursor'])is str and len(payload['nextCursor'])<=2048)
 rows=[];seen=set()
 for item in payload['images']:
  identity=item.get('id');tags=item.get('tags');need(type(identity)is str and re.fullmatch('[A-Za-z0-9_-]{1,160}',identity)and identity not in seen and item.get('repositoryId')==REPO)
  digest(item.get('manifestDigest'));need(item.get('kind')in('attestation','index','manifest')and item.get('status')in(None,'errored','preparing','ready','unoptimized')and type(item.get('sizeInBytes'))is int and 0<=item['sizeInBytes']<=200*1024**3 and time(item.get('createdAt')))
  need(type(tags)is list and len(tags)<=50 and all(type(tag)is str and re.fullmatch('[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}',tag)for tag in tags))
  for key in ['arch','platform']:need(key not in item or type(item[key])is str and re.fullmatch('[a-z0-9_-]{1,20}',item[key]))
  rows.append({'id':identity,'repository_id':REPO,'manifest_digest':item['manifestDigest'],'kind':item['kind'],'status':item['status'],'architecture':item.get('arch'),'platform':item.get('platform'),'size_bytes':item['sizeInBytes'],'tags':tags,'created_at':item['createdAt']});seen.add(identity)
 matching=[v for v in rows if v['manifest_digest']==digest(expected)]
 need(len(matching)==1 and matching[0]['kind']=='manifest'and matching[0]['status']=='ready'and matching[0]['architecture']=='amd64'and matching[0]['platform']=='linux')
 return {'repository':{'id':REPO,'project_id':PROJECT,'name':'native','public':False,'expected_private':True,'privacy_matches_expected':True,'created_at':row['createdAt'],'updated_at':row['updatedAt']},'images':{'images':rows,'has_more':bool(payload.get('nextCursor')),'limit':50,'pagination_followed':False}}

class Ports:
 def pins(self):return sources()
 def exported(self,kind):return export_state(kind)
 def prepared(self,kind):
  value=private_json(phase(kind,'prepare.claim.json'));v,ref=self.exported(kind)
  need(value['source_pins']==self.pins()and value['export']==ref);configs();verify_directory(kind,v['archive']);return v,ref
 def exists(self,kind,action):return phase(kind,action+'.claim.json').exists()
 def claim(self,kind,action,value):private_write(phase(kind,action+'.claim.json'),value)
 def claim_value(self,kind,action):return private_json(phase(kind,action+'.claim.json'))
 def prepare(self,kind,v):
  protect_directories();configs();proof=b.mechanisms().archive_proof(b.artifact(kind,'export.tar'),folder(kind));need(proof==v['archive']);verify_directory(kind,proof)
 def run(self,cmd,timeout=45):return b.mechanisms().bounded(cmd,environment(),timeout,'diagnostic38_registry')
 def api(self,operation):return json.loads(check_response(self.run(api_command(operation))))
 def metadata(self):return project_metadata(self.api('project'),self.api('repository'),self.api('daemon_repository'))
 def remote(self,reference,expected):return remote_manifest(self.run(get_command(reference)),expected)
 def returned(self,kind,action,value):private_write(phase(kind,action+'.returned.json'),value)
 def returned_value(self,kind,action):return private_json(phase(kind,action+'.returned.json'))if phase(kind,action+'.returned.json').exists()else None
 def admit_login(self,kind,value):
  path=phase(kind,'refresh.admitted.json')
  if path.exists():need(private_json(path)==value)
  else:private_write(path,value)
 def login_admitted(self,kind):
  value=self.returned_value(kind,'refresh');claim=self.claim_value(kind,'refresh');admitted=private_json(phase(kind,'refresh.admitted.json'))
  need(value and value['normal_return']is True and value['source_pins']==self.pins()==claim['source_pins']and value['claim_sha256']==sha(load(phase(kind,'refresh.claim.json'))))
  need(admitted=={'source_pins':value['source_pins'],'claim_sha256':value['claim_sha256'],'normal_return_sha256':sha(load(phase(kind,'refresh.returned.json'))),'known_manifest_read_verified':True,'metadata_unchanged':True})
  login_result(json.dumps(value['login']));issued=datetime.datetime.fromisoformat(value['observed_at'])
  need(datetime.timedelta(0)<=datetime.datetime.now(datetime.timezone.utc)-issued<datetime.timedelta(hours=11));configs()
 def claim_hash(self,kind,action):return sha(load(phase(kind,action+'.claim.json')))
 def return_hash(self,kind,action):return sha(load(phase(kind,action+'.returned.json')))
 def save(self,action,kind,value):
  path=EVIDENCE/(datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')+'-'+kind+'-registry-'+action+'.json')
  b.exclusive(path,{'schema_version':'1.0','observed_at':stamp(),'action':action,'kind':kind,'run':RUN,'source_sha256':SOURCE,'project_id':PROJECT,'team_id':TEAM,'raw_logs_or_credentials_persisted':False,'credentials_extracted':False,'worker_deployed':False,'db_jobs_or_openai_n8n_calls':False,'cli_internal_auth_maintenance_possible':True,'exact_wire_attempt_count_claimed':False,**value})
  return {'result':value['result'],'receipt':path.relative_to(ROOT).as_posix(),'action':action,'kind':kind}

def prepare(kind,p):
 need(REGISTRY_ENABLED)
 pins=p.pins();v,ref=p.exported(kind);need(not p.exists(kind,'prepare'))
 p.claim(kind,'prepare',{'source_pins':pins,'export':ref,'local_extraction_may_have_occurred':True,'automatic_retry':False})
 result='unconfirmed';failure=None
 try:p.prepare(kind,v);need(p.pins()==pins and p.exported(kind)==(v,ref));result='passed'
 except Exception as error:failure=safe_failure(error)
 return p.save('prepare',kind,{'result':result,'export':ref,'source_pins':pins,'provider_mutations':False,'claim_retained':True,'failure_code':failure})

def refresh(kind,p):
 need(REGISTRY_ENABLED)
 pins=p.pins();v,ref=p.prepared(kind);before=p.metadata();need(not p.exists(kind,'refresh'))
 p.claim(kind,'refresh',{'source_pins':pins,'export':ref,'metadata':before,'dispatch_may_have_occurred':True,'automatic_retry':False})
 result='unconfirmed';normal=False;failure=None
 try:
  need(p.pins()==pins and p.metadata()==before);login=login_result(check_response(p.run(refresh_command())))
  returned={'normal_return':True,'observed_at':stamp(),'source_pins':pins,'claim_sha256':p.claim_hash(kind,'refresh'),'login':login}
  p.returned(kind,'refresh',returned);normal=True
  p.remote(b.PREFIX+'native@'+KNOWN_NATIVE,KNOWN_NATIVE);need(p.metadata()==before and p.pins()==pins)
  p.admit_login(kind,{'source_pins':pins,'claim_sha256':p.claim_hash(kind,'refresh'),'normal_return_sha256':p.return_hash(kind,'refresh'),'known_manifest_read_verified':True,'metadata_unchanged':True});result='passed'
 except Exception as error:failure=safe_failure(error)
 return p.save('refresh',kind,{'result':result,'source_pins':pins,'export':ref,'normal_cli_return_observed':normal,'claim_retained':True,'automatic_login_retry':False,'token_extracted':False,'failure_code':failure})

def copy_or_readback(action,kind,p):
 need(REGISTRY_ENABLED)
 pins=p.pins();v,ref=p.prepared(kind);proof=v['archive'];normal=None;failure=None
 refreshed=p.claim_value(kind,'refresh');need(refreshed['source_pins']==pins and refreshed['export']==ref)
 expected_metadata=refreshed['metadata']
 if action=='copy':
  need(not p.exists(kind,'copy'));p.login_admitted(kind)
  need(p.metadata()==expected_metadata)
  p.remote(b.PREFIX+'native@'+KNOWN_NATIVE,KNOWN_NATIVE)
  need(p.metadata()==expected_metadata)
  p.claim(kind,'copy',{'source_pins':pins,'export':ref,'target':target(kind),'metadata':expected_metadata,'index_digest':proof['index_digest'],'runtime_digest':proof['runtime_digest'],'copy_may_have_occurred':True,'automatic_retry':False})
  try:
   need(p.pins()==pins and p.prepared(kind)==(v,ref)and p.metadata()==expected_metadata)
   r=p.run(copy_command(kind,proof),1800)
   normal={'claim_sha256':p.claim_hash(kind,'copy'),'normal_return':r['exit_code']==0 and r['timed_out']is False and r['output_limit_exceeded']is False,'exit_code':r['exit_code'],'timed_out':r['timed_out'],'output_limit_exceeded':r['output_limit_exceeded'],'failure_code':None if r['exit_code']==0 and r['timed_out']is False and r['output_limit_exceeded']is False else transport().classify(r['stderr'],r['timed_out'],r['output_limit_exceeded'])}
   p.returned(kind,'copy',normal)
  except Exception as error:failure=safe_failure(error)
 else:need(action=='readback'and p.exists(kind,'copy'));normal=p.returned_value(kind,'copy')
 claim=p.claim_value(kind,'copy');need(claim['source_pins']==pins and claim['export']==ref and claim['target']==target(kind)and claim['metadata']==expected_metadata)
 reads=[];result='unconfirmed'
 try:
  for unused in range(2):reads.append({'index_digest':p.remote(target(kind),proof['index_digest']),'runtime_digest':p.remote(b.PREFIX+kind+'@'+proof['runtime_digest'],proof['runtime_digest'])})
  need(reads[0]==reads[1]and p.pins()==pins and p.prepared(kind)==(v,ref)and p.metadata()==expected_metadata)
  need(normal and normal['normal_return']is True and normal['claim_sha256']==p.claim_hash(kind,'copy'));result='passed'
 except Exception as error:failure=failure or safe_failure(error)
 return p.save(action,kind,{'result':result,'source_pins':pins,'export':ref,'target':target(kind),'index_digest':proof['index_digest'],'runtime_digest':proof['runtime_digest'],'normal_copy_return_observed':bool(normal and normal['normal_return']),'remote_readbacks':reads,'two_remote_reads_equal':len(reads)==2 and reads[0]==reads[1],'configured_chunk_bytes':16777216,'monolithic_threshold_bytes':16777216,'server_chunk_minimum_can_override_configuration':True,'tls_fix_claimed':False,'claim_retained':True,'automatic_copy_retry':False,'registry_ready_verified':False,'native_or_job_acceptance':False,'copy_failure_code':normal.get('failure_code')if normal else failure,'readback_failure_code':failure})

def refresh_readback(kind,p):
 need(REGISTRY_ENABLED and p.exists(kind,'refresh'));pins=p.pins();claim=p.claim_value(kind,'refresh');v,ref=p.prepared(kind)
 need(claim['source_pins']==pins and claim['export']==ref)
 normal=p.returned_value(kind,'refresh');result='unconfirmed';failure=None;read=False
 try:
  need(p.metadata()==claim['metadata']);p.remote(b.PREFIX+'native@'+KNOWN_NATIVE,KNOWN_NATIVE);read=True
  need(p.pins()==pins and normal and normal['normal_return']is True and normal['source_pins']==pins and normal['claim_sha256']==p.claim_hash(kind,'refresh'));login_result(json.dumps(normal['login']))
  issued=datetime.datetime.fromisoformat(normal['observed_at']);need(datetime.timedelta(0)<=datetime.datetime.now(datetime.timezone.utc)-issued<datetime.timedelta(hours=11))
  p.admit_login(kind,{'source_pins':pins,'claim_sha256':p.claim_hash(kind,'refresh'),'normal_return_sha256':p.return_hash(kind,'refresh'),'known_manifest_read_verified':True,'metadata_unchanged':True});result='passed'
 except Exception as error:failure=safe_failure(error)
 return p.save('refresh-readback',kind,{'result':result,'source_pins':pins,'export':ref,'read_only':True,'provider_mutations':False,'known_manifest_read_verified':read,'normal_cli_return_observed':bool(normal and normal['normal_return']),'login_submitted':False,'claim_retained':True,'failure_code':failure})

def ready(kind,p):
 need(REGISTRY_ENABLED and kind=='native');pins=p.pins();v,ref=p.exported(kind)
 observed={};result='unconfirmed';failure=None
 try:observed=project_ready(p.api('repository'),p.api('images'),v['runtime_digest']);need(p.pins()==pins and p.exported(kind)==(v,ref));result='observed'
 except Exception as error:failure=safe_failure(error)
 return p.save('ready',kind,{'result':result,'read_only':True,'provider_mutations':False,'source_pins':pins,'export':ref,'expected_runtime_digest':v['runtime_digest'],'private_configuration_requested':False,'raw_payload_persisted':False,'credentials_in_report':False,'native_task_or_daemon_ready_acceptance':False,'failure_code':failure,**observed})

def main():
 need(REGISTRY_ENABLED and len(sys.argv)==3 and sys.argv[1]in('prepare','refresh','refresh-readback','copy','readback','ready'))
 action=sys.argv[1];kind=kind_value(sys.argv[2]);p=Ports()
 result=prepare(kind,p)if action=='prepare'else refresh(kind,p)if action=='refresh'else refresh_readback(kind,p)if action=='refresh-readback'else ready(kind,p)if action=='ready'else copy_or_readback(action,kind,p)
 print(json.dumps(result));need(result['result']in('passed','observed'))

if __name__=='__main__':
 try:main()
 except Exception:print('DIAGNOSTIC38_REGISTRY_UNCONFIRMED');sys.exit(1)
