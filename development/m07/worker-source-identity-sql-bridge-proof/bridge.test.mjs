import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { EventEmitter } from 'node:events';
import path from 'node:path';
import test from 'node:test';
import { setTimeout } from 'node:timers';
import { DEADLINE,LIMIT,diagnosticBridge,privateWrite } from './bridge.mjs';

const MAIN='D:/Everyone/Presentation/Everyone-Presentation-Studio';
const id='00000000-0000-4000-8000-000000000001';
function fixture(mode='normal'){
 const files=new Map(),order=[],ctx={root:MAIN,privateRoot:path.join(MAIN,'.local/worker-source-identity-sql-bridge-proof',id),runId:id,report:{private_acl_verified:true}};
 let calls=0,kills=0,deadline;
 const ports={uuid:()=>id,write:async(_ctx,name,raw)=>{assert(!files.has(name),'EXCLUSIVE');files.set(name,Buffer.from(raw));order.push(name);return{path:name,sha256:'a'.repeat(64),bytes:raw.length};},
  setTimeout:(callback,ms)=>{assert.equal(ms,30000);deadline=callback;return setTimeout(()=>{},60000);},
  spawn:(exe,args,options)=>{
   calls++;assert.equal(exe,MAIN+'/.venv-skills/Scripts/python.exe');assert.deepEqual(args,['-X','utf8','-B',MAIN+'/development/m07/worker-source-identity-sql-proof/local.py','render']);
   assert.equal(options.cwd,MAIN);assert.equal(options.shell,false);assert.equal(options.windowsHide,true);assert(!Object.hasOwn(options,'env'));assert(order.some(name=>name.endsWith('-claim.json')));
   const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin=new EventEmitter();
   child.kill=()=>{kills++;globalThis.queueMicrotask(()=>child.emit('close',null,'SIGTERM'));return true;};
   child.stdin.end=raw=>{assert.equal(Buffer.from(raw).toString(),'\u007b"private":"PRIVATE_INPUT_CANARY"}');globalThis.queueMicrotask(()=>{
    if(mode==='timeout'){deadline();return;}
    if(mode==='spawn'){child.emit('error',Error('PRIVATE_SPAWN_CANARY'));return;}
    if(mode==='overflow'){child.stdout.emit('data',Buffer.alloc(LIMIT+1,65));return;}
    if(mode==='stderr'){child.stderr.emit('data',Buffer.from('PRIVATE_STDERR_CANARY'));child.emit('close',0);return;}
    if(mode==='exit'){child.stderr.emit('data',Buffer.from('PRIVATE_NATIVE_ERROR'));child.emit('close',7);return;}
    if(mode==='json'){child.stdout.emit('data',Buffer.from('PRIVATE_INVALID_JSON'));child.emit('close',0);return;}
    const output=Buffer.from('{"value":"PRIVATE_RESULT_العربية"}'),cut=output.indexOf(Buffer.from('العربية'))+1;
    child.stdout.emit('data',output.subarray(0,cut));child.stdout.emit('data',output.subarray(cut));child.emit('close',0);
   });};return child;
  }};
 return{ctx,ports,files,order,count:()=>({calls,kills})};
}

test('exact input+permanent claim precede same CLI; raw buffers retained privately before returned JSON',async()=>{
 const f=fixture();const output=await diagnosticBridge('render',{private:'PRIVATE_INPUT_CANARY'},f.ctx,f.ports);
 assert.equal(output.value,'PRIVATE_RESULT_العربية');assert.equal(f.count().calls,1);assert.equal(f.count().kills,0);
 const values=[...f.files.entries()];assert(values[0][0].endsWith('-input.json'));assert(values[1][0].endsWith('-claim.json'));
 assert.equal(values[0][1].toString(),'{"private":"PRIVATE_INPUT_CANARY"}');
 assert(values.some(([name,raw])=>name.endsWith('-stdout.bin')&&raw.equals(Buffer.from(JSON.stringify(output)))));
 const [safe]=f.ctx.report.worker40_bridge_diagnostics;assert.equal(safe.stage,'complete');assert.equal(safe.json_parse_passed,true);assert.equal(safe.stdout_bytes,Buffer.byteLength(JSON.stringify(output)));
 assert(!JSON.stringify(f.ctx.report).includes('PRIVATE_'));assert.equal(DEADLINE,30000);assert.equal(LIMIT,33554432);
 await assert.rejects(diagnosticBridge('render',{private:'PRIVATE_INPUT_CANARY'},f.ctx,f.ports),/EXCLUSIVE/u);assert.equal(f.count().calls,1);
});
test('closed exit/stderr/spawn/JSON failure metadata preserves private raw output and never retries',async()=>{
 for(const mode of['exit','stderr','spawn','json']){
  const f=fixture(mode);await assert.rejects(diagnosticBridge('render',{private:'PRIVATE_INPUT_CANARY'},f.ctx,f.ports),e=>{
   assert.equal(e.message,'WORKER40_BRIDGE_DIAGNOSTIC_REFUSED');assert.equal(e.diagnostic.stage,mode);assert(!JSON.stringify(e.diagnostic).includes('PRIVATE_'));return true;
  });assert.equal(f.count().calls,1);assert([...f.files.keys()].some(name=>name.endsWith('-outcome.json')));
  if(mode==='spawn')assert([...f.files.entries()].some(([name,raw])=>name.endsWith('-error.bin')&&raw.includes(Buffer.from('PRIVATE_SPAWN_CANARY'))));
 }
});
test('30s timeout kills once, retains claim and reports actual unknown exit without invented native code',async()=>{
 const f=fixture('timeout');await assert.rejects(diagnosticBridge('render',{private:'PRIVATE_INPUT_CANARY'},f.ctx,f.ports),e=>{
  assert.equal(e.diagnostic.stage,'timeout');assert.equal(e.diagnostic.timed_out,true);assert.equal(e.diagnostic.exit_code,null);return true;
 });assert.deepEqual(f.count(),{calls:1,kills:1});
});
test('combined32MiB overflow retains at most the same cap and refuses without JSON acceptance',async()=>{
 const f=fixture('overflow');await assert.rejects(diagnosticBridge('render',{private:'PRIVATE_INPUT_CANARY'},f.ctx,f.ports),e=>{
  assert.equal(e.diagnostic.stage,'overflow');assert.equal(e.diagnostic.stdout_bytes,LIMIT+1);assert.equal(e.diagnostic.retained_output_bytes,LIMIT);assert.equal(e.diagnostic.json_parse_passed,false);return true;
 });assert.deepEqual(f.count(),{calls:1,kills:1});assert.equal([...f.files.entries()].find(([name])=>name.endsWith('-stdout.bin'))[1].length,LIMIT);
});
test('unverified private root/action/input is refused before custody or child',async()=>{
 for(const kind of['acl','action','input']){
  const f=fixture();if(kind==='acl')f.ctx.report.private_acl_verified=false;
  await assert.rejects(diagnosticBridge(kind==='action'?'exec':'render',kind==='input'?{value:'x'.repeat(LIMIT)}:{private:'PRIVATE_INPUT_CANARY'},f.ctx,f.ports));
  assert.equal(f.count().calls,0);assert.equal(f.files.size,0);
 }
 const f=fixture();await assert.rejects(privateWrite({...f.ctx,privateRoot:MAIN},'owned.json',Buffer.from('{}')));assert.equal(f.files.size,0);
});
