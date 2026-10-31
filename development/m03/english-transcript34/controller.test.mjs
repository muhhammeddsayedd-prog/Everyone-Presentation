import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { URL } from 'node:url';
import { compileEnglish34,ownedSql34,FILES34,FIXTURES34,MIGRATION34,EXECUTION_ENABLED } from './controller.mjs';
import { SOURCE_PINS,sha } from '../../m07/recovery33/compiler.mjs';
import { FILES33 } from '../../m07/recovery33/run.mjs';
import { ownedPredicate33 } from '../../m07/recovery33/ownership.mjs';
import { renderEnglish34Wire } from './runtime.mjs';
const root=path.resolve(import.meta.dirname,'../../..'),runId='12345678-1234-4234-8234-123456789abc';
const identity={database:'eps_m07_r33_source_'+runId.replaceAll('-',''),marker:`eps-m07-recovery33:${runId}:source`,oid:12345};
const pins=JSON.parse(await readFile(new URL('./recovery-source-pins.json',import.meta.url)));
const files=[...Object.keys(pins),...Object.keys(SOURCE_PINS),...FILES33,...FILES34,...FIXTURES34,MIGRATION34,'development/m03/english-transcript34/recovery-source-pins.json'];
const sources=new Map(await Promise.all([...new Set(files)].map(async file=>[file,await readFile(path.join(root,file))])));

test('controller keeps actual30-33 upgrade and exact parent cleanup after root releases its new run',()=>{
 const compiled=compileEnglish34(sources,{root,runId});
 assert.equal(EXECUTION_ENABLED,true);assert(compiled.source.includes("if(!true)throw Error('ENGLISH34_RECOVERY_DEPENDENCY_NOT_RELEASED')"));
 assert(compiled.source.includes('await recovery33.upgrade();'));
 assert(compiled.source.includes('await runEnglish34('));
 assert(!compiled.source.includes('await recovery33.metadataRestore();'));
 assert(compiled.source.includes('if (false) {'));
 assert(compiled.source.includes('await recovery33.cleanupRoles()'));
 assert(compiled.source.includes('development/m07/recovery33/retained533-profile.mjs'));
 assert(compiled.source.includes('recovery33?.profileEvidence()'));
 assert(compiled.source.includes('existing_global_role_oids_attributes_memberships_unchanged'));
 assert(compiled.source.includes('shared_test_lock_released'));
 assert(compiled.source.indexOf('ENGLISH34_PREPARED_SOURCE_CHANGED')<compiled.source.indexOf('await createDatabase(sourceDb)'));
 assert.equal(compiled.manifest.database_executed,false);assert.equal(compiled.manifest.history34_inserted,false);
 assert.equal(sha(compiled.source),compiled.manifest.generated_source_sha256);
});

test('migration34 adapter changes only owned admission, retaining all actual functional DDL',()=>{
 const result=ownedSql34(sources,identity),original=sources.get(MIGRATION34).toString('utf8');
 assert.equal(result.migration.split('end$english34_target$;')[1],original.split('end$english34_target$;')[1]);
 assert(result.migration.includes(ownedPredicate33(identity)));
 assert(result.migration.includes('20261031130207'));
 for(const text of Object.values(result.fragments))assert(text.includes(ownedPredicate33(identity)));
 assert(!result.migration.includes('insert into supabase_migrations'));
 assert.throws(()=>ownedSql34(sources,{...identity,database:'postgres'}));
 assert.throws(()=>ownedSql34(sources,{...identity,oid:0}));
});

test('current recovery helper pins are exact and changed frozen migration cannot compile',()=>{
 for(const[file,hash]of Object.entries(pins))assert.equal(sha(sources.get(file)),hash);
 assert.equal(pins['development/m07/recovery33/README.md'],'14c38dc2ba13acb7dc25170d5a8d08c8552d286243ebed1404b8f137c0bfa0f6');
 const tampered=new Map(sources);tampered.set('supabase/migrations/20261031130207_m07_oauth_consent_browser_context.sql',Buffer.from('untrusted'));
 assert.throws(()=>compileEnglish34(tampered,{root,runId}),/RECOVERY33_FROZEN_SOURCE_CHANGED/u);
});

test('runtime wires strict existing ordinary session before Generate and rolls back all34 DDL',()=>{
 const runtime=sources.get('development/m03/english-transcript34/runtime.mjs').toString('utf8');
 assert(runtime.includes('ctx.recovery33.seedSql()'));
 assert(runtime.includes('savepoint english34_source_proof;'));
 assert(runtime.includes('rollback to savepoint english34_source_proof'));
 assert(runtime.includes('ENGLISH34_CATALOGUE_ROLLBACK_UNCONFIRMED'));
 assert(runtime.includes('ENGLISH34_DATA_ROLLBACK_UNCONFIRMED'));
 assert(runtime.includes('ENGLISH34_MANAGED_AUTH_CHANGE_FORBIDDEN'));
 assert(!runtime.includes('alter table auth.users'));
});

test('actual rendered wire has fixed guard, existing native ordinary session, real Generate and rollback only',()=>{
 const wire=renderEnglish34Wire(sources,identity,sources.get('development/m07/recovery33/seed-auth.sql').toString('utf8')).body;
 assert(wire.includes(ownedPredicate33(identity)));
 assert(wire.indexOf('insert into auth.sessions')<wire.indexOf('create function pg_temp.t28_generate'));
 assert(wire.includes('public.eps_generate_version('));
 assert(wire.indexOf('eps.english34.old_versions')<wire.indexOf('create function eps.english_transcript_text_valid'));
 assert(wire.includes('english34_transaction_rolled_back'));
 assert(!/\bcommit\b/iu.test(wire));assert(!/insert into supabase_migrations/iu.test(wire));
 assert(!/alter table auth\./iu.test(wire));
});

test('operator execution requires pinned actual cleanup proof before once claim and clean dispatch',()=>{
 const source=sources.get('development/m03/english-transcript34/run.mjs').toString('utf8');
 assert(source.indexOf("assert(EXECUTION_ENABLED,'ENGLISH34_RECOVERY_DEPENDENCY_NOT_RELEASED')")<source.indexOf("'execution-claim.json'"));
 assert(source.includes("flag:'wx',mode:0o600"));assert(source.includes("const env={NODE_ENV:'test'}"));
 assert(!source.includes('...process.env'));assert(!source.includes('DATABASE_URL'));assert(!source.includes('OPENAI_API_KEY'));
 assert(source.includes('ENGLISH34_ACTUAL_CLEANUP_PROOF_REQUIRED'));
 assert(source.includes('2026-10-31T15-01-22.518Z-533-guarded-cleanup.json'));
});

test('dependency reseal leaves the actual passed English34 migration and functional SQL byte exact',async()=>{
 const bytes=await readFile(path.join(root,'tracking/evidence/m03/english-transcript34/2026-10-31T15-06-09-151Z-2982d338.json'));
 assert.equal(sha(bytes),'94061c4b8b58efecc2d10e1a890143dbb52ee96185fac1f80668e0cc0bde6bb2');
 const proof=JSON.parse(bytes);assert.equal(proof.result,'passed');assert.equal(proof.english34_sql.result,'passed');
 assert.equal(proof.run_id,'2982d338-d341-41b5-97e6-2cbef4eb2942');
 for(const key of ['disposable_databases_removed','new33_roles_removed','original_local_database_unchanged',
  'original29_full_auth_storage_catalogue_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert.equal(proof[key],true);
 for(const file of [MIGRATION34,...FIXTURES34,'development/m03/english-transcript34/runtime.mjs',
  ...['test-target.sql','before34.sql','validation-tests.sql','capture-tests.sql'].map(f=>'development/m03/english-transcript34/'+f)])
  assert.equal(sha(sources.get(file)),proof.source_seals[file],'Functional English34 SQL changed after its actual pass: '+file);
});
