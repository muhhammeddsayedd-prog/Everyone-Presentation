"""Disabled new once-only registry phases; same normal CLI and OCI transport."""
from pathlib import Path
import datetime,importlib.util,json,os,re,sys
HERE=Path(__file__).resolve().parent
REGISTRY_ENABLED=False
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
b=module('worker_identity_registry_build',HERE/'build.py');need=b.need;load=b.load;sha=b.sha
CONFIG=b'{"hosts":{"vcr.vercel.com":{"blobChunk":16777216,"blobMax":16777216}},"incDockerCred":true,"incDockerCert":false}\n'
REGCTL_SHA='70f195ff4923082340738c796880864f66a296e6c5d3296bf743310653ad761f'
CREDENTIAL_HELPER_SHA='2856e226b29ae2a9c67dd2419adbd527c03c34a84fc82454856b61f555c2b3b5'

def normal(p,phase):
 if not p.exists(phase+'.normal.json'):return None
 value=p.read(phase+'.normal.json');need(value['claim_sha256']==p.hash(phase+'.claim.json')and value['normal_return_observed']is True);return value['value']
def project_remote(result,expected,helpers,oci):
 # The old remote_manifest wrapper calls its historical whole-emitter guard to
 # obtain these two constants. Keep its actual response/body validators while
 # taking the constants from the separately verified existing OCI library.
 need(type(expected)is str and re.fullmatch('sha256:[a-f0-9]{64}',expected));raw=helpers.check_response(result);parsed=json.loads(helpers.transport().body(raw,expected));need(parsed.get('schemaVersion')==2 and parsed.get('mediaType')in(oci.INDEX,oci.MANIFEST));return expected
def operate(action,kind,p):
 need(REGISTRY_ENABLED and action in('prepare','refresh','refresh-readback','copy','readback','ready'));b.kind_value(kind);pins=p.pins();exported=p.exported(kind)
 if action=='prepare':
  need(not p.exists(kind+'-prepare.claim.json'));p.prepare();return b.once(p,kind+'-prepare',lambda:{'export':exported,'provider_called':False})
 prepared=normal(p,kind+'-prepare');need(prepared is not None and prepared['export']==exported)
 if action=='refresh':
  before=p.metadata()
  def refresh():
   need(p.metadata()==before);login=p.login();need(p.metadata()==before);p.control();return {'login':login,'metadata':before,'observed_at':b.stamp()}
  return b.once(p,'refresh',refresh)
 if action=='refresh-readback':
  claim=p.read('refresh.claim.json');need(claim['source_pins']==pins);value=normal(p,'refresh');p.control()
  need(value is not None and p.metadata()==value['metadata']);return {'result':'observed','read_only':True,'normal_cli_return_observed':True,'login_replayed':False}
 refreshed=normal(p,'refresh');need(refreshed is not None and datetime.timedelta(0)<=datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(refreshed['observed_at'])<datetime.timedelta(hours=11));need(p.metadata()==refreshed['metadata'])
 if action=='copy':
  p.control()
  def copy():p.copy(kind,exported);return {'runtime_digest':exported['runtime_digest'],'normal_copy_return_observed':True,'metadata':refreshed['metadata']}
  b.once(p,kind+'-copy',copy)
 if action in('copy','readback'):
  claim=p.read(kind+'-copy.claim.json');need(claim['source_pins']==pins);returned=normal(p,kind+'-copy');one,two=p.remote(kind,exported),p.remote(kind,exported);need(one==two and p.metadata()==refreshed['metadata']and p.pins()==pins)
  return {'result':'passed'if returned else'unconfirmed','normal_copy_return_observed':returned is not None,'runtime_digest':exported['runtime_digest'],'source_sha256':p.build.source['source_sha256'],'two_remote_reads_equal':True,'read_only':action=='readback','normal_return_not_inferred':True,'automatic_retry':False}
 need(action=='ready'and normal(p,kind+'-copy')is not None);one,two=p.ready(kind,exported),p.ready(kind,exported);need(one==two and p.pins()==pins);return {'result':'observed','read_only':True,'provider_mutations':False,**one}

class Ports:
 def __init__(self,build):
  self.build=build;self.l=build.l;self.h=self.l.registry.helpers();self.private=build.private/'registry';self.docker=self.private/'docker-client';self.config=self.private/'regctl-config.json';self.guard=self.l.guard()
 def file(self,name):need(re.fullmatch('[A-Za-z0-9_.-]+',name)and name not in('.','..'));return self.private/name
 def exists(self,name):return self.file(name).exists()
 def read(self,name):file=self.file(name);self.guard.verify(file);return json.loads(load(file))
 def hash(self,name):file=self.file(name);self.guard.verify(file);return sha(load(file))
 def write(self,name,value):
  raw=value if type(value)is bytes else b.compact(value)+b'\n'
  with self.guard.create(self.file(name))as stream:self.guard.verify_open(stream);stream.write(raw);stream.flush();os.fsync(stream.fileno());self.guard.verify_open(stream)
 def environment(self):
  value=self.l.registry.environment();value.update(DOCKER_CONFIG=str(self.docker),REGCTL_CONFIG=str(self.config));return value
 def run(self,args,timeout=45):return self.l.oci.bounded(args,self.environment(),timeout,'worker_identity_registry_same_transport')
 def pins(self):
  result=self.build.pins()
  for name in('registry.py','test_registry.py'):result[str(HERE/name)]=sha(load(HERE/name))
  for file,digest in((self.l.registry.REGCTL,REGCTL_SHA),(self.h.HELPER,CREDENTIAL_HELPER_SHA)):
   need(sha(load(file,128*1024**2))==digest);result[str(file)]=digest
  for relative,digest in((self.h.TRANSFER,self.h.TRANSFER_SHA),(self.h.SECURITY,self.h.SECURITY_SHA),(self.h.ACL,self.h.ACL_SHA),*self.h.SECURITY_IMPORTS.items()):need(sha(load(b.MAIN/relative))==digest);result[str(b.MAIN/relative)]=digest
  shell=self.h.POWERSHELL;need(shell.is_file()and not shell.is_symlink()and shell.resolve()==shell and shell.stat().st_nlink==2 and sha(shell.read_bytes())==self.h.POWERSHELL_SHA);result[str(shell)]=self.h.POWERSHELL_SHA;return dict(sorted(result.items()))
 def directory_acl(self,file,create=False):
  need(file in(self.private,self.docker,self.docker/'config.json')and file.resolve()==file and not file.is_symlink());env=self.environment();env['EPS_ACK31_RELEASE_PRIVATE']=str(file)
  result=self.l.oci.bounded([str(self.h.POWERSHELL),'-NoProfile','-NonInteractive','-Command',self.h.acl_helper().program(create)],env,15,'worker_identity_same_private_ACL')
  value=json.loads(self.h.check_response(result));self.h.validate_docker_config_acl(value)if file==self.docker/'config.json'else self.h.acl_helper().validate(value)
 def configs(self):
  self.directory_acl(self.private);self.directory_acl(self.docker);self.directory_acl(self.docker/'config.json');self.guard.verify(self.config);need(load(self.config)==CONFIG)
  value=json.loads(load(self.docker/'config.json'));need(set(value)=={'credsStore','auths'}and value['credsStore']=='desktop'and value['auths']in({}, {'vcr.vercel.com':{}}))
 def prepare(self):
  owner={'purpose':'worker-source-identity-registry','run':self.build.inputs['run'],'build_run':self.build.build_run,'source_sha256':self.build.source['source_sha256']}
  if self.private.exists():self.configs();need(self.read('owner.json')==owner);return
  self.private.mkdir();self.directory_acl(self.private,True);self.write('owner.json',owner);self.docker.mkdir();self.directory_acl(self.docker,True);self.write('regctl-config.json',CONFIG)
  with self.guard.create(self.docker/'config.json')as stream:stream.write(b'{"credsStore":"desktop","auths":{}}\n');stream.flush();os.fsync(stream.fileno());self.guard.verify_open(stream)
  self.configs()
 def api(self,endpoint):return json.loads(self.h.check_response(self.run(self.l.cli(['api',endpoint,'--method','GET','--raw']))))
 def metadata(self):self.configs();return self.h.project_metadata(*(self.api(self.l.registry.API[key])for key in('project','repository','daemon_repository')))
 def login(self):self.configs();return self.h.login_result(self.h.check_response(self.run(self.l.cli(['vcr','login','docker','--project',self.l.registry.PROJECT,'--format','json']))))
 def control(self):self.configs();return project_remote(self.run([str(self.l.registry.REGCTL),'manifest','get',b.PREFIX+'native@'+module('worker_identity_known_serving_image',HERE/'admission.py').OLD['native_digest'],'--format','raw-body']),module('worker_identity_known_serving_anchor',HERE/'admission.py').OLD['native_digest'],self.h,self.l.oci)
 def exported(self,kind):
  self.build.context('daemon');value=self.build.accepted_export(kind);normal_oci=self.build.read(kind+'-oci.normal.json');need(normal_oci['normal_return_observed']is True and normal_oci['claim_sha256']==self.build.hash(kind+'-oci.claim.json')and normal_oci['value']['archive']==value['archive'])
  folder=self.build.directory()/(kind+'-oci');expected={'oci-layout','index.json'}|{'blobs/sha256/'+row['digest'][7:]for row in value['archive']['blobs']};actual=[]
  for file in folder.rglob('*'):
   need(not file.is_symlink()and file.resolve().is_relative_to(folder))
   if file.is_file():actual.append(file.relative_to(folder).as_posix())
  need(set(actual)==expected and json.loads(load(folder/'oci-layout'))=={'imageLayoutVersion':'1.0.0'})
  index=json.loads(load(folder/'index.json'));need(index['schemaVersion']==2 and len(index['manifests'])==1 and index['manifests'][0]['digest']==value['archive']['index_digest'])
  for row in value['archive']['blobs']:digest,size=self.h.transport().file_hash(folder/'blobs/sha256'/row['digest'][7:]);need(digest==row['digest'][7:]and size==row['bytes'])
  return value
 def target(self,kind):return b.PREFIX+b.kind_value(kind)+':identity-'+self.build.inputs['run']
 def copy(self,kind,value):
  self.configs();folder=(self.build.directory()/(kind+'-oci')).relative_to(b.MAIN).as_posix();result=self.run([str(self.l.registry.REGCTL),'image','copy','ocidir://'+folder+'@'+value['archive']['index_digest'],self.target(kind)],1800);self.h.check_response(result)
 def remote(self,kind,value):
  self.configs();read=lambda target,digest:project_remote(self.run([str(self.l.registry.REGCTL),'manifest','get',target,'--format','raw-body']),digest,self.h,self.l.oci)
  return {'index_digest':read(self.target(kind),value['archive']['index_digest']),'runtime_digest':read(b.PREFIX+kind+'@'+value['runtime_digest'],value['runtime_digest'])}
 def ready(self,kind,value):
  endpoint=self.l.registry.API['repository'if kind=='native'else'daemon_repository'];repo=self.api(endpoint);repository=self.l.registry.REPO if kind=='native'else self.l.registry.DAEMON_REPO;self.h.repository_metadata(repo,repository,kind)
  endpoint='/v1/vcr/repository/'+repository+'/images?projectId='+self.l.registry.PROJECT+'&teamId='+self.l.registry.TEAM+'&limit=50';images=self.api(endpoint);need(type(images.get('images'))is list and len(images['images'])<=50)
  matching=[row for row in images['images']if row.get('manifestDigest')==value['runtime_digest']];need(len(matching)==1);row=matching[0];need(row.get('repositoryId')==repository and row.get('kind')=='manifest'and row.get('status')=='ready'and row.get('architecture',row.get('arch'))=='amd64'and row.get('platform')=='linux')
  return {'image':{'runtime_digest':value['runtime_digest'],'repository_id':repository,'kind':'manifest','status':'ready','architecture':'amd64','platform':'linux'},'repository_id':repository,'project_id':self.l.registry.PROJECT,'team_id':self.l.registry.TEAM,'private_repository':True}
def main():
 need(REGISTRY_ENABLED and len(sys.argv)==3);libraries=b.m.Libraries();file=b.MAIN/'.local/worker-source-identity-release/build-inputs.json';libraries.guard().verify(file);inputs=json.loads(load(file));need(set(inputs)=={'run','source'});build=b.Build(inputs,libraries);action,kind=sys.argv[1:]
 value=operate(action,kind,Ports(build));value.update(provider_called=action!='prepare',provider_mutations=action in('refresh','copy'),credentials_extracted=False,raw_credentials_persisted=False,exact_wire_attempt_count_claimed=False);ref=build.save(kind+'-registry-'+action,value);print(json.dumps({'result':value.get('result','passed'),'receipt':ref}));need(value.get('result','passed')in('passed','observed'))
if __name__=='__main__':
 try:main()
 except Exception:print('WORKER_IDENTITY_REGISTRY_DISABLED_OR_UNCONFIRMED');raise SystemExit(1)from None
