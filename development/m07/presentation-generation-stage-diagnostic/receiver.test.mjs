/** Real pinned receiver + passive getter, fake child only; no process/SQL. */
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile}from 'node:fs/promises';
import {EventEmitter}from 'node:events';
import {PassThrough}from 'node:stream';
import {URL}from 'node:url';
import {PHASES}from './markers.mjs';
const RUN='00000000-0000-4000-8000-000000000001';
const KEY=Symbol.for('eps.stage.receiver.fake');
const source=await readFile(new URL('./session.mjs',import.meta.url),'utf8');
const spawnBefore="import { spawn } from 'node:child_process';";
const spawnAfter='import { spawn } from '+JSON.stringify('data:text/javascript,'+encodeURIComponent("export const spawn=(...args)=>globalThis[Symbol.for('eps.stage.receiver.fake')].spawn(...args);"))+';';
const markerBefore="from './markers.mjs'",markerAfter='from '+JSON.stringify(new URL('./markers.mjs',import.meta.url).href);
assert.equal(source.split(spawnBefore).length,2);assert.equal(source.split(markerBefore).length,2);
const projected=source.replace(spawnBefore,spawnAfter).replace(markerBefore,markerAfter);
assert.equal(projected.replace(markerAfter,markerBefore).replace(spawnAfter,spawnBefore),source);
const {session}=await import('data:text/javascript,'+encodeURIComponent(projected));

test('actual normal receiver keeps late stderr markers until child close without exposing other buffers',async()=>{
 const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{};
 globalThis[KEY]={spawn(command,args){assert.equal(command,'docker');assert(Array.isArray(args));return child;}};
 const owned=session({root:'D:/synthetic-stage-owned',runId:RUN,psqlArgs:()=>[],sessions:[]},'stage_mcp_large');
 child.stdin.on('data',raw=>{const m=/__locksource41_marker','([a-f0-9-]+)'/u.exec(raw.toString());if(m)child.stdout.write(JSON.stringify({__locksource41_marker:m[1]})+'\n');});
 assert.deepEqual(await owned.request('select synthetic_receiver_only;'),[]);
 assert.equal(owned.stageRecords().events.length,0);
 child.stderr.write('PRIVATE_UNRELATED_SQL_CANARY\n');
 for(let i=0;i<PHASES.length;i++)child.stderr.write(`NOTICE: 00000: EPS_STAGE_V1|${RUN}|${PHASES[i]}|${1000+i}\nLOCATION: unrelated diagnostic source\n`);
 const finished=owned.finish();child.stdout.end();child.stderr.end();child.emit('close',0);await finished;assert.equal(await owned.done,0);
 const records=owned.stageRecords();assert.equal(records.events.length,14);assert(!JSON.stringify(records).includes('PRIVATE_UNRELATED'));assert(!JSON.stringify(records).includes('LOCATION'));
 assert.equal('stderr'in owned,false);assert.equal('stdout'in owned,false);delete globalThis[KEY];
});
