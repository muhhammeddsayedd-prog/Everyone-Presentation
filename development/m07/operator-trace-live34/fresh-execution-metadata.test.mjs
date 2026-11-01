import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {expectedFreshPlan,proveFreshPlan,observeFresh,DURABLE_RECEIPT,PINS} from './fresh-execution-metadata.mjs';
const bytes=await readFile(new URL('../../../'+DURABLE_RECEIPT,import.meta.url));
const config={N8N_BASE_URL:'https://fixture.app.n8n.cloud',N8N_API_KEY:'SYNTHETIC_SECRET'};
const response=()=>({id:'31686',workflowId:'gfhxzvSkprS2CI4o',status:'success',mode:'webhook',startedAt:'2026-10-31T17:57:03Z',stoppedAt:'2026-10-31T17:57:04Z',waitTill:null,retryOf:null,retrySuccessId:null});
test('all frozen helper and actual evidence pins match current local bytes',async()=>{
 for(const [file,digest]of Object.entries(PINS)){
  const raw=await readFile(new URL('../../../'+file,import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'),digest,file);
 }
});
test('actual protected metadata input bootstraps through the fixed interpreter without provider/config IO',async t=>{
 const planPath=new URL('../../../.local/m03-english-component/at074-new-english-job-input.json',import.meta.url);
 try{await access(planPath);}catch{t.skip('actual root-created protected input is unavailable');return;}
 const env={...process.env};for(const key of Object.keys(env))if(key.toUpperCase().includes('DEBUG'))delete env[key];
 const result=await promisify(execFile)(fileURLToPath(new URL('../../../.venv-skills/Scripts/python.exe',import.meta.url)),
  ['-X','utf8','-B',fileURLToPath(new URL('./read-protected-fresh-input.py',import.meta.url))],
  {env,windowsHide:true,timeout:10000,maxBuffer:16384});
 let privatePlan=JSON.parse(result.stdout);
 try{assert.equal(proveFreshPlan(privatePlan,bytes).execution_id,'31686');assert.equal(result.stderr,'');}
 finally{privatePlan=null;result.stdout='';result.stderr='';}
});
test('actual durable receipt yields the exact one-execution plan',()=>{
 const plan=expectedFreshPlan(bytes);assert.equal(plan.execution_refs.length,1);assert.equal(proveFreshPlan(plan,bytes).execution_id,'31686');
 assert.throws(()=>expectedFreshPlan(Buffer.from('{}')));
});
test('private plan cannot redirect to another execution/workflow/attempt or receipt',()=>{
 for(const change of[p=>p.execution_refs[0].execution_id='31685',p=>p.execution_refs[0].workflow_id='kE4qSEcugaKhIoJU',p=>p.execution_refs[0].attempt=4,p=>p.execution_refs.push({...p.execution_refs[0],execution_id:'31687'}),p=>p.durable_observation.observed_at='2026-10-31T18:09:56Z']){
  const plan=expectedFreshPlan(bytes);change(plan);assert.throws(()=>proveFreshPlan(plan,bytes));
 }
});
test('one fixed metadata-only GET reuses frozen privacy and identity projection',async()=>{
 let calls=0;const result=await observeFresh(expectedFreshPlan(bytes),bytes,config,async(url,options)=>{
  calls++;assert.equal(url,'https://fixture.app.n8n.cloud/api/v1/executions/31686?includeData=false');assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  return Response.json({...response(),tracingContext:{secret:'SYNTHETIC_SECRET'}});
 });assert.equal(calls,1);assert.equal(result.metadata_returned,true);assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
});
test('HTTP refusal, payload response and wrong identity never retry or expose body',async()=>{
 for(const fake of[()=>new Response('SYNTHETIC_SECRET',{status:404}),()=>Response.json({...response(),data:{private:'SYNTHETIC_SECRET'}}),()=>Response.json({...response(),workflowId:'wrong'})]){
  let calls=0;const result=await observeFresh(expectedFreshPlan(bytes),bytes,config,async()=>{calls++;return fake();});
  assert.equal(calls,1);assert.equal(result.metadata_returned,false);assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
 }
});
