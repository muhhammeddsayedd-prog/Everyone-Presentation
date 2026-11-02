/** Independent budget diagnostic; no production default or consumed entry is changed. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import type { ResponseCreateParamsNonStreaming } from 'openai/resources/responses/responses';
import { extractSpecs, type OpenAISpecsConfig } from '../../../packages/integrations/src/openai-specs.ts';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import type { SpecsExtractionInput } from '../../../packages/integrations/src/specs-types.ts';
import type { Bounds, Exchange } from '../pdf47-streaming-evaluation/transport.mts';
export type { Bounds, Exchange } from '../pdf47-streaming-evaluation/transport.mts';

export const REUSED_TRANSPORT_PATH='development/m07/pdf47-streaming-evaluation/transport.mts';
export const REUSED_TRANSPORT_SHA256='2bd36deadee595157c01494cfa4016bcf9e6baefcd026e9bbfd58b148b61da1e';
export const SETTINGS={model:'gpt-6.1-sol',reasoning_effort:'low',outer_stream_deadline_ms:300_000,
  production_builder_validation_timeout_ms:60_000,production_timeout_cap_ms:70_000,
  previous_max_output_tokens:16_384,max_output_tokens:32_768,sdk_retries:0,maximum_provider_requests:1,
  store:false,stream:true,tools:0,maximum_wire_bytes:8*1024*1024,maximum_parsed_events:50_000}as const;
type Built={request:ResponseCreateParamsNonStreaming;bytes:string;sha256:string};
export type Capture={previous:Built;production:Built;bytes:string;sha256:string};
const hash=(bytes:string)=>createHash('sha256').update(bytes).digest('hex');
const config32=(config:OpenAISpecsConfig):OpenAISpecsConfig=>({...config,timeoutMs:60_000,maxOutputTokens:32_768,reasoningEffort:'low'});

async function capture(input:SpecsExtractionInput,config:OpenAISpecsConfig):Promise<Built>{
  assert.equal(config.model,SETTINGS.model);let request:ResponseCreateParamsNonStreaming|undefined,calls=0;
  const sentinel=new IntegrationError('EVALUATION_CAPTURE_ONLY','Network-free request capture.');
  try{await extractSpecs(input,config,async value=>{assert.equal(++calls,1);request=structuredClone(value);throw sentinel;});assert.fail('Capture returned.');}
  catch(error){if(error!==sentinel)throw error;}
  assert.equal(calls,1);assert(request);const bytes=JSON.stringify(request);return{request,bytes,sha256:hash(bytes)};
}

/** Both budgets come from the actual builder; the inverse excludes every other change. */
export function assertBudgetInverse(previous:Built,production:Built):void{
  for(const built of[previous,production]){assert.equal(JSON.stringify(built.request),built.bytes);assert.equal(hash(built.bytes),built.sha256);}
  const old=JSON.parse(previous.bytes)as Record<string,unknown>,next=JSON.parse(production.bytes)as Record<string,unknown>;
  assert.equal(old.max_output_tokens,16_384);assert.equal(next.max_output_tokens,32_768);assert.equal(old.stream,false);assert.equal(next.stream,false);
  next.max_output_tokens=16_384;assert.equal(JSON.stringify(next),previous.bytes,'BUDGET_DIFF_NOT_CLOSED');
}
export function streamingBytes(built:Capture):string{
  assertBudgetInverse(built.previous,built.production);const body=JSON.parse(built.production.bytes)as Record<string,unknown>;
  body.stream=true;const bytes=JSON.stringify(body);body.stream=false;assert.equal(JSON.stringify(body),built.production.bytes);return bytes;
}
export async function captureBudgetRequest(input:SpecsExtractionInput,config:OpenAISpecsConfig):Promise<Capture>{
  const previous=await capture(input,{...config32(config),maxOutputTokens:16_384});
  const production=await capture(input,config32(config));assertBudgetInverse(previous,production);
  const partial={previous,production,bytes:'',sha256:''},bytes=streamingBytes(partial);return{...partial,bytes,sha256:hash(bytes)};
}
export async function validateBudgetResponse(input:SpecsExtractionInput,config:OpenAISpecsConfig,built:Capture,response:unknown){
  assert.equal(streamingBytes(built),built.bytes);assert.equal(hash(built.bytes),built.sha256);let calls=0;
  const output=await extractSpecs(input,config32(config),async rebuilt=>{
    assert.equal(++calls,1);if(JSON.stringify(rebuilt)!==built.production.bytes)throw new IntegrationError('EVALUATION_REQUEST_DRIFT','Validation request differs.');
    return response; // Exact received object; no manufactured SDK request ID.
  });assert.equal(calls,1);return output;
}
async function transport(){
  const url=new URL('../pdf47-streaming-evaluation/transport.mts',import.meta.url);
  assert.equal(createHash('sha256').update(await readFile(url)).digest('hex'),REUSED_TRANSPORT_SHA256);
  return import(url.href)as Promise<typeof import('../pdf47-streaming-evaluation/transport.mts')>;
}
export async function sendBudgetRequest(built:Capture,config:OpenAISpecsConfig,dispatch:typeof fetch,signal?:AbortSignal,bounds:Bounds={}):Promise<Exchange>{
  assert.equal(streamingBytes(built),built.bytes);assert.equal(hash(built.bytes),built.sha256);
  // The frozen transport admits the exact supplied body; its16k metadata constant
  // is not a builder override. This call reuses only send/deadline/limits.
  return(await transport()).sendStreamingRequest(built,config,dispatch,signal,bounds);
}
