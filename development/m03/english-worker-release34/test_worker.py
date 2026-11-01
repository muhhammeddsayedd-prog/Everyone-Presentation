"""Offline prebuilt worker admission checks; no provider/database/deployment."""
from pathlib import Path
import copy, importlib.util, unittest

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('english_worker34',HERE/'worker.py');worker=importlib.util.module_from_spec(spec);spec.loader.exec_module(worker)
DIGEST='sha256:'+'a'*64;DEPLOYMENT='dpl_'+'b'*28

class WorkerReleaseGuards(unittest.TestCase):
 def daemon(self):
  return {'deployment_id':DEPLOYMENT,'project_id':worker.PROJECT,'team_id':worker.TEAM,'environment':'production','daemon':'worker','status':'ready',
   'configured_instances':{'dub1':1},'configured_override':None,'memory_mib':2048,'termination_grace_seconds':300,'desired':1,'ready':1,'total':1,
   'requested_image':{'digest':DIGEST},'resolved_image':{'digest':DIGEST},'updated_at_ms':100,
   'instances':[{'id':'dmni_synthetic','alive':True,'region':'dub1','memory_mib':2048,'image':{'digest':DIGEST},'started_at_ms':90,'stopped_at_ms':None,'last_checked_at_ms':100}]}
 def test_prebuilt_preserves_one_two_gib_dub1_worker(self):
  value=worker.expected_output(DIGEST)
  self.assertEqual(value['config'],{'version':3,'daemons':{'worker':{}}})
  self.assertEqual(value['daemon']['instances'],{'dub1':1});self.assertEqual(value['daemon']['resources'],{'requests':{'memory':'2Gi'}})
  self.assertEqual(value['daemon']['terminationGracePeriodSeconds'],300);self.assertTrue(value['daemon']['image'].endswith(DIGEST))
  with self.assertRaises(ValueError):worker.expected_output('latest')
 def test_actual_ready_alive_and_exact_digest_required(self):
  worker.healthy_daemon(self.daemon(),DEPLOYMENT,DIGEST)
  for patch in [{'status':'reconciling'},{'memory_mib':4096},{'configured_instances':{'dub1':2}},{'configured_override':{'dub1':1}},{'ready':0},{'resolved_image':{'digest':worker.OLD_IMAGE}}]:
   with self.assertRaises(ValueError):worker.healthy_daemon({**self.daemon(),**patch},DEPLOYMENT,DIGEST)
  row=self.daemon();row['instances'][0]['alive']=False
  with self.assertRaises(ValueError):worker.healthy_daemon(row,DEPLOYMENT,DIGEST)
 def test_identity_ignores_only_observation_clock(self):
  first=self.daemon();second=copy.deepcopy(first);second['updated_at_ms']=101;second['instances'][0]['last_checked_at_ms']=101
  self.assertEqual(worker.healthy_daemon(first,DEPLOYMENT,DIGEST),worker.healthy_daemon(second,DEPLOYMENT,DIGEST))
  second['instances'][0]['id']='dmni_another'
  self.assertNotEqual(worker.healthy_daemon(first,DEPLOYMENT,DIGEST),worker.healthy_daemon(second,DEPLOYMENT,DIGEST))
 def build(self):
  return {'result':'passed','kind':'daemon','run':worker.RUN,'source_sha256':worker.SOURCE,
   'target':'vcr.vercel.com/muhammed-abdelrahman/everyone-presentation-worker-pilot/daemon:english34-auth2-4186fd1e',
   'runtime_digest':DIGEST,'remote_digest_independent_readback_equal':True,'exit_code':0,'timed_out':False,'output_limit_exceeded':False,
   'source':{'file_count':160,'source_sha256':worker.SOURCE,'manifest_sha256':'c'*64},
   'production_import_gate':{'user':'1000:1000','network':'none','completed':True,'cached':False,'build_exit_code':0}}
 def test_build_requires_current_seal_manifest_import_and_actual_readback(self):
  plan={'next':{'manifest_sha256':'c'*64}};proof={'result':'ready_image_and_import_gate_observed','daemon_runtime_digest':DIGEST,'source_sha256':worker.SOURCE,'run':worker.RUN,'baked_manifest_sha256':'c'*64}
  self.assertEqual(worker.daemon_build(self.build(),plan,proof),DIGEST)
  for patch in [{'source_sha256':'d'*64},{'remote_digest_independent_readback_equal':False},{'runtime_digest':worker.OLD_IMAGE},{'kind':'native'}]:
   with self.assertRaises(ValueError):worker.daemon_build({**self.build(),**patch},plan,proof)
  invalid=self.build();invalid['production_import_gate']['cached']=True
  with self.assertRaises(ValueError):worker.daemon_build(invalid,plan,proof)
 def provider(self):
  return {'id':DEPLOYMENT,'name':'everyone-presentation-worker-pilot','project':{'id':worker.PROJECT},'team':{'id':worker.TEAM},'readyState':'READY','meta':{'epsEnglishWorker34':worker.SOURCE,'epsDaemonImage34':DIGEST}}
 def test_deployment_must_bind_worker_project_and_actual_image(self):
  self.assertEqual(worker.deployment(self.provider(),DIGEST)['id'],DEPLOYMENT)
  for patch in [{'id':worker.OLD},{'project':{'id':'other'}},{'team':{'id':'other'}},{'readyState':'BUILDING'},{'meta':{'epsEnglishWorker34':worker.SOURCE,'epsDaemonImage34':worker.OLD_IMAGE}}]:
   with self.assertRaises(ValueError):worker.deployment({**self.provider(),**patch},DIGEST)
 def test_returned_url_has_only_fixed_worker_origin(self):
  url='https://everyone-presentation-worker-pilot-synthetic.vercel.app';self.assertEqual(worker.deployment_url(url+'\n'),url)
  for raw in ['https://everyone-presentation-pilot-synthetic.vercel.app',url+'?credential=synthetic',url+'\nhttps://everyone-presentation-worker-pilot-other.vercel.app']:
   with self.assertRaises(ValueError):worker.deployment_url(raw)

if __name__=='__main__':unittest.main()
