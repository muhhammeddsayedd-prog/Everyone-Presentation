/** Root-only fixed failed-run log projection. No DB, Docker, CLI or network. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,readFile,realpath,writeFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {pathToFileURL} from 'node:url';
const ROOT=path.resolve(import.meta.dirname,'..','..','..');
const RUN='57f2a4fe-d09a-4a70-b791-af85b506c1e9';
const RECEIPT='tracking/evidence/m07/specs-ack31/2026-10-31T01-07-12-383Z-57f2a4fe-local-proof.json';
const RECEIPT_SHA='5039a8f7d6eb2234ee78c7d098d5e324af11745cb92dbfa458999ea70c32bc79';
const SOURCE_SHA='a1057eddeca5e501ccf743d3f1f03e4948eca8c418ee709408041768ed5a6b71';
const PRIVATE=path.join(ROOT,'.local/m07-specs-ack31-local',RUN);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const FIELDS=['private_invoker','owner_ack_execute','public_callers_denied','existing_projection_columns_granted','whole_job_select_still_denied'];
export function projectFailure(value){
 const message=typeof value?.message==='string'?value.message:'',stderr=typeof value?.diagnostic?.stderr==='string'?value.diagnostic.stderr:'',stack=typeof value?.stack==='string'?value.stack:'';
 const state=/\bERROR:\s+([0-9A-Z]{5}):/u.exec(stderr),line=/psql:<stdin>:(\d+):/u.exec(stderr),source=/at (ackReadback|snapshot|checkPreexistingRoles) \([^\r\n]*run-local\.mjs:(\d+):\d+\)/u.exec(stack);
 const fn=/function (?:pg_catalog\.)?(has_column_privilege|has_function_privilege|jsonb_build_object)\(/u.exec(stderr);
 const diffs=[];
 for(const field of FIELDS){const actual=new RegExp('^\\+\\s+'+field+': (true|false),?$','mu').exec(message),expected=new RegExp('^-\\s+'+field+': (true|false),?$','mu').exec(message);
  if(actual&&expected)diffs.push({field,actual:actual[1]==='true',expected:expected[1]==='true'});
 }
 const code=state&&['42501','42601','42703','42883','42P01','42725','57014','P0001','XX000'].includes(state[1])?state[1]:null;
 return {kind:message.includes('deep-equal')?'assertion':stderr?'sql_command':'unclassified',sqlstate:code,sqlstate_explicit:code!==null,
  psql_line:line&&Number(line[1])<=1_000_000?Number(line[1]):null,stack_stage:source?.[1]??null,stack_line:source&&Number(source[2])<=1_000_000?Number(source[2]):null,
  function_name:fn?.[1]??null,undefined_function:/function [^\r\n]* does not exist/u.test(stderr),permission_denied:/permission denied/u.test(stderr),
  syntax_error:/syntax error/u.test(stderr),boolean_differences:diffs,raw_diagnostics_suppressed:true};
}
async function fixedFile(file,max){
 assert.equal(await realpath(file),file);const before=await lstat(file);assert(before.isFile()&&!before.isSymbolicLink()&&before.size>0&&before.size<=max);
 const bytes=await readFile(file),after=await lstat(file);assert.equal(before.dev,after.dev);assert.equal(before.ino,after.ino);assert.equal(before.size,after.size);assert.equal(before.mtimeMs,after.mtimeMs);assert.equal(bytes.length,before.size);return bytes;
}
async function main(){
 assert.equal(process.argv.length,2);const forbidden=new Set(['NODE_OPTIONS','NPM_CONFIG_NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE']);assert(!Object.entries(process.env).some(([key,value])=>forbidden.has(key.toUpperCase())&&value));
 const raw=await fixedFile(path.join(ROOT,RECEIPT),128*1024);assert.equal(sha(raw),RECEIPT_SHA);const receipt=JSON.parse(raw);
 assert.equal(receipt.run_id,RUN);assert.equal(receipt.result,'failed');assert.equal(receipt.checkpoint,'commit-owned30');assert.equal(receipt.source_seals['development/m07/specs-ack31/run-local.mjs'],SOURCE_SHA);
 for(const flag of['actual_owned_database_absent','actual_new_role_absent','original29_full_catalogue_data_settings_roles_oids_memberships_exact','shared_lock_released'])assert.equal(receipt[flag],true);
 assert.equal(receipt.command_process_unconfirmed,false);assert.equal(await realpath(PRIVATE),PRIVATE);
 const owner=JSON.parse(await fixedFile(path.join(PRIVATE,'owner.json'),4096));assert.deepEqual(owner,{workspace:ROOT,run_id:RUN,purpose:'specs-ack31-local'});
 const failure=JSON.parse(await fixedFile(path.join(PRIVATE,'failure-private.json'),4*1024*1024));
 const report={schema_version:'1.0',observed_at:new Date().toISOString(),result:'diagnosed',failed_run_id:RUN,failed_receipt_sha256:RECEIPT_SHA,
  ...projectFailure(failure),private_file_contents_persisted:false,database_or_provider_called:false};
 const file=path.join(ROOT,'tracking/evidence/m07/specs-ack31',new Date().toISOString().replaceAll(':','-')+'-57f2a4fe-failure-diagnostic.json');
 await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});process.stdout.write(JSON.stringify({result:report.result,receipt:path.relative(ROOT,file).replaceAll('\\','/'),...projectFailure(failure)})+'\n');
}
if(process.argv[1]&&pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url)main().catch(()=>{process.stderr.write('ACK31_FIXED_FAILURE_DIAGNOSTIC_UNCONFIRMED\n');process.exitCode=1;});
