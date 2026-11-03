"""Opaque synthetic state projections through the REAL inherited40 checker."""
from pathlib import Path
import copy,importlib.util,json,unittest
from pglast import parse_sql,parse_plpgsql

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('logo41_state_tests',HERE/'state.py');s=importlib.util.module_from_spec(spec);spec.loader.exec_module(s)

class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.c=s.Context()
 def before(self):
  c=self.c;schema=copy.deepcopy(c.compat.anchor);base=schema['canonical']['base']
  schema['reason']['historical_nonnull']=1;base['data']['audit_events']['sha256']='f'*64
  schema['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']=s.NATIVE
  compat={'schema40':schema,'lifecycle':dict.fromkeys(c.library.COUNTERS,0),'oauth_count_only':{'claims_count':base['data']['oauth_consent_claims']['count'],'full_sha256':base['oauth']['sha256'],'static_sha256':base['oauth_static_sha256'],'reconstructed_anchor_full_sha256':base['oauth']['sha256']}}
  return {'compatibility':compat,'history':{'versions':c.history[:],'old_rows_sha256':'a'*64,'new_entry_valid':False},'target':{'identity':{'oid':'123456','prosecdef':True,'provolatile':'s','proacl':['fixed']},'source_sha256':s.OLD},'full_scope':{'function_count':1,'functions_normalized_sha256':'1'*64,'catalogue_normalized_sha256':'2'*64,'dependencies_sha256':'3'*64,'audit_attributes_sha256':'4'*64}}
 def test_real40_checker_accepts_nonnull_reason_and_only41_transition(self):
  value=self.before();self.assertIs(self.c.check(value,False),value);after=self.c.expected(value)
  self.assertTrue(self.c.transition(value,after));self.assertEqual(after['compatibility']['schema40']['reason']['historical_nonnull'],1)
  self.assertEqual(after['compatibility']['schema40']['canonical']['base']['data']['audit_events']['sha256'],'f'*64)
 def test_all_declared_full_scope_changes_and_target_metadata_fail(self):
  before=self.before()
  for key in before['full_scope']:
   after=self.c.expected(before);after['full_scope'][key]=2 if key=='function_count'else'0'*64
   with self.assertRaises(ValueError,msg=key):self.c.transition(before,after)
  after=self.c.expected(before);after['target']['identity']['proacl']=[]
  with self.assertRaises(ValueError):self.c.transition(before,after)
  after=self.c.expected(before);after['compatibility']['schema40']['canonical']['base']['data']['audit_events']['sha256']='e'*64
  with self.assertRaises(ValueError):self.c.transition(before,after)
 def test_inherited_catalogue_OID_role_config_active_and_unknown_history_refuse(self):
  for mode in('catalogue','identity','role','native','active','history','unknown_source'):
   value=self.before()
   if mode in('catalogue','identity'):value['compatibility']['schema40']['canonical']['project39']['remaining_catalogue'if mode=='catalogue'else'old_identities']['sha256']='0'*64
   elif mode=='role':value['compatibility']['schema40']['authority']['roles']='0'*64
   elif mode=='native':value['compatibility']['schema40']['canonical']['processing_config']['frame_extraction_config']['public']['native_image_id']='sha256:'+'0'*64
   elif mode=='active':value['compatibility']['lifecycle']['running']=1
   elif mode=='history':value['history']['versions'][0]='20000101000000'
   else:value['target']['source_sha256']='0'*64
   with self.assertRaises(ValueError,msg=mode):self.c.check(value,False)
 def test_actual_collector_checkpoint_render_and_migration_SQL_parse(self):
  for sql in(self.c.state_sql(),self.c.checkpoint_sql()):self.assertEqual(len(parse_sql(sql)),1)
  rendered=self.c.render(self.before(),'8a100000-0000-4000-8000-000000000001');parsed=parse_sql(rendered)
  self.assertIn('LOGO41_PREIMAGE_CHANGED',rendered);self.assertIn('LOGO41_POSTIMAGE_CHANGED',rendered)
  self.assertEqual(rendered.count(self.c.migration.decode()),1);self.assertIn('commit;select',rendered)
  self.assertEqual(len(parse_plpgsql(self.c.migration.decode())),3)
  from pglast.stream import RawStream
  for item in parsed:
   if type(item.stmt).__name__=='DoStmt':self.assertEqual(len(parse_plpgsql(RawStream()(item))),1)
  self.assertNotIn("(to_jsonb(t)-'reason')",self.c.state_sql())
 def test_closed_proof_entry_only_literal_flag_qualification(self):
  raw=s.load(s.MAIN/'development/m07/logo-info-owned-proof/entry.mjs');armed='7d3299a02ef3ffe40a0d4415977832b3b1422d0ebd283f2d9bc0590feb3860ae'
  self.assertTrue(s.qualify_proof_entry(raw,armed));self.assertTrue(s.qualify_proof_entry(raw.replace(b'EXECUTION_ENABLED = false',b'EXECUTION_ENABLED = true'),armed))
  for bad in(raw+b'\n',raw.replace(b'EXECUTION_ENABLED = false',b'EXECUTION_ENABLED  = false')):
   with self.assertRaises(ValueError):s.qualify_proof_entry(bad,armed)
 def test_actual_passed_proof_admission_after_closed_entry(self):
  admitted=self.c.admission();self.assertEqual(admitted['version'],s.VERSION);self.assertFalse(admitted['hosted_Storage_acceptance_claimed'])

if __name__=='__main__':unittest.main()
