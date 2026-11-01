"""Inert public-source/pure-transport/fake-port checks; no external operations."""
from pathlib import Path
import copy, importlib.util, json, subprocess, sys, unittest
from unittest.mock import Mock,patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('diagnostic38_registry_tests',HERE/'registry.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

def repository():return {'repository':{'id':r.REPO,'projectId':r.PROJECT,'name':'native','public':False,'createdAt':'2026-10-30T10:00:00Z','updatedAt':'2026-10-30T10:00:00Z'}}
def daemon_repository():return {'repository':{'id':r.DAEMON_REPO,'projectId':r.PROJECT,'name':'daemon','public':False,'createdAt':'2026-10-30T10:00:00Z','updatedAt':'2026-10-30T10:00:00Z'}}
def images():return {'images':[{'id':'img_synthetic','repositoryId':r.REPO,'manifestDigest':r.NATIVE_DIGEST,'kind':'manifest','status':'ready','sizeInBytes':633832889,'createdAt':'2026-11-01T18:00:00Z','tags':['specs-diagnostic38-6503a124'],'arch':'amd64','platform':'linux'}],'nextCursor':'opaque-private-cursor-not-persisted'}
def login():return {'status':'success','engine':'docker','registry':'vcr.vercel.com','username':'oidc','validForHours':12}

class FakePorts:
 def __init__(self):
  self.claims={};self.returns={};self.admissions={};self.reports=[];self.calls=[];self.proof={'index_digest':r.NATIVE_DIGEST,'runtime_digest':r.NATIVE_DIGEST}
  self.value={'runtime_digest':r.NATIVE_DIGEST,'archive':self.proof};self.ref={'receipt':'synthetic-export.json','sha256':'a'*64};self.source_pins={'synthetic':'b'*64}
  self.fail_prepare=False;self.fail_login=False;self.fail_copy=False;self.fail_remote=False
  self.native_repository=repository();self.daemon_repository=daemon_repository()
 def pins(self):return copy.deepcopy(self.source_pins)
 def exported(self,kind):return copy.deepcopy(self.value),copy.deepcopy(self.ref)
 def prepared(self,kind):return self.exported(kind)
 def exists(self,kind,action):return(kind,action)in self.claims
 def claim(self,kind,action,value):self.calls.append(('claim',action));self.claims[kind,action]=value
 def claim_value(self,kind,action):return self.claims[kind,action]
 def prepare(self,kind,v):
  self.calls.append(('prepare',kind))
  if self.fail_prepare:raise ValueError('PRIVATE source diagnostic')
 def metadata(self):return r.project_metadata({'id':r.PROJECT,'accountId':r.TEAM,'name':'everyone-presentation-worker-pilot'},self.native_repository,self.daemon_repository)
 def run(self,command,timeout=45):
  is_copy=command[1:3]==['image','copy'];self.calls.append(('copy'if is_copy else'login',tuple(command)))
  if self.fail_copy and is_copy or self.fail_login and not is_copy:raise TimeoutError('PRIVATE token transport output')
  return {'exit_code':0,'timed_out':False,'output_limit_exceeded':False,'stdout':b''if is_copy else json.dumps(login()).encode(),'stderr':b''}
 def remote(self,reference,expected):
  self.calls.append(('GET',reference))
  if self.fail_remote:raise ValueError('PRIVATE response payload')
  return expected
 def returned(self,kind,action,value):self.returns[kind,action]=value
 def returned_value(self,kind,action):return self.returns.get((kind,action))
 def admit_login(self,kind,value):self.admissions[kind]=value
 def login_admitted(self,kind):r.need(kind in self.admissions)
 def claim_hash(self,kind,action):return r.sha(json.dumps(self.claims[kind,action],sort_keys=True).encode())
 def return_hash(self,kind,action):return r.sha(json.dumps(self.returns[kind,action],sort_keys=True).encode())
 def api(self,operation):
  self.calls.append(('api',operation))
  return self.native_repository if operation=='repository'else self.daemon_repository if operation=='daemon_repository'else images()
 def save(self,action,kind,value):self.reports.append(value);return {'result':value['result'],'receipt':'synthetic-evidence.json','action':action,'kind':kind}

class Tests(unittest.TestCase):
 def setUp(self):
  flag=patch.object(r,'REGISTRY_ENABLED',True);flag.start();self.addCleanup(flag.stop)
 def test_import_and_patched_disabled_entry_never_touch_private_or_process_ports(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):
   spec=importlib.util.spec_from_file_location('diagnostic38_registry_import_again',HERE/'registry.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  self.assertIs(type(m.REGISTRY_ENABLED),bool)
  with patch.object(r,'REGISTRY_ENABLED',False),patch.object(r,'Ports')as ports,patch.object(sys,'argv',['registry.py','refresh','native']):
   with self.assertRaises(ValueError):r.main()
   for action in [lambda:r.prepare('native',Mock()),lambda:r.refresh('native',Mock()),lambda:r.copy_or_readback('copy','native',Mock()),lambda:r.ready('native',Mock())]:
    with self.assertRaises(ValueError):action()
  ports.assert_not_called()

 def test_executed_build_files_and_actual_native_export_remain_exact(self):
  for name,pin in r.BUILD_PINS.items():self.assertEqual(r.sha((HERE/name).read_bytes()),pin)
  raw=r.load(r.ROOT/r.NATIVE_EXPORT);self.assertEqual(r.sha(raw),r.NATIVE_EXPORT_SHA)
  v=json.loads(raw);self.assertEqual(v['result'],'passed');self.assertEqual(v['source_sha256'],r.SOURCE)
  self.assertEqual(v['runtime_digest'],r.NATIVE_DIGEST);self.assertEqual(v['archive']['archive_bytes'],633853952)
  self.assertEqual(v['archive']['archive_sha256'],'88ea6411a9a72f6d13cc68e6d54c52c69896eb6935a42eb97b81319b0b9e2be2')

 def test_reused_transport_imports_are_inert_and_only_pure_functions_are_used(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):m=r.transport()
  self.assertTrue(callable(m.file_hash));self.assertTrue(callable(m.body));self.assertTrue(callable(m.classify))
  source=(HERE/'registry.py').read_text();self.assertNotIn('transport().main(',source);self.assertNotIn('transport().state(',source);self.assertNotIn('transport().remote_read(',source)
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')):self.assertTrue(callable(r.security_module().WindowsPrivateFiles))

 def test_only_docker_routing_config_may_inherit_exact_owner_system_full_control(self):
  sid='S-1-5-21-123-456-789-1001'
  for protected in [False,True]:
   value={'current_sid':sid,'owner_sid':sid,'protected':protected,'rules':[{'sid':trustee,'rights':0x1f01ff,'inheritance_flags':0,'propagation_flags':0,'inherited':not protected,'type':0}for trustee in [sid,'S-1-5-18']]}
   r.validate_docker_config_acl(value)
   for change in [lambda v:v['rules'][0].update(rights=1),lambda v:v['rules'][0].update(sid='S-1-1-0'),lambda v:v['rules'][0].update(inherited=protected),lambda v:v.update(owner_sid='S-1-1-0')]:
    bad=copy.deepcopy(value);change(bad)
    with self.assertRaises(ValueError):r.validate_docker_config_acl(bad)

 def test_scoped_login_and_GET_endpoints_match_frozen_normal_cli_construct(self):
  command=r.refresh_command();self.assertEqual(command[:2],[str(r.NODE),str(r.CLI)])
  self.assertEqual(command[2:9],['vcr','login','docker','--project',r.PROJECT,'--format','json'])
  self.assertEqual(command[-4:],['--scope',r.SLUG,'--global-config',r.GLOBAL])
  for operation in ['project','repository','daemon_repository','images']:
   get=r.api_command(operation);self.assertEqual(get[2:5],['api',r.API[operation],'--method']);self.assertIn('GET',get)
  self.assertIn('&limit=50',r.API['images']);self.assertIn(r.REPO,r.API['repository'])
  self.assertIn(r.DAEMON_REPO,r.API['daemon_repository'])
  with self.assertRaises(ValueError):r.api_command('credentials')

 def test_copy_uses_new_explicit_OCI_and_target_and_16MiB_configuration(self):
  for kind in ['native','daemon']:
   command=r.copy_command(kind,{'index_digest':r.NATIVE_DIGEST})
   self.assertEqual(command[:3],[str(r.REGCTL),'image','copy']);self.assertTrue(command[3].startswith('ocidir://.local/specs-diagnostic-worker38-registry/'+r.RUN))
   self.assertTrue(command[3].endswith('@'+r.NATIVE_DIGEST));self.assertEqual(command[4],r.target(kind))
  config=json.loads(r.CONFIG_BYTES);self.assertEqual(config['hosts']['vcr.vercel.com'],{'blobChunk':16777216,'blobMax':16777216})
  self.assertTrue(config['incDockerCred']);self.assertFalse(config['incDockerCert'])
  with self.assertRaises(ValueError):r.get_command('https://arbitrary.invalid/private')

 def test_environment_is_task_scoped_without_ambient_debug_or_provider_credentials(self):
  value=r.environment({'SystemRoot':'C:/Windows','DEBUG':'*','OPENAI_API_KEY':'private','VERCEL_TOKEN':'private','NODE_OPTIONS':'bad','DOCKER_CONFIG':'personal','REGCTL_CONFIG':'personal','PATH':'personal'})
  self.assertFalse(set(value)&{'DEBUG','OPENAI_API_KEY','VERCEL_TOKEN','NODE_OPTIONS'})
  self.assertEqual(value['DOCKER_CONFIG'],str(r.DOCKER_CONFIG));self.assertEqual(value['REGCTL_CONFIG'],str(r.CONFIG));self.assertEqual(value['ProgramFiles'],'C:/Program Files')

 def test_prepare_claim_precedes_extraction_and_failed_prepare_is_not_replayed(self):
  for fail in [False,True]:
   p=FakePorts();p.fail_prepare=fail;out=r.prepare('native',p)
   self.assertEqual(out['result'],'unconfirmed'if fail else'passed');self.assertLess(p.calls.index(('claim','prepare')),p.calls.index(('prepare','native')))
   with self.assertRaises(ValueError):r.prepare('native',p)
   self.assertNotIn('PRIVATE',json.dumps(p.reports))

 def test_refresh_readback_uses_GETs_and_preserves_unknown_original_return(self):
  for normal_return in [False,True]:
   p=FakePorts()
   if normal_return:p.fail_remote=True
   else:p.fail_login=True
   self.assertEqual(r.refresh('native',p)['result'],'unconfirmed')
   p.fail_remote=False;p.fail_login=False
   result=r.refresh_readback('native',p)
   self.assertEqual(result['result'],'passed'if normal_return else'unconfirmed')
   self.assertTrue(p.reports[-1]['known_manifest_read_verified']);self.assertFalse(p.reports[-1]['login_submitted'])
   self.assertEqual(sum(c[0]=='login'for c in p.calls),1)
   self.assertEqual('native'in p.admissions,normal_return)

 def test_login_success_requires_claim_normal_return_known_digest_and_metadata_before_copy(self):
  p=FakePorts();result=r.refresh('native',p);self.assertEqual(result['result'],'passed')
  self.assertIn('native',p.admissions);self.assertTrue(p.returned_value('native','refresh')['normal_return'])
  self.assertEqual(sum(c[0]=='login'for c in p.calls),1)
  self.assertLess(next(i for i,c in enumerate(p.calls)if c==('claim','refresh')),next(i for i,c in enumerate(p.calls)if c[0]=='login'))
  with self.assertRaises(ValueError):r.refresh('native',p)
  for raw in [b'{"token":"PRIVATE"}',b'{"status":"success"}']:
   with self.assertRaises(ValueError):r.login_result(raw)

 def test_unknown_or_partial_refresh_does_not_admit_copy_or_retry_login(self):
  for failure in ['fail_login','fail_remote']:
   p=FakePorts();setattr(p,failure,True);result=r.refresh('native',p)
   self.assertEqual(result['result'],'unconfirmed');self.assertNotIn('native',p.admissions)
   with self.assertRaises(ValueError):r.copy_or_readback('copy','native',p)
   with self.assertRaises(ValueError):r.refresh('native',p)
   self.assertEqual(sum(c[0]=='login'for c in p.calls),1);self.assertEqual(sum(c[0]=='copy'for c in p.calls),0)
   self.assertNotIn('PRIVATE',json.dumps(p.reports))

 def test_copy_pass_requires_one_claim_normal_return_two_equal_digest_readbacks(self):
  for kind in ['native','daemon']:
   p=FakePorts();r.refresh(kind,p);out=r.copy_or_readback('copy',kind,p);self.assertEqual(out['result'],'passed')
   report=p.reports[-1];self.assertTrue(report['normal_copy_return_observed']);self.assertTrue(report['two_remote_reads_equal']);self.assertEqual(len(report['remote_readbacks']),2)
   self.assertFalse(report['registry_ready_verified']);self.assertFalse(report['tls_fix_claimed'])
   self.assertEqual(sum(c[0]=='copy'for c in p.calls),1)
   with self.assertRaises(ValueError):r.copy_or_readback('copy',kind,p)
   self.assertEqual(sum(c[0]=='copy'for c in p.calls),1)

 def test_unknown_copy_reconciles_readonly_without_inventing_normal_return(self):
  p=FakePorts();r.refresh('native',p);p.fail_copy=True
  self.assertEqual(r.copy_or_readback('copy','native',p)['result'],'unconfirmed');self.assertIn(('native','copy'),p.claims)
  self.assertEqual(r.copy_or_readback('readback','native',p)['result'],'unconfirmed');self.assertTrue(p.reports[-1]['two_remote_reads_equal'])
  self.assertFalse(p.reports[-1]['normal_copy_return_observed'])
  self.assertEqual(sum(c[0]=='copy'for c in p.calls),1)

 def test_delayed_readback_can_confirm_original_normal_copy_without_resubmission(self):
  p=FakePorts();r.refresh('native',p)
  original=p.run
  def run(command,timeout=45):
   value=original(command,timeout)
   if command[1:3]==['image','copy']:p.fail_remote=True
   return value
  p.run=run;self.assertEqual(r.copy_or_readback('copy','native',p)['result'],'unconfirmed')
  p.fail_remote=False;self.assertEqual(r.copy_or_readback('readback','native',p)['result'],'passed')
  self.assertEqual(sum(c[0]=='copy'for c in p.calls),1)

 def test_raw_body_digest_and_redacted_error_classification_use_actual_pure_transport(self):
  body=b'{"schemaVersion":2,"mediaType":"application/vnd.oci.image.manifest.v1+json"}';expected='sha256:'+r.sha(body)
  response={'exit_code':0,'timed_out':False,'output_limit_exceeded':False,'stdout':body+b'\n','stderr':b''}
  self.assertEqual(r.remote_manifest(response,expected),expected)
  with self.assertRaises(Exception):r.remote_manifest(response,'sha256:'+'a'*64)
  self.assertEqual(r.transport().classify(b'PRIVATE secret TLS handshake timeout'),'TLS_HANDSHAKE_TIMEOUT')
  self.assertEqual(r.transport().classify(b'PRIVATE secret status code 403'),'HTTP_403')
  self.assertEqual(r.safe_failure(ValueError('PRIVATE token payload')),'REGISTRY_OPERATION_UNCONFIRMED')
  self.assertEqual(r.safe_failure(ValueError('HTTP_403')),'HTTP_403')

 def test_failed_copy_keeps_safe_underlying_error_without_raw_diagnostics(self):
  p=FakePorts();r.refresh('native',p);original=p.run
  def run(command,timeout=45):
   value=original(command,timeout)
   if command[1:3]==['image','copy']:value.update(exit_code=1,stderr=b'PRIVATE token TLS handshake timeout')
   return value
  p.run=run;self.assertEqual(r.copy_or_readback('copy','native',p)['result'],'unconfirmed')
  self.assertEqual(p.reports[-1]['copy_failure_code'],'TLS_HANDSHAKE_TIMEOUT');self.assertNotIn('PRIVATE',json.dumps(p.reports))

 def test_ready_projection_accepts_only_actual_native_ready_and_discards_cursor(self):
  result=r.project_ready(repository(),images(),r.NATIVE_DIGEST)
  self.assertEqual(result['repository']['id'],r.REPO);self.assertTrue(result['images']['has_more']);self.assertFalse(result['images']['pagination_followed'])
  self.assertNotIn('opaque-private',json.dumps(result))
  for change in [lambda p:p['images'][0].update(status='preparing'),lambda p:p['images'][0].update(arch='arm64'),lambda p:p['images'][0].update(repositoryId='foreign'),lambda p:p['images'].append(copy.deepcopy(p['images'][0]))]:
   payload=images();change(payload)
   with self.assertRaises(ValueError):r.project_ready(repository(),payload,r.NATIVE_DIGEST)
  bad=repository();bad['repository']['public']=True
  with self.assertRaises(ValueError):r.project_ready(bad,images(),r.NATIVE_DIGEST)

 def test_ready_can_be_observed_again_without_copy_or_refresh_and_failure_stays_unconfirmed(self):
  p=FakePorts()
  for unused in range(2):self.assertEqual(r.ready('native',p)['result'],'observed')
  self.assertFalse(p.claims);self.assertFalse(any(c[0]in('copy','login')for c in p.calls));self.assertFalse(p.reports[-1]['provider_mutations'])
  p.api=Mock(side_effect=ValueError('PRIVATE raw response'))
  self.assertEqual(r.ready('native',p)['result'],'unconfirmed');self.assertNotIn('PRIVATE',json.dumps(p.reports))

 def test_project_and_repository_metadata_refuse_foreign_account_before_login(self):
  project={'id':r.PROJECT,'accountId':r.TEAM,'name':'everyone-presentation-worker-pilot'}
  metadata=r.project_metadata(project,repository(),daemon_repository())
  self.assertEqual(metadata['repositories']['native']['id'],r.REPO);self.assertEqual(metadata['repositories']['daemon']['id'],r.DAEMON_REPO)
  self.assertIs(metadata['repositories']['native']['public'],False);self.assertIs(metadata['repositories']['daemon']['public'],False)
  for key in ['id','accountId','name']:
   bad=dict(project);bad[key]='foreign'
   with self.assertRaises(ValueError):r.project_metadata(bad,repository(),daemon_repository())

 def test_daemon_metadata_denies_wrong_repository_ownership_name_or_public_access(self):
  project={'id':r.PROJECT,'accountId':r.TEAM,'name':'everyone-presentation-worker-pilot'}
  for key,value in [('id',r.REPO),('projectId','foreign'),('name','native'),('public',True)]:
   bad=daemon_repository();bad['repository'][key]=value
   with self.assertRaises(ValueError):r.project_metadata(project,repository(),bad)

 def test_daemon_privacy_or_ownership_drift_refuses_before_copy_claim_or_dispatch(self):
  for key,value in [('public',True),('id',r.REPO),('projectId','foreign')]:
   p=FakePorts();r.refresh('daemon',p);p.daemon_repository['repository'][key]=value
   with self.assertRaises(ValueError):r.copy_or_readback('copy','daemon',p)
   self.assertNotIn(('daemon','copy'),p.claims);self.assertEqual(sum(c[0]=='copy'for c in p.calls),0)

 def test_post_copy_daemon_privacy_drift_cannot_earn_pass_despite_equal_remote_bytes(self):
  p=FakePorts();r.refresh('daemon',p);original=p.run
  def run(command,timeout=45):
   result=original(command,timeout)
   if command[1:3]==['image','copy']:p.daemon_repository['repository']['public']=True
   return result
  p.run=run;self.assertEqual(r.copy_or_readback('copy','daemon',p)['result'],'unconfirmed')
  self.assertTrue(p.reports[-1]['normal_copy_return_observed']);self.assertTrue(p.reports[-1]['two_remote_reads_equal'])
  self.assertEqual(p.claims['daemon','copy']['metadata'],p.claims['daemon','refresh']['metadata'])

if __name__=='__main__':unittest.main()
