"""Offline fake ports; reads retained public native source artifacts only."""
from pathlib import Path
import copy,importlib.util,inspect,subprocess,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('ocr_build_tests',HERE/'build.py');b=importlib.util.module_from_spec(s);s.loader.exec_module(b)
oldtests=b.old.module('ocr_inert_previous_build_fixture',b.a.OLD/'test_build.py')
RUN='00000000-0000-4000-8000-000000000001';STAGE='00000000-0000-4000-8000-000000000002'
class Fake(b.Build):
 def __init__(self):
  self.inputs={'run':RUN};self.source,self.native_source,_,_,self.graphs,self.previous=oldtests.identity_fixture();self.build_run=None;self.files={};self.calls=[];self.unknown=False
 def exists(self,n):return n in self.files
 def read(self,n):return copy.deepcopy(self.files[n])
 def write(self,n,v):assert n not in self.files;self.files[n]=copy.deepcopy(v)
 def hash(self,n):return b.old.sha(b.old.base.compact(self.files[n]))
 def pins(self):return{'reviewed_new_source':'fixed'}
 def source_admission(self):return{'new_archive':'approved','new_quality':'approved'}
 def retained_native(self):return{'artifact':{'runtime_digest':b.old.a.DIGEST},'source':self.native_source,'native_graph':self.previous,'references':{'export':b.old.a.EXPORT,'ready':b.old.a.READY,'probe':b.old.a.PROBE}}
 def staged_native_graph(self):return self.graphs['native']
 def context(self,k):
  if k=='native':b.need(not self.exists('reuse-native.claim.json'));return{'pre_reuse':True}
  return b.old.Build.context(self,k)
 def _daemon_context(self):return{'daemon_source_sha256':self.source['source_sha256'],'native_source_sha256':b.old.a.SOURCE,'native_manifest_sha256':b.old.a.MANIFEST,'native_compatibility_sha256':'c'*64,'native_graph_sha256':b.old.a.GRAPH}
 def emitter(self,args):
  self.calls.append(args)
  if args==['stage']:return{'directory':'.local/worker-hosting/'+STAGE,'source_sha256':self.source['source_sha256'],'file_count':len(self.source['files'])}
  if self.unknown:raise TimeoutError('UNKNOWN')
  return self._daemon_context()
class Tests(unittest.TestCase):
 def test_disabled_new_dispatch_and_all_native_actions_refuse_without_claim(self):
  f=Fake();self.assertFalse(b.BUILD_ENABLED);self.assertIsNone(b.a.PROFILE)
  for call in(lambda:f.stage(),lambda:f.reuse_native(),lambda:f.export('daemon'),lambda:f.prepare_oci('daemon'),lambda:f.export_readback('daemon'),lambda:f.emit()):
   with self.assertRaises(ValueError):call()
  self.assertEqual(f.calls,[]);self.assertEqual(f.files,{})
  with patch.object(b,'BUILD_ENABLED',True):
   for call in(lambda:f.export('native'),lambda:f.prepare_oci('native'),lambda:f.export_readback('native'),lambda:f.manifest()):
    with self.assertRaises(ValueError):call()
 def test_new_wrapper_runs_same_real_once_stage_and_reuse_then_refuses_repeat(self):
  f=Fake()
  with patch.object(b,'BUILD_ENABLED',True):
   f.stage();value=f.reuse_native();self.assertEqual(value['context'],f.context('daemon'))
   with self.assertRaises(ValueError):f.reuse_native()
  self.assertEqual(f.calls,[['stage'],['reuse-native',STAGE,b.old.a.BUILD_RUN]])
  for phase in('stage','reuse-native'):self.assertEqual(f.files[phase+'.normal.json']['claim_sha256'],f.hash(phase+'.claim.json'))
 def test_unknown_mutation_keeps_permanent_claim_without_a_second_dispatch(self):
  f=Fake()
  with patch.object(b,'BUILD_ENABLED',True):
   f.stage();f.unknown=True
   with self.assertRaises(TimeoutError):f.reuse_native()
   with self.assertRaises(ValueError):f.reuse_native()
  self.assertIn('reuse-native.claim.json',f.files);self.assertNotIn('reuse-native.normal.json',f.files);self.assertEqual(len(f.calls),2)
 def test_actual_native_dependency_module_lock_or_emitted_graph_drift_refuses_before_reuse_claim(self):
  for mode in('module','lock','graph'):
   f=Fake()
   with patch.object(b,'BUILD_ENABLED',True):
    f.stage()
    if mode=='graph':f.graphs['native']['modules'][0]['emitted_sha256']='e'*64
    else:
     p=f.graphs['native']['modules'][0]['path']if mode=='module'else'package-lock.json';next(x for x in f.source['files']if x['path']==p)['sha256']='e'*64;f.source['source_sha256']=b.old.sha(b.old.base.compact(f.source['files']))
    with self.assertRaises(ValueError):f.reuse_native()
   self.assertEqual(f.calls,[['stage']]);self.assertNotIn('reuse-native.claim.json',f.files)
 def test_new_profile_is_admitted_by_exact_generic_gate_not_consumed_profile(self):
  f=Fake();f.l=object();seen=[]
  with patch.object(b,'load_profile',lambda l:{'run':RUN,'source':f.source}),patch.object(b.old,'load_profile',side_effect=AssertionError('OLD_PROFILE_OPENED')),patch.object(b.old.base.Build,'source_admission',lambda self:seen.append(self)or{'same_generic_gate':True}):
   self.assertEqual(b.Build.source_admission(f),{'same_generic_gate':True});self.assertEqual(seen,[f])
  with patch.object(b,'load_profile',lambda l:{'run':'old','source':f.source}),patch.object(b.old.base.Build,'source_admission',side_effect=AssertionError('GATE_REACHED')):
   with self.assertRaises(ValueError):b.Build.source_admission(f)
 def test_new_run_private_namespace_never_uses_consumed_build_root(self):
  def init(self,inputs,libraries=None):self.inputs=inputs
  with patch.object(b.old.Build,'__init__',init):
   f=b.Build({'run':RUN});self.assertEqual(f.private,b.MAIN/b.a.PRIVATE/RUN)
   with self.assertRaises(ValueError):b.Build({'run':'cd917d16-2d3d-4915-9d65-364d1edf4fe9'})
 def test_unset_profile_and_disabled_cli_refuse_before_private_ports(self):
  with patch.object(b.old.base.m,'Libraries',side_effect=AssertionError('PORTS_CONSTRUCTED')):
   with self.assertRaises(ValueError):b.load_build()
   with self.assertRaises(ValueError):b.load_profile()
  value=subprocess.run([str(b.MAIN/'.venv-skills/Scripts/python.exe'),'-X','utf8','-B',str(HERE/'build.py'),'stage'],capture_output=True,timeout=10)
  self.assertEqual(value.returncode,1);self.assertEqual(value.stderr,b'');self.assertIn(b'DISABLED_OR_UNCONFIRMED',value.stdout)
 def test_inherited_archive_importgate_graph_context_and_native_attribution_are_exact_methods(self):
  for name in('retained_native','_daemon_context','context','accepted_export','local','validate_archive'):self.assertIs(getattr(b.Build,name),getattr(b.old.Build,name))
  export=inspect.getsource(b.old.base.Build.export);self.assertIn("command+=['--no-cache']",export);self.assertIn('self.l.oci.base.import_gate',export);self.assertIn('self.validate_archive(self.l.oci.archive_proof',export)
  self.assertNotIn('daemon-release',inspect.getsource(b.Build.pins))
if __name__=='__main__':unittest.main()
