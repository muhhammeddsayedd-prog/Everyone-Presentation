"""Inert bridge tests using actual pure state validators and synthetic metadata."""
import copy,importlib.util,json,os,subprocess,sys,unittest
from pathlib import Path
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
def load(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
b=load('gate_bridge',HERE/'bridge.py')
saved_path=sys.path[:]
try:
 sys.path.insert(0,str(HERE.parent/'job-attempt-observability36-release'))
 fixtures=load('gate_state_fixtures',HERE.parent/'job-attempt-observability36-release/test_state.py')
finally:sys.path[:]=saved_path
class BridgeTests(unittest.TestCase):
 def values(self):
  before=fixtures.before();before.update(database='eps_m07_r33_source_'+'1'*32,session_user='supabase_admin',cli_role_safe=False,protected_m02=None,protected_m02_integrity=False)
  before['english']['flags']=[None];after=fixtures.after(before,version=fixtures.s.VERSION)
  values={phase:{'value':copy.deepcopy(before if phase=='before'else after),'atomic_o':None if phase=='before'else phase in('after','restored'),
   'atomic_d':None if phase=='before'else phase=='disabled'}for phase in b.PHASES}
  values['public_execute']['value']['schema']['function']['nonowner_acl']=[{'role':'PUBLIC','privilege':'EXECUTE','grantable':False}]
  user=next(row for row in values['disabled']['value']['schema']['triggers']if not row['internal']);user['enabled']='D'
  values['wrong_body']['value']['schema']['function']['source_sha256']='0'*64
  values['old_jobs']['value']['catalogue']['sha256']='0'*64
  return values
 def test_actual_local_validator_and_empty_schema_transition(self):
  value=b.validate(self.values());self.assertEqual(value['result'],'passed');self.assertTrue(value['gates']['new_schema_gate_passed'])
  self.assertFalse(value['hosted_acceptance']);self.assertFalse(value['provider_called']);self.assertFalse(value['canonical_business_writes'])
  self.assertEqual(value['schema_template'],self.values()['after']['value']['schema']);self.assertEqual(value['claim_ports'],self.values()['before']['value']['claim_ports'])
  for key in ['normal_transition_passed','public_execute_rejected','disabled_only_passed','wrong_body_rejected','unrelated_old_jobs_metadata_rejected','restored_exact_passed','all_atomic_predicates_observed']:self.assertTrue(value[key])
 def test_actual_validator_rejects_data_permissions_source_and_catalogue_drift(self):
  for key in ['catalogue','data','oauth','english','protected_m02','claim_ports','legacy']:
   values=self.values();values['after']['value'][key]={'changed':True}
   with self.assertRaises((ValueError,KeyError,TypeError)):b.validate(values)
  for key in ['schema','delta_metadata','trace_rows','history']:
   values=self.values();values['after']['value'][key]=None
   with self.assertRaises((ValueError,KeyError,TypeError)):b.validate(values)
  with self.assertRaises(ValueError):b.validate({**self.values(),'extra':True})
 def test_negative_credit_requires_its_specific_changed_seam_and_observed_atomic_result(self):
  for phase in ['public_execute','disabled','wrong_body','old_jobs','restored']:
   values=self.values();values[phase]['atomic_o']=not values[phase]['atomic_o']
   with self.assertRaises(ValueError):b.validate(values)
  values=self.values();values['public_execute']['value']['schema']['function']['nonowner_acl']=[]
  with self.assertRaises(ValueError):b.validate(values)
  values=self.values();values['wrong_body']['value']['data']={'wrong_negative_cause':True}
  with self.assertRaises(ValueError):b.validate(values)
 def test_emitted_real_query_sql_parses_without_dispatch(self):
  queries=b.queries();self.assertGreater(len(queries['source_pins']),185)
  for phase in ['before','after']:
   self.assertEqual(len(parse_sql(queries[phase])),1)
  self.assertNotIn('from eps.job_stage_attempts t',queries['before']);self.assertIn('from eps.job_stage_attempts t',queries['after'])
  self.assertEqual(queries['phases'],b.PHASES)
  parse_sql(queries['before_capture_sql']);parse_sql(queries['after_candidate_sql']);parse_plpgsql(queries['before_capture_sql']+queries['after_candidate_sql'])
  for fragment in ['grant execute on function','disable trigger capture_job_stage_attempt','returns trigger','set statistics 1000','null::aclitem[]',"'eps.attempt36_state.expected_before'","'eps.attempt36_state.expected_installed'"]:
   self.assertIn(fragment,queries['before_capture_sql']+queries['after_candidate_sql'])
 def test_isolated_bridge_main_bootstraps_and_emits_only_bounded_source_queries(self):
  environment={key:os.environ[key]for key in ['PATH','SystemRoot','WINDIR','TEMP','TMP']if key in os.environ}
  observed=subprocess.run([sys.executable,'-I','-X','utf8',str(HERE/'bridge.py'),'queries'],input=b'',capture_output=True,env=environment,timeout=30,check=False)
  self.assertEqual(observed.returncode,0);self.assertEqual(observed.stderr,b'');self.assertLessEqual(len(observed.stdout),4*1024*1024)
  result=json.loads(observed.stdout);self.assertEqual(result['phases'],b.PHASES);self.assertGreater(len(result['source_pins']),185)
if __name__=='__main__':unittest.main()
