import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import test from 'node:test';

const environment = { EPS_RELEASE_MODE: 'production', APP_ENV: 'production', NODE_ENV: 'production', CENTRAL_ADAPTER_MODE: 'supabase',
  APP_BASE_URL: 'https://studio.example.invalid', SUPABASE_URL: 'https://pyibofyctwnqpvktepse.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_guard_only', PORT: '8080' };

test('ordinary start plans the installed Next production server after shared admission', async () => {
  const { productionWebStartPlan } = await import('../../tools/start-web.mjs');
  const plan = productionWebStartPlan(environment);
  assert.equal(plan.command, process.execPath); assert.equal(plan.cwd, path.resolve('apps/web'));
  assert.deepEqual(plan.args, [path.resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '0.0.0.0', '--port', '8080']);
  for (const change of [{ EPS_RELEASE_MODE: 'controlled_pilot' }, { CENTRAL_ADAPTER_MODE: 'local_fixture' }, { PORT: '0' },
    { PORT: '65536' }, { PORT: '80;arbitrary' }, { PORT: '8e3' }]) {
    assert.throws(() => productionWebStartPlan({ ...environment, ...change }));
  }
});

test('ordinary start fails closed without reflecting invalid private configuration', () => {
  const result = spawnSync(process.execPath, ['tools/start-web.mjs'], { env: { ...environment, APP_BASE_URL: 'private_sentinel' },
    cwd: path.resolve('.'), encoding: 'utf8', windowsHide: true, timeout: 5000 });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Production start denied/u); assert(!result.stderr.includes('private_sentinel'));
});
