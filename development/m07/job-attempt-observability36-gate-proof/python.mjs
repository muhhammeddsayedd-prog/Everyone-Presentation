/** Fixed existing isolated Python, bounded private JSON, no CLI/provider action. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { lstat,readFile,realpath } from 'node:fs/promises';
import path from 'node:path';
import { executionEnvironment } from '../workspace-summary35-proof/run.mjs';
import { sha } from '../recovery33/compiler.mjs';
export const PYTHON_RELATIVE='.venv-skills/Scripts/python.exe';
export const PYTHON_SHA='9b7bffc26240463c965a2a2a5fada1d8e741c21c25cd2e977728c339b82d9977';
export async function verifyPython(root){
 const executable=path.join(root,PYTHON_RELATIVE),info=await lstat(executable);
 assert(info.isFile()&&!info.isSymbolicLink()&&info.nlink===1&&info.size===255200,'ATTEMPT36_GATE_PYTHON_REQUIRED');
 assert.equal(await realpath(executable),executable);assert.equal(sha(await readFile(executable)),PYTHON_SHA);return executable;
}
export async function runPython(root,action,value){
 assert(['queries','validate'].includes(action));const executable=await verifyPython(root);
 const input=action==='queries'?'':JSON.stringify(value);assert(Buffer.byteLength(input)<=4*1024*1024);
 const output=await new Promise((resolve,reject)=>{
  const child=spawn(executable,['-I','-X','utf8',path.join(root,'development/m07/job-attempt-observability36-gate-proof/bridge.py'),action],
   {cwd:root,shell:false,windowsHide:true,env:executionEnvironment(),stdio:['pipe','pipe','pipe']});
  const chunks=[];let size=0,failed=false;const timer=setTimeout(()=>{failed=true;child.kill();},30000);
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024){failed=true;child.kill();}else chunks.push(chunk);});
  child.stderr.on('data',chunk=>{size+=chunk.length;if(size>4*1024*1024){failed=true;child.kill();}});
  child.once('error',()=>{clearTimeout(timer);reject(Error('ATTEMPT36_GATE_PYTHON_UNCONFIRMED'));});
  child.once('close',code=>{clearTimeout(timer);if(failed||code!==0)reject(Error('ATTEMPT36_GATE_PYTHON_UNCONFIRMED'));
   else resolve(Buffer.concat(chunks).toString('utf8'));});
  child.stdin.on('error',()=>{});child.stdin.end(input);
 });
 return JSON.parse(output);
}
