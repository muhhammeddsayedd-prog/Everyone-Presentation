import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { pilotWebStartPlan } from '../../tools/start-pilot-web.mjs';

const now = Date.parse('2026-10-30T18:00:00Z');
const environment = { EPS_RELEASE_MODE: 'controlled_pilot', APP_ENV: 'staging', NODE_ENV: 'production',
  CENTRAL_ADAPTER_MODE: 'supabase', APP_BASE_URL: 'https://studio-pilot.example.invalid',
  SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_guard_only',
  EPS_PILOT_EXPIRES_AT: '2026-11-06T18:00:00Z', PORT: '8080' };

test('dedicated pilot launcher plans a fixed Next start only after the same shared admission', () => {
  const plan = pilotWebStartPlan(environment, now);
  assert.equal(plan.cwd, path.resolve('apps/web'));
  assert.equal(plan.command, process.execPath);
  assert.deepEqual(plan.args, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '0.0.0.0', '--port', '8080']);
  assert.deepEqual(pilotWebStartPlan({ ...environment, EPS_PILOT_OWNER_CONTROLLED: 'true', EPS_PILOT_EXPIRES_AT: '' }, now + 10 * 365 * 86_400_000), plan);
  for (const change of [{ EPS_RELEASE_MODE: undefined }, { CENTRAL_ADAPTER_MODE: 'local_fixture' },
    { PORT: '0' }, { PORT: '65536' }, { PORT: '80;arbitrary' }, { PORT: '8e3' }]) {
    assert.throws(() => pilotWebStartPlan({ ...environment, ...change }, now));
  }
});

test('ordinary production start remains refused even if pilot variables are set', async () => {
  const oldGuard = await readFile('tools/start-web.mjs', 'utf8');
  assert.match(oldGuard, /Production start denied/u);
  const result = spawnSync(process.execPath, ['tools/start-web.mjs'], {
    env: environment, cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true, timeout: 5000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Production start denied/u);
  const invalidPilot = spawnSync(process.execPath, ['tools/start-pilot-web.mjs'], {
    env: { NODE_ENV: 'production' }, cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true, timeout: 5000,
  });
  assert.notEqual(invalidPilot.status, 0);
  assert.match(invalidPilot.stderr, /PILOT_CONFIGURATION_REQUIRED/u);
});
