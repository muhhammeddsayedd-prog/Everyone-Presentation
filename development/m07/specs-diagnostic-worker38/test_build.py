"""Inert source, synthetic OCI and fake-port tests; no Docker/CLI/provider calls."""
from pathlib import Path
import copy, hashlib, importlib.util, io, json, subprocess, sys, tarfile, tempfile, types, unittest
from unittest.mock import Mock,patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('diagnostic38_test_build',HERE/'build.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)

def proof():
 names=['sha256:'+c*64 for c in 'abc']
 return {'archive_sha256':'d'*64,'archive_bytes':10240,'index_digest':names[2],'runtime_digest':names[2],'blobs_verified':3,'compressed_blob_bytes':90,'all_blob_sha256_and_descriptor_sizes_verified':True,'all_blobs_reachable':True,'layers_recompressed':False,'legacy_manifest_used':False,'external_descriptor_urls':False,'blobs':[{'digest':v,'bytes':30}for v in names]}

class FakePorts:
 def __init__(self,kind='native'):
  self.calls=[];self.report=None;self.pins={'synthetic':'a'*64};self.context_value={'file_count':164,'source_sha256':b.SOURCE};self.claimed=False
  self.output={'exit_code':0,'timed_out':False,'output_limit_exceeded':False,'elapsed_seconds':0.01,'stdout':b'not persisted','stderr':b''}
  if kind=='daemon':self.output['stderr']=('#37 [stage-1 18/18] '+b.mechanisms().base.IMPORT+'\n#37 DONE 0.1s\n').encode()
  self.proof=proof()
 def sources(self):self.calls.append('sources');return copy.deepcopy(self.pins)
 def context(self,kind):self.calls.append('context');return copy.deepcopy(self.context_value)
 def exists(self,kind):return self.claimed
 def claim(self,kind,value):self.calls.append('claim');self.claimed=True;self.claim_value=value
 def run(self,kind):self.calls.append('run');return self.output
 def archive(self,kind):self.calls.append('archive');return self.proof
 def save(self,kind,value):self.calls.append('save');self.report=value;return'synthetic-evidence.json'

class Tests(unittest.TestCase):
 def test_import_and_disabled_entry_have_no_external_or_private_IO(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):
   spec=importlib.util.spec_from_file_location('diagnostic38_import_again',HERE/'build.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
  self.assertIs(type(m.BUILD_ENABLED),bool)
  with patch.object(b,'BUILD_ENABLED',False),patch.object(b,'LocalPorts')as ports,patch.object(sys,'argv',['build.py','native']):
   with self.assertRaises(ValueError):b.main()
   with self.assertRaises(ValueError):b.export('native',FakePorts())
  ports.assert_not_called()

 def test_actual_vendor_two_link_buildx_is_accepted_without_relaxing_source_reader(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):
   self.assertEqual(b.vendor_binary_digest(b.DOCKER),b.DOCKER_SHA)
   self.assertEqual(b.vendor_binary_digest(b.PLUGIN),b.PLUGIN_SHA)
  self.assertEqual(b.DOCKER.stat().st_nlink,1);self.assertEqual(b.PLUGIN.stat().st_nlink,2)
  with self.assertRaises(ValueError):b.load(b.PLUGIN,256*1024**2)

 def test_vendor_reader_refuses_unlisted_path_wrong_hash_and_wrong_link_count(self):
  with patch.object(Path,'read_bytes')as read:
   with self.assertRaises(ValueError):b.vendor_binary_digest(b.PLUGIN.parent/'unlisted.exe')
   read.assert_not_called()
  original=b.PLUGIN.read_bytes();wrong=bytes([original[0]^1])+original[1:]
  with patch.object(Path,'read_bytes',return_value=wrong):
   with self.assertRaises(ValueError):b.vendor_binary_digest(b.PLUGIN)
  info=b.PLUGIN.lstat();fields=['st_mode','st_dev','st_ino','st_size','st_mtime_ns','st_nlink']
  for links in [0,1,3]:
   changed=types.SimpleNamespace(**{k:getattr(info,k)for k in fields});changed.st_nlink=links
   with patch.object(Path,'lstat',return_value=changed),patch.object(Path,'read_bytes')as read:
    with self.assertRaises(ValueError):b.vendor_binary_digest(b.PLUGIN)
    read.assert_not_called()

 def test_frozen_reuse_is_source_only_and_imports_cannot_launch_old_main(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):
   m=b.mechanisms()
  self.assertTrue(callable(m.archive_proof));self.assertTrue(callable(m.bounded));self.assertTrue(callable(m.base.import_gate))
  source=(HERE/'build.py').read_text();self.assertNotIn('m.main(',source);self.assertNotIn('refresh.sources(',source)

 def test_actual_scan_and_current164_staged_bytes_match_without_building(self):
  rows=b.scan_rows();self.assertEqual(len(rows),164);self.assertEqual(sum(r['bytes']for r in rows),1809018)
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')):v=b.verify_context('native')
  self.assertEqual(v['context_files'],168);self.assertIsNone(v['manifest_sha256'])
  self.assertEqual(v['source_sha256'],b.SOURCE)

 def test_context_rejects_scan_drift_or_undeclared_context_file(self):
  with patch.object(b,'SCAN_SHA','0'*64):
   with self.assertRaises(ValueError):b.scan_rows()
  original=b.load
  def changed(path,maximum=16*1024**2):
   if path==b.CONTEXT/'apps/worker/src/runtime-main.ts':return b'changed staged source'
   return original(path,maximum)
  with patch.object(b,'load',side_effect=changed):
   with self.assertRaises(ValueError):b.verify_context('native')
  extra=b.CONTEXT/'untracked.env'
  original_walk=Path.rglob
  def walk(path,pattern):return iter([*original_walk(path,pattern),extra])if path==b.CONTEXT else original_walk(path,pattern)
  with patch.object(Path,'rglob',walk):
   # A nonexistent undeclared path still cannot be admitted as a real file.
   with patch.object(Path,'is_file',lambda p:True if p==extra else p.stat().st_mode&0o170000==0o100000):
    with self.assertRaises(ValueError):b.verify_context('native')

 def test_export_commands_are_fixed_local_linux_amd64_without_push(self):
  for kind,dockerfile in [('native','native-sandbox'),('daemon','daemon')]:
   cmd=b.command(kind);self.assertEqual(cmd[:8],[str(b.DOCKER),'--host',b.HOST,'buildx','build','--builder','default','--platform'])
   self.assertIn('linux/amd64',cmd);self.assertEqual(cmd[-1],str(b.CONTEXT))
   self.assertEqual(cmd[cmd.index('--file')+1],str(b.CONTEXT/('Dockerfile.'+dockerfile)))
   out=cmd[cmd.index('--output')+1];self.assertTrue(out.startswith('type=oci,dest='));self.assertNotIn('push=true',out)
   self.assertNotIn('--push',cmd);self.assertNotIn('--build-arg',cmd);self.assertNotIn('--secret',cmd)
   self.assertEqual('--no-cache'in cmd,kind=='daemon')
  with self.assertRaises(ValueError):b.command('shell')

 def test_environment_drops_debug_provider_keys_and_ambient_docker_credentials(self):
  ambient={'SystemRoot':'C:/Windows','USERPROFILE':'C:/Users/example','DEBUG':'*','NODE_OPTIONS':'--bad','VERCEL_TOKEN':'private','OPENAI_API_KEY':'private','DOCKER_CONFIG':'other-config','PATH':'unsafe'}
  result=b.environment(ambient)
  self.assertEqual(result['ProgramFiles'],'C:/Program Files');self.assertEqual(result['DOCKER_HOST'],b.HOST)
  self.assertEqual(result['DOCKER_CONFIG'],str(b.PRIVATE/'docker-client'))
  self.assertEqual(result['PATH'],str(b.DOCKER.parent));self.assertFalse(set(result)&{'DEBUG','NODE_OPTIONS','VERCEL_TOKEN','OPENAI_API_KEY'})

 def test_manifest_binds_only_actual_new_native_digest_and_current_source(self):
  expected=b.manifest_value('sha256:'+'a'*64)
  self.assertEqual(expected['source_sha256'],b.SOURCE);self.assertEqual(expected['protocol'],'eps-native-files-v1')
  self.assertEqual(expected['image'],'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:'+'a'*64)
  for bad in ['latest','sha256:'+'A'*64,'https://private.invalid']:
   with self.assertRaises(ValueError):b.manifest_value(bad)
  source=(HERE/'build.py').read_text();self.assertIn("json.loads(raw)==manifest_value(native['runtime_digest'])",source)

 def test_success_needs_claim_before_dispatch_archive_and_post_source_check(self):
  for kind in ['native','daemon']:
   ports=FakePorts(kind)
   with patch.object(b,'BUILD_ENABLED',True):result=b.export(kind,ports)
   self.assertEqual(result['result'],'passed');self.assertLess(ports.calls.index('claim'),ports.calls.index('run'))
   self.assertEqual(ports.calls.count('run'),1);self.assertEqual(ports.calls.count('claim'),1)
   self.assertTrue(ports.report['normal_build_process_return_observed']);self.assertTrue(ports.report['source_revalidated_after_export'])
   self.assertEqual(ports.report['archive'],ports.proof);self.assertNotIn('stdout',ports.report);self.assertNotIn('stderr',ports.report)
   self.assertIsNone(ports.report['production_import_gate'])if kind=='native'else self.assertFalse(ports.report['production_import_gate']['cached'])
   self.assertFalse(ports.report['Vercel_registry_push_or_control_plane_called']);self.assertFalse(ports.claim_value['automatic_retry'])

 def test_unknown_dispatch_preserves_claim_and_never_replays(self):
  ports=FakePorts();ports.run=Mock(side_effect=TimeoutError('PRIVATE RESPONSE secret'))
  with patch.object(b,'BUILD_ENABLED',True):result=b.export('native',ports)
  self.assertEqual(result['result'],'unconfirmed');self.assertTrue(ports.claimed);self.assertFalse(ports.report['normal_build_process_return_observed'])
  self.assertNotIn('PRIVATE',json.dumps(ports.report));ports.run.assert_called_once()
  with patch.object(b,'BUILD_ENABLED',True):
   with self.assertRaises(ValueError):b.export('native',ports)
  ports.run.assert_called_once()

 def test_failed_process_timeout_overflow_tampered_archive_or_post_source_fail_closed(self):
  for mutation in [lambda p:p.output.update(exit_code=1),lambda p:p.output.update(timed_out=True),lambda p:p.output.update(output_limit_exceeded=True),lambda p:p.proof.update(all_blobs_reachable=False)]:
   ports=FakePorts();mutation(ports)
   with patch.object(b,'BUILD_ENABLED',True):result=b.export('native',ports)
   self.assertEqual(result['result'],'unconfirmed');self.assertIsNone(result['runtime_digest']);self.assertTrue(ports.claimed)
  ports=FakePorts();ports.sources=Mock(side_effect=[{'a':1},{'a':1},{'a':2}])
  with patch.object(b,'BUILD_ENABLED',True):result=b.export('native',ports)
  self.assertEqual(result['result'],'unconfirmed');self.assertEqual(ports.calls.count('run'),1)

 def test_daemon_requires_uncached_production_import_from_actual_build_log(self):
  for suffix in ['#37 CACHED\n','#38 DONE 0.1s\n','']:
   ports=FakePorts('daemon');ports.output['stderr']=('#37 [stage-1 18/18] '+b.mechanisms().base.IMPORT+'\n'+suffix).encode()
   with patch.object(b,'BUILD_ENABLED',True):result=b.export('daemon',ports)
   self.assertEqual(result['result'],'unconfirmed');self.assertNotIn('archive',ports.calls)

 def test_archive_verifier_checks_actual_synthetic_OCI_closure_and_corruption(self):
  m=b.mechanisms();blobs={}
  def blob(value):
   raw=json.dumps(value,separators=(',',':')).encode();digest='sha256:'+hashlib.sha256(raw).hexdigest();blobs[digest]=raw;return {'mediaType':'application/vnd.oci.image.config.v1+json','size':len(raw),'digest':digest}
  config=blob({'os':'linux','architecture':'amd64'});layer=blob({'synthetic':'layer'})
  manifest=blob({'schemaVersion':2,'mediaType':m.MANIFEST,'config':config,'layers':[layer]});manifest['mediaType']=m.MANIFEST
  index={'schemaVersion':2,'manifests':[manifest]}
  def archive(path,tamper=False):
   with tarfile.open(path,'w')as tar:
    for name,raw in [('oci-layout',b'{"imageLayoutVersion":"1.0.0"}'),('index.json',json.dumps(index).encode()),*[(('blobs/sha256/'+digest[7:]),raw)for digest,raw in blobs.items()]]:
     if tamper and name.endswith(config['digest'][7:]):raw=b'tampered'
     member=tarfile.TarInfo(name);member.size=len(raw);tar.addfile(member,io.BytesIO(raw))
  with tempfile.TemporaryDirectory()as directory:
   path=Path(directory).resolve()/'synthetic.tar';archive(path)
   actual=b.validate_archive(m.archive_proof(path));self.assertEqual(actual['blobs_verified'],3);self.assertEqual(actual['runtime_digest'],manifest['digest'])
   archive(path,True)
   with self.assertRaises(ValueError):m.archive_proof(path)

if __name__=='__main__':unittest.main()
