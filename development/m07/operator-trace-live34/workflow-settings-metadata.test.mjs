import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {WORKFLOW_ID,PINS,workflowProjection,inspectWorkflow} from './workflow-settings-metadata.mjs';
const config={N8N_BASE_URL:'https://fixture.app.n8n.cloud',N8N_API_KEY:'SYNTHETIC_SECRET'};
const value=()=>({id:WORKFLOW_ID,active:true,versionId:'00000000-0000-4000-8000-000000000001',activeVersionId:null,
 settings:{saveDataSuccessExecution:'none',saveDataErrorExecution:'none',saveManualExecutions:false,saveExecutionProgress:false}});
test('source pins match the frozen loader and actual31686 refusal receipt',async()=>{
 for(const [file,digest]of Object.entries(PINS))assert.equal(createHash('sha256').update(await readFile(new URL('../../../'+file,import.meta.url))).digest('hex'),digest);
});
test('projection retains only closed settings metadata and represents absent values as unknown',()=>{
 const source={...value(),name:'SYNTHETIC_SECRET',nodes:[{name:'SYNTHETIC_SECRET',credentials:{secret:'SYNTHETIC_SECRET'}}],settings:{...value().settings,custom:'SYNTHETIC_SECRET'}};
 assert.ok(!JSON.stringify(workflowProjection(source)).includes('SYNTHETIC_SECRET'));
 const missing=workflowProjection({id:WORKFLOW_ID,active:false});assert.equal(missing.settings.saveDataSuccessExecution,null);assert.equal(missing.version_id,null);
 for(const changed of[{...value(),id:'wrong'},{...value(),active:'yes'},{...value(),versionId:'unsafe'},{...value(),settings:{saveDataErrorExecution:'default'}}])assert.throws(()=>workflowProjection(changed));
});
test('one fixed GET suppresses redirects and projects no graph',async()=>{
 let calls=0;const result=await inspectWorkflow(config,async(url,options)=>{
  calls++;assert.equal(url,'https://fixture.app.n8n.cloud/api/v1/workflows/'+WORKFLOW_ID);assert.equal(options.method,'GET');assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
  return Response.json({...value(),nodes:[{private:'SYNTHETIC_SECRET'}]});
 });assert.equal(calls,1);assert.equal(result.metadata_returned,true);assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
});
test('refused/oversized/invalid workflow bodies never retry or expose private content',async()=>{
 for(const fake of[()=>new Response('SYNTHETIC_SECRET',{status:404}),()=>new Response('SYNTHETIC_SECRET'.repeat(12000)),()=>Response.json({...value(),id:'wrong'}),()=>{throw Error('SYNTHETIC_SECRET');}]){
  let calls=0;const result=await inspectWorkflow(config,async()=>{calls++;return fake();});assert.equal(calls,1);assert.equal(result.metadata_returned,false);assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
 }
});
