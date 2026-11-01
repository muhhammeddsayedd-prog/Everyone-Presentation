/** Inert public-source/fake-port/parser checks only. */
import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {loadSources,validateSources,compileBatchProof,ROOT,PURPOSE,DRAFT,EXECUTION_ENABLED,sha} from './controller.mjs';
import {candidateBody,renderBatchWire,verifyBatchObservation,createBatchRuntime,MARKER,ROLLBACK_MARKER} from './runtime.mjs';
import {MARKER as OLD_MARKER,ROLLED_BACK} from '../feedback-summary37-proof/runtime.mjs';
import {ownedPredicate33} from '../recovery33/ownership.mjs';
const run='b8380000-0000-4000-8000-000000000001';
const identity={database:'eps_m07_r33_source_'+run.replaceAll('-',''),marker:`eps-m07-recovery33:${run}:source`,oid:12345};
const sources=await loadSources();
const rows=s=>s.split(/\r?\n/u).filter(v=>v.startsWith('{')).map(v=>JSON.parse(v));
const nested={[ROLLBACK_MARKER]:true,history_count:37,session_identity_restored:true,full_catalogue_rows_roles_exact:true,fixture_and_helpers_absent:true};
const output=()=>OLD_MARKER+'\n'+MARKER+'\n'+JSON.stringify(nested)+'\n'+JSON.stringify(ROLLED_BACK)+'\n';
function parse(sql){
 const code="import sys;import pglast;from pglast import ast,parse_sql,parse_plpgsql;from pglast.stream import RawStream;assert pglast.__version__=='v7.21';s=parse_sql(sys.stdin.read());n=0\nfor r in s:\n if isinstance(r.stmt,(ast.DoStmt,ast.CreateFunctionStmt)):parse_plpgsql(RawStream()(r.stmt));n+=1\nprint(len(s),n)";
 const p=spawnSync(path.join(ROOT,'.venv-skills/Scripts/python.exe'),['-I','-X','utf8','-B','-c',code],{input:sql,encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(p.status,0,p.stderr);return p.stdout;
}
test('exact public closure preserves all365 prior inputs and the real217 proof plus five held drafts',()=>{
 const{base,manifest}=validateSources(sources);assert.equal(base.size,217);assert.equal(Object.keys(manifest.pins).length,370);assert.equal(sources.size,376);
 for(const file of ['packages/domain/src/index.ts','apps/worker/src/presentation-pdf.ts',DRAFT+'candidate.sql.txt']){const bad=new Map(sources);bad.set(file,Buffer.from('changed'));assert.throws(()=>validateSources(bad));}
 const bad=new Map(sources);bad.set('unknown.sql',Buffer.from('x'));assert.throws(()=>validateSources(bad));
});
test('new compiler keeps old metadata33 path/cleanup and substitutes only a disabled new SQL hook and purpose',()=>{
 const c=compileBatchProof(sources,{runId:run});assert.equal(c.manifest.execution_enabled,EXECUTION_ENABLED);assert(c.source.includes('await runBatchProof({'));assert(!c.source.includes('await runFeedback37({'));
 assert(c.source.includes("'.local/m07-job-batch-filter-tests'"));assert(c.source.includes("'tracking/evidence/m07/job-batch-filter-proof'"));
 for(const f of ['original29_full_catalogue_unchanged','original29_full_auth_storage_catalogue_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert((c.source+sources.get('development/m07/recovery33/runtime.mjs').toString()).includes(f));
 assert.equal(Object.keys(c.manifest.source_pins).length,376);const p=spawnSync(process.execPath,['--check','--input-type=module'],{input:c.source,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(p.status,0,p.stderr);
});
test('candidate adapter removes only exact outer fences and refuses transaction escape',()=>{
 const original=sources.get(DRAFT+'candidate.sql.txt').toString();assert.equal(candidateBody(original),original.replace('\nbegin;\n','\n').slice(0,-'commit;\n'.length));
 assert.throws(()=>candidateBody(original+'-- changed'));assert.throws(()=>candidateBody(original.replace('notify pgrst',"commit;\nnotify pgrst")),/TRANSACTION_ESCAPE/);
});
test('nested wire runs current37 batch before original37 fixture and restores exact session/rows/roles before continuation',()=>{
 const w=renderBatchWire(sources,identity),s=w.body;
 assert.notEqual(w.base_wire_sha256,w.injected_wire_sha256);assert.equal(sha(s),w.injected_wire_sha256);
 const history=s.indexOf("values('20261101042702')"),start=s.indexOf('savepoint batch_filter_source_proof;'),guard=s.indexOf('do $batch_owned$',start),auth=s.indexOf('set local session authorization postgres;',start),candidate=s.indexOf('create function public.eps_list_jobs_by_batch'),rollback=s.indexOf('rollback to savepoint batch_filter_source_proof'),capture=s.indexOf('BATCH_PROOF_NESTED_STATE_CHANGED'),old=s.indexOf("set local eps.feedback_summary37.proof='owned-local-rollback-v1'");
 assert(history<start&&start<guard&&guard<auth&&auth<candidate&&candidate<rollback&&rollback<capture&&capture<old);
 assert(s.includes('oid=10 and rolname=session_user and rolsuper'));assert(s.includes('oid=16384 and rolname=current_user'));assert(s.includes(identity.marker));
 assert(s.includes('s is distinct from current_setting'));assert(s.includes("'identity',jsonb_build_object('session',session_user,'current',current_user)"));
 assert(s.includes('rollback to savepoint feedback37_source_proof'));assert(!s.includes('insert into supabase_migrations.schema_migrations(version)values(\'20261101_batch'));
 assert(s.includes('a2239225b995673e9ab432ac63014f742b25032cc586c790535db260c551d241'));
});
test('actual compiled sql port assembles BEGIN/body/COMMIT and every dynamic PLpgSQL block parses',async()=>{
 const c=compileBatchProof(sources,{runId:run}).source,w=renderBatchWire(sources,identity),start=c.indexOf('async function sql(database, body, role = '),end=c.indexOf('\nconst value = async ',start);assert(start>0&&end>start);let assembled;
 const port=vm.runInNewContext('('+c.slice(start,end)+')',{assert,databaseIdentity:async()=>({oid:identity.oid}),marker:()=>identity.marker,ownedPredicate33,literal:v=>"'"+String(v).replaceAll("'","''")+"'",psqlArgs:()=>['FAKE'],docker:async(_a,o)=>{assembled=o.input;return{stdout:''};}},{timeout:1000});
 await port(identity.database,w.body);assert(assembled.endsWith(w.body+'\ncommit;'));assert(parse(assembled));
 assert(c.includes("'-U', 'supabase_admin'")); // no frozen transport change
});
test('local session authorization requires both existing SET-role paths and never creates either membership',()=>{
 const s=renderBatchWire(sources,identity).body,start=s.indexOf('savepoint batch_filter_source_proof;'),auth=s.indexOf('set local session authorization postgres;',start),guard=s.slice(start,auth);
 for(const role of ['authenticated','anon'])assert(guard.includes("not pg_has_role('postgres','"+role+"','SET')"));
 assert(!/grant\s+(?:authenticated|anon)\s+to\s+postgres/iu.test(s.slice(start,s.indexOf('rollback to savepoint batch_filter_source_proof'))));
});
test('supplement tests broad business grants narrowed by synthetic delegation, never cryptographic JWT proof',()=>{
 const s=renderBatchWire(sources,identity).body;
 for(const text of ['synthetic actor has broad ordinary business grants','synthetic delegated claims narrow actual SQL capabilities','delegated cast-only sees own frame despite broader business grants','synthetic expired session has no effective SQL capabilities','savepoint batch_delegate_expiry','rollback to savepoint batch_delegate_expiry'])assert(s.includes(text));
 assert(s.includes("jsonb_build_array('cast.read')"));assert(s.includes("public.eps_get_capabilities()->'capabilities'='[\"cast.read\"]'::jsonb"));
 assert(s.includes('no JWT signature/provider assertion'));assert(!s.includes('Bearer '));
});
test('observation requires both unique real fixture markers, exact nested metadata and full33 rollback',()=>{
 const before={catalogue:{old:'catalogue'},data:{hash:'data'},history:{versions:Array(33).fill('v')}};
 verifyBatchObservation(output(),rows,before,structuredClone(before));
 assert.throws(()=>verifyBatchObservation(output()+MARKER,rows,before,before));
 assert.throws(()=>verifyBatchObservation(output().replace('"session_identity_restored":true','"session_identity_restored":false'),rows,before,before));
 assert.throws(()=>verifyBatchObservation(output(),rows,before,{...before,catalogue:{changed:true}}));
 assert.throws(()=>verifyBatchObservation(output().replace(JSON.stringify(nested),JSON.stringify({...nested,unknown:true})),rows,before,before));
});
test('actual new runtime dispatches one injected wire through fake ports and reports its own hash truthfully',async()=>{
 const writes=new Map(),history={versions:[...Array(32).fill('old'),'20261031130207']};let calls=0;
 const ctx={root:ROOT,sourceFiles:sources,sourceDb:identity.database,privateRoot:'FAKE_PRIVATE',report:{private_artifact_acl:process.platform==='win32'?'current-user-and-SYSTEM-only-verified':'mode0700'},marker:()=>identity.marker,databaseIdentity:async()=>({oid:identity.oid}),catalogue:async()=>({old:'catalogue'}),value:async(_d,s)=>s.startsWith("select jsonb_build_object('versions'")?history:{hash:'data'},rows,sql:async(_d,body)=>{calls++;assert(body.includes(MARKER));assert.equal(sha(body),renderBatchWire(sources,identity).injected_wire_sha256);return{stdout:output()};}};
 const io={readFile:async f=>sources.get(path.relative(ROOT,f).replaceAll('\\','/')),writeFile:async(f,b,o)=>{assert.equal(o.flag,'wx');assert.equal(o.mode,0o600);assert(!writes.has(f));writes.set(f,b);}};
 await createBatchRuntime(io)(ctx);assert.equal(calls,1);assert.equal(writes.size,1);assert.equal(ctx.report.batch_filter_sql.result,'passed');assert.notEqual(ctx.report.batch_filter_sql.injected_wire_sha256,ctx.report.batch_filter_sql.base_feedback37_wire_sha256);
 for(const f of ['JWT_signature_verified','real_OAuth_session_or_revocation_tested','HTTP_tested','MCP_tested','native_media_executed','cloud_called','provider_called','hosted_acceptance','restore_acceptance'])assert.equal(ctx.report.batch_filter_sql[f],false);
 assert.equal(ctx.report.feedback37_sql,undefined);
});
test('disabled entry refuses preparation/dispatch before private input or lock access; claims are permanent',async()=>{
 const r=await import('./run.mjs');assert.equal(typeof EXECUTION_ENABLED,'boolean');if(!EXECUTION_ENABLED){await assert.rejects(r.prepare(),/BATCH_PROOF_EXECUTION_DISABLED/);await assert.rejects(r.execute(run),/BATCH_PROOF_EXECUTION_DISABLED/);}
 const s=sources.get(PURPOSE+'run.mjs').toString();assert(s.indexOf('execution-claim.json')<s.indexOf("['--import','tsx'"));assert(s.includes("flag:'wx'"));assert(s.includes('normal_process_return_observed:typeof result.code'));
});
