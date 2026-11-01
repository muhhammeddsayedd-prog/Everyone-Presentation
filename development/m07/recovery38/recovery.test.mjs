/** Synthetic source/VM/parser tests only; no controller, private read or SQL. */
import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {loadInputs,validateInputs,validateSources,compileRecovery38 as compile38,adapters38,ROOT,EXECUTION_ENABLED,sha,PURPOSE,RECEIPTS,internalClosure} from './compiler.mjs';
import {validateSources as validateHistorical37} from '../recovery37/compiler.mjs';
const inputs=await loadInputs();
const loadSources=async()=>inputs.sources;
const compileRecovery38=(sources,options)=>compile38({...inputs,sources},options);
import {safeRole38,traceCleanup38,correctionSql38,englishSql38,createRecovery38Context,admitNative38,validateExtra38,ENGLISH} from './runtime.mjs';
import {ownedPredicate33} from '../recovery33/ownership.mjs';
import {fullCatalogue33Sql} from '../recovery33/compiler.mjs';
import {COLUMNS} from '../recovery36-trace-acl-native/runtime.mjs';
const runId='73800000-0000-4000-8000-000000000001',suffix=runId.replaceAll('-','');
const sourceIdentity={database:'eps_m07_r33_source_'+suffix,oid:123,marker:`eps-m07-recovery33:${runId}:source`};
const restoreIdentity={database:'eps_m07_r33_restore_'+suffix,oid:124,marker:`eps-m07-recovery33:${runId}:restore`};
function role(){return{name:'eps_job_trace_owner',oid:'243387',marker:`eps-m07-recovery38:${runId}:trace`,login:false,super:false,inherit:false,bypassrls:false,create_role:false,create_db:false,replication:false,connection_limit:-1,valid_until:null,memberships:[{role:'eps_job_trace_owner',member:'postgres',grantor:'supabase_admin',admin:true,inherit:false,set:false},{role:'eps_job_trace_owner',member:'postgres',grantor:'postgres',admin:false,inherit:true,set:true}],dependencies:[],clients:0};}
function parseSql(sql){
 const code="import sys,pglast;from pglast import ast,parse_sql,parse_plpgsql;from pglast.stream import RawStream;assert pglast.__version__=='v7.21';s=parse_sql(sys.stdin.read());n=0\nfor r in s:\n if isinstance(r.stmt,(ast.DoStmt,ast.CreateFunctionStmt)):parse_plpgsql(RawStream()(r.stmt));n+=1\nprint(len(s),n)";
 const p=spawnSync(path.join(ROOT,'.venv-skills/Scripts/python.exe'),['-X','utf8','-B','-c',code],{input:sql,encoding:'utf8',windowsHide:true,timeout:20000});assert.equal(p.status,0,p.stderr);return p.stdout;
}
test('disabled new purpose admits exact current38 proofs and complete pinned graph without old edits',async()=>{
 assert.equal(typeof EXECUTION_ENABLED,'boolean');const sources=await loadSources(),{manifest}=validateSources(sources);
 assert(manifest.internal_graph.files.length>=71);assert.equal(manifest.internal_graph.unresolved,0);assert(sources.has('package-lock.json'));assert(sources.has('node_modules/playwright-core/browsers.json'));
 assert(sources.has('node_modules/pdfjs-dist/legacy/build/pdf.mjs'));assert(sources.has('node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs'));
 const bad=new Map(sources);bad.set('apps/worker/src/presentation-pdf.ts',Buffer.from('changed'));
 assert.throws(()=>validateSources(bad));for(const[f,h]of Object.values(RECEIPTS))assert.equal(sha(sources.get(f)),h);
});
test('full compiler preserves actual stage/object/cleanup flow and targets exact new global profile seam',async()=>{
 const built=compileRecovery38(await loadSources(),{root:ROOT,runId});assert.equal(built.manifest.mode,'full');assert.equal(built.manifest.execution_enabled,EXECUTION_ENABLED);
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
 const built=compileRecovery38(sources,{root:ROOT,runId}),expression=built.source.match(/const privateRoot = ([^;\n]+);/u)?.[1];assert(expression);
 const dataRoot=vm.runInNewContext(expression,{ROOT,path,runId},{timeout:1000});assert.equal(await primitives.owned(dataRoot,runId),path.join(ROOT,'.local/m07-recovery',runId));
 await assert.rejects(primitives.owned(path.join(ROOT,'.local/m07-recovery38',runId),runId),/RECOVERY_ROOT_INVALID/);
});
test('actual frozen bundle path validation keeps the whole internal graph and excludes only sealed external artifacts',async()=>{
 const sources=await loadSources(),{manifest}=validateSources(sources),source=sources.get('tools/m07-recovery-bundle.mjs').toString(),start=source.indexOf('const UUID ='),end=source.indexOf('\nfunction checked(',start);
 const validate=vm.runInNewContext(source.slice(start,end)+';validate',{WORKSPACE:ROOT,path,createHash},{timeout:1000});
 const metadata={file:'metadata.sql',size_bytes:1,sha256:sha('x')};
 const asManifest=files=>({schema_version:'1.0',scope:'synthetic-local-filesystem',run_id:runId,metadata,objects:[],sources:[...files].map(([file,bytes],index)=>({path:file,file:'sources/'+index,size_bytes:bytes.length,sha256:sha(bytes)}))});
 assert.throws(()=>validate(asManifest(sources),runId),/RECOVERY_MANIFEST_INVALID/); // scoped @vercel dependency is deliberately not a restored source path
 const report={},runtime=createRecovery38Context({sourceFiles:sources,report},{contextFactory:()=>({})});assert.equal(typeof runtime.bundleSources,'function');
 const bundled=runtime.bundleSources(sources);assert.equal(validate(asManifest(bundled),runId).sources.length,bundled.size);
 const excluded=Object.keys(manifest.pins).filter(file=>file.startsWith('node_modules/'));assert.equal(sources.size-bundled.size,excluded.length);
 for(const file of manifest.internal_graph.files)assert(bundled.has(file));
 for(const file of ['package-lock.json','packages/templates/versions/1.1.0/registry.json','apps/web/public/fonts/IBMPlexSans-Regular.woff2'])assert(bundled.has(file));
 assert.deepEqual(report.source_bundle_projection,{bundled_source_count:bundled.size,bundled_source_paths:[...bundled.keys()],excluded_pinned_external_count:excluded.length,excluded_pinned_external:excluded.map(file=>({path:file,sha256:manifest.pins[file]})),exclusion_reason:'Pinned third-party installation inputs; external installation remains required and is not restored',external_installation_required:true});
 for(const path of ['../escape','vendor/@unknown/package.json','node_modules/@unreviewed/package.json']){
  const invalid=asManifest(new Map([['safe.txt',Buffer.from('x')]]));invalid.sources[0].path=path;assert.throws(()=>validate(invalid,runId),/RECOVERY_MANIFEST_INVALID/);
  const unknown=new Map(sources);unknown.set(path,Buffer.from('x'));const runtime=createRecovery38Context({sourceFiles:unknown,report:{}},{contextFactory:()=>({})});assert.throws(()=>runtime.bundleSources(unknown));
 }
 assert.throws(()=>runtime.bundleSources(new Map(sources)));assert.equal(sources.size,Object.keys(manifest.pins).length+6);
 const built=compileRecovery38(sources,{root:ROOT,runId});assert(built.source.includes('sourceFiles: recovery33.bundleSources(sourceFiles)'));assert.equal(Object.keys(built.manifest.source_pins).length,sources.size);
});
test('actual34-38 functional DDL adapters and authored English fixture parse with PLpgSQL',async()=>{
 const sources=await loadSources(),items=adapters38(sources,sourceIdentity);assert.equal(items.length,5);assert.equal(items.at(-1).version,'20261101110939');
 for(const item of items){const source=sources.get(item.file).toString();if(item.anchor)assert.equal(item.sql.slice(item.sql.indexOf(item.anchor)),source.slice(source.indexOf(item.anchor),item.version==='20261101110939'?-'commit;\n'.length:undefined));assert(parseSql(item.sql));}
 assert(parseSql(sources.get('development/m07/recovery37/fixture.sql').toString()));
 const fixture=sources.get('development/m07/recovery37/fixture.sql').toString();assert(fixture.includes('no provider'));assert(!fixture.includes('"provider":"openai"'));
});
test('actual upgrade hook SQL tails parse through the real compiled transaction port',async()=>{
 const sources=await loadSources(),captured=[],report={private_artifact_acl:'synthetic-test-only',actual_local_migrations_executed:[]};
 const ctx={root:ROOT,runId,report,sourceDb:sourceIdentity.database,restoreDb:restoreIdentity.database,privateRoot:'SYNTHETIC-NOT-WRITTEN',sourceFiles:sources,
  marker:d=>d===sourceIdentity.database?sourceIdentity.marker:restoreIdentity.marker,databaseIdentity:async()=>({oid:sourceIdentity.oid}),
  rows:s=>s.split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),docker:async()=>({stdout:JSON.stringify({role:null})}),psqlArgs:()=>[],catalogue:async()=>({}),value:async()=>({}),
  sql:async(_d,sql)=>{captured.push(sql);return{stdout:sql.includes('comment on role')?JSON.stringify({role:role()}):''};}};
 const io={readFile:async f=>sources.get(path.relative(ROOT,f).split(path.sep).join('/')),writeFile:async()=>{}};
 const runtime=createRecovery38Context(ctx,{contextFactory:()=>({upgrade:async()=>{},catalogueSql:fullCatalogue33Sql(sources).sql}),io});await runtime.upgrade();assert.equal(captured.length,5);
 const built=compileRecovery38(sources,{root:ROOT,runId}),start=built.source.indexOf('async function sql(database, body, role = '),end=built.source.indexOf('\nconst value = async ',start);let assembled;
 const port=vm.runInNewContext('('+built.source.slice(start,end)+')',{assert,databaseIdentity:async()=>({oid:sourceIdentity.oid}),marker:()=>sourceIdentity.marker,ownedPredicate33,literal:v=>"'"+String(v).replaceAll("'","''")+"'",psqlArgs:()=>['SYNTHETIC'],docker:async(_a,o)=>{assembled=o.input;return{stdout:''};}},{timeout:1000});
 for(const sql of captured){await port(sourceIdentity.database,sql);assert(parseSql(assembled));}
 assert.deepEqual(report.actual_local_migrations_executed,['20261031143711','20261031182038','20261101012057','20261101042702','20261101110939']);
 assert.equal(report.checkpoint,'recovery38-execute-owned-migration-20261101110939');
 assert.equal(report.recovery38_owned_migration_steps.length,5);for(const step of report.recovery38_owned_migration_steps){assert.equal(step.phase,'normal-owned-transaction-return');assert.equal(step.committed_in_disposable_owned_source,true);assert(/^[a-f0-9]{64}$/u.test(step.owned_sql_sha256));}
});
test('strict38 role identity accepts native text OID/set order without changing SQL preimage',()=>{
 const observed=role(),copy=structuredClone(observed);assert.equal(safeRole38(observed,runId).oid,243387);assert.deepEqual(observed,copy);
 const reverse=structuredClone(observed);reverse.memberships.reverse();assert.deepEqual(safeRole38(reverse,runId),safeRole38(observed,runId));
 for(const mutate of [v=>v.oid='0243387',v=>v.marker=v.marker.replace('38:','36:'),v=>v.memberships.push(v.memberships[0]),v=>v.memberships[0].set=true,v=>v.super=true,v=>v.extra='unknown']){const v=role();mutate(v);assert.throws(()=>safeRole38(v,runId));}
 const sql=traceCleanup38(observed,copy,runId);assert(sql.includes('"oid":"243387"'));assert(parseSql(sql));const bad=role();bad.dependencies=[{}];assert.throws(()=>traceCleanup38(observed,bad,runId));
});
test('history38 ACL correction is restore-only, exact snapshot and OID-preserving atomic SQL',async()=>{
 const sources=await loadSources(),versions=[...sources.keys()].filter(f=>/^supabase\/migrations\/[0-9]{14}_[^/]+\.sql$/u.test(f)).map(f=>path.basename(f).slice(0,14)).sort();
 const snapshot={table_acl:null,identity:{owner:'postgres',owner_oid:16384,table_oid:243400,schema_oid:2200,kind:'r',persistence:'p',rls:true,force_rls:true}};
 assert.throws(()=>correctionSql38(sourceIdentity,snapshot,versions,runId));assert.throws(()=>correctionSql38(restoreIdentity,snapshot,versions.slice(0,-1),runId));
 const sql=correctionSql38(restoreIdentity,snapshot,versions,runId);assert(sql.includes('RECOVERY38_EXACT_OWNED38_REQUIRED'));assert(sql.includes('RECOVERY38_CURRENT_NATIVE_PREIMAGE_REQUIRED'));assert(sql.includes("'20261101110939'"));assert(sql.includes('"table_oid":243400'));
 assert.equal(sql.match(/grant all privileges on table eps.job_stage_attempts/g)?.length,1);assert(parseSql(sql));
 const built=compileRecovery38(sources,{root:ROOT,runId}),start=built.source.indexOf('async function sql(database, body, role = '),end=built.source.indexOf('\nconst value = async ',start);assert(start>0&&end>start);let assembled;
 const port=vm.runInNewContext('('+built.source.slice(start,end)+')',{assert,databaseIdentity:async()=>({oid:restoreIdentity.oid}),marker:()=>restoreIdentity.marker,ownedPredicate33,literal:v=>"'"+String(v).replaceAll("'","''")+"'",psqlArgs:()=>['SYNTHETIC'],docker:async(_args,options)=>{assembled=options.input;return{stdout:''};}},{timeout:1000});
 await port(restoreIdentity.database,sql);assert(assembled.includes('begin;'));assert(assembled.endsWith('\ncommit;'));assert(parseSql(assembled));
 await port(restoreIdentity.database,englishSql38());assert(parseSql(assembled));assert(assembled.includes("jsonb_build_object('rows'"));
});
test('native equivalence accepts only same privilege hashes, never a historical private snapshot assumption',()=>{
 const snapshot={table_acl:null,identity:{owner:'postgres',owner_oid:16384,table_oid:123,schema_oid:2200,kind:'r',persistence:'p',rls:true,force_rls:true},columns:[],roles:Array.from({length:61},(_,i)=>({name:'role'+i})),table_matrix:[],column_matrix:[],schema_matrix:[],expanded_acl:[]};
 const receipt={result:'passed',checkpoint:'complete',trace_acl_native:{result:'passed',table_matrix_sha256:sha('[]'),column_matrix_sha256:sha('[]'),schema_matrix_sha256:sha('[]'),expanded_acl_sha256:sha('[]')}};
 assert.throws(()=>admitNative38(snapshot,receipt)); // missing exact fourteen columns; no empty-matrix acceptance
});
test('native hash admission accepts a complete synthetic current snapshot and refuses any changed privilege matrix',()=>{
 const snapshot={table_acl:null,identity:{owner:'postgres',owner_oid:'16384',table_oid:'243400',schema_oid:'2200',kind:'r',persistence:'p',rls:true,force_rls:true},columns:COLUMNS.map(name=>({name,acl:'{eps_job_trace_owner=a/postgres}'})),roles:Array.from({length:61},(_,i)=>({name:'role'+i})),table_matrix:[{role:'role0',select:false}],column_matrix:[{role:'role0',column:COLUMNS[0],select:false}],schema_matrix:[{role:'role0',usage:true}],expanded_acl:[{grantee:'postgres',privilege:'SELECT',grantable:false}]};
 const native={result:'passed'};for(const[field,key]of [['table_matrix','table_matrix_sha256'],['column_matrix','column_matrix_sha256'],['schema_matrix','schema_matrix_sha256'],['expanded_acl','expanded_acl_sha256']])native[key]=sha(JSON.stringify(snapshot[field]));
 const receipt={result:'passed',checkpoint:'complete',trace_acl_native:native};assert.equal(admitNative38(snapshot,receipt),true);
 for(const field of ['table_matrix','column_matrix','schema_matrix','expanded_acl']){const bad=structuredClone(snapshot);bad[field].push({changed:true});assert.throws(()=>admitNative38(bad,receipt),/RECOVERY38_NATIVE508_PRIVILEGES_CHANGED/);}
});
test('full mode preserves BOTH generated Ready and interrupted-version English companions',()=>{
 const data=Object.fromEntries(['eps.candidate_media','eps.presentation_video_transcripts','eps.presentation_video_english_transcripts','eps.presentation_versions','eps.job_stage_attempts','eps.job_events','supabase_migrations.schema_migrations'].map(k=>[k,{count:k==='supabase_migrations.schema_migrations'?38:k==='eps.job_stage_attempts'?6:2,sha256:'a'.repeat(64)}]));
 const row={video_asset_id:'8a9f0000-0000-4000-8000-000000000001',candidate_media_id:'8a9f0000-0000-4000-8000-000000000002',status:'available',english_text:ENGLISH,english_sha256:sha(ENGLISH)};
 const english={rows:[{...row,version_id:'73800001-0000-4000-8000-000000000001'},{...row,version_id:'73800001-0000-4000-8000-000000000002'}]};
 assert.equal(validateExtra38({data,english}).english.rows.length,2);
 const bad=structuredClone(english);bad.rows.pop();assert.throws(()=>validateExtra38({data,english:bad}));
 const changed=structuredClone(english);changed.rows[1].english_sha256='b'.repeat(64);assert.throws(()=>validateExtra38({data,english:changed}));
});
test('foreign trace role refusal precedes inherited upgrade and cleanup never drops unattempted foreign role',async()=>{
 const foreign=role();foreign.marker='foreign';let upgraded=false,drop=false,cleaned=false;
 const report={},ctx={runId,report,sourceDb:sourceIdentity.database,restoreDb:restoreIdentity.database,sourceFiles:new Map(),rows:()=>[{role:foreign}],docker:async()=>({stdout:''}),psqlArgs:()=>[],databaseIdentity:async()=>null};
 const runtime=createRecovery38Context(ctx,{contextFactory:()=>({upgrade:async()=>{upgraded=true;},cleanupRoles:async()=>{cleaned=true;}})});
 await assert.rejects(runtime.upgrade());assert.equal(upgraded,false);ctx.docker=async(_a,options)=>{if(options.input.includes('drop role'))drop=true;return{stdout:''};};
 await runtime.cleanupRoles();assert.equal(cleaned,true);assert.equal(drop,false);assert.equal(report.new38_unattempted_foreign_role_untouched,true);
});
test('new runner remains disabled before preparation or runtime dispatch',async()=>{
 const run=await import('./run.mjs');if(!EXECUTION_ENABLED){await assert.rejects(run.prepare(),/RECOVERY38_EXECUTION_DISABLED/);await assert.rejects(run.execute(runId),/RECOVERY38_EXECUTION_DISABLED/);}
 const source=await readFile(path.join(ROOT,PURPOSE,'run.mjs'),'utf8');assert(source.includes("flag:'wx'"));assert(source.indexOf('execution-claim.json')<source.indexOf("['--import','tsx'"));assert(source.includes('normal_process_return_observed:typeof result.code'));
});
test('historical365 raw blobs remain a separate unchanged validator input, never current substitutions',()=>{
 assert.equal(inputs.historical.size,365);assert.equal(inputs.sources.size,385);assert.equal(inputs.provenance.size,2);
 validateHistorical37(inputs.historical);assert.throws(()=>validateHistorical37(inputs.sources));
 const mixed=new Map(inputs.historical);mixed.set('packages/domain/src/index.ts',inputs.sources.get('packages/domain/src/index.ts'));assert.throws(()=>validateHistorical37(mixed));
 const{manifest}=validateInputs(inputs);assert.equal(manifest.historical_to_current_deltas.length,5);
 const absent=new Map(inputs.sources);absent.delete('packages/domain/src/job-filters.ts');assert.throws(()=>validateInputs({...inputs,sources:absent}));
 const closure=internalClosure(inputs.sources,manifest.internal_graph.files);assert.equal(closure.files.length,72);assert.deepEqual(closure.unresolved,[]);
 const omitted=new Map(inputs.sources);omitted.delete('packages/domain/src/job-filters.ts');assert.throws(()=>internalClosure(omitted,manifest.internal_graph.files));
});
test('API provenance is checked before clone but cannot enter the frozen native bundle',()=>{
 const built=compileRecovery38(inputs.sources,{root:ROOT,runId});const at=built.source.indexOf('report.provenance_only_inputs=');assert(at>0&&at<built.source.indexOf('const initialDump'));
 assert(built.source.includes('report.provenance_only_inputs_restored=false'));assert(built.source.includes('RECOVERY38_PROVENANCE_CHANGED'));
 for(const[f]of inputs.provenance){assert(!inputs.sources.has(f));assert.equal(built.manifest.provenance_only_inputs[f],sha(inputs.provenance.get(f)));const mixed=new Map(inputs.sources);mixed.set(f,inputs.provenance.get(f));assert.throws(()=>validateSources(mixed));}
 const changed=new Map(inputs.provenance);changed.set([...changed.keys()][0],Buffer.from('changed'));assert.throws(()=>validateInputs({...inputs,provenance:changed}));
 const report={},runtime=createRecovery38Context({sourceFiles:inputs.sources,report},{contextFactory:()=>({})}),bundle=runtime.bundleSources(inputs.sources);
 assert.equal(bundle.size,373);for(const f of inputs.provenance.keys())assert(!bundle.has(f));assert(bundle.has('packages/domain/src/job-filters.ts'));
 assert.equal(report.source_bundle_projection.excluded_pinned_external_count,12);
});
function extra38(){
 const data=Object.fromEntries(['eps.candidate_media','eps.presentation_video_transcripts','eps.presentation_video_english_transcripts','eps.presentation_versions','eps.job_stage_attempts','eps.job_events','supabase_migrations.schema_migrations'].map(k=>[k,{count:k==='supabase_migrations.schema_migrations'?38:k==='eps.job_stage_attempts'?6:2,sha256:'a'.repeat(64)}]));
 const row={video_asset_id:'8a9f0000-0000-4000-8000-000000000001',candidate_media_id:'8a9f0000-0000-4000-8000-000000000002',status:'available',english_text:ENGLISH,english_sha256:sha(ENGLISH)};
 return{data,english:{rows:[{...row,version_id:'83800001-0000-4000-8000-000000000001'},{...row,version_id:'83800001-0000-4000-8000-000000000002'}]}};
}
async function afterRestorePort({batchMutation,workspaceMutation}={}){
 const extra=extra38(),scope={version_id:extra.english.rows[0].version_id,job_id:'83800001-0000-4000-8000-000000000003',series_id:'83800001-0000-4000-8000-000000000004'},workspace={workspace_id:'83800001-0000-4000-8000-000000000005',version_workspace_id:'83800001-0000-4000-8000-000000000005',resource_id:scope.version_id,version_id:scope.version_id,series_id:scope.series_id,job_id:scope.job_id,generation_job_id:scope.job_id,empty_batch_count:0},calls=[],report={private_artifact_acl:'inert-test'};
 const ctx={root:ROOT,runId,privateRoot:'INERT-NOT-WRITTEN',report,sourceDb:sourceIdentity.database,restoreDb:restoreIdentity.database,sourceFiles:inputs.sources,
  value:async(db,sql,role,actor)=>{calls.push({db,sql,role,actor});if(sql.includes("'data'")&&sql.includes('eps.m07_readback'))return extra.data;if(sql.includes("'rows'"))return extra.english;if(sql.startsWith('select public.eps_get_feedback_summary'))return{shared:0};if(sql.startsWith("select jsonb_build_object('workspace_id'")){const result=structuredClone(workspace);workspaceMutation?.(result);return result;}if(sql.startsWith('do $recovery38_batch$')){const result={null_batch_error:'INVALID_REQUEST',empty_batch:{data:[],page:{next_cursor:null}}};batchMutation?.(result);return result;}if(sql.startsWith('select eps.presentation_video_english_transcript'))return{english_text:ENGLISH,english_status:'available',english_sha256:sha(ENGLISH)};throw Error('UNEXPECTED_INERT_SQL');},
  sql:async(db,sql)=>{calls.push({db,sql});return{stdout:''};}};
 // The populated-data query itself is exact inherited source; bind by equality rather than private data.
 const {dataSql36}=await import('../recovery36/runtime.mjs');const original=ctx.value;ctx.value=async(db,sql,...args)=>sql===dataSql36()?extra.data:original(db,sql,...args);
 const io={readFile:async f=>inputs.sources.get(path.relative(ROOT,f).split(path.sep).join('/')),writeFile:async()=>{}};
 const runtime=createRecovery38Context(ctx,{contextFactory:()=>({authBoundary:async()=>{}}),io});await runtime.beforeBackup(scope,{resource_id:extra.english.rows[1].version_id});return{run:()=>runtime.afterRestore(scope),calls,report};
}
test('real38 restored RPC wire preserves authenticated null denial and empty-batch shape without pagination claims',async()=>{
 const port=await afterRestorePort();await port.run();const batch=port.calls.filter(c=>c.sql.startsWith('do $recovery38_batch$'));assert.equal(batch.length,2);assert.equal(new Set(batch.map(c=>c.db)).size,2);
 for(const c of batch){assert.equal(c.role,'authenticated');assert.equal(c.actor,'8a1a0000-0000-4000-8000-000000000001');assert(parseSql(c.sql));assert(c.sql.includes("sqlerrm<>'INVALID_REQUEST'"));assert(c.sql.includes('null,null,25,null'));}
 assert.equal(port.report.full38_restore.batch38_nonempty_pagination_proven,false);assert.equal(port.report.full38_restore.result,'passed_before_recovery');
 for(const mutate of [v=>v.null_batch_error='AUTH_REQUIRED',v=>v.empty_batch.data.push({id:'foreign'}),v=>v.empty_batch.page.next_cursor='unexpected']){const bad=await afterRestorePort({batchMutation:mutate});await assert.rejects(bad.run());assert.equal(bad.report.full38_restore,undefined);}
 const foreign=await afterRestorePort({workspaceMutation:v=>v.generation_job_id='83800001-0000-4000-8000-000000000099'});await assert.rejects(foreign.run());assert(!foreign.calls.some(c=>c.sql.startsWith('do $recovery38_batch$')));
});
test('coherent current Git source anchor contains exact367 non-installed pinned blob bytes',()=>{
 const{manifest}=validateInputs(inputs),files=Object.keys(manifest.pins).filter(f=>!f.startsWith('node_modules/'));assert.equal(files.length,367);
 const result=spawnSync('git',['cat-file','--batch'],{cwd:ROOT,input:files.map(f=>manifest.source_checkpoint+':'+f+'\n').join(''),windowsHide:true,maxBuffer:32*1024*1024,timeout:30000});assert.equal(result.status,0);let at=0;
 for(const f of files){const end=result.stdout.indexOf(10,at),header=result.stdout.subarray(at,end).toString().split(' ');assert.equal(header[1],'blob');const size=Number(header[2]);assert(Number.isSafeInteger(size)&&size>=0);const bytes=result.stdout.subarray(end+1,end+1+size);assert.equal(sha(bytes),manifest.pins[f]);assert.equal(result.stdout[end+1+size],10);at=end+size+2;}
 assert.equal(at,result.stdout.length);
});
test('new migration failure preserves precise checkpoint and records raw trace row before admission refusal',async()=>{
 const saved=[],report={private_artifact_acl:'inert-test',actual_local_migrations_executed:[]};let calls=0;
 const ctx={root:ROOT,runId,report,sourceDb:sourceIdentity.database,restoreDb:restoreIdentity.database,privateRoot:'INERT-NOT-WRITTEN',sourceFiles:inputs.sources,
  marker:()=>sourceIdentity.marker,databaseIdentity:async()=>({oid:sourceIdentity.oid}),rows:s=>s.split('\n').filter(l=>l.startsWith('{')).map(JSON.parse),docker:async()=>({stdout:'{"role":null}'}),psqlArgs:()=>[],catalogue:async()=>({}),value:async()=>({}),
  sql:async()=>{calls++;const row=role();row.oid='0243387';return{stdout:calls===3?JSON.stringify({role:row}):''};}};
 const io={readFile:async f=>inputs.sources.get(path.relative(ROOT,f).split(path.sep).join('/')),writeFile:async(f,b)=>{saved.push({f,b});}};
 const runtime=createRecovery38Context(ctx,{contextFactory:()=>({upgrade:async()=>{},catalogueSql:fullCatalogue33Sql(inputs.sources).sql}),io});await assert.rejects(runtime.upgrade());
 assert.equal(calls,3);assert.equal(report.checkpoint,'recovery38-execute-owned-migration-20261101012057');assert.equal(report.recovery38_functional_upgrades_34_to38,undefined);
 const raw=saved.find(v=>v.f.endsWith('trace38-role-created.json'));assert(raw);assert.equal(JSON.parse(raw.b).role.oid,'0243387');assert.equal(report.recovery38_trace_role_observation_sha256,sha(raw.b));
 assert.deepEqual(report.actual_local_migrations_executed,['20261031143711','20261031182038']);
});
test('migration38 admission matches the actual compiled native transaction session and effective role',async()=>{
 const built=compileRecovery38(inputs.sources,{root:ROOT,runId}),line=built.source.split('\n').find(v=>v.startsWith('const psqlArgs = '));assert(line);
 const psqlArgs=vm.runInNewContext(line+';psqlArgs',{target:{container:{Id:'INERT-CONTAINER'}}},{timeout:1000});
 const start=built.source.indexOf('async function sql(database, body, role = '),end=built.source.indexOf('\nconst value = async ',start);assert(start>0&&end>start);let assembled,args;
 const port=vm.runInNewContext('('+built.source.slice(start,end)+')',{assert,databaseIdentity:async()=>({oid:sourceIdentity.oid}),marker:()=>sourceIdentity.marker,ownedPredicate33,literal:v=>"'"+String(v).replaceAll("'","''")+"'",psqlArgs,docker:async(a,o)=>{args=a;assembled=o.input;return{stdout:''};}},{timeout:1000});
 const item=adapters38(inputs.sources,sourceIdentity).at(-1);await port(sourceIdentity.database,item.sql);
 const session=args[args.indexOf('-U')+1];assert.equal(session,'supabase_admin');assert(assembled.includes('set local role postgres;'));
 const admission=item.sql.slice(0,item.sql.indexOf(item.anchor));assert.equal(admission.match(/session_user<>'([^']+)'/u)?.[1],session,'OWNED38_ADMISSION_MUST_MATCH_UNCHANGED_NATIVE_LOGIN');
 assert(admission.includes("current_user<>'postgres'"));assert(admission.includes(ownedPredicate33(sourceIdentity)));assert(admission.includes('BATCH38_CURRENT_OLD_PORT_REQUIRED'));assert(parseSql(assembled));
});
