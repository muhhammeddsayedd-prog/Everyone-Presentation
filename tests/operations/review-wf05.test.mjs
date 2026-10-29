import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReviewWf05, buildReviewWf05Template, mapReviewStageEnvelope, validateReviewWf05, validateReviewWf05Template } from '../../tools/build-review-wf05.mjs';

const credential = { id: 'synthetic-reviewed-reference', name: 'Everyone Presentation Studio WF05 local dispatch' };
const base = { event_id: 'synthetic-event', event_type: 'job.stage_ready', contract_version: '1.0', job_id: 'synthetic-job', input_hash: 'a'.repeat(64), correlation_id: 'synthetic-correlation' };
const tuples = [['ai_suggestion', 'prepare_suggestion', 'domain.prepare_suggestion'], ['ai_suggestion', 'generate_suggestion', 'openai.generate_suggestion'],
  ['ai_suggestion', 'validate_suggestion', 'domain.validate_suggestion'], ['review_fit', 'measure_review_fit', 'native.measure_review_fit']];

test('WF05 routes only the four closed metadata-only review tuples', () => {
  for (const [kind, stage, handler] of tuples) {
    const body = { ...base, kind, stage }; const mapped = mapReviewStageEnvelope(body, 'synthetic-execution');
    assert.equal(mapped.status, 200); assert.deepEqual(mapped.body, { schema_version: '1.0', event_id: base.event_id, job_id: base.job_id,
      kind, stage, input_hash: base.input_hash, correlation_id: base.correlation_id, workflow_execution_id: 'synthetic-execution', handler });
    assert.equal(Object.keys(mapped.body).length, 9);
  }
  for (const [kind, stage] of [['ai_suggestion', 'measure_review_fit'], ['review_fit', 'generate_suggestion'], ['candidate_scan', 'prepare_suggestion'], ['ai_suggestion', 'apply_suggestion']])
    assert.equal(mapReviewStageEnvelope({ ...base, kind, stage }, 'synthetic-execution').status, 400);
});

test('source text, credentials, actor authority, arbitrary URLs and malformed metadata are rejected', () => {
  const body = { ...base, kind: 'ai_suggestion', stage: 'generate_suggestion' };
  for (const patch of [{ source_text: 'private content' }, { actor_id: 'other' }, { url: 'https://untrusted.invalid' }, { token: 'private' },
    { input_hash: 'not-a-hash' }, { event_id: '' }, { contract_version: '2.0' }, { event_type: 'apply' }, { workflow_execution_id: 'forged' }]) {
    const result = mapReviewStageEnvelope({ ...body, ...patch }, 'synthetic-execution');
    assert.equal(result.status, 400); assert.equal(JSON.stringify(result).includes('private'), false);
  }
  assert.equal(mapReviewStageEnvelope(body, '').status, 500);
});

test('configured graph requires a real reference and preserves header authentication, no retention and all error routes', () => {
  const graph = buildReviewWf05(credential); assert.equal(validateReviewWf05(graph, credential), true);
  assert.equal(graph.nodes.length, 4); assert.equal(graph.nodes[0].parameters.authentication, 'headerAuth');
  assert.equal(graph.nodes[0].parameters.path, 'eps-wf05-review-suggestion-stage-v1');
  assert.deepEqual(graph.nodes[0].credentials, { httpHeaderAuth: credential });
  assert.equal(graph.settings.saveDataSuccessExecution, 'none'); assert.equal(graph.settings.saveDataErrorExecution, 'none');
  assert.equal(graph.settings.saveManualExecutions, false); assert.equal(graph.settings.availableInMCP, false);
  const validator = graph.nodes[1]; assert.equal(validator.parameters.includeOtherFields, false); assert.equal(validator.parameters.options.stripBinary, true);
  assert.equal(validator.onError, 'continueErrorOutput'); assert.equal(graph.nodes[2].onError, 'continueErrorOutput');
  assert.equal(graph.connections[validator.name].main[1][0].node, graph.nodes[3].name);
  assert.equal(graph.nodes[3].parameters.options.responseCode, 500);
  for (const invalid of [undefined, {}, { ...credential, secret: 'never-allowed' }, { ...credential, name: 'unrelated workflow credential' }]) assert.throws(() => buildReviewWf05(invalid));
});

test('embedded mapper expression is the tested function and cannot return source or layout payloads', () => {
  const graph = buildReviewWf05(credential); const expression = graph.nodes[1].parameters.jsonOutput;
  assert.ok(expression.includes(mapReviewStageEnvelope.toString())); assert.match(expression, /\$\('Receive review stage'\)\.first\(\)\.json\.body/);
  const fn = new Function('$', '$execution', 'return ' + expression.slice(3, -2));
  for (const [kind, stage] of tuples) {
    const body = { ...base, kind, stage }; const result = fn(name => { assert.equal(name, 'Receive review stage'); return { first: () => ({ json: { body } }) }; }, { id: 'synthetic-execution' });
    assert.deepEqual(result, mapReviewStageEnvelope(body, 'synthetic-execution'));
  }
});

test('an unconfigured source template never pretends to contain a provisioned credential or active workflow', () => {
  const draft = buildReviewWf05Template(); assert.equal(validateReviewWf05Template(draft), true);
  assert.equal(Object.hasOwn(draft.nodes[0], 'credentials'), false);
  assert.equal(draft.meta.templateOnly, true); assert.equal(draft.meta.requiredCredentialName, credential.name);
  assert.equal(Object.hasOwn(draft, 'active'), false); assert.throws(() => validateReviewWf05(draft, credential));
});

test('graph validation rejects authentication, retention, execution, handler or connection drift', () => {
  for (const mutate of [graph => { graph.nodes[0].parameters.authentication = 'none'; }, graph => { graph.settings.availableInMCP = true; },
    graph => { graph.settings.saveDataErrorExecution = 'all'; }, graph => { graph.nodes[1].parameters.includeOtherFields = true; },
    graph => { graph.nodes[1].parameters.jsonOutput = '={{ $json }}'; }, graph => { graph.connections = {}; }]) {
    const graph = buildReviewWf05(credential); mutate(graph); assert.throws(() => validateReviewWf05(graph, credential));
  }
});
