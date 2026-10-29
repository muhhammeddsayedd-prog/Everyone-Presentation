import assert from 'node:assert/strict';
import test from 'node:test';
import { rootCertificates } from 'node:tls';
import { verifySpecsWorkerStartup, SpecsWorkerStartupError } from '../../apps/worker/src/runtime-main.ts';
const environment = { OPENAI_API_KEY: 'synthetic-private-provider', OPENAI_EXTRACTION_MODEL: 'synthetic-model', N8N_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/metadata', N8N_DISPATCH_SECRET: 'synthetic-base-secret-long-enough', EPS_SPECS_PG_HOST: 'aws-0-eu-west-1.pooler.supabase.com', EPS_SPECS_PG_PASSWORD: 'synthetic-private-runtime-password-long', EPS_SPECS_PG_CA_BASE64: Buffer.from(rootCertificates[0]).toString('base64'), EPS_SPECS_FILES_ENABLED: 'true', SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public', EPS_PRESENTATION_ENABLED: 'true', N8N_PRESENTATION_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/eps-wf03-presentation-stage-v1', N8N_PRESENTATION_DISPATCH_SECRET: 'c'.repeat(64) };
test('WF03 startup composes the same finite gateway ports without claiming work or invoking external services', async () => {
  let factories = 0; const port = { async getAssetAccess() { throw Error('not called'); }, async reserveOutput() { throw Error('not called'); }, async completeOutput() { throw Error('not called'); } };
  const result = await verifySpecsWorkerStartup(environment, (async (_config: unknown, _dependencies: unknown, _files: unknown, _replay: unknown, _candidate: boolean, presentation: boolean) => { factories++; assert.equal(presentation, true); return { presentationFiles: port, close: async () => {} }; }) as never);
  assert.equal(factories, 1); assert.ok(result.presentation); assert.ok(result.presentation.assets);
});
test('WF03 configuration must be dedicated, HTTPS same n8n instance and explicitly backed by file ports', async () => {
  for (const patch of [{ EPS_PRESENTATION_ENABLED: 'yes' }, { EPS_SPECS_FILES_ENABLED: 'false' }, { N8N_PRESENTATION_DISPATCH_SECRET: environment.N8N_DISPATCH_SECRET }, { N8N_PRESENTATION_DISPATCH_URL: 'https://other.app.n8n.cloud/webhook/eps-wf03-presentation-stage-v1' }, { N8N_PRESENTATION_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/other' }]) {
    let factories = 0; await assert.rejects(verifySpecsWorkerStartup({ ...environment, ...patch }, (async () => { factories++; }) as never), error => error instanceof SpecsWorkerStartupError && error.code === 'PRESENTATION_RUNTIME_CONFIGURATION_INVALID'); assert.equal(factories, 0);
  }
  let closed = 0; await assert.rejects(verifySpecsWorkerStartup(environment, (async () => ({ close: async () => { closed++; } })) as never), error => error instanceof SpecsWorkerStartupError && error.code === 'PRESENTATION_RUNTIME_CONFIGURATION_INVALID'); assert.equal(closed, 1);
});
