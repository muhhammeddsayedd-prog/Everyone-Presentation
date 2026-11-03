"""Public synthetic State values and parsed SQL only, never DB or private data."""
from pathlib import Path
import copy,importlib.util,json,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
s=importlib.util.spec_from_file_location('ocr_state_tests',HERE/'state.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Context:
 def __init__(self,anchor):self.anchor=copy.deepcopy(anchor['canonical']);self.tables=[*m.old.CONFIG,'audit_events']
 def check(self,value,installed):assert installed
class Tests(unittest.TestCase):
 def fixture(self):
  approved=json.loads((m.a.MAIN/m.old.a.APPLY['path']).read_bytes());context=Context(approved['first']);state=m.State(m.a.BASELINE['native_digest'],context=context,approved=approved)
  v={'schema40':copy.deepcopy(approved['first']),'lifecycle':dict.fromkeys(m.old.COUNTERS,0),'oauth_count_only':{'claims_count':approved['first']['canonical']['base']['data']['oauth_consent_claims']['count'],'full_sha256':approved['first']['canonical']['base']['oauth']['sha256'],'static_sha256':approved['first']['canonical']['base']['oauth_static_sha256'],'reconstructed_anchor_full_sha256':approved['first']['canonical']['base']['oauth']['sha256']}}
  v['schema40']['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=m.a.BASELINE['native_digest'];return state,v,context,approved
 def test_pause_resume_retains_native3d_and_full_current_reason_rows_and_source_hashes(self):
  state,before,_,_=self.fixture();state.initial(before);before['schema40']['reason']['historical_nonnull']=1;before['schema40']['canonical']['base']['data']['audit_events']={'count':1,'sha256':'f'*64}
  current=before
  for phase in('pause','resume'):
   after=copy.deepcopy(current);wanted=state.expected(current,phase)
   for k in m.old.CONFIG:after['schema40']['canonical']['processing_config'][k]['public']=wanted['schema40']['canonical']['processing_config'][k]['public']
   self.assertTrue(state.transition(current,after,phase));self.assertEqual(after['schema40']['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id'],m.a.BASELINE['native_digest']);current=after
  self.assertEqual(current['schema40']['canonical']['base']['data']['audit_events'],before['schema40']['canonical']['base']['data']['audit_events'])
 def test_wrong_old_native_or_lifecycle_unknown_phase_or_unrelated_row_drift_refuses(self):
  for mode in('old_native','counter','phase','row'):
   state,v,_,_=self.fixture()
   with self.assertRaises(ValueError):
    if mode=='old_native':v['schema40']['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=m.old.a.OLD['native_digest'];state.initial(v)
    elif mode=='counter':v['lifecycle']['generic_retry_lifecycle']=1;state.initial(v)
    elif mode=='phase':state.expected(v,'pin')
    else:
     after=copy.deepcopy(v)
     for row in after['schema40']['canonical']['processing_config'].values():row['public']['enabled']=False
     after['schema40']['canonical']['base']['data']['audit_events']['sha256']='f'*64;state.transition(v,after,'pause')
 def test_inherited_nonce_SQL_renderer_updates_only_enabled_and_resume_bytes_equal_original(self):
  state,v,context,approved=self.fixture();state.state_sql=lambda:'select null::jsonb';self.assertIs(m.State.render,m.old.State.render)
  for row in v['schema40']['canonical']['processing_config'].values():row['public']['enabled']=False
  legacy=m.old.State(m.a.BASELINE['native_digest'],context=context,approved=approved);legacy.state_sql=state.state_sql;marker='00000000-0000-4000-8000-000000000001';sql=state.render(v,'resume',marker)
  self.assertEqual(sql,legacy.render(v,'resume',marker));parse_sql(sql);self.assertEqual(sql.count(' set enabled=true;'),5);self.assertNotIn(' set native_image_id=',sql);self.assertIn('WORKER_IDENTITY_PREIMAGE_CHANGED',sql);self.assertIn('commit;select jsonb_build_object(',sql)
if __name__=='__main__':unittest.main()
