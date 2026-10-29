import test from 'node:test';
import assert from 'node:assert/strict';
import { handleServiceJobRequest, readJobServiceConfiguration, type JobServicePort } from '../../apps/web/lib/job-service-http';
import { SpecsRuntimeGatewayError } from '@eps/central/specs-runtime';
const environment = { APP_BASE_URL:'http://127.0.0.1:3000',APP_ENV:'test',CENTRAL_ADAPTER_MODE:'supabase',
  EPS_JOB_SERVICE_BEARER:'a'.repeat(43),EPS_JOB_CLAIM_KEY_ID:'synthetic-claim-v1',EPS_JOB_CLAIM_KEY_HEX:'b'.repeat(64) };
const configuration=readJobServiceConfiguration(environment);
const claim={ job_id:'78900000-0000-4000-8000-000000000001',stage:'prepare_document',input_hash:'c'.repeat(64) };
function request(operation:string,body:unknown,headers:Record<string,string>={}) {
 return new Request(`${environment.APP_BASE_URL}/api/v1/internal/jobs/${operation}`,{ method:'POST',headers:{ host:'127.0.0.1:3000',
  authorization:`Bearer ${configuration.bearer}`,'Content-Type':'application/json','Idempotency-Key':'synthetic-claim-intent',...headers },body:JSON.stringify(body) });
}
test('service config fails closed outside local central development and does not reuse n8n secret',()=>{
 for(const change of [{ NODE_ENV:'production' },{ APP_ENV:'staging' },{ CENTRAL_ADAPTER_MODE:'local_fixture' },{ APP_BASE_URL:'https://hosted.example' },
  { EPS_JOB_SERVICE_BEARER:'missing' },{ EPS_JOB_CLAIM_KEY_HEX:'invalid' },{ N8N_DISPATCH_SECRET:environment.EPS_JOB_SERVICE_BEARER }]) {
  assert.throws(()=>readJobServiceConfiguration({ ...environment,...change }));
 }
});
test('service authentication precedes body parsing/gateway creation and rejects cookies, origins, user credentials and rebinding',async()=>{
 let called=0; const gateway=async()=>{ called++; return {} as JobServicePort; };
 const deniedHeaders:Record<string,string>[]=[{ authorization:'Bearer user-access-token' },{ authorization:'' },{ cookie:'browser=session' },
  { origin:environment.APP_BASE_URL },{ host:'attacker.test' },{ authorization:`Bearer ${'z'.repeat(43)}` }];
 for(const headers of deniedHeaders) {
  const response=await handleServiceJobRequest(request('claim',claim,headers),['claim'],configuration,gateway,'request');
  assert.equal(response.status,401);
 }
 assert.equal(called,0);
});
test('HTTP claim passes its durable idempotency key and typed input to the narrow runtime without user IDs',async()=>{
 const calls:unknown[][]=[]; const gateway={ claimWithReplay:async(...args:unknown[])=>{ calls.push(args); return { job_id:claim.job_id }; } } as unknown as JobServicePort;
 const response=await handleServiceJobRequest(request('claim',claim),['claim'],configuration,async()=>gateway,'request');
 assert.equal(response.status,200); assert.equal((await response.json()).data.job_id,claim.job_id);
 assert.deepEqual(calls[0].slice(0,2),[claim,'synthetic-claim-intent']);
 const invalid=await handleServiceJobRequest(request('claim',{ ...claim,principal_id:'forged' }),['claim'],configuration,async()=>gateway,'request');
 assert.equal(invalid.status,400); assert.equal(calls.length,1);
});
test('callbacks enforce event identity/type before fixed dispatch and preserve sanitized domain errors',async()=>{
 const event={ ...claim,event_id:'78900000-0000-4000-8000-000000000003',attempt_id:'78900000-0000-4000-8000-000000000002',
  lease_token:'d'.repeat(64),sequence:1,event_type:'heartbeat' };
 let calls=0; const gateway={ recordEvent:async()=>{ calls++; throw new SpecsRuntimeGatewayError('STALE_STAGE_LEASE',409,'known'); } } as unknown as JobServicePort;
 const result=await handleServiceJobRequest(request('events',event,{ 'Idempotency-Key':event.event_id }),['events'],configuration,async()=>gateway,'request');
 assert.equal(result.status,409); assert.equal((await result.json()).error.code,'STALE_STAGE_LEASE');
 for(const [operation,key] of [['complete',event.event_id],['events','synthetic-other-intent']]) {
  const response=await handleServiceJobRequest(request(operation,event,{ 'Idempotency-Key':key }),[operation],configuration,async()=>gateway,'request');
  assert.equal(response.status,400);
 }
 assert.equal(calls,1);
});
test('private asset route derives candidate mode from live lease input rather than a caller-selected kind',async()=>{
 const input={job_id:claim.job_id,attempt_id:'78900000-0000-4000-8000-000000000002',lease_token:'d'.repeat(64),asset_id:'78900000-0000-4000-8000-000000000004',access:'read'};
 const calls:string[]=[];const gateway={getInput:async()=>{calls.push('current-input');return{stage:'prepare_candidate'};},
  files:{getAssetAccess:async()=>{throw new Error('document port must not be used');}},candidateFiles:{getAssetAccess:async()=>{calls.push('candidate-access');return{asset_id:input.asset_id};}}} as unknown as JobServicePort;
 const response=await handleServiceJobRequest(request('assets/access',input),['assets','access'],configuration,async()=>gateway,'request');
 assert.equal(response.status,200);assert.equal((await response.json()).data.asset_id,input.asset_id);assert.deepEqual(calls,['current-input','candidate-access']);
});
