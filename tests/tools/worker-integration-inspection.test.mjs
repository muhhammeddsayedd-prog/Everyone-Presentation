import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import nodeTimers from 'node:timers';
import { syncBuiltinESMExports } from 'node:module';
import test from 'node:test';
import { inspectWorkerIntegrations } from '../../tools/inspect_worker_integrations.mjs';

// Import-only/pure seam tests. Never invokes the CLI, private loader or real fetch.
const environment = { OPENAI_API_KEY: 'synthetic-openai-private', OPENAI_EXTRACTION_MODEL: 'synthetic-selected-model',
  N8N_API_KEY: 'synthetic-n8n-private', N8N_BASE_URL: 'https://synthetic.app.n8n.cloud' };
const response = (value, status = 200, headers = {}) => globalThis.Response.json(value, { status, headers });
const noSecrets = report => assert.doesNotMatch(JSON.stringify(report), /synthetic-openai-private|synthetic-n8n-private|synthetic-selected-model|synthetic-workflow|private-provider-detail|evil\.invalid/);

test('missing credentials cause no HTTP and presence does not imply execution/model selection', async () => {
  let calls = 0; const fetcher = async () => { calls++; throw new Error('Unexpected HTTP'); };
  for (const input of [{}, { OPENAI_EXTRACTION_MODEL: 'synthetic-selected-model' }, { N8N_API_KEY: environment.N8N_API_KEY }, { N8N_BASE_URL: environment.N8N_BASE_URL }]) {
    const report = await inspectWorkerIntegrations(input, fetcher);
    assert.equal(report.openai.status, 'not_configured'); assert.equal(report.n8n.status, 'not_configured');
    assert.equal(report.openai.selected_model_available, null); assert.equal(report.openai.model_generation_tested, false);
    assert.equal(report.n8n.workflows_executed, false); assert.equal(report.pipeline_tested, false);
    assert.equal(report.secrets_or_provider_bodies_recorded, false); noSecrets(report);
  }
  assert.equal(calls, 0);
});

test('only two fixed GETs use provider-specific credentials and return sanitized counts/booleans', async () => {
  const calls = [];
  const report = await inspectWorkerIntegrations(environment, async (url, options) => {
    calls.push({ url, options });
    return url.startsWith('https://api.openai.com/')
      ? response({ data: [{ id: 'gpt-6.1-sol' }, { id: environment.OPENAI_EXTRACTION_MODEL }], private_payload: environment.OPENAI_API_KEY })
      : response({ data: [{ id: 'synthetic-workflow', name: 'private-provider-detail', nodes: [{ secret: environment.N8N_API_KEY }] }], nextCursor: 'private-provider-detail' });
  });
  assert.deepEqual(calls.map(call => call.url), ['https://api.openai.com/v1/models', 'https://synthetic.app.n8n.cloud/api/v1/workflows?limit=1']);
  for (const { options } of calls) {
    assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error'); assert.ok(options.signal instanceof globalThis.AbortSignal);
    assert.equal(options.body, undefined);
  }
  const openai = new globalThis.Headers(calls[0].options.headers); const n8n = new globalThis.Headers(calls[1].options.headers);
  assert.equal(openai.get('authorization'), `Bearer ${environment.OPENAI_API_KEY}`); assert.equal(openai.has('x-n8n-api-key'), false);
  assert.equal(n8n.get('x-n8n-api-key'), environment.N8N_API_KEY); assert.equal(n8n.has('authorization'), false);
  assert.equal(report.openai.status, 'reachable'); assert.equal(report.openai.candidate_available, true);
  assert.equal(report.openai.selected_model_available, true); assert.equal(report.n8n.status, 'reachable');
  assert.equal(report.n8n.workflows_on_page, 1); assert.equal(report.n8n.more_pages, true);
  noSecrets(report);
});

test('401/403 denial and thrown provider diagnostics never echo private bodies/headers', async () => {
  const denied = await inspectWorkerIntegrations(environment, async url => response({ message: `private-provider-detail ${environment.OPENAI_API_KEY}` }, url.startsWith('https://api.openai.com/') ? 401 : 403));
  assert.equal(denied.openai.status, 'denied'); assert.equal(denied.openai.http_status, 401);
  assert.equal(denied.n8n.status, 'denied'); assert.equal(denied.n8n.http_status, 403); noSecrets(denied);
  const failed = await inspectWorkerIntegrations(environment, async () => { throw new Error(`private-provider-detail ${environment.N8N_API_KEY}`); });
  assert.equal(failed.openai.status, 'unavailable'); assert.equal(failed.n8n.status, 'unavailable'); noSecrets(failed);
  const limited = await inspectWorkerIntegrations(environment, async url => response({ message: 'private-provider-detail' }, url.startsWith('https://api.openai.com/') ? 503 : 429));
  assert.equal(limited.openai.status, 'unavailable'); assert.equal(limited.openai.http_status, 503);
  assert.equal(limited.n8n.status, 'rate_limited'); assert.equal(limited.n8n.http_status, 429); noSecrets(limited);
});

test('redirect protection is requested and no off-origin follow-up receives credentials', async () => {
  const destinations = [];
  const report = await inspectWorkerIntegrations(environment, async (url, options) => {
    destinations.push(url); assert.equal(options.redirect, 'error');
    return new globalThis.Response('private-provider-detail', { status: 302, headers: { Location: 'https://evil.invalid/credential-target' } });
  });
  assert.equal(destinations.length, 2); assert.ok(destinations.every(url => !url.includes('evil.invalid')));
  assert.notEqual(report.openai.status, 'reachable'); assert.notEqual(report.n8n.status, 'reachable'); noSecrets(report);
});

test('a streamed body above1MiB is cancelled without parsing or retaining a provider payload', async () => {
  let cancelled = false; let sent = false;
  const body = new globalThis.ReadableStream({ pull(controller) { if (!sent) { sent = true; controller.enqueue(Buffer.alloc(1024 * 1024 + 1, 120)); } }, cancel() { cancelled = true; } });
  const report = await inspectWorkerIntegrations({ OPENAI_API_KEY: environment.OPENAI_API_KEY }, async () => new globalThis.Response(body));
  assert.equal(report.openai.status, 'response_too_large'); assert.equal(report.openai.http_status, 200);
  assert.equal(cancelled, true); assert.equal(report.openai.candidate_available, null); noSecrets(report);
});

test('malformed JSON and malformed list envelopes fail closed without false reachable evidence', async () => {
  for (const payload of ['{private-provider-detail', { data: [{ id: 42 }] }, { data: null }]) {
    const report = await inspectWorkerIntegrations({ OPENAI_API_KEY: environment.OPENAI_API_KEY }, async () => typeof payload === 'string'
      ? new globalThis.Response(payload) : response(payload));
    assert.equal(report.openai.status, 'invalid_response'); assert.equal(report.openai.candidate_available, null); noSecrets(report);
  }
  for (const payload of [{ data: [{ id: 'first' }, { id: 'second' }] }, { data: [{ id: 42 }] }, { data: [], nextCursor: 42 }]) {
    const report = await inspectWorkerIntegrations({ N8N_API_KEY: environment.N8N_API_KEY, N8N_BASE_URL: environment.N8N_BASE_URL }, async () => response(payload));
    assert.equal(report.n8n.status, 'invalid_response'); assert.equal(report.n8n.workflows_on_page, null); noSecrets(report);
  }
  const empty = await inspectWorkerIntegrations(environment, async url => response(url.startsWith('https://api.openai.com/') ? { data: [] } : { data: [] }));
  assert.equal(empty.openai.candidate_available, false); assert.equal(empty.openai.selected_model_available, false);
  assert.equal(empty.n8n.workflows_on_page, 0); assert.equal(empty.n8n.more_pages, false);
});

test('invalid n8n origin or multiline credentials are rejected before any provider request', async () => {
  let calls = 0;
  for (const config of [{ ...environment, N8N_BASE_URL: 'https://evil.invalid' }, { ...environment, N8N_BASE_URL: 'https://synthetic.n8n.cloud/path' },
    { ...environment, OPENAI_API_KEY: 'synthetic-openai-private\r\nInjected: bad' }]) {
    await assert.rejects(inspectWorkerIntegrations(config, async () => { calls++; return response({}); }), error => error.message === 'Private worker configuration is invalid or unavailable.');
  }
  assert.equal(calls, 0);
});

test('pending HTTP is aborted at the fixed15second deadline with no private diagnostics', async context => {
  const timers = []; const signals = [];
  context.mock.method(nodeTimers, 'setTimeout', (callback, delay) => { timers.push({ callback, delay }); return 0; });
  syncBuiltinESMExports();
  try {
    const pending = inspectWorkerIntegrations(environment, async (_url, options) => new Promise((_resolve, reject) => {
      signals.push(options.signal); options.signal.addEventListener('abort', () => reject(new Error('private-provider-detail')), { once: true });
    }));
    assert.equal(timers.length, 2); assert.ok(timers.every(timer => timer.delay === 15_000));
    for (const timer of timers) timer.callback();
    const report = await pending;
    assert.ok(signals.every(signal => signal.aborted)); assert.equal(report.openai.status, 'unavailable'); assert.equal(report.n8n.status, 'unavailable'); noSecrets(report);
  } finally { context.mock.restoreAll(); syncBuiltinESMExports(); }
});
