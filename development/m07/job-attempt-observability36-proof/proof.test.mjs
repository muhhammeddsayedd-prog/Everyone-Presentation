import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadSources,ROOT,PURPOSE,PRIOR_RECEIPT,PRIOR_RECEIPT_SHA,assertPriorProof } from './sources.mjs';
import { compileAttempt36,ownedTrace36,CANDIDATE,DIRECT_FIXTURE,EXECUTION_ENABLED } from './controller.mjs';
import { renderAttempt36Wire,verifyObservation,createAttempt36Runtime,MARKERS,ROLLED_BACK } from './runtime.mjs';
import { ownedPredicate33 } from '../recovery33/ownership.mjs';
import { sha } from '../recovery33/compiler.mjs';
import { executionEnvironment,verifyPrepared } from './run.mjs';

const runId='12345678-1234-4234-8234-123456789abc';
const identity={database:'eps_m07_r33_source_'+runId.replaceAll('-',''),marker:`eps-m07-recovery33:${runId}:source`,oid:12345};
const sources=await loadSources(),text=file=>sources.get(file).toString('utf8');

test('prior passed proof requires exact169 sources plus complete preservation/cleanup admission',()=>{
 const previous=JSON.parse(text(PRIOR_RECEIPT));assert.equal(sha(sources.get(PRIOR_RECEIPT)),PRIOR_RECEIPT_SHA);assert.doesNotThrow(()=>assertPriorProof(previous));
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.throws(()=>assertPriorProof({...previous,[key]:false}));
 for(const patch of [{result:'failed'},{checkpoint:'incomplete'},{provider_called:true},{cleanup_unconfirmed:true},{source_seals:{}},
  {actual_disposable_database_absence:{...previous.actual_disposable_database_absence,eps_m07_r33_source_ef4cb6c23f4a4869a71ad747f1db99ca:true}},
  {summary35_sql:{...previous.summary35_sql,ddl_data_catalogue_rolled_back:false}}])assert.throws(()=>assertPriorProof({...previous,...patch}));
 const pins=JSON.parse(text(PURPOSE+'frozen-inputs.json'));
 for(const[file,digest]of Object.entries(previous.source_seals))assert.equal(pins[file],digest);
 assert.equal(sha(sources.get('development/m07/workspace-summary35-proof/frozen-inputs.json')),'0f4282d921c5ae790a7c3b833a9bb25cd4c02e65bc274464bc8d8c29326c5df9');
});

test('candidate and direct fixture change only one database-name admission to exact owned identity',()=>{
 const parts=ownedTrace36(sources,identity);
 for(const [part,file]of [[parts.candidate,CANDIDATE],[parts.direct,DIRECT_FIXTURE]]){
  const original=text(file);assert.equal(part.sql,original.replace("current_database()<>'postgres'",'('+ownedPredicate33(identity)+')'));
  assert.equal(part.sql.slice(part.sql.indexOf('end$$;')+7),original.slice(original.indexOf('end$$;')+7));
 }
 assert.throws(()=>ownedTrace36(sources,{...identity,database:'postgres'}));assert.throws(()=>ownedTrace36(sources,{...identity,oid:0}));
});

test('one wire stages actual34/35 histories then candidate/direct and real service fixtures before full rollback',()=>{
 const wire=renderAttempt36Wire(sources,identity),sql=wire.body;
 const order=['savepoint attempt36_source_proof','create function eps.english_transcript_text_valid',"values('20261031143711')",
  'create function public.eps_get_workspace_summary',"values('20261031182038')",'create table eps.job_stage_attempts',
  'savepoint attempt36_direct_fixture',MARKERS[0],'rollback to savepoint attempt36_direct_fixture','M04_FIXTURE_NAMESPACE_OCCUPIED',
  'Synthetic recovery33 client','m05-selection','attempt36-generate-version',MARKERS[1],'rollback to savepoint attempt36_source_proof'];
 let previous=-1;for(const marker of order){const at=sql.indexOf(marker);assert(at>previous,marker);previous=at;}
 assert.equal((sql.match(/insert into supabase_migrations\.schema_migrations/gu)||[]).length,2);
 assert(!sql.includes("values('36')"));assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(sql));
 assert(!/\b(?:create|drop|alter)\s+database\b/iu.test(sql));assert(!/alter table auth\./iu.test(sql));
 assert(sql.includes("'trace_role_absent',not exists(select 1 from pg_roles where rolname='eps_job_trace_owner')"));
});

test('real routine fixture retains current claim, callback, manual budget reset and stale-attempt semantics',()=>{
 const fixture=text(PURPOSE+'service-fixture.sql');
 for(const required of ['public.eps_generate_version','eps.claim_job_stage_replay','eps.get_specs_stage_input','eps.record_job_event',
  'public.eps_retry_job','presentation-preparation.v1','PDF_BUDGET_EXCEEDED','ATTEMPT36_REAL_RETRY_STAGE_RESET_REQUIRED',
  'ATTEMPT36_OLD_ATTEMPT_FENCE_FAILED','IDEMPOTENCY_KEY_REUSED','array[1,2,3]','array[1,1,1]',
  "a.job_id=e.job_id and a.attempt_id=e.attempt_id",'synthetic-attempt36-render-first','synthetic-attempt36-render-retry'])assert(fixture.includes(required),required);
 assert(!/\b(?:insert|update|delete)\s+(?:into\s+)?eps\.job_stage_attempts\b/iu.test(fixture));
 assert(!fixture.includes('reserve_job_output'));assert(!fixture.includes('set local role service_role'));
});

test('SQL success assertions reject missing required JSON fields and null aggregates',()=>{
 const fixture=text(PURPOSE+'service-fixture.sql');
 for(const required of ["jsonb_typeof(ack) is distinct from 'object'","jsonb_typeof(lease) is distinct from 'object'",
  "receipt->'applied' is distinct from 'true'::jsonb","receipt->'stale' is distinct from 'false'::jsonb",
  "receipt->>'job_status' is distinct from 'failed'","job->'can_retry' is distinct from 'true'::jsonb",
  "job#>>'{error,code}' is distinct from 'PDF_BUDGET_EXCEEDED'","job#>'{error,details}' is distinct from '{}'::jsonb",
  'is distinct from array[1,2,3]','is distinct from array[1,1,1]'])assert(fixture.includes(required),required);
 assert(!/(?:receipt|job)(?:->>|->|#>>|#>)[^\n]*?<>/u.test(fixture));
});

test('new compiler retains owned target/role/cleanup/shared-lock guards and gates before target access',()=>{
 const compiled=compileAttempt36(sources,{root:ROOT,runId}),sql=compiled.source;
 assert.equal(compiled.manifest.execution_enabled,EXECUTION_ENABLED);assert.equal(typeof EXECUTION_ENABLED,'boolean');
 assert(sql.includes(`if(!${EXECUTION_ENABLED})throw Error('ATTEMPT36_ROOT_REVIEW_REQUIRED')`));assert(sql.indexOf('ATTEMPT36_ROOT_REVIEW_REQUIRED')<sql.indexOf('await createDatabase(sourceDb)'));
 for(const token of ['await recovery33.upgrade();','await runAttempt36({','await recovery33.cleanupRoles()',
  'original_local_database_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released',
  "'tracking/evidence/m07/job-attempt-observability36-proof'","'.local/m07-attempt36-tests'",'ATTEMPT36_PREPARED_SOURCE_CHANGED'])assert(sql.includes(token),token);
 assert(!sql.includes('await runSummary35({'));assert(!sql.includes('await recovery33.metadataRestore();'));
 assert.equal(compiled.manifest.generated_source_sha256,sha(sql));assert.equal(compiled.manifest.database_executed,false);
});

test('frozen169, new candidate and passed receipt drift fail before a controller is emitted',()=>{
 for(const file of [CANDIDATE,DIRECT_FIXTURE,PRIOR_RECEIPT,'development/m07/workspace-summary35-proof/controller.mjs',
  'development/m07/workspace-summary35-proof/frozen-inputs.json','supabase/migrations/20261031182038_m07_workspace_summary.sql']){
  const bad=new Map(sources);bad.set(file,Buffer.from('tampered'));assert.throws(()=>compileAttempt36(bad,{root:ROOT,runId}));
 }
});

test('observation accepts only both actual fixture markers plus every rollback/role preservation fact',()=>{
 const rows=stdout=>stdout.split('\n').filter(line=>line.startsWith('{')).map(JSON.parse),output=MARKERS.join('\n')+'\n'+JSON.stringify(ROLLED_BACK);
 const before={catalogue:{fixed:'synthetic'},data:{fixed:'synthetic'},history:{versions:['synthetic']}};
 assert.deepEqual(verifyObservation(output,rows,before,structuredClone(before)),MARKERS);
 for(const key of ['catalogue','data','history'])assert.throws(()=>verifyObservation(output,rows,before,{...before,[key]:{drift:true}}));
 for(const key of Object.keys(ROLLED_BACK))assert.throws(()=>verifyObservation(MARKERS.join('\n')+'\n'+JSON.stringify({...ROLLED_BACK,[key]:key==='history_count'?35:false}),rows,before,before));
 assert.throws(()=>verifyObservation(MARKERS[0]+'\n'+JSON.stringify(ROLLED_BACK),rows,before,before));
});

test('complete runtime with synthetic IO writes one protected wire, dispatches once and verifies actual rollback',async()=>{
 const events=[],history={versions:Array.from({length:32},(_,i)=>String(i)).concat('20261031130207')};
 const output=MARKERS.join('\n')+'\n'+JSON.stringify(ROLLED_BACK),report={private_artifact_acl:process.platform==='win32'?'current-user-and-SYSTEM-only-verified':'mode0700',actual_local_migrations_executed:['SYNTHETIC']};
 const hook=createAttempt36Runtime({readFile:async file=>sources.get(path.relative(ROOT,file).replaceAll('\\','/')),
  writeFile:async(file,wire,options)=>{assert.equal(path.basename(file),'attempt36-owned-test-wire.sql');assert.equal(options.flag,'wx');assert.equal(options.mode,0o600);assert(wire.includes('savepoint attempt36_source_proof'));events.push('wire');}});
 const ctx={root:ROOT,sourceDb:identity.database,sourceFiles:sources,report,privateRoot:path.join(ROOT,'.local/SYNTHETIC'),marker:()=>identity.marker,
  databaseIdentity:async()=>({oid:identity.oid}),catalogue:async()=>({fixed:'synthetic'}),
  value:async(_db,body)=>body.includes("jsonb_build_object('versions'")?history:{fixed:'synthetic'},
  sql:async()=>{events.push('sql');return {stdout:output};},rows:stdout=>stdout.split('\n').filter(line=>line.startsWith('{')).map(JSON.parse)};
 await hook(ctx);assert.deepEqual(events,['wire','sql']);assert.equal(report.attempt36_sql.result,'passed');assert.equal(report.attempt36_sql.trace_role_rolled_back,true);
 for(const bad of [true,false,'unverified'])await assert.rejects(()=>hook({...ctx,report:{private_artifact_acl:bad}}));
 assert.deepEqual(events,['wire','sql']);
});

test('new operator dispatch needs fresh exact source preparation and creates permanent claim before spawning',()=>{
 const compiled=compileAttempt36(sources,{root:ROOT,runId});
 if(EXECUTION_ENABLED)assert.doesNotThrow(()=>verifyPrepared(compiled,compiled.manifest,Buffer.from(compiled.source),runId));
 else assert.throws(()=>verifyPrepared(compiled,compiled.manifest,Buffer.from(compiled.source),runId));
 const enabled={...compiled,manifest:{...compiled.manifest,execution_enabled:true}};assert.doesNotThrow(()=>verifyPrepared(enabled,enabled.manifest,Buffer.from(compiled.source),runId));
 assert.throws(()=>verifyPrepared(enabled,{...enabled.manifest,generated_source_sha256:'drift'},Buffer.from(compiled.source),runId));
 assert.throws(()=>verifyPrepared(enabled,enabled.manifest,Buffer.from('drift'),runId));
 const operator=text(PURPOSE+'run.mjs');assert(operator.indexOf('assert(EXECUTION_ENABLED')<operator.indexOf("'execution-claim.json'"));
 assert(operator.indexOf('verifyPrepared(compiled,manifest')<operator.indexOf("'execution-claim.json'"));assert(operator.indexOf("'execution-claim.json'")<operator.indexOf('const child=spawn('));
 assert(operator.includes("flag:'wx',mode:0o600"));assert(operator.includes("normal_process_return_observed:typeof code==='number'"));
 assert(!operator.includes('unlink('));assert(!operator.includes('...process.env'));
 assert.deepEqual(executionEnvironment({PATH:'synthetic',DEBUG:'secret',OPENAI_API_KEY:'secret',NODE_OPTIONS:'secret',DATABASE_URL:'secret'}),{NODE_ENV:'test',PATH:'synthetic'});
});
