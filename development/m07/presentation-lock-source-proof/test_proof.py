"""Offline parser/compiler and inert fake-port checks; no Docker/SQL/provider."""
import importlib.util,json,re,subprocess,unittest
from pathlib import Path
from unittest.mock import patch
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('locksource41_compiler',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
NODE='C:/Program Files/nodejs/node.exe'
def node(text):
 r=subprocess.run([NODE,'--input-type=module','--eval',text],capture_output=True,text=True,timeout=20)
 if r.returncode:raise AssertionError(r.stderr)
 return json.loads(r.stdout)if r.stdout.strip()else None
def module(file):return json.dumps((HERE/file).as_uri())
class Tests(unittest.TestCase):
 def test_disabled_before_context_or_any_transport(self):
  node("import assert from'node:assert/strict';import{EXECUTION_ENABLED,runCases}from"+module('proof.mjs')+";assert.equal(EXECUTION_ENABLED,false);let touched=0;await assert.rejects(runCases(new Proxy({},{get(){touched++;throw Error('unreached');}})),/LOCKSOURCE41_EXECUTION_DISABLED/);assert.equal(touched,0);")
 def test_session_accepts_actual_cohort_array_and_rejects_corruption(self):
  node("import assert from'node:assert/strict';import{decodedRow}from"+module('session.mjs')+";assert.deepEqual(decodedRow('[{\"relation\":\"eps.roles\",\"keys\":[]}]'),[{relation:'eps.roles',keys:[]}]);assert.deepEqual(decodedRow('{\"pid\":392}'),{pid:392});assert.equal(decodedRow('SET'),null);assert.throws(()=>decodedRow('[broken'));assert.throws(()=>decodedRow('{broken'));")
 def test_every_authored_sql_and_plpgsql_body_parses_with_bounded_json_objects(self):
  for file in ['fixture.sql','scale.sql','background.sql','temporary.sql','cohorts.sql','counts.sql']:
   source=(HERE/file).read_text();self.assertTrue(parse_sql(source),file);parse_plpgsql(source)
   # Parse every PL/pgSQL expression in the parser tree, then bound actual
   # variadic JSON constructor arity; parse_sql alone cannot resolve operators.
   tree=json.loads(__import__('pglast').parser.parse_plpgsql_json(source))
   def visit(value):
    if isinstance(value,list):
     for item in value:visit(item)
    elif isinstance(value,dict):
     if 'query'in value and isinstance(value['query'],str):
      try:sql=json.loads(__import__('pglast').parser.parse_sql_json(value['query']))
      except Exception:sql={}
      def check(x):
       if isinstance(x,list):
        for item in x:check(item)
       elif isinstance(x,dict):
        if 'FuncCall'in x:
         call=x['FuncCall'];names=[s['String']['sval']for s in call.get('funcname',[])];
         if names and names[-1]=='jsonb_build_object':self.assertLessEqual(len(call.get('args',[])),100,file)
        for item in x.values():check(item)
      check(sql)
     for item in value.values():visit(item)
   visit(tree)
 def test_finite_compiler_source_pins_owned_guards_no_old_race_or_entry_replay(self):
  source=c.compile_source('.local/presentation-lock-source-proof-compiled/controller-11111111-1111-4111-8111-111111111111.mjs')
  self.assertIn("assert(lockProof.EXECUTION_ENABLED,'LOCKSOURCE41_EXECUTION_DISABLED')",source)
  self.assertLess(source.index('assert(lockProof.EXECUTION_ENABLED'),source.index('await original()'))
  self.assertIn('await lockProof.runCases(',source);self.assertNotIn("report.checkpoint = 'same-key-independent-session-race'",source)
  self.assertIn("'--network', 'none'",source);self.assertNotIn("'--publish'",source)
  self.assertIn('independent_successful_daemon_label_inventories_empty=true',source)
  self.assertIn("'LOCKSOURCE41_ASSERTION_FAILED'",source);self.assertNotIn("'PROJECT39_RACE_ASSERTION_FAILED'",source)
  self.assertIn('all_preexisting_old_column_rows_preserved',source);self.assertIn("to_jsonb(t)-''reason''",source)
  self.assertIn('presentation-lock-source-proof/probes.mjs',source)
  self.assertIn('presentation-lock-source-proof/test_cohorts.py',source)
  r=subprocess.run([NODE,'--input-type=module','--check'],input=source,capture_output=True,text=True,timeout=15);self.assertEqual(r.returncode,0,r.stderr)
  with patch.object(c,'BASE_SHA','0'*64):
   with self.assertRaises(ValueError):c.compile_source('.local/unreachable.mjs')
 def test_actual40_adapter_inverse_and_local_mcp_intersection_claim_shape(self):
  sql=(c.MAIN/c.SQL40).read_text();result=node("import{owned40,acting}from"+module('proof.mjs')+";const original="+json.dumps(sql)+";const result=owned40(original,'7777777777777777777','11111111-1111-4111-8111-111111111111');process.stdout.write(JSON.stringify({result,api:acting('api','authenticated'),mcp:acting('mcp','eps_review_owner')}));")
  self.assertEqual(len(parse_sql(result['result'])),10)
  node("import assert from'node:assert/strict';import{owned40}from"+module('proof.mjs')+";assert.throws(()=>owned40('unreachable','7701520506262638626','11111111-1111-4111-8111-111111111111'));")
  self.assertEqual(result['result'].count("current_database()<>'project39'"),1)
  for name in ['api','mcp']:parse_sql(result[name]);parse_plpgsql(result[name]);self.assertIn("statement_timeout='8s'",result[name])
  self.assertIn('eps_delegation',result['mcp']);self.assertIn('session_id',result['mcp']);self.assertNotIn('eps_delegation',result['api'])
  self.assertEqual(c.sha(sql.encode()),c.SQL40_SHA)
 def test_real_rendered_race_queries_parse_and_workspace_wait_precedes_revocation(self):
  script="""
import assert from'node:assert/strict';import{changedSourceRaces,idFor}from MODULE;
const calls=[],run='11111111-1111-4111-8111-111111111111';let operation=0;
const holder={pid:391,async request(sql){calls.push(['holder',sql]);return[];}};
const writer={pid:393,async request(sql){calls.push(['writer',sql]);return[];}};
const observer={pid:394,async request(sql){calls.push(['observer',sql]);return[{waiting:true}];}};
const contender={pid:392,async request(sql){calls.push(['contender',sql]);if(sql.startsWith('select pg_temp.locksource41_measure')){operation++;if(operation===4)return[{ok:true,duration_ms:1}];return[{ok:false,code:operation<4?'INPUT_CHANGED':'RESOURCE_NOT_FOUND',duration_ms:1}];}return[];}};
const context={holder,writer,observer,contender,variant:'new',runId:run,id:label=>idFor(run,label),profiles:{large:{project:idFor(run,'project'),workspace:idFor(run,'workspace'),series:idFor(run,'series'),meta:{input:{expected_workspace_row_version:1,expected_draft_revision:1,expected_input_fingerprint:'a'.repeat(64)}}}},value:async sql=>{calls.push(['value',sql]);return{id:idFor(run,'preimage'),active:true};}};
const result=await changedSourceRaces(context);
assert.equal(result.length,7);assert.equal(result[6].actual_relation_wait,true);assert.equal(operation,7);
const wait=calls.findIndex(([who,sql])=>who==='observer'&&sql.includes('pg_stat_activity'));
const revoke=calls.findIndex(([who,sql])=>who==='writer'&&sql.includes('delete from public.project_memberships'));
assert(wait>=0&&revoke>wait);
const partial=[];await assert.rejects(changedSourceRaces({...context,raceEvidence:partial,contender:{pid:392,async request(sql){calls.push(['failure-contender',sql]);return sql.startsWith('select pg_temp.locksource41_measure')?[{ok:false,code:'42501',duration_ms:1}]:[];}}}));assert.equal(partial.length,1);assert.equal(partial[0].code,'42501');assert.equal(partial[0].ok,false);
process.stdout.write(JSON.stringify(calls.map(([,sql])=>sql)));
""".replace('MODULE',module('proof.mjs'))
  sqls=node(script);self.assertGreater(len(sqls),35)
  for sql in sqls:parse_sql(sql);parse_plpgsql(sql)
  actual=next(sql for sql in sqls if 'pg_stat_activity'in sql)
  with self.assertRaises(Exception):parse_sql(actual.replace('and 391=','and391='))
 def test_evidence_boundaries_and_full_reason_preservation(self):
  source=(HERE/'proof.mjs').read_text();fixture=(HERE/'fixture.sql').read_text();temp=(HERE/'temporary.sql').read_text()
  self.assertIn('old_generation_comparison_unavailable',source);self.assertIn('if(variant===\'candidate\')assert.equal(generation.ok,true',source)
  self.assertLess(source.index('Object.assign(ctx.report.performance,{results'),source.index("for(const variant of['old','candidate'])"))
  self.assertLess(source.index('record[operation].push(result)'),source.index("'LOCKSOURCE41_CANDIDATE_COMPONENT_FAILED'"))
  self.assertLess(source.index('record.generation=generation'),source.index('assert(generation.ok||'))
  self.assertIn('full_reason_column_preserved:true',source);self.assertIn('to_jsonb(t)::text',fixture);self.assertNotIn("to_jsonb(t)-'reason'",fixture)
  self.assertIn('reason is not null',fixture);self.assertIn('Synthetic existing reason must remain exact.',fixture)
  self.assertIn("snapshot-'created_at'",temp);self.assertIn('normalization',temp);self.assertNotIn('set_config(\'eps.',temp)
  for text in [source,fixture,(HERE/'scale.sql').read_text(),(HERE/'background.sql').read_text()]:
   self.assertNotRegex(text.lower(),r'\b(disable\s+trigger|bypassrls|alter\s+policy|set\s+row_security\s*=\s*off)\b')
 def test_all_fixture_insert_columns_exist_in_the_pinned_synthetic38_schema_or_exact40(self):
  raw=(c.MAIN/'.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql').read_bytes()
  self.assertEqual(c.sha(raw),'12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c')
  tables={}
  for match in re.finditer(r'CREATE TABLE ([a-z_]+)\.([a-z_]+) \(.*?\n\);',raw.decode(),re.S):
   stmt=parse_sql(match.group())[0].stmt;tables[match[1]+'.'+match[2]]={x.colname for x in stmt.tableElts if hasattr(x,'colname')}
  tables['eps.audit_events'].add('reason')
  count=0
  for file in ['fixture.sql','scale.sql','background.sql']:
   source=(HERE/file).read_text()
   for match in re.finditer(r'insert into ((?:eps|auth|public)\.[a-z_]+)\(([^)]+)\)',source,re.I):
    self.assertIn(match[1],tables);self.assertFalse(set(match[2].split(','))-tables[match[1]],match[1]);count+=1
  self.assertGreaterEqual(count,15)
if __name__=='__main__':unittest.main()
