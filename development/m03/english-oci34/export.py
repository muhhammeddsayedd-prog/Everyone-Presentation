"""Root-executed local-only OCI exporter. No registry push or credential read."""
from pathlib import Path
import importlib.util,json,sys

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('english_oci34_export_common',HERE/'oci.py');oci=importlib.util.module_from_spec(spec);spec.loader.exec_module(oci)

def source_pins():return {**oci.source_pins(),'export_operator_sha256':oci.sha(oci.exact_file(Path(__file__)))}
def command(kind):
 oci.kind_value(kind);dockerfile='native-sandbox'if kind=='native'else'daemon'
 output='type=oci,dest='+str(oci.private_path(kind,'export.tar'))+',name='+oci.target(kind)+',oci-mediatypes=true,compression=zstd,compression-level=3,force-compression=true'
 args=[str(oci.base.refresh.DOCKER),'--host',oci.base.HOST,'buildx','build','--builder','default','--platform','linux/amd64','--file',str(oci.base.CONTEXT/('Dockerfile.'+dockerfile)),'--metadata-file',str(oci.private_path(kind,'export.metadata.json')),'--progress','plain','--output',output]
 # A fresh final-UID import must execute for the daemon, not just hit cache.
 if kind=='daemon':args+=['--no-cache']
 return args+[str(oci.base.CONTEXT)]
def load_export(kind):
 pointer=json.loads(oci.exact_file(oci.private_path(kind,'export.success.json'),4096));need=set(pointer)=={'receipt','sha256'};oci.need(need)
 ref,value=oci.reference(pointer['receipt']);oci.need(ref==pointer and value['result']=='passed'and value['action']=='local_oci_export'and value['kind']==kind and value['run']==oci.RUN and value['source_sha256']==oci.SOURCE and value['target']==oci.target(kind))
 oci.need(value['exit_code']==0 and value['timed_out']is False and value['output_limit_exceeded']is False and value['all_blob_sha256_and_descriptor_sizes_verified']is True and value['all_blobs_reachable']is True and value['layers_recompressed']is False and value['legacy_manifest_used']is False and value['external_descriptor_urls']is False)
 oci.digest(value['index_digest']);oci.digest(value['runtime_digest']);return value
def main():
 oci.need(len(sys.argv)==2);kind=oci.kind_value(sys.argv[1]);pins=source_pins();source=oci.context(kind)
 oci.PRIVATE.mkdir(parents=True,exist_ok=True);oci.need(oci.PRIVATE.resolve()==oci.PRIVATE and not oci.PRIVATE.is_symlink())
 claim=oci.private_path(kind,'export.claim.json');archive=oci.private_path(kind,'export.tar');destination=oci.private_path(kind,'oci');metadata=oci.private_path(kind,'export.metadata.json')
 oci.need(not any(p.exists()for p in [claim,archive,destination,metadata,oci.private_path(kind,'export.success.json')]))
 oci.exclusive(claim,{'kind':kind,'run':oci.RUN,'source_sha256':oci.SOURCE,'source':source,'source_pins':pins,'claimed_at':oci.stamp(),'local_export_may_have_occurred':True,'registry_push_requested':False,'automatic_retry':False})
 oci.need(source_pins()==pins and oci.context(kind)==source)
 print(json.dumps({'event':'local_oci_export_started','kind':kind,'source_sha256':oci.SOURCE,'registry_push_requested':False}),flush=True)
 result=oci.bounded(command(kind),oci.build.environment(),1800,'local_export');passed=False;proof={};gate=None
 try:
  oci.need(result['exit_code']==0 and not result['timed_out']and not result['output_limit_exceeded']);gate=oci.base.import_gate(result['stderr'],kind)
  proof=oci.archive_proof(archive,destination);oci.need(source_pins()==pins and oci.context(kind)==source);passed=True
 except Exception:pass
 value={'result':'passed'if passed else'unconfirmed','action':'local_oci_export','source':source,'source_pins':pins,'production_import_gate':gate,'exit_code':result['exit_code'],'timed_out':result['timed_out'],'output_limit_exceeded':result['output_limit_exceeded'],'elapsed_seconds':result['elapsed_seconds'],'stdout_bytes':len(result['stdout']),'stderr_bytes':len(result['stderr']),'process_id':result['process_id'],'progress':oci.base.progress(result['stderr']),'local_export_completed':passed,'registry_push_requested':False,'claim_retained':True,'automatic_retry':False,'exporter_force_zstd_compression':True,'layers_recompressed_scope':'No transformation after the actual OCI export; Docker exporter itself uses force-compression zstd.',**proof}
 path=oci.receipt(kind,'export',value)
 if passed:oci.exclusive(oci.private_path(kind,'export.success.json'),{'receipt':path.relative_to(oci.ROOT).as_posix(),'sha256':oci.sha(path.read_bytes())})
 print(json.dumps({'result':value['result'],'receipt':path.relative_to(oci.ROOT).as_posix(),'index_digest':proof.get('index_digest'),'runtime_digest':proof.get('runtime_digest'),'registry_push_requested':False}),flush=True);oci.need(passed)

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_OCI_EXPORT_UNCONFIRMED',flush=True);sys.exit(1)
