/** Read-only access inspection. Never generates content, mutates a workflow or
 * serializes a private config/provider body. See WORKER_PRIVATE_ENV.md. */
import process from 'node:process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Buffer } from 'node:buffer';
import { setTimeout, clearTimeout } from 'node:timers';
import { loadWorkerPrivateEnvironment, parseWorkerPrivateEnv, workerPrivatePresence } from './worker-private-env.mjs';

const maximumBytes = 1024 * 1024;
const candidate = 'gpt-6.1-sol'; // Supported structured output: official model page, checked2026-10-28.
async function requestJSON(url, headers, fetchImpl) {
  const controller = new globalThis.AbortController(); const timer = setTimeout(() => controller.abort(), 15_000);
  let status = null;
  try {
    const response = await fetchImpl(url, { method: 'GET', headers, redirect: 'error', signal: controller.signal });
    status = response.status;
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined);
      return { status: status === 429 ? 'rate_limited' : status >= 500 ? 'unavailable' : 'denied', http_status: status };
    }
    const reader = response.body?.getReader(); if (!reader) return { status: 'invalid_response', http_status: status };
    const chunks = []; let size = 0;
    try {
      for (;;) {
        const part = await reader.read(); if (part.done) break;
        size += part.value.byteLength;
        if (size > maximumBytes) { void reader.cancel().catch(() => undefined); return { status: 'response_too_large', http_status: status }; }
        chunks.push(part.value);
      }
    } finally { reader.releaseLock(); }
    try { return { status: 'reachable', http_status: status, value: JSON.parse(Buffer.concat(chunks).toString('utf8')) }; }
    catch { return { status: 'invalid_response', http_status: status }; }
  } catch { return { status: 'unavailable', http_status: status }; }
  finally { clearTimeout(timer); }
}
const record = value => value && typeof value === 'object' && !Array.isArray(value);
/** The injected fetch seam is for offline tests. Callers must not log environment. */
export async function inspectWorkerIntegrations(environment, fetchImpl = globalThis.fetch) {
  const config = parseWorkerPrivateEnv('', environment); const presence = workerPrivatePresence(config);
  const [models, workflows] = await Promise.all([
    presence.openai_key_present ? requestJSON('https://api.openai.com/v1/models', { Authorization: `Bearer ${config.OPENAI_API_KEY}`, Accept: 'application/json' }, fetchImpl) : { status: 'not_configured', http_status: null },
    presence.n8n_key_present && presence.n8n_base_url_present
      ? requestJSON(`${config.N8N_BASE_URL}/api/v1/workflows?limit=1`, { 'X-N8N-API-KEY': config.N8N_API_KEY, Accept: 'application/json' }, fetchImpl)
      : { status: 'not_configured', http_status: null },
  ]);
  const openai = { status: models.status, http_status: models.http_status, documented_candidate: candidate, candidate_available: null,
    selected_model_available: null, model_generation_tested: false };
  if (models.status === 'reachable') {
    if (!record(models.value) || !Array.isArray(models.value.data) || models.value.data.length > 10_000
      || models.value.data.some(model => !record(model) || typeof model.id !== 'string' || model.id.length > 200)) openai.status = 'invalid_response';
    else {
      openai.candidate_available = models.value.data.some(model => model.id === candidate);
      if (presence.extraction_model_selected) openai.selected_model_available = models.value.data.some(model => model.id === config.OPENAI_EXTRACTION_MODEL);
    }
  }
  const n8n = { status: workflows.status, http_status: workflows.http_status, workflows_on_page: null, more_pages: null, workflows_executed: false };
  if (workflows.status === 'reachable') {
    if (!record(workflows.value) || !Array.isArray(workflows.value.data) || workflows.value.data.length > 1
      || workflows.value.data.some(workflow => !record(workflow) || typeof workflow.id !== 'string')
      || !(workflows.value.nextCursor === undefined || workflows.value.nextCursor === null || typeof workflows.value.nextCursor === 'string')) n8n.status = 'invalid_response';
    else { n8n.workflows_on_page = workflows.value.data.length; n8n.more_pages = Boolean(workflows.value.nextCursor); }
  }
  return { observed_at: new Date().toISOString(), scope: 'read-only provider credential/access inspection', presence, openai, n8n,
    pipeline_tested: false, secrets_or_provider_bodies_recorded: false };
}
async function main() {
  if (process.argv.length === 3 && process.argv[2] === '--help') {
    process.stdout.write('Read-only OpenAI model-list and existing n8n workflow-list inspection. No target/file overrides.\n'); return;
  }
  if (process.argv.length !== 2) throw new Error('Unsupported invocation.');
  const report = await inspectWorkerIntegrations(await loadWorkerPrivateEnvironment());
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  if ([report.openai, report.n8n].some(service => service.status !== 'reachable')) process.exitCode = 2;
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(() => { process.stderr.write('Private provider inspection could not be completed; details suppressed.\n'); process.exitCode = 1; });
}
