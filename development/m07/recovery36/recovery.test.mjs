import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {compileRecovery36,loadSources,ROOT,EXECUTION_ENABLED,adapters36,sha} from './compiler.mjs';
import {fullCatalogue33Sql} from '../recovery33/compiler.mjs';
import {createRecovery36Context,dataSql36,validateData36,assertTraceRole36,traceRoleQuery36,traceCleanupSql36,checkedDump36} from './runtime.mjs';
import {execute} from './run.mjs';

const runId='36000000-0000-4000-8000-000000000036';
const identity={database:'eps_m07_r33_source_'+runId.replaceAll('-',''),marker:`eps-m07-recovery33:${runId}:source`,oid:12345};
const sources=await loadSources();
const actualSql=[];
const role=()=>({name:'eps_job_trace_owner',oid:45678,marker:`eps-m07-recovery36:${runId}:trace`,login:false,super:false,inherit:false,bypassrls:false,create_role:false,create_db:false,replication:false,connection_limit:-1,valid_until:null,clients:0,dependencies:[],memberships:[{role:'eps_job_trace_owner',member:'postgres',grantor:'postgres',admin:false,inherit:true,set:true}]});

test('all prior executable/support sources remain exact with one explicit README qualification',()=>{
 assert(sources.size>119);assert.equal(typeof EXECUTION_ENABLED,'boolean');
 const proof=JSON.parse(sources.get('tracking/evidence/m07/recovery33/2026-10-31T15-34-37-577Z-9af6774f.json'));
 assert.equal(Object.keys(proof.source_seals).length,119);
 const changed=Object.entries(proof.source_seals).filter(([file,digest])=>sha(sources.get(file))!==digest).map(([file])=>file);
 assert.deepEqual(changed,['development/m07/recovery33/README.md']);
});
test('migration adapters change only exact owned admissions and preserve every functional byte',()=>{
 const migrations=adapters36(sources,identity);assert.equal(migrations.length,3);
 for(const item of migrations){assert.equal(item.sql.slice(item.sql.indexOf(item.anchor)),item.functional);assert.equal(sha(item.functional),item.functional_sha256);}
 assert.throws(()=>adapters36(sources,{...identity,oid:0}));
 assert.throws(()=>adapters36(sources,{...identity,database:'postgres'}));
 assert.throws(()=>adapters36(sources,{...identity,marker:'unowned'}));
 const altered=new Map(sources);altered.set(migrations[2].file,Buffer.from('changed'));assert.throws(()=>adapters36(altered,identity));
});
test('compiler remains metadata-only and preserves original29, all roles, lock and guarded restore seams',()=>{
 const compiled=compileRecovery36(sources,{root:ROOT,runId});
 assert.equal(compiled.manifest.execution_enabled,EXECUTION_ENABLED);assert.equal(compiled.manifest.native_media_executed,false);
 assert(compiled.source.includes('createRecovery36Context('));assert(compiled.source.includes('RECOVERY36_EXECUTION_DISABLED'));
 assert(compiled.source.includes('await recovery33.metadataRestore();'));assert(compiled.source.includes('if (false) {'));
 assert(compiled.source.includes('original29_full_catalogue_unchanged'));assert(compiled.source.includes('shared_test_lock_released'));
 assert(compiled.source.includes('await restoreOwnedDump(sourceDb,initialDump)'));assert(compiled.source.includes('await recovery33.cleanupRoles()'));
 assert(compiled.source.includes("'tracking/evidence/m07/recovery36'"));
 const syntax=spawnSync(process.execPath,['--check','--input-type=module'],{input:compiled.source,encoding:'utf8',windowsHide:true,timeout:10000});assert.equal(syntax.status,0,syntax.stderr);
 assert.throws(()=>compileRecovery36(sources,{root:ROOT,runId,mode:'full'}));
 assert.throws(()=>compileRecovery36(sources,{root:'relative',runId}));
});
test('portable populated row inventory refuses omitted new graphs, unsafe hashes and sparse data',()=>{
 const rows=Object.fromEntries(['eps.candidate_media','eps.presentation_video_transcripts','eps.presentation_video_english_transcripts','eps.presentation_versions','eps.job_stage_attempts','eps.job_events','eps.media_assets','supabase_migrations.schema_migrations'].map(k=>[k,{count:k==='supabase_migrations.schema_migrations'?36:1,sha256:'a'.repeat(64)}]));
 validateData36(rows);
 for(const mutate of [v=>delete v['eps.job_stage_attempts'],v=>v['eps.presentation_video_english_transcripts'].count=0,v=>v['eps.job_events'].sha256='invalid',v=>v['supabase_migrations.schema_migrations'].count=35]){const bad=structuredClone(rows);mutate(bad);assert.throws(()=>validateData36(bad));}
 assert(dataSql36().includes("n.nspname in('eps','public','auth','storage','supabase_migrations')"));
 assert(!dataSql36().includes('to_jsonb(t) into'));
});
test('new trace cleanup never adopts an existing/ambiguous role or broadens old cleanup',()=>{
 const expected=role(),observed=role();assertTraceRole36(expected,observed,{databasesAbsent:true});
 for(const change of [{oid:9876},{marker:'foreign'},{login:true},{dependencies:[{}]},{clients:1},{memberships:[]}])assert.throws(()=>assertTraceRole36(expected,{...observed,...change},{databasesAbsent:true}));
 assert.throws(()=>assertTraceRole36({...expected,oid:undefined},observed,{databasesAbsent:true}));
 assert.throws(()=>assertTraceRole36(expected,observed,{databasesAbsent:false}));
 const sql=traceCleanupSql36(expected,observed);assert(sql.includes('lock table pg_authid,pg_auth_members,pg_shdepend'));
 assert(sql.includes('drop role eps_job_trace_owner'));assert(!sql.includes('revoke '));assert(!sql.includes('drop owned'));
 assert(traceRoleQuery36().includes("rolname='eps_job_trace_owner'"));
});
test('fixture and new SQL have no cloud calls, fake Ready publication or outer transaction escape',async()=>{
 const fixture=sources.get('development/m07/recovery36/fixture.sql').toString('utf8');
 assert(fixture.includes('eps.claim_job_stage_replay'));assert(fixture.includes('eps.record_job_event'));
 assert(fixture.includes('english_transcript_version'));assert(fixture.includes('public.eps_generate_version'));
 assert(!/status\s*=\s*'ready'/u.test(fixture));assert(!/^\s*(begin|commit|rollback)\s*;/imu.test(fixture));
 const runner=await readFile(path.join(ROOT,'development/m07/recovery36/run.mjs'),'utf8');
 assert(runner.indexOf('EXECUTION_ENABLED')<runner.indexOf('spawn('));assert(runner.includes("flag:'wx'"));
 assert(!runner.includes('SUPABASE_ACCESS_TOKEN'));assert(!runner.includes('process.env.DEBUG'));
});
test('actual new runtime migration and cleanup SQL are captured by fake ports with no private IO',async()=>{
 let observed=null,inheritedCleaned=false;const writes=new Map(),calls=[];
 const inherited={active:false,catalogueSql:fullCatalogue33Sql(sources).sql,async upgrade(){this.active=true;},async cleanupRoles(){assert.equal(observed,null);inheritedCleaned=true;}};
 const ctx={root:ROOT,runId,sourceDb:identity.database,restoreDb:identity.database.replace('_source_','_restore_'),privateRoot:'unused-private-root',sourceFiles:sources,report:{private_artifact_acl:true,actual_local_migrations_executed:[]},
  async databaseIdentity(database,absent){return absent?null:{oid:identity.oid};},marker(database){return database===identity.database?identity.marker:identity.marker.replace(':source',':restore');},
  async catalogue(){return{synthetic:'metadata'};},async value(){return{};},rows(raw){return raw.split('\n').filter(Boolean).map(JSON.parse);},psqlArgs(){return['FAKE'];},
  async sql(_db,body){calls.push(body);if(body.includes('create role eps_job_trace_owner'))observed=role();return{stdout:observed?JSON.stringify({role:observed}):''};},
  async docker(_args,{input}){calls.push(input);if(input.includes('drop role eps_job_trace_owner'))observed=null;return{stdout:JSON.stringify({role:observed})};}};
 const runtime=createRecovery36Context(ctx,{contextFactory:()=>inherited,io:{async readFile(file){return sources.get(path.relative(ROOT,file).split(path.sep).join('/'));},async writeFile(file,raw,options){assert.equal(options.flag,'wx');assert(!writes.has(file));writes.set(file,raw);}}});
 assert.equal(runtime.active,false);await runtime.upgrade();assert.deepEqual(ctx.report.actual_local_migrations_executed,['20261031143711','20261031182038','20261101012057']);
 assert(calls.some(sql=>sql.includes('comment on role eps_job_trace_owner is ')));await runtime.cleanupRoles();assert(inheritedCleaned);assert.equal(ctx.report.new36_trace_role_removed,true);actualSql.push(...calls);
});
test('actual adapters, data, role cleanup and fixture SQL parse without unknown fused JSON types',()=>{
 const python=[path.join(ROOT,'.venv-skills/Scripts/python.exe'),path.join(ROOT,'../Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe')].find(existsSync);assert(python);
 const sql=[...adapters36(sources,identity).map(v=>v.sql),dataSql36(),traceRoleQuery36(),traceCleanupSql36(role(),role()),sources.get('development/m07/recovery36/fixture.sql').toString('utf8'),...actualSql];
 const program=String.raw`
import json,sys,re
from pglast import parse_sql,parse_plpgsql,ast,visitors
class Types(visitors.Visitor):
 def visit_TypeName(self,a,n):
  assert n.names[-1].sval not in ('jsonbas','jsonband','jsonbthen')
count=0
for s in json.load(sys.stdin):
 tree=parse_sql(s);Types()(tree);count+=len(tree)
 if s.startswith('do $rows36$'):
  m=re.search(r"execute format\('(.+?)',r.nspname,r.relname\)",s,re.S);assert m
  Types()(parse_sql(m[1].replace("''","'").replace('%I.%I','synthetic_schema.synthetic_table')))
 for n in tree:
  if isinstance(n.stmt,ast.DoStmt):parse_plpgsql(s[n.stmt_location:n.stmt_location+n.stmt_len]+';')
print(count)
`;
 const result=spawnSync(python,['-I','-X','utf8','-B','-c',program],{input:JSON.stringify(sql),encoding:'utf8',windowsHide:true,timeout:30000});
 assert.equal(result.status,0,result.stderr);assert(Number(result.stdout)>100);
});
test('preexisting trace role is refused before33 allocation and never blocks inherited guarded cleanup',async()=>{
 let allocated=0,cleaned=0;const foreign=role(),calls=[];
 const ctx={report:{},sourceFiles:sources,sourceDb:identity.database,restoreDb:identity.database.replace('_source_','_restore_'),
  async databaseIdentity(){return null;},psqlArgs(){return['FAKE'];},rows:raw=>[JSON.parse(raw)],async docker(_a,{input}){calls.push(input);return{stdout:JSON.stringify({role:foreign})};}};
 const runtime=createRecovery36Context(ctx,{contextFactory:()=>({async upgrade(){allocated++;},async cleanupRoles(){cleaned++;}})});
 await assert.rejects(runtime.upgrade(),/EXISTING_ROLE_NOT_ADOPTED/u);assert.equal(allocated,0);
 await runtime.cleanupRoles();assert.equal(cleaned,1);assert.equal(ctx.report.unattempted_trace_role_untouched,true);
 assert(!calls.some(sql=>sql.includes('drop role')));assert.equal(ctx.report.new36_trace_role_removed,false);
});
test('corrupt metadata is denied before a restored SQL port could consume it',()=>{
 const raw=Buffer.from('synthetic metadata dump'),digest=sha(raw);assert.equal(checkedDump36(raw,digest),raw);
 assert.throws(()=>checkedDump36(Buffer.from('changed'),digest));assert.throws(()=>checkedDump36(Buffer.alloc(0),sha(Buffer.alloc(0))));
});
test('disabled execution refuses before any source/plan/private/child operation',async()=>{
 if(!EXECUTION_ENABLED)await assert.rejects(execute('not-even-a-run-id'),/RECOVERY36_EXECUTION_DISABLED/u);
 else assert.equal(typeof EXECUTION_ENABLED,'boolean'); // Never dispatch from an inert suite after root arms it.
});
