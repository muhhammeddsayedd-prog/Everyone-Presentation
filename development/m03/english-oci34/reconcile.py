"""Read-only remote reconciliation, then one local actual-receipt pointer.

Preserves the successful frozen transfer, receipt, export and both permanent
claims. No export/copy/auth refresh is available from this operator.
"""
from pathlib import Path
import importlib.util,json,sys

HERE=Path(__file__).resolve().parent
FROZEN=HERE/'transfer.py';FROZEN_SHA='f9694ac52fec08b24ab81c8a25ad4aa4c6ac0986fbfcdfc06d70ab724d23a5e3'
spec=importlib.util.spec_from_file_location('english_oci34_reconcile_frozen',FROZEN);old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
oci=old.oci

def validate(kind,reference,value):
 oci.need(oci.sha(oci.exact_file(FROZEN))==FROZEN_SHA);old.accepted(value);oci.need(value['kind']==kind)
 claim_path=oci.private_path(kind,'transfer.claim.json');returned_path=oci.private_path(kind,'copy.returned.json')
 claim=json.loads(oci.exact_file(claim_path));returned=json.loads(oci.exact_file(returned_path));proof,export_ref=old.state(kind)
 oci.need(value['source_pins']==claim['source_pins']==old.source_pins()and value['export_receipt']==claim['export']==export_ref)
 oci.need(value['transfer_claim_sha256']==oci.sha(claim_path.read_bytes())and value['copy_returned_sha256']==oci.sha(returned_path.read_bytes())and returned['claim_sha256']==value['transfer_claim_sha256'])
 oci.need(returned['exit_code']==0 and returned['normal_process_return_observed']is True and returned['timed_out']is False and returned['output_limit_exceeded']is False)
 oci.need(claim['kind']==kind and claim['run']==oci.RUN and claim['source_sha256']==oci.SOURCE and claim['target']==oci.target(kind)and claim['regctl_config_sha256']==oci.sha(oci.CONFIG))
 oci.need(value['index_digest']==proof['index_digest']and value['runtime_digest']==proof['runtime_digest']and value['source']==proof['source']and value['export_source_pins']==proof['source_pins']and value['archive_sha256']==proof['archive_sha256']and value['blobs_verified']==proof['blobs_verified']and value['compressed_blob_bytes']==proof['compressed_blob_bytes'])
 actual_ref,actual=oci.reference(reference['receipt']);oci.need(actual_ref==reference and actual==value and oci.exact_file(old.CONFIG,4096)==oci.CONFIG)
 return proof
def main():
 oci.need(len(sys.argv)==3);kind=oci.kind_value(sys.argv[1]);reference,value=oci.reference(sys.argv[2]);proof=validate(kind,reference,value)
 operator_sha=oci.sha(oci.exact_file(Path(__file__)));claim=oci.private_path(kind,'pointer-reconcile.claim.json')
 intent={'kind':kind,'run':oci.RUN,'source_sha256':oci.SOURCE,'operator_sha256':operator_sha,'frozen_transfer_sha256':FROZEN_SHA,'actual_transfer_receipt':reference,'copy_requested':False,'remote_reads_only':True,'success_pointer_may_be_written':True}
 if claim.exists():oci.need(json.loads(oci.exact_file(claim))==intent)
 else:oci.exclusive(claim,intent)
 first=old.remote_read(kind,proof);second=old.remote_read(kind,proof);oci.need(first==second==value['remote_readbacks'][0]);validate(kind,reference,value)
 oci.need(oci.sha(oci.exact_file(Path(__file__)))==operator_sha)
 pointer=oci.private_path(kind,'build.success.json');written=False
 if pointer.exists():oci.need(json.loads(oci.exact_file(pointer,4096))==reference)
 else:oci.exclusive(pointer,reference);written=True
 oci.need(old.load_success(kind)==value)
 path=oci.receipt(kind,'pointer-reconcile',{'result':'passed','action':'actual_passed_transfer_pointer_reconciliation','actual_transfer_receipt':reference,'fresh_remote_readbacks':[first,second],'operator_sha256':operator_sha,'frozen_transfer_sha256':FROZEN_SHA,'original_claims_and_receipt_preserved':True,'pointer_written':written,'pointer_targets_actual_passed_transfer':True,'copy_requested':False,'export_requested':False,'auth_refresh_requested':False,'v2_pointer_written':False})
 print(json.dumps({'result':'passed','receipt':path.relative_to(oci.ROOT).as_posix(),'actual_transfer_receipt':reference['receipt'],'pointer_written':written,'old_loader_passed':True,'copy_requested':False}),flush=True)

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_OCI_RECONCILIATION_UNCONFIRMED',flush=True);sys.exit(1)
