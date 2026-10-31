import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { readRuntimeConfig } from '../../apps/web/lib/config.ts';
import { assertHostedPilotConfig } from '../../apps/web/lib/hosting-pilot.ts';

// Pure configuration fixtures; no accounts, keys, provider or deployment calls.
const now = Date.parse('2026-10-30T18:00:00.000Z');
const environment = { EPS_RELEASE_MODE: 'controlled_pilot', APP_ENV: 'staging', NODE_ENV: 'production',
  CENTRAL_ADAPTER_MODE: 'supabase', APP_BASE_URL: 'https://studio-pilot.example.invalid',
  SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_guard_only',
  EPS_PILOT_EXPIRES_AT: '2026-11-06T18:00:00Z' };

test('explicit pilot admits canonical HTTPS central staging, including Vercel technical production channel', () => {
  const input = { ...environment, VERCEL: '1', VERCEL_ENV: 'production' };
  const before = { ...input };
  assert.doesNotThrow(() => assertHostedPilotConfig(input, now));
  assert.deepEqual(input, before);
  const runtime = readRuntimeConfig({ ...input, EPS_PILOT_EXPIRES_AT: new Date(Date.now() + 3_600_000).toISOString() });
  assert.equal(runtime.environment, 'staging'); assert.equal(runtime.adapterMode, 'supabase');
  assert.equal(runtime.baseUrl, environment.APP_BASE_URL);
});

test('production and Vercel runtime cannot use unmarked central or fixture admission', () => {
  const unmarked = { ...environment }; Reflect.deleteProperty(unmarked, 'EPS_RELEASE_MODE');
  assert.throws(() => readRuntimeConfig(unmarked));
  assert.throws(() => readRuntimeConfig({ APP_ENV: 'test', VERCEL: '1' }));
  for (const change of [{ EPS_RELEASE_MODE: 'production' }, { APP_ENV: 'production' }, { APP_ENV: 'development' },
    { NODE_ENV: 'development' }, { CENTRAL_ADAPTER_MODE: 'local_fixture' }, { EPS_TEST_SERVER: 'true' }]) {
    assert.throws(() => assertHostedPilotConfig({ ...environment, ...change }, now));
  }
});

test('pilot deadline is explicit, canonical UTC and strictly future using an injected clock', () => {
  for (const expiry of [undefined, '', 'not-a-date', '2026-10-30T18:00:00Z', '2026-10-30T17:59:59Z',
    '2026-11-06T18:00:00+00:00', '2026-11-06', '2026-11-06T18:00:00', '2026-02-30T18:00:00Z']) {
    assert.throws(() => assertHostedPilotConfig({ ...environment, EPS_PILOT_EXPIRES_AT: expiry }, now));
  }
  assert.doesNotThrow(() => assertHostedPilotConfig({ ...environment, EPS_PILOT_EXPIRES_AT: '2026-10-30T18:00:01.000Z' }, now));
  for (const invalidNow of [NaN, Infinity]) assert.throws(() => assertHostedPilotConfig(environment, invalidNow));
});

test('owner-controlled pilot runs without a deadline only through the explicit closed mode', () => {
  for (const expiry of [undefined, '']) {
    const input = { ...environment, EPS_PILOT_OWNER_CONTROLLED: 'true', EPS_PILOT_EXPIRES_AT: expiry };
    assert.doesNotThrow(() => assertHostedPilotConfig(input, now + 10 * 365 * 86_400_000));
    assert.equal(readRuntimeConfig(input).adapterMode, 'supabase');
  }
  for (const flag of ['', 'TRUE', '1', 'yes']) assert.throws(() => assertHostedPilotConfig({ ...environment, EPS_PILOT_OWNER_CONTROLLED: flag }, now));
  assert.throws(() => assertHostedPilotConfig({ ...environment, EPS_PILOT_OWNER_CONTROLLED: 'true' }, now));
  assert.doesNotThrow(() => assertHostedPilotConfig({ ...environment, EPS_PILOT_OWNER_CONTROLLED: 'false' }, now));
  assert.throws(() => assertHostedPilotConfig({ ...environment, EPS_PILOT_OWNER_CONTROLLED: 'false', EPS_PILOT_EXPIRES_AT: '' }, now));
});

test('owner-controlled mode retains all runtime, fixture, origin and central-target restrictions', () => {
  const owner = { ...environment, EPS_PILOT_OWNER_CONTROLLED: 'true', EPS_PILOT_EXPIRES_AT: '' };
  for (const change of [{ EPS_RELEASE_MODE: undefined }, { APP_ENV: 'production' }, { APP_ENV: 'test' },
    { NODE_ENV: 'development' }, { CENTRAL_ADAPTER_MODE: 'local_fixture' }, { EPS_TEST_SERVER: 'true' },
    { APP_BASE_URL: 'http://127.0.0.1:3000' }, { SUPABASE_URL: 'https://another-project.supabase.co' },
    { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private-sentinel' }]) {
    assert.throws(() => assertHostedPilotConfig({ ...owner, ...change }, now));
  }
});

test('pilot origin is fixed public HTTPS and never selected from Vercel or forwarded host hints', () => {
  for (const origin of [undefined, 'http://studio-pilot.example.invalid', 'https://localhost', 'https://127.0.0.1',
    'https://[::1]', 'https://user:private-sentinel@studio.example', 'https://studio.example/',
    'https://studio.example/path', 'https://studio.example?query=x', 'https://studio.example#fragment']) {
    assert.throws(() => assertHostedPilotConfig({ ...environment, APP_BASE_URL: origin }, now),
      error => error instanceof Error && !error.message.includes('private-sentinel'));
  }
  const missing = { ...environment }; Reflect.deleteProperty(missing, 'APP_BASE_URL');
  assert.throws(() => assertHostedPilotConfig({ ...missing, VERCEL_URL: 'studio-pilot.example.invalid',
    VERCEL_PROJECT_PRODUCTION_URL: 'studio-pilot.example.invalid', HTTP_HOST: 'studio-pilot.example.invalid' }, now));
});

test('pilot keeps the existing central target and rejects missing or privileged publishable credentials', () => {
  for (const change of [{ SUPABASE_URL: 'https://another-project.supabase.co' }, { SUPABASE_URL: 'http://127.0.0.1:54321' },
    { SUPABASE_PUBLISHABLE_KEY: '' }, { SUPABASE_PUBLISHABLE_KEY: 'sb_secret_private-sentinel' },
    { SUPABASE_PUBLISHABLE_KEY: 'service_role.private-sentinel' }]) {
    assert.throws(() => assertHostedPilotConfig({ ...environment, ...change }, now),
      error => error instanceof Error && !error.message.includes('private-sentinel'));
  }
});

test('unchanged local development and test fixtures remain local and production fixtures remain denied', () => {
  assert.equal(readRuntimeConfig({ APP_ENV: 'test' }).adapterMode, 'local_fixture');
  assert.equal(readRuntimeConfig({ APP_ENV: 'development', CENTRAL_ADAPTER_MODE: 'supabase',
    APP_BASE_URL: 'http://127.0.0.1:3000', SUPABASE_URL: environment.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: environment.SUPABASE_PUBLISHABLE_KEY }).adapterMode, 'supabase');
  for (const change of [{ NODE_ENV: 'production' }, { APP_ENV: 'production' }, { APP_ENV: 'staging' }]) {
    assert.throws(() => readRuntimeConfig({ CENTRAL_ADAPTER_MODE: 'local_fixture', ...change }));
  }
});

test('actual Next configuration enforces Vercel build admission and traces the monorepo root', async () => {
  const script = "const m=await import('./apps/web/next.config.ts');const c=m.default.default??m.default;if(c.outputFileTracingRoot!==process.cwd())process.exit(21);";
  const invoke = (env: Record<string, string>) => spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '--eval', script],
    { cwd: path.resolve('.'), env: { ...env, NODE_ENV: 'production' as const, NEXT_TELEMETRY_DISABLED: '1' }, encoding: 'utf8', windowsHide: true, timeout: 15_000 });
  const accepted = invoke({ ...environment, EPS_PILOT_EXPIRES_AT: new Date(Date.now() + 3_600_000).toISOString(), VERCEL: '1' });
  assert.equal(accepted.status, 0, accepted.stderr);
  const ownerControlled = invoke({ ...environment, EPS_PILOT_OWNER_CONTROLLED: 'true', EPS_PILOT_EXPIRES_AT: '', VERCEL: '1' });
  assert.equal(ownerControlled.status, 0, ownerControlled.stderr);
  const unmarked = { ...environment }; Reflect.deleteProperty(unmarked, 'EPS_RELEASE_MODE');
  const denied = invoke({ ...unmarked, VERCEL: '1' });
  assert.notEqual(denied.status, 0);
  assert.match(denied.stderr, /PILOT_CONFIGURATION_REQUIRED/u);
  const ordinaryBuild = invoke({ NODE_ENV: 'production' });
  assert.equal(ordinaryBuild.status, 0, ordinaryBuild.stderr);
  const packageJson = JSON.parse(await readFile('apps/web/package.json', 'utf8'));
  const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
  assert.equal(packageJson.engines.node, '>=24 <25');
  assert.equal(lock.packages['apps/web'].engines.node, packageJson.engines.node);
});
