import assert from 'node:assert/strict';
import test from 'node:test';
import { rootCertificates } from 'node:tls';
import { verifySpecsWorkerStartup, SpecsWorkerStartupError } from '../../apps/worker/src/runtime-main.ts';

const environment = { OPENAI_API_KEY: 'synthetic-private-provider-key', OPENAI_EXTRACTION_MODEL: 'synthetic-model',
  N8N_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/metadata', N8N_DISPATCH_SECRET: 'synthetic-private-webhook-secret-long',
  EPS_SPECS_PG_HOST: 'aws-0-eu-west-1.pooler.supabase.com', EPS_SPECS_PG_PASSWORD: 'synthetic-private-runtime-password',
  EPS_SPECS_PG_CA_BASE64: Buffer.from(rootCertificates[0]).toString('base64'), EPS_SPECS_FILES_ENABLED: 'true',
  SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public_key' };

test('import and startup verification do not poll/claim or call provider/orchestration/Storage', async () => {
  let closes = 0; let factories = 0;
  const gateway = { close: async () => { closes++; } };
  const result = await verifySpecsWorkerStartup(environment, (async (_config: unknown, _dependencies: unknown, files: unknown) => {
    factories++; assert.deepEqual(files, { storageOrigin: environment.SUPABASE_URL, publishableKey: environment.SUPABASE_PUBLISHABLE_KEY }); return gateway;
  }) as never);
  assert.equal(factories, 1); assert.equal(closes, 0); assert.ok(result.fileConfiguration);
  await result.gateway.close(); assert.equal(closes, 1);
});
test('gateway startup failure reports only safe checkpoint, code and projected flag boolean', async () => {
  await assert.rejects(verifySpecsWorkerStartup(environment, (async () => {
    throw { code: 'RUNTIME_ROLE_UNVERIFIED', message: environment.EPS_SPECS_PG_PASSWORD, details: environment.OPENAI_API_KEY };
  }) as never), error => {
    assert.ok(error instanceof SpecsWorkerStartupError); assert.equal(error.checkpoint, 'gateway_verification');
    assert.equal(error.code, 'RUNTIME_ROLE_UNVERIFIED'); assert.equal(error.files_requested, true);
    assert.doesNotMatch(JSON.stringify(error), /synthetic-private/u); return true;
  });
});
test('provider/management configuration fails before the gateway without exposing its values', async () => {
  let factories = 0; const factory = (async () => { factories++; }) as never;
  await assert.rejects(verifySpecsWorkerStartup({ ...environment, OPENAI_EXTRACTION_MODEL: '' }, factory), error => {
    assert.ok(error instanceof SpecsWorkerStartupError); assert.equal(error.checkpoint, 'provider_configuration');
    assert.equal(error.code, 'OPENAI_EXTRACTION_MODEL_REQUIRED'); return true;
  });
  await assert.rejects(verifySpecsWorkerStartup({ ...environment, N8N_API_KEY: 'synthetic-private-management' }, factory), error => {
    assert.ok(error instanceof SpecsWorkerStartupError); assert.equal(error.checkpoint, 'runtime_scope'); assert.equal(error.code, 'WORKER_RUNTIME_SCOPE_INVALID'); return true;
  });
  assert.equal(factories, 0);
});
test('startup retries only connection availability before any work and returns one verified gateway', async () => {
  let factories = 0; const delays: number[] = []; const gateway = { close: async () => {} };
  const result = await verifySpecsWorkerStartup(environment, (async () => {
    factories++; if (factories < 3) throw { code: factories === 1 ? 'RUNTIME_UNAVAILABLE' : 'DEPENDENCY_UNAVAILABLE' };
    return gateway;
  }) as never, async milliseconds => { delays.push(milliseconds); });
  assert.equal(factories, 3); assert.equal(result.gateway, gateway); assert.deepEqual(delays, [500, 1000]);
});
test('startup availability retries stop at three and retain only safe final connection diagnostics', async () => {
  let factories = 0; const delays: number[] = [];
  await assert.rejects(verifySpecsWorkerStartup(environment, (async () => { factories++;
    throw { code: 'RUNTIME_UNAVAILABLE', gateway_phase: 'connect', transport_code: 'CONNECT_TIMEOUT', elapsed_ms: 3001,
      message: environment.EPS_SPECS_PG_PASSWORD, raw: environment.OPENAI_API_KEY };
  }) as never, async milliseconds => { delays.push(milliseconds); }), error => {
    assert.ok(error instanceof SpecsWorkerStartupError);
    const diagnostic = error as SpecsWorkerStartupError & { attempts: number; gateway_phase: string; transport_code: string; elapsed_ms: number };
    assert.equal(diagnostic.attempts, 3); assert.equal(diagnostic.gateway_phase, 'connect'); assert.equal(diagnostic.transport_code, 'CONNECT_TIMEOUT');
    assert.equal(diagnostic.elapsed_ms, 3001); assert.doesNotMatch(JSON.stringify(error), /synthetic-private/u); return true;
  });
  assert.equal(factories, 3); assert.deepEqual(delays, [500, 1000]);
});
test('startup never retries configuration/auth/role or unknown errors and captures code only once', async () => {
  for (const failure of [{ code: 'RUNTIME_CONFIG_INVALID' }, { code: 'RUNTIME_AUTH_UNVERIFIED' }, { code: 'RUNTIME_ROLE_UNVERIFIED' },
    { code: 'private-driver-error', message: environment.EPS_SPECS_PG_PASSWORD },
    { get code(): string { throw new Error(environment.OPENAI_API_KEY); } }]) {
    let factories = 0; const delays: number[] = [];
    await assert.rejects(verifySpecsWorkerStartup(environment, (async () => { factories++; throw failure; }) as never,
      async milliseconds => { delays.push(milliseconds); }), error => {
      assert.ok(error instanceof SpecsWorkerStartupError); assert.doesNotMatch(JSON.stringify(error), /synthetic-private|private-driver/u); return true;
    });
    assert.equal(factories, 1); assert.deepEqual(delays, []);
  }
});
test('PDF vision flag requires immutable native image and otherwise remains disabled', async () => {
  const factory = (async () => ({ close: async () => {} })) as never;
  const disabled = await verifySpecsWorkerStartup(environment, factory); assert.equal(disabled.vision, undefined);
  const enabled = await verifySpecsWorkerStartup({ ...environment, EPS_PDF_VISION_ENABLED: 'true', EPS_PDF_RASTER_IMAGE_ID: `sha256:${'a'.repeat(64)}` }, factory); assert.equal(enabled.vision?.imageId, `sha256:${'a'.repeat(64)}`);
  await assert.rejects(verifySpecsWorkerStartup({ ...environment, EPS_PDF_VISION_ENABLED: 'true', EPS_PDF_RASTER_IMAGE_ID: 'mutable:latest' }, factory), error => error instanceof SpecsWorkerStartupError && error.code === 'PDF_VISION_CONFIGURATION_INVALID');
});

test('review processing is disabled by default and requires a separate fixed workflow secret before gateway creation', async () => {
  let calls = 0; const factory = (async () => { calls++; return { close: async () => {} }; }) as never;
  const disabled = await verifySpecsWorkerStartup(environment, factory); assert.equal(disabled.review, undefined); assert.equal(disabled.fit, undefined); assert.equal(calls, 1);
  const enabled = { ...environment, EPS_REVIEW_ENABLED: 'true', N8N_REVIEW_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/eps-wf05-review-suggestion-stage-v1', N8N_REVIEW_DISPATCH_SECRET: 'a'.repeat(64) };
  for (const patch of [{ EPS_REVIEW_ENABLED: 'yes' }, { N8N_REVIEW_DISPATCH_URL: 'https://different.app.n8n.cloud/webhook/eps-wf05-review-suggestion-stage-v1' },
    { N8N_REVIEW_DISPATCH_URL: enabled.N8N_REVIEW_DISPATCH_URL + '?key=private' }, { N8N_REVIEW_DISPATCH_URL: environment.N8N_DISPATCH_URL },
    { N8N_REVIEW_DISPATCH_SECRET: environment.N8N_DISPATCH_SECRET }, { N8N_REVIEW_DISPATCH_SECRET: '' }]) {
    await assert.rejects(verifySpecsWorkerStartup({ ...enabled, ...patch }, factory), error => error instanceof SpecsWorkerStartupError && ['REVIEW_RUNTIME_CONFIGURATION_INVALID', 'N8N_RUNTIME_CONFIGURATION_REQUIRED'].includes(error.code) && !JSON.stringify(error).includes('private'));
  }
  assert.equal(calls, 1); const result = await verifySpecsWorkerStartup(enabled, factory);
  assert.equal(result.review?.openAI.apiKey, environment.OPENAI_API_KEY); assert.deepEqual(result.fit, {}); assert.equal(calls, 2);
});

test('enabled review metadata goes only to WF05 while specs retains its existing destination', { concurrency: false }, async () => {
  const previous = globalThis.fetch; const destinations: string[] = [];
  globalThis.fetch = async (destination, request) => {
    destinations.push(String(destination)); const envelope = JSON.parse(request!.body as string);
    assert.equal(request!.redirect, 'error'); assert.equal(Object.keys(envelope).length, 8);
    const scope = { ...envelope }; delete scope.event_type; delete scope.contract_version;
    return new Response(JSON.stringify({ ...scope, schema_version: '1.0', workflow_execution_id: 'synthetic-workflow', handler: envelope.kind === 'review_fit' ? 'native.measure_review_fit' : 'native.prepare_document' }), { headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const reviewUrl = 'https://synthetic.app.n8n.cloud/webhook/eps-wf05-review-suggestion-stage-v1';
    const result = await verifySpecsWorkerStartup({ ...environment, EPS_REVIEW_ENABLED: 'true', N8N_REVIEW_DISPATCH_URL: reviewUrl, N8N_REVIEW_DISPATCH_SECRET: 'a'.repeat(64) }, (async () => ({ close: async () => {} })) as never);
    const envelope = { event_type: 'job.stage_ready' as const, contract_version: '1.0' as const, event_id: 'synthetic-event', job_id: 'synthetic-job', kind: 'review_fit' as const, stage: 'measure_review_fit' as const, input_hash: 'b'.repeat(64), correlation_id: 'synthetic-request' };
    await result.router.route(envelope); await result.router.route({ ...envelope, kind: 'specs_extract', stage: 'prepare_document' });
    assert.deepEqual(destinations, [reviewUrl, environment.N8N_DISPATCH_URL]);
  } finally { globalThis.fetch = previous; }
});
