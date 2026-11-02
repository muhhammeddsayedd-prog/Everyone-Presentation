"""Pure AST/source/fake-session tests; never SQL, Docker or provider execution."""
import hashlib,json,re,subprocess,unittest
from pathlib import Path
from pglast import parse_sql,parse_plpgsql
HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
BASE=ROOT/'supabase/migrations/20261029215218_m05_immutable_presentation_versions.sql'
RELATIONS=['public.projects','public.clients','eps.presentation_templates','eps.specs','eps.roles','eps.slots','eps.assignments','eps.workspace_candidates','eps.candidates','eps.candidate_media','eps.media_assets','eps.candidate_media_frames']
class Tests(unittest.TestCase):
 def test_parse_temp_invoker_closed_helpers_and_original_predicates(self):
  sql=(HERE/'cohorts.sql').read_text();self.assertEqual(len(parse_sql(sql)),3);self.assertEqual(len(parse_plpgsql(sql)),3)
  self.assertNotIn('security definer',sql.lower());self.assertNotRegex(sql.lower(),r'\b(grant|alter|delete|insert|update)\s+(on|table|eps\.|public\.)')
  cohort=sql.split('-- Distinguish',1)[0];self.assertNotRegex(cohort.lower(),r'\bfor\s+(share|update)\b')
  before=BASE.read_bytes().decode().replace('\r\n','\n');start=before.index('create function eps.presentation_lock_sources(');before=before[start:before.index('end$$;',start)+len('end$$;')]
  body=before.split('as $$',1)[1].rsplit('$$;',1)[0];self.assertEqual(hashlib.sha256(body.encode()).hexdigest(),'4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7')
  old=re.findall(r'perform 1 (from .*?) for share nowait;',before,re.S)
  self.assertEqual(len(old),12)
  for relation,wanted in zip(RELATIONS,old):
   segment=cohort.split('-- cohort:'+relation+'\n',1)[1].split('v_result:=',1)[0]
   actual=segment.split('  from(select ',1)[1].rsplit(')q;',1)[0];actual=actual[actual.index(' from ')+1:]
   for a,b in [('v_project','project_id'),('v_client','client_id'),('v_template_key','p_template_key'),('v_template_version','p_template_version')]:actual=actual.replace(a,b)
   normalize=lambda value:re.sub(r'\s+',' ',value).strip()
   self.assertEqual(normalize(actual),normalize(wanted),relation)
  self.assertIn('s.id=p_series and s.workspace_id=p_workspace',cohort)
 def test_probe_is_fixed_whitelist_exact_keys_parameters_nowait_and_permission_not_lock(self):
  sql=(HERE/'cohorts.sql').read_text();probe=sql.split('create function pg_temp.locksource41_probe(',1)[1]
  for relation in RELATIONS:self.assertIn("'"+relation+"'",probe)
  self.assertIn('execute v_query into v_found using v_values[1],v_values[2]',probe)
  self.assertEqual(probe.count('for update nowait'),3)
  self.assertIn("when insufficient_privilege then return jsonb_build_object('found',false,'locked',false,'code','42501')",probe)
  self.assertIn("'asset_id','candidate_media_id'",probe)
  pool=sql.split('create function pg_temp.locksource41_probe_pool_share(',1)[1].split('-- locked=true',1)[0]
  self.assertIn('from eps.workspace_candidates where id=p_pool for no key update nowait',pool)
  self.assertNotIn('execute ',pool)
 def test_independent_fake_session_lock_semantics_cancel_permissions_and_cleanup(self):
  script="""
import assert from 'node:assert/strict';
import {verifyHeld} from MODULE;
const id='11111111-1111-4111-8111-111111111111';
const cohorts=RELATIONS.map(relation=>({relation,keys:relation==='eps.candidate_media_frames'?[{candidate_media_id:id,asset_id:id}]:relation==='eps.presentation_templates'?[{key:'everyone-casting',version:'1.1.0'}]:[{id}]}));
function context(failure=null){const calls=[];let probed=0;const holder={pid:11,async request(sql){calls.push(['holder',sql]);if(sql.includes('locksource41_measure'))return[{ok:failure!=='cancel',...(failure==='cancel'?{code:'57014'}:{}),duration_ms:1}];if(sql.includes('locksource41_cohorts'))return[cohorts];return[];}};const contender={pid:22,async request(sql){calls.push(['contender',sql]);if(sql.includes('locksource41_probe')){probed++;if(sql.includes('44444444-4444-4444-8444-444444444444'))return[{found:false,locked:false}];if(sql.includes('33333333-3333-4333-8333-333333333333'))return[{found:true,locked:false}];return[failure==='permission'?{found:false,locked:false,code:'42501'}:{found:true,locked:true,code:'55P03'}];}return[];}};return{holder,contender,observer:{},workspace:id,series:id,variant:'old',id:label=>label==='frame-1'?'44444444-4444-4444-8444-444444444444':'33333333-3333-4333-8333-333333333333',acting:()=>"set statement_timeout='8s';set role eps_review_owner;",calls,get probed(){return probed;}};}
const good=context();const result=await verifyHeld(good);assert.equal(result.result,'passed');assert.equal(result.selected_rows,12);assert.equal(result.held_rows,12);assert.equal(good.probed,20);assert.match(result.rowset_sha256,/^[a-f0-9]{64}$/);
const cancelled=context('cancel');assert.equal((await verifyHeld(cancelled)).result,'unconfirmed');assert.equal(cancelled.probed,0);
const denied=context('permission');await assert.rejects(verifyHeld(denied));
for(const ctx of[good,cancelled,denied])for(const name of['holder','contender'])assert.ok(ctx.calls.some(([who,sql])=>who===name&&sql.trim().toLowerCase()==='rollback;'));
assert.ok(!JSON.stringify(result).includes(id));
""".replace('MODULE',json.dumps((HERE/'probes.mjs').as_uri())).replace('RELATIONS',json.dumps(RELATIONS))
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','--eval',script],capture_output=True,text=True,timeout=15)
  self.assertEqual(result.returncode,0,result.stderr)
 def test_archived_pool_fk_control_crossworkspace_failure_cancel_and_exact_rollback(self):
  script="""
import assert from 'node:assert/strict';import {createHash}from'node:crypto';import{verifyEdges}from MODULE;
const id=label=>{const v=createHash('md5').update('synthetic-run:'+label).digest('hex');return v.slice(0,8)+'-'+v.slice(8,12)+'-'+v.slice(12,16)+'-'+v.slice(16,20)+'-'+v.slice(20);};
function context(failure=null){const calls=[];let measured=false,observations=0;const workspace=id('large'),series=id('series');
 const observer={pid:33,async request(sql){calls.push(['observer',sql]);if(sql.includes('do $cross_workspace$'))return[{slot_code:failure==='fk'?'23505':'23503',pool_code:'23503'}];if(sql.includes("'workspace',workspace_id")){observations++;return[{workspace,pool:id(failure==='restore'&&observations>1?'wrong-pool':'pool-2-1'),row_version:1,updated_at:'synthetic',row_sha256:(failure==='rowhash'&&observations>1?'b':'a').repeat(64)}];}return[];}};
 const holder={pid:11,async request(sql){calls.push(['holder',sql]);if(sql.includes('locksource41_measure')){measured=true;return[{ok:failure!=='cancel',duration_ms:1,...(failure==='cancel'?{code:'57014'}:{})}];}if(sql.includes("'archived_pool'"))return[{archived_pool:true,active_reference:true}];return[];}};
 const contender={pid:22,async request(sql){calls.push(['contender',sql]);if(sql.includes('locksource41_probe_pool_share'))return[!measured?(failure==='control'?{found:true,locked:true,code:'55P03'}:{found:true,locked:false}):(failure==='unheld'?{found:true,locked:false}:{found:true,locked:true,code:'55P03'})];return[];}};
 return{holder,contender,observer,workspace,series,variant:'new',id,acting:()=>"set statement_timeout='8s';set role eps_review_owner;",calls,get observations(){return observations;}};}
const good=context();const passed=await verifyEdges(good);assert.equal(passed.result,'passed');assert.equal(passed.fk_key_share_control_was_unblocked,true);assert.equal(passed.helper_share_lock_verified,true);assert.equal(good.observations,2);assert.equal(passed.ready_dml_issued,false);
const cancelled=context('cancel');const partial=await verifyEdges(cancelled);assert.equal(partial.result,'unconfirmed');assert.equal(partial.edge_assignment_exactly_restored,true);assert.ok(!('helper_share_lock_verified'in partial));
for(const failure of['fk','control','unheld','restore','rowhash']){const ctx=context(failure);await assert.rejects(verifyEdges(ctx));for(const who of['holder','contender','observer'])assert.ok(ctx.calls.some(([name,sql])=>name===who&&sql.trim()==='rollback;'));}
assert.ok(good.calls.some(([,sql])=>sql.includes('insert into eps.assignments')));assert.ok(!good.calls.some(([,sql])=>/\\b(?:update|insert into|delete from)\\s+eps\\.(?:presentation_versions|version_slides|presentation_version_assets|presentation_exports)\\b/i.test(sql)));
assert.ok(!JSON.stringify(passed).includes(id('large')));
""".replace('MODULE',json.dumps((HERE/'probes.mjs').as_uri()))
  result=subprocess.run(['C:/Program Files/nodejs/node.exe','--input-type=module','--eval',script],capture_output=True,text=True,timeout=15)
  self.assertEqual(result.returncode,0,result.stderr)
if __name__=='__main__':unittest.main()
