import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProbeImage, validateProjectToken, validateBoundaryProof, validateNetworkProof, validateImageSourceSeal, readBoundedCommandOutput, observeFinalProbeResource, probePlan, canReleaseProbeLock } from '../../../tools/probe-hosted-native.mjs';
const now = 1793394000;
const claims = { iss: 'https://oidc.vercel.com/muhammed-abdelrahman', aud: 'https://vercel.com/muhammed-abdelrahman', sub: 'owner:muhammed-abdelrahman:project:everyone-presentation-worker-pilot:environment:development', owner_id: 'team_gboXPxTevpCOZuaA8eY9PmR1', project_id: 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6', environment: 'development', iat: now, exp: now + 43200 };
const token = (payload = claims, header = { alg: 'RS256', typ: 'JWT', kid: 'synthetic-key' }) => [Buffer.from(JSON.stringify(header)).toString('base64url'), Buffer.from(JSON.stringify(payload)).toString('base64url'), Buffer.alloc(256, 1).toString('base64url')].join('.');
test('only fixed worker native repository digest is admitted before any provider action', () => {
  assert.equal(validateProbeImage('muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:' + 'a'.repeat(64)).length > 64, true);
  for (const image of ['native:latest', 'other/team/native@sha256:' + 'a'.repeat(64), 'muhammed-abdelrahman/everyone-presentation-worker-pilot/daemon.worker@sha256:' + 'a'.repeat(64)]) assert.throws(() => validateProbeImage(image));
});
test('mint response and project claims are closed before publication; token stays out of returned metadata', () => {
  const metadata = validateProjectToken({ token: token() }, now);
  assert.equal(metadata.token_ttl_seconds, 43200); assert(!JSON.stringify(metadata).includes(token()));
  for (const mutation of [{ project_id: 'foreign' }, { owner_id: 'foreign' }, { aud: 'foreign' }, { environment: 'production' }, { exp: now - 1 }, { iat: now - 300 }, { exp: now + 86400 }]) assert.throws(() => validateProjectToken({ token: token({ ...claims, ...mutation }) }, now));
  assert.throws(() => validateProjectToken({ token: token(), access_token: 'PRIVATE_SENTINEL' }, now));
  assert.throws(() => validateProjectToken({ token: token(claims, { alg: 'none' }) }, now));
});
test('boundary and network proof require exact safe fields, complete denials and bounded counters', () => {
  const boundary = { protocol: 'eps-native-boundary-v1', uid: 1000, gid: 1000, capabilities_empty: true, no_new_privileges: true, known_write_denials: 10, checked_paths: 100, writable_outside_tmp: 0 };
  assert.doesNotThrow(() => validateBoundaryProof(boundary));
  for (const patch of [{ uid: 0 }, { writable_outside_tmp: 1 }, { known_write_denials: 9 }, { secret: 'PRIVATE' }]) assert.throws(() => validateBoundaryProof({ ...boundary, ...patch }));
  assert.doesNotThrow(() => validateNetworkProof({ protocol: 'eps-native-network-v1', dns_denied: true, ip_denied: true }));
  assert.throws(() => validateNetworkProof({ protocol: 'eps-native-network-v1', dns_denied: false, ip_denied: true }));
});
test('probe plan is capped and an unknown creation outcome cannot release its ownership lock', () => {
  assert.equal(probePlan('boundary').maximum_vms, 1); assert.equal(probePlan('smoke').maximum_vms, 10);
  assert.throws(() => probePlan('arbitrary'));
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: true }]), true);
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, identity_observed: false, absence_verified: true, snapshot_absence_verified: true }]), false);
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: false }]), false);
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, absence_verified: false }]), false);
});
test('same-repository historical image cannot be mislabeled as the patched reviewed source graph', () => {
  const expected = { source_sha256: '0ddf519a91a23a11904dbd9880f48d24a2d543a8249f9ab267dbab323d6fb297', files: [{ path: 'package.json', sha256: 'a'.repeat(64), bytes: 1 }] };
  assert.doesNotThrow(() => validateImageSourceSeal(structuredClone(expected), expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, source_sha256: '973030386fc0fe2d591bb727a9b77d43a6ee474f5a7eac8ce45918c588ba2516' }, expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, extra: 'PRIVATE_SENTINEL' }, expected));
});
test('SDK command log reads receive the overall abort signal and reject excessive output', async () => {
  const controller = new AbortController(); let received;
  assert.equal(await readBoundedCommandOutput({ stdout: async options => { received = options.signal; return '0\n'; } }, 16, controller.signal), '0\n');
  assert.equal(received, controller.signal);
  await assert.rejects(readBoundedCommandOutput({ stdout: async () => 'x'.repeat(17) }, 16, controller.signal));
});
test('final extant or uncertain observation replaces an earlier absence proof and retains the lock', async () => {
  const signal = new AbortController().signal;
  for (const find of [async () => ({ handle: 'synthetic-existing-resource' }), async () => { throw new Error('synthetic-read-uncertain'); }]) {
    const marker = { name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: true };
    await observeFinalProbeResource(marker, find, async () => {}, signal);
    assert.equal(marker.absence_verified, false); assert.equal(canReleaseProbeLock([marker]), false);
  }
  const marker = { name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: false, snapshot_absence_verified: true };
  await observeFinalProbeResource(marker, async () => null, async () => { throw new Error('snapshot-read-uncertain'); }, signal);
  assert.equal(marker.absence_verified, true); assert.equal(marker.snapshot_absence_verified, false); assert.equal(canReleaseProbeLock([marker]), false);
  await observeFinalProbeResource(marker, async () => null, async () => {}, signal);
  assert.equal(canReleaseProbeLock([marker]), true);
});
