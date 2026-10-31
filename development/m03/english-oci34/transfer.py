"""Root-executed standalone OCI transfer and read-only reconciliation.

Separate from the already frozen local exporter. Copies verified OCI bytes with
the pinned historical 16-MiB configuration, without claiming it repairs TLS.
"""
from pathlib import Path
import importlib.util,json,re,sys

HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
oci=module('english_oci34_transfer_common',HERE/'oci.py');export=module('english_oci34_transfer_export',HERE/'export.py')
CONFIG=oci.PRIVATE/'regctl-config.json'

def source_pins():return {**export.source_pins(),'transfer_operator_sha256':oci.sha(oci.exact_file(Path(__file__)))}
def environment():
 value=oci.build.environment();value.update({'REGCTL_CONFIG':str(CONFIG),'DOCKER_CONFIG':str(oci.base.refresh.DOCKER_CONFIG),'PATH':str(oci.base.refresh.DOCKER.parent)})
 return value
def file_hash(path):
 oci.need(path.is_file()and not path.is_symlink()and path.resolve()==path and 0<path.stat().st_size<=oci.MAX_BLOB)
 before=path.stat();hasher=oci.hashlib.sha256()
 with path.open('rb')as stream:
  while chunk:=stream.read(1024**2):hasher.update(chunk)
 after=path.stat();oci.need((before.st_size,before.st_mtime_ns,before.st_ino)==(after.st_size,after.st_mtime_ns,after.st_ino));return hasher.hexdigest(),before.st_size
def verify_directory(kind,proof):
 folder=oci.private_path(kind,'oci');oci.need(folder.is_dir()and not folder.is_symlink()and folder.resolve()==folder)
 expected={'oci-layout','index.json'}|{'blobs/sha256/'+row['digest'][7:]for row in proof['blobs']};actual=set()
 for path in folder.rglob('*'):
  oci.need(not path.is_symlink()and path.resolve().is_relative_to(folder))
  if path.is_file():actual.add(path.relative_to(folder).as_posix())
 oci.need(actual==expected and json.loads(oci.exact_file(folder/'oci-layout',4096))=={'imageLayoutVersion':'1.0.0'})
 index=json.loads(oci.exact_file(folder/'index.json',oci.MAX_JSON));oci.need(index.get('schemaVersion')==2 and type(index.get('manifests'))is list and len(index['manifests'])==1)
 root=index['manifests'][0];oci.need(root.get('digest')==proof['index_digest']and root.get('mediaType')in(oci.INDEX,oci.MANIFEST)and root.get('urls')in(None,[])and 'data'not in root)
 for row in proof['blobs']:
  oci.digest(row['digest']);observed,size=file_hash(folder/'blobs/sha256'/row['digest'][7:]);oci.need(observed==row['digest'][7:]and size==row['bytes'])
 oci.need(root.get('size')==next(row['bytes']for row in proof['blobs']if row['digest']==proof['index_digest']))
 return {'index_digest':proof['index_digest'],'runtime_digest':proof['runtime_digest'],'blobs_verified':len(proof['blobs'])}
def state(kind):
 proof=export.load_export(kind);oci.need(proof['source_pins']==export.source_pins()and oci.context(kind)==proof['source']);verify_directory(kind,proof)
 pointer=json.loads(oci.exact_file(oci.private_path(kind,'export.success.json'),4096));return proof,pointer
def copy_command(kind,proof):
 relative=oci.private_path(kind,'oci').relative_to(oci.ROOT).as_posix()
 return [str(oci.REGCTL),'image','copy','ocidir://'+relative+'@'+oci.digest(proof['index_digest']),oci.target(kind)]
def classify(stderr,timed_out=False,overflow=False):
 if timed_out:return 'OPERATION_TIMEOUT'
 if overflow:return 'OUTPUT_LIMIT_EXCEEDED'
 text=stderr.decode('utf8','replace')
 if re.search('TLS handshake timeout|tls: handshake timeout',text,re.I):return 'TLS_HANDSHAKE_TIMEOUT'
 if re.search('x509:|certificate signed by unknown authority|certificate verify failed',text,re.I):return 'TLS_CERTIFICATE_ERROR'
 if re.search('no such host|Temporary failure in name resolution|server misbehaving',text,re.I):return 'DNS_FAILURE'
 for code,phrase in [('401','Unauthorized'),('403','Forbidden'),('404','Not Found'),('413','Request Entity Too Large|Payload Too Large'),('429','Too Many Requests')]:
  if re.search(r'\b'+code+r'\s+(?:'+phrase+r')\b|(?:status(?: code)?|HTTP)[^\r\n]{0,12}\b'+code+r'\b',text,re.I):return 'HTTP_'+code
 if re.search(r'\b5[0-9]{2}\s+(?:Bad Gateway|Internal Server Error|Service Unavailable|Gateway Timeout)\b|(?:status(?: code)?|HTTP)[^\r\n]{0,12}\b5[0-9]{2}\b',text,re.I):return 'HTTP_5XX'
 if re.search('unexpected EOF|connection reset|broken pipe',text,re.I):return 'NETWORK_CONNECTION_FAILED'
 return 'TRANSPORT_UNCONFIRMED'
class ReadFailure(Exception):
 def __init__(self,code):self.code=code
def body(raw,expected):
 if 'sha256:'+oci.sha(raw)==expected:return raw
 if raw.endswith(b'\n')and 'sha256:'+oci.sha(raw[:-1])==expected:return raw[:-1]
 raise ReadFailure('REMOTE_MANIFEST_DIGEST_MISMATCH')
def remote_read(kind,proof):
 result={}
 for label,reference in [('index',oci.target(kind)),('runtime',oci.PREFIX+kind+'@'+proof['runtime_digest'])]:
  response=oci.bounded([str(oci.REGCTL),'manifest','get',reference,'--format','raw-body'],environment(),45,'remote_'+label+'_read')
  if response['exit_code']!=0 or response['timed_out']or response['output_limit_exceeded']:raise ReadFailure(classify(response['stderr'],response['timed_out'],response['output_limit_exceeded']))
  expected=proof[label+'_digest'];parsed=json.loads(body(response['stdout'],expected));oci.need(parsed.get('schemaVersion')==2 and parsed.get('mediaType')in(oci.INDEX,oci.MANIFEST))
  result[label+'_digest']=expected;result[label+'_body_sha256']=expected[7:]
 return result
def preflight():
 # Exactly one known, immutable old image GET proves this client's raw-body
 # formatting/read path before any new-target copy claim. No auth refresh.
 expected=oci.native.OLD_IMAGE;reference=oci.PREFIX+'native@'+expected
 response=oci.bounded([str(oci.REGCTL),'manifest','get',reference,'--format','raw-body'],environment(),45,'known_manifest_preflight')
 if response['exit_code']!=0 or response['timed_out']or response['output_limit_exceeded']:raise ReadFailure(classify(response['stderr'],response['timed_out'],response['output_limit_exceeded']))
 parsed=json.loads(body(response['stdout'],expected));oci.need(parsed.get('schemaVersion')==2 and parsed.get('mediaType')==oci.MANIFEST)
 return {'result':'passed','method':'GET','reference_digest':expected,'observed_body_sha256':expected[7:],'provider_mutations':False}
def accepted(value):
 oci.need(value.get('result')=='passed'and value.get('action')=='standalone_oci_transfer'and value.get('kind')in('native','daemon')and value.get('run')==oci.RUN and value.get('source_sha256')==oci.SOURCE and value.get('target')==oci.target(value['kind']))
 for key in ['index_digest','runtime_digest']:oci.digest(value.get(key))
 oci.need(value.get('exit_code')==0 and value.get('timed_out')is False and value.get('output_limit_exceeded')is False and value.get('export_exit_code')==0 and value.get('copy_completed')is True and value.get('local_export_completed')is True)
 for key in ['all_blob_sha256_and_descriptor_sizes_verified','all_blobs_reachable','remote_digest_independent_readback_equal','normal_copy_process_return_observed']:oci.need(value.get(key)is True)
 oci.need(value.get('layers_recompressed')is False and value.get('legacy_manifest_used')is False and value.get('external_descriptor_urls')is False)
 reads=value.get('remote_readbacks');oci.need(type(reads)is list and len(reads)==2 and reads[0]==reads[1]=={'index_digest':value['index_digest'],'runtime_digest':value['runtime_digest'],'index_body_sha256':value['index_digest'][7:],'runtime_body_sha256':value['runtime_digest'][7:]})
 source=value.get('source');oci.need(type(source)is dict and source.get('source_sha256')==oci.SOURCE and source.get('file_count')==160)
 if value['kind']=='native':oci.need(value.get('production_import_gate')is None and source.get('manifest_sha256')is None)
 else:
  gate=value.get('production_import_gate');oci.need(type(gate)is dict and gate.get('user')=='1000:1000'and gate.get('network')=='none'and gate.get('completed')is True and gate.get('cached')is False and gate.get('build_exit_code')==0 and re.fullmatch('#[0-9]{1,4}',gate.get('step','')))
  oci.need(type(source.get('manifest_sha256'))is str and re.fullmatch('[a-f0-9]{64}',source['manifest_sha256']))
 return value
def load_success(kind):
 kind=oci.kind_value(kind);pointer=json.loads(oci.exact_file(oci.private_path(kind,'build.success.json'),4096));ref,value=oci.reference(pointer['receipt']);oci.need(ref==pointer);accepted(value)
 claim_path=oci.private_path(kind,'transfer.claim.json');returned_path=oci.private_path(kind,'copy.returned.json')
 claim=json.loads(oci.exact_file(claim_path));returned=json.loads(oci.exact_file(returned_path))
 oci.need(value['source_pins'].get('transfer_operator_sha256')==oci.sha(oci.exact_file(Path(__file__)))and value['source_pins'].get('export_operator_sha256')==oci.sha(oci.exact_file(HERE/'export.py'))and value['source_pins'].get((HERE/'oci.py').relative_to(oci.ROOT).as_posix())==oci.sha(oci.exact_file(HERE/'oci.py')))
 oci.need(value['kind']==kind and value['transfer_claim_sha256']==oci.sha(claim_path.read_bytes())and value['copy_returned_sha256']==oci.sha(returned_path.read_bytes())and returned['claim_sha256']==value['transfer_claim_sha256'])
 oci.need(claim['source_pins']==value['source_pins']==source_pins()and claim['export']==value['export_receipt']and claim['kind']==kind and claim['run']==oci.RUN and claim['source_sha256']==oci.SOURCE and claim['target']==oci.target(kind)and claim['regctl_config_sha256']==oci.sha(oci.CONFIG)and returned['exit_code']==0 and returned['timed_out']is False and returned['output_limit_exceeded']is False and returned['normal_process_return_observed']is True)
 export_ref,exported=oci.reference(value['export_receipt']['receipt']);oci.need(export_ref==value['export_receipt']and exported['result']=='passed'and exported['kind']==kind and exported['index_digest']==value['index_digest']and exported['runtime_digest']==value['runtime_digest']and exported['source']==value['source']and exported['source_pins']==value['export_source_pins'])
 oci.need(exported['exit_code']==0 and exported['local_export_completed']is True and exported['all_blob_sha256_and_descriptor_sizes_verified']is True and exported['all_blobs_reachable']is True and exported['blobs_verified']==value['blobs_verified']and exported['compressed_blob_bytes']==value['compressed_blob_bytes']and exported['archive_sha256']==value['archive_sha256'])
 return value
def main():
 oci.need(len(sys.argv)==3 and sys.argv[1]in('copy','readback'));action=sys.argv[1];kind=oci.kind_value(sys.argv[2]);pins=source_pins();proof,export_ref=state(kind)
 oci.PRIVATE.mkdir(parents=True,exist_ok=True)
 if not CONFIG.exists():
  with CONFIG.open('xb')as stream:stream.write(oci.CONFIG);stream.flush();oci.os.fsync(stream.fileno())
 oci.need(oci.exact_file(CONFIG,4096)==oci.CONFIG)
 claim_path=oci.private_path(kind,'transfer.claim.json');returned_path=oci.private_path(kind,'copy.returned.json');success_path=oci.private_path(kind,'build.success.json')
 if action=='copy':
  oci.need(not any(p.exists()for p in [claim_path,returned_path,success_path]))
  try:known_read=preflight()
  except ReadFailure as error:
   path=oci.receipt(kind,'preflight',{'result':'unconfirmed','failure_code':error.code,'copy_claim_created':False,'copy_requested':False,'provider_mutations':False});print(json.dumps({'result':'unconfirmed','receipt':path.relative_to(oci.ROOT).as_posix(),'failure_code':error.code}),flush=True);raise
  oci.exclusive(claim_path,{'kind':kind,'run':oci.RUN,'source_sha256':oci.SOURCE,'source_pins':pins,'export':export_ref,'claimed_at':oci.stamp(),'target':oci.target(kind),'regctl_config_sha256':oci.sha(oci.CONFIG),'known_manifest_preflight':known_read,'copy_may_have_occurred':True,'automatic_copy_retry':False})
  oci.need(source_pins()==pins and state(kind)==(proof,export_ref))
  print(json.dumps({'event':'standalone_oci_transfer_started','kind':kind,'target':oci.target(kind),'configured_chunk_bytes':16777216,'monolithic_threshold_bytes':16777216,'tls_fix_claimed':False}),flush=True)
  result=oci.bounded(copy_command(kind,proof),environment(),1800,'registry_copy')
  returned={'claim_sha256':oci.sha(claim_path.read_bytes()),'normal_process_return_observed':not result['timed_out']and not result['output_limit_exceeded'],'exit_code':result['exit_code'],'timed_out':result['timed_out'],'output_limit_exceeded':result['output_limit_exceeded'],'elapsed_seconds':result['elapsed_seconds'],'stdout_bytes':len(result['stdout']),'stderr_bytes':len(result['stderr']),'failure_code':None if result['exit_code']==0 else classify(result['stderr'],result['timed_out'],result['output_limit_exceeded'])}
  oci.exclusive(returned_path,returned)
 else:
  oci.need(not success_path.exists());returned=json.loads(oci.exact_file(returned_path))
 claim=json.loads(oci.exact_file(claim_path));oci.need(claim['source_pins']==pins and claim['export']==export_ref and returned['claim_sha256']==oci.sha(claim_path.read_bytes()))
 passed=False;reads=[];read_error=None
 try:
  first=remote_read(kind,proof);reads.append(first);second=remote_read(kind,proof);reads.append(second)
  oci.need(first==second and source_pins()==pins and state(kind)==(proof,export_ref)and oci.exact_file(CONFIG,4096)==oci.CONFIG)
  oci.need(returned['exit_code']==0 and returned['normal_process_return_observed']is True and not returned['timed_out']and not returned['output_limit_exceeded']);passed=True
 except ReadFailure as error:read_error=error.code
 except Exception:read_error='OCI_OR_SOURCE_CONFIRMATION_FAILED'
 value={'result':'passed'if passed else'unconfirmed','action':'standalone_oci_transfer','source':proof['source'],'source_pins':pins,'export_source_pins':proof['source_pins'],'export_receipt':export_ref,'production_import_gate':proof['production_import_gate'],'index_digest':proof['index_digest'],'runtime_digest':proof['runtime_digest'],'exit_code':returned['exit_code'],'timed_out':returned['timed_out'],'output_limit_exceeded':returned['output_limit_exceeded'],'export_exit_code':proof['exit_code'],'copy_completed':returned['exit_code']==0 and returned['normal_process_return_observed'],'local_export_completed':True,'normal_copy_process_return_observed':returned['normal_process_return_observed'],'remote_readbacks':reads,'remote_digest_independent_readback_equal':len(reads)==2 and reads[0]==reads[1],'all_blob_sha256_and_descriptor_sizes_verified':True,'all_blobs_reachable':True,'blobs_verified':proof['blobs_verified'],'compressed_blob_bytes':proof['compressed_blob_bytes'],'archive_sha256':proof['archive_sha256'],'layers_recompressed':False,'layers_recompressed_scope':'No transformation after the actual force-zstd OCI export.','legacy_manifest_used':False,'external_descriptor_urls':False,'configured_chunk_bytes':16777216,'monolithic_threshold_bytes':16777216,'server_chunk_minimum_can_override_configuration':True,'tls_fix_claimed':False,'registry_credentials_source':'Existing Docker Desktop credential helper through isolated DOCKER_CONFIG; no operator extraction.','private_configuration_transferred':False,'transfer_claim_sha256':oci.sha(claim_path.read_bytes()),'copy_returned_sha256':oci.sha(returned_path.read_bytes()),'copy_failure_code':returned.get('failure_code'),'readback_failure_code':read_error,'claim_retained':True,'automatic_copy_retry':False,'registry_ready_verified':False,'native_job_or_english_acceptance':False}
 path=oci.receipt(kind,'transfer',value)
 if passed:accepted(value);oci.exclusive(success_path,{'receipt':path.relative_to(oci.ROOT).as_posix(),'sha256':oci.sha(path.read_bytes())})
 print(json.dumps({'result':value['result'],'receipt':path.relative_to(oci.ROOT).as_posix(),'copy_failure_code':value['copy_failure_code'],'readback_failure_code':read_error,'index_digest':proof['index_digest'],'runtime_digest':proof['runtime_digest'],'claim_retained':True}),flush=True);oci.need(passed)

if __name__=='__main__':
 try:main()
 except Exception:print('ENGLISH34_OCI_TRANSFER_UNCONFIRMED',flush=True);sys.exit(1)
