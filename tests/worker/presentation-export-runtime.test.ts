import assert from 'node:assert/strict';
import test from 'node:test';
import { validateStageReadyEnvelope, type StageReadyEnvelope } from '../../packages/integrations/src/n8n-dispatch.ts';
import { validateSpecsWorkOrder } from '../../apps/worker/src/n8n-orchestrator.ts';
const envelope:StageReadyEnvelope={event_id:'a6060000-0000-4000-8000-000000000001',event_type:'job.stage_ready',contract_version:'1.0',job_id:'a6060000-0000-4000-8000-000000000002',kind:'presentation_export',stage:'render_export',input_hash:'a'.repeat(64),correlation_id:'synthetic-export-runtime'};
test('guest export metadata requires its exact kind/stage and native handler',()=>{
 assert.doesNotThrow(()=>validateStageReadyEnvelope(envelope));
 const order={schema_version:'1.0',event_id:envelope.event_id,job_id:envelope.job_id,kind:envelope.kind,stage:envelope.stage,input_hash:envelope.input_hash,correlation_id:envelope.correlation_id,workflow_execution_id:'synthetic-wf03-export',handler:'native.render_export'};
 assert.equal(validateSpecsWorkOrder(order,envelope).handler,'native.render_export');
 for(const changed of [{...envelope,kind:'presentation_render'},{...envelope,stage:'render_presentation'},{...envelope,grant_token:'untrusted'}])assert.throws(()=>validateStageReadyEnvelope(changed as StageReadyEnvelope));
 for(const changed of [{...order,handler:'native.render_presentation'},{...order,grant_token:'untrusted'},{...order,version_id:envelope.job_id}])assert.throws(()=>validateSpecsWorkOrder(changed,envelope));
});
