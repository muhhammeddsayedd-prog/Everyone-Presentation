"""Parse actual rendered collector/checkpoint/PLpgSQL. No SQL execution."""
from pathlib import Path
import copy,importlib.util,json,unittest
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker_identity_rendered_SQL',HERE/'state.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.state=m.State('sha256:'+'a'*64);cls.approved=json.loads((m.MAIN/m.a.APPLY['path']).read_bytes())
 def before(self):
  value=copy.deepcopy(self.approved['first']);base=value['canonical']['base']
  return {'schema40':value,'lifecycle':dict.fromkeys(m.COUNTERS,0),'oauth_count_only':{'claims_count':base['data']['oauth_consent_claims']['count'],'full_sha256':base['oauth']['sha256'],'static_sha256':base['oauth_static_sha256'],'reconstructed_anchor_full_sha256':base['oauth']['sha256']}}
 def test_actual_collectors_have_one_full_audit_hash_and_all76_checkpoint_keys(self):
  state=self.state.state_sql();checkpoint=self.state.checkpoint_sql();parse_sql(state);parse_sql(checkpoint)
  self.assertEqual(state.count("(to_jsonb(t))::text,'UTF8')),'hex')h from eps.audit_events t"),1);self.assertNotIn("(to_jsonb(t)-'reason')::text",state);self.assertEqual(len(self.state.context.tables),76)
 def test_all_actual_phase_DO_bodies_parse_with_lock_order_and_one_COMMIT_nonce(self):
  value=self.before();marker='00000000-0000-4000-8000-000000000001'
  for phase in('pause','pin','resume'):
   with self.subTest(phase=phase):
    sql=self.state.render(value,phase,marker);parse_sql(sql);parse_plpgsql(sql)
    self.assertEqual(sql.count(' in access exclusive mode;'),1);self.assertLess(sql.index(' in access exclusive mode;'),sql.index('lock table supabase_migrations'))
    self.assertEqual(sql.count('commit;select jsonb_build_object'),1);self.assertIn('as worker_identity_release;',sql)
    expected=self.state.expected(value,phase)
    for table in m.CONFIG:value['schema40']['canonical']['processing_config'][table]['public']=copy.deepcopy(expected['schema40']['canonical']['processing_config'][table]['public'])
if __name__=='__main__':unittest.main()
