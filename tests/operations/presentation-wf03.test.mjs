import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { buildPresentationWf03, buildPresentationWf03Template, mapPresentationStageEnvelope, validatePresentationWf03, validatePresentationWf03Template } from '../../tools/build-presentation-wf03.mjs';
const credential = { id: 'synthetic-pdf-reference', name: 'Everyone Presentation Studio WF03 local dispatch' };
const base = { event_id: 'synthetic-event', event_type: 'job.stage_ready', contract_version: '1.0', job_id: 'synthetic-job', kind: 'presentation_render', input_hash: 'a'.repeat(64), correlation_id: 'synthetic-correlation' };
const stages = ['prepare_presentation', 'render_presentation', 'validate_presentation', 'publish_presentation'];
test('WF03 routes exactly four metadata-only canonical render stages', () => {
  for (const stage of stages) { const result = mapPresentationStageEnvelope({ ...base, stage }, 'synthetic-execution'); assert.equal(result.status, 200); assert.equal(result.body.handler, `${stage === 'publish_presentation' ? 'domain' : 'native'}.${stage}`); assert.equal(Object.keys(result.body).length, 9); }
  for (const patch of [{ kind: 'presentation_export' }, { stage: 'render_export' }, { snapshot: 'private' }, { url: 'https://untrusted.invalid' }, { lease_token: 'private' }, { input_hash: 'invalid' }, { contract_version: '2.0' }]) assert.equal(mapPresentationStageEnvelope({ ...base, stage: stages[0], ...patch }, 'synthetic-execution').status, 400);
});
test('WF03 source template cannot claim credential/publication and configured graph preserves auth/no-retention/errors', () => {
  const draft = buildPresentationWf03Template(); assert.equal(validatePresentationWf03Template(draft), true); assert.equal(Object.hasOwn(draft.nodes[0], 'credentials'), false); assert.equal(Object.hasOwn(draft, 'active'), false);
  assert.equal(validatePresentationWf03Template(JSON.parse(readFileSync(new URL('../../n8n/eps-wf03-presentation.template.json', import.meta.url), 'utf8'))), true);
  const graph = buildPresentationWf03(credential); assert.equal(validatePresentationWf03(graph, credential), true); assert.equal(graph.nodes.length, 4); assert.equal(graph.nodes[0].parameters.path, 'eps-wf03-presentation-stage-v1'); assert.equal(graph.nodes[0].parameters.authentication, 'headerAuth');
  assert.equal(graph.settings.saveDataSuccessExecution, 'none'); assert.equal(graph.settings.saveDataErrorExecution, 'none'); assert.equal(graph.settings.saveManualExecutions, false); assert.equal(graph.settings.availableInMCP, false); assert.equal(graph.nodes[1].parameters.includeOtherFields, false); assert.equal(graph.nodes[1].parameters.options.stripBinary, true);
  for (const bad of [undefined, {}, { ...credential, secret: 'private' }, { ...credential, name: 'other' }]) assert.throws(() => buildPresentationWf03(bad));
});
test('embedded WF03 expression is the tested mapper; graph drift fails closed', () => {
  const graph = buildPresentationWf03(credential); const expression = graph.nodes[1].parameters.jsonOutput; assert.ok(expression.includes(mapPresentationStageEnvelope.toString()));
  const run = new Function('$', '$execution', 'return ' + expression.slice(3, -2));
  for (const stage of stages) { const body = { ...base, stage }; assert.deepEqual(run(() => ({ first: () => ({ json: { body } }) }), { id: 'synthetic-execution' }), mapPresentationStageEnvelope(body, 'synthetic-execution')); }
  graph.nodes[0].parameters.authentication = 'none'; assert.throws(() => validatePresentationWf03(graph, credential));
});
