"""Post-copy publication regressions only; all transport/state is synthetic."""
from pathlib import Path
import contextlib,importlib.util,io,json,sys,tempfile,unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,HERE/file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
reconcile=module('oci_reconcile_test','reconcile.py');compat=module('oci_compat_test','copy-compatible.py')

class PublicationRegression(unittest.TestCase):
 def test_only_wholly_missing_local_identity_is_enriched(self):
  value={'action':'standalone_oci_transfer','result':'passed'}
  result=compat.enriched_guard(value,'daemon',lambda row:row)
  self.assertEqual(result,{**value,'kind':'daemon','run':compat.oci.RUN,'source_sha256':compat.oci.SOURCE,'target':compat.oci.target('daemon')});self.assertNotIn('kind',value)
  partial={**value,'kind':'other'};self.assertIs(compat.enriched_guard(partial,'daemon',lambda row:row),partial)
 def test_native_compat_copy_is_refused_before_any_claim_or_transport(self):
  with patch.object(sys,'argv',['copy-compatible.py','native']),patch.object(compat.oci,'exclusive')as write:
   with self.assertRaises(ValueError):compat.main()
   write.assert_not_called()
 def test_frozen_main_publishes_actual_enriched_receipt_after_successful_copy(self):
  old=compat.old;oci=old.oci;root=oci.ROOT/'.local';root.mkdir(exist_ok=True)
  with tempfile.TemporaryDirectory(prefix='oci-publication-test-',dir=root)as temporary:
   directory=Path(temporary).resolve();self.assertTrue(directory.is_relative_to(root.resolve()))
   index='sha256:'+'a'*64;runtime='sha256:'+'b'*64;export_ref={'receipt':'tracking/evidence/m03/english-oci34/synthetic-export.json','sha256':'c'*64}
   proof={'source':{'source_sha256':oci.SOURCE,'file_count':160,'manifest_sha256':'d'*64},'source_pins':{'synthetic':'export'},'index_digest':index,'runtime_digest':runtime,'production_import_gate':{'user':'1000:1000','network':'none','completed':True,'cached':False,'step':'#22','build_exit_code':0},'exit_code':0,'blobs_verified':4,'compressed_blob_bytes':123,'archive_sha256':'e'*64}
   read={'index_digest':index,'runtime_digest':runtime,'index_body_sha256':index[7:],'runtime_body_sha256':runtime[7:]}
   result={'exit_code':0,'timed_out':False,'output_limit_exceeded':False,'stdout':b'','stderr':b'','elapsed_seconds':1,'process_id':123}
   saved=[]
   def receipt(kind,action,value):
    full={'kind':kind,'run':oci.RUN,'source_sha256':oci.SOURCE,'target':oci.target(kind),**value};path=directory/(action+'.json');path.write_text(json.dumps(full));saved.append(full);return path
   original=old.accepted
   with patch.object(oci,'PRIVATE',directory),patch.object(old,'CONFIG',directory/'regctl-config.json'),patch.object(old,'source_pins',return_value={'synthetic':'current'}),patch.object(old,'state',return_value=(proof,export_ref)),patch.object(old,'preflight',return_value={'result':'passed'}),patch.object(oci,'bounded',return_value=result)as transport,patch.object(old,'remote_read',return_value=read)as reads,patch.object(oci,'receipt',side_effect=receipt),patch.object(old,'accepted',side_effect=lambda value:compat.enriched_guard(value,'daemon',original)),patch.object(sys,'argv',['transfer.py','copy','daemon']),contextlib.redirect_stdout(io.StringIO()):
    old.main()
    pointer=json.loads((directory/'daemon-build.success.json').read_text());self.assertEqual(pointer['receipt'],(directory/'transfer.json').relative_to(oci.ROOT).as_posix())
    self.assertEqual(original(saved[0]),saved[0]);self.assertEqual(transport.call_count,1);self.assertEqual(reads.call_count,2)
   self.assertEqual(reconcile.FROZEN_SHA,oci.sha(oci.exact_file(reconcile.FROZEN)))

if __name__=='__main__':unittest.main()
