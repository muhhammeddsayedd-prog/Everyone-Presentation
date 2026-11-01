"""Pure/fake-port registry checks: no credentials, CLI, Docker or cloud."""
from pathlib import Path
import copy, importlib.util, json, subprocess, sys, unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('completion_registry_tests',HERE/'registry.py');r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)

class FakePorts:
 def __init__(self):self.claims={};self.returns={};self.admitted={};self.calls=[];self.reports=[];self.fail_copy=False;self.fail_login=False;self.fail_read=False
 def pins(self):return {'synthetic':'a'*64}
 def exported(self,kind):return {'runtime_digest':r.DIGESTS[kind],'archive':{'index_digest':r.DIGESTS[kind],'runtime_digest':r.DIGESTS[kind]}},{'receipt':'synthetic.json','sha256':'b'*64}
 def prepared(self,kind):return self.exported(kind)
 def prepare(self,kind):self.calls.append(('prepare',kind))
 def exists(self,kind,action):return(kind,action)in self.claims
 def claim(self,kind,action,value):self.calls.append(('claim',action));self.claims[kind,action]=copy.deepcopy(value)
 def claimed(self,kind,action):return self.claims[kind,action]
 def returned(self,kind,action,value):self.returns[kind,action]=copy.deepcopy(value)
 def normal(self,kind,action):return self.returns.get((kind,action))
 def claim_hash(self,kind,action):return r.sha(json.dumps(self.claims[kind,action],sort_keys=True).encode())
 def admit(self,kind,value):self.admitted[kind]=copy.deepcopy(value)
 def admitted_exists(self,kind):return kind in self.admitted
 def login_admitted(self,kind):r.need(kind in self.admitted)
 def metadata(self):return {'project_id':r.PROJECT,'team_id':r.TEAM,'repositories':{'native':{'id':r.REPO,'project_id':r.PROJECT,'name':'native','public':False},'daemon':{'id':r.DAEMON_REPO,'project_id':r.PROJECT,'name':'daemon','public':False}}}
 def run(self,command,timeout=45):
  action='copy'if command[1:3]==['image','copy']else'login';self.calls.append((action,command))
  if action=='copy'and self.fail_copy or action=='login'and self.fail_login:raise TimeoutError('PRIVATE credential detail')
  return {'exit_code':0,'timed_out':False,'output_limit_exceeded':False,'stdout':b''if action=='copy'else json.dumps({'status':'success','engine':'docker','registry':'vcr.vercel.com','username':'oidc','validForHours':12}).encode(),'stderr':b''}
 def remote(self,reference,expected):
  self.calls.append(('GET',reference))
  if self.fail_read:raise ValueError('PRIVATE response')
  return expected
 def save(self,action,kind,value):self.reports.append(value);return {'result':value['result'],'action':action,'kind':kind}

class Tests(unittest.TestCase):
 def setUp(self):
  gate=patch.object(r,'REGISTRY_ENABLED',True);gate.start();self.addCleanup(gate.stop)
 def test_disabled_gate_precedes_any_ports(self):
  with patch.object(r,'REGISTRY_ENABLED',False),patch.object(r,'Ports')as ports,patch.object(sys,'argv',['registry.py','refresh','native']):
   with self.assertRaises(ValueError):r.main()
  ports.assert_not_called()
 def test_imports_and_pure_helpers_never_launch_old_controllers(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):helper=r.helpers()
  self.assertTrue(callable(helper.remote_manifest));self.assertTrue(callable(helper.project_ready))
  text=(HERE/'registry.py').read_text();self.assertNotIn('helpers().main(',text);self.assertNotIn('helpers().refresh(',text);self.assertNotIn('helpers().Ports(',text)
 def test_exact_cli_login_and_metadata_commands(self):
  cmd=r.refresh_command();self.assertEqual(cmd[2:9],['vcr','login','docker','--project',r.PROJECT,'--format','json'])
  self.assertEqual(cmd[-4:],['--scope','muhammed-abdelrahman','--global-config',r.GLOBAL])
  for operation in r.API:self.assertIn('GET',r.api_command(operation))
  with self.assertRaises(ValueError):r.api_command('credentials')
 def test_copy_is_exact_new_oci_and_digest_only(self):
  for kind in ['native','daemon']:
   command=r.copy_command(kind,{'index_digest':r.DIGESTS[kind]});self.assertEqual(command[:3],[str(r.REGCTL),'image','copy'])
   self.assertIn(r.b.RUN,command[3]);self.assertTrue(command[3].endswith('@'+r.DIGESTS[kind]));self.assertEqual(command[4],r.b.target(kind))
  with self.assertRaises(ValueError):r.get_command('https://arbitrary.invalid')
 def test_private_environment_and_inherited_docker_acl_remain_scoped(self):
  with patch.dict(r.os.environ,{'DEBUG':'*','VERCEL_TOKEN':'PRIVATE','OPENAI_API_KEY':'PRIVATE','NODE_OPTIONS':'bad'},clear=True):env=r.environment()
  self.assertFalse(set(env)&{'DEBUG','VERCEL_TOKEN','OPENAI_API_KEY','NODE_OPTIONS'});self.assertEqual(env['DOCKER_CONFIG'],str(r.DOCKER_CONFIG))
  self.assertEqual(json.loads(r.CONFIG_BYTES)['hosts']['vcr.vercel.com'],{'blobChunk':16777216,'blobMax':16777216})
 def test_refresh_and_copy_need_one_claim_normal_return_and_two_readbacks(self):
  for kind in ['native','daemon']:
   p=FakePorts();self.assertEqual(r.refresh(kind,p)['result'],'passed');self.assertEqual(r.copy_or_readback('copy',kind,p)['result'],'passed')
   self.assertEqual(sum(call[0]=='login'for call in p.calls),1);self.assertEqual(sum(call[0]=='copy'for call in p.calls),1)
   with self.assertRaises(ValueError):r.refresh(kind,p)
   with self.assertRaises(ValueError):r.copy_or_readback('copy',kind,p)
   self.assertTrue(p.reports[-1]['two_remote_reads_equal'])
 def test_unknown_login_never_admits_copy_or_retries(self):
  p=FakePorts();p.fail_login=True;self.assertEqual(r.refresh('native',p)['result'],'unconfirmed')
  with self.assertRaises(ValueError):r.copy_or_readback('copy','native',p)
  with self.assertRaises(ValueError):r.refresh('native',p)
  self.assertNotIn('PRIVATE',json.dumps(p.reports))
 def test_unknown_copy_readback_cannot_invent_normal_return(self):
  p=FakePorts();r.refresh('native',p);p.fail_copy=True
  self.assertEqual(r.copy_or_readback('copy','native',p)['result'],'unconfirmed')
  self.assertEqual(r.copy_or_readback('readback','native',p)['result'],'unconfirmed')
  self.assertEqual(sum(call[0]=='copy'for call in p.calls),1);self.assertNotIn('PRIVATE',json.dumps(p.reports))
 def test_delayed_success_uses_only_reads_after_original_normal_copy(self):
  p=FakePorts();r.refresh('native',p);original=p.run
  def run(command,timeout=45):
   result=original(command,timeout)
   if command[1:3]==['image','copy']:p.fail_read=True
   return result
  p.run=run;self.assertEqual(r.copy_or_readback('copy','native',p)['result'],'unconfirmed');p.fail_read=False
  self.assertEqual(r.copy_or_readback('readback','native',p)['result'],'passed');self.assertEqual(sum(call[0]=='copy'for call in p.calls),1)
 def test_refresh_reconciliation_needs_original_return_without_resubmission(self):
  for original_return in [False,True]:
   p=FakePorts();p.fail_read=original_return;p.fail_login=not original_return
   self.assertEqual(r.refresh('native',p)['result'],'unconfirmed');p.fail_read=False;p.fail_login=False
   self.assertEqual(r.refresh_readback('native',p)['result'],'passed'if original_return else'unconfirmed')
   self.assertEqual(sum(call[0]=='login'for call in p.calls),1)
 def test_changed_copy_claim_cannot_accept_another_normal_return(self):
  p=FakePorts();r.refresh('native',p);self.assertEqual(r.copy_or_readback('copy','native',p)['result'],'passed')
  p.claims['native','copy']['unexpected']='changed';self.assertEqual(r.copy_or_readback('readback','native',p)['result'],'unconfirmed')
 def test_native_ready_requires_exact_new_digest_private_repo_and_platform(self):
  repository={'repository':{'id':r.REPO,'projectId':r.PROJECT,'name':'native','public':False,'createdAt':'2026-11-01T00:00:00Z','updatedAt':'2026-11-01T00:00:00Z'}}
  item={'id':'synthetic-image','repositoryId':r.REPO,'manifestDigest':r.DIGESTS['native'],'kind':'manifest','status':'ready','sizeInBytes':633842688,'createdAt':'2026-11-01T00:00:00Z','tags':['completion-8b559ebe'],'arch':'amd64','platform':'linux'}
  parser=r.helpers().project_ready;self.assertTrue(parser(repository,{'images':[item]},r.DIGESTS['native']))
  for mutation in [{'status':'preparing'},{'arch':'arm64'},{'manifestDigest':r.KNOWN_NATIVE},{'repositoryId':r.DAEMON_REPO}]:
   with self.assertRaises(ValueError):parser(repository,{'images':[{**item,**mutation}]},r.DIGESTS['native'])
  with self.assertRaises(ValueError):parser({'repository':{**repository['repository'],'public':True}},{'images':[item]},r.DIGESTS['native'])
 def test_wrong_project_or_daemon_repo_privacy_cannot_pass_metadata(self):
  native={'repository':{'id':r.REPO,'projectId':r.PROJECT,'name':'native','public':False}}
  daemon={'repository':{'id':r.DAEMON_REPO,'projectId':r.PROJECT,'name':'daemon','public':False}}
  parser=r.helpers().project_metadata;project={'id':r.PROJECT,'accountId':r.TEAM,'name':'everyone-presentation-worker-pilot'}
  self.assertTrue(parser(project,native,daemon))
  for wrong in [{**project,'id':'foreign'},{**project,'accountId':'foreign'}]:
   with self.assertRaises(ValueError):parser(wrong,native,daemon)
  with self.assertRaises(ValueError):parser(project,native,{'repository':{**daemon['repository'],'public':True}})

if __name__=='__main__':unittest.main()
