"""Actual cached payload/pure projector and metadata/fake sequencing only."""
from pathlib import Path
import copy,datetime,importlib.util,json,subprocess,sys,unittest
from unittest.mock import Mock,patch
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
m=module('complete_prepare_test_target',HERE/'complete_preparation.py');t=module('complete_prepare_test_ports',HERE/'test_forward_prepare.py')
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.state=m.f.f.State();m.need(m.p.s.sha(m.p.s.load(m.p.RUNTIME))==m.p.RUNTIME_SHA);file=m.p.PRIVATE/'project-2b41f841-8d6e-4dde-aaf0-8af502b175c3.json'
  port=m.CompletionProvider();port.r.helpers().private_security().verify(file)
  program="import fs from'node:fs';const p=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));const m=await import("+json.dumps(m.p.RUNTIME.as_uri())+");process.stdout.write(JSON.stringify(m.projectDaemon(p.value,p.deployment)));"
  done=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program,str(file)],capture_output=True,timeout=10);m.need(done.returncode==0);cls.actual=json.loads(done.stdout)
  relative=next(path for path in m.FAILURES if '01-32-57' in path);observed=json.loads(m.p.s.load(m.p.s.ROOT/relative))['observed_at'];cls.at=int(datetime.datetime.fromisoformat(observed).timestamp()*1000)
 def ports(self):
  port=t.Tests.ports(self);hash_file=port.hash;port.hash=lambda name:m.OLD_CLAIMS[name]if name in m.OLD_CLAIMS else hash_file(name);port.files['forward-prepare.claim.json']={'retained_read_only_preparation':{'prepare_claim_sha256':m.f.PRIOR_SHA}};return port
 def guard(self,port,pins):m.need(not port.exists(m.CLAIM)and not port.exists('plan.json'));return {'claims':dict(m.OLD_CLAIMS)}
 def test_actual_cached_payload_passes_without_claiming_application_heartbeat(self):
  identity,cached=m.h.control_plane_ready(self.actual,m.p.s.OLD_DEPLOYMENT,m.p.s.OLD_DAEMON,self.at);self.assertEqual(cached['last_checked_age_ms'],141285);self.assertEqual(cached['kind'],'cached_platform_metadata');self.assertFalse(cached['fresh_application_heartbeat_proven']);self.assertEqual(identity['digest'],m.p.s.OLD_DAEMON)
  self.assertEqual(m.h.control_plane_ready(self.actual,m.p.s.OLD_DEPLOYMENT,m.p.s.OLD_DAEMON,self.at+86400000)[0],identity)
 def test_timestamp_dead_and_wrong_identity_denials_stay_closed(self):
  for key,value in [('last_checked_at_ms',None),('last_checked_at_ms',True),('last_checked_at_ms',self.at+60001),('last_checked_at_ms',1),('started_at_ms',0),('started_at_ms',True),('alive',False),('stopped_at_ms',self.at),('region','iad1'),('memory_mib',1024)]:
   bad=copy.deepcopy(self.actual);bad['instances'][0][key]=value
   with self.assertRaises(ValueError):m.h.control_plane_ready(bad,m.p.s.OLD_DEPLOYMENT,m.p.s.OLD_DAEMON,self.at)
  for key,value in [('project_id','foreign'),('deployment_id','foreign'),('status','reconciling'),('desired',0),('configured_override',{'dub1':1})]:
   bad=copy.deepcopy(self.actual);bad[key]=value
   with self.assertRaises(ValueError):m.h.control_plane_ready(bad,m.p.s.OLD_DEPLOYMENT,m.p.s.OLD_DAEMON,self.at)
 def test_real_both_readonly_claims_oldpins_and_three_failures(self):
  port=m.CompletionProvider();port.run=Mock();port.api=Mock();pins=port.pins();retained=m.retained(port,pins);self.assertEqual(retained['claims'],m.OLD_CLAIMS);self.assertEqual(len(retained['failed_preparations']),3);port.run.assert_not_called();port.api.assert_not_called()
  bad=copy.deepcopy(pins);bad[str(HERE/'provider.py')]='0'*64
  with self.assertRaises(ValueError):m.retained(port,bad)
 def test_disabled_main_never_constructs_provider(self):
  with patch.object(m,'COMPLETE_ENABLED',False),patch.object(m,'CompletionProvider')as provider,patch.object(sys,'argv',['complete_preparation.py','preflight']):
   with self.assertRaises(ValueError):m.main()
   provider.assert_not_called()
 def test_repeatable_preflight_then_fresh_onceplan_drives_original_pause(self):
  port=self.ports();before=copy.deepcopy(port.value);files=copy.deepcopy(port.files)
  with patch.object(m,'retained',side_effect=self.guard),patch.object(m,'COMPLETE_ENABLED',True):
   for _ in range(2):self.assertEqual(m.operate('preflight',port)['result'],'observed');self.assertEqual(port.files,files)
   self.assertEqual(m.operate('prepare',port)['result'],'prepared');self.assertEqual(port.read('plan.json')['before'],before);self.assertEqual(port.read('plan.json')['forward_preparation']['completion_claim_sha256'],port.hash(m.CLAIM));self.assertEqual(m.operate('pause',port)['result'],'passed')
 def test_failed_preflight_creates_no_claim_and_readonly_observation_can_repeat(self):
  port=self.ports();snapshot=port.snapshot;port.snapshot=Mock(side_effect=TimeoutError('PRIVATE'))
  with patch.object(m,'retained',side_effect=self.guard),patch.object(m,'COMPLETE_ENABLED',True):
   self.assertEqual(m.operate('preflight',port)['result'],'unconfirmed');self.assertNotIn(m.CLAIM,port.files);self.assertNotIn('plan.json',port.files);port.snapshot=snapshot;self.assertEqual(m.operate('preflight',port)['result'],'observed')
 def test_postclaim_failure_retained_and_never_replays_checkpoint(self):
  port=self.ports();port.checkpoint=Mock(side_effect=TimeoutError('PRIVATE'))
  with patch.object(m,'retained',side_effect=self.guard),patch.object(m,'COMPLETE_ENABLED',True):
   self.assertEqual(m.operate('prepare',port)['result'],'unconfirmed');self.assertIn(m.CLAIM,port.files);self.assertNotIn('plan.json',port.files);self.assertEqual(port.checkpoint.call_count,1);self.assertEqual(m.operate('prepare',port)['result'],'unconfirmed');self.assertEqual(port.checkpoint.call_count,1)
 def test_all_three_actual_claim_hashes_gate_every_later_phase(self):
  port=self.ports()
  with patch.object(m,'retained',side_effect=self.guard),patch.object(m,'COMPLETE_ENABLED',True):
   self.assertEqual(m.operate('prepare',port)['result'],'prepared');hash_file=port.hash;calls=copy.deepcopy(port.calls)
   for changed in(*m.OLD_CLAIMS,m.CLAIM):
    port.hash=lambda name:'0'*64 if name==changed else hash_file(name)
    with self.assertRaises(ValueError):m.operate('pause',port)
    self.assertEqual(port.calls,calls);self.assertNotIn('pause.claim.json',port.files)
if __name__=='__main__':unittest.main()
