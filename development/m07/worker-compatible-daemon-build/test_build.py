"""Pure values/fake ports only. No stage, OCI, Docker, provider or private profile."""
from pathlib import Path
import copy,importlib.util,json,subprocess,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('compatible_daemon_build_tests',HERE/'build.py');b=importlib.util.module_from_spec(spec);spec.loader.exec_module(b)
RUN='00000000-0000-4000-8000-000000000001';STAGE='00000000-0000-4000-8000-000000000002'
class Fake(b.Build):
 def __init__(self):self.inputs={'run':RUN};self.source={'source_sha256':'a'*64,'files':[{'path':'synthetic'}]};self.build_run=None;self.files={};self.version=1;self.calls=[];self.unknown=False;self.drift=False
 def exists(self,name):return name in self.files
 def read(self,name):return copy.deepcopy(self.files[name])
 def write(self,name,value):
  if name in self.files:raise ValueError('EXCLUSIVE')
  self.files[name]=copy.deepcopy(value)
 def hash(self,name):return b.sha(b.base.compact(self.files[name]))
 def pins(self):return{'new_source':self.version}
 def source_admission(self):return{'archive':'approved','quality':'approved'}
 def retained_native(self):return{'artifact':{'runtime_digest':b.a.DIGEST},'references':{'export':b.a.EXPORT,'ready':b.a.READY,'probe':b.a.PROBE}}
 def context(self,kind):
  if kind=='native':
   b.need(not self.exists('reuse-native.claim.json'));return{'scope':'pre_reuse_only'}
  return super().context(kind)
 def _daemon_context(self):return{'daemon_source_sha256':self.source['source_sha256'],'native_source_sha256':b.a.SOURCE,'native_manifest_sha256':b.a.MANIFEST,'native_compatibility_sha256':'c'*64,'native_graph_sha256':b.a.GRAPH}
 def emitter(self,args):
  self.calls.append(args)
  if args==['stage']:return{'directory':'.local/worker-hosting/'+STAGE,'source_sha256':self.source['source_sha256'],'file_count':1}
  if self.unknown:raise TimeoutError('UNKNOWN')
  if self.drift:self.version+=1
  return self._daemon_context()
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  # Immutable small source metadata only; no archive/profile/guard operation.
  old=b.MAIN/'.local/worker-hosting'/b.a.BUILD_RUN
  cls.provenance=json.loads((old/'source-provenance.json').read_bytes());cls.native=json.loads((old/'context/apps/worker/native-source.json').read_bytes());cls.manifest=(old/'context/apps/worker/native-sandbox-manifest.json').read_bytes()
 def fixture(self):
  native=copy.deepcopy(self.native);files=copy.deepcopy(native['files']);row=next(r for r in files if r['path']=='packages/integrations/src/openai-specs.ts');row['sha256']='1'*64
  source={'commit':'a'*40,'tree':'b'*40,'archive':{'path':'.local/synthetic/source.tar','sha256':'c'*64},'source_sha256':b.sha(b.base.compact(files)),'files':files,'native_graph_sha256':b.a.GRAPH,'daemon_graph_sha256':b.sha(b.base.compact(self.provenance['daemon_graph'])),'quality':{'path':'tracking/evidence/synthetic.json','sha256':'d'*64}}
  graphs={'native':copy.deepcopy(self.provenance['native_graph']),'daemon':copy.deepcopy(self.provenance['daemon_graph'])}
  descriptor={'schema_version':'1.0','daemon_source_sha256':source['source_sha256'],'native_source_sha256':b.a.SOURCE,'native_manifest_sha256':b.a.MANIFEST,'native_graph_sha256':b.a.GRAPH,'native_graph':graphs['native']}
  return source,native,self.manifest,descriptor,graphs,self.provenance['native_graph']
 def test_exact_dual_sources_retain_old_native_and_new_daemon_without_relabel(self):
  args=self.fixture();value=b.dual_identity(*args);self.assertEqual(value['native_source_sha256'],b.a.SOURCE);self.assertNotEqual(value['daemon_source_sha256'],b.a.SOURCE);self.assertFalse(value['native_rebuilt'])
 def test_native_graph_build_input_and_descriptor_negatives_cannot_use_a_claimed_hash_only(self):
  for mode in('native_module_source','lock_source','native_graph','descriptor_native','descriptor_daemon','manifest','extra_descriptor','old_native_inventory'):
   source,native,manifest,desc,graphs,previous=self.fixture()
   if mode in('native_module_source','lock_source'):
    name=graphs['native']['modules'][0]['path']if mode=='native_module_source'else'package-lock.json';next(r for r in source['files']if r['path']==name)['sha256']='2'*64;source['source_sha256']=b.sha(b.base.compact(source['files']));desc['daemon_source_sha256']=source['source_sha256']
   if mode=='native_graph':graphs['native']['modules'][0]['emitted_sha256']='3'*64
   if mode=='descriptor_native':desc['native_source_sha256']=source['source_sha256']
   if mode=='descriptor_daemon':desc['daemon_source_sha256']=b.a.SOURCE
   if mode=='manifest':manifest+=b' '
   if mode=='extra_descriptor':desc['ignored']=True
   if mode=='old_native_inventory':native['files'][0]['sha256']='4'*64
   with self.subTest(mode=mode),self.assertRaises(ValueError):b.dual_identity(source,native,manifest,desc,graphs,previous)
 def test_defaultoff_all_mutating_actions_stop_before_any_port_and_native_actions_always_deny(self):
  f=Fake();self.assertFalse(b.BUILD_ENABLED);self.assertIsNone(b.a.FUTURE_DAEMON_PROFILE)
  actions=[lambda:f.stage(),lambda:f.reuse_native(),lambda:f.export('daemon'),lambda:f.export('native'),lambda:f.manifest(),lambda:f.prepare_oci('native'),lambda:f.prepare_oci('daemon'),lambda:f.emit(),lambda:f.export_readback('daemon')]
  for action in actions:
   with self.assertRaises(ValueError):action()
  self.assertEqual(f.calls,[]);self.assertEqual(f.files,{})
  with patch.object(b,'BUILD_ENABLED',True):
   for action in(lambda:f.export('native'),lambda:f.prepare_oci('native'),lambda:f.manifest(),lambda:f.export_readback('native')):
    with self.assertRaises(ValueError):action()
 def test_real_once_protocol_stage_reuse_dual_context_and_no_native_dispatch(self):
  f=Fake()
  with patch.object(b,'BUILD_ENABLED',True):
   f.stage();result=f.reuse_native();self.assertEqual(result['context'],f.context('daemon'))
   self.assertEqual(f.calls,[['stage'],['reuse-native',STAGE,b.a.BUILD_RUN]])
   for phase in('stage','reuse-native'):
    self.assertTrue(f.read(phase+'.normal.json')['normal_return_observed']);self.assertEqual(f.read(phase+'.normal.json')['claim_sha256'],f.hash(phase+'.claim.json'))
   with self.assertRaises(ValueError):f.reuse_native()
  self.assertEqual(len(f.calls),2)
 def test_unknown_reuse_retains_claim_and_cannot_admit_dual_files_or_repeat(self):
  f=Fake()
  with patch.object(b,'BUILD_ENABLED',True):
   f.stage();f.unknown=True
   with self.assertRaises(TimeoutError):f.reuse_native()
   self.assertIn('reuse-native.claim.json',f.files);self.assertNotIn('reuse-native.normal.json',f.files)
   with self.assertRaises((ValueError,KeyError)):f.context('daemon')
   with self.assertRaises(ValueError):f.reuse_native()
  self.assertEqual(len(f.calls),2)
 def test_drift_after_reuse_has_no_normal_marker(self):
  f=Fake()
  with patch.object(b,'BUILD_ENABLED',True):
   f.stage();f.drift=True
   with self.assertRaises(ValueError):f.reuse_native()
  self.assertNotIn('reuse-native.normal.json',f.files)
 def test_profile_unset_and_actual_defaultoff_entry_do_not_open_private_profile(self):
  with self.assertRaises(ValueError):b.load_profile()
  with self.assertRaises(ValueError):b.load_build()
  p=subprocess.run([str(b.MAIN/'.venv-skills/Scripts/python.exe'),'-X','utf8','-B',str(HERE/'build.py'),'daemon-export'],input=b'',capture_output=True,timeout=10)
  self.assertEqual(p.returncode,1);self.assertEqual(p.stdout.strip(),b'COMPATIBLE_DAEMON_BUILD_DISABLED_OR_UNCONFIRMED');self.assertEqual(p.stderr,b'')
 def test_inherited_cachefree_daemon_OCI_archive_and_selected_source_admission_are_not_reimplemented(self):
  import inspect
  export=inspect.getsource(b.base.Build.export);self.assertIn("if kind=='daemon':command+=['--no-cache']",export);self.assertIn("self.l.oci.base.import_gate(result['stderr'],kind)",export);self.assertIn('self.validate_archive(self.l.oci.archive_proof',export)
  self.assertIs(b.Build.local,b.base.Build.local);self.assertIs(b.Build.validate_archive,b.base.Build.validate_archive);self.assertIn('super().source_admission()',inspect.getsource(b.Build.source_admission))
if __name__=='__main__':unittest.main()
