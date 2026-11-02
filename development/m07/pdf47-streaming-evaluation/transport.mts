/** Independent SSE diagnostic. No job, production deadline or helper is changed. */
import assert from 'node:assert/strict';
import {createHash}from 'node:crypto';
import {readFile}from 'node:fs/promises';
import {performance}from 'node:perf_hooks';
import {URL}from 'node:url';
import OpenAI from 'openai';
import type {ResponseCreateParamsStreaming}from 'openai/resources/responses/responses';
import {IntegrationError,record}from '../../../packages/integrations/src/errors.ts';
import type {OpenAISpecsConfig}from '../../../packages/integrations/src/openai-specs.ts';
import type {SpecsExtractionInput}from '../../../packages/integrations/src/specs-types.ts';
import type {Capture as ProductionCapture}from '../pdf47-extended-deadline-evaluation/transport.mts';

export const REUSED_BUILDER_PATH='development/m07/pdf47-extended-deadline-evaluation/transport.mts';
export const REUSED_BUILDER_SHA256='1d66e829c11b55320b2c2e1e331ae123b8ed6aad6b83c52172fe298c8db03a18';
export const SETTINGS={model:'gpt-6.1-sol',reasoning_effort:'low',outer_stream_deadline_ms:300_000,
  production_builder_validation_timeout_ms:60_000,production_timeout_cap_ms:70_000,max_output_tokens:16_384,
  sdk_retries:0,maximum_provider_requests:1,store:false,stream:true,tools:0,
  maximum_wire_bytes:8*1024*1024,maximum_parsed_events:50_000}as const;
export type Capture={production:ProductionCapture;bytes:string;sha256:string};
export interface Observation{
  http_status:number|null;header_request_id:string|null;headers_ms:number|null;created_ms:number|null;
  in_progress_ms:number|null;first_output_delta_ms:number|null;terminal_ms:number|null;duration_ms:number;
  dispatch_count:number;wire_bytes:number;output_text_bytes:number;parsed_events:number;
  event_counts:{created:number;in_progress:number;output_text_delta:number;completed:number;incomplete:number;failed:number;other:number};
  terminal_event:'completed'|'incomplete'|'failed'|null;terminal_status:'completed'|'incomplete'|'failed'|null;
}
export type Exchange={response:unknown;observation:Observation};
export class StreamingFailure extends IntegrationError{
  constructor(code:string,readonly observation:Observation){super(code,'The bounded streaming diagnostic did not complete.',false);}
}
const safeId=(v:unknown)=>typeof v==='string'&&/^req_[A-Za-z0-9_-]{1,128}$/u.test(v)?v:null;
const safeStatus=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=100&&v<=599?v:null;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
async function builder(){
  const url=new URL('../pdf47-extended-deadline-evaluation/transport.mts',import.meta.url);
  assert.equal(createHash('sha256').update(await readFile(url)).digest('hex'),REUSED_BUILDER_SHA256);
  return import(url.href)as Promise<typeof import('../pdf47-extended-deadline-evaluation/transport.mts')>;
}
export function streamingBytes(production:ProductionCapture):string{
  assert.equal(JSON.stringify(production.request),production.bytes);assert.equal(hash(production.bytes),production.sha256);
  const body=JSON.parse(production.bytes)as Record<string,unknown>;assert.equal(body.stream,false);
  body.stream=true;const bytes=JSON.stringify(body);
  const inverse=JSON.parse(bytes)as Record<string,unknown>;inverse.stream=false;
  assert.equal(JSON.stringify(inverse),production.bytes,'STREAMING_REQUEST_DIFF_NOT_CLOSED');return bytes;
}
export async function captureProductionRequest(input:SpecsExtractionInput,config:OpenAISpecsConfig):Promise<Capture>{
  const production=await(await builder()).captureProductionRequest(input,config),bytes=streamingBytes(production);
  return{production,bytes,sha256:hash(bytes)};
}
export async function validateProductionResponse(input:SpecsExtractionInput,config:OpenAISpecsConfig,capture:Capture,response:unknown){
  assert.equal(streamingBytes(capture.production),capture.bytes);assert.equal(hash(capture.bytes),capture.sha256);
  // Keep the received terminal object unchanged. No synthetic SDK _request_id.
  return(await builder()).validateProductionResponse(input,config,capture.production,response);
}

/** Only tests may tighten bounds. The native caller passes the fixed defaults. */
export interface Bounds{deadlineMs?:number;maximumWireBytes?:number;maximumParsedEvents?:number}
export async function sendStreamingRequest(capture:Capture,config:OpenAISpecsConfig,dispatch:typeof fetch,
  externalSignal?:AbortSignal,tighter:Bounds={}):Promise<Exchange>{
  assert.equal(config.model,SETTINGS.model);assert.equal(streamingBytes(capture.production),capture.bytes);assert.equal(hash(capture.bytes),capture.sha256);
  assert(!Object.keys(process.env).some(k=>k.startsWith('OPENAI_')&&!['OPENAI_API_KEY','OPENAI_EXTRACTION_MODEL'].includes(k)));
  const deadline=tighter.deadlineMs??SETTINGS.outer_stream_deadline_ms,byteLimit=tighter.maximumWireBytes??SETTINGS.maximum_wire_bytes,eventLimit=tighter.maximumParsedEvents??SETTINGS.maximum_parsed_events;
  assert(Number.isInteger(deadline)&&deadline>0&&deadline<=SETTINGS.outer_stream_deadline_ms);
  assert(Number.isInteger(byteLimit)&&byteLimit>0&&byteLimit<=SETTINGS.maximum_wire_bytes);
  assert(Number.isInteger(eventLimit)&&eventLimit>0&&eventLimit<=SETTINGS.maximum_parsed_events);
  const started=performance.now(),elapsed=()=>Math.max(0,performance.now()-started);
  const observation:Observation={http_status:null,header_request_id:null,headers_ms:null,created_ms:null,in_progress_ms:null,
    first_output_delta_ms:null,terminal_ms:null,duration_ms:0,dispatch_count:0,wire_bytes:0,output_text_bytes:0,parsed_events:0,
    event_counts:{created:0,in_progress:0,output_text_delta:0,completed:0,incomplete:0,failed:0,other:0},terminal_event:null,terminal_status:null};
  const snapshot=()=>structuredClone({...observation,duration_ms:elapsed()});
  if(externalSignal?.aborted)throw new StreamingFailure('PROCESSING_CANCELLED',snapshot());
  const controller=new AbortController();let expired=false,calls=0,limitCode:string|null=null;
  let rejectStop!:(error:Error)=>void;const stopped=new Promise<never>((_,reject)=>{rejectStop=reject;});void stopped.catch(()=>{});
  const stop=(code:string)=>{controller.abort();rejectStop(new StreamingFailure(code,snapshot()));};
  const timer=setTimeout(()=>{expired=true;stop('OPENAI_TIMEOUT');},deadline);
  const cancel=()=>stop('PROCESSING_CANCELLED');externalSignal?.addEventListener('abort',cancel,{once:true});
  const signal=externalSignal?AbortSignal.any([externalSignal,controller.signal]):controller.signal;
  let abortStream:(()=>void)|undefined,returnIterator:(()=>Promise<unknown>)|undefined,cancelBody:(()=>Promise<unknown>)|undefined;
  try{
    if(externalSignal?.aborted)throw new StreamingFailure('PROCESSING_CANCELLED',snapshot());
    const client=new OpenAI({apiKey:config.apiKey.trim(),adminAPIKey:null,organization:null,project:null,webhookSecret:null,
      baseURL:'https://api.openai.com/v1',timeout:deadline,maxRetries:0,logLevel:'off',fetchOptions:{redirect:'error'},
      fetch:async(input,init)=>{
        assert.equal(calls++,0);assert.equal(String(input),'https://api.openai.com/v1/responses');assert.equal(init?.method,'POST');assert.equal(init.body,capture.bytes);
        observation.dispatch_count++;const raw=await dispatch(input,{...init,redirect:'error'});
        observation.headers_ms=elapsed();observation.http_status=safeStatus(raw.status);observation.header_request_id=safeId(raw.headers.get('x-request-id'));
        if(!raw.body)return raw;
        const reader=raw.body.getReader();cancelBody=()=>reader.cancel();
        // Bound raw bytes before SDK SSE/JSON decoding, including a single huge event.
        const body=new ReadableStream<Uint8Array>({
          async pull(output){
            try{
              const chunk=await reader.read();if(chunk.done){output.close();return;}
              if(!(chunk.value instanceof Uint8Array))throw new IntegrationError('STREAM_PROTOCOL_INVALID','The streaming diagnostic returned an unsupported byte stream.');
              observation.wire_bytes+=chunk.value.byteLength;
              if(observation.wire_bytes>byteLimit){limitCode='STREAM_BYTE_LIMIT';stop(limitCode);output.error(new Error('STREAM_BYTE_LIMIT'));void reader.cancel().catch(()=>{});return;}
              output.enqueue(chunk.value);
            }catch{output.error(new Error('STREAM_BODY_INTERRUPTED'));}
          },cancel(){controller.abort();return reader.cancel();},
        });
        return new Response(body,{status:raw.status,headers:raw.headers});
      }});
    const received=await Promise.race([client.responses.create(JSON.parse(capture.bytes)as ResponseCreateParamsStreaming,{signal}).withResponse(),stopped]);
    const stream=received.data,iterator=stream[Symbol.asyncIterator]();abortStream=()=>stream.controller.abort();returnIterator=()=>iterator.return?.()??Promise.resolve();
    while(true){
      const next=await Promise.race([iterator.next(),stopped]);
      if(externalSignal?.aborted)throw new StreamingFailure('PROCESSING_CANCELLED',snapshot());
      if(expired||elapsed()>=deadline)throw new StreamingFailure('OPENAI_TIMEOUT',snapshot());
      if(next.done)break;
      if(++observation.parsed_events>eventLimit){limitCode='STREAM_EVENT_LIMIT';throw new StreamingFailure(limitCode,snapshot());}
      const event=record(next.value);if(!event||typeof event.type!=='string')throw new StreamingFailure('STREAM_PROTOCOL_INVALID',snapshot());
      if(event.type==='response.created'){observation.event_counts.created++;observation.created_ms??=elapsed();}
      else if(event.type==='response.in_progress'){observation.event_counts.in_progress++;observation.in_progress_ms??=elapsed();}
      else if(event.type==='response.output_text.delta'){
        if(typeof event.delta!=='string')throw new StreamingFailure('STREAM_PROTOCOL_INVALID',snapshot());
        observation.event_counts.output_text_delta++;observation.output_text_bytes+=Buffer.byteLength(event.delta);observation.first_output_delta_ms??=elapsed();
      }else if(['response.completed','response.incomplete','response.failed'].includes(event.type)){
        const terminal=event.type.slice('response.'.length)as 'completed'|'incomplete'|'failed';observation.event_counts[terminal]++;
        observation.terminal_event=terminal;observation.terminal_ms=elapsed();
        const response=record(event.response);if(!response)throw new StreamingFailure('STREAM_PROTOCOL_INVALID',snapshot());
        observation.terminal_status=['completed','incomplete','failed'].includes(String(response.status))?response.status as Observation['terminal_status']:null;
        return{response,observation:snapshot()};
      }else observation.event_counts.other++;
    }
    throw new StreamingFailure(expired?'OPENAI_TIMEOUT':'STREAM_TERMINAL_MISSING',snapshot());
  }catch(error){
    const code=externalSignal?.aborted?'PROCESSING_CANCELLED':expired?'OPENAI_TIMEOUT':limitCode??(error instanceof StreamingFailure?error.code:
      error instanceof OpenAI.APIConnectionTimeoutError?'OPENAI_TIMEOUT':
      observation.http_status===401||observation.http_status===403?'OPENAI_ACCESS_DENIED':observation.http_status===429?'OPENAI_RATE_LIMITED':
      observation.http_status!==null&&observation.http_status>=400&&observation.http_status<500&&!([408,409].includes(observation.http_status))?'OPENAI_REQUEST_REJECTED':'OPENAI_UNAVAILABLE');
    throw new StreamingFailure(code,snapshot());
  }finally{
    clearTimeout(timer);externalSignal?.removeEventListener('abort',cancel);controller.abort();abortStream?.();
    // A non-cooperating body cleanup cannot extend the outer diagnostic bound.
    void returnIterator?.().catch(()=>{});void cancelBody?.().catch(()=>{});
  }
}
