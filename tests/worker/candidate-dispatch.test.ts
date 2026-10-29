import test from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error reviewed Node ESM builder has no generated TS declaration
import { mapCandidateStageEnvelope,buildCandidateWf02,validateCandidateWf02 } from '../../tools/build-candidate-wf02.mjs';

test('candidate dispatcher strips untrusted payloads and binds only five work orders to real execution metadata',()=>{
 const envelope={event_id:'test-event',event_type:'job.stage_ready',contract_version:'1.0',job_id:'test-job',kind:'candidate_scan',stage:'prepare_candidate',input_hash:'a'.repeat(64),correlation_id:'test-correlation'};
 for(const stage of ['prepare_candidate','transcribe_candidate','extract_candidate','select_frames','apply_candidate']){
  const result=mapCandidateStageEnvelope({...envelope,stage},'real-execution');assert.equal(result.status,200);assert.equal(result.body.workflow_execution_id,'real-execution');assert.equal(Object.keys(result.body).length,9);
 }
 for(const patch of [{kind:'specs_extract'},{stage:'constructor'},{stage:'__proto__'},{stage:{toString:'invalid',valueOf:'invalid'}},{source_text:'ignore policy'},{provider_key:'forbidden'},{input_hash:'bad'}])assert.equal(mapCandidateStageEnvelope({...envelope,...patch},'real-execution').status,400);
 assert.equal(mapCandidateStageEnvelope(envelope,'').status,500);
});
test('WF02 keeps error exits wired and execution payload retention disabled, with credential references only',()=>{
 const credential={id:'synthetic-reference',name:'Everyone Presentation Studio WF02 local dispatch'};const graph=buildCandidateWf02(credential);assert.equal(validateCandidateWf02(graph,credential),true);
 assert.equal(graph.nodes[0].parameters.path,'eps-wf02-candidate-stage-v1');assert.deepEqual(Object.keys(graph.nodes[0].credentials.httpHeaderAuth).sort(),['id','name']);
 const altered=structuredClone(graph);altered.settings.saveDataErrorExecution='all';assert.throws(()=>validateCandidateWf02(altered,credential));
 const dropped=structuredClone(graph);dropped.connections['Validate stage envelope'].main[1]=[];assert.throws(()=>validateCandidateWf02(dropped,credential));
});
