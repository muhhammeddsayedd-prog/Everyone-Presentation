import assert from 'node:assert/strict';
import {spawnSync}from 'node:child_process';
import test from 'node:test';
import {setTimeout as delay}from 'node:timers/promises';
import {EVALUATION_ENABLED,evaluateOnce,loadVerifiedConfiguration,PRODUCTION_PINS,safeObservation,type Ports}from './evaluate.mts';
import {captureProductionRequest,validateProductionResponse,sendStreamingRequest,streamingBytes,StreamingFailure,SETTINGS,REUSED_BUILDER_PATH,REUSED_BUILDER_SHA256}from './transport.mts';
import {extractSpecs}from '../../../packages/integrations/src/openai-specs.ts';
import {IntegrationError}from '../../../packages/integrations/src/errors.ts';
import type {SpecsExtractionInput}from '../../../packages/integrations/src/specs-types.ts';

const run='00000000-0000-4000-8000-000000000001',asset='0fbc905f-c51e-472d-9d03-74664ee9ac86';
const config={apiKey:'PRIVATE_KEY_CANARY',model:'gpt-6.1-sol'};
const input:SpecsExtractionInput={sourceAssetId:asset,inputHash:'a'.repeat(64),correlationId:run,
  paragraphs:Array.from({length:219},(_,index)=>({index,page:index%24+1,text:'PRIVATE_SOURCE_CANARY'}))};
function payload(){return{schema_version:'1.0',source_asset_id:asset,source_language_codes:['en'],general_instructions:'PRIVATE_RESULT_CANARY',clarifications:[],
  roles:[{source_role_key:'synthetic-role',name:null,headcount:null,category:null,
    requirements:{age_range:null,gender_requirement:null,appearance_performance:null,languages:[],accents:[],skills:[],scene_references:[],shoot_dates:[],location:null,availability_requirements:null,other_instructions:null},
    evidence:[{asset_id:asset,page:1,paragraph:0,quote:'PRIVATE_SOURCE_CANARY',segment_index:null,start_ms:null,end_ms:null}],
    clarifications:[{field_path:'headcount',reason:'PRIVATE_CLARIFICATION_CANARY',source:null}]}]};}
function response(value:unknown=payload()){return{id:'resp_synthetic',model:config.model,status:'completed',error:null,
  output:[{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(value)}]}],usage:{input_tokens:10,output_tokens:20,total_tokens:30}};}
const event=(type:string,value:Record<string,unknown>={})=>new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify({type,...value})}\n\n`);
const events=(terminal:Record<string,unknown>=response())=>[
  event('response.created',{response:{id:'resp_synthetic',status:'in_progress'}}),event('response.in_progress'),
  event('response.output_text.delta',{delta:'PRIVATE_DELTA_CANARY'}),event('response.'+String(terminal.status),{response:terminal}),
];
function sse(chunks:Uint8Array[]=events(),options:{hold?:boolean;cancel?:()=>void}={}){
  return new Response(new ReadableStream<Uint8Array>({start(c){for(const chunk of chunks)c.enqueue(chunk);if(!options.hold)c.close();},cancel(){options.cancel?.();}}),
    {headers:{'content-type':'text/event-stream','x-request-id':'req_header_synthetic'}});
}
const failure=(code:string)=>(error:unknown)=>error instanceof StreamingFailure&&error.code===code;

test('fixed-source check precedes loader/credential access and config exposes only two fields',async()=>{
  const calls:string[]=[];const load=async()=>{calls.push('load');return{OPENAI_API_KEY:config.apiKey,OPENAI_EXTRACTION_MODEL:config.model,N8N_API_KEY:'PRIVATE_OTHER_KEY_CANARY'};};
  await assert.rejects(loadVerifiedConfiguration(async()=>{calls.push('verify');throw Error('drift');},load));assert.deepEqual(calls,['verify']);calls.length=0;
  const result=await loadVerifiedConfiguration(async()=>{calls.push('verify');},load);assert.deepEqual(calls,['verify','load']);assert(!('N8N_API_KEY'in result));
});

test('capture is network-free and the finite byte inverse changes ONLY stream false to true',async t=>{
  let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('provider forbidden');});
  const capture=await captureProductionRequest(input,config),body=JSON.parse(capture.bytes);assert.equal(calls,0);assert.equal(body.stream,true);
  body.stream=false;assert.equal(JSON.stringify(body),capture.production.bytes);assert.equal(streamingBytes(capture.production),capture.bytes);
  assert.equal(body.model,config.model);assert.deepEqual(body.reasoning,{effort:'low'});assert.equal(body.store,false);assert.deepEqual(body.tools,[]);assert.equal(body.max_output_tokens,16384);assert.equal(body.text.format.strict,true);
  const bad={...capture.production,bytes:capture.production.bytes+' '};assert.throws(()=>streamingBytes(bad));
  await assert.rejects(extractSpecs(input,{...config,timeoutMs:300000},async()=>{calls++;return response();}),e=>e instanceof IntegrationError&&e.code==='OPENAI_CONFIGURATION_INVALID');
  await assert.rejects(sendStreamingRequest(capture,config,globalThis.fetch,undefined,{deadlineMs:300001}));assert.equal(calls,0);assert.equal(SETTINGS.outer_stream_deadline_ms,300000);assert.equal(SETTINGS.production_timeout_cap_ms,70000);
});

test('actual SDK one canonical POST consumes SSE; separate real headerID never becomes a fake SDK response ID',async()=>{
  const capture=await captureProductionRequest(input,config);let calls=0;
  const exchange=await sendStreamingRequest(capture,config,async(url,init)=>{
    calls++;assert.equal(String(url),'https://api.openai.com/v1/responses');assert.equal(init?.method,'POST');assert.equal(init.body,capture.bytes);assert.equal(init.redirect,'error');
    assert.equal(new Headers(init.headers).get('x-stainless-retry-count'),'0');return sse();
  });
  const output=await validateProductionResponse(input,config,capture,exchange.response);
  assert.equal(calls,1);assert.equal(exchange.observation.dispatch_count,1);assert.equal(exchange.observation.http_status,200);assert.equal(exchange.observation.header_request_id,'req_header_synthetic');
  assert.equal(output.metadata.request_id,null);assert.equal(Object.hasOwn(exchange.response as object,'_request_id'),false);assert.equal(output.result.roles.length,1);
  assert.equal(exchange.observation.parsed_events,4);assert.equal(exchange.observation.event_counts.output_text_delta,1);assert.equal(exchange.observation.terminal_event,'completed');
  assert.equal(exchange.observation.output_text_bytes,Buffer.byteLength('PRIVATE_DELTA_CANARY'));assert(!JSON.stringify(exchange.observation).includes('PRIVATE_'));
});

test('header delay and first-event/visible-output/terminal timing stay relative and ordered',async()=>{
  const capture=await captureProductionRequest(input,config);
  const exchange=await sendStreamingRequest(capture,config,async()=>{await delay(20);return sse();},undefined,{deadlineMs:1000});
  const o=exchange.observation;assert(o.headers_ms!>=10);assert(o.created_ms!>=o.headers_ms!);assert(o.first_output_delta_ms!>=o.created_ms!);assert(o.terminal_ms!>=o.first_output_delta_ms!);
});

test('outer deadline cancels a stalled SDK stream AFTER headers/events; no second dispatch',async()=>{
  const capture=await captureProductionRequest(input,config);let calls=0,cancelled=false;
  await assert.rejects(sendStreamingRequest(capture,config,async()=>{calls++;return sse([event('response.created')],{hold:true,cancel:()=>{cancelled=true;}});},undefined,{deadlineMs:40}),error=>{
    assert(failure('OPENAI_TIMEOUT')(error));assert(error instanceof StreamingFailure);assert.equal(error.observation.http_status,200);assert.notEqual(error.observation.created_ms,null);assert.equal(error.observation.terminal_ms,null);return true;
  });
  await delay(0);assert.equal(calls,1);assert.equal(cancelled,true);
});

test('actual default300s outer timer remains active after headers through299999ms and stops once at300000ms',async t=>{
  const capture=await captureProductionRequest(input,config);t.mock.timers.enable({apis:['setTimeout']});
  let calls=0,cancelled=false,settled=false;
  const pending=sendStreamingRequest(capture,config,async()=>{calls++;return sse([event('response.created')],{hold:true,cancel:()=>{cancelled=true;}});});
  void pending.then(()=>{settled=true;},()=>{settled=true;});const rejected=assert.rejects(pending,failure('OPENAI_TIMEOUT'));
  await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);
  t.mock.timers.tick(299999);await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false);assert.equal(cancelled,false);
  t.mock.timers.tick(1);await rejected;await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,1);assert.equal(settled,true);assert.equal(cancelled,true);
});

test('outer header deadline and external cancellation are bounded; cancellation wins before dispatch',async()=>{
  const capture=await captureProductionRequest(input,config);let calls=0;
  await assert.rejects(sendStreamingRequest(capture,config,async(_url,init)=>{calls++;return new Promise<Response>((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(new DOMException('PRIVATE_ABORT_CANARY','AbortError')),{once:true}));},undefined,{deadlineMs:30}),error=>{
    assert(failure('OPENAI_TIMEOUT')(error));assert(error instanceof StreamingFailure);assert.equal(error.observation.http_status,null);assert.equal(error.observation.header_request_id,null);return true;
  });
  const stop=new AbortController();stop.abort();await assert.rejects(sendStreamingRequest(capture,config,async()=>{calls++;return sse();},stop.signal),failure('PROCESSING_CANCELLED'));assert.equal(calls,1);
});

test('raw-byte cap precedes decoding even one unterminated event; parsed-event cap is independent',async()=>{
  const capture=await captureProductionRequest(input,config);let calls=0;
  await assert.rejects(sendStreamingRequest(capture,config,async()=>{calls++;return sse([new TextEncoder().encode('PRIVATE_RAW_CANARY'.repeat(100))]);},undefined,{maximumWireBytes:100}),failure('STREAM_BYTE_LIMIT'));
  await assert.rejects(sendStreamingRequest(capture,config,async()=>{calls++;return sse();},undefined,{maximumParsedEvents:2}),failure('STREAM_EVENT_LIMIT'));assert.equal(calls,2);
});

test('API/SSE failures and stream EOF expose static codes/header metadata without raw bodies or retry',async()=>{
  const capture=await captureProductionRequest(input,config);let calls=0;
  for(const mode of['http','server','rate','sse','eof'])await assert.rejects(sendStreamingRequest(capture,config,async()=>{
    calls++;if(mode==='http')return Response.json({error:{message:'PRIVATE_BODY_CANARY',code:'PRIVATE_CODE_CANARY'}},{status:401,headers:{'x-request-id':'req_denied'}});
    if(mode==='server'||mode==='rate')return Response.json({error:{message:'PRIVATE_RETRYABLE_BODY_CANARY'}},{status:mode==='server'?500:429});
    if(mode==='sse')return sse([event('error',{error:{message:'PRIVATE_SSE_CANARY',code:'PRIVATE_CODE_CANARY'}})]);
    return sse([event('response.created')]);
  }),error=>{assert(error instanceof StreamingFailure);assert.equal(error.code,mode==='http'?'OPENAI_ACCESS_DENIED':mode==='rate'?'OPENAI_RATE_LIMITED':mode==='eof'?'STREAM_TERMINAL_MISSING':'OPENAI_UNAVAILABLE');assert(!JSON.stringify(error).includes('PRIVATE_'));assert(!error.message.includes('PRIVATE_'));return true;});
  assert.equal(calls,5);
});

function fixture(){
  let claimed=false,calls=0,responses=0,outputs=0;const receipts:unknown[]=[],order:string[]=[];
  const prepared={schema_version:'pdf47-streaming-input.v1',job_id:'47f86513-8999-4946-b5d9-f2fd6a18fd00',source_asset_id:asset,configured_model:config.model,prepared_source_verified:true,prepared_text_bytes:12807,mapped_pages:24,input:structuredClone(input)};
  const ports:Ports={read:async()=>prepared,config:()=>config,seals:async()=>({...PRODUCTION_PINS,[REUSED_BUILDER_PATH]:REUSED_BUILDER_SHA256}),
    admitCapture:async()=>{order.push('admit_capture');},claim:async()=>{assert(!claimed);claimed=true;order.push('claim');},receipt:async(phase,value)=>{order.push(phase);receipts.push(value);},
    send:async(capture,c)=>{assert(claimed);order.push('dispatch');return sendStreamingRequest(capture,c,async()=>{calls++;return sse();});},
    persistResponse:async()=>{responses++;order.push('private_response');},persist:async()=>{outputs++;order.push('private_output');}};
  return{ports,prepared,receipts,order,count:()=>({claimed,calls,responses,outputs})};
}

test('claim precedes sole SDK dispatch; terminal custody precedes validator and private output; no public text/replay',async()=>{
  const f=fixture(),result=await evaluateOnce(run,f.ports);assert.equal(result.result,'validated');assert.deepEqual(f.count(),{claimed:true,calls:1,responses:1,outputs:1});
  assert(f.order.indexOf('admit_capture')<f.order.indexOf('claim'));assert(f.order.indexOf('claim')<f.order.indexOf('dispatch'));assert(f.order.indexOf('private_response')<f.order.indexOf('private_output'));
  assert.equal(result.request_semantic_bytes_equal_except_stream,true);assert.equal(result.nonstream_transport_acceptance,false);assert.equal(result.whole_production_function_acceptance,false);
  assert.equal(result.header_request_id,'req_header_synthetic');assert.equal(result.sdk_request_id,null);assert(!JSON.stringify(f.receipts).includes('PRIVATE_'));
  await assert.rejects(evaluateOnce(run,f.ports));assert.equal(f.count().calls,1);
});

test('incomplete/failed/bad-evidence terminal objects persist privately before validation refusal',async()=>{
  for(const mode of['incomplete','failed','evidence']){
    const f=fixture(),bad=payload();bad.roles[0].evidence[0].quote='UNSUPPORTED_PRIVATE_CANARY';
    const terminal=mode==='evidence'?response(bad):{...response(),status:mode};
    f.ports.send=async(capture,c)=>sendStreamingRequest(capture,c,async()=>sse(events(terminal)));
    const result=await evaluateOnce(run,f.ports);assert.equal(result.result,'failed_or_unknown');assert.equal(result.phase,'production_response_validation');
    assert.equal(f.count().responses,1);assert.equal(f.count().outputs,0);assert(!JSON.stringify(f.receipts).includes('CANARY'));await assert.rejects(evaluateOnce(run,f.ports));
  }
});

test('unknown transport/custody failures retain claim and cannot dispatch a second request',async()=>{
  for(const mode of['transport','response','output']){
    const f=fixture();let injected=0;
    if(mode==='transport')f.ports.send=async()=>{injected++;throw Error('PRIVATE_UNKNOWN_CANARY');};
    if(mode==='response')f.ports.persistResponse=async()=>{throw Error('PRIVATE_PATH_CANARY');};
    if(mode==='output')f.ports.persist=async()=>{throw Error('PRIVATE_PATH_CANARY');};
    const result=await evaluateOnce(run,f.ports);assert.equal(result.result,'failed_or_unknown');assert.equal(result.automatic_retry,false);assert.equal(result.charge_or_remote_completion_unknown,true);assert(!JSON.stringify(f.receipts).includes('PRIVATE_'));
    const count=mode==='transport'?injected:f.count().calls;await assert.rejects(evaluateOnce(run,f.ports));assert.equal(mode==='transport'?injected:f.count().calls,count);assert.equal(count,1);
  }
});

test('source drift during the request refuses raw custody before bridge execution, retaining claim and no resend',async()=>{
  const f=fixture(),send=f.ports.send;let drift=false;
  f.ports.seals=async()=>({...PRODUCTION_PINS,[REUSED_BUILDER_PATH]:drift?'f'.repeat(64):REUSED_BUILDER_SHA256});
  f.ports.send=async(...args)=>{const exchange=await send(...args);drift=true;return exchange;};
  const result=await evaluateOnce(run,f.ports);assert.equal(result.result,'failed_or_unknown');
  assert.equal(f.count().responses,0);assert.equal(f.count().outputs,0);assert.equal(result.phase,'post_transport_source_verification');
  assert.equal(f.count().claimed,true);assert.equal(f.count().calls,1);assert(!JSON.stringify(f.receipts).includes('PRIVATE_'));
  drift=false;await assert.rejects(evaluateOnce(run,f.ports));assert.equal(f.count().calls,1);
});

test('source/body admission/input/predispatch refusal makes zero SDK calls; result receipt failure is not retried',async()=>{
  for(const mode of['source','reference','input','dispatch_receipt','result_receipt']){
    const f=fixture();let writes=0;
    if(mode==='source')f.ports.seals=async()=>({...PRODUCTION_PINS,[REUSED_BUILDER_PATH]:'f'.repeat(64)});
    if(mode==='reference')f.ports.admitCapture=async()=>{throw Error('REFERENCE_DRIFT');};
    if(mode==='input')f.prepared.input.paragraphs[1].index=0;
    if(mode==='dispatch_receipt')f.ports.receipt=async()=>{throw Error('PRIVATE_RECEIPT_CANARY');};
    if(mode==='result_receipt')f.ports.receipt=async phase=>{if(phase==='result'){writes++;throw Error('PRIVATE_RECEIPT_CANARY');}};
    await assert.rejects(evaluateOnce(run,f.ports));assert.equal(f.count().calls,mode==='result_receipt'?1:0);assert.equal(writes,mode==='result_receipt'?1:0);
  }
});

test('public observation projection ignores raw fields and object-coerced terminal labels',()=>{
  const bad={http_status:200,header_request_id:'https://PRIVATE_URL',headers:'PRIVATE_HEADERS',body:'PRIVATE_BODY',event_counts:{created:1,secret:'PRIVATE_PAYLOAD'},
    terminal_event:{toString:()=> 'completed',private:'PRIVATE_LABEL'},terminal_status:{toString:()=> 'failed',private:'PRIVATE_LABEL'}};
  const projected=safeObservation(bad);assert(projected);assert.equal(projected.terminal_event,null);assert.equal(projected.terminal_status,null);assert.equal(projected.header_request_id,null);assert(!JSON.stringify(projected).includes('PRIVATE_'));
});

test('new native entry refuses while default off, before configuration/private bridge/network',()=>{
  assert.equal(EVALUATION_ENABLED,false);
  const r=spawnSync(process.execPath,['--import','tsx','development/m07/pdf47-streaming-evaluation/evaluate.mts','evaluate',run],{cwd:process.cwd(),encoding:'utf8',env:{...process.env,OPENAI_API_KEY:'PRIVATE_KEY_CANARY'}});
  assert.equal(r.status,1);assert(r.stderr.includes('PDF47_STREAMING_EVALUATION_REFUSED'));assert(!r.stderr.includes('PRIVATE_'));assert(!r.stdout.includes('PRIVATE_'));
});
