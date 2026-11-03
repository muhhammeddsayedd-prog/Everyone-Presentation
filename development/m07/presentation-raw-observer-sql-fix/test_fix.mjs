/** Offline real case-flow query collection and PostgreSQL parser regression. */
import assert from 'node:assert/strict';
import {Buffer}from 'node:buffer';
import {createHash}from 'node:crypto';
import {readFile}from 'node:fs/promises';
import {spawnSync}from 'node:child_process';
import {fileURLToPath,URL}from 'node:url';
import test from 'node:test';

const library='file:///D:/Everyone/Presentation/Everyone-Presentation-Studio/development/m07/';
const oldModule=new URL(library+'presentation-raw-companion-batch-proof/raw-authority.mjs');
const oldTests=new URL(library+'presentation-raw-companion-batch-proof/raw-authority.test.mjs');
const fixedModule=new URL('./raw-authority.mjs',import.meta.url);
const hash=x=>createHash('sha256').update(x).digest('hex');
const OLD_SHA='1b7d1743f1c1e7a750d12a26056c3208bbfa024f230386b5296998f02f333896';
const FIXED_SHA='66fc775e5fb5369933117df7c2305134032baa4e6c8a181a525739d1d0890491';
const TEST_SHA='95120d5ce7e9c01fd8e64ba2e666ec9bb9f75276aea06905c413d02b2dca7e5f';
const edits=[["'pin_lock_count',(select count(*)from pg_locks where pid=${sender.pid}and relation=", "'pin_lock_count',(select count(*)from pg_locks where pid=${sender.pid} and relation="],
 ['pid=${sender.pid}and not granted', 'pid=${sender.pid} and not granted']];

async function fixture(module){
 const raw=await readFile(oldTests);assert.equal(hash(raw),TEST_SHA);
 const before=raw.toString('utf8'),marker="\ntest('typed queued clone remaps only new metadata; empty setup never accesses pins or slides',";
 assert.equal(before.split(marker).length,2);let prefix=before.slice(0,before.indexOf(marker));
 const old="from './raw-authority.mjs';";assert.equal(prefix.split(old).length,2);
 prefix=prefix.replace(old,'from '+JSON.stringify(module.href)+';')+'\nexport {context};\n';
 return import('data:text/javascript;base64,'+Buffer.from(prefix).toString('base64'));
}

async function collect(module){
 // The owned worktree lacks unrelated Main library folders. Rewrite only those
 // three import specifiers in RAM for testing; committed module bytes are exact.
 let executable=module;
 if(module===fixedModule){
  let source=await readFile(module,'utf8');
  for(const name of['presentation-lock-source-proof/proof.mjs','presentation-lock-source-pool-proof/native.mjs','presentation-lock-source-pool-proof/cases.mjs']){
   const from="'../"+name+"'";assert.equal(source.split(from).length,2);
   source=source.replace(from,JSON.stringify(library+name));
  }
  executable=new URL('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 }
 const{context}=await fixture(executable),records=[];
 const{verifyRawAuthorityCases}=await import(executable.href);
 for(const variant of['old','candidate']){
  const f=context(variant),request=f.ctx.observer.request;
  f.ctx.observer.request=async sql=>{if(sql.includes('pg_locks'))records.push({variant,sql});return request(sql);};
  await verifyRawAuthorityCases(f.ctx);
  assert.equal(f.ctx.report.raw_authority_cases[variant].completed,true);
 }
 assert(records.length>0);assert(records.every(x=>!x.sql.includes('${')));
 return records;
}

function parse(records){
 const script=`import json,sys\nfrom pglast import parse_sql\nrows=json.load(sys.stdin)\nout=[]\nfor row in rows:\n try:\n  parse_sql(row['sql']);out.append(True)\n except Exception as e:\n  if type(e).__name__!='ParseError':raise\n  out.append(False)\nprint(json.dumps(out))\n`;
 const child=spawnSync('D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe',['-X','utf8','-B','-c',script],
  {input:JSON.stringify(records),encoding:'utf8',timeout:15000,maxBuffer:128*1024,windowsHide:true,shell:false});
 assert.equal(child.status,0,'OFFLINE_POSTGRES_PARSER_NORMAL_EXIT_REQUIRED');assert.equal(child.stderr,'');
 const result=JSON.parse(child.stdout);assert(Array.isArray(result)&&result.length===records.length&&result.every(x=>typeof x==='boolean'));
 return result;
}

test('successor is exactly two inserted spaces and inverse restores frozen consumed bytes',async()=>{
 const old=await readFile(oldModule);assert.equal(hash(old),OLD_SHA);let changed=old.toString('utf8');
 for(const[a,b]of edits){assert.equal(changed.split(a).length,2);changed=changed.replace(a,b);}
 const fixed=await readFile(fixedModule);assert.equal(hash(fixed),FIXED_SHA);assert.equal(fixed.toString('utf8'),changed);assert.equal(fixed.length,old.length+2);
 for(const[a,b]of [...edits].reverse()){assert.equal(changed.split(b).length,2);changed=changed.replace(b,a);}
 assert.equal(hash(changed),OLD_SHA);assert.equal(hash(await readFile(oldModule)),OLD_SHA);
});

test('actual fully interpolated observer SQL is RED before both corrections and GREEN after',async t=>{
 const before=await collect(oldModule),after=await collect(fixedModule);
 assert.equal(before.length,after.length);const red=parse(before),green=parse(after);
 assert(red.some(x=>!x),'OLD_NUMERIC_PID_ADJACENCY_MUST_REPRODUCE_PARSER_FAILURE');
 assert(green.every(Boolean),'ALL_FIXED_OBSERVER_REQUESTS_MUST_PARSE');
 const failed=before.filter((_,i)=>!red[i]);
 t.diagnostic(JSON.stringify({fully_interpolated_observer_queries:before.length,old_parser_failures:failed.length,fixed_parser_failures:green.filter(x=>!x).length}));
 assert(failed.some(x=>/pid=\d+and not granted/u.test(x.sql)));
 assert(failed.some(x=>/pid=\d+and relation=/u.test(x.sql)));
 for(let i=0;i<before.length;i++){
  assert.equal(before[i].variant,after[i].variant);
  assert.equal(before[i].sql.replace(/(pid=\d+)and(?= (?:not granted|relation=))/gu,'$1 and'),after[i].sql);
 }
});

test('each single omitted space still fails the actual collected-query parser',async()=>{
 const records=await collect(fixedModule);
 for(const token of['and not granted','and relation=']){
  const mutated=records.map(row=>({...row,sql:row.sql.replace(new RegExp('(pid=\\d+) '+token,'u'),'$1'+token)}));
  assert(parse(mutated).some(x=>!x),'EACH_OBSERVER_SPACE_IS_REQUIRED');
 }
 assert.equal(fileURLToPath(fixedModule).includes('presentation-raw-observer-sql-fix'),true);
});
