/** Offline WF03 source preparation. Reuses the exact reviewed Webhook2.1,
 * EditFields3.4 and Respond1.4 graph. No configuration read or network call. */
import { buildSpecsWf01 } from './build-specs-wf01.mjs';

export const PRESENTATION_WF03_PATH = 'eps-wf03-presentation-stage-v1';
export const PRESENTATION_WF03_CREDENTIAL_NAME = 'Everyone Presentation Studio WF03 local dispatch';

/** Closed metadata-only routing. The worker owns native computation; the
 * central database owns authorization, leases, source binding and completion. */
export function mapPresentationStageEnvelope(body, executionId) {
  const fields = ['event_id', 'event_type', 'contract_version', 'job_id', 'kind', 'stage', 'input_hash', 'correlation_id'];
  const safe = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/u.test(value);
  const handlers = { prepare_presentation: 'native.prepare_presentation', render_presentation: 'native.render_presentation',
    validate_presentation: 'native.validate_presentation', publish_presentation: 'domain.publish_presentation' };
  const invalid = () => ({ status: 400, body: { error: { code: 'DISPATCH_ENVELOPE_INVALID', message: 'Use the published presentation stage envelope.' } } });
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== fields.length || fields.some(key => !Object.hasOwn(body, key))
    || body.event_type !== 'job.stage_ready' || body.contract_version !== '1.0'
    || body.kind !== 'presentation_render'
    || !safe(body.event_id) || !safe(body.job_id) || !safe(body.correlation_id) || typeof body.stage !== 'string' || !Object.hasOwn(handlers, body.stage)
    || typeof body.input_hash !== 'string' || !/^[a-f0-9]{64}$/u.test(body.input_hash)) return invalid();
  if (!safe(executionId)) return { status: 500, body: { error: { code: 'WF03_INTERNAL_ERROR', message: 'The presentation work order could not be prepared.' } } };
  return { status: 200, body: { schema_version: '1.0', event_id: body.event_id, job_id: body.job_id, kind: body.kind,
    stage: body.stage, input_hash: body.input_hash, correlation_id: body.correlation_id, workflow_execution_id: executionId, handler: handlers[body.stage] } };
}

function graph(credential) {
  const value = buildSpecsWf01(); value.name = 'Process fixed presentation versions - Everyone Presentation Studio WF03';
  const rename = name => name.replace('specs', 'presentation');
  value.nodes = value.nodes.map((node, index) => ({ ...node, id: `33c30000-0000-4000-8000-00000000000${index + 1}`, name: rename(node.name),
    ...(index === 0 ? { webhookId: '33c30000-0000-4000-8000-000000000005', parameters: { ...node.parameters, path: PRESENTATION_WF03_PATH },
      credentials: credential ? { httpHeaderAuth: { ...credential } } : undefined,
      notes: 'Dedicated WF03 dispatch credential reference only. Metadata envelope carries no source text, layout input, provider payload, lease token or result. An unconfigured source template cannot be enabled.' } : {}),
    ...(index === 1 ? { parameters: { ...node.parameters, jsonOutput: `={{ (${mapPresentationStageEnvelope.toString()})($('Receive presentation stage').first().json.body, $execution.id) }}` },
      notes: 'Closed eight-field presentation envelope, nine-field work order. Route only the four canonical fixed-version stages. Strip headers and binary data; central DB/worker own retries and all private rendering.' } : {}),
    ...(index === 3 ? { parameters: { ...node.parameters, responseBody: '={{ ({ error: { code: "WF03_INTERNAL_ERROR", message: "The presentation work order could not be prepared." } }) }}' } } : {}),
  }));
  if (!credential) delete value.nodes[0].credentials;
  value.connections = Object.fromEntries(Object.entries(value.connections).map(([name, edges]) => [rename(name), { main: edges.main.map(branch => branch.map(edge => ({ ...edge, node: rename(edge.node) }))) }]));
  return value;
}
function credentialReference(value) {
  if (!value || Object.keys(value).sort().join(',') !== 'id,name' || typeof value.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/u.test(value.id) || value.name !== PRESENTATION_WF03_CREDENTIAL_NAME)
    throw new Error('WF03_CREDENTIAL_REFERENCE_REQUIRED');
  return value;
}
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([left], [right]) => left.localeCompare(right))) : item);

export function buildPresentationWf03(credential) { return graph(credentialReference(credential)); }
export function validatePresentationWf03(value, credential) {
  const expected = buildPresentationWf03(credential);
  if (!value || value.name !== expected.name || ['nodes', 'connections', 'settings'].some(key => canonical(value[key]) !== canonical(expected[key]))) throw new Error('WF03_GRAPH_UNCONFIRMED');
  return true;
}

/** Documentation template only: no fake ID, runnable credential or cloud state. */
export function buildPresentationWf03Template() {
  return { ...graph(null), meta: { templateOnly: true, requiredCredentialName: PRESENTATION_WF03_CREDENTIAL_NAME,
    preparation: 'Bind a discovered/provisioned credential through buildPresentationWf03, then perform actual instance validation, authenticated tests and publication separately.' } };
}
export function validatePresentationWf03Template(value) {
  if (canonical(value) !== canonical(buildPresentationWf03Template())) throw new Error('WF03_TEMPLATE_UNCONFIRMED');
  return true;
}
