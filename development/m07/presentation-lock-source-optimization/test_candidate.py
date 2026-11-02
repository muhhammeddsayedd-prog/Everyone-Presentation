"""Pure source checks; no SQL/Docker/actor/timeout or provider execution."""
import importlib.util,unittest
from pathlib import Path
from unittest.mock import patch
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('lock_candidate',HERE/'candidate.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
class Tests(unittest.TestCase):
 def test_public_base_matches_actual_canonical_body_and_drift_refuses(self):
  before,_=c.build();self.assertEqual(c.sha(c.body(before).encode()),c.ACTUAL_SOURCE_SHA)
  with patch.object(c,'BASE_SHA','0'*64):
   with self.assertRaises(ValueError):c.build()
 def test_same_signature_security_attributes_and_parse_paths(self):
  before,after=c.build();old=parse_sql(before)[0].stmt;new=parse_sql(after)[0].stmt
  self.assertEqual(old.funcname,new.funcname);self.assertEqual(old.parameters,new.parameters);self.assertEqual(old.returnType,new.returnType)
  self.assertEqual([x for x in old.options if x.defname!='as'],[x for x in new.options if x.defname!='as'])
  self.assertEqual(len(parse_plpgsql(after)),1)
 def test_lock_order_nowait_and_authority_checks_remain_exact(self):
  before,after=c.build();self.assertEqual(before.split('  perform 1 from eps.workspace_candidates p')[0].split('begin\n',1)[1],after.split('  -- Keep the original pool-lock scope')[0].split('begin\n',1)[1])
  self.assertEqual(before[before.index('\n exception when lock_not_available'):],after[after.index('\n exception when lock_not_available'):])
  self.assertNotIn('security definer',after.lower());self.assertNotIn('statement_timeout',after);self.assertNotIn('set role',after.lower())
 def test_selected_ids_are_after_locks_and_pairs_are_not_cross_product(self):
  _,after=c.build()
  self.assertLess(after.index('from eps.assignments where'),after.index('into v_pool_ids'))
  self.assertLess(after.index('p.id=any(v_pool_ids)'),after.index('with selected as materialized'))
  self.assertLess(after.index('m.id=any(v_media_ids)order by m.id for share nowait'),after.index('Source IDs are read after'))
  self.assertIn('unnest(v_pair_media_ids,v_pair_asset_ids)',after)
  selected=after[after.index('with selected as materialized'):after.index('into v_candidate_ids')]
  self.assertNotIn('p.archived_at',selected)
 def test_default_entry_has_no_runtime_transport_or_runner(self):
  self.assertFalse(c.ENTRY_ENABLED)
  text=(HERE/'candidate.py').read_text()
  self.assertNotIn('subprocess',text);self.assertNotIn('psycopg',text);self.assertNotIn('requests.',text)
if __name__=='__main__':unittest.main()
