import test from 'node:test';import assert from 'node:assert/strict';import { CASES,inspectExecution,metadataProjection } from './execution-metadata.mjs';
const config={N8N_BASE_URL:'https://fixture.app.n8n.cloud',N8N_API_KEY:'SYNTHETIC_SECRET'};
const value=()=>({id:CASES[0].execution_id,workflowId:CASES[0].workflow_id,status:'error',mode:'webhook',startedAt:'2026-10-31T01:26:00.000Z',stoppedAt:'2026-10-31T01:26:01.000Z',waitTill:null,retryOf:null,retrySuccessId:null});
test('safe metadata projection enforces exact execution and workflow without arbitrary fields',()=>{
  const source={...value(),deduplicationKey:'SYNTHETIC_SECRET',tracingContext:{tracestate:'SYNTHETIC_SECRET'}};
  const result=metadataProjection(source,CASES[0]);assert.equal(result.status,'error');assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
  for(const changed of[{...source,id:'31521'},{...source,workflowId:CASES[1].workflow_id},{...source,status:'SYNTHETIC_SECRET'},{...source,startedAt:'untrusted'},{...source,data:{}},{...source,workflowData:{}},{...source,customData:{}}])assert.throws(()=>metadataProjection(changed,CASES[0]));
});
test('GET explicitly suppresses data, disables redirects, uses one fixed endpoint and no retries',async()=>{
  let calls=0;const result=await inspectExecution(config,CASES[0],async(url,options)=>{
    calls++;assert.equal(url,config.N8N_BASE_URL+'/api/v1/executions/31520?includeData=false');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');assert.equal(options.headers['X-N8N-API-KEY'],'SYNTHETIC_SECRET');return Response.json(value());
  });assert.equal(calls,1);assert.equal(result.metadata_returned,true);assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
});
test('missing, access-denied and unavailable records expose only status/classification',async()=>{
  for(const status of[404,401,403,429,500]){let calls=0;const result=await inspectExecution(config,CASES[0],async()=>{calls++;return new Response('SYNTHETIC_SECRET',{status});});assert.equal(calls,1);assert.equal(result.http_status,status);assert.equal(result.metadata_returned,false);assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));}
});
test('oversized, payload-bearing or unknown-network failures never leak bodies/errors',async()=>{
  for(const fetcher of[async()=>new Response('SYNTHETIC_SECRET'.repeat(10000)),async()=>Response.json({...value(),data:{private:'SYNTHETIC_SECRET'}}),async()=>{throw Error('SYNTHETIC_SECRET');}]){
    const result=await inspectExecution(config,CASES[0],fetcher);assert.equal(result.metadata_returned,false);assert.equal(result.safe_error_class,'N8N_METADATA_UNCONFIRMED');assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
  }
});
