"""Pure/fake ports only; no local credentials/CLI/process inventory/cloud."""
from pathlib import Path
import base64,copy,importlib.util,json,subprocess,sys,unittest
from unittest.mock import Mock,patch
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v);return v
d=module('completion_daemon_continuation_test_target',HERE/'daemon-continuation.py')
t=module('completion_daemon_continuation_fake_base',HERE/'test_registry.py')

class FakePorts(t.FakePorts):
 def __init__(self):
  super().__init__();metadata=self.metadata();pins=self.pins();self.claims={('native','refresh'):{'metadata':metadata,'pins':pins},('daemon','refresh'):{'metadata':metadata,'pins':pins}}
  self.admitted={'native':{}};self.current_claim=None;self.current_return=None;self.active=False
 def references(self):return {'synthetic':'public-no-login-proof'}
 def continuation_pins(self):return {'new-source':'c'*64}
 def processes(self):return {'query_succeeded':True,'scanned_processes':200,'owned_login_processes':int(self.active),'owned_daemon_copy_processes':0}
 def continuation_claim(self,value):self.current_claim=copy.deepcopy(value);self.calls.append(('new_claim',None))
 def continuation_claimed(self):d.need(self.current_claim);return self.current_claim
 def continuation_exists(self):return self.current_claim is not None
 def continuation_hash(self):return d.sha(json.dumps(self.current_claim,sort_keys=True).encode())
 def continuation_return(self,value):self.current_return=copy.deepcopy(value)
 def continuation_returned(self):return self.current_return
 def daemon_ready(self):return {'image':{'runtime_digest':d.r.DIGESTS['daemon'],'status':'ready'}}

class Tests(unittest.TestCase):
 def setUp(self):
  gate=patch.object(d,'CONTINUATION_ENABLED',True);gate.start();self.addCleanup(gate.stop)
 def test_disabled_refuses_before_ports_creation_or_observation(self):
  with patch.object(d,'CONTINUATION_ENABLED',False),patch.object(d,'Ports')as ports,patch.object(sys,'argv',['new.py','copy']):
   with self.assertRaises(ValueError):d.main()
   ports.assert_not_called()
  with patch.object(d,'CONTINUATION_ENABLED',False):
   with self.assertRaises(ValueError):d.operate('observe',Mock())
 def test_actual_public_refs_preserve_success_and_both_unknown_results(self):
  refs=d.references();self.assertEqual(set(refs),set(d.REFERENCES));self.assertEqual(len(refs),3)
 def test_process_observation_needs_success_nonempty_inventory_and_zero_owners(self):
  value=FakePorts().processes();self.assertEqual(d.process_projection(value),value)
  for change in [{'query_succeeded':False},{'scanned_processes':0},{'owned_login_processes':1},{'owned_daemon_copy_processes':1},{'owned_login_processes':False}]:
   with self.assertRaises(ValueError):d.process_projection({**value,**change})
  self.assertIn(r'\bvcr\s+login\s+docker\b',d.PROCESS_SCRIPT);self.assertNotIn('\x08',d.PROCESS_SCRIPT)
 def test_actual_powershell_guard_rejects_unreadable_candidates_without_real_inventory(self):
  for name in ['node.exe','vercel.exe','regctl-v0.11.7.exe','unrelated.exe']:
   # This synthetic function shadows CIM. No actual process inventory is read.
   prefix="function Get-CimInstance { [pscustomobject]@{Name='"+name+"';CommandLine=$null} }\n"
   encoded=base64.b64encode((prefix+d.PROCESS_SCRIPT).encode('utf-16le')).decode()
   result=subprocess.run([str(d.r.helpers().POWERSHELL),'-NoProfile','-NonInteractive','-EncodedCommand',encoded],env=d.r.environment(),capture_output=True,timeout=15,creationflags=subprocess.CREATE_NO_WINDOW)
   if name=='unrelated.exe':self.assertEqual(result.returncode,0);self.assertEqual(d.process_projection(json.loads(result.stdout))['owned_login_processes'],0)
   else:self.assertNotEqual(result.returncode,0);self.assertEqual(result.stdout,b'')
 def test_observe_is_only_gets_and_never_admits_daemon_refresh(self):
  p=FakePorts();self.assertEqual(d.operate('observe',p)['result'],'passed')
  self.assertTrue(all(row[0]=='GET'for row in p.calls));self.assertNotIn('daemon',p.admitted);self.assertIsNone(p.current_claim)
  self.assertFalse(p.reports[-1]['daemon_normal_refresh_return_observed']);self.assertFalse(p.reports[-1]['new_login_submitted'])
 def test_known_images_and_native_normal_login_are_required(self):
  for mutation in [lambda p:p.admitted.clear(),lambda p:setattr(p,'fail_read',True),lambda p:setattr(p,'active',True),lambda p:p.returns.update({('daemon','refresh'):{'normal_return':True}})]:
   p=FakePorts();mutation(p);self.assertEqual(d.operate('copy',p)['result'],'unconfirmed');self.assertIsNone(p.current_claim)
   self.assertFalse(any(row[0]in('copy','login')for row in p.calls))
 def test_one_new_claim_exact_copy_normal_return_and_two_remote_pairs(self):
  p=FakePorts();self.assertEqual(d.operate('copy',p)['result'],'passed');self.assertEqual(sum(row[0]=='copy'for row in p.calls),1)
  self.assertEqual(p.current_claim['target'],d.r.b.target('daemon'));self.assertEqual(p.current_claim['digest'],d.r.DIGESTS['daemon']);self.assertEqual(len(p.reports[-1]['remote_readbacks']),2)
  self.assertTrue(p.reports[-1]['normal_copy_return_observed']);self.assertFalse(p.reports[-1]['daemon_normal_refresh_return_observed'])
  self.assertEqual(d.operate('copy',p)['result'],'unconfirmed');self.assertEqual(sum(row[0]=='copy'for row in p.calls),1)
  self.assertFalse(any(row[0]=='login'for row in p.calls))
 def test_unknown_copy_never_retries_and_get_readback_cannot_invent_return(self):
  p=FakePorts();p.fail_copy=True;self.assertEqual(d.operate('copy',p)['result'],'unconfirmed')
  p.fail_copy=False;self.assertEqual(d.operate('readback',p)['result'],'unconfirmed');self.assertEqual(sum(row[0]=='copy'for row in p.calls),1)
  self.assertNotIn('PRIVATE',json.dumps(p.reports))
 def test_delayed_readback_after_real_normal_return_can_pass_and_ready_is_separate(self):
  p=FakePorts();self.assertEqual(d.operate('copy',p)['result'],'passed');self.assertEqual(d.operate('readback',p)['result'],'passed');self.assertEqual(d.operate('ready',p)['result'],'observed')
  self.assertEqual(sum(row[0]=='copy'for row in p.calls),1);self.assertFalse(p.reports[-1]['daemon_runtime_startup_proven'])
 def test_changed_claim_does_not_accept_original_normal_return(self):
  p=FakePorts();d.operate('copy',p);p.current_claim['unexpected']='drift';self.assertEqual(d.operate('readback',p)['result'],'unconfirmed')
 def test_private_repo_exact_image_platform_and_unique_ready_required(self):
  repo={'repository':{'id':d.r.DAEMON_REPO,'projectId':d.r.PROJECT,'name':'daemon','public':False}}
  row={'manifestDigest':d.r.DIGESTS['daemon'],'repositoryId':d.r.DAEMON_REPO,'kind':'manifest','status':'ready','arch':'amd64','platform':'linux'}
  self.assertEqual(d.ready_projection(repo,{'images':[row]})['image']['runtime_digest'],d.r.DIGESTS['daemon'])
  for change in [{'status':'preparing'},{'repositoryId':d.r.REPO},{'manifestDigest':d.OLD_DAEMON},{'arch':'arm64'}]:
   with self.assertRaises(ValueError):d.ready_projection(repo,{'images':[{**row,**change}]})
  with self.assertRaises(ValueError):d.ready_projection(repo,{'images':[row,row]})
  with self.assertRaises(ValueError):d.ready_projection({'repository':{**repo['repository'],'public':True}},{'images':[row]})

if __name__=='__main__':unittest.main()
