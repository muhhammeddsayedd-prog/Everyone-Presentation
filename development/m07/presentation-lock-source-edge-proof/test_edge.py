"""Exact rendered-template/parser/first-error tests. No DB/Docker/provider."""
from pathlib import Path
import importlib.util,json,subprocess,unittest,hashlib
from unittest.mock import patch
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent;ROOT=HERE.parents[2];BASE=HERE.parent/'presentation-lock-source-proof';NODE='C:/Program Files/nodejs/node.exe'
spec=importlib.util.spec_from_file_location('edge_forward_compiler',HERE/'compiler.py');c=importlib.util.module_from_spec(spec);spec.loader.exec_module(c)
MODULE=json.dumps((HERE/'entry.mjs').as_uri());PROBES=json.dumps((BASE/'probes.mjs').as_uri());PROOF=json.dumps((BASE/'proof.mjs').as_uri())
def node(source):
 r=subprocess.run([NODE,'--input-type=module','--eval',source],capture_output=True,text=True,timeout=20)
 if r.returncode:raise AssertionError(r.stderr)
 return json.loads(r.stdout)if r.stdout.strip()else None
def rendered():
 script="""
import{verifyEdges}from PROBES;import{idFor,acting}from PROOF;import{qualifyEdge}from MODULE;
const run='11111111-1111-4111-8111-111111111111',id=label=>idFor(run,label),workspace=id('large'),series=id('series'),before=[],after=[],applied=[];let measured=false;
const record=sql=>{before.push(sql);const q=qualifyEdge(sql,run);after.push(q.text);if(q.phase)applied.push({phase:q.phase,spaces:q.spaces});};
const observer={pid:33,async request(sql){record(sql);if(sql.includes('do $cross_workspace$'))return[{slot_code:'23503',pool_code:'23503'}];if(sql.includes("'workspace',workspace_id"))return[{workspace,pool:id('pool-2-1'),row_version:1,updated_at:'synthetic',row_sha256:'a'.repeat(64)}];return[];}};
const holder={pid:11,async request(sql){record(sql);if(sql.includes('locksource41_measure')){measured=true;return[{ok:true,duration_ms:1}];}if(sql.includes("'archived_pool'"))return[{archived_pool:true,active_reference:true}];return[];}};
const contender={pid:22,async request(sql){record(sql);if(sql.includes('locksource41_probe_pool_share'))return[measured?{found:true,locked:true,code:'55P03'}:{found:true,locked:false}];return[];}};
await verifyEdges({observer,holder,contender,id,acting,workspace,series,variant:'old'});process.stdout.write(JSON.stringify({before,after,applied,run}));
""".replace('PROBES',PROBES).replace('PROOF',PROOF).replace('MODULE',MODULE)
 return node(script)
class Tests(unittest.TestCase):
 def test_all16_actual_rendered_queries_red_before_green_after_only_three_spaces(self):
  d=rendered();self.assertEqual(len(d['before']),16);bad=[];changed=[]
  for i,(before,after)in enumerate(zip(d['before'],d['after'])):
   try:parse_sql(before);parse_plpgsql(before)
   except Exception:bad.append(i)
   parse_sql(after);parse_plpgsql(after)
   if before!=after:
    changed.append(i);self.assertEqual(after.replace('::uuid where','::uuidwhere').replace('::uuid and','::uuidand'),before)
  self.assertEqual(bad,[2,3]);self.assertEqual(changed,bad);self.assertEqual(sum(x['spaces']for x in d['applied']),3)
  self.assertEqual([x['phase']for x in d['applied']],['edge_assignment_update','edge_pool_state'])
 def test_safe_first_error_recorded_before_mask_identical_error_rethrown_no_payload(self):
  query=rendered()['before'][2]
  script="""
import assert from'node:assert/strict';import{trackedSessions,qualifyEdge}from MODULE;
const run='11111111-1111-4111-8111-111111111111',text=QUERY;
const report={edge_template_qualification:{actual_requests:[]}},target=[],proxy=trackedSessions(target,report,run);
const original=new Error('PRIVATE_MESSAGE');original.code='42601';original.diagnostic={stdout:'PRIVATE_SQL_PAYLOAD',stderr:'PRIVATE_DETAILS'};
const rollback=()=>{};const value={application:'locksource41_fake_holder',rollback,async request(sql){assert.equal(sql,qualifyEdge(text,run).text);throw original;}};
assert.equal(proxy.push(value),1);assert.equal(target[0],value);assert.equal(value.rollback,rollback);
await assert.rejects(value.request(text),e=>e===original);const masked=new Error('LOCKSOURCE41_EDGE_ROLLBACK_UNCONFIRMED');assert(masked);
assert.equal(report.first_owned_request_error.code,'42601');assert.equal(report.first_owned_request_error.phase,'edge_assignment_update');assert.equal(report.edge_template_qualification.actual_requests.length,1);
const serialized=JSON.stringify(report);assert(!serialized.includes('PRIVATE'));assert(!serialized.includes('update eps'));assert(!serialized.includes(run));
const unknown={edge_template_qualification:{actual_requests:[]}},unknownProxy=trackedSessions([],unknown,run);const error=new Error('PRIVATE_ARBITRARY');error.code='PRIVATE_TOKEN';const other={application:'fake_observer',async request(){throw error;}};unknownProxy.push(other);await assert.rejects(other.request('rollback;'),e=>e===error);assert.equal(unknown.first_owned_request_error.code,'REQUEST_FAILED_UNCLASSIFIED');assert.equal(unknown.first_owned_request_error.phase,'cleanup_rollback');assert(!JSON.stringify(unknown).includes('PRIVATE'));
const transport={edge_template_qualification:{actual_requests:[]}},transportProxy=trackedSessions([],transport,run);const normal={application:'fake_contender',async request(){throw new Error('LOCKSOURCE41_SESSION_FAILED');}};transportProxy.push(normal);await assert.rejects(normal.request('select 1;'));assert.equal(transport.first_owned_request_error.code,'OWNED_SESSION_FAILED');
""".replace('MODULE',MODULE).replace('QUERY',json.dumps(query))
  node(script)
 def test_unknown_template_drift_and_wrong_run_refuse_without_widening(self):
  d=rendered();node("import assert from'node:assert/strict';import{qualifyEdge}from"+MODULE+";const q="+json.dumps(d['before'][2])+";assert.throws(()=>qualifyEdge(q.replace('eps.assignments','eps.candidates'),'"+d['run']+"'));assert.throws(()=>qualifyEdge(q,'22222222-2222-4222-8222-222222222222'));assert.equal(qualifyEdge('select 1;','"+d['run']+"').text,'select 1;');")
 def test_disabled_before_context_and_new_owned_compiler_preserves_frozen_sources(self):
  node("import assert from'node:assert/strict';import{runCases,EXECUTION_ENABLED}from"+MODULE+";assert.equal(EXECUTION_ENABLED,false);let touched=0;await assert.rejects(runCases(new Proxy({},{get(){touched++;throw Error('unreached');}})),/EDGE_EXECUTION_DISABLED/);assert.equal(touched,0);")
  source=c.compile_source('.local/presentation-lock-source-edge-proof-compiled/controller-11111111-1111-4111-8111-111111111111.mjs')
  self.assertIn('eps.locksource41edge.run',source);self.assertIn('presentation-lock-source-edge-proof/entry.mjs',source);self.assertNotIn("'label=eps.locksource41dedupe.run='",source)
  self.assertLess(source.index('LOCKSOURCE41_EDGE_EXECUTION_DISABLED'),source.index('await original()'))
  r=subprocess.run([NODE,'--input-type=module','--check'],input=source,capture_output=True,text=True,timeout=15);self.assertEqual(r.returncode,0,r.stderr)
  with patch.object(c,'OLD_ENTRY_SHA','0'*64):
   with self.assertRaises(ValueError):c.compile_source('.local/unreachable.mjs')
  self.assertEqual(hashlib.sha256((BASE/'probes.mjs').read_bytes()).hexdigest(),'8973de4f38895f2497b46d87d6dda0fe929f2652d8cebb870c9d402587bf21b4')
  self.assertEqual(hashlib.sha256((ROOT/'tracking/evidence/m07/presentation-lock-source-dedupe-proof/2026-11-02T13-17-13.306Z-11ea4b21.json').read_bytes()).hexdigest(),'33d49afd9f30691e64321e5ae9cb2018e5ac23bafb7b2be15ea8725bf82129d0')
if __name__=='__main__':unittest.main()
