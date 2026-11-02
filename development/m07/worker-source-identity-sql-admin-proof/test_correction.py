"""Actual source/SQL dispatch ordering and inverse; no database or Docker."""
from pathlib import Path
import importlib.util,json,subprocess,unittest
from pglast import parse_sql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('worker40_admin_correction_tests',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
UUID='00000000-0000-4000-8000-000000000001'
class Tests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):cls.source,cls.concurrency,cls.callback,cls.plan=c.compile_source('.local/worker-source-identity-sql-admin-compiled/controller-'+UUID+'.mjs')
 def test_defaultoff_new_claim_namespace_and_all_generated_sources_parse(self):
  self.assertFalse(self.plan['execution_enabled']);self.assertTrue(self.plan['original_controller_inverse_byte_equal']);self.assertTrue(self.plan['callback_only_flag_and_absolute_bridge_changed']);self.assertTrue(self.plan['no_cast_read_grant_added']);self.assertIn("'.local/worker-source-identity-sql-admin-once'",self.source);self.assertLess(self.source.index('report.dispatch_once_claim_created=true'),self.source.index('port = await import'))
  for text in(self.source,self.concurrency,self.callback,(HERE/'entry.mjs').read_text()):
   result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','--check'],input=text.encode(),capture_output=True,timeout=10);self.assertEqual(result.returncode,0,result.stderr[:200])
 def test_actual_rendered_admin_then_postgres_dispatches_keep_unchanged_q_and_config_SQL(self):
  begin=self.source.index('const cfg=')+len('const cfg=');cfg,_=json.JSONDecoder().raw_decode(self.source[begin:]);start=self.source.index('    const qualificationGuard=');end=self.source.index('    const managed=',start);block=self.source[start:end]
  old=c.module('worker40_old_dispatch_regression',c.OLD/'compiler.py');legacy,_,_=old.compile_source('.local/worker-source-identity-sql-compiled/controller-'+UUID+'.mjs');start=legacy.index('    await sql("set session authorization postgres;begin;set local eps.worker39.run=');legacy=legacy[start:legacy.index('    const managed=',start)]
  program="""import assert from 'node:assert/strict';
let raw='';for await(const x of process.stdin)raw+=x;
const v=JSON.parse(raw),queries=[],report={},quote=t=>"'"+t.replaceAll("'","''")+"'";
const runId='"""+UUID+"""',identity={system_identifier:'1234567890123456789'};
const sql=async text=>{queries.push(text);if(text.includes('create table project39_proof.qualified_rows')&&text.startsWith('set session authorization postgres'))throw Error('MODELED_SCHEMA_OWNER_DENIAL');};
const run=block=>new Function('sql','quote','runId','identity','qualified','config','report','return(async()=>{'+block+'})();')(sql,quote,runId,identity,v.qualified,v.config,report);
// Real frozen dispatch fails this source-backed role/owner model; corrected dispatch passes.
await assert.rejects(run(v.legacy),{message:'MODELED_SCHEMA_OWNER_DENIAL'});assert.equal(queries.length,1);queries.length=0;
await run(v.block);assert.equal(queries.length,2);
assert(queries[0].startsWith('reset session authorization;begin;'));
assert(queries[0].indexOf('WORKER40_ORIGINAL_OWNED_ADMIN_REQUIRED')<queries[0].indexOf('create table project39_proof.qualified_rows'));
for(const required of["current_user<>'supabase_admin'","session_user<>'supabase_admin'",'rolsuper',"nspname='project39_proof'","current_database()<>'project39'",'system_identifier',"eps.worker39.run"])assert(queries[0].includes(required));
assert(queries[1].startsWith('set session authorization postgres;begin;'));assert(queries[1].includes(v.config));assert(!queries[1].includes('create table project39_proof.qualified_rows'));
process.stdout.write(JSON.stringify(queries));"""
  data={'block':block,'legacy':legacy,'qualified':cfg['qualification_sql'].replace('__WORKER39_OWNED_SYSTEM_SQL__',"'1234567890123456789'").replace('__WORKER39_OWNED_RUN_SQL__',"'"+UUID+"'"),'config':cfg['config_setup_sql'].replace('__REASON40_FIXTURE_SYSTEM_SQL__',"'1234567890123456789'").replace('__REASON40_FIXTURE_RUN_SQL__',"'"+UUID+"'")}
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',program],input=json.dumps(data).encode(),capture_output=True,timeout=15);self.assertEqual(result.returncode,0,result.stderr[:200]);queries=json.loads(result.stdout)
  for sql in queries:parse_sql(sql)
  self.assertEqual(queries[0].count(data['qualified']),1);self.assertEqual(queries[1].count(data['config']),1)
 def test_production_SQL_hashes_are_identical_to_frozen_original_compilation(self):
  old=c.module('worker40_old_for_exact_hash_test',c.OLD/'compiler.py');_,_,before=old.compile_source('.local/worker-source-identity-sql-compiled/controller-'+UUID+'.mjs');self.assertEqual(self.plan['production_State_SQL_hashes'],before['SQL_hashes']);self.assertEqual(self.plan['sql_contract_sha256'],before['sql_contract_sha256']);self.assertEqual(self.plan['native_pin_value'],before['native_pin_value'])
 def test_disabled_entry_refuses_without_reading_any_port(self):
  code="const m=await import("+json.dumps((HERE/'entry.mjs').as_uri())+");let called=false;try{await m.runCases(new Proxy({},{get(){called=true;throw Error('PORT')}}),{})}catch(e){if(e.message!=='WORKER40_ADMIN_PROOF_DISABLED')throw e;}if(called)throw Error('READ_BEFORE_FLAG');";result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','-e',code],capture_output=True,timeout=10);self.assertEqual(result.returncode,0,result.stderr[:200])
 def test_parent_flag_normalization_is_literal_only_and_never_accepts_body_changes(self):
  a=b'export const EXECUTION_ENABLED=false;\nBODY';b=b'export const EXECUTION_ENABLED=true;\nBODY';self.assertEqual(c.normalized_flag(a),c.normalized_flag(b));self.assertNotEqual(c.sha(c.normalized_flag(a)),c.sha(c.normalized_flag(b+b'changed')))
  for raw in(b+b'\n'+a,b'export const EXECUTION_ENABLED = true;'):
   with self.assertRaises(ValueError):c.normalized_flag(raw)
if __name__=='__main__':unittest.main()
