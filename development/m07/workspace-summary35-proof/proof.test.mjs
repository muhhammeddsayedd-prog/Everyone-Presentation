import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadSources, ROOT, PRIOR_RECEIPT, assertPriorCleanupState, EXECUTED_3304_SOURCES, PURPOSE } from './sources.mjs';
import { compileSummary35, ownedSummary35, fixtureSavepoint35, MIGRATION35, FIXTURE35, EXECUTION_ENABLED } from './controller.mjs';
import { renderSummary35Wire, verifySummary35Observation, createSummary35Runtime } from './runtime.mjs';
import { MIGRATION34 } from '../../m03/english-transcript34/controller.mjs';
import { ownedPredicate33 } from '../recovery33/ownership.mjs';
import { sha } from '../recovery33/compiler.mjs';
import { executionEnvironment, verifyPrepared } from './run.mjs';

const runId='12345678-1234-4234-8234-123456789abc';
const identity={database:'eps_m07_r33_source_'+runId.replaceAll('-',''),marker:`eps-m07-recovery33:${runId}:source`,oid:12345};
const sources=await loadSources();
const text=file=>sources.get(file).toString('utf8');

test('actual canonical35 uses only exact owned admission; all functional DDL and permissions stay byte exact',()=>{
 const adapted=ownedSummary35(sources,identity),original=text(MIGRATION35);
 assert.equal(adapted.sql,original.replace("current_database() <> 'postgres'",'('+ownedPredicate33(identity)+')'));
 assert.equal(adapted.sql.split('end$$;')[1],original.split('end$$;')[1]);
 assert(adapted.sql.includes("grant execute on function public.eps_get_workspace_summary(uuid) to authenticated"));
 assert(adapted.sql.includes("eps.require_capability('workspaces.read')"));
 assert(adapted.sql.includes('eps.review_require(p_workspace_id, false)'));
 assert(adapted.sql.includes("has_schema_privilege('eps_review_owner', 'public', 'CREATE')"));
 assert.throws(()=>ownedSummary35(sources,{...identity,database:'postgres'}));
 assert.throws(()=>ownedSummary35(sources,{...identity,oid:0}));
});

test('fixture adapter changes exactly its outer transaction fence and preserves every assertion',()=>{
 const original=text(FIXTURE35),adapted=fixtureSavepoint35(sources);
 assert.equal(adapted,original.replace('\nbegin;\n','\nsavepoint summary35_fixture;\n')
  .replace('\nrollback;\n','\nrollback to savepoint summary35_fixture;release savepoint summary35_fixture;\n'));
 assert(adapted.includes('rollback to summary_series_budget'));
 assert(adapted.includes('rollback to summary_invalid_pointer'));
 assert(adapted.includes("set local role service_role;"));
});

test('wire executes actual34 before ephemeral history34, then actual35/fixture and full rollback',()=>{
 const wire=renderSummary35Wire(sources,identity);
 assert(wire.body.indexOf('create function eps.english_transcript_text_valid')<wire.body.indexOf('insert into supabase_migrations.schema_migrations'));
 assert(wire.body.indexOf('insert into supabase_migrations.schema_migrations')<wire.body.indexOf('create function public.eps_get_workspace_summary'));
 assert(wire.body.indexOf('create function public.eps_get_workspace_summary')<wire.body.indexOf('savepoint summary35_fixture'));
 assert(wire.body.includes('rollback to savepoint summary35_source_proof;release savepoint summary35_source_proof;'));
 assert.equal((wire.body.match(/insert into supabase_migrations\.schema_migrations/gu)||[]).length,1);
 assert(wire.body.includes("values('20261031143711')"));
 assert(!wire.body.includes("values('20261031182038')"));
 assert(!/^\s*(?:begin|commit|rollback)\s*;/imu.test(wire.body));
 assert(!/\b(?:create|drop|alter)\s+database\b/iu.test(wire.body));
 assert(!/alter table auth\./iu.test(wire.body));
 assert(wire.body.includes('SUMMARY35_FIXTURE_ASSERTIONS_PASSED_SYNTHETIC_ONLY'));
 assert.equal(wire.actual34_sha256,sha(sources.get(MIGRATION34)));
});

test('compiler retains frozen actual30-33, original29/global-role/lock cleanup and root-owned execution gate',()=>{
 const compiled=compileSummary35(sources,{root:ROOT,runId});
 assert.equal(typeof EXECUTION_ENABLED,'boolean');assert.equal(compiled.manifest.execution_enabled,EXECUTION_ENABLED);
 assert(compiled.source.includes(`if(!${EXECUTION_ENABLED})throw Error('SUMMARY35_ROOT_REVIEW_REQUIRED')`));
 assert(compiled.source.includes('await recovery33.upgrade();'));
 assert(compiled.source.includes('await runSummary35('));assert(!compiled.source.includes('await runEnglish34('));
 assert(!compiled.source.includes('await recovery33.metadataRestore();'));
 for(const token of ['if (false) {','await recovery33.cleanupRoles()','existing_global_role_oids_attributes_memberships_unchanged',
  'original_local_database_unchanged','shared_test_lock_released'])assert(compiled.source.includes(token),token);
 assert(text('development/m07/recovery33/runtime.mjs').includes('report.original29_full_auth_storage_catalogue_unchanged = true'));
 assert(compiled.source.indexOf('SUMMARY35_PREPARED_SOURCE_CHANGED')<compiled.source.indexOf('await createDatabase(sourceDb)'));
 assert(compiled.source.includes("'tracking/evidence/m07/workspace-summary35-proof'"));
 assert(!compiled.source.includes("'.local/m03-english34-tests'"));
 assert.equal(compiled.manifest.database_executed,false);
 assert.equal(compiled.manifest.generated_source_sha256,sha(compiled.source));
 assert.equal(path.isAbsolute(ROOT),true);
});

test('canonical35, fixture and frozen source drift fail before a controller can be emitted',()=>{
 for(const file of [MIGRATION35,FIXTURE35,'development/m03/english-transcript34/controller.mjs']){
  const bad=new Map(sources);bad.set(file,Buffer.from('tampered'));
  assert.throws(()=>compileSummary35(bad,{root:ROOT,runId}));
 }
});

test('failed3304 is preserved and its exact completed cleanup is mandatory before a fresh controller',()=>{
 const actual=JSON.parse(text(PRIOR_RECEIPT));assert.doesNotThrow(()=>assertPriorCleanupState(actual));
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged','original29_full_catalogue_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged',
  'existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])
  assert.throws(()=>assertPriorCleanupState({...actual,[key]:false}));
 for(const patch of [{result:'passed'},{cleanup_unconfirmed:true},{provider_called:true},{summary35_sql:{result:'passed'}},
  {actual_disposable_database_absence:{...actual.actual_disposable_database_absence,eps_m07_r33_source_3304bf0631954782944b8b2efc2cc480:true}}])
  assert.throws(()=>assertPriorCleanupState({...actual,...patch}));
 const missing=new Map(sources);missing.delete(PRIOR_RECEIPT);assert.throws(()=>compileSummary35(missing,{root:ROOT,runId}));
 for(const[file,digest]of Object.entries(EXECUTED_3304_SOURCES))assert.equal(sha(sources.get(PURPOSE+'source-history/'+digest+'-'+path.basename(file)+'.txt')),digest);
 const bad=new Map(sources),[file,digest]=Object.entries(EXECUTED_3304_SOURCES)[0];
 bad.set(PURPOSE+'source-history/'+digest+'-'+path.basename(file)+'.txt',Buffer.from('forged'));
 assert.throws(()=>compileSummary35(bad,{root:ROOT,runId}));
});

test('observation gate requires fixture completion plus full history/data/catalogue rollback',()=>{
 const rows=stdout=>stdout.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line));
 const observation={summary35_transaction_rolled_back:true,history_count:33,english_table_absent:true,summary_function_absent:true};
 const output='SUMMARY35_FIXTURE_ASSERTIONS_PASSED_SYNTHETIC_ONLY\n'+JSON.stringify(observation);
 const before={catalogue:{value:'SYNTHETIC_UNCHANGED'},data:{value:'SYNTHETIC_UNCHANGED'},history:{versions:['SYNTHETIC_HISTORY33']}};
 assert.deepEqual(verifySummary35Observation(output,rows,before,structuredClone(before)),['SUMMARY35_FIXTURE_ASSERTIONS_PASSED_SYNTHETIC_ONLY']);
 for(const key of ['catalogue','data','history'])assert.throws(()=>verifySummary35Observation(output,rows,before,{...before,[key]:{changed:true}}));
 for(const patch of [{history_count:34},{english_table_absent:false},{summary_function_absent:false}])
  assert.throws(()=>verifySummary35Observation('SUMMARY35_FIXTURE_ASSERTIONS_PASSED_SYNTHETIC_ONLY\n'+JSON.stringify({...observation,...patch}),rows,before,before));
 assert.throws(()=>verifySummary35Observation(JSON.stringify(observation),rows,before,before));
});

test('complete runtime hook requires inherited exact artifact ACL before one SQL call and verifies rollback',async()=>{
 const events=[],history={versions:Array.from({length:32},(_,i)=>String(i)).concat('20261031130207')};
 const report={private_artifact_acl:process.platform==='win32'?'current-user-and-SYSTEM-only-verified':'mode0700',actual_local_migrations_executed:['SYNTHETIC_PRIOR_HISTORY']};
 const output='SUMMARY35_FIXTURE_ASSERTIONS_PASSED_SYNTHETIC_ONLY\n'+JSON.stringify({summary35_transaction_rolled_back:true,history_count:33,english_table_absent:true,summary_function_absent:true});
 const hook=createSummary35Runtime({readFile:async file=>{const relative=path.relative(ROOT,file).replaceAll('\\','/');assert(sources.has(relative));return sources.get(relative);},
  writeFile:async(file,wire,options)=>{assert.equal(file,path.join(ROOT,'.local/SYNTHETIC/summary35-owned-test-wire.sql'));assert.equal(options.flag,'wx');assert.equal(options.mode,0o600);assert(wire.includes('savepoint summary35_source_proof'));events.push('wire');}});
 const ctx={root:ROOT,runId,sourceDb:identity.database,sourceFiles:sources,report,privateRoot:path.join(ROOT,'.local/SYNTHETIC'),
  marker:()=>identity.marker,databaseIdentity:async()=>({oid:identity.oid}),catalogue:async()=>({catalogue:'SYNTHETIC_UNCHANGED'}),
  value:async(_db,body)=>body.includes("jsonb_build_object('versions'")?history:{data:'SYNTHETIC_UNCHANGED'},
  sql:async()=>{events.push('sql');return {stdout:output};},rows:stdout=>stdout.split('\n').filter(line=>line.startsWith('{')).map(line=>JSON.parse(line))};
 await hook(ctx);assert.deepEqual(events,['wire','sql']);assert.equal(report.summary35_sql.result,'passed');
 assert.equal(report.summary35_sql.history34_row_ephemeral,true);assert.equal(report.summary35_sql.persistent_history_count,33);
 for(const invalid of [true,false,'unverified'])await assert.rejects(()=>hook({...ctx,report:{private_artifact_acl:invalid}}));
 assert.deepEqual(events,['wire','sql']);
});

test('operator dispatch requires enabled exact fresh sources, immutable preparation and permanent once claim',()=>{
 const compiled=compileSummary35(sources,{root:ROOT,runId}),manifest=compiled.manifest;
 if(EXECUTION_ENABLED)assert.doesNotThrow(()=>verifyPrepared(compiled,manifest,Buffer.from(compiled.source),runId));
 else assert.throws(()=>verifyPrepared(compiled,manifest,Buffer.from(compiled.source),runId),/SUMMARY35_EXECUTION_NOT_ENABLED/u);
 const enabled={...compiled,manifest:{...manifest,execution_enabled:true}};
 assert.doesNotThrow(()=>verifyPrepared(enabled,enabled.manifest,Buffer.from(compiled.source),runId));
 assert.throws(()=>verifyPrepared(enabled,{...enabled.manifest,generated_source_sha256:'forged'},Buffer.from(compiled.source),runId));
 assert.throws(()=>verifyPrepared(enabled,enabled.manifest,Buffer.from('forged'),runId));
 assert.throws(()=>verifyPrepared(enabled,enabled.manifest,Buffer.from(compiled.source),'00000000-0000-4000-8000-000000000000'));
 const operator=text('development/m07/workspace-summary35-proof/run.mjs');
 assert(operator.indexOf("assert(EXECUTION_ENABLED,'SUMMARY35_ROOT_REVIEW_REQUIRED')")<operator.indexOf("'execution-claim.json'"));
 assert(operator.indexOf('verifyPrepared(compiled,manifest')<operator.indexOf("'execution-claim.json'"));
 assert(operator.indexOf("'execution-claim.json'")<operator.indexOf('const child=spawn('));
 assert(operator.includes("flag:'wx',mode:0o600"));assert(operator.includes("'execution-returned.json'"));
 assert(operator.includes("normal_process_return_observed:typeof code==='number'"));
 assert(!operator.includes('...process.env'));assert(!operator.includes('unlink('));
 assert.deepEqual(executionEnvironment({PATH:'synthetic',SystemRoot:'synthetic',DEBUG:'PRIVATE',OPENAI_API_KEY:'PRIVATE',DATABASE_URL:'PRIVATE',NODE_OPTIONS:'PRIVATE'}),
  {NODE_ENV:'test',PATH:'synthetic',SystemRoot:'synthetic'});
});
