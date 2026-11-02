import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { APPROVED, SEALS, V2, BEFORE_OBSERVATION, BEFORE_EXECUTION } from './approved-pair.mjs';
import { admitReleasePair, compareAcrossRelease } from './compare.mjs';
import { compareFiles, FILE_COMPARISON_ENABLED, readRegular } from './files.mjs';

const MAIN=path.resolve(import.meta.dirname,'../../../../Everyone-Presentation-Studio');
const sha=raw=>createHash('sha256').update(raw).digest('hex');
const copy=value=>JSON.parse(JSON.stringify(value));
const raw=value=>Buffer.from(JSON.stringify(value));
const ID1='11111111-1111-4111-8111-111111111111',ID2='22222222-2222-4222-8222-222222222222';
const CLIENT='f2acafd5-d4b6-4176-b86c-067c57e45ecc';
const PROJECT='prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0';
async function evidence(){
 const load=async release=>({readbackRaw:await readFile(path.join(MAIN,release.readback.path)),sourceRaw:await readFile(path.join(MAIN,release.source.path)),archiveRaw:await readFile(path.join(MAIN,release.archive.path))});
 return{before:await load(APPROVED.before),after:await load(APPROVED.after),sourceFiles:new Map(await Promise.all(Object.keys({...SEALS,[V2.path]:V2.sha256}).map(async file=>[file,await readFile(path.join(MAIN,file))])))};
}
const before=JSON.parse(await readFile(path.join(MAIN,BEFORE_OBSERVATION.path),'utf8'));
function fixtures(){
 const after=copy(before);after.deployment_id=APPROVED.after.deployment;
 after.project_read={...after.project_read,request_id:ID2,trace_id:ID2,logged_at:'2026-11-02T10:30:00.000Z'};
 after.verified_token={...after.verified_token,trace_id:ID2,logged_at:'2026-11-02T10:29:59.900Z',iat:before.verified_token.iat+8000,exp:before.verified_token.exp+8000};
 after.since='2026-11-02T10:25:00.000Z';after.observed_at='2026-11-02T10:30:01.000Z';
 const packet=(value,index)=>{
  const body=raw(value),file=index===0?BEFORE_OBSERVATION.path:'tracking/evidence/m07/completion-oauth/synthetic-after-request-observation.json';
  return{path:file,raw:body,executionPath:`tracking/evidence/m07/completion-oauth/synthetic-${index}-collector-v2-execution.json`,executionRaw:raw({schema_version:'1.0',scope:'actual_Claude_observation_collector_v2_execution_provenance',execution_id:index===0?ID1:ID2,observed_at:value.observed_at,result:'passed',stage:'complete',read_only:true,source_file:V2.path,collector_sha256:V2.sha256,cli_version:'65.8.0',cli_entry_sha256:V2.cli,cli_query_help_sha256:V2.help,query_schema:V2.query,original_entrypoint_executed:false,original_exports_imported:['command','projectBatch','compare'],observation_source_seals:copy(SEALS),observation:{path:file,sha256:sha(body)},provider_reads_initiated:2,maximum_provider_reads:2,automatic_retry:false,raw_cli_persisted:false,raw_stderr_persisted:false})};
 };
 const first=packet(before,0);first.raw=null; // Replace with exact retained bytes, never rewrite the historical receipt.
 return{before:first,after:packet(after,1),attestationRaw:raw({schema_version:'1.0',scope:'actual_Claude_owner_no_reenrollment_attestation',statement_source:'owner_explicit_statement',client_id:CLIENT,project_id:PROJECT,before_request_id:before.project_read.request_id,after_request_id:ID2,before_deployment_id:APPROVED.before.deployment,after_deployment_id:APPROVED.after.deployment,attested_at:'2026-11-02T10:31:00.000Z',no_reenrollment:true})};
}
async function input(){const value=fixtures();value.before.raw=await readFile(path.join(MAIN,BEFORE_OBSERVATION.path));value.before.executionPath=BEFORE_EXECUTION.path;value.before.executionRaw=await readFile(path.join(MAIN,BEFORE_EXECUTION.path));return value;}
function mutate(packet,fn){const value=JSON.parse(packet.raw);fn(value);packet.raw=raw(value);const p=JSON.parse(packet.executionRaw);p.observation.sha256=sha(packet.raw);packet.executionRaw=raw(p);}
test('exact archived pair admits diagnostics-only bridge; synthetic later access is narrowly scoped',async()=>{
 const e=await evidence(),bridge=admitReleasePair(e),i=await input();const result=compareAcrossRelease({bridge,...i});
 assert.equal(result.result,'passed');assert.equal(result.diagnostics_only_product_delta_verified,true);assert.equal(result.owner_no_reenrollment_attested,true);
 for(const key of ['old_expired_bearer_denial_collected','refresh_HTTP_exchange_collected','refresh_token_rotation_storage_verified','targeted_session_revocation_verified','full_lifecycle_verified'])assert.equal(result[key],false);
 assert.equal(JSON.parse(i.before.raw).deployment_id,APPROVED.before.deployment);assert.equal(JSON.parse(i.after.raw).deployment_id,APPROVED.after.deployment);
});
test('wrong pair, altered normal readback, manifest/archive drift and auth source drift fail',async()=>{
 for(const change of [e=>{e.before.readbackRaw=Buffer.from('{}');},e=>{e.after.sourceRaw=Buffer.from('{}');},e=>{e.after.archiveRaw=Buffer.from('drift');},e=>{e.sourceFiles.set('apps/web/lib/mcp-auth.ts',Buffer.from('drift'));},e=>{[e.before,e.after]=[e.after,e.before];}]){const e=await evidence();change(e);assert.throws(()=>admitReleasePair(e),/UNCONFIRMED/u);}
});
test('bridge cannot be forged and session/client/request/trace/deployment mismatches fail',async()=>{
 const bridge=admitReleasePair(await evidence());assert.throws(()=>compareAcrossRelease({bridge:{},...fixtures()}),/UNCONFIRMED/u);
 for(const change of [o=>{o.deployment_id=APPROVED.before.deployment;},o=>{o.verified_token.session_sha256='f'.repeat(64);},o=>{o.verified_token.client_id=ID1;},o=>{o.project_read.request_id=before.project_read.request_id;},o=>{o.verified_token.trace_id=ID1;},o=>{o.project_read.project_id=ID1;},o=>{o.source_seals['apps/web/lib/mcp-auth.ts']='f'.repeat(64);}]){const i=await input();mutate(i.after,change);assert.throws(()=>compareAcrossRelease({bridge,...i}),/UNCONFIRMED/u);}
});
test('expiry, later signed token, exact timestamp and bounded trace correlation remain required',async()=>{
 const bridge=admitReleasePair(await evidence());
 for(const change of [o=>{o.project_read.logged_at=new Date(before.verified_token.exp*1000).toISOString();o.verified_token.logged_at=o.project_read.logged_at;},o=>{o.verified_token.iat=before.verified_token.iat;},o=>{o.verified_token.exp=before.verified_token.exp;},o=>{o.project_read.logged_at='2026-11-02T10:30:00Z';},o=>{o.verified_token.logged_at='2026-11-02T10:29:29.999Z';},o=>{o.since='2026-11-02T10:30:00.001Z';}]){const i=await input();mutate(i.after,change);assert.throws(()=>compareAcrossRelease({bridge,...i}),/UNCONFIRMED/u);}
});
test('explicit owner attestation is mandatory, exact and bound to both actual request IDs',async()=>{
 const bridge=admitReleasePair(await evidence());
 for(const change of [a=>{delete a.no_reenrollment;},a=>{a.no_reenrollment=false;},a=>{a.statement_source='inferred_from_elapsed_time';},a=>{a.before_request_id=ID1;},a=>{a.after_request_id=ID1;},a=>{a.after_deployment_id=APPROVED.before.deployment;},a=>{a.attested_at='2026-11-02T10:29:00.000Z';},a=>{a.note='private extra payload';}]){const i=await input(),a=JSON.parse(i.attestationRaw);change(a);i.attestationRaw=raw(a);assert.throws(()=>compareAcrossRelease({bridge,...i}),/UNCONFIRMED/u);}
 const i=await input();delete i.attestationRaw;assert.throws(()=>compareAcrossRelease({bridge,...i}),/UNCONFIRMED/u);
});
test('passed v2 execution provenance and immutable observation artifact hashes required',async()=>{
 const bridge=admitReleasePair(await evidence());
 for(const change of [p=>{p.result='unconfirmed';},p=>{p.collector_sha256='f'.repeat(64);},p=>{p.provider_reads_initiated=1;},p=>{p.observation.sha256='f'.repeat(64);},p=>{p.raw_stderr_persisted=true;},p=>{p.observation.path=BEFORE_OBSERVATION.path;},p=>{p.observation_source_seals['apps/web/app/mcp/route.ts']='f'.repeat(64);}]){const i=await input(),p=JSON.parse(i.after.executionRaw);change(p);i.after.executionRaw=raw(p);assert.throws(()=>compareAcrossRelease({bridge,...i}),/UNCONFIRMED/u);}
});
test('original compare stays byte-exact and continues refusing cross-deployment observations',async()=>{
 const module=await import(pathToFileURL(path.join(MAIN,'development/m07/completion-oauth/collect.mjs')).href);const i=await input();assert.throws(()=>module.compare(JSON.parse(i.before.raw),JSON.parse(i.after.raw)),/UNCONFIRMED/u);
 const e=await evidence();assert.equal(sha(e.sourceFiles.get('development/m07/completion-oauth/collect.mjs')),SEALS['development/m07/completion-oauth/collect.mjs']);
});
test('file adapter binds safe file refs; missing attestation/hash/private path refuses',async()=>{
 const e=await evidence(),i=await input(),inputPath='tracking/evidence/m07/claude-cross-release-observation/synthetic-input.json',attestationPath='tracking/evidence/m07/claude-cross-release-observation/synthetic-attestation.json';
 const files=new Map(e.sourceFiles);
 for(const key of ['before','after']){const release=APPROVED[key];for(const [kind,rawKey]of [['readback','readbackRaw'],['source','sourceRaw'],['archive','archiveRaw']])files.set(release[kind].path,e[key][rawKey]);files.set(i[key].path,i[key].raw);files.set(i[key].executionPath,i[key].executionRaw);}
 files.set(attestationPath,i.attestationRaw);
 const reference=file=>({path:file,sha256:sha(files.get(file))});
 const value={schema_version:'1.0',before:{observation:reference(i.before.path),execution:reference(i.before.executionPath)},after:{observation:reference(i.after.path),execution:reference(i.after.executionPath)},attestation:reference(attestationPath)};
 const reads=[];const read=async(_root,file,max)=>{reads.push(file);assert.ok(files.has(file));assert.ok(files.get(file).length<=max);return files.get(file);};
 files.set(inputPath,raw(value));assert.equal((await compareFiles('fake-root',inputPath,read)).local_files_written,0);
 for(const change of [v=>{v.attestation.path='.env.local';},v=>{v.after.observation.sha256='f'.repeat(64);},v=>{delete v.attestation;},v=>{v.attestation.path='../private.json';}]){const v=copy(value);change(v);files.set(inputPath,raw(v));await assert.rejects(compareFiles('fake-root',inputPath,read));}
 assert.ok(!reads.includes('.env.local'));await assert.rejects(compareFiles('fake-root','.env.local',read));
});
test('default-off public entry refuses before any nonexistent local evidence path can be read',()=>{
 assert.equal(FILE_COMPARISON_ENABLED,false);
 const result=spawnSync(process.execPath,[path.join(import.meta.dirname,'files.mjs'),'nonexistent-root','not-an-input'],{encoding:'utf8',env:{SystemRoot:process.env.SystemRoot},windowsHide:true});
 assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(result.stderr,'CLAUDE_CROSS_RELEASE_OBSERVATION_UNCONFIRMED; raw diagnostics suppressed.\n');
});
test('local reader accepts only bounded unchanged regular evidence files',async()=>{
 assert.equal(sha(await readRegular(MAIN,BEFORE_OBSERVATION.path,65536)),BEFORE_OBSERVATION.sha256);
 await assert.rejects(readRegular(MAIN,BEFORE_OBSERVATION.path,1),/UNCONFIRMED/u);
 await assert.rejects(readRegular(MAIN,'tracking/evidence/m07/completion-oauth',65536),/UNCONFIRMED/u);
 await assert.rejects(readRegular(MAIN,'../outside.json',65536),/UNCONFIRMED/u);
});
