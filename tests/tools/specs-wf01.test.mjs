import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
import { buildSpecsWf01, inspectN8nWorkflowMetadata, mapSpecsStageEnvelope, validateSpecsWf01 } from '../../tools/build-specs-wf01.mjs';

const environment = { N8N_BASE_URL: 'https://synthetic.app.n8n.cloud', N8N_API_KEY: 'synthetic-private-management-key' };
const { Response, ReadableStream, structuredClone } = globalThis;
const envelope = { event_id: 'event-1', event_type: 'job.stage_ready', contract_version: '1.0', job_id: 'job-1',
  kind: 'specs_extract', stage: 'prepare_document', input_hash: 'a'.repeat(64), correlation_id: 'request-1' };

test('WF01 maps exactly the trusted stage metadata with the actual execution ID and all three fixed handlers', () => {
  for (const [stage, handler] of [['prepare_document', 'native.prepare_document'], ['extract_specs', 'openai.extract_specs'], ['apply_specs', 'domain.apply_specs']]) {
    assert.deepEqual(mapSpecsStageEnvelope({ ...envelope, stage }, 'execution-29'), { status: 200, body: {
      schema_version: '1.0', event_id: 'event-1', job_id: 'job-1', kind: 'specs_extract', stage,
      input_hash: 'a'.repeat(64), correlation_id: 'request-1', workflow_execution_id: 'execution-29', handler,
    } });
  }
});
test('WF01 refuses malformed authority/source fields and never echoes rejected input', () => {
  for (const invalid of [null, [], { ...envelope, source_text: 'private-input' }, { ...envelope, lease_token: 'private-input' },
    { ...envelope, input_hash: 'bad' }, { ...envelope, stage: 'arbitrary.handler' },
    { ...envelope, stage: { toString: 'private-input', valueOf: 'private-input' } }, { ...envelope, job_id: 'private-input\n' }]) {
    const result = mapSpecsStageEnvelope(invalid, 'execution-29'); assert.equal(result.status, 400);
    assert(!JSON.stringify(result).includes('private-input'));
  }
  assert.equal(mapSpecsStageEnvelope(envelope, undefined).status, 500);
});
test('metadata inspection makes only two fixed read-only requests and projects no settings or credential values', async () => {
  const calls = [];
  const result = await inspectN8nWorkflowMetadata(environment, async (url, init) => {
    calls.push({ url, init });
    return Response.json(url.endsWith('/rest/settings') ? { data: { versionCli: '2.29.0', privateSetting: 'never-record' } }
      : [{ name: 'n8n-nodes-base.webhook', version: [1, 2], properties: [] },
        { name: 'n8n-nodes-base.set', version: [3.4], properties: [] },
        { name: 'n8n-nodes-base.respondToWebhook', version: [1.4], properties: [] },
        { name: 'private-unrelated-type', privateSetting: 'never-record' }]);
  });
  assert.equal(result.instance_version, '2.29.0'); assert.equal(result.node_types.length, 3);
  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map(call => new URL(call.url).pathname).sort(), ['/rest/settings', '/types/nodes.json']);
  for (const call of calls) { assert.equal(call.init.method, 'GET'); assert.equal(call.init.redirect, 'error'); assert.equal(call.init.body, undefined); }
  assert(!JSON.stringify(result).includes(environment.N8N_API_KEY)); assert(!JSON.stringify(result).includes('never-record'));
});
test('metadata failures and oversize responses remain sanitized rather than serializing private response bodies', async () => {
  for (const fetcher of [async () => new Response('private-provider-body', { status: 401 }),
    async () => { throw new Error(environment.N8N_API_KEY); },
    async () => new Response(new ReadableStream({ start(controller) { controller.enqueue(Buffer.alloc(16 * 1024 * 1024 + 1)); controller.close(); } }))]) {
    await assert.rejects(inspectN8nWorkflowMetadata(environment, fetcher), error => {
      assert.equal(error.message, 'N8N_WF01_METADATA_UNAVAILABLE'); assert(!JSON.stringify(error).includes(environment.N8N_API_KEY)); return true;
    });
  }
});
test('the generated four-node workflow evaluates its actual mapping expression and connects both safe response paths', () => {
  const workflow = buildSpecsWf01(); assert.equal(validateSpecsWf01(workflow), true);
  const mapper = workflow.nodes.find(node => node.name === 'Validate stage envelope');
  const expression = mapper.parameters.jsonOutput.slice(3, -2);
  for (const stage of ['prepare_document', 'extract_specs', 'apply_specs']) {
    const actual = runInNewContext(expression, { $: name => {
      assert.equal(name, 'Receive specs stage'); return { first: () => ({ json: { body: { ...envelope, stage }, headers: { authorization: 'never-forward' } } }) };
    }, $execution: { id: 'actual-execution-29' } });
    assert.deepEqual(JSON.parse(JSON.stringify(actual)), mapSpecsStageEnvelope({ ...envelope, stage }, 'actual-execution-29'));
    assert(!JSON.stringify(actual).includes('never-forward'));
  }
  assert.deepEqual(workflow.connections['Validate stage envelope'].main.map(branch => branch[0].node), ['Respond with work order', 'Respond with internal error']);
  assert.equal(workflow.settings.saveDataErrorExecution, 'none'); assert.equal(workflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(workflow.settings.saveExecutionProgress, false); assert.equal(workflow.settings.saveManualExecutions, false);
  for (const mutate of [value => { value.nodes[0].parameters.authentication = 'none'; },
    value => { value.nodes[1].parameters.includeOtherFields = true; },
    value => { value.connections['Validate stage envelope'].main.pop(); },
    value => { value.settings.saveDataErrorExecution = 'all'; }]) {
    const changed = structuredClone(workflow); mutate(changed); assert.throws(() => validateSpecsWf01(changed));
  }
});
