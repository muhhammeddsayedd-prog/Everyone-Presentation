"""Real inherited checks plus precise pg_policies row-alias regression."""
from pathlib import Path
import importlib.util,re,unittest
from unittest.mock import patch
HERE=Path(__file__).resolve().parent
def module(name,file):
 spec=importlib.util.spec_from_file_location(name,file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
s=module('alias41_test_state',HERE/'state.py');r=module('alias41_test_release',HERE/'release.py')
prior=module('alias41_frozen_actual_tests',s.MAIN/'development/m07/logo-info-canonical-release/test_state.py')
class Tests(prior.Tests):
 @classmethod
 def setUpClass(cls):cls.c=s.Context()
 def test_all14_row_site_inverse_and_oidless_pg_policies_branch(self):
  original=self.c.compat.state_sql();before=s.old.Context.normalized(self.c,original);after=self.c.normalized(original)
  self.assertEqual(original.count('to_jsonb(p)'),14);self.assertEqual(after.count(s.ROW_NEW),14)
  self.assertEqual(after.replace(s.ROW_NEW,s.ROW_OLD),before)
  def view(text):
   start=text.index("'policies',(select");end=text.index("'constraints'",start);return text[start:end]
  self.assertIn('from pg_policies p',view(before));self.assertRegex(view(before),r'\bp\.oid\b')
  self.assertNotRegex(view(after),r'\bp\.oid\b');self.assertIn("to_jsonb(p)->>'oid'",view(after));self.assertIn("to_jsonb(p)?'prosrc'",view(after))
  # The typed source-expression guard still targets an actual pg_proc alias.
  self.assertEqual(before.count("else p.prosrc end)"),after.count("else p.prosrc end)"))
 def test_bound_phase_code_new_namespace_context_and_default_off(self):
  self.assertIs(r.Base.query.__code__,r.old.Base.query.__code__)
  self.assertIsNot(r.Base.query.__globals__,r.old.Base.query.__globals__)
  self.assertEqual(r.Base.query.__globals__['PURPOSE'],'logo-info-canonical-alias-release')
  op=r.Release('8a100000-0000-4000-8000-000000000001',context=self.c)
  self.assertEqual(op.private.parent.name,'logo-info-canonical-alias-release');self.assertIsInstance(op.c,s.Context)
  for phase in('prepare','apply','reconcile'):
   with self.assertRaises(ValueError):getattr(op,phase)()
  with patch.object(r,'Release',side_effect=AssertionError('PORT_REACHED')):
   with self.assertRaises(ValueError):r.main(['prepare',op.run])
 def test_fixed_context_sources_are_part_of_claim_and_collector_binding(self):
  pins=self.c.source_pins();self.assertIn(str(HERE/'state.py'),pins);self.assertIn(str(HERE/'release.py'),pins)
  self.assertEqual(r.validate_collector_proof.__globals__['HERE'],HERE)

if __name__=='__main__':unittest.main()
