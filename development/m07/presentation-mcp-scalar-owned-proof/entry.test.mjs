/** Fake SQL ports and owned temporary files only; no process/database call. */
import assert from 'node:assert/strict';
import {createHash}from 'node:crypto';
import {mkdtemp,readFile,rm}from 'node:fs/promises';
import {tmpdir}from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {projectResults,renderProof,runProof}from './entry.mjs';
const sha=value=>createHash('sha256').update(value).digest('hex');
const clone=value=>JSON.parse(JSON.stringify(value));
const final={result:'passed_local_scalar_parity',signed_OAuth_or_hosted_acceptance:false,rollback_required:true,target_function_restored_before_rollback:true,deterministic_collation_verified:true,one_target_prosrc_only:true,public_validator_unchanged:true};
function fixture(){
 const expected=[],rows=[];
 for(const variant of['old','candidate'])for(let i=0;i<61;i++){
  const name='synthetic-case-'+i;expected.push({variant,case:name});
  rows.push({variant,case:name,outcome:i===0?'dto':i===1?'null':i===2?'native22P02':i===3?'native42501':'false',native_code:i===2?'22P02':i===3?'42501':null,dto_sha256:i===0?'a'.repeat(64):null});
 }
 return{expected,rows,stdout:[...rows,final].map(x=>JSON.stringify(x)).join('\n')+'\n'};
}
test('closed122 case set pairs bool/NULL/native and public DTO hashes',()=>{
 const f=fixture(),result=projectResults(f.stdout,f.expected);assert.equal(result.case_count,122);assert.equal(result.exact_old_new_case_parity,true);
 assert.equal(result.signed_OAuth_or_hosted_acceptance,false);
 for(const mutate of[
  rows=>rows.pop(),rows=>{rows[61].dto_sha256='b'.repeat(64);},rows=>{rows[64].native_code='57014';},
  rows=>{rows[65].private_claim='PRIVATE_CANARY';},rows=>{rows[65].outcome='true';},
 ]){const rows=clone(f.rows);mutate(rows);assert.throws(()=>projectResults([...rows,final].map(x=>JSON.stringify(x)).join('\n'),f.expected));}
 assert.throws(()=>projectResults(f.stdout+JSON.stringify({claims:'PRIVATE_CANARY'})+'\n',f.expected));
});
test('render binds exact system/run and refuses malformed or same original target',()=>{
 const template='8a100000-0000-4000-8000-000000000001',text="begin;select '__OWNED_SYSTEM__','__ORIGINAL_SYSTEM__','"+template+"';rollback;";
 const cfg={proof_sql:text,proof_sql_sha256:sha(text),template_run:template};
 const run='8a100000-0000-4000-8000-000000000002';
 assert(renderProof(cfg,run,{database:'project39',system_identifier:'12345'},'67890').includes(run));
 assert.throws(()=>renderProof(cfg,run,{database:'project39',system_identifier:'12345'},'12345'));
 assert.throws(()=>renderProof(cfg,run,{database:'postgres',system_identifier:'12345'},'67890'));
});
test('real private file custody precedes malformed result refusal; one fake proof dispatch',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'mcp-scalar-proof-'));
 try{
  const template='8a100000-0000-4000-8000-000000000001',text="begin;select '__OWNED_SYSTEM__','__ORIGINAL_SYSTEM__','"+template+"';rollback;";
  const cfg={proof_sql:text,proof_sql_sha256:sha(text),template_run:template,expected_cases:fixture().expected};let calls=0;
  const report={};const ctx={privateRoot:folder,runId:'8a100000-0000-4000-8000-000000000002',identity:{database:'project39',system_identifier:'12345'},originalSystem:'67890',report,
   baseline:async()=>({full:'unchanged'}),sql:async sql=>sql.includes('begin read only;')?{code:0,stdout:JSON.stringify({users:{count:0,sha256:'a'},sessions:{count:0,sha256:'b'}})+'\n',stderr:''}:(calls++,{code:0,stdout:'{"private_claim":"PRIVATE_CANARY"}\n',stderr:'PRIVATE_SYNTHETIC_ERROR'})};
  await assert.rejects(runProof(ctx,cfg));assert.equal(calls,1);assert.equal(report.mcp_scalar,undefined);
  const stored=JSON.parse(await readFile(path.join(folder,'mcp-scalar-proof-normal-output.json'),'utf8'));assert(stored.stdout.includes('PRIVATE_CANARY'));
 }finally{
  assert(path.resolve(folder).startsWith(path.resolve(tmpdir())+path.sep));await rm(folder,{recursive:true,force:true});
 }
});
