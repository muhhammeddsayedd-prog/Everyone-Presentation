import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import process from 'node:process';
import { Buffer } from 'node:buffer';
import { APPROVED, BEFORE_OBSERVATION, BEFORE_EXECUTION, AFTER_OBSERVATION, AFTER_EXECUTION, OWNER_STATEMENTS, SEALS, V2, REVIEWED_DELTA, CLIENT, PROJECT } from './approved-pair.mjs';
import { admitReleasePair, compareAcrossRelease, sha } from './compare.mjs';
import { compareFiles, readRegular, FILE_COMPARISON_ENABLED } from './files.mjs';

const MAIN=path.resolve(import.meta.dirname,'../../../../Everyone-Presentation-Studio');
const raw=value=>Buffer.from(JSON.stringify(value));
const copy=value=>JSON.parse(JSON.stringify(value));
async function evidence(){
 const load=async release=>({readbackRaw:await readFile(path.join(MAIN,release.readback.path)),sourceRaw:await readFile(path.join(MAIN,release.source.path)),archiveRaw:await readFile(path.join(MAIN,release.archive.path))});
 return{before:await load(APPROVED.before),after:await load(APPROVED.after),sourceFiles:new Map(await Promise.all(Object.keys({...SEALS,[V2.path]:V2.sha256}).map(async file=>[file,await readFile(path.join(MAIN,file))])))};
}
async function input(){
 const packet=async(observation,execution)=>({path:observation.path,raw:await readFile(path.join(MAIN,observation.path)),executionPath:execution.path,executionRaw:await readFile(path.join(MAIN,execution.path))});
 return{before:await packet(BEFORE_OBSERVATION,BEFORE_EXECUTION),after:await packet(AFTER_OBSERVATION,AFTER_EXECUTION),attestationRaw:raw({schema_version:'1.0',scope:'actual_Claude_owner_no_reconnect_or_signin_statement',statement_source:'owner_explicit_statement',client_id:CLIENT,project_id:PROJECT,before_request_id:'4f3a7c5a-d83f-4e65-9931-306a2db0f101',after_request_id:'1d370c0f-bf80-4e90-a00d-96c933abe721',before_deployment_id:APPROVED.before.deployment,after_deployment_id:APPROVED.after.deployment,recorded_at:'2026-11-02T15:00:00.000Z',statements:OWNER_STATEMENTS,no_reconnect:true,no_sign_in:true})};
}
test('exact immutable J3/B5 archives admit only six reviewed product changes',async()=>{
 const bridge=admitReleasePair(await evidence());assert.ok(bridge);
 assert.equal(Object.keys(REVIEWED_DELTA).length,6);
 assert.equal(APPROVED.before.entries,308);assert.equal(APPROVED.after.entries,309);
 assert.ok(Object.hasOwn(REVIEWED_DELTA,'apps/web/components/SpecsView.tsx'));
 assert.ok(Object.hasOwn(REVIEWED_DELTA,'apps/web/components/RoleEditor.tsx'));
});
test('actual immutable 4f3/1d observations satisfy expiry/session constraints with owner words only in RAM',async()=>{
 const i=await input(),before=JSON.parse(i.before.raw),after=JSON.parse(i.after.raw);
 assert.equal(before.project_read.request_id,'4f3a7c5a-d83f-4e65-9931-306a2db0f101');assert.equal(after.project_read.request_id,'1d370c0f-bf80-4e90-a00d-96c933abe721');
 assert.equal(before.verified_token.session_sha256,after.verified_token.session_sha256);assert.equal(before.verified_token.client_id,after.verified_token.client_id);
 assert.ok(Date.parse(after.project_read.logged_at)>before.verified_token.exp*1000);assert.ok(after.verified_token.iat>before.verified_token.iat);assert.ok(after.verified_token.exp>before.verified_token.exp);
 const result=compareAcrossRelease({bridge:admitReleasePair(await evidence()),...i});
 assert.equal(result.result,'passed');assert.equal(result.owner_no_reconnect_and_no_signin_attested,true);assert.equal(result.reviewed_diagnostics_and_focus_delta_verified,true);
 assert.equal(Object.hasOwn(result,'owner_no_reenrollment_attested'),false);
 for(const key of ['old_expired_bearer_denial_collected','refresh_HTTP_exchange_collected','refresh_token_rotation_storage_verified','targeted_session_revocation_verified','full_lifecycle_verified'])assert.equal(result[key],false);
 assert.equal(OWNER_STATEMENTS[0].includes('haven\u2019t'),true);assert.equal(OWNER_STATEMENTS[1].includes('4f3a7c5a\u2026'),true);
});
test('wrong ordered pair, Ready/readback/archive/source/helper drift refuse',async()=>{
 for(const change of [e=>{[e.before,e.after]=[e.after,e.before];},e=>{e.after.readbackRaw=raw({});},e=>{e.before.sourceRaw=raw({});},e=>{e.after.archiveRaw=Buffer.from('drift');},e=>{e.sourceFiles.set('apps/web/lib/mcp-auth.ts',Buffer.from('drift'));},e=>{e.sourceFiles.set(V2.path,Buffer.from('drift'));}]){
  const e=await evidence();change(e);assert.throws(()=>admitReleasePair(e),/UNCONFIRMED/u);
 }
});
test('both actual observation and v2 provenance bytes and paths are immutable',async()=>{
 const bridge=admitReleasePair(await evidence());
 for(const side of ['before','after'])for(const field of ['raw','executionRaw','path','executionPath']){
  const i=await input();i[side][field]=field.endsWith('Raw')||field==='raw'?raw({}):'tracking/evidence/m07/completion-oauth/substituted.json';
  assert.throws(()=>compareAcrossRelease({bridge,...i}),/UNCONFIRMED/u);
 }
 assert.throws(()=>compareAcrossRelease({bridge:{},...copy({})}),/UNCONFIRMED/u);
});
test('explicit no reconnect and no sign-in statements require exact words and both request IDs',async()=>{
 const bridge=admitReleasePair(await evidence());
 for(const change of [a=>{delete a.no_reconnect;},a=>{a.no_reconnect=false;},a=>{a.no_sign_in=false;},a=>{a.statements[0]+=' altered';},a=>{a.statement_source='inferred_from_timing';},a=>{a.before_request_id='3b4ebef2-b630-45b9-b767-9d5be96d8da5';},a=>{a.after_deployment_id=APPROVED.before.deployment;},a=>{a.recorded_at='2026-11-02T13:57:00.000Z';},a=>{a.no_reenrollment=true;}]){
  const i=await input(),a=JSON.parse(i.attestationRaw);change(a);i.attestationRaw=raw(a);assert.throws(()=>compareAcrossRelease({bridge,...i}),/UNCONFIRMED/u);
 }
 const i=await input();delete i.attestationRaw;assert.throws(()=>compareAcrossRelease({bridge,...i}),/UNCONFIRMED/u);
});
test('original two comparators remain incompatible with this actual pair',async()=>{
 const i=await input(),original=await import(pathToFileURL(path.join(MAIN,'development/m07/completion-oauth/collect.mjs')).href);
 assert.throws(()=>original.compare(JSON.parse(i.before.raw),JSON.parse(i.after.raw)),/UNCONFIRMED/u);
 const previous=await import('../claude-cross-release-observation/compare.mjs'),actualPair=await evidence();assert.throws(()=>previous.admitReleasePair(actualPair),/UNCONFIRMED/u);
});
test('file adapter admits exact public references and rejects private paths or missing statement',async()=>{
 const e=await evidence(),i=await input(),inputPath='tracking/evidence/m07/claude-j3-b5-observation/test-input.json',statementPath='tracking/evidence/m07/claude-j3-b5-observation/test-owner-statement.json';
 const files=new Map(e.sourceFiles);
 for(const side of ['before','after']){
  for(const[kind,key]of[['readback','readbackRaw'],['source','sourceRaw'],['archive','archiveRaw']])files.set(APPROVED[side][kind].path,e[side][key]);
  files.set(i[side].path,i[side].raw);files.set(i[side].executionPath,i[side].executionRaw);
 }
 files.set(statementPath,i.attestationRaw);const ref=p=>({path:p,sha256:sha(files.get(p))});
 const value={schema_version:'1.0',before:{observation:ref(i.before.path),execution:ref(i.before.executionPath)},after:{observation:ref(i.after.path),execution:ref(i.after.executionPath)},attestation:ref(statementPath)};
 const reads=[];const read=async(_root,file,max)=>{reads.push(file);assert.ok(files.has(file));assert.ok(files.get(file).length<=max);return files.get(file);};
 files.set(inputPath,raw(value));assert.equal((await compareFiles('fake-root',inputPath,read)).local_files_written,0);
 for(const change of [v=>{delete v.attestation;},v=>{v.attestation.path='.env.local';},v=>{v.after.observation.sha256='f'.repeat(64);},v=>{v.attestation.path='../private.json';}]){
  const v=copy(value);change(v);files.set(inputPath,raw(v));await assert.rejects(compareFiles('fake-root',inputPath,read));
 }
 assert.ok(!reads.includes('.env.local'));
});
test('default-off entry refuses before files and local reader is bounded',async()=>{
 assert.equal(FILE_COMPARISON_ENABLED,false);
 const r=spawnSync(process.execPath,[path.join(import.meta.dirname,'files.mjs'),'nonexistent-root','not-an-input'],{encoding:'utf8',env:{SystemRoot:process.env.SystemRoot},windowsHide:true});
 assert.equal(r.status,1);assert.equal(r.stdout,'');assert.equal(r.stderr,'CLAUDE_J3_B5_OBSERVATION_UNCONFIRMED; raw diagnostics suppressed.\n');
 assert.equal(sha(await readRegular(MAIN,BEFORE_OBSERVATION.path,65536)),BEFORE_OBSERVATION.sha256);
 await assert.rejects(readRegular(MAIN,BEFORE_OBSERVATION.path,1));await assert.rejects(readRegular(MAIN,'../outside.json',65536));
});
