import assert from'node:assert/strict';
import test from'node:test';
import vm from'node:vm';
import{buildGuestExportWf03,mapGuestExportEnvelope}from'./build-guest-export-wf03.mjs';
import{PRESENTATION_WF03_CREDENTIAL_NAME}from'./build-presentation-wf03.mjs';
const credential={id:'dPJl1LfIqjEoGdpo',name:PRESENTATION_WF03_CREDENTIAL_NAME};
// Pinned official ExpressionSplitter closes code at its first unescaped }}.
// This subset is deliberately stricter: our fixed mapper has no escaped delimiters.
const expression=()=>buildGuestExportWf03(credential).nodes.find(n=>n.type==='n8n-nodes-base.set').parameters.jsonOutput;
test('entire n8n outer expression contains one closing delimiter and remains complete JavaScript after vendor-style splitting',()=>{
 const value=expression();assert.equal(value.split('}}').length-1,1);assert.equal(value.indexOf('}}'),value.lastIndexOf('}}'));
 const code=value.slice(value.indexOf('{{')+2,value.indexOf('}}'));
 for(const stage of['prepare_presentation','render_presentation','validate_presentation','publish_presentation','render_export']){
  const body={event_id:'synthetic-event',event_type:'job.stage_ready',contract_version:'1.0',job_id:'synthetic-job',kind:stage==='render_export'?'presentation_export':'presentation_render',stage,input_hash:'a'.repeat(64),correlation_id:'synthetic-correlation'};
  const actual=vm.runInNewContext(code,{$:name=>{assert.equal(name,'Receive presentation stage');return{first:()=>({json:{body}})};},$execution:{id:'synthetic-execution'}},{timeout:1000});assert.deepEqual(JSON.parse(JSON.stringify(actual)),mapGuestExportEnvelope(body,'synthetic-execution'));
 }
});
