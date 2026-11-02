import assert from 'node:assert/strict';
import { test } from 'node:test';
import OpenAI from 'openai';
import { extractSpecs, type SpecsTransport } from '../../packages/integrations/src/openai-specs.ts';
import { IntegrationError } from '../../packages/integrations/src/errors.ts';
import { integrationErrorToJobFailure } from '../../packages/integrations/src/job-errors.ts';

const input={sourceAssetId:null,correlationId:'synthetic-sdk-error-proof',inputHash:'a'.repeat(64),paragraphs:[{index:0,page:null,text:'One synthetic role requirement.'}]};
const config={apiKey:'synthetic-placeholder-key',model:'synthetic-configured-model'};
async function failure(transport: SpecsTransport, options: { timeoutMs?: number; signal?: AbortSignal }={}): Promise<IntegrationError> {
 let observed: unknown;
 try { await extractSpecs(input,{...config,...(options.timeoutMs===undefined?{}:{timeoutMs:options.timeoutMs})},transport,options.signal); }
 catch(error) { observed=error; }
 assert.ok(observed instanceof IntegrationError);
 assert.doesNotMatch(JSON.stringify(observed),/PRIVATE/u);
 return observed;
}

test('real installed SDK connection timeout class is classified once without its private message',async()=>{
 let calls=0;
 const sdkError=new OpenAI.APIConnectionTimeoutError({message:'PRIVATE_PROVIDER_TIMEOUT'});
 // SDK7.45.1 inherits Error.name; matching a fabricated subclass name missed it.
 assert.equal(sdkError.name,'Error');
 const error=await failure(async()=>{calls++;throw sdkError;});
 assert.equal(error.code,'OPENAI_TIMEOUT');assert.equal(error.retryable,true);assert.equal(calls,1);
 assert.deepEqual(error.details,{http_status:null,request_id:null,retry_after_ms:null});
});

test('internal extraction deadline with real SDK user-abort class remains a retryable timeout',async()=>{
 let calls=0;
 const keepalive=setTimeout(()=>{},1000);
 try {
  const error=await failure(async(_request,signal)=>{
   calls++;assert.ok(signal);
   return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new OpenAI.APIUserAbortError({message:'PRIVATE_ABORT'})),{once:true}));
  },{timeoutMs:10});
  assert.equal(error.code,'OPENAI_TIMEOUT');assert.equal(error.retryable,true);assert.equal(calls,1);
  assert.equal(integrationErrorToJobFailure(error).code,'DEPENDENCY_UNAVAILABLE');
 } finally { clearTimeout(keepalive); }
});

test('external cancellation wins over SDK timeout and already-classified adapter errors',async()=>{
 for(const thrown of [new OpenAI.APIConnectionTimeoutError(),new IntegrationError('OPENAI_TIMEOUT','safe synthetic timeout',true)]){
  const controller=new AbortController();let calls=0;
  const error=await failure(async()=>{calls++;controller.abort();throw thrown;},{signal:controller.signal});
  assert.equal(error.code,'PROCESSING_CANCELLED');assert.equal(error.retryable,false);assert.equal(calls,1);
 }
 const controller=new AbortController();const keepalive=setTimeout(()=>{},1000);
 try {
  const error=await failure(async(_request,signal)=>{
   assert.ok(signal);return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>{controller.abort();reject(new OpenAI.APIUserAbortError());},{once:true}));
  },{timeoutMs:10,signal:controller.signal});
  assert.equal(error.code,'PROCESSING_CANCELLED');assert.equal(error.retryable,false);
 } finally { clearTimeout(keepalive); }
});

test('real SDK HTTP errors retain safe camel-case requestID and the existing status classification',async()=>{
 const cases=[
  [401,new OpenAI.AuthenticationError(401,{message:'PRIVATE_BODY'},'PRIVATE',new Headers({'x-request-id':'req_specs_sdk_401','authorization':'PRIVATE'})),'OPENAI_ACCESS_DENIED',false],
  [403,new OpenAI.PermissionDeniedError(403,{message:'PRIVATE_BODY'},'PRIVATE',new Headers({'x-request-id':'req_specs_sdk_403'})),'OPENAI_ACCESS_DENIED',false],
  [400,new OpenAI.BadRequestError(400,{message:'PRIVATE_BODY'},'PRIVATE',new Headers({'x-request-id':'req_specs_sdk_400'})),'OPENAI_REQUEST_REJECTED',false],
  [429,new OpenAI.RateLimitError(429,{message:'PRIVATE_BODY',code:'insufficient_quota'},'PRIVATE',new Headers({'x-request-id':'req_specs_sdk_429'})),'OPENAI_QUOTA_EXCEEDED',false],
  [429,new OpenAI.RateLimitError(429,{message:'PRIVATE_BODY'},'PRIVATE',new Headers({'x-request-id':'req_specs_sdk_429','retry-after':'2'})),'OPENAI_RATE_LIMITED',true],
  [503,new OpenAI.InternalServerError(503,{message:'PRIVATE_BODY'},'PRIVATE',new Headers({'x-request-id':'req_specs_sdk_503'})),'OPENAI_UNAVAILABLE',true],
 ] as const;
 for(const[status,sdkError,expected,retryable]of cases){
  let calls=0;const error=await failure(async()=>{calls++;throw sdkError;});
  assert.equal(error.code,expected);assert.equal(error.retryable,retryable);assert.equal(calls,1);
  assert.equal(error.details.http_status,status);assert.equal(error.details.request_id,`req_specs_sdk_${status}`);
 }
});

test('legacy request_id stays compatible and unsafe SDK request IDs never enter diagnostics',async()=>{
 const legacy=await failure(async()=>{throw{status:503,request_id:'req_legacy_safe',requestID:'req_sdk_safe'};});
 assert.equal(legacy.details.request_id,'req_legacy_safe');
 for(const id of ['sk-PRIVATE_TOKEN','req_sdk?token=PRIVATE','req_'+'a'.repeat(129)]){
  const error=await failure(async()=>{throw new OpenAI.InternalServerError(503,{message:'PRIVATE_BODY'},'PRIVATE',new Headers({'x-request-id':id}));});
  assert.equal(error.details.request_id,null);
 }
});

test('SDK user abort without an observed cancellation or deadline does not invent either cause',async()=>{
 const error=await failure(async()=>{throw new OpenAI.APIUserAbortError({message:'PRIVATE_UNKNOWN_ABORT'});});
 assert.equal(error.code,'OPENAI_UNAVAILABLE');assert.equal(error.retryable,true);
});
