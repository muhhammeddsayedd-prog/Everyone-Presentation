from pathlib import Path
import copy, importlib.util, unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('oci_adapter_test',HERE/'pipeline.py');pipeline=importlib.util.module_from_spec(spec);spec.loader.exec_module(pipeline)
def sample(kind):
 return {'result':'passed','kind':kind,'run':pipeline.RUN,'source_sha256':pipeline.SOURCE,'target':pipeline.PREFIX+kind+':'+pipeline.TAG,'index_digest':'sha256:'+'a'*64,'runtime_digest':'sha256:'+'b'*64,'remote_digest_independent_readback_equal':True,'source':{'file_count':160,'source_sha256':pipeline.SOURCE,'manifest_sha256':'c'*64 if kind=='daemon'else None},'production_import_gate':{'user':'1000:1000','network':'none','step':'#22','completed':True,'cached':False,'build_exit_code':0}if kind=='daemon'else None}
class Guards(unittest.TestCase):
 def test_actual_oci_targets_and_common_binding(self):
  for kind in ['native','daemon']:self.assertEqual(pipeline.validate_image(kind,sample(kind)),sample(kind))
 def test_old_v2_target_or_wrong_source_refused(self):
  for key,value in [('source_sha256','d'*64),('target',pipeline.PREFIX+'native:english34-auth2-4186fd1e'),('run','other'),('remote_digest_independent_readback_equal',False)]:
   item=sample('native');item[key]=value
   with self.assertRaises(ValueError):pipeline.validate_image('native',item)
 def test_cached_or_privileged_import_refused(self):
  for key,value in [('user','0:0'),('network','default'),('cached',True),('completed',False),('build_exit_code',1)]:
   item=sample('daemon');item['production_import_gate'][key]=value
   with self.assertRaises(ValueError):pipeline.validate_image('daemon',item)
 def test_new_pointer_and_claim_directory(self):
  spec=importlib.util.spec_from_file_location('worker_oci_test',HERE/'worker-v2.py');adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
  self.assertEqual(adapter.worker.BUILD_POINTER,pipeline.PRIVATE/'daemon-build.success.json');self.assertEqual(adapter.worker.PRIVATE,pipeline.ROOT/'.local/m03-english-worker-oci34')
  self.assertEqual(pipeline.sha(adapter.FROZEN.read_bytes()),adapter.FROZEN_SHA)
 def test_pipeline_validation_does_not_mutate_actual_receipt(self):
  item=sample('daemon');original=copy.deepcopy(item);pipeline.validate_image('daemon',item);self.assertEqual(item,original)
if __name__=='__main__':unittest.main()
