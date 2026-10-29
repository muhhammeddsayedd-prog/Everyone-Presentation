import assert from 'node:assert/strict';
import test from 'node:test';
import { parseWorkerRuntimeEnvironment, createSpecsWorkerEnvironment } from '../../tools/worker-runtime-env.mjs';

const fixture = { EPS_SPECS_PG_HOST: 'synthetic.pooler.supabase.com', EPS_SPECS_PG_PASSWORD: 'synthetic-private-password',
  EPS_SPECS_PG_CA_BASE64: 'c3ludGhldGljLWNh', N8N_DISPATCH_URL: 'https://synthetic.app.n8n.cloud/webhook/specs',
  N8N_DISPATCH_SECRET: 'synthetic-dispatch-secret-only-123456789' };
const text = Object.entries(fixture).map(([key, value]) => `${key}=${JSON.stringify(value)}`).join('\n');
test('runtime configuration requires exactly the five private runtime fields', () => {
  assert.deepEqual(parseWorkerRuntimeEnvironment(text), fixture);
  for (const bad of [text + '\nN8N_API_KEY=management-key', text.replace('EPS_SPECS_PG_HOST', 'UNKNOWN'), '', text + '\0', text.replace('synthetic-private-password', '')]) {
    assert.throws(() => parseWorkerRuntimeEnvironment(bad), error => { assert.equal(error.message, 'WORKER_RUNTIME_CONFIGURATION_REQUIRED'); return true; });
  }
});
test('child environment contains scoped provider/runtime values and excludes management and ambient overrides', () => {
  const provider = { OPENAI_API_KEY: 'synthetic-openai', OPENAI_EXTRACTION_MODEL: 'synthetic-model', N8N_API_KEY: 'must-not-propagate' };
  const child = createSpecsWorkerEnvironment(provider, fixture, { N8N_API_KEY: 'ambient', DATABASE_URL: 'ambient', OPENAI_BASE_URL: 'https://attacker.test', SystemRoot: 'synthetic-os' });
  assert.equal(child.OPENAI_API_KEY, provider.OPENAI_API_KEY); assert.equal(child.SystemRoot, 'synthetic-os');
  assert.equal(child.N8N_API_KEY, undefined); assert.equal(child.DATABASE_URL, undefined); assert.equal(child.OPENAI_BASE_URL, undefined);
  assert.equal(child.NODE_ENV, 'production'); assert.equal(child.N8N_DISPATCH_SECRET, fixture.N8N_DISPATCH_SECRET);
  const punctuation = 'synthetic"quoted\\password';
  assert.equal(createSpecsWorkerEnvironment(provider, { ...fixture, EPS_SPECS_PG_PASSWORD: punctuation }).EPS_SPECS_PG_PASSWORD, punctuation);
});
test('file-enabled child receives only the explicit public storage configuration outside the private five fields', () => {
  const provider = { OPENAI_API_KEY: 'synthetic-openai', OPENAI_EXTRACTION_MODEL: 'synthetic-model' };
  const publicStorage = { EPS_SPECS_FILES_ENABLED: 'true', SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public_key' };
  const child = createSpecsWorkerEnvironment(provider, fixture, { SUPABASE_URL: 'https://foreign.invalid',
    SUPABASE_SERVICE_ROLE_KEY: 'synthetic-do-not-copy', EPS_SPECS_FILES_ENABLED: 'true' }, publicStorage);
  assert.equal(child.EPS_SPECS_FILES_ENABLED, 'true'); assert.equal(child.SUPABASE_URL, publicStorage.SUPABASE_URL);
  assert.equal(child.SUPABASE_PUBLISHABLE_KEY, publicStorage.SUPABASE_PUBLISHABLE_KEY);
  assert.equal(child.SUPABASE_SERVICE_ROLE_KEY, undefined);
  assert.equal(createSpecsWorkerEnvironment(provider, fixture, publicStorage).EPS_SPECS_FILES_ENABLED, undefined);
});
