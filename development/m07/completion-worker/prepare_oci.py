"""Fresh local OCI-directory copy through the existing verified archive helper."""
from pathlib import Path
import importlib.util, json, sys

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('completion_oci_local_build',HERE/'build.py')
b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)

def prepare(kind):
 b.kind_value(kind);pins=b.pins();b.context('daemon')
 pointer_file=b.artifact(kind,'export.success.json');pointer=json.loads(b.load(pointer_file,4096))
 receipt=b.ROOT/pointer['receipt'];b.need(receipt.parent==b.EVIDENCE)
 raw=b.load(receipt,2*1024**2);b.need(b.sha(raw)==pointer['sha256']);value=json.loads(raw)
 b.need(value['result']=='passed'and value['kind']==kind and value['run']==b.RUN and value['source_sha256']==b.SOURCE and value['source_pins']==pins)
 destination=b.PRIVATE/(kind+'-oci');b.need(not destination.exists())
 b.exclusive(b.PRIVATE/(kind+'-oci.prepare.claim.json'),{'run':b.RUN,'kind':kind,'source_sha256':b.SOURCE,'build_receipt_sha256':pointer['sha256'],'automatic_retry':False,'provider_called':False})
 proof=b.base().mechanisms().archive_proof(b.artifact(kind,'export.tar'),destination)
 b.need(proof==value['archive']and b.pins()==pins and json.loads(b.load(pointer_file,4096))==pointer)
 report={'schema_version':'1.0','observed_at':b.stamp(),'result':'passed','action':'local_oci_directory_preparation','run':b.RUN,'kind':kind,'source_sha256':b.SOURCE,'build_receipt':pointer['receipt'],'build_receipt_sha256':pointer['sha256'],'prepared_directory':str(destination),'preparation_source_sha256':b.sha(b.load(Path(__file__).resolve())),'archive':proof,'registry_or_credentials_or_provider_called':False,'layers_recompressed':False,'legacy_manifest_used':False}
 target=b.EVIDENCE/(kind+'-oci-preparation.json');b.exclusive(target,report)
 return {'result':'passed','kind':kind,'prepared_directory':str(destination),'index_digest':proof['index_digest'],'runtime_digest':proof['runtime_digest'],'blobs_verified':proof['blobs_verified']}

if __name__=='__main__':
 try:b.need(len(sys.argv)==2 and sys.argv[1]in('native','daemon'));print(json.dumps(prepare(sys.argv[1])),flush=True)
 except Exception:print('COMPLETION_OCI_PREPARATION_UNCONFIRMED',flush=True);sys.exit(1)
