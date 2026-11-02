"""Execute actual collector call fragments against a fake query port; never SQL."""
from pathlib import Path
import importlib.util,json,re,subprocess,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker40_observation_compiler_tests',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
UUID='00000000-0000-4000-8000-000000000001'
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.source,cls.concurrency,cls.callback,cls.plan=c.compile_source('.local/worker-source-identity-sql-observation-compiled/controller-'+UUID+'.mjs')
 def test_exact_inverse_unchanged_diagnostic_helper_and_all_generated_JS(self):
  self.assertFalse(self.plan['execution_enabled']);self.assertTrue(self.plan['original_bridge_controller_inverse_byte_equal']);self.assertTrue(self.plan['callback_only_flag_and_empty_audit_observation_search_path_changed']);self.assertTrue(self.plan['diagnostic_helper_reused_exact']);self.assertIn("'.local/worker-source-identity-sql-observation-once'",self.source);self.assertIn("'.local/worker-source-identity-sql-bridge-proof'",self.source)
  for text in(self.source,self.concurrency,self.callback,(HERE/'entry.mjs').read_text()):
   p=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','--check'],input=text.encode(),capture_output=True,timeout=10);self.assertEqual(p.returncode,0,p.stderr[:200])
 def test_ALL_actual_direct_snapshot_calls_and_checkpoint_prefix_have_GUC_original_fails(self):
  self.assertEqual(self.callback.count('cfg.snapshot_sql'),3)
  begin=self.source.index('const cfg=')+len('const cfg=');cfg,_=json.JSONDecoder().raw_decode(self.source[begin:]);fragments=[]
  for start,end in [('const snapshot=()=>query(',');\n  const checkpoint='),('const observed=await query(',');assert.equal((await bridge('),('const changed=await query(',');assert.notEqual(')]:
   a=self.callback.index(start)+len(start);b=self.callback.index(end,a);fragments.append(self.callback[a:b])
  legacy=fragments[2].replace(c.CORRECT,c.MISSING,1);self.assertNotEqual(legacy,fragments[2])
  program="import assert from'node:assert/strict';let input='';for await(const x of process.stdin)input+=x;const v=JSON.parse(input),cfg=v.cfg,sql='grant select on eps.oauth_consent_claims to anon;',audit={audit_id:'"+UUID+"'},quote=t=>\"'\"+t.replaceAll(\"'\",\"''\")+\"'\";const run=fragment=>new Function('cfg','sql','audit','quote','return('+fragment+');')(cfg,sql,audit,quote);const queries=v.fragments.map(run);const admitted=text=>text.indexOf(\"set local search_path='';\")>=0&&text.indexOf(\"set local search_path='';\")<text.indexOf(cfg.snapshot_sql);assert(queries.every(admitted));assert(!admitted(run(v.legacy)));process.stdout.write(JSON.stringify(queries));"
  p=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],input=json.dumps({'cfg':cfg,'fragments':fragments,'legacy':legacy}).encode(),capture_output=True,timeout=15);self.assertEqual(p.returncode,0,p.stderr[:200]);queries=json.loads(p.stdout)
  for sql in queries:parse_sql(sql)
  self.assertTrue(cfg['checkpoint_sql'].startswith("begin isolation level repeatable read read only;set local search_path='';"));self.assertIn("set local search_path='';",cfg['prefix']);parse_sql(cfg['checkpoint_sql'])
 def test_production_SQL_contract_native_value_and_strict_guards_remain_equal(self):
  base=c.module('observation_sealed_bridge_for_test',c.BRIDGE/'compiler.py');_,_,old_callback,plan=base.compile_source('.local/worker-source-identity-sql-bridge-compiled/controller-'+UUID+'.mjs')
  for key in('production_State_SQL_hashes','sql_contract_sha256','native_pin_value'):self.assertEqual(self.plan[key],plan[key])
  self.assertEqual(old_callback.count(c.MISSING),1);self.assertEqual(self.callback.count(c.MISSING),0);self.assertEqual(self.callback.count(c.CORRECT),1)
 def test_disabled_entry_refuses_before_any_port_or_file(self):
  code="const m=await import("+json.dumps((HERE/'entry.mjs').as_uri())+");let called=false;try{await m.runCases(new Proxy({},{get(){called=true;throw Error('PORT')}}),{})}catch(e){if(e.message!=='WORKER40_OBSERVATION_PROOF_DISABLED')throw e;}if(called)throw Error('READ_BEFORE_FLAG');";p=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',code],capture_output=True,timeout=10);self.assertEqual(p.returncode,0,p.stderr[:200])
if __name__=='__main__':unittest.main()
