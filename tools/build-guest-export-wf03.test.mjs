import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {mapGuestExportEnvelope,buildGuestExportWf03,buildGuestExportWf03Template,validateGuestExportWf03}from'./build-guest-export-wf03.mjs';
import{buildPresentationWf03,PRESENTATION_WF03_CREDENTIAL_NAME}from'./build-presentation-wf03.mjs';
const credential={id:'synthetic-credential',name:PRESENTATION_WF03_CREDENTIAL_NAME};
const envelope=stage=>({event_id:'synthetic-event',event_type:'job.stage_ready',contract_version:'1.0',job_id:'synthetic-job',kind:stage==='render_export'?'presentation_export':'presentation_render',stage,input_hash:'a'.repeat(64),correlation_id:'synthetic-correlation'});
test('M06 retains all old WF03 node/credential/connection/runtime settings; changes mapper only',()=>{
 const old=buildPresentationWf03(credential),next=buildGuestExportWf03(credential);assert.equal(validateGuestExportWf03(next,credential),true);
 assert.deepEqual(next.connections,old.connections);assert.deepEqual(next.settings,old.settings);assert.equal(next.nodes.length,old.nodes.length);
 for(let n=0;n<next.nodes.length;n++){const before=structuredClone(old.nodes[n]),after=structuredClone(next.nodes[n]);if(typeof before.parameters?.jsonOutput==='string'){delete before.parameters.jsonOutput;delete after.parameters.jsonOutput;delete before.notes;delete after.notes;}assert.deepEqual(after,before);}
 assert.equal(buildGuestExportWf03Template().nodes[0].credentials,undefined);
});
test('self-contained mapper admits exactly the five stage/kind pairs without bearer metadata',()=>{
 for(const stage of ['prepare_presentation','render_presentation','validate_presentation','publish_presentation','render_export']){
  const input=envelope(stage);const result=mapGuestExportEnvelope(input,'synthetic-execution');assert.equal(result.status,200);assert.equal(Object.keys(result.body).length,9);
  const expression=`(${mapGuestExportEnvelope.toString()})(${JSON.stringify(input)},'synthetic-execution')`;assert.deepEqual(JSON.parse(JSON.stringify(vm.runInNewContext(expression,{}, {timeout:1000}))),result);
  assert.equal(mapGuestExportEnvelope({...input,kind:input.kind==='presentation_export'?'presentation_render':'presentation_export'},'synthetic-execution').status,400);
  assert.equal(mapGuestExportEnvelope({...input,grant_token:'untrusted'},'synthetic-execution').status,400);
 }
 assert.equal(mapGuestExportEnvelope(envelope('unknown'),'synthetic-execution').status,400);
 assert.equal(mapGuestExportEnvelope(envelope('render_export'),'').status,500);
});
