import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadSources,ROOT,PURPOSE,PRIOR_RECEIPT,PRIOR_RECEIPT_SHA,assertPriorProof,
 FAILED_RECEIPT,FAILED_RECEIPT_SHA,FAILED_ARCHIVE,FAILED_ARCHIVE_SHA,assertFailedCleanup,assertFailedArchive } from './sources.mjs';
import { compileGate36,EXECUTION_ENABLED } from './controller.mjs';
import { assertPins,injectQueries,stripCapture,createGate36Runtime,TAG,PHASES } from './runtime.mjs';
import { renderAttempt36Wire,MARKERS,ROLLED_BACK } from '../job-attempt-observability36-proof/runtime.mjs';
import { sha } from '../recovery33/compiler.mjs';
import { executionEnvironment,verifyPrepared } from './run.mjs';
const sources=await loadSources(),text=file=>sources.get(file).toString('utf8');
const runId='12345678-1234-4234-8234-123456789abc';
const identity={database:'eps_m07_r33_source_'+runId.replaceAll('-',''),marker:`eps-m07-recovery33:${runId}:source`,oid:12345};
const pins=Object.fromEntries([...sources].slice(0,186).map(([file,bytes])=>[file,sha(bytes)]));
const captures=()=>PHASES.map(phase=>({[TAG]:phase,value:{synthetic:true},atomic_o:phase==='before'?null:phase==='after'||phase==='restored',atomic_d:phase==='before'?null:phase==='disabled'}));
const output=()=>captures().map(v=>JSON.stringify(v)+'\r\n').join('')+MARKERS.join('\n')+'\n'+JSON.stringify(ROLLED_BACK)+'\n';
function queries(){return {before:'select null::jsonb',after:'select null::jsonb',phases:PHASES,source_pins:pins,
 before_capture_sql:'-- SYNTHETIC BEFORE QUERY\n',after_candidate_sql:'-- SYNTHETIC AFTER/NEGATIVE QUERIES\n'};}

test('actual7cff185-source proof and every original cleanup boundary are mandatory',()=>{
 const previous=JSON.parse(text(PRIOR_RECEIPT));assert.equal(sha(sources.get(PRIOR_RECEIPT)),PRIOR_RECEIPT_SHA);assertPriorProof(previous);
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.throws(()=>assertPriorProof({...previous,[key]:false}));
 for(const patch of [{result:'failed'},{cleanup_unconfirmed:true},{provider_called:true},{source_seals:{}},
  {attempt36_sql:{...previous.attempt36_sql,ddl_data_catalogue_rolled_back:false}}])assert.throws(()=>assertPriorProof({...previous,...patch}));
 const frozen=JSON.parse(text(PURPOSE+'frozen-inputs.json'));
 for(const[file,digest]of Object.entries(previous.source_seals))assert.equal(frozen[file],digest);
 assert.equal(Object.keys(previous.source_seals).length,185);
});

test('failed207 cleanup and exact229/44-byte archive are mandatory before a fresh purpose',()=>{
 const failed=JSON.parse(text(FAILED_RECEIPT)),archive=JSON.parse(text(FAILED_ARCHIVE)),prior=JSON.parse(text(PRIOR_RECEIPT));
 assert.equal(sha(sources.get(FAILED_RECEIPT)),FAILED_RECEIPT_SHA);assert.equal(sha(sources.get(FAILED_ARCHIVE)),FAILED_ARCHIVE_SHA);
 assertFailedCleanup(failed);assertFailedArchive(archive,failed,prior);
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.throws(()=>assertFailedCleanup({...failed,[key]:false}));
 for(const patch of [{result:'passed'},{cleanup_unconfirmed:true},{provider_called:true},{source_seals:{}},
  {attempt36_gate_sql:{result:'passed'}},{actual_disposable_database_absence:{...failed.actual_disposable_database_absence,eps_m07_r33_source_207731a684624eec8d27f2fc8f34f2fd:true}}])assert.throws(()=>assertFailedCleanup({...failed,...patch}));
 const missing=structuredClone(archive);missing.new44_exact_byte_sources.pop();assert.throws(()=>assertFailedArchive(missing,failed,prior));
 const altered=structuredClone(archive);altered.new44_exact_byte_sources[0].base64='dGFtcGVyZWQ=';assert.throws(()=>assertFailedArchive(altered,failed,prior));
 const falseFlag=structuredClone(archive),controller=falseFlag.new44_exact_byte_sources.find(v=>v.path===PURPOSE+'controller.mjs');
 assert(Buffer.from(controller.base64,'base64').toString('utf8').includes('export const EXECUTION_ENABLED=true;'));
 controller.base64=Buffer.from('export const EXECUTION_ENABLED=false;').toString('base64');assert.throws(()=>assertFailedArchive(falseFlag,failed,prior));
 for(const runId of [failed.run_id,prior.run_id])assert.throws(()=>compileGate36(sources,{root:ROOT,runId}));
});

test('compiler changes only new runtime/purpose/gate and retains original29/global roles/cleanup lock',()=>{
 const compiled=compileGate36(sources,{root:ROOT,runId}),code=compiled.source;
 assert.equal(compiled.manifest.execution_enabled,EXECUTION_ENABLED);assert.equal(typeof EXECUTION_ENABLED,'boolean');
 assert(code.indexOf('ATTEMPT36_GATE_ROOT_REVIEW_REQUIRED')<code.indexOf('await createDatabase(sourceDb)'));
 for(const token of ['await recovery33.upgrade();','await runGate36({','await recovery33.cleanupRoles()',
  'original29_full_catalogue_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released',
  "'tracking/evidence/m07/job-attempt-observability36-gate-proof'","'.local/m07-attempt36-gate-tests'",'ATTEMPT36_GATE_PREPARED_SOURCE_CHANGED'])assert(code.includes(token),token);
 assert(!code.includes('await runAttempt36({'));assert(!code.includes('await recovery33.metadataRestore();'));
 assert.equal(compiled.manifest.generated_source_sha256,sha(code));assert.equal(compiled.manifest.database_executed,false);
});

test('old185 and new query/helper/receipt drift prevent controller output',()=>{
 for(const file of [PRIOR_RECEIPT,'development/m07/job-attempt-observability36-proof/runtime.mjs',
  'development/m07/job-attempt-observability36-release/state.py','development/m07/job-attempt-observability36-release/schema_gate.py',
  'development/m07/job-attempt-observability36-release/catalogue_delta.py']){
  const changed=new Map(sources);changed.set(file,Buffer.from('drift'));assert.throws(()=>compileGate36(changed,{root:ROOT,runId}));
 }
});

test('SQL injection retains byte-exact candidate and all frozen fixtures/rollback around one exact seam',()=>{
 const old=renderAttempt36Wire(sources,identity),actual=injectQueries(old,queries());
 assert.equal(actual,old.body.replace(old.candidate.sql,()=>queries().before_capture_sql+old.candidate.sql+'\n'+queries().after_candidate_sql));
 assert(actual.indexOf('SYNTHETIC BEFORE QUERY')<actual.indexOf(old.candidate.sql));
 assert(actual.indexOf('SYNTHETIC AFTER/NEGATIVE QUERIES')>actual.indexOf(old.candidate.sql));
 assert(actual.indexOf('SYNTHETIC AFTER/NEGATIVE QUERIES')<actual.indexOf('savepoint attempt36_direct_fixture'));
 assert.throws(()=>injectQueries({...old,body:old.body+old.candidate.sql},queries()));
 assert.throws(()=>injectQueries(old,{...queries(),phases:['before','after']}));
});

test('only seven exact tagged JSON lines are removed; original observations stay byte-identical',()=>{
 const retained=MARKERS.join('\n')+'\n'+JSON.stringify(ROLLED_BACK)+'\n',actual=stripCapture(output());
 assert.equal(actual.stdout,retained);assert.deepEqual(Object.keys(actual.captured),PHASES);
 for(const rows of [captures().slice(1),captures().concat(captures()[0]),captures().reverse(),captures().map(v=>({...v,extra:true})),
  captures().map(v=>v[TAG]==='after'?{...v,[TAG]:'unknown'}:v)])assert.throws(()=>stripCapture(rows.map(JSON.stringify).join('\n')));
});

test('query-produced pins must match the actual complete admitted source map',()=>{
 assertPins(pins,sources);assert.throws(()=>assertPins({},sources));
 const changed={...pins};changed[Object.keys(changed)[0]]='0'.repeat(64);assert.throws(()=>assertPins(changed,sources));
 assert.throws(()=>assertPins({...pins,'outside.py':'0'.repeat(64)},sources));
});

test('whole synthetic hook dispatches only injected wire once, validates capture, then preserves frozen rollback proof',async()=>{
 const writes=[],events=[],history={versions:Array.from({length:32},(_,i)=>String(i)).concat('20261031130207')};
 const report={private_artifact_acl:process.platform==='win32'?'current-user-and-SYSTEM-only-verified':'mode0700',actual_local_migrations_executed:['SYNTHETIC']};
 const io={readFile:async file=>sources.get(path.relative(ROOT,file).replaceAll('\\','/')),
  writeFile:async(file,_body,options)=>{assert.equal(options.flag,'wx');assert.equal(options.mode,0o600);writes.push(path.basename(file));},
  runPython:async(_root,action,values)=>{
   events.push(action);if(action==='queries')return queries();assert.deepEqual(Object.keys(values),PHASES);
   return {result:'passed',query_source_pins:pins,local_metadata_only:true,canonical_business_writes:false,cloud_called:false,provider_called:false,hosted_acceptance:false,
    schema_template:{synthetic:true},claim_ports:{synthetic:true}};
  }};
 const ctx={root:ROOT,sourceDb:identity.database,sourceFiles:sources,report,privateRoot:path.join(ROOT,'.local/SYNTHETIC'),marker:()=>identity.marker,
  databaseIdentity:async()=>({oid:identity.oid}),catalogue:async()=>({synthetic:true}),value:async(_db,sql)=>sql.includes("jsonb_build_object('versions'")?history:{synthetic:true},
  sql:async(_db,sql)=>{events.push('sql');assert(sql.includes('SYNTHETIC BEFORE QUERY'));assert(sql.includes('SYNTHETIC AFTER/NEGATIVE QUERIES'));return {stdout:output()};},
  rows:stdout=>stdout.split('\n').filter(v=>v.startsWith('{')).map(JSON.parse)};
 await createGate36Runtime(io)(ctx);assert.deepEqual(events,['queries','sql','validate']);
 assert.deepEqual(writes,['attempt36-owned-test-wire.sql','attempt36-gates-actual-wire.sql','attempt36-gates-metadata-private.json']);
 assert.equal(report.attempt36_sql.result,'passed');assert.equal(report.attempt36_gate_sql.result,'passed');assert.equal(report.attempt36_gate_sql.hosted_acceptance,false);
 const badIo={...io,runPython:async()=>({...queries(),source_pins:{...pins,missing:'0'.repeat(64)}})};
 await assert.rejects(()=>createGate36Runtime(badIo)(ctx));assert.deepEqual(events,['queries','sql','validate']);
});

test('prepare/once-only execution seals all bytes before a permanent claim with no automatic replay',()=>{
 const compiled=compileGate36(sources,{root:ROOT,runId});
 if(EXECUTION_ENABLED)assert.doesNotThrow(()=>verifyPrepared(compiled,compiled.manifest,Buffer.from(compiled.source),runId));
 else assert.throws(()=>verifyPrepared(compiled,compiled.manifest,Buffer.from(compiled.source),runId));
 const operator=text(PURPOSE+'run.mjs');assert(operator.indexOf('verifyPrepared(compiled,manifest')<operator.indexOf("'execution-claim.json'"));
 assert(operator.indexOf("'execution-claim.json'")<operator.indexOf('const child=spawn('));assert(operator.includes('normal_process_return_observed:typeof code'));
 assert(!operator.includes('unlink('));assert(!operator.includes('...process.env'));
 assert.deepEqual(executionEnvironment({PATH:'synthetic',DEBUG:'private',NODE_OPTIONS:'private',DATABASE_URL:'private'}),{NODE_ENV:'test',PATH:'synthetic'});
});
