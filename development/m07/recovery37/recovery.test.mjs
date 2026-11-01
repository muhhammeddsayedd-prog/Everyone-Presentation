/** Synthetic source/VM/parser tests only; no controller, private read or SQL. */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadSources,validateSources,compileRecovery37,adapters37,ROOT,EXECUTION_ENABLED,sha,PURPOSE,RECEIPTS} from './compiler.mjs';
import {safeRole37,traceCleanup37,correctionSql37,englishSql37,createRecovery37Context,admitNative37,validateExtra37,ENGLISH} from './runtime.mjs';
import {ownedPredicate33} from '../recovery33/ownership.mjs';
import {fullCatalogue33Sql} from '../recovery33/compiler.mjs';
import {COLUMNS} from '../recovery36-trace-acl-native/runtime.mjs';
const runId='73700000-0000-4000-8000-000000000001',suffix=runId.replaceAll('-','');
const sourceIdentity={database:'eps_m07_r33_source_'+suffix,oid:123,marker:`eps-m07-recovery33:${runId}:source`};
const restoreIdentity={database:'eps_m07_r33_restore_'+suffix,oid:124,marker:`eps-m07-recovery33:${runId}:restore`};
function role(){return{name:'eps_job_trace_owner',oid:'243387',marker:`eps-m07-recovery37:${runId}:trace`,login:false,super:false,inherit:false,bypassrls:false,create_role:false,create_db:false,replication:false,connection_limit:-1,valid_until:null,memberships:[{role:'eps_job_trace_owner',member:'postgres',grantor:'supabase_admin',admin:true,inherit:false,set:false},{role:'eps_job_trace_owner',member:'postgres',grantor:'postgres',admin:false,inherit:true,set:true}],dependencies:[],clients:0};}
function parseSql(sql){
 const code="import sys,pglast;from pglast import ast,parse_sql,parse_plpgsql;from pglast.stream import RawStream;assert pglast.__version__=='v7.21';s=parse_sql(sys.stdin.read());n=0\nfor r in s:\n if isinstance(r.stmt,(ast.DoStmt,ast.CreateFunctionStmt)):parse_plpgsql(RawStream()(r.stmt));n+=1\nprint(len(s),n)";
 const p=spawnSync(path.join(ROOT,'.venv-skills/Scripts/python.exe'),['-X','utf8','-B','-c',code],{input:sql,encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(p.status,0,p.stderr);return p.stdout;
}
test('disabled new purpose admits exact current37 proofs and complete pinned graph without old edits',async()=>{
 assert.equal(typeof EXECUTION_ENABLED,'boolean');const sources=await loadSources(),{manifest}=validateSources(sources);
 assert(manifest.internal_graph.files.length>=71);assert.equal(manifest.internal_graph.unresolved,0);assert(sources.has('package-lock.json'));assert(sources.has('node_modules/playwright-core/browsers.json'));
 assert(sources.has('node_modules/pdfjs-dist/legacy/build/pdf.mjs'));assert(sources.has('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'));
 const bad=new Map(sources);bad.set('apps/worker/src/presentation-pdf.ts',Buffer.from('changed'));
 assert.throws(()=>validateSources(bad));for(const[f,h]of Object.values(RECEIPTS))assert.equal(sha(sources.get(f)),h);
});
test('full compiler preserves actual stage/object/cleanup flow and targets exact new global profile seam',async()=>{
 const built=compileRecovery37(await loadSources(),{root:ROOT,runId});assert.equal(built.manifest.mode,'full');assert.equal(built.manifest.execution_enabled,EXECUTION_ENABLED);
 const s=built.source;assert(s.includes('if (true) {'));assert(!s.includes('await recovery33.metadataRestore();'));
 assert(s.includes("['prepare_presentation','render_presentation','validate_presentation','publish_presentation']"));assert(s.includes('executePresentationExportStage'));
 assert(s.includes('assert.equal(manifest.objects.length,4)'));assert(s.includes('sha256:ea6e27d158a843fee524d7f43f2f88a4ede8bc58e8ac32578b7dec5c1594ba6b'));
 assert(!s.includes('eps-media:local-76b4944f14af6bde'));
 assert(s.indexOf('${recovery33.fixtureSql()}')<s.indexOf('m07-synthetic-generate-'));
 assert(s.includes('await recovery33.beforeFullRestoreProfile(sourceCatalogue); report.restored_clone_profile=await preserveOriginalDumpProfile(restoreDb,sourceCatalogue);'));
 const inherited=await readFile(path.join(ROOT,'development/m07/recovery33/runtime.mjs'),'utf8');
 for(const field of ['original_local_database_unchanged','original29_full_auth_storage_catalogue_unchanged','original29_exact_profile_and_settings_state_unchanged','existing_global_role_oids_attributes_memberships_unchanged','shared_test_lock_released'])assert((s+inherited).includes(field));
 assert(s.includes('await recovery33.freshRestoredLease(pendingJob,oldStageLease,pendingHash.hash)'));
 assert(s.includes('restoreRecoveryBundle'));assert(s.includes('verifyRecoveryBundle'));assert(s.includes('validatePresentationPdf'));assert(s.includes('prepareVideoIsolated'));
 const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:s,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(syntax.status,0,syntax.stderr);
});
test('actual frozen bundle ownership accepts the compiled fresh data root without a new unsupported root',async()=>{
 const sources=await loadSources(),source=sources.get('tools/m07-recovery-bundle.mjs').toString(),start=source.indexOf('const UUID ='),end=source.indexOf('\nfunction checked(',start);
 assert(start>0&&end>start);const marker=JSON.stringify({run_id:runId,purpose:'m07-synthetic-local-recovery',workspace:ROOT});
 const primitives=vm.runInNewContext(source.slice(start,end)+';({owned,validate})',{WORKSPACE:ROOT,path,createHash,lstat:async file=>({isDirectory:()=>!file.endsWith('owner.json'),isFile:()=>file.endsWith('owner.json'),isSymbolicLink:()=>false,size:marker.length}),realpath:async file=>file,readFile:async()=>marker},{timeout:1000});
 const built=compileRecovery37(sources,{root:ROOT,runId}),expression=built.source.match(/const privateRoot = ([^;\n]+);/u)?.[1];assert(expression);
 const dataRoot=vm.runInNewContext(expression,{ROOT,path,runId},{timeout:1000});assert.equal(await primitives.owned(dataRoot,runId),path.join(ROOT,'.local/m07-recovery',runId));
 await assert.rejects(primitives.owned(path.join(ROOT,'.local/m07-recovery37',runId),runId),/RECOVERY_ROOT_INVALID/);
});
test('actual frozen bundle path validation keeps the whole internal graph and excludes only sealed external artifacts',async()=>{
 const sources=await loadSources(),{manifest}=validateSources(sources),source=sources.get('tools/m07-recovery-bundle.mjs').toString(),start=source.indexOf('const UUID ='),end=source.indexOf('\nfunction checked(',start);
 const validate=vm.runInNewContext(source.slice(start,end)+';validate',{WORKSPACE:ROOT,path,createHash},{timeout:1000});
 const metadata={file:'metadata.sql',size_bytes:1,sha256:sha('x')};
 const asManifest=files=>({schema_version:'1.0',scope:'synthetic-local-filesystem',run_id:runId,metadata,objects:[],sources:[...files].map(([file,bytes],index)=>({path:file,file:'sources/'+index,size_bytes:bytes.length,sha256:sha(bytes)}))});
 assert.throws(()=>validate(asManifest(sources),runId),/RECOVERY_MANIFEST_INVALID/); // scoped @vercel dependency is deliberately not a restored source path
 const report={},runtime=createRecovery37Context({sourceFiles:sources,report},{contextFactory:()=>({})});assert.equal(typeof runtime.bundleSources,'function');
 const bundled=runtime.bundleSources(sources);assert.equal(validate(asManifest(bundled),runId).sources.length,bundled.size);
 const excluded=Object.keys(manifest.pins).filter(file=>file.startsWith('node_modules/'));assert.equal(sources.size-bundled.size,excluded.length);
 for(const file of manifest.internal_graph.files)assert(bundled.has(file));
 for(const file of ['package-lock.json','packages/templates/versions/1.1.0/registry.json','apps/web/public/fonts/IBMPlexSans-Regular.woff2'])assert(bundled.has(file));
 assert.deepEqual(report.source_bundle_projection,{bundled_source_count:bundled.size,bundled_source_paths:[...bundled.keys()],excluded_pinned_external_count:excluded.length,excluded_pinned_external:excluded.map(file=>({path:file,sha256:manifest.pins[file]})),exclusion_reason:'Pinned third-party installation inputs; external installation remains required and is not restored',external_installation_required:true});
 for(const path of ['../escape','vendor/@unknown/package.json','node_modules/@unreviewed/package.json']){
  const invalid=asManifest(new Map([['safe.txt',Buffer.from('x')]]));invalid.sources[0].path=path;assert.throws(()=>validate(invalid,runId),/RECOVERY_MANIFEST_INVALID/);
  const unknown=new Map(sources);unknown.set(path,Buffer.from('x'));const runtime=createRecovery37Context({sourceFiles:unknown,report:{}},{contextFactory:()=>({})});assert.throws(()=>runtime.bundleSources(unknown));
 }
 assert.throws(()=>runtime.bundleSources(new Map(sources)));assert.equal(sources.size,Object.keys(manifest.pins).length+7);
 const built=compileRecovery37(sources,{root:ROOT,runId});assert(built.source.includes('sourceFiles: recovery33.bundleSources(sourceFiles)'));assert.equal(Object.keys(built.manifest.source_pins).length,sources.size);
});
test('actual34-37 functional DDL adapters and authored English fixture parse with PLpgSQL',async()=>{
 const sources=await loadSources(),items=adapters37(sources,sourceIdentity);assert.equal(items.length,4);assert.equal(items.at(-1).version,'20261101042702');
 for(const item of items){const source=sources.get(item.file).toString();if(item.anchor)assert.equal(item.sql.slice(item.sql.indexOf(item.anchor)),source.slice(source.indexOf(item.anchor)));assert(parseSql(item.sql));}
 assert(parseSql(sources.get(PURPOSE+'fixture.sql').toString()));
 const fixture=sources.get(PURPOSE+'fixture.sql').toString();assert(fixture.includes('no provider'));assert(!fixture.includes('"provider":"openai"'));
});
test('actual upgrade hook SQL tails parse through the real compiled transaction port',async()=>{
 const sources=await loadSources(),captured=[],report={private_artifact_acl:'synthetic-test-only',actual_local_migrations_executed:[]};
 const ctx={root:ROOT,runId,report,sourceDb:sourceIdentity.database,restoreDb:restoreIdentity.database,privateRoot:'SYNTHETIC-NOT-WRITTEN',sourceFiles:sources,
  marker:d=>d===sourceIdentity.database?sourceIdentity.marker:restoreIdentity.marker,databaseIdentity:async()=>({oid:sourceIdentity.oid}),
  rows:s=>s.split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),docker:async()=>({stdout:JSON.stringify({role:null})}),psqlArgs:()=>[],catalogue:async()=>({}),value:async()=>({}),
  sql:async(_d,sql)=>{captured.push(sql);return{stdout:sql.includes('comment on role')?JSON.stringify({role:role()}):''};}};
 const io={readFile:async f=>sources.get(path.relative(ROOT,f).split(path.sep).join('/')),writeFile:async()=>{}};
 const runtime=createRecovery37Context(ctx,{contextFactory:()=>({upgrade:async()=>{},catalogueSql:fullCatalogue33Sql(sources).sql}),io});await runtime.upgrade();assert.equal(captured.length,4);
 const built=compileRecovery37(sources,{root:ROOT,runId}),start=built.source.indexOf('async function sql(database, body, role = '),end=built.source.indexOf('\nconst value = async ',start);let assembled;
 const port=vm.runInNewContext('('+built.source.slice(start,end)+')',{assert,databaseIdentity:async()=>({oid:sourceIdentity.oid}),marker:()=>sourceIdentity.marker,ownedPredicate33,literal:v=>"'"+String(v).replaceAll("'","''")+"'",psqlArgs:()=>['SYNTHETIC'],docker:async(_a,o)=>{assembled=o.input;return{stdout:''};}},{timeout:1000});
 for(const sql of captured){await port(sourceIdentity.database,sql);assert(parseSql(assembled));}
 assert.deepEqual(report.actual_local_migrations_executed,['20261031143711','20261031182038','20261101012057','20261101042702']);
});
test('strict37 role identity accepts native text OID/set order without changing SQL preimage',()=>{
 const observed=role(),copy=structuredClone(observed);assert.equal(safeRole37(observed,runId).oid,243387);assert.deepEqual(observed,copy);
 const reverse=structuredClone(observed);reverse.memberships.reverse();assert.deepEqual(safeRole37(reverse,runId),safeRole37(observed,runId));
 for(const mutate of [v=>v.oid='0243387',v=>v.marker=v.marker.replace('37:','36:'),v=>v.memberships.push(v.memberships[0]),v=>v.memberships[0].set=true,v=>v.super=true,v=>v.extra='unknown']){const v=role();mutate(v);assert.throws(()=>safeRole37(v,runId));}
 const sql=traceCleanup37(observed,copy,runId);assert(sql.includes('"oid":"243387"'));assert(parseSql(sql));const bad=role();bad.dependencies=[{}];assert.throws(()=>traceCleanup37(observed,bad,runId));
});
test('history37 ACL correction is restore-only, exact snapshot and OID-preserving atomic SQL',async()=>{
 const sources=await loadSources(),versions=[...sources.keys()].filter(f=>/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/u.test(f)).map(f=>path.basename(f).slice(0,14)).sort();
 const snapshot={table_acl:null,identity:{owner:'postgres',owner_oid:16384,table_oid:243400,schema_oid:2200,kind:'r',persistence:'p',rls:true,force_rls:true}};
 assert.throws(()=>correctionSql37(sourceIdentity,snapshot,versions,runId));assert.throws(()=>correctionSql37(restoreIdentity,snapshot,versions.slice(0,-1),runId));
 const sql=correctionSql37(restoreIdentity,snapshot,versions,runId);assert(sql.includes('RECOVERY37_EXACT_OWNED37_REQUIRED'));assert(sql.includes('RECOVERY37_CURRENT_NATIVE_PREIMAGE_REQUIRED'));assert(sql.includes("'20261101042702'"));assert(sql.includes('"table_oid":243400'));
 assert.equal(sql.match(/grant all privileges on table eps.job_stage_attempts/g)?.length,1);assert(parseSql(sql));
 const built=compileRecovery37(sources,{root:ROOT,runId}),start=built.source.indexOf('async function sql(database, body, role = '),end=built.source.indexOf('\nconst value = async ',start);assert(start>0&&end>start);let assembled;
 const port=vm.runInNewContext('('+built.source.slice(start,end)+')',{assert,databaseIdentity:async()=>({oid:restoreIdentity.oid}),marker:()=>restoreIdentity.marker,ownedPredicate33,literal:v=>"'"+String(v).replaceAll("'","''")+"'",psqlArgs:()=>['SYNTHETIC'],docker:async(_args,options)=>{assembled=options.input;return{stdout:''};}},{timeout:1000});
 await port(restoreIdentity.database,sql);assert(assembled.includes('begin;'));assert(assembled.endsWith('\ncommit;'));assert(parseSql(assembled));
 await port(restoreIdentity.database,englishSql37());assert(parseSql(assembled));assert(assembled.includes("jsonb_build_object('rows'"));
});
test('native equivalence accepts only same privilege hashes, never a historical private snapshot assumption',()=>{
 const snapshot={table_acl:null,identity:{owner:'postgres',owner_oid:16384,table_oid:123,schema_oid:2200,kind:'r',persistence:'p',rls:true,force_rls:true},columns:[],roles:Array.from({length:61},(_,i)=>({name:'role'+i})),table_matrix:[],column_matrix:[],schema_matrix:[],expanded_acl:[]};
 const receipt={result:'passed',checkpoint:'complete',trace_acl_native:{result:'passed',table_matrix_sha256:sha('[]'),column_matrix_sha256:sha('[]'),schema_matrix_sha256:sha('[]'),expanded_acl_sha256:sha('[]')}};
 assert.throws(()=>admitNative37(snapshot,receipt)); // missing exact fourteen columns; no empty-matrix acceptance
});
test('native hash admission accepts a complete synthetic current snapshot and refuses any changed privilege matrix',()=>{
 const snapshot={table_acl:null,identity:{owner:'postgres',owner_oid:'16384',table_oid:'243400',schema_oid:'2200',kind:'r',persistence:'p',rls:true,force_rls:true},columns:COLUMNS.map(name=>({name,acl:'{eps_job_trace_owner=a/postgres}'})),roles:Array.from({length:61},(_,i)=>({name:'role'+i})),table_matrix:[{role:'role0',select:false}],column_matrix:[{role:'role0',column:COLUMNS[0],select:false}],schema_matrix:[{role:'role0',usage:true}],expanded_acl:[{grantee:'postgres',privilege:'SELECT',grantable:false}]};
 const native={result:'passed'};for(const[field,key]of [['table_matrix','table_matrix_sha256'],['column_matrix','column_matrix_sha256'],['schema_matrix','schema_matrix_sha256'],['expanded_acl','expanded_acl_sha256']])native[key]=sha(JSON.stringify(snapshot[field]));
 const receipt={result:'passed',checkpoint:'complete',trace_acl_native:native};assert.equal(admitNative37(snapshot,receipt),true);
 for(const field of ['table_matrix','column_matrix','schema_matrix','expanded_acl']){const bad=structuredClone(snapshot);bad[field].push({changed:true});assert.throws(()=>admitNative37(bad,receipt),/RECOVERY37_NATIVE508_PRIVILEGES_CHANGED/);}
});
test('full mode preserves BOTH generated Ready and interrupted-version English companions',()=>{
 const data=Object.fromEntries(['eps.candidate_media','eps.presentation_video_transcripts','eps.presentation_video_english_transcripts','eps.presentation_versions','eps.job_stage_attempts','eps.job_events','supabase_migrations.schema_migrations'].map(k=>[k,{count:k==='supabase_migrations.schema_migrations'?37:k==='eps.job_stage_attempts'?6:2,sha256:'a'.repeat(64)}]));
 const row={video_asset_id:'8a9f0000-0000-4000-8000-000000000001',candidate_media_id:'8a9f0000-0000-4000-8000-000000000002',status:'available',english_text:ENGLISH,english_sha256:sha(ENGLISH)};
 const english={rows:[{...row,version_id:'73700001-0000-4000-8000-000000000001'},{...row,version_id:'73700001-0000-4000-8000-000000000002'}]};
 assert.equal(validateExtra37({data,english}).english.rows.length,2);
 const bad=structuredClone(english);bad.rows.pop();assert.throws(()=>validateExtra37({data,english:bad}));
 const changed=structuredClone(english);changed.rows[1].english_sha256='b'.repeat(64);assert.throws(()=>validateExtra37({data,english:changed}));
});
test('foreign trace role refusal precedes inherited upgrade and cleanup never drops unattempted foreign role',async()=>{
 const foreign=role();foreign.marker='foreign';let upgraded=false,drop=false,cleaned=false;
 const report={},ctx={runId,report,sourceDb:sourceIdentity.database,restoreDb:restoreIdentity.database,sourceFiles:new Map(),rows:()=>[{role:foreign}],docker:async()=>({stdout:''}),psqlArgs:()=>[],databaseIdentity:async()=>null};
 const runtime=createRecovery37Context(ctx,{contextFactory:()=>({upgrade:async()=>{upgraded=true;},cleanupRoles:async()=>{cleaned=true;}})});
 await assert.rejects(runtime.upgrade());assert.equal(upgraded,false);ctx.docker=async(_a,options)=>{if(options.input.includes('drop role'))drop=true;return{stdout:''};};
 await runtime.cleanupRoles();assert.equal(cleaned,true);assert.equal(drop,false);assert.equal(report.new37_unattempted_foreign_role_untouched,true);
});
test('new runner remains disabled before preparation or runtime dispatch',async()=>{
 const run=await import('./run.mjs');if(!EXECUTION_ENABLED){await assert.rejects(run.prepare(),/RECOVERY37_EXECUTION_DISABLED/);await assert.rejects(run.execute(runId),/RECOVERY37_EXECUTION_DISABLED/);}
 const source=await readFile(path.join(ROOT,PURPOSE,'run.mjs'),'utf8');assert(source.includes("flag:'wx'"));assert(source.indexOf('execution-claim.json')<source.indexOf("['--import','tsx'"));assert(source.includes('normal_process_return_observed:typeof result.code'));
});
