import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { hostedWorkerEnvironment, holdHostedWorker } from '../../apps/worker/src/runtime-hosted-config.ts';
const flags = ['EPS_SPECS_FILES_ENABLED','EPS_CANDIDATE_MEDIA_ENABLED','EPS_FRAME_EXTRACTION_ENABLED','EPS_PDF_VISION_ENABLED','EPS_REVIEW_ENABLED','EPS_PRESENTATION_ENABLED','EPS_GUEST_EXPORTS_ENABLED'];
const environment = { VERCEL: '1', VERCEL_ENV: 'production', VERCEL_OIDC_TOKEN_FILE: '/var/run/secrets/vercel.com/token', EPS_RELEASE_MODE: 'controlled_pilot', EPS_PILOT_EXPIRES_AT: new Date(Date.now() + 3_600_000).toISOString(), NODE_ENV: 'production', EPS_NATIVE_TRANSPORT: 'vercel_sandbox', EPS_NATIVE_MANIFEST_SHA256: 'a'.repeat(64), EPS_DAEMON_SOURCE_SHA256: 'b'.repeat(64), EPS_NATIVE_COMPATIBILITY_SHA256: 'c'.repeat(64), ...Object.fromEntries(flags.map(flag => [flag, 'true'])) };
test('hosted entry accepts only explicit pilot sandbox mode and excludes ambient credentials', () => {
  const result = hostedWorkerEnvironment({ ...environment, RANDOM_PRIVATE_SENTINEL: 'secret', PATH: 'untrusted' });
  assert.equal(result.PATH, ''); assert.equal(result.RANDOM_PRIVATE_SENTINEL, undefined); assert.equal(result.EPS_NATIVE_TRANSPORT, 'vercel_sandbox');
});
test('worker retains and validates the same canonical UTC pilot deadline, refusing missing or expired values', () => {
  const now = Date.parse('2026-10-30T18:00:00Z');
  assert.equal(hostedWorkerEnvironment(environment, now).EPS_PILOT_EXPIRES_AT, environment.EPS_PILOT_EXPIRES_AT);
  for (const expiry of [undefined, '2026-10-30T18:00:00Z', '2026-10-30T19:00:00+01:00', '2026-11-31T18:00:00Z']) assert.throws(() => hostedWorkerEnvironment({ ...environment, EPS_PILOT_EXPIRES_AT: expiry }, now));
});
test('explicit owner-controlled pilot runs until stop and rejects mixed/invalid duration modes', () => {
  for (const expiry of [undefined, '']) assert.equal(hostedWorkerEnvironment({ ...environment, EPS_PILOT_OWNER_CONTROLLED: 'true', EPS_PILOT_EXPIRES_AT: expiry }).EPS_PILOT_OWNER_CONTROLLED, 'true');
  for (const flag of ['TRUE', '1', '', 'false']) assert.throws(() => hostedWorkerEnvironment({ ...environment, EPS_PILOT_OWNER_CONTROLLED: flag, EPS_PILOT_EXPIRES_AT: undefined }));
  assert.throws(() => hostedWorkerEnvironment({ ...environment, EPS_PILOT_OWNER_CONTROLLED: 'true' }));
});
test('hosted entry cannot silently choose local native children, real production or a management key', () => {
  for (const delta of [{ VERCEL_ENV: 'preview' }, { EPS_NATIVE_TRANSPORT: undefined }, { EPS_NATIVE_TRANSPORT: 'local_docker' }, { EPS_RELEASE_MODE: undefined }, { VERCEL_OIDC_TOKEN_FILE: 'C:/secret' }, { VERCEL_TOKEN: 'secret' }, { SUPABASE_SERVICE_ROLE_KEY: 'secret' }, { N8N_API_KEY: 'secret' }, { EPS_PRESENTATION_ENABLED: 'false' }]) assert.throws(() => hostedWorkerEnvironment({ ...environment, ...delta }), /HOSTED_WORKER_CONFIGURATION_INVALID/);
});
test('unknown cleanup holds the daemon paused until owner signal or pilot expiry, then removes listeners', async () => {
  for (const kind of ['owner', 'expiry']) {
    const events = new EventEmitter(); const controller = new AbortController(); let finished = false;
    const held = holdHostedWorker(controller.signal, events).then(() => { finished = true; });
    await Promise.resolve(); assert.equal(finished, false);
    if (kind === 'owner') events.emit('SIGTERM'); else controller.abort();
    await held; assert.equal(events.listenerCount('SIGTERM'), 0); assert.equal(events.listenerCount('SIGINT'), 0);
  }
});
