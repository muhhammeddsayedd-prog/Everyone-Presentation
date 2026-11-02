"""Public projection/SQL construction checks only; no DB/provider calls."""
from pathlib import Path
import copy,importlib.util,unittest,uuid
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('completion39_state_tests',HERE/'state.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.state=s.State()
 def value(self):return {'canonical':copy.deepcopy(self.state.anchor),'intent_data':{'count':0,'sha256':'a'*64}}
 def after(self,before,phase):
  value=copy.deepcopy(before)
  if phase=='pin':value['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=s.NATIVE
  else:
   for row in value['canonical']['processing_config'].values():row['public']['enabled']=phase in('resume','unwind')
  for table,row in value['canonical']['processing_config'].items():row['table_hash']='b'*64;value['canonical']['base']['data'][table]={'count':1,'sha256':'b'*64}
  return value
 def test_actual_applied39_anchor_has_exact_history_and_all_protected_hashes(self):
  value=self.value();self.state.initial(value);self.assertEqual(len(value['canonical']['base']['history']),39);self.assertEqual(len(value['canonical']['base']['data']),74)
  self.assertTrue(value['canonical']['base']['protected_m02_integrity']);self.assertEqual(value['canonical']['processing_config']['candidate_asset_config']['public']['english_transcript_version'],'1.0')
 def test_only_pause_pin_resume_and_pre_dispatch_unwind_transitions(self):
  one=self.value();two=self.after(one,'pause');self.assertTrue(self.state.transition(one,two,'pause'));three=self.after(two,'pin');self.assertTrue(self.state.transition(two,three,'pin'));four=self.after(three,'resume');self.assertTrue(self.state.transition(three,four,'resume'))
  self.assertTrue(self.state.transition(two,self.after(two,'unwind'),'unwind'))
  with self.assertRaises(ValueError):self.state.expected(three,'unwind')
 def test_business_trace_intent_catalogue_oauth_and_config_drift_are_denied(self):
  one=self.value();after=self.after(one,'pause')
  changes=[lambda v:v['intent_data'].update(sha256='c'*64),lambda v:v['canonical']['base']['trace_rows'].update(sha256='c'*64),lambda v:v['canonical']['project39']['remaining_catalogue'].update(sha256='c'*64),lambda v:v['canonical']['base']['data']['public.Settings'].update(sha256='c'*64)if'public.Settings'in v['canonical']['base']['data']else v['canonical']['base']['data'][next(k for k in v['canonical']['base']['data']if k not in self.state.config)].update(sha256='c'*64),lambda v:v['canonical']['processing_config']['candidate_asset_config']['public'].update(english_transcript_version='2.0'),lambda v:v['canonical']['processing_config']['review_processing_config'].update(fixed_sha256='c'*64)]
  for change in changes:
   changed=copy.deepcopy(after);change(changed)
   with self.assertRaises(ValueError):self.state.transition(one,changed,'pause')
 def test_zero_conservative_lifecycle_is_not_hidden_by_paused_flags(self):
  value=self.after(self.value(),'pause')
  for key in self.state.counters:
   changed=copy.deepcopy(value);changed['canonical']['lifecycle'][key]=1
   with self.assertRaises(ValueError):self.state.check(changed)
 def test_all_config_locks_precede_every_snapshot_and_intents_are_preserved(self):
  before=self.value();sql=self.state.render(before,'pause',str(uuid.uuid4()));prefix=self.state.prefix()
  self.assertTrue(sql.startswith(prefix));self.assertIn('in access exclusive mode',prefix);self.assertNotIn('select',prefix.lower());self.assertIn('eps.project_creation_intents in share mode',prefix)
  self.assertIn('job_stage_attempts',prefix);self.assertIn('supabase_migrations.schema_migrations in share mode',prefix);self.assertIn('COMPLETION39_PREFLIGHT_CHANGED',sql);self.assertIn('COMPLETION39_POSTCONDITION_FAILED',sql)
  self.assertEqual(sql.count('get diagnostics changed=row_count'),5);self.assertIn('jsonb_agg(to_jsonb(t)order by project_id)',self.state.state_sql())
 def test_pin_changes_one_future_config_and_does_not_cancel_or_rewrite_jobs(self):
  paused=self.after(self.value(),'pause');sql=self.state.render(paused,'pin',str(uuid.uuid4()))
  self.assertEqual(sql.count('get diagnostics changed=row_count'),1);self.assertIn("update eps.frame_extraction_config set native_image_id='"+s.NATIVE+"'",sql);self.assertNotIn('update eps.jobs',sql);self.assertNotIn('delete from',sql.lower())
 def test_wrong_initial_history_pin_or_any_anchor_business_change_denied(self):
  for mutate in [lambda v:v['canonical']['base']['history'].pop(),lambda v:v['canonical']['processing_config']['frame_extraction_config']['public'].update(native_image_id=s.NATIVE),lambda v:v['canonical']['base']['trace_rows'].update(sha256='c'*64)]:
   value=self.value();mutate(value)
   with self.assertRaises(ValueError):self.state.initial(value)
if __name__=='__main__':unittest.main()
