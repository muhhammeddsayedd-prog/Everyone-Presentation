/** WF01 preparation only. Importing performs no private read or request.
 * Live inspection permits only two fixed GET metadata endpoints; no workflow or
 * credential can be created, changed, activated or executed by this helper. */
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { clearTimeout, setTimeout } from 'node:timers';
import { pathToFileURL } from 'node:url';
import { loadWorkerPrivateEnvironment, parseWorkerPrivateEnv } from './worker-private-env.mjs';

const ROOT = path.resolve(import.meta.dirname, '..');
const NODE_NAMES = ['n8n-nodes-base.webhook', 'n8n-nodes-base.set', 'n8n-nodes-base.respondToWebhook'];
const MAXIMUM_METADATA_BYTES = 16 * 1024 * 1024;
const record = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
export const WF01_SOURCE_COMMIT = '0b04add5b381f59a013d7a27c5680a7f7c8966be';
const CREDENTIAL = Object.freeze({ id: 'DgZ83IpyrbinQ9gW', name: 'Everyone Presentation Studio WF01 local dispatch' });
const NODE_VERSIONS = [2.1, 3.4, 1.4, 1.4];
const NAMES = ['Receive specs stage', 'Validate stage envelope', 'Respond with work order', 'Respond with internal error'];
const edge = node => ({ node, type: 'main', index: 0 });
const CONNECTIONS = {
  'Receive specs stage': { main: [[edge('Validate stage envelope')]] },
  'Validate stage envelope': { main: [[edge('Respond with work order')], [edge('Respond with internal error')]] },
  'Respond with work order': { main: [[], [edge('Respond with internal error')]] },
};
function fail(code) { throw new Error(code); }
class MetadataUnavailable extends Error {
  constructor(operation, status = null, inspection = null) {
    super('N8N_WF01_METADATA_UNAVAILABLE'); this.operation = operation; this.http_status = status; this.inspection = inspection;
  }
}

/** This same pure function is embedded in the Edit Fields expression. */
export function mapSpecsStageEnvelope(body, executionId) {
  const fields = ['event_id', 'event_type', 'contract_version', 'job_id', 'kind', 'stage', 'input_hash', 'correlation_id'];
  const safe = value => typeof value === 'string' && /^[A-Za-z0-9._:-]{1,200}$/u.test(value);
  const handlers = { prepare_document: 'native.prepare_document', extract_specs: 'openai.extract_specs', apply_specs: 'domain.apply_specs' };
  const invalid = () => ({ status: 400, body: { error: { code: 'DISPATCH_ENVELOPE_INVALID', message: 'Use the published specs stage envelope.' } } });
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== fields.length
    || Object.keys(body).some(key => !fields.includes(key)) || fields.some(key => !Object.hasOwn(body, key))
    || body.event_type !== 'job.stage_ready' || body.contract_version !== '1.0' || body.kind !== 'specs_extract'
    || !safe(body.event_id) || !safe(body.job_id) || !safe(body.correlation_id) || typeof body.stage !== 'string' || !Object.hasOwn(handlers, body.stage)
    || typeof body.input_hash !== 'string' || !/^[a-f0-9]{64}$/u.test(body.input_hash)) return invalid();
  if (!safe(executionId)) return { status: 500, body: { error: { code: 'WF01_INTERNAL_ERROR', message: 'The stage work order could not be prepared.' } } };
  return { status: 200, body: { schema_version: '1.0', event_id: body.event_id, job_id: body.job_id, kind: body.kind,
    stage: body.stage, input_hash: body.input_hash, correlation_id: body.correlation_id,
    workflow_execution_id: executionId, handler: handlers[body.stage] } };
}
const mapperExpression = () => `={{ (${mapSpecsStageEnvelope.toString()})($('Receive specs stage').first().json.body, $execution.id) }}`;
const responseHeaders = () => ({ entries: [{ name: 'Content-Type', value: 'application/json' }, { name: 'Cache-Control', value: 'no-store' }] });

/** Local API-create/import payload only. No publish, execute or secret operation. */
export function buildSpecsWf01() {
  return {
    name: 'Process specs stages - Everyone Presentation Studio WF01',
    nodes: [
      { id: '33c20000-0000-4000-8000-000000000001', name: NAMES[0], type: NODE_NAMES[0], typeVersion: 2.1, position: [0, 0],
        webhookId: '33c20000-0000-4000-8000-000000000005',
        parameters: { httpMethod: 'POST', path: 'eps-wf01-specs-stage-v1', authentication: 'headerAuth', responseMode: 'responseNode', options: {} },
        credentials: { httpHeaderAuth: { ...CREDENTIAL } },
        notes: 'Dedicated dispatch credential reference only. This API carries job metadata; no source, provider payload, lease or result belongs in n8n.' },
      { id: '33c20000-0000-4000-8000-000000000002', name: NAMES[1], type: NODE_NAMES[1], typeVersion: 3.4, position: [320, 0],
        parameters: { mode: 'raw', jsonOutput: mapperExpression(), includeOtherFields: false, options: { stripBinary: true, dotNotation: false } },
        onError: 'continueErrorOutput',
        notes: 'Closed eight-field envelope. Build only the nine-field work order, bind the real execution ID and remove every inbound header/other field. Database outbox and native worker own retry, source access and completion.' },
      { id: '33c20000-0000-4000-8000-000000000003', name: NAMES[2], type: NODE_NAMES[2], typeVersion: 1.4, position: [680, 0],
        parameters: { respondWith: 'json', responseBody: "={{ $('Validate stage envelope').first().json.body }}",
          options: { responseCode: "={{ $('Validate stage envelope').first().json.status }}", responseHeaders: responseHeaders() } },
        onError: 'continueErrorOutput' },
      { id: '33c20000-0000-4000-8000-000000000004', name: NAMES[3], type: NODE_NAMES[2], typeVersion: 1.4, position: [680, 260],
        parameters: { respondWith: 'json', responseBody: '={{ ({ error: { code: "WF01_INTERNAL_ERROR", message: "The stage work order could not be prepared." } }) }}',
          options: { responseCode: 500, responseHeaders: responseHeaders() } } },
    ],
    connections: globalThis.structuredClone(CONNECTIONS),
    settings: { executionOrder: 'v1', timezone: 'Africa/Cairo', executionTimeout: 30,
      saveDataErrorExecution: 'none', saveDataSuccessExecution: 'none', saveManualExecutions: false, saveExecutionProgress: false,
      callerPolicy: 'none', availableInMCP: false },
  };
}
/** Offline security/graph checks, not a claim of live n8n validation. */
export function validateSpecsWf01(workflow) {
  const bad = () => fail('N8N_WF01_EXPORT_INVALID');
  if (!record(workflow) || !Array.isArray(workflow.nodes) || workflow.nodes.length !== 4
    || JSON.stringify(workflow.connections) !== JSON.stringify(CONNECTIONS)) bad();
  workflow.nodes.forEach((node, index) => {
    if (node.name !== NAMES[index] || node.type !== NODE_NAMES[Math.min(index, 2)] || node.typeVersion !== NODE_VERSIONS[index]) bad();
  });
  const [webhook, mapper, response, error] = workflow.nodes;
  if (webhook.parameters.authentication !== 'headerAuth' || webhook.parameters.responseMode !== 'responseNode' || webhook.parameters.httpMethod !== 'POST'
    || webhook.parameters.path !== 'eps-wf01-specs-stage-v1' || JSON.stringify(webhook.credentials) !== JSON.stringify({ httpHeaderAuth: CREDENTIAL })
    || mapper.parameters.mode !== 'raw' || mapper.parameters.includeOtherFields !== false || mapper.parameters.options.stripBinary !== true
    || mapper.parameters.jsonOutput !== mapperExpression() || mapper.onError !== 'continueErrorOutput' || response.onError !== 'continueErrorOutput'
    || response.parameters.respondWith !== 'json' || error.parameters.respondWith !== 'json' || error.parameters.options.responseCode !== 500
    || response.parameters.responseBody !== "={{ $('Validate stage envelope').first().json.body }}"
    || response.parameters.options.responseCode !== "={{ $('Validate stage envelope').first().json.status }}") bad();
  const settings = workflow.settings;
  if (!settings || settings.saveDataErrorExecution !== 'none' || settings.saveDataSuccessExecution !== 'none'
    || settings.saveManualExecutions !== false || settings.saveExecutionProgress !== false || settings.executionTimeout !== 30
    || settings.availableInMCP !== false || settings.callerPolicy !== 'none') bad();
  return true;
}

/** No arbitrary URL/path parameter. Private config never becomes return data. */
async function metadataRequest(config, kind, fetchImpl) {
  const routes = { settings: '/rest/settings', node_types: '/types/nodes.json' };
  if (!Object.hasOwn(routes, kind)) fail('N8N_WF01_METADATA_UNAVAILABLE');
  const controller = new globalThis.AbortController(); const timer = setTimeout(() => controller.abort(), 15_000);
  let reader; let status = null;
  try {
    const response = await fetchImpl(config.N8N_BASE_URL + routes[kind], {
      method: 'GET', redirect: 'error', signal: controller.signal,
      headers: { 'X-N8N-API-KEY': config.N8N_API_KEY, Accept: 'application/json' },
    });
    status = response.status;
    if (!response.ok) { void response.body?.cancel().catch(() => undefined); fail('N8N_WF01_METADATA_UNAVAILABLE'); }
    reader = response.body?.getReader(); if (!reader) fail('N8N_WF01_METADATA_UNAVAILABLE');
    const chunks = []; let size = 0;
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength;
      if (controller.signal.aborted || size > MAXIMUM_METADATA_BYTES) { void reader.cancel().catch(() => undefined); fail('N8N_WF01_METADATA_UNAVAILABLE'); }
      chunks.push(part.value);
    }
    return { status: response.status, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) };
  } catch { throw new MetadataUnavailable(kind, status); }
  finally { clearTimeout(timer); reader?.releaseLock(); }
}
export async function inspectN8nWorkflowMetadata(environment, fetchImpl = globalThis.fetch) {
  const config = parseWorkerPrivateEnv('', environment);
  if (!config.N8N_API_KEY || !config.N8N_BASE_URL) fail('N8N_WF01_CONFIGURATION_REQUIRED');
  const observed = await Promise.allSettled([metadataRequest(config, 'settings', fetchImpl), metadataRequest(config, 'node_types', fetchImpl)]);
  const settings = observed[0].status === 'fulfilled' ? observed[0].value : null;
  const types = observed[1].status === 'fulfilled' ? observed[1].value : null;
  const version = settings?.value?.data?.versionCli ?? settings?.value?.versionCli;
  const instanceVersion = typeof version === 'string' && /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][A-Za-z0-9.-]+)?$/u.test(version) && version.length <= 80 ? version : null;
  const inspection = { instance_version: instanceVersion,
    settings_http_status: settings?.status ?? observed[0].reason?.http_status ?? null,
    types_http_status: types?.status ?? observed[1].reason?.http_status ?? null,
    types_shape: Array.isArray(types?.value) ? 'array' : record(types?.value) ? 'object' : 'unavailable' };
  const unavailable = () => { throw new MetadataUnavailable('selected_metadata', null, inspection); };
  const nodes = Array.isArray(types?.value) ? types.value : types?.value?.data;
  if (!Array.isArray(nodes) || nodes.length > 10_000) unavailable();
  const selected = nodes.filter(value => record(value) && NODE_NAMES.includes(value.name)).map(value => {
    const result = {};
    for (const key of ['name', 'displayName', 'version', 'defaultVersion', 'inputs', 'outputs', 'properties', 'credentials', 'webhooks']) {
      if (Object.hasOwn(value, key)) result[key] = value[key];
    }
    return result;
  });
  if (!settings || NODE_NAMES.some(name => !selected.some(value => value.name === name))) unavailable();
  return { observed_at: new Date().toISOString(), scope: 'Read-only instance version and three official public node definitions only',
    mcp_status: '-32603; fixed read-only API metadata fallback',
    instance_version: instanceVersion,
    settings_http_status: settings.status, types_http_status: types.status, node_types: selected,
    workflows_modified: false, credentials_modified: false, workflows_executed: false, private_settings_recorded: false };
}

async function main() {
  if (process.argv.length !== 3 || !['--inspect', '--build'].includes(process.argv[2])) fail('N8N_WF01_FIXED_INSPECTION_REQUIRED');
  if (process.argv[2] === '--build') {
    const workflow = buildSpecsWf01(); validateSpecsWf01(workflow);
    const directory = path.join(ROOT, 'n8n'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, 'eps-wf01-specs-stage.json');
    await writeFile(file, JSON.stringify(workflow, null, 2) + '\n');
    process.stdout.write('Prepared n8n/eps-wf01-specs-stage.json; not created, validated on instance, published or executed.\n'); return;
  }
  const report = await inspectN8nWorkflowMetadata(await loadWorkerPrivateEnvironment());
  const directory = path.join(ROOT, 'tracking/evidence/m02/n8n-wf01'); await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${report.observed_at.replace(/[:.]/gu, '-')}-${randomUUID().slice(0, 8)}-node-metadata.json`);
  await writeFile(file, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  process.stdout.write(JSON.stringify({ instance_version: report.instance_version, official_node_definitions: report.node_types.length,
    settings_http_status: report.settings_http_status, types_http_status: report.types_http_status,
    receipt: path.relative(ROOT, file).replaceAll('\\', '/'), workflows_modified: false, credentials_modified: false, workflows_executed: false }) + '\n');
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(async error => {
    const receipt = { observed_at: new Date().toISOString(), result: 'failed', scope: 'Fixed read-only metadata GETs only',
      ...(error instanceof MetadataUnavailable && error.inspection ? error.inspection : {}),
      workflows_modified: false, credentials_modified: false, workflows_executed: false, private_settings_recorded: false };
    const directory = path.join(ROOT, 'tracking/evidence/m02/n8n-wf01'); await mkdir(directory, { recursive: true });
    const file = path.join(directory, `${receipt.observed_at.replace(/[:.]/gu, '-')}-${randomUUID().slice(0, 8)}-metadata-failure.json`);
    await writeFile(file, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
    process.stderr.write(JSON.stringify({ ...receipt, receipt: path.relative(ROOT, file).replaceAll('\\', '/') }) + '\n'); process.exitCode = 1;
  });
}
