import assert from 'node:assert/strict';
import test from 'node:test';
import { Buffer } from 'node:buffer';
import { rootCertificates } from 'node:tls';
import { checkSpecsFilesRuntime } from '../../tools/check-specs-files-runtime.mjs';

test('disabled file checker reads neither runtime/public configuration nor creates a connection', async () => {
  const deny = async () => { throw new Error('Configuration IO must not happen.'); };
  const value = await checkSpecsFilesRuntime({ environment: {}, loadRuntime: deny, loadFiles: deny, createGateway: deny });
  assert.equal(value.result, 'failed'); assert.equal(value.code, 'RUNTIME_CONFIG_INVALID'); assert.equal(value.worker_started, false);
});
test('file checker constructs the explicit public third option and closes without job/source/provider/Storage operations', async () => {
  let closes = 0; let constructions = 0;
  const value = await checkSpecsFilesRuntime({ environment: { EPS_SPECS_FILES_ENABLED: 'true' },
    loadRuntime: async () => ({ EPS_SPECS_PG_HOST: 'aws-0-eu-west-1.pooler.supabase.com', EPS_SPECS_PG_PASSWORD: 'synthetic-private-runtime-password',
      EPS_SPECS_PG_CA_BASE64: Buffer.from(rootCertificates[0]).toString('base64') }),
    loadFiles: async ({ environment }) => { assert.equal(environment.EPS_SPECS_FILES_ENABLED, 'true');
      return { EPS_SPECS_FILES_ENABLED: 'true', SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_public_key' }; },
    createGateway: async (_config, dependencies, publicConfig) => { constructions++; assert.deepEqual(dependencies, {});
      assert.deepEqual(publicConfig, { storageOrigin: 'https://pyibofyctwnqpvktepse.supabase.co', publishableKey: 'sb_publishable_synthetic_public_key' });
      return { verifiedFunctionOperations:11,close: async () => { closes++; } }; } });
  assert.equal(value.result, 'passed'); assert.equal(constructions, 1); assert.equal(closes, 1);
  assert.equal(value.exact_runtime_groups, 3); assert.equal(value.exact_function_operations, 11);
  assert.equal(value.base_specs_function_operations,10);assert.equal(value.claim_replay_function_enabled,true);
  for (const field of ['jobs_claimed','source_requested','provider_called','storage_requested','worker_started','provider_configuration_loaded']) assert.equal(value[field], false);
});
test('checker never serializes private configuration or unknown driver errors', async () => {
  const value = await checkSpecsFilesRuntime({ environment: { EPS_SPECS_FILES_ENABLED: 'true' }, loadRuntime: async () => { throw new Error('synthetic-private-password'); } });
  assert.equal(value.result, 'failed'); assert.equal(value.code, 'RUNTIME_CHECK_UNCONFIRMED'); assert.doesNotMatch(JSON.stringify(value), /synthetic-private/u);
});
