"""Synthetic OCI archives and pure commands only; no export/upload/provider."""
from pathlib import Path
import importlib.util,io,json,tarfile,tempfile,unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('oci34_test_common',HERE/'oci.py');oci=importlib.util.module_from_spec(spec);spec.loader.exec_module(oci)
spec=importlib.util.spec_from_file_location('oci34_test_export',HERE/'export.py');export=importlib.util.module_from_spec(spec);spec.loader.exec_module(export)
spec=importlib.util.spec_from_file_location('oci34_test_transfer',HERE/'transfer.py');transfer=importlib.util.module_from_spec(spec);spec.loader.exec_module(transfer)

class ArchiveGuards(unittest.TestCase):
 def archive(self,directory,patch=None,extra=None):
  data=lambda value:json.dumps(value,separators=(',',':')).encode()
  blobs={}
  def descriptor(raw,media):
   value='sha256:'+oci.sha(raw);blobs[value]=raw;return {'digest':value,'size':len(raw),'mediaType':media}
  layer=descriptor(b'synthetic opaque compressed layer','application/vnd.oci.image.layer.v1.tar+zstd')
  config=descriptor(data({'os':'linux','architecture':'amd64'}),'application/vnd.oci.image.config.v1+json')
  if patch:layer.update(patch)
  runtime=descriptor(data({'schemaVersion':2,'mediaType':oci.MANIFEST,'config':config,'layers':[layer]}),oci.MANIFEST)
  index=descriptor(data({'schemaVersion':2,'mediaType':oci.INDEX,'manifests':[{**runtime,'platform':{'os':'linux','architecture':'amd64'}}]}),oci.INDEX)
  files={'oci-layout':data({'imageLayoutVersion':'1.0.0'}),'index.json':data({'schemaVersion':2,'manifests':[index]}),**{'blobs/sha256/'+key[7:]:raw for key,raw in blobs.items()}}
  if extra:files.update(extra)
  archive=directory/'input.tar'
  with tarfile.open(archive,'w:')as tar:
   for name,raw in files.items():
    entry=tarfile.TarInfo(name);entry.size=len(raw);tar.addfile(entry,io.BytesIO(raw))
  return archive,index['digest'],runtime['digest'],files
 def test_full_recursive_closure_is_verified_and_copied_without_conversion(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory).resolve();archive,index,runtime,files=self.archive(root);output=root/'oci'
   result=oci.archive_proof(archive,output)
   self.assertEqual((result['index_digest'],result['runtime_digest']),(index,runtime));self.assertEqual(result['blobs_verified'],4)
   self.assertTrue(result['all_blobs_reachable']);self.assertFalse(result['layers_recompressed']);self.assertFalse(result['legacy_manifest_used'])
   self.assertEqual({p.relative_to(output).as_posix():p.read_bytes()for p in output.rglob('*')if p.is_file()},files)
 def test_wrong_descriptor_size_or_external_url_is_rejected_before_copy(self):
  for patch in [{'size':1},{'urls':['https://untrusted.invalid/layer']}]:
   with tempfile.TemporaryDirectory()as directory:
    root=Path(directory).resolve();archive,*_=self.archive(root,patch=patch);output=root/'oci'
    with self.assertRaises(ValueError):oci.archive_proof(archive,output)
    self.assertFalse(output.exists())
 def test_unreachable_blob_is_rejected(self):
  with tempfile.TemporaryDirectory()as directory:
   root=Path(directory).resolve();raw=b'unreferenced';archive,*_=self.archive(root,extra={'blobs/sha256/'+oci.sha(raw):raw})
   with self.assertRaises(ValueError):oci.archive_proof(archive)
 def test_unsafe_tar_path_and_legacy_manifest_are_rejected(self):
  for name in ['../escape','manifest.json']:
   with tempfile.TemporaryDirectory()as directory:
    archive,*_=self.archive(Path(directory).resolve(),extra={name:b'unsafe'})
    with self.assertRaises(ValueError):oci.archive_proof(archive)
 def test_export_commands_are_local_oci_only_with_fixed_platform_and_graph(self):
  for kind in ['native','daemon']:
   command=export.command(kind);output=command[command.index('--output')+1]
   self.assertTrue(output.startswith('type=oci,'));self.assertIn('compression=zstd',output);self.assertNotIn('push=true',output);self.assertNotIn('--push',command)
   self.assertEqual(command[command.index('--platform')+1],'linux/amd64');self.assertEqual(command[-1],str(oci.base.CONTEXT))
   self.assertEqual('--no-cache'in command,kind=='daemon')
 def test_target_and_kind_are_fixed(self):
  self.assertTrue(oci.target('native').endswith('/native:english34-oci-4186fd1e'))
  with self.assertRaises(ValueError):oci.target('../other')

class TransportGuards(unittest.TestCase):
 def value(self,kind='native'):
  index='sha256:'+'a'*64;runtime='sha256:'+'b'*64
  read={'index_digest':index,'runtime_digest':runtime,'index_body_sha256':index[7:],'runtime_body_sha256':runtime[7:]}
  return {'result':'passed','action':'standalone_oci_transfer','kind':kind,'run':oci.RUN,'source_sha256':oci.SOURCE,'target':oci.target(kind),'index_digest':index,'runtime_digest':runtime,'exit_code':0,'timed_out':False,'output_limit_exceeded':False,'export_exit_code':0,'copy_completed':True,'local_export_completed':True,'all_blob_sha256_and_descriptor_sizes_verified':True,'all_blobs_reachable':True,'remote_digest_independent_readback_equal':True,'normal_copy_process_return_observed':True,'layers_recompressed':False,'legacy_manifest_used':False,'external_descriptor_urls':False,'remote_readbacks':[read,dict(read)],'source':{'source_sha256':oci.SOURCE,'file_count':160,'manifest_sha256':None},'production_import_gate':None}
 def test_success_requires_actual_export_normal_copy_closure_and_both_reads(self):
  value=self.value();self.assertEqual(transfer.accepted(value),value)
  for key,invalid in [('exit_code',1),('export_exit_code',1),('copy_completed',False),('all_blobs_reachable',False),('normal_copy_process_return_observed',False),('remote_digest_independent_readback_equal',False)]:
   with self.assertRaises(ValueError):transfer.accepted({**value,key:invalid})
  with self.assertRaises(ValueError):transfer.accepted({**value,'remote_readbacks':[value['remote_readbacks'][0]]})
 def test_daemon_requires_actual_uncached_final_uid_import(self):
  value=self.value('daemon');value['source']['manifest_sha256']='c'*64;value['production_import_gate']={'user':'1000:1000','network':'none','completed':True,'cached':False,'build_exit_code':0,'step':'#25'}
  transfer.accepted(value);value['production_import_gate']['cached']=True
  with self.assertRaises(ValueError):transfer.accepted(value)
 def test_remote_raw_body_must_hash_to_exact_digest(self):
  raw=b'{"schemaVersion":2}';expected='sha256:'+oci.sha(raw)
  self.assertEqual(transfer.body(raw,expected),raw);self.assertEqual(transfer.body(raw+b'\n',expected),raw)
  with self.assertRaises(transfer.ReadFailure):transfer.body(b'altered',expected)
 def test_copy_is_explicit_oci_digest_without_platform_or_conversion(self):
  command=transfer.copy_command('native',{'index_digest':'sha256:'+'a'*64})
  self.assertEqual(command[:3],[str(oci.REGCTL),'image','copy']);self.assertTrue(command[3].startswith('ocidir://.local/m03-english-oci34/native-oci@sha256:'))
  self.assertEqual(command[-1],oci.target('native'));self.assertNotIn('--platform',command)
 def test_transport_classifier_discards_raw_private_text(self):
  for raw,code in [(b'privateToken TLS handshake timeout','TLS_HANDSHAKE_TIMEOUT'),(b'privateToken no such host','DNS_FAILURE'),(b'403 Forbidden privateToken','HTTP_403'),(b'502 Bad Gateway privateToken','HTTP_5XX')]:
   result=transfer.classify(raw);self.assertEqual(result,code);self.assertNotIn('privateToken',result)
  self.assertEqual(transfer.classify(b'',True),'OPERATION_TIMEOUT')
 def test_transfer_environment_has_known_config_and_no_provider_secrets(self):
  environment=transfer.environment();self.assertEqual(environment['REGCTL_CONFIG'],str(transfer.CONFIG));self.assertEqual(environment['DOCKER_CONFIG'],str(oci.base.refresh.DOCKER_CONFIG))
  self.assertFalse({'DEBUG','OPENAI_API_KEY','VERCEL_TOKEN','EPS_SPECS_PG_PASSWORD'}&set(environment))
 def test_known_manifest_preflight_is_one_read_before_any_copy(self):
  raw=json.dumps({'schemaVersion':2,'mediaType':oci.MANIFEST}).encode();expected='sha256:'+oci.sha(raw)
  result={'stdout':raw,'stderr':b'','exit_code':0,'timed_out':False,'output_limit_exceeded':False}
  with patch.object(transfer.oci.native,'OLD_IMAGE',expected),patch.object(transfer.oci,'bounded',return_value=result)as call:
   value=transfer.preflight();self.assertEqual(value['observed_body_sha256'],expected[7:]);self.assertFalse(value['provider_mutations']);self.assertEqual(call.call_count,1)
   command=call.call_args.args[0];self.assertEqual(command[1:3],['manifest','get']);self.assertEqual(command[-2:],['--format','raw-body']);self.assertNotIn('copy',command)

if __name__=='__main__':unittest.main()
