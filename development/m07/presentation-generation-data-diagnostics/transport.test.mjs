/** Actual pinned receiver logic with a fake child stream; no process or DB. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { URL } from 'node:url';
import { preserveFirstOwnedError } from './capture.mjs';

const stateKey=Symbol.for('eps.owned.session.receiver.test');
const frozen=await readFile(new URL('../presentation-lock-source-proof/session.mjs',import.meta.url),'utf8');
assert.equal(createHash('sha256').update(frozen).digest('hex'),'ddb76b4db7bb578c2dfa2896fd59451037679c9a5fc2777a13412765c296e252');
const before="import { spawn } from 'node:child_process';";
const fake="export const spawn=(...args)=>globalThis[Symbol.for('eps.owned.session.receiver.test')].spawn(...args);";
const after='import { spawn } from '+JSON.stringify('data:text/javascript,'+encodeURIComponent(fake))+';';
assert.equal(frozen.split(before).length,2);
const projected=frozen.replace(before,after);assert.equal(projected.replace(after,before),frozen);
const {session}=await import('data:text/javascript,'+encodeURIComponent(projected));

function child(){
 const value=new EventEmitter();value.stdout=new PassThrough();value.stderr=new PassThrough();value.stdin=new PassThrough();value.kill=()=>{};return value;
}

test('real receiver close path attaches the exact stdout/stderr buffers before cleanup',async()=>{
 const process=child(),records=[],report={},sessions=preserveFirstOwnedError([],async value=>records.push(value),report);
 globalThis[stateKey]={spawn(command,args){assert.equal(command,'docker');assert(Array.isArray(args));return process;}};
 const owned=session({root:'D:/synthetic-owned',runId:'00000000-0000-4000-8000-000000000001',psqlArgs:()=>[],sessions},'holder');
 const pending=owned.request('select pg_temp.locksource41_cohorts(null,null);');
 process.stdout.write('PRIVATE_REAL_RECEIVER_STDOUT\n');process.stderr.write('ERROR: 57014: PRIVATE_REAL_RECEIVER_STDERR\n');process.emit('close',1);
 await assert.rejects(pending,error=>error.message==='LOCKSOURCE41_SESSION_FAILED'&&error.diagnostic.stdout==='PRIVATE_REAL_RECEIVER_STDOUT\n'&&error.diagnostic.stderr==='ERROR: 57014: PRIVATE_REAL_RECEIVER_STDERR\n');
 assert.equal(await owned.done,1);assert.equal(records.length,1);assert.equal(records[0].stderr,'ERROR: 57014: PRIVATE_REAL_RECEIVER_STDERR\n');
 assert.equal(report.first_native_error_capture.phase,'source_cohort_read');assert.equal(report.first_native_error_capture.native_sqlstate,'57014');assert(!JSON.stringify(report).includes('PRIVATE_REAL_RECEIVER'));
 delete globalThis[stateKey];
});

test('real receiver child-error path retains empty buffers without inventing native status',async()=>{
 const process=child(),records=[],report={},sessions=preserveFirstOwnedError([],async value=>records.push(value),report);
 globalThis[stateKey]={spawn:()=>process};
 const owned=session({root:'D:/synthetic-owned',runId:'00000000-0000-4000-8000-000000000001',psqlArgs:()=>[],sessions},'holder');
 const pending=owned.request('select 1;');
 process.emit('error',Object.assign(Error('SYNTHETIC_PIPE'),{code:'EPIPE'}));process.emit('close',1);
 await assert.rejects(pending,error=>error.message==='LOCKSOURCE41_SESSION_FAILED'&&error.diagnostic.stdout===''&&error.diagnostic.stderr==='');
 assert.equal(await owned.done,1);assert.equal(records.length,1);assert.equal(report.first_native_error_capture.native_sqlstate,null);
 delete globalThis[stateKey];
});
