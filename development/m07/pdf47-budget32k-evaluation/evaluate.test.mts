import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { evaluateOnce,INPUT_SCHEMA,PURPOSE,PRODUCTION_PINS,EXPECTED_INPUT_SHA256,type Ports } from './evaluate.mts';
import { EVALUATION_ENABLED,loadVerifiedConfiguration,main } from './native.mts';
import { captureBudgetRequest,validateBudgetResponse,sendBudgetRequest,streamingBytes,assertBudgetInverse,SETTINGS } from './transport.mts';
import { extractSpecs } from '../../../packages/integrations/src/openai-specs.ts';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import type { SpecsExtractionInput } from '../../../packages/integrations/src/specs-types.ts';
const run='00000000-0000-4000-8000-000000000001',asset='0fbc905f-c51e-472d-9d03-74664ee9ac86';
const config={apiKey:'PRIVATE_KEY_CANARY',model:'gpt-6.1-sol'};
const input:SpecsExtractionInput={sourceAssetId:asset,inputHash:EXPECTED_INPUT_SHA256,correlationId:run,
 paragraphs:Array.from({length:219},(_,index)=>({index,page:index%24+1,text:'PRIVATE_SOURCE_CANARY'}))};
function payload(){return{schema_version:'1.0',source_asset_id:asset,source_language_codes:['en'],general_instructions:'PRIVATE_RESULT_CANARY',clarifications:[],
 roles:[{source_role_key:'synthetic-role',name:null,headcount:null,category:null,
 requirements:{age_range:null,gender_requirement:null,appearance_performance:null,languages:[],accents:[],skills:[],scene_references:[],shoot_dates:[],location:null,availability_requirements:null,other_instructions:null},
 evidence:[{asset_id:asset,page:1,paragraph:0,quote:'PRIVATE_SOURCE_CANARY',segment_index:null,start_ms:null,end_ms:null}],
 clarifications:[{field_path:'headcount',reason:'PRIVATE_CLARIFICATION_CANARY',source:null}]}]};}
function response(value:unknown=payload()){return{id:'resp_synthetic',model:config.model,status:'completed',error:null,
 output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{input_tokens:10,output_tokens:20,total_tokens:30}};}
const event=(type:string,value:Record<string,unknown>={})=>new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify({type,...value})}\n\n`);
function sse(terminal:Record<string,unknown>=response()){
 return new Response(new ReadableStream<Uint8Array>({start(c){c.enqueue(event('response.created'));c.enqueue(event('response.output_text.delta',{delta:'PRIVATE_DELTA_CANARY'}));c.enqueue(event('response.'+String(terminal.status),{response:terminal}));c.close();}}),
 {headers:{'content-type':'text/event-stream','x-request-id':'req_header_synthetic'}});
}
const rehash=(request:ReturnType<typeof JSON.parse>)=>{const bytes=JSON.stringify(request);return{request,bytes,sha256:createHash('sha256').update(bytes).digest('hex')};};

test('actual production captures differ ONLY16384→32768, then ONLYfalse→true; no network or production default change',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('NETWORK_FORBIDDEN');});
 const built=await captureBudgetRequest(input,config);assert.equal(calls,0);assertBudgetInverse(built.previous,built.production);
 assert.equal(built.previous.request.max_output_tokens,16384);assert.equal(built.production.request.max_output_tokens,32768);
 const inverse=JSON.parse(built.bytes);assert.equal(inverse.stream,true);inverse.stream=false;assert.equal(JSON.stringify(inverse),built.production.bytes);
 inverse.max_output_tokens=16384;assert.equal(JSON.stringify(inverse),built.previous.bytes);
 assert.equal(built.production.request.store,false);assert.deepEqual(built.production.request.tools,[]);assert.deepEqual(built.production.request.reasoning,{effort:'low'});
 let defaultBudget=0;await assert.rejects(extractSpecs(input,config,async request=>{defaultBudget=request.max_output_tokens!;throw new IntegrationError('CAPTURE','capture');}));assert.equal(defaultBudget,16384);
 await assert.rejects(extractSpecs(input,{...config,maxOutputTokens:32769},async()=>{calls++;return response();}));
 await assert.rejects(extractSpecs(input,{...config,timeoutMs:300000},async()=>{calls++;return response();}));assert.equal(calls,0);
});
test('body inverse refuses any extra prompt/model/source/schema/tool/budget change even with rehashed bytes',async()=>{
 const built=await captureBudgetRequest(input,config);
 for(const key of['model','instructions','input','text','tools','max_output_tokens']){
  const next=JSON.parse(built.production.bytes);next[key]=key==='max_output_tokens'?32767:'PRIVATE_DRIFT_CANARY';
  assert.throws(()=>assertBudgetInverse(built.previous,rehash(next)));
 }
 assert.throws(()=>streamingBytes({...built,production:{...built.production,bytes:built.production.bytes+' '}}));
});
test('pinned SDK sends exactly one canonical32k SSE body with0retries and preserves actual headerID separately',async()=>{
 const built=await captureBudgetRequest(input,config);let calls=0;
 const exchange=await sendBudgetRequest(built,config,async(url,init)=>{calls++;assert.equal(String(url),'https://api.openai.com/v1/responses');assert.equal(init?.method,'POST');assert.equal(init.body,built.bytes);
  assert.equal(JSON.parse(String(init.body)).max_output_tokens,32768);assert.equal(new Headers(init.headers).get('x-stainless-retry-count'),'0');return sse();});
 const output=await validateBudgetResponse(input,config,built,exchange.response);assert.equal(calls,1);assert.equal(exchange.observation.dispatch_count,1);
 assert.equal(exchange.observation.header_request_id,'req_header_synthetic');assert.equal(output.metadata.request_id,null);assert(!Object.hasOwn(exchange.response as object,'_request_id'));
 assert.equal(output.result.roles.length,1);assert(!JSON.stringify(exchange.observation).includes('PRIVATE_'));
});
test('32k validator rebuilds exact request and rejects incomplete/failed/invalid evidence without another transport',async()=>{
 const built=await captureBudgetRequest(input,config),bad=payload();bad.roles[0].evidence[0].quote='PRIVATE_UNSUPPORTED_CANARY';
 for(const terminal of[{...response(),status:'incomplete'},{...response(),status:'failed'},response(bad)])await assert.rejects(validateBudgetResponse(input,config,built,terminal),e=>e instanceof IntegrationError);
 const changed={...input,paragraphs:[...input.paragraphs,{index:219,page:24,text:'PRIVATE_CHANGED_CANARY'}]};
 await assert.rejects(validateBudgetResponse(changed,config,built,response()),e=>e instanceof IntegrationError&&e.code==='EVALUATION_REQUEST_DRIFT');
});
test('frozen300s/8MiB/50k limits cannot be widened by new budget; bytecap and deadline stop one dispatch',async()=>{
 const built=await captureBudgetRequest(input,config);let calls=0;
 await assert.rejects(sendBudgetRequest(built,config,async()=>{calls++;return sse();},undefined,{deadlineMs:300001}));assert.equal(calls,0);
 await assert.rejects(sendBudgetRequest(built,config,async()=>{calls++;return sse();},undefined,{maximumWireBytes:20}),e=>e instanceof IntegrationError&&e.code==='STREAM_BYTE_LIMIT');
 await assert.rejects(sendBudgetRequest(built,config,async()=>{calls++;return new Response(new ReadableStream<Uint8Array>({start(c){c.enqueue(event('response.created'));}}),{headers:{'content-type':'text/event-stream'}});},undefined,{deadlineMs:30}),e=>e instanceof IntegrationError&&e.code==='OPENAI_TIMEOUT');
 assert.equal(calls,2);assert.equal(SETTINGS.maximum_wire_bytes,8388608);assert.equal(SETTINGS.maximum_parsed_events,50000);
});
function fixture(){
 let claimed=false,calls=0,responses=0,outputs=0;const order:string[]=[],receipts:unknown[]=[];
 const prepared={schema_version:INPUT_SCHEMA,job_id:'47f86513-8999-4946-b5d9-f2fd6a18fd00',source_asset_id:asset,configured_model:config.model,prepared_source_verified:true,prepared_text_bytes:12807,mapped_pages:24,input:structuredClone(input)};
 const ports:Ports={read:async()=>prepared,config:()=>config,seals:async()=>({...PRODUCTION_PINS}),admitCapture:async built=>{assertBudgetInverse(built.previous,built.production);order.push('admit');},
 claim:async value=>{assert(!claimed);assert.equal((value as{purpose:string}).purpose,PURPOSE);claimed=true;order.push('claim');},receipt:async(phase,value)=>{order.push(phase);receipts.push(value);},
 send:async(built,c)=>{assert(claimed);order.push('send');return sendBudgetRequest(built,c,async()=>{calls++;return sse();});},
 persistResponse:async()=>{responses++;order.push('response');},persist:async()=>{outputs++;order.push('output');}};
 return{ports,prepared,receipts,order,count:()=>({claimed,calls,responses,outputs})};
}
test('new permanent claim precedes POST; response custody precedes production validation/output; no replay/private output',async()=>{
 const f=fixture(),result=await evaluateOnce(run,f.ports);assert.equal(result.result,'validated');assert.deepEqual(f.count(),{claimed:true,calls:1,responses:1,outputs:1});
 assert(f.order.indexOf('admit')<f.order.indexOf('claim'));assert(f.order.indexOf('claim')<f.order.indexOf('send'));assert(f.order.indexOf('response')<f.order.indexOf('output'));
 assert.equal(result.whole_production_function_acceptance,false);assert.equal(result.job_outbox_or_writeback,false);assert.equal(result.header_request_id,'req_header_synthetic');assert.equal(result.sdk_request_id,null);
 assert(!JSON.stringify(f.receipts).includes('PRIVATE_'));await assert.rejects(evaluateOnce(run,f.ports));assert.equal(f.count().calls,1);
});
test('retained input, source seals and previous-request admission fail BEFORE claim/dispatch',async()=>{
 for(const mode of['input','seals','previous']){
  const f=fixture();if(mode==='input')f.prepared.input.inputHash='a'.repeat(64);
  if(mode==='seals')f.ports.seals=async()=>({});if(mode==='previous')f.ports.admitCapture=async()=>{throw Error('B16_DRIFT');};
  await assert.rejects(evaluateOnce(run,f.ports));assert.deepEqual(f.count(),{claimed:false,calls:0,responses:0,outputs:0});
 }
});
test('source drift during request refuses changed bridge BEFORE raw custody/validator; claim permanent',async()=>{
 const f=fixture(),original=f.ports.send;let changed=false;f.ports.seals=async()=>({...PRODUCTION_PINS,...(changed?{changed:'PRIVATE_CANARY'}:{})});
 f.ports.send=async(...args)=>{const value=await original(...args);changed=true;return value;};
 const result=await evaluateOnce(run,f.ports);assert.equal(result.result,'failed_or_unknown');assert.equal(result.phase,'post_transport_source_verification');
 assert.deepEqual(f.count(),{claimed:true,calls:1,responses:0,outputs:0});assert(!JSON.stringify(f.receipts).includes('PRIVATE_'));
});
test('incomplete raw terminal remains private before rejection; unknown transport/custody never resend',async()=>{
 for(const mode of['incomplete','transport','timeout','custody','output']){
  const f=fixture();if(mode==='incomplete')f.ports.send=(built,c)=>sendBudgetRequest(built,c,async()=>sse({...response(),status:'incomplete'}));
  if(mode==='transport')f.ports.send=async()=>{throw Error('PRIVATE_TRANSPORT_CANARY');};
  if(mode==='timeout')f.ports.send=(built,c)=>sendBudgetRequest(built,c,async()=>new Response(new ReadableStream<Uint8Array>({start(out){out.enqueue(event('response.created'));}}),{headers:{'content-type':'text/event-stream'}}),undefined,{deadlineMs:20});
  if(mode==='custody')f.ports.persistResponse=async()=>{throw Error('PRIVATE_CUSTODY_CANARY');};if(mode==='output')f.ports.persist=async()=>{throw Error('PRIVATE_OUTPUT_CANARY');};
  const result=await evaluateOnce(run,f.ports);assert.equal(result.result,'failed_or_unknown');assert(!JSON.stringify(f.receipts).includes('PRIVATE_'));assert.equal(result.charge_unknown,true);
  assert.equal(result.remote_completion_unknown,mode==='transport'||mode==='timeout');assert(!Object.hasOwn(result,'charge_or_remote_completion_unknown'));
  if(mode==='incomplete'){assert.equal(f.count().responses,1);assert.equal(f.count().outputs,0);assert.equal(result.code,'AI_RESPONSE_INCOMPLETE');assert.equal((result.observation as{terminal_status:string}).terminal_status,'incomplete');}
  if(mode==='timeout'){assert.equal(result.code,'OPENAI_TIMEOUT');assert.equal((result.observation as{terminal_status:null}).terminal_status,null);}
  await assert.rejects(evaluateOnce(run,f.ports));
 }
});
test('loader verification precedes credential access and disabled native entry refuses before any phase',async()=>{
 let loads=0;await assert.rejects(loadVerifiedConfiguration(async()=>{throw Error('DRIFT');},async()=>{loads++;return{};}));assert.equal(loads,0);
 const result=await loadVerifiedConfiguration(async()=>{},async()=>({OPENAI_API_KEY:config.apiKey,OPENAI_EXTRACTION_MODEL:config.model,OTHER_SECRET:'PRIVATE_CANARY'}));assert(!('OTHER_SECRET'in result));
 assert.equal(EVALUATION_ENABLED,false);await assert.rejects(main(),/PDF47_BUDGET32K_EVALUATION_DISABLED/u);
});
