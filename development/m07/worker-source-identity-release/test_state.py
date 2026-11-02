"""Pure state/projection construction; no private metadata, SQL or Docker."""
from pathlib import Path
import copy,importlib.util,json,unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_new_state',HERE/'state.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class Context:
 def __init__(self,anchor):self.anchor=copy.deepcopy(anchor['canonical']);self.seen=None
 def check(self,value,installed):self.seen=copy.deepcopy(value);assert installed

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  raw=(m.MAIN/m.a.APPLY['path']).read_bytes();cls.approved=json.loads(raw)
 def fixture(self):
  context=Context(self.approved['first']);state=m.State('sha256:'+'a'*64,context=context,approved=self.approved)
  current={'schema40':copy.deepcopy(self.approved['first']),'lifecycle':dict.fromkeys(m.COUNTERS,0),'oauth_count_only':{'claims_count':self.approved['first']['canonical']['base']['data']['oauth_consent_claims']['count'],'full_sha256':self.approved['first']['canonical']['base']['oauth']['sha256'],'static_sha256':self.approved['first']['canonical']['base']['oauth_static_sha256'],'reconstructed_anchor_full_sha256':self.approved['first']['canonical']['base']['oauth']['sha256']}}
  return state,current,context
 def test_current_nonnull_audit_reasons_are_kept_not_nullified_or_omitted(self):
  state,value,context=self.fixture();value['schema40']['reason']['historical_nonnull']=1;value['schema40']['canonical']['base']['data']['audit_events']={'count':1,'sha256':'f'*64}
  state.check(value);self.assertEqual(value['schema40']['reason']['historical_nonnull'],1);self.assertEqual(context.seen['reason']['historical_nonnull'],0)
  self.assertEqual(context.seen['canonical']['base']['data']['audit_events']['sha256'],'f'*64)
 def test_authority_function_dependency_history_and_unknown_pin_drift_refuse(self):
  for field in('authority','functions','dependencies','history_identity'):
   state,value,_=self.fixture();value['schema40'][field]={}
   with self.assertRaises(ValueError):state.check(value)
  state,value,_=self.fixture();value['schema40']['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']='sha256:'+'f'*64
  with self.assertRaises(ValueError):state.check(value)
  state,value,_=self.fixture();value['schema40']['canonical']['processing_config']['specs_pipeline_config']['public']['enabled']=1
  with self.assertRaises(ValueError):state.check(value)
 def test_lifecycle_never_hides_retry_or_queued_work(self):
  for key in m.COUNTERS:
   state,value,_=self.fixture();value['lifecycle'][key]=1
   with self.assertRaises(ValueError):state.check(value)
 def test_consent_growth_requires_exact_static_and_count_only_reconstruction(self):
  state,value,_=self.fixture();value['oauth_count_only']['claims_count']+=1;value['schema40']['canonical']['base']['data']['oauth_consent_claims']['count']+=1
  value['schema40']['canonical']['base']['oauth']['sha256']='b'*64;value['oauth_count_only']['full_sha256']='b'*64;state.check(value)
  for key in('static_sha256','reconstructed_anchor_full_sha256'):
   changed=copy.deepcopy(value);changed['oauth_count_only'][key]='c'*64
   with self.assertRaises(ValueError):state.check(changed)
 def test_pause_pin_resume_preserve_full_audit_hash_and_every_unrelated_value(self):
  state,before,_=self.fixture();state.initial(before)
  def next_state(value,phase):
   expected=state.expected(value,phase);after=copy.deepcopy(value)
   for table in m.CONFIG:after['schema40']['canonical']['processing_config'][table]['public']=copy.deepcopy(expected['schema40']['canonical']['processing_config'][table]['public'])
   state.transition(value,after,phase);return after
  paused=next_state(before,'pause');pinned=next_state(paused,'pin');resumed=next_state(pinned,'resume')
  self.assertTrue(all(row['public']['enabled']for row in resumed['schema40']['canonical']['processing_config'].values()))
  self.assertEqual(resumed['schema40']['canonical']['base']['data']['audit_events'],before['schema40']['canonical']['base']['data']['audit_events'])
  bad=copy.deepcopy(paused);bad['schema40']['canonical']['base']['data']['audit_events']['sha256']='f'*64
  with self.assertRaises(ValueError):state.transition(before,bad,'pause')
 def test_unwind_or_old_rollback_is_not_a_phase(self):
  state,value,_=self.fixture()
  with self.assertRaises(ValueError):state.expected(value,'unwind')

if __name__=='__main__':unittest.main()
