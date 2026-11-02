import assert from 'node:assert/strict';
import test from 'node:test';
import * as adapter from '../../packages/integrations/src/openai-specs.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import type { SpecsExtractionInput } from '../../packages/integrations/src/specs-types.ts';

const input:SpecsExtractionInput={sourceAssetId:null,correlationId:'synthetic-stream',inputHash:'a'.repeat(64),paragraphs:[{index:0,page:null,text:'PRIVATE_SOURCE_CANARY'}]};
const base={apiKey:'PRIVATE_KEY_CANARY',model:'synthetic-model'};
const bounded={...base,transportMode:'bounded_stream' as const,timeoutMs:300_000,maxOutputTokens:32_768,reasoningEffort:'low' as const};
const payload={schema_version:'1.0',source_asset_id:null,source_language_codes:['en'],roles:[],general_instructions:'PRIVATE_RESULT_CANARY',clarifications:[]};
const response=(status='completed',value:unknown=payload)=>({id:'resp_stream_synthetic',model:'synthetic-model',status,error:null,
 output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{input_tokens:10,output_tokens:20,total_tokens:30}});
const event=(type:string,value:Record<string,unknown>={})=>new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify({type,...value})}\n\n`);
function sse(status='completed',value:unknown=payload){return new Response(new ReadableStream<Uint8Array>({start(c){
 c.enqueue(event('response.created'));c.enqueue(event('response.output_text.delta',{delta:'PRIVATE_DELTA_CANARY'}));c.enqueue(event('response.'+status,{response:response(status,value)}));c.close();
}}),{headers:{'content-type':'text/event-stream','x-request-id':'req_stream_header_synthetic'}});}
const code=(expected:string)=>(error:unknown)=>error instanceof IntegrationError&&error.code===expected;

test('explicit specs factory admits300s/32k/low; legacy config and injected receivers keep exact buffered semantics',async()=>{
 assert.deepEqual(adapter.openAISpecsConfigFromEnv({OPENAI_API_KEY:base.apiKey,OPENAI_EXTRACTION_MODEL:base.model}),{...base,timeoutMs:60000,maxOutputTokens:16384});
 assert.deepEqual(adapter.boundedStreamingSpecsConfigFromEnv({OPENAI_API_KEY:base.apiKey,OPENAI_EXTRACTION_MODEL:base.model}),bounded);
 let prior:unknown,next:unknown;await adapter.extractSpecs(input,base,async request=>{prior=request;return response();});
 await adapter.extractSpecs(input,bounded,async request=>{next=request;return response();});
 const before=prior as Record<string,unknown>,after=next as Record<string,unknown>;assert.equal(before.stream,false);assert.equal(after.stream,false);
 assert.equal(before.max_output_tokens,16384);assert.equal(after.max_output_tokens,32768);assert.deepEqual(after.reasoning,{effort:'low'});
 delete after.reasoning;after.max_output_tokens=16384;assert.deepEqual(after,before);
 for(const config of[{...base,timeoutMs:70001},{...bounded,timeoutMs:300001},{...bounded,maxOutputTokens:32769},{...bounded,transportMode:'unknown'}])
  await assert.rejects(adapter.extractSpecs(input,config as adapter.OpenAISpecsConfig,async()=>response()),code('OPENAI_CONFIGURATION_INVALID'));
});
test('actual default SDK consumes bounded SSE once and records headerID without fabricating SDK response properties',async t=>{
 let calls=0,wire:Record<string,unknown>|undefined;
 t.mock.method(globalThis,'fetch',async(url:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>{calls++;assert.equal(String(url),'https://api.openai.com/v1/responses');assert(init);assert.equal(init.method,'POST');assert.equal(init.redirect,'error');
  wire=JSON.parse(String(init.body));assert.equal(wire?.stream,true);assert.equal(wire?.max_output_tokens,32768);assert.deepEqual(wire?.reasoning,{effort:'low'});
  assert.equal(new Headers(init.headers).get('x-stainless-retry-count'),'0');return sse();});
 const output=await adapter.extractSpecs(input,bounded);assert.equal(calls,1);assert.equal(output.metadata.request_id,'req_stream_header_synthetic');assert.deepEqual(output.result,payload);
 let built:Record<string,unknown>|undefined;await adapter.extractSpecs(input,bounded,async request=>{built=structuredClone(request)as unknown as Record<string,unknown>;return response();});
 wire!.stream=false;assert.deepEqual(wire,built);assert.equal(JSON.stringify(output.metadata).includes('PRIVATE_'),false);
});
test('headers cannot finish the whole deadline; stalled body and headers abort without another SDK dispatch',async t=>{
 for(const headers of[false,true]){
  let calls=0,cancelled=false;t.mock.method(globalThis,'fetch',async(_url:Parameters<typeof fetch>[0],init?:Parameters<typeof fetch>[1])=>{calls++;
   if(!headers)return new Promise<Response>((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(new DOMException('PRIVATE_ABORT','AbortError')),{once:true}));
   return new Response(new ReadableStream<Uint8Array>({start(c){c.enqueue(event('response.created'));},cancel(){cancelled=true;}}),{headers:{'content-type':'text/event-stream','x-request-id':'req_stalled'}});
  });
  await assert.rejects(adapter.extractSpecs(input,{...bounded,timeoutMs:30}),error=>{assert(code('OPENAI_TIMEOUT')(error));assert(error instanceof IntegrationError);assert.equal(error.details.request_id,headers?'req_stalled':null);return true;});
  assert.equal(calls,1);if(headers)assert.equal(cancelled,true);t.mock.restoreAll();
 }
});
test('external cancellation wins before dispatch and during a stream',async t=>{
 let calls=0;const controller=new AbortController();controller.abort();t.mock.method(globalThis,'fetch',async()=>{calls++;return sse();});
 await assert.rejects(adapter.extractSpecs(input,bounded,undefined,controller.signal),code('PROCESSING_CANCELLED'));assert.equal(calls,0);
 const during=new AbortController();t.mock.method(globalThis,'fetch',async()=>{calls++;queueMicrotask(()=>during.abort());return sse();});
 await assert.rejects(adapter.extractSpecs(input,bounded,undefined,during.signal),code('PROCESSING_CANCELLED'));assert.equal(calls,1);
});
test('raw8MiB cap precedes SSE decoding and50k parsed events are bounded with no raw error leakage',async t=>{
 for(const mode of['bytes','events']){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(new ReadableStream<Uint8Array>({start(c){
   if(mode==='bytes')c.enqueue(new Uint8Array(8*1024*1024+1));else for(let i=0;i<50001;i++)c.enqueue(event('PRIVATE_UNKNOWN_EVENT',{private_text:'PRIVATE_EVENT_CANARY'}));c.close();
  }}),{headers:{'content-type':'text/event-stream','x-request-id':'req_limit'}});});
  await assert.rejects(adapter.extractSpecs(input,bounded),error=>{assert(code('AI_RESPONSE_INVALID')(error));assert(error instanceof IntegrationError);assert.equal(error.details.request_id,'req_limit');assert(!JSON.stringify(error).includes('PRIVATE_'));return true;});
  assert.equal(calls,1);t.mock.restoreAll();
 }
});
test('incomplete, failed, refusal, malformed and evidence-invalid terminal results remain rejected with actual headerID',async t=>{
 for(const mode of['incomplete','failed','refusal','invalid','evidence','eof']){
  t.mock.method(globalThis,'fetch',async()=>{
   if(mode==='eof')return new Response(event('response.created'),{headers:{'content-type':'text/event-stream','x-request-id':'req_stream_header_synthetic'}});
   if(mode==='refusal'){const r=response();r.output[0].content=[{type:'refusal',refusal:'PRIVATE_REFUSAL'}]as unknown as typeof r.output[0]['content'];return new Response(event('response.completed',{response:r}),{headers:{'content-type':'text/event-stream','x-request-id':'req_stream_header_synthetic'}});}
   return sse(['incomplete','failed'].includes(mode)?mode:'completed',mode==='invalid'?{PRIVATE_INVALID:'value'}:mode==='evidence'?{...payload,source_asset_id:'different'}:payload);
  });
  await assert.rejects(adapter.extractSpecs(input,bounded),error=>{assert(error instanceof IntegrationError);assert.equal(error.details.request_id,'req_stream_header_synthetic');assert(!JSON.stringify(error).includes('PRIVATE_'));return true;});t.mock.restoreAll();
 }
});
test('SDK status errors stay safe and retry classification remains owned by durable jobs',async t=>{
 for(const status of[401,429,500]){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return Response.json({error:{message:'PRIVATE_PROVIDER_CANARY',code:'PRIVATE_CODE'}},{status,headers:{'x-request-id':'req_status'}});});
  await assert.rejects(adapter.extractSpecs(input,bounded),error=>{assert(error instanceof IntegrationError);assert.equal(error.code,status===401?'OPENAI_ACCESS_DENIED':status===429?'OPENAI_RATE_LIMITED':'OPENAI_UNAVAILABLE');assert.equal(error.details.http_status,status);assert.equal(error.details.request_id,'req_status');assert(!JSON.stringify(error).includes('PRIVATE_'));return true;});assert.equal(calls,1);t.mock.restoreAll();
 }
});

test('terminal event and response status must match even when a mismatched object would pass final validation',async t=>{
 for(const type of['response.failed','response.incomplete']){
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(event(type,{response:response('completed')}),
   {headers:{'content-type':'text/event-stream','x-request-id':'req_mismatch'}});});
  await assert.rejects(adapter.extractSpecs(input,bounded),error=>{assert(code('AI_RESPONSE_INVALID')(error));assert(error instanceof IntegrationError);assert.equal(error.details.request_id,'req_mismatch');return true;});
  assert.equal(calls,1);t.mock.restoreAll();
 }
});
