from pathlib import Path
import importlib.util,inspect,json,re,subprocess,types,unittest
from unittest.mock import patch
from pglast import parse_sql,parser
HERE=Path(__file__).resolve().parent
def module(name,path):
 spec=importlib.util.spec_from_file_location(name,path);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value
compiler=module('test_forward_compiler',HERE/'compiler.py');local=module('test_forward_local',HERE/'local.py');fixture=module('test_forward_fixture',HERE/'fixture.py');proposal=module('test_forward_proposal_source',HERE.parent/'review-link-reason40-forward-baseline/proposal.py')
NODE='C:/Program Files/nodejs/node.exe'
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.source,cls.cfg,cls.library,cls.cases=compiler.compile_source('.local/reason40-forward-source/offline-not-written.mjs')
 def test_frozen_SQL_qualification_config_and_exact_case_inverse(self):
  old=compiler.module('test_passed602_compiler',compiler.MAIN/'compiler.py');_,cfg,_,cases=old.compile_source('.local/reason40-forward-source/offline-not-written.mjs')
  for key in('state_sql','checkpoint_sql','qualification_sql','config_setup_sql'):self.assertEqual(self.cfg[key],cfg[key])
  self.assertEqual(self.cfg['config_setup_tables'],cfg['config_setup_tables']);self.assertEqual(len(self.cfg['config_setup_tables']),5);self.assertIn("when r.table_name='storage.buckets'then'(to_jsonb(t)-''versioning_status'')'else'to_jsonb(t)'end",self.source)
  inverse=compiler.s.replace_once(self.cases,compiler.NEGATIVES,'');inverse=compiler.s.replace_once(inverse,"['configuration','render','compare','diagnostic_claim','diagnose','guard_current']","['configuration','render','compare','diagnostic_claim','diagnose']");inverse=compiler.s.replace_once(inverse,'new URL('+json.dumps((HERE/'local.py').as_uri())+')','new URL('+json.dumps((compiler.MAIN/'local.py').as_uri())+')');self.assertEqual(inverse,cases);self.assertFalse(self.library.exists())
  self.assertIn('eps.reason40forward.run',self.source);self.assertIn('eps-r40w-',self.source)
  for text in(self.source,self.cases):self.assertEqual(subprocess.run([NODE,'--check','--input-type=module'],input=text.encode(),capture_output=True,timeout=10).returncode,0)
 def test_exact_managed_source_owned_guard_and_one_ledger_row_parse(self):
  raw=(HERE/'upstream/0074-unlock-object-versioning.sql').read_bytes();self.assertEqual(compiler.s.sha(raw),fixture.UPSTREAM_SHA);sql=self.cfg['forward_fixture_sql'].replace('__FORWARD_SYSTEM_SQL__',"'99000000000000001'").replace('__FORWARD_RUN_SQL__',"'e18e4ac3-e54a-4898-9cdd-fb0f7b7663c8'");parse_sql(sql)
  for block in re.findall(r'do \$([a-z_]+)\$.*?\$\1\$;',sql,re.S):self.assertTrue(block)
  for match in re.finditer(r'do \$([a-z_]+)\$.*?\$\1\$;',sql,re.S):parser.parse_plpgsql_json(match[0])
  parser.parse_plpgsql_json(raw.decode()[raw.decode().index('CREATE OR REPLACE FUNCTION'):raw.decode().index('DROP TRIGGER')])
  self.assertEqual(sql.count(raw.decode()),1);self.assertEqual(sql.lower().count('insert into eps.oauth_consent_claims'),1)
  for text in('insert into auth.','update auth.','delete from auth.','delete from eps.oauth_consent_claims','disable trigger','session_replication_role'):self.assertNotIn(text,sql.lower())
  self.assertIn("system_identifier::text='7701520506262638626'",sql);self.assertIn("set local role supabase_storage_admin",sql);self.assertIn('claims_before',sql)
  self.assertIn("ADD COLUMN IF NOT EXISTS versioning_status text NOT NULL DEFAULT 'DISABLED'",sql);self.assertIn('historical_dark_check_installed_then_removed',sql);self.assertIn('new_bucket_versioning_status_all_disabled',sql)
  metadata=Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql').read_bytes();self.assertEqual(compiler.s.sha(metadata),'12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c');self.assertNotIn(b'versioning_status',metadata);self.assertNotIn(b'buckets_versioning_dark_check',metadata)
 def test_new_guard_probe_and_all_old_actions_delegate_without_new_IO(self):
  c=types.SimpleNamespace(bind=lambda*a:c,check=lambda*a:None)
  with patch.object(local.prior.prior,'OwnedContext',return_value=c):self.assertEqual(local.dispatch('guard_current',{'before':{},'observed':{},'system':'99000','run':'fake'})['result'],'accepted')
  c.check=lambda*a:(_ for _ in()).throw(ValueError('synthetic guard refusal'))
  with patch.object(local.prior.prior,'OwnedContext',return_value=c):self.assertEqual(local.dispatch('guard_current',{'before':{},'observed':{},'system':'99000','run':'fake'})['result'],'refused')
  for action in('render','compare','diagnostic_claim','diagnose'):
   with patch.object(local.prior,'dispatch',return_value={'delegated':True})as delegated:self.assertEqual(local.dispatch(action,{'test':True}),{'delegated':True});delegated.assert_called_once_with(action,{'test':True})
  self.assertEqual(inspect.getsource(proposal.ProposedContext.check),inspect.getsource(local.s.Context.check));self.assertNotIn('subprocess',(HERE/'local.py').read_text());self.assertNotIn('sys.modules',(HERE/'local.py').read_text())
 def test_actual_inserted_negative_case_block_acceptance_and_refusal(self):
  prefix="import assert from 'node:assert/strict';const before={canonical:{project39:{old_identities:{count:1,sha256:'synthetic'}}}};const cfg={state_sql:'SELECT synthetic '};const ctx={system:'99000',runId:'synthetic',root:'fake',report:{}};const sha=()=> 'synthetic';let calls=0;const snapshot=async()=>before;const query=async()=>({actual_changed:true});const bridge=async(_action,value)=>({result:value.observed===before?'accepted':(++calls===1&&process.argv[1]==='bad'?'accepted':'refused')});"
  script=prefix+compiler.NEGATIVES+"assert.equal(ctx.report.forward_guard_negatives.cases.length,2);"
  self.assertEqual(subprocess.run([NODE,'--input-type=module','-e',script],capture_output=True,timeout=10).returncode,0);self.assertNotEqual(subprocess.run([NODE,'--input-type=module','-e',script,'bad'],capture_output=True,timeout=10).returncode,0)
  for mutation in("grant select on eps.oauth_consent_claims to anon;","alter function eps.project_dto(uuid) set statement_timeout='1234ms';"):parse_sql("begin;set local search_path='';"+mutation+self.cfg['state_sql']+'as reason40_release;rollback;')
 def test_new_default_off_entry_before_inspection(self):
  script='const m=await import('+json.dumps((HERE/'cases.mjs').as_uri())+');if(m.EXECUTION_ENABLED)process.exit(8);try{await m.runCases({get system(){throw Error("target touched");}},{});process.exit(9);}catch(e){if(e.code!=="ERR_ASSERTION"||!e.message.includes("DISABLED"))process.exit(7);}'
  self.assertEqual(subprocess.run([NODE,'--input-type=module','-e',script],capture_output=True,timeout=10).returncode,0);self.assertFalse(proposal.LIVE_ENABLED)
if __name__=='__main__':unittest.main()
