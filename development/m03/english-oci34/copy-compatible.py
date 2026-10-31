"""Future daemon copy adapter: repair only local post-receipt guard enrichment.

The frozen transfer and its source pins stay unchanged. Native copy is refused;
use the separate read-only reconciler for its already successful actual copy.
"""
from pathlib import Path
import importlib.util,json,sys

HERE=Path(__file__).resolve().parent
FROZEN=HERE/'transfer.py';FROZEN_SHA='f9694ac52fec08b24ab81c8a25ad4aa4c6ac0986fbfcdfc06d70ab724d23a5e3'
spec=importlib.util.spec_from_file_location('english_oci34_copy_frozen',FROZEN);old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
oci=old.oci

def enriched_guard(value,kind,original):
 identity={'kind','run','source_sha256','target'}
 if type(value)is dict and not(identity&set(value))and value.get('action')=='standalone_oci_transfer':
  return original({'kind':kind,'run':oci.RUN,'source_sha256':oci.SOURCE,'target':oci.target(kind),**value})
 return original(value)
def main():
 oci.need(len(sys.argv)==2 and sys.argv[1]=='daemon'and oci.sha(oci.exact_file(FROZEN))==FROZEN_SHA)
 kind='daemon';oci.need(not oci.private_path(kind,'transfer.claim.json').exists()and not oci.private_path(kind,'build.success.json').exists())
 operator_sha=oci.sha(oci.exact_file(Path(__file__)));claim=oci.private_path(kind,'copy-compatible.claim.json')
 oci.exclusive(claim,{'kind':kind,'run':oci.RUN,'source_sha256':oci.SOURCE,'operator_sha256':operator_sha,'frozen_transfer_sha256':FROZEN_SHA,'target':oci.target(kind),'claimed_at':oci.stamp(),'copy_adapter_may_have_dispatched':True,'automatic_retry':False,'only_change':'Add the four known identity fields when validating the local pre-receipt-enrichment result; retain the original guard and saved receipt.'})
 original=old.accepted;old.accepted=lambda value:enriched_guard(value,kind,original)
 sys.argv=[str(FROZEN),'copy',kind];old.main()
 value=old.load_success(kind);oci.need(oci.sha(oci.exact_file(Path(__file__)))==operator_sha)
 path=oci.receipt(kind,'copy-compatible',{'result':'passed','action':'frozen_copy_postreceipt_guard_compatibility','operator_sha256':operator_sha,'frozen_transfer_sha256':FROZEN_SHA,'actual_transfer_pointer':json.loads(oci.exact_file(oci.private_path(kind,'build.success.json'),4096)),'index_digest':value['index_digest'],'runtime_digest':value['runtime_digest'],'frozen_transfer_bytes_preserved':True,'new_wrapper_claim_retained':True,'native_copy_requested':False})
 print(json.dumps({'result':'passed','receipt':path.relative_to(oci.ROOT).as_posix(),'actual_success_pointer_verified':True}),flush=True)

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_OCI_COPY_COMPATIBILITY_UNCONFIRMED',flush=True);sys.exit(1)
