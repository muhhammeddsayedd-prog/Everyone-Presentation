"""Real checker/SQL projection tests, not owned SQL execution evidence."""
from pathlib import Path
import copy,importlib.util,json,unittest
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('owned_worker40_local_test',HERE/'local.py');l=importlib.util.module_from_spec(spec);spec.loader.exec_module(l)
RUN='00000000-0000-4000-8000-000000000001';SYSTEM='1234567890123456789'
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.production=l.m.State(l.NEW_NATIVE);cls.cfg=l.configuration()
 def fixture(self):
  value=copy.deepcopy(self.production.anchor);base=value['canonical']['base'];base.update(database='project39',operator='postgres',session_user='postgres',cli_role_safe=False,protected_m02_integrity=False,protected_m02={'owned_synthetic_projection':True});base['data']['oauth_consent_claims']['count']=2;value['reason']['historical_nonnull']=1;base['data']['audit_events']['sha256']='f'*64
  return {'schema40':value,'lifecycle':dict.fromkeys(l.m.COUNTERS,0),'oauth_count_only':{'claims_count':2,'full_sha256':base['oauth']['sha256'],'static_sha256':base['oauth_static_sha256'],'reconstructed_anchor_full_sha256':base['oauth']['sha256']}}
 def test_actual_collector_checkpoint_prefix_only_have_declared_owned_count_projection(self):
  cfg=self.cfg;self.assertEqual(cfg['prefix'],self.production.prefix());self.assertEqual(cfg['snapshot_sql'].replace('to_jsonb(2::bigint)','to_jsonb(3::bigint)'),self.production.state_sql());parse_sql(cfg['snapshot_sql']);parse_sql(cfg['checkpoint_sql'])
  self.assertEqual(cfg['owned_oauth_count_qualification'],{'canonical':3,'owned':2,'inverse_byte_equal':True});self.assertEqual(len(cfg['tables']),5);self.assertEqual(len(cfg['checkpoint_tables']),76)
 def test_real_owned_checker_accepts_projection_and_preserves_opaque_full_audit_reason_hash(self):
  initial=self.fixture();state=l.owned_state(initial,SYSTEM,RUN);self.assertEqual(state.check(initial),initial);self.assertEqual(initial['schema40']['canonical']['base']['data']['audit_events']['sha256'],'f'*64)
  current=copy.deepcopy(initial)
  for phase in('pause','pin','resume'):
   rendered=state.render(current,phase,RUN);parse_sql(rendered);parse_plpgsql(rendered);expected=state.expected(current,phase)
   for table in l.m.CONFIG:current['schema40']['canonical']['processing_config'][table]['public']=copy.deepcopy(expected['schema40']['canonical']['processing_config'][table]['public'])
   self.assertEqual(state.check(current),current)
 def test_unknown_current_identity_authority_and_fixed_config_changes_refused(self):
  initial=self.fixture();state=l.owned_state(initial,SYSTEM,RUN)
  for kind in('identity','role','fixed_config'):
   changed=copy.deepcopy(initial)
   if kind=='identity':changed['schema40']['canonical']['project39']['old_identities']['sha256']='0'*64
   if kind=='role':changed['schema40']['authority']['roles']='0'*64
   if kind=='fixed_config':changed['schema40']['canonical']['processing_config']['specs_pipeline_config']['fixed_sha256']='0'*64
   with self.subTest(kind=kind),self.assertRaises(ValueError):state.check(changed)
 def test_original_system_wrong_database_or_wrong_owned_ledger_count_refused(self):
  for field in('system','database','ledger'):
   initial=self.fixture();system=SYSTEM
   if field=='system':system=l.ORIGINAL_SYSTEM
   if field=='database':initial['schema40']['canonical']['base']['database']='postgres'
   if field=='ledger':initial['schema40']['canonical']['base']['data']['oauth_consent_claims']['count']=3
   with self.subTest(field=field),self.assertRaises(ValueError):l.owned_state(initial,system,RUN)
 def test_diagnostic_actual_render_has_no_COMMIT_and_compares_full_current_reason_hash(self):
  initial=self.fixture();render=l.dispatch('render',{'initial':initial,'before':initial,'phase':'pause','marker':RUN,'system':SYSTEM,'run':RUN});self.assertNotIn('commit;',render['diagnostic_sql']);parse_sql(render['diagnostic_sql']);parse_plpgsql(render['diagnostic_sql']);self.assertIn("(to_jsonb(t))::text,'UTF8')),'hex')h from eps.audit_events t",render['diagnostic_sql'])
if __name__=='__main__':unittest.main()
