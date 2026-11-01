"""Inert public-source and fake-port tests; never builds, stages or calls CLI."""
from pathlib import Path
import copy, importlib.util, io, json, subprocess, sys, unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('list_query38_test',HERE/'web.py');w=importlib.util.module_from_spec(spec);spec.loader.exec_module(w)
NEW='dpl_SYNTHETICLISTQUERY38';URL='https://everyone-presentation-pilot-synthetic.vercel.app'

class FakePorts:
 def __init__(self):
  self.files={};self.calls=[];self.reports=[];self.current='old';self.fail=False;self.stale_alias=False
  self.pins_value={'synthetic':'a'*64};self.gates_value={'source':{'path':'synthetic-source','sha256':'b'*64},'quality':w.QUALITY_REF,'stage_root':'.local/m07-pilot/web-source-synthetic-12345678','public_build_environment':{},'canonical_sha256':'c'*64}
  baseline=copy.deepcopy(w.reference(w.ANCHORS['ready'])['deployment']);baseline.update(build_sha256=None,run_id=None);self.baseline=baseline
  self.before={'project':{'synthetic':'unchanged-project'},'environment':[{'synthetic':'unchanged-env'}],'deployment':baseline}
 def pins(self):return copy.deepcopy(self.pins_value)
 def gates(self):return copy.deepcopy(self.gates_value)
 def exists(self,path):return path in self.files
 def write(self,path,value):
  w.need(path not in self.files);self.calls.append('write:'+path.name);self.files[path]=copy.deepcopy(value)
 def read(self,path):w.need(path in self.files);return copy.deepcopy(self.files[path])
 def file_sha(self,path):return w.digest(self.read(path))
 def observe(self):
  self.calls.append('alias_GET');v=copy.deepcopy(self.before)
  if self.current=='new'and not self.stale_alias:v['deployment']=self.new()
  return v
 def direct(self,identity):self.calls.append('direct_GET');return copy.deepcopy(self.baseline)if identity==w.CURRENT else self.new()
 def new(self):
  plan=self.read(w.PLAN);meta=w.metadata(plan,self.file_sha(w.BUILD));v=copy.deepcopy(self.baseline)
  v.update(id=NEW,url=URL.removeprefix('https://'),source_sha256=meta['epsListQuery38Source'],quality_sha256=meta['epsListQuery38Quality'],canonical_sha256=meta['epsListQuery38Canonical'],build_sha256=meta['epsListQuery38Build'],run_id=meta['epsListQuery38Run']);return v
 def build(self,plan):self.calls.append('local_build');return {'result':'passed','source_sha256':w.SOURCE,'plan_sha256':self.file_sha(w.PLAN),'source_pins':plan['source_pins'],'quality_only':True,'no_prebuilt_acceptance':True}
 def verify_build(self,plan,value):w.need(value['result']=='passed'and value['plan_sha256']==self.file_sha(w.PLAN)and value['source_pins']==plan['source_pins'])
 def run(self,args,timeout=60):
  self.calls.append('deploy_call')
  if self.fail:raise TimeoutError('PRIVATE raw failure')
  self.current='new';return URL+'\n'
 def save(self,action,value):self.reports.append((action,copy.deepcopy(value)));return {'result':value['result'],'receipt':'synthetic-'+action}

class Tests(unittest.TestCase):
 def setUp(self):
  flag=patch.object(w,'DEPLOY_ENABLED',True);flag.start();self.addCleanup(flag.stop)

 def test_inert_import_and_explicit_false_gate_before_runtime_ports(self):
  with patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')):
   s=importlib.util.spec_from_file_location('list_query38_import',HERE/'web.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
  self.assertIs(type(m.DEPLOY_ENABLED),bool);p=FakePorts()
  with patch.object(w,'DEPLOY_ENABLED',False),patch.object(w,'Ports')as ports,patch.object(sys,'argv',['web.py','prepare']):
   with self.assertRaises(ValueError):w.main()
   for fn in [w.prepare,w.build,w.dispatch,w.readback]:
    with self.assertRaises(ValueError):fn(p)
  ports.assert_not_called();self.assertFalse(p.calls)

 def test_actual_manifest_is_current_main_285_rows_with_exact_two_row_delta(self):
  with patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')):v=w.manifest()
  self.assertEqual(v['file_count'],285);self.assertEqual(v['source_bytes'],3068962);self.assertEqual(v['source_sha256'],w.SOURCE)
  self.assertEqual({row['path']for row in v['changed']},set(w.CHANGED));self.assertEqual(v['added'],[]);self.assertEqual(v['removed'],[])
  self.assertNotEqual(v['source_sha256'],v['baseline_source_sha256'])

 def test_null_stage_and_quality_inputs_fail_closed_without_invented_receipt(self):
  v=json.loads((HERE/'inputs.template.json').read_bytes());self.assertIsNone(v['source_receipt']);self.assertIsNone(v['quality_receipt'])
  with self.assertRaises(ValueError):w.reference(v['source_receipt'])
  with self.assertRaises(ValueError):w.quality(v['quality_receipt'])

 def test_actual_root_quality_receipt_939_pass_is_bound_and_not_hosted_acceptance(self):
  value=w.quality(w.QUALITY_REF);self.assertEqual(value['full_tests'],939);self.assertFalse(value['hosting_or_real_provider_acceptance'])
  with patch.object(w,'reference',return_value={**value,'full_failed':1}):
   with self.assertRaises(ValueError):w.quality(w.QUALITY_REF)
  with self.assertRaises(ValueError):w.quality({**w.QUALITY_REF,'sha256':'0'*64})

 def test_static38_reader_uses_only_finite_projection_without_live_or_old_full_proof(self):
  with patch.object(subprocess,'run',side_effect=AssertionError('NO_PROCESS')),patch.object(subprocess,'Popen',side_effect=AssertionError('NO_PROCESS')):m,expected,pins=w.static_contract()
  self.assertEqual(len(expected['history']),38);self.assertEqual(m.projection_sources(),pins)
  source=(HERE/'web.py').read_text()
  for forbidden in ['native_admission_sources(','.read_state(','.admission(','.apply_plan(','.main(']:self.assertNotIn(forbidden,source)
  self.assertIn('m.read_static_state()==expected',source)

 def test_source_deployment_command_has_project_scope_metadata_and_no_prebuilt_or_env(self):
  p=FakePorts();w.prepare(p);w.build(p);plan=p.read(w.PLAN);command=w.deploy_command(w.ROOT/plan['gates']['stage_root'],w.metadata(plan,p.file_sha(w.BUILD)))
  self.assertIn('--prod',command);self.assertIn('--no-wait',command);self.assertIn(w.PROJECT,command);self.assertIn(w.SLUG,command)
  for forbidden in ['--prebuilt','--env','--build-env','--token','--force']:self.assertNotIn(forbidden,command)
  self.assertEqual(sum(item.startswith('epsListQuery38')for item in command),5)

 def test_fresh_prepare_build_deploy_claims_precede_each_mutation_and_refuse_replay(self):
  p=FakePorts();self.assertEqual(w.prepare(p)['result'],'prepared');self.assertEqual(w.build(p)['result'],'passed');self.assertEqual(w.dispatch(p)['result'],'submitted')
  self.assertLess(p.calls.index('write:build.claim.json'),p.calls.index('local_build'));self.assertLess(p.calls.index('write:deploy.claim.json'),p.calls.index('deploy_call'))
  for fn in [w.prepare,w.build,w.dispatch]:
   with self.assertRaises(ValueError):fn(p)
  self.assertEqual(p.calls.count('deploy_call'),1)

 def test_unknown_create_retains_claim_without_retry_or_invented_normal_return(self):
  p=FakePorts();w.prepare(p);w.build(p);p.fail=True;self.assertEqual(w.dispatch(p)['result'],'unconfirmed')
  self.assertIn(w.CLAIM,p.files);self.assertNotIn(w.RETURNED,p.files);self.assertNotIn('PRIVATE',json.dumps(p.reports))
  with self.assertRaises(ValueError):w.dispatch(p)
  with self.assertRaises(ValueError):w.readback(p)

 def test_two_alias_reads_match_direct_metadata_and_preserve_env_schema(self):
  p=FakePorts();w.prepare(p);w.build(p);w.dispatch(p);before=p.calls.count('alias_GET');self.assertEqual(w.readback(p)['result'],'passed')
  self.assertGreaterEqual(p.calls.count('alias_GET')-before,2);value=p.reports[-1][1];self.assertTrue(value['two_stable_alias_reads_equal']);self.assertTrue(value['canonical38_static_preserved_before_after']);self.assertFalse(value['application_acceptance'])

 def test_stale_alias_or_environment_or_canonical_drift_cannot_earn_ready(self):
  for failure in ['alias','environment','canonical']:
   p=FakePorts();w.prepare(p);w.build(p);w.dispatch(p)
   if failure=='alias':p.stale_alias=True
   elif failure=='environment':p.before['environment']=[{'changed':True}]
   else:p.gates_value['canonical_sha256']='d'*64
   with self.assertRaises(ValueError):w.readback(p)
   self.assertFalse(any(action=='ready'for action,value in p.reports))

 def test_changed_source_pins_or_quality_ref_blocks_before_create(self):
  for kind in ['source','quality']:
   p=FakePorts();w.prepare(p);w.build(p)
   if kind=='source':p.pins_value['synthetic']='d'*64
   else:p.gates_value['quality']={'path':'other','sha256':'e'*64}
   with self.assertRaises(ValueError):w.dispatch(p)
   self.assertNotIn('deploy_call',p.calls)

 def test_stream_collector_enforces_output_limits_and_timeout_without_real_process(self):
  class Process:
   def __init__(self,stdout=b'ok',stderr=b'',timeout=False):self.stdout=io.BytesIO(stdout);self.stderr=io.BytesIO(stderr);self.returncode=0;self.timeout=timeout;self.kills=0
   def kill(self):self.kills+=1;self.returncode=-9
   def wait(self,timeout=None):
    if self.timeout:self.timeout=False;raise subprocess.TimeoutExpired('synthetic',1)
    return self.returncode
  normal=Process()
  with patch.object(subprocess,'Popen',return_value=normal)as popen:
   result=w.bounded(['synthetic'],{},1,w.ROOT)
  self.assertEqual(result['stdout'],b'ok');self.assertFalse(result['overflow']);self.assertFalse(result['timed_out']);self.assertIs(popen.call_args.kwargs['stdin'],subprocess.DEVNULL)
  for stdout,stderr,maximum,key in [(b'x'*(8*1024**2+4096),b'',8*1024**2,'stdout'),(b'',b'x'*(2*1024**2+4096),2*1024**2,'stderr')]:
   process=Process(stdout,stderr)
   with patch.object(subprocess,'Popen',return_value=process):result=w.bounded(['synthetic'],{},1,w.ROOT)
   self.assertTrue(result['overflow']);self.assertLessEqual(len(result[key]),maximum);self.assertGreaterEqual(process.kills,1)
  process=Process(timeout=True)
  with patch.object(subprocess,'Popen',return_value=process):result=w.bounded(['synthetic'],{},1,w.ROOT)
  self.assertTrue(result['timed_out']);self.assertEqual(process.kills,1)

 def test_runtime_port_refuses_overflow_timeout_or_failed_exit_without_logging_raw_output(self):
  for changed in [{'overflow':True},{'timed_out':True},{'exit_code':1}]:
   result={'overflow':False,'timed_out':False,'exit_code':0,'stdout':b'PRIVATE credential','stderr':b'PRIVATE stderr',**changed}
   with patch.object(w,'bounded',return_value=result):
    with self.assertRaisesRegex(ValueError,'^LIST_QUERY38_WEB_UNCONFIRMED$'):w.Ports().run(['synthetic'])

if __name__=='__main__':unittest.main()
