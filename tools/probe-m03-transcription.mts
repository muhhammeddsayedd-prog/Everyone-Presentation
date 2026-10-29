/** Root-authorized ONE direct provider diagnosis. Never app acceptance. */
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {lstat,mkdir,readFile,writeFile} from 'node:fs/promises';
import {transcribeAudio,openAIMediaConfigFromEnv} from '../packages/integrations/src/openai-media.ts';
import {IntegrationError} from '../packages/integrations/src/errors.ts';
import {loadWorkerPrivateEnvironment} from './worker-private-env.mjs';
import {loadCandidateRuntimeEnvironment} from './candidate-runtime-env.mjs';
const SOURCE_SHA='260b82845e677126cfcdc0d99479eaf22eec13c84f6a4c8845e7fd95c49d1010';
const AUDIO_SHA='cccfa052790adb1cb4b8c528dc1082abea3aa0bf987a8adae2d7e6b32c233e63';
const SOURCE_ID='b4dc1c1d-6b7c-45b1-a4ed-b0063372b57f';
const CACHE='.local/m03-media-private/authorized-video-5.json';
const PRIVATE='.local/m03-live-evidence';
const INTENT=`${PRIVATE}/transcription-probe-authorized-once.intent.json`;
const hash=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const run=randomUUID();
const report:Record<string,unknown>={run_id:run,started_at:new Date().toISOString(),result:'unconfirmed',
 scope:'One root-authorized direct OpenAI transcription diagnosis from the already-authorized private cached derivative; not an app/job/n8n acceptance run.',
 source_asset_id:SOURCE_ID,source_sha256:SOURCE_SHA,audio_sha256:AUDIO_SHA,cloud_database_called:false,storage_called:false,n8n_called:false,
 worker_restarted:false,job_or_lease_modified:false,provider_invocation_attempted:false,provider_invocation_succeeded:false,provider_invocation_uncertain:false,
 raw_source_transcript_provider_body_or_credentials_in_public_receipt:false};
try{
 assert.equal(process.argv.length,2);assert.equal(process.env.N8N_API_KEY,undefined);
 const sdk=JSON.parse(await readFile('node_modules/openai/package.json','utf8'));assert.equal(sdk.version,'7.45.1');
 const info=await lstat(CACHE);assert(info.isFile()&&!info.isSymbolicLink()&&info.size>0&&info.size<32*1024*1024);
 const cacheBytes=await readFile(CACHE);const cached=JSON.parse(cacheBytes.toString('utf8'));const native=cached.result;
 assert.equal(native.source_sha256,SOURCE_SHA);assert.equal(native.probe.duration_ms,19800);assert.equal(native.audio_chunks.length,1);
 const chunk=native.audio_chunks[0];const bytes=Buffer.from(chunk.bytes,'base64');
 assert.equal(chunk.index,0);assert.equal(chunk.start_ms,0);assert.equal(chunk.end_ms,19800);assert.equal(chunk.mime_type,'audio/mpeg');
 assert.equal(bytes.length,79816);assert.equal(chunk.sha256,AUDIO_SHA);assert.equal(hash(bytes),AUDIO_SHA);
 const provider=await loadWorkerPrivateEnvironment();const candidate=await loadCandidateRuntimeEnvironment();
 const configuration=openAIMediaConfigFromEnv('transcription',{OPENAI_API_KEY:provider.OPENAI_API_KEY,OPENAI_TRANSCRIPTION_MODEL:candidate.OPENAI_TRANSCRIPTION_MODEL});
 report.requested_model=configuration.model;report.sdk_version=sdk.version;report.audio_bytes=bytes.length;report.audio_duration_ms=19800;report.private_cache_sha256=hash(cacheBytes);
 report.harness_sha256=hash(await readFile(import.meta.filename));
 await mkdir(PRIVATE,{recursive:true});
 // A fixed exclusive intent prevents a second request after interruption or an
 // uncertain response. Never delete or rotate this marker as an automatic retry.
 await writeFile(INTENT,JSON.stringify({run_id:run,authorized_single_probe:true,audio_sha256:AUDIO_SHA,source_sha256:SOURCE_SHA,requested_model:configuration.model,created_at:new Date().toISOString()})+'\n',{flag:'wx',mode:0o600});
 report.provider_invocation_attempted=true;report.provider_invocation_uncertain=true;const began=Date.now();
 const output=await transcribeAudio({source_asset_id:SOURCE_ID,chunks:[{index:0,start_ms:0,end_ms:19800,mime_type:'audio/mpeg',sha256:AUDIO_SHA,bytes}]},configuration,undefined,AbortSignal.timeout(70000));
 report.elapsed_ms=Date.now()-began;report.provider_invocation_succeeded=true;report.provider_invocation_uncertain=false;
 const product=Buffer.from(JSON.stringify(output));await writeFile(`${PRIVATE}/transcription-probe-${run}.json`,product,{flag:'wx',mode:0o600});
 report.private_product_output_saved=true;report.private_product_sha256=hash(product);report.segment_count=output.result.segments.length;
 report.text_sha256=hash(output.result.original_text);report.text_characters=output.result.original_text.length;
 report.has_arabic=/[\u0600-\u06ff]/u.test(output.result.original_text);report.has_latin=/[A-Za-z]/u.test(output.result.original_text);
 report.provider_metadata=output.metadata.map(value=>({provider:value.provider,sdk_version:value.sdk_version,requested_model:value.requested_model,resolved_model:value.resolved_model,
  prompt_version:value.prompt_version,input_sha256:value.input_sha256,audio_duration_ms:value.audio_duration_ms,
  request_id_present:value.request_id!==null,request_id_sha256:value.request_id===null?null:hash(value.request_id),response_id_present:value.response_id!==null,response_id_sha256:value.response_id===null?null:hash(value.response_id),
  usage:Object.fromEntries(Object.entries(value.usage??{}).filter(([key,value])=>['input_tokens','output_tokens','total_tokens','seconds'].includes(key)&&typeof value==='number'&&Number.isFinite(value)&&value>=0))}));
 report.result='passed';report.request_status='completed';
}catch(error:unknown){
 const integrationCodes=['OPENAI_CONFIGURATION_INVALID','TRANSCRIPTION_SOURCE_INVALID','TRANSCRIPTION_RESULT_INVALID','TRANSCRIPTION_EMPTY','AI_RESULT_INVALID','OPENAI_ACCESS_DENIED','OPENAI_QUOTA_EXCEEDED','OPENAI_RATE_LIMITED','OPENAI_TIMEOUT','OPENAI_UNAVAILABLE','OPENAI_REQUEST_REJECTED','PROCESSING_CANCELLED'];
 if(error instanceof IntegrationError){report.error_kind='integration';report.known_error_code=integrationCodes.includes(error.code)?error.code:'UNRECOGNIZED';report.error_retryable=error.retryable;
  const status=error.details.http_status;report.known_http_status=typeof status==='number'&&[400,401,403,408,409,422,429,500,502,503,504].includes(status)?status:null;
 }else{report.error_kind='javascript';report.javascript_exception_kind=error instanceof TypeError?'TypeError':error instanceof RangeError?'RangeError':error instanceof SyntaxError?'SyntaxError':error instanceof ReferenceError?'ReferenceError':error instanceof Error?'Error':'unknown';}
 process.exitCode=1;
}finally{
 report.finished_at=new Date().toISOString();const directory='tracking/evidence/m03/transcription-diagnostic';await mkdir(directory,{recursive:true});
 const file=`${directory}/${String(report.finished_at).replace(/[:.]/gu,'-')}-${run.slice(0,8)}.json`;await writeFile(file,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify({result:report.result,receipt:file,provider_invocation_attempted:report.provider_invocation_attempted,provider_invocation_succeeded:report.provider_invocation_succeeded,provider_invocation_uncertain:report.provider_invocation_uncertain,known_error_code:report.known_error_code,javascript_exception_kind:report.javascript_exception_kind,raw_private_content_recorded:false})+'\n');
}
