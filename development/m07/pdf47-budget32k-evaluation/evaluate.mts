/** Source-only independent32k diagnostic; native entry and private bridge are default off. */
import assert from 'node:assert/strict';
import { IntegrationError } from '../../../packages/integrations/src/errors.ts';
import type { OpenAISpecsConfig } from '../../../packages/integrations/src/openai-specs.ts';
import type { SpecsExtractionInput,SpecsExtractionOutput } from '../../../packages/integrations/src/specs-types.ts';
import { captureBudgetRequest,validateBudgetResponse,SETTINGS,type Capture,type Exchange } from './transport.mts';

export const PURPOSE='one_retained_pdf47_budget32k_evaluation';
export const INPUT_SCHEMA='pdf47-budget32k-input.v1';
export const EXPECTED_INPUT_SHA256='9185702344c74088328b8c6dee0d78d47bd70cf60c78ad520499937bb74e9742';
export const EXPECTED_PREVIOUS_REQUEST_SHA256='db2b95fd8f8ccfdcfe9b0294593652efcf6c80207e1e8ea69259cbe0451993be';
export const REFERENCE_PATH='tracking/evidence/m07/pdf47-streaming-evaluation/45452578-b14e-48e5-af08-187089cb9b58-result.json';
export const REFERENCE_SHA256='178c5da68c52b97a7c0d3318a36f6b1db1808c0d457a1b9c7fdc7a58764262a8';
export const PRODUCTION_PINS={
 'packages/integrations/src/openai-specs.ts':'aa72bb5a46a91142a07968b80bcd49b0361cd51fc091cc543b5c2a874f84bdb9',
 'packages/integrations/src/errors.ts':'ac02c36b535879e439752eeda0518c2d84389a16af97175d004f8fa7c61d4da2',
 'packages/integrations/src/specs-schema.ts':'389c36f8cca115f46390024170071851e8a974befdde19476771a20cbc63569c',
 'packages/integrations/src/prompts/specs-v1.ts':'719e7e9225cc2f939df279ff2b8bfc325f68ce0b03d30d4f3ef7ede2820e7033',
 'contracts/json-schema/specs-extraction.schema.json':'c55e758da1b71119a3a8d7cc408340e502088c8ab88a89c81da7effb85a8809d',
}as const;
type Prepared={schema_version:string;job_id:string;source_asset_id:string;configured_model:string;prepared_source_verified:boolean;
 prepared_text_bytes:number;mapped_pages:number;input:SpecsExtractionInput};
export interface Ports{
 read():Promise<Prepared>;config():OpenAISpecsConfig;seals():Promise<Record<string,string>>;admitCapture(value:Capture):Promise<void>;
 claim(value:unknown):Promise<void>;receipt(phase:string,value:unknown):Promise<void>;send(value:Capture,config:OpenAISpecsConfig):Promise<Exchange>;
 persistResponse(value:Exchange):Promise<void>;persist(value:SpecsExtractionOutput):Promise<void>;
}
const safeCodes=new Set(['OPENAI_TIMEOUT','OPENAI_UNAVAILABLE','OPENAI_ACCESS_DENIED','OPENAI_RATE_LIMITED','OPENAI_REQUEST_REJECTED',
 'PROCESSING_CANCELLED','AI_REFUSAL','AI_RESULT_INVALID','AI_EVIDENCE_INVALID','AI_EVIDENCE_MISSING','AI_SOURCE_MISMATCH',
 'AI_ROLE_KEYS_INVALID','AI_RESPONSE_INVALID','AI_RESPONSE_INCOMPLETE','AI_RESPONSE_NOT_COMPLETE','AI_OUTPUT_UNEXPECTED',
 'EVALUATION_REQUEST_DRIFT','STREAM_BYTE_LIMIT','STREAM_EVENT_LIMIT','STREAM_TERMINAL_MISSING','STREAM_PROTOCOL_INVALID']);
const id=(v:unknown)=>typeof v==='string'&&/^req_[A-Za-z0-9_-]{1,128}$/u.test(v)?v:null;
const record=(v:unknown)=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const count=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=Number.MAX_SAFE_INTEGER?v:null;
export function safeObservation(value:unknown){
 const row=record(value);if(!row)return null;const counts=record(row.event_counts)??{};
 return{http_status:typeof row.http_status==='number'&&Number.isInteger(row.http_status)&&row.http_status>=100&&row.http_status<=599?row.http_status:null,
  header_request_id:id(row.header_request_id),dispatch_count:row.dispatch_count===0||row.dispatch_count===1?row.dispatch_count:null,
  ...Object.fromEntries(['headers_ms','created_ms','in_progress_ms','first_output_delta_ms','terminal_ms','duration_ms','wire_bytes','output_text_bytes','parsed_events'].map(k=>[k,count(row[k])])),
  event_counts:Object.fromEntries(['created','in_progress','output_text_delta','completed','incomplete','failed','other'].map(k=>[k,count(counts[k])])),
  terminal_event:typeof row.terminal_event==='string'&&['completed','incomplete','failed'].includes(row.terminal_event)?row.terminal_event:null,
  terminal_status:typeof row.terminal_status==='string'&&['completed','incomplete','failed'].includes(row.terminal_status)?row.terminal_status:null};
}
export async function evaluateOnce(run:string,ports:Ports){
 assert(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u.test(run));const prepared=await ports.read();
 assert.equal(prepared.schema_version,INPUT_SCHEMA);assert.equal(prepared.job_id,'47f86513-8999-4946-b5d9-f2fd6a18fd00');
 assert.equal(prepared.source_asset_id,'0fbc905f-c51e-472d-9d03-74664ee9ac86');assert.equal(prepared.input.sourceAssetId,prepared.source_asset_id);
 assert.equal(prepared.input.inputHash,EXPECTED_INPUT_SHA256);assert.equal(prepared.configured_model,SETTINGS.model);assert.equal(prepared.prepared_source_verified,true);
 assert.equal(prepared.prepared_text_bytes,12807);assert.equal(prepared.mapped_pages,24);assert.equal(prepared.input.paragraphs.length,219);
 const config=ports.config();assert.equal(config.model,SETTINGS.model);const seals=await ports.seals();
 for(const[file,expected]of Object.entries(PRODUCTION_PINS))assert.equal(seals[file],expected);
 const built=await captureBudgetRequest(prepared.input,config);await ports.admitCapture(built);
 const base={schema_version:'1.0',purpose:PURPOSE,run_id:run,job_id:prepared.job_id,source_asset_id:prepared.source_asset_id,input_sha256:EXPECTED_INPUT_SHA256,
  previous_streaming_reference:{path:REFERENCE_PATH,sha256:REFERENCE_SHA256},previous_production_request_sha256:built.previous.sha256,
  budget32_production_request_sha256:built.production.sha256,request_sha256:built.sha256,
  request_change:'only_max_output_tokens_16384_to_32768_then_stream_false_to_true',settings:SETTINGS,source_seals:seals,
  request_capture:'production_extractSpecs_16k_and32k_injected_sentinel_no_sdk',response_validation:'production_extractSpecs_32k_with_unchanged_received_terminal',
  whole_production_function_acceptance:false,production_acceptance:false,nonstream_transport_acceptance:false,
  changed_budget_and_delivery_diagnostic:true,job_outbox_or_writeback:false};
 await ports.claim(base);await ports.receipt('dispatch-started',{...base,result:'dispatch_started',provider_requests_initiated:0});
 const began=Date.now();let phase='transport',exchange:Exchange|undefined,result:Record<string,unknown>;
 try{
  exchange=await ports.send(built,config);phase='post_transport_source_verification';assert.deepEqual(await ports.seals(),seals);
  phase='private_response_custody';await ports.persistResponse(exchange);phase='production_response_validation';assert.deepEqual(await ports.seals(),seals);
  const output=await validateBudgetResponse(prepared.input,config,built,exchange.response);
  phase='private_validated_output_custody';await ports.persist(output);
  result={...base,result:'validated',provider_requests_initiated:exchange.observation.dispatch_count===0||exchange.observation.dispatch_count===1?exchange.observation.dispatch_count:null,duration_ms:Date.now()-began,
   observation:safeObservation(exchange.observation),header_request_id:id(exchange.observation.header_request_id),sdk_request_id:id(output.metadata.request_id),
   metadata:{...output.metadata,request_id:id(output.metadata.request_id),response_id:/^resp_[A-Za-z0-9_-]{1,128}$/u.test(output.metadata.response_id)?output.metadata.response_id:null,
    resolved_model:output.metadata.resolved_model===SETTINGS.model?SETTINGS.model:null},
   request_byte_inverses_verified:true,production_schema_and_evidence_validation:true,role_count:output.result.roles.length,
   evidence_count:output.result.roles.reduce((n,r)=>n+r.evidence.length,0),
   clarification_count:output.result.clarifications.length+output.result.roles.reduce((n,r)=>n+r.clarifications.length,0),factual_quality_evaluated:false,automatic_retry:false};
 }catch(error){
  const observation=safeObservation(exchange?.observation??record(error)?.observation);
  result={...base,result:'failed_or_unknown',phase,provider_requests_initiated:observation?.dispatch_count===0||observation?.dispatch_count===1?observation.dispatch_count:null,
   duration_ms:Date.now()-began,code:error instanceof IntegrationError&&safeCodes.has(error.code)?error.code:'EVALUATION_OUTCOME_UNCONFIRMED',
   observation,provider_response_observed:exchange!==undefined,validated_output_acceptance:false,automatic_retry:false,
   charge_unknown:true,remote_completion_unknown:exchange===undefined||!observation?.terminal_status};
 }
 await ports.receipt('result',result);return result; // Receipt failure is final; never replay dispatch or custody.
}
