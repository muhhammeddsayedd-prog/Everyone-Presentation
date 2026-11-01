import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { readRuntimeConfig } from '../../apps/web/lib/config.ts';

const environment = { EPS_RELEASE_MODE: 'production', APP_ENV: 'production', NODE_ENV: 'production',
  CENTRAL_ADAPTER_MODE: 'supabase', APP_BASE_URL: 'https://studio.example.invalid',
  SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_guard_only' };

test('production runtime uses the canonical central system without pilot duration settings', () => {
  assert.deepEqual(readRuntimeConfig(environment), { environment: 'production', adapterMode: 'supabase', baseUrl: environment.APP_BASE_URL });
  for (const change of [{ APP_ENV: 'staging' }, { NODE_ENV: 'development' }, { CENTRAL_ADAPTER_MODE: 'local_fixture' },
    { EPS_TEST_SERVER: 'true' }, { APP_BASE_URL: 'http://127.0.0.1:3000' }, { SUPABASE_URL: 'https://foreign.supabase.co' },
    { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private_sentinel' }, { EPS_PILOT_EXPIRES_AT: '2030-01-01T00:00:00Z' }]) {
    assert.throws(() => readRuntimeConfig({ ...environment, ...change }), error => error instanceof Error && !error.message.includes('private_sentinel'));
  }
});

test('actual Next configuration admits explicit production and still denies an unmarked hosted build', () => {
  const invoke = (env: Record<string, string>) => spawnSync(process.execPath,
    ['--import', 'tsx', '--input-type=module', '--eval', "await import('./apps/web/next.config.ts');"],
    { cwd: path.resolve('.'), env: { ...env, NODE_ENV: 'production' as const, NEXT_TELEMETRY_DISABLED: '1' }, encoding: 'utf8', windowsHide: true, timeout: 15_000 });
  const accepted = invoke({ ...environment, VERCEL: '1' });
  assert.equal(accepted.status, 0, accepted.stderr);
  const missing = { ...environment }; Reflect.deleteProperty(missing, 'EPS_RELEASE_MODE');
  assert.notEqual(invoke({ ...missing, VERCEL: '1' }).status, 0);
});
