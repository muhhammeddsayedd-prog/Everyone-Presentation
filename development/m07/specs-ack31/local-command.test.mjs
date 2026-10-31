import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {test} from 'node:test';
import {Buffer} from 'node:buffer';
import {boundedCommand} from './local-command.mjs';
function setup(){
 const child=new EventEmitter();child.pid=42001;child.kills=0;child.unref=()=>{child.unreferenced=true;};child.kill=()=>{child.kills++;};
 for(const name of ['stdin','stdout','stderr']){child[name]=new EventEmitter();child[name].destroy=()=>{child[name].destroyed=true;};}child.stdin.end=()=>{};
 let expire;const unknown=[];
 const options={cwd:'synthetic',timeoutMs:10,maximumBytes:16,setTimer:callback=>{expire=callback;return 1;},clearTimer:()=>{},onUnconfirmed:value=>unknown.push(value)};
 const run=()=>boundedCommand(()=>child,'fixed',['synthetic'],options);return{child,run,unknown,expire:()=>expire()};
}
test('a timeout settles without a close event and retains unresolved child identity',async()=>{
 const s=setup(),promise=s.run();s.expire();await assert.rejects(promise,/ACK31_LOCAL_COMMAND_TIMEOUT_UNCONFIRMED/u);
 assert.deepEqual(s.unknown,[{pid:42001,reason:'timeout'}]);assert.equal(s.child.kills,1);assert.equal(s.child.unreferenced,true);
 for(const key of ['stdin','stdout','stderr'])assert.equal(s.child[key].destroyed,true);
});
test('output overflow never waits for close or publishes captured payload',async()=>{
 const s=setup(),promise=s.run();s.child.stderr.emit('data',Buffer.from('SYNTHETIC_PRIVATE_OVERFLOW'));
 await assert.rejects(promise,error=>error.message==='ACK31_LOCAL_COMMAND_OVERFLOW_UNCONFIRMED'&&!error.message.includes('PRIVATE'));
 assert.deepEqual(s.unknown,[{pid:42001,reason:'overflow'}]);
});
test('a known SQL failure can be returned only after actual close; signal exit stays unknown',async()=>{
 const s=setup(),known=boundedCommand(()=>s.child,'fixed',[],{cwd:'synthetic',setTimer:()=>1,clearTimer:()=>{},allowFailure:true});
 s.child.emit('close',3);assert.equal((await known).code,3);
 const other=setup(),unknown=other.run();other.child.emit('close',null);await assert.rejects(unknown);assert.deepEqual(other.unknown,[{pid:42001,reason:'signal'}]);
});
