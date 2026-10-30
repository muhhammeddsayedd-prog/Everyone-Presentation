/** Fresh-process native workload consumer; synthetic files and metadata only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { prepareVideoIsolated } from '../apps/worker/src/video-container.ts';
import { validateVideoInput } from '../apps/worker/src/video-native.ts';
import { resumeWorkload, runBoundedWorkload, summarizeWorkload } from './m07-workload.mjs';
const ROOT=path.resolve(import.meta.dirname,'..'),runId=process.argv[2],phase=process.argv[3];
assert.equal(process.argv.length,4);assert(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(runId));assert(['first','resume'].includes(phase));
const folder=path.join(ROOT,'.local/m07-workload',runId);assert.equal(await realpath(folder),folder);const owner=JSON.parse(await readFile(path.join(folder,'owner.json'),'utf8'));assert.deepEqual(owner,{run_id:runId,purpose:'m07-synthetic-native-workload',workspace:ROOT});
const config=JSON.parse(await readFile(path.join(folder,'configuration.json'),'utf8'));assert(/^sha256:[a-f0-9]{64}$/u.test(config.image_id));assert.equal(config.concurrency,2);assert(Number.isSafeInteger(config.deadline_ms));assert(config.deadline_ms<=Date.now()+15*60*1000);
let state=JSON.parse(await readFile(path.join(folder,'checkpoint.json'),'utf8'));if(phase==='resume')state=resumeWorkload(state);assert.equal(state.run_id,runId);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');let writing=Promise.resolve(),lastProgress=-1;
async function snapshot(value){const serialized=JSON.stringify(value,null,2)+'\n';writing=writing.then(async()=>{const temporary=path.join(folder,'checkpoint-writing.json');await writeFile(temporary,serialized,{mode:0o600});await rename(temporary,path.join(folder,'checkpoint.json'));});await writing;const complete=value.items.filter(item=>['succeeded','failed','unconfirmed'].includes(item.status)).length;if(complete%20===0&&complete!==lastProgress){lastProgress=complete;console.log(JSON.stringify({event:'m07_synthetic_native_progress',phase,completed:complete,total:value.items.length}));}}
try{
 await runBoundedWorkload(state,async(item,attempt)=>{
  if(item.id==='file-198'&&attempt===1)throw{code:'VIDEO_CONTAINER_UNAVAILABLE',retryable:true,outcome:'known',native_called:false};
  const file=path.join(folder,'inputs',item.file);const info=await lstat(file);assert(info.isFile()&&!info.isSymbolicLink());assert.equal(await realpath(file),file);assert.equal(info.size,item.size_bytes);const bytes=await readFile(file);assert.equal(sha(bytes),item.sha256);const input={source_asset_id:item.id,bytes,mime_type:item.mime_type};
  try{validateVideoInput(input);}catch(error){throw{code:error.code,retryable:false,native_called:false};}
  const remaining=Math.min(30000,config.deadline_ms-Date.now());if(remaining<1)throw{code:'WORKLOAD_DEADLINE',retryable:false,native_called:false};
  try{const prepared=await prepareVideoIsolated(input,{imageId:config.image_id,probeOnly:item.mode==='probe',signal:AbortSignal.timeout(remaining)});item.native_metadata={duration_ms:prepared.probe.duration_ms,width:prepared.probe.width,height:prepared.probe.height,frame_rate:prepared.probe.frame_rate,video_codec:prepared.probe.video_codec,has_audio:prepared.probe.has_audio,sampled_frames:prepared.sampled_frames.length,audio_chunks:prepared.audio_chunks.length,ffmpeg_version:prepared.ffmpeg_version};return{native_called:true};}
  catch(error){throw{code:error.code,retryable:false,native_called:true};}
 },{concurrency:2,maximum_items:phase==='first'?40:200,maximum_attempts:2,deadline_ms:config.deadline_ms,snapshot});
 await snapshot(state);await writing;const summary=summarizeWorkload(state);await writeFile(path.join(folder,`${phase}-process.json`),JSON.stringify({phase,pid:process.pid,finished_at:new Date().toISOString(),summary},null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({event:'m07_synthetic_native_phase_finished',phase,pid:process.pid,summary}));
}catch{await writing.catch(()=>{});console.error(JSON.stringify({event:'m07_synthetic_native_phase_unconfirmed',phase,code:'WORKLOAD_NATIVE_PHASE_UNCONFIRMED'}));process.exitCode=1;}
