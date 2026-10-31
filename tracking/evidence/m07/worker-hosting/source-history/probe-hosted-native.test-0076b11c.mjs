import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProbeImage, validateProjectToken, validateBoundaryProof, validateNetworkProof, validateImageSourceSeal, readBoundedCommandOutput, observeFinalProbeResource, probePlan, canReleaseProbeLock, recordProbeSession, stableProbeSession, probeOwnership, SDK_TRANSPORT_POLICY, probeTransportObservation } from '../../../tools/probe-hosted-native.mjs';
import { NATIVE_PROBE_RELEASE, nativeProbePrivilegeArguments } from './native-probe-release.mjs';
import { nativePrivilegeArguments } from '../../../apps/worker/src/native-identity.mjs';
const now = 1793394000;
const claims = { iss: 'https://oidc.vercel.com/muhammed-abdelrahman', aud: 'https://vercel.com/muhammed-abdelrahman', sub: 'owner:muhammed-abdelrahman:project:everyone-presentation-worker-pilot:environment:development', owner_id: 'team_gboXPxTevpCOZuaA8eY9PmR1', project_id: 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6', environment: 'development', iat: now, exp: now + 43200 };
const token = (payload = claims, header = { alg: 'RS256', typ: 'JWT', kid: 'synthetic-key' }) => [Buffer.from(JSON.stringify(header)).toString('base64url'), Buffer.from(JSON.stringify(payload)).toString('base64url'), Buffer.alloc(256, 1).toString('base64url')].join('.');

test('transport telemetry closes endpoint/method/phase/error metadata and excludes URLs, headers and private messages', () => {
  const row = probeTransportObservation('https://vercel.com/api/v2/sandboxes/eps-native-SYNTHETIC_PRIVATE?token=SYNTHETIC_PRIVATE', 'DELETE', 429, 5, 'boundary_cleanup');
  assert.deepEqual(row, { endpoint_class: 'named_sandbox', method: 'DELETE', http_status: 429, elapsed_ms: 5, phase: 'boundary_cleanup', network_error_name: null, network_error_code: null });
  const failed = probeTransportObservation('https://vercel.com/api/v2/sandboxes/sessions/private/fs/read', 'GET', 0, 30000, 'SYNTHETIC_PRIVATE', { name: 'TypeError', message: 'SYNTHETIC_PRIVATE', cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
  assert.equal(failed.endpoint_class, 'session_files'); assert.equal(failed.phase, 'other_phase'); assert.equal(failed.network_error_code, 'UND_ERR_CONNECT_TIMEOUT');
  assert(!JSON.stringify([row, failed]).includes('SYNTHETIC_PRIVATE'));
  const unknown = probeTransportObservation('not-a-url-SYNTHETIC_PRIVATE', 'SYNTHETIC_PRIVATE', -1, Infinity, 'SYNTHETIC_PRIVATE', { name: 'SYNTHETIC_PRIVATE', code: 'SYNTHETIC_PRIVATE' });
  assert.equal(unknown.method, 'OTHER'); assert.equal(unknown.http_status, 0); assert.equal(unknown.elapsed_ms, null); assert.equal(unknown.network_error_name, 'OTHER'); assert.equal(unknown.network_error_code, 'OTHER');
});
test('only fixed worker native repository digest is admitted before any provider action', () => {
  assert.equal(validateProbeImage('muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:' + 'a'.repeat(64)).length > 64, true);
  for (const image of ['native:latest', 'other/team/native@sha256:' + 'a'.repeat(64), 'muhammed-abdelrahman/everyone-presentation-worker-pilot/daemon.worker@sha256:' + 'a'.repeat(64)]) assert.throws(() => validateProbeImage(image));
});
test('current probe release fixes one152-record graph and shares the dedicated native identity arguments', () => {
  assert.equal(NATIVE_PROBE_RELEASE.source_sha256, 'bc774c88083d106fd522ee6277fc8a81033a6b94ff05e9debdfe1d6ee661a735');
  assert.equal(NATIVE_PROBE_RELEASE.context_relative, '.local/worker-hosting/7b5324c8-f3a1-4a61-996f-8d69c93a7180/context');
  assert.equal(NATIVE_PROBE_RELEASE.file_count, 152); assert.equal(NATIVE_PROBE_RELEASE.native_uid, 65432); assert.equal(NATIVE_PROBE_RELEASE.native_gid, 65432);
  assert.equal(NATIVE_PROBE_RELEASE.native_identity_sha256, 'f3b55692bdc48ab05b108915692509d124f50ea4d32153ebf39d87f0ff5d3aa0');
  assert.equal(NATIVE_PROBE_RELEASE.native_task_limits_sha256, '6e68287b3005059d9a0ce860dc90f46342bb24819cd8e7bf6bff7cbecf7215e4');
  assert.equal(NATIVE_PROBE_RELEASE.diagnostic_modes_enabled, false);
  assert.deepEqual(nativeProbePrivilegeArguments(), nativePrivilegeArguments()); assert(Object.isFrozen(NATIVE_PROBE_RELEASE));
});
test('mint response and project claims are closed before publication; token stays out of returned metadata', () => {
  const metadata = validateProjectToken({ token: token() }, now);
  assert.equal(metadata.token_ttl_seconds, 43200); assert(!JSON.stringify(metadata).includes(token()));
  for (const mutation of [{ project_id: 'foreign' }, { owner_id: 'foreign' }, { aud: 'foreign' }, { environment: 'production' }, { exp: now - 1 }, { iat: now - 300 }, { exp: now + 86400 }]) assert.throws(() => validateProjectToken({ token: token({ ...claims, ...mutation }) }, now));
  assert.throws(() => validateProjectToken({ token: token(), access_token: 'PRIVATE_SENTINEL' }, now));
  assert.throws(() => validateProjectToken({ token: token(claims, { alg: 'none' }) }, now));
});
test('boundary and network proof require exact safe fields, complete denials and bounded counters', () => {
  const boundary = { protocol: 'eps-native-boundary-v1', uid: 65432, gid: 65432, capabilities_empty: true, no_new_privileges: true, known_write_denials: 10, checked_paths: 100, writable_outside_tmp: 0 };
  assert.doesNotThrow(() => validateBoundaryProof(boundary));
  for (const patch of [{ uid: 0 }, { uid: 1000, gid: 1000 }, { writable_outside_tmp: 1 }, { known_write_denials: 9 }, { secret: 'PRIVATE' }]) assert.throws(() => validateBoundaryProof({ ...boundary, ...patch }));
  assert.doesNotThrow(() => validateNetworkProof({ protocol: 'eps-native-network-v1', dns_denied: true, ip_denied: true }));
  assert.throws(() => validateNetworkProof({ protocol: 'eps-native-network-v1', dns_denied: false, ip_denied: true }));
});
test('probe plan is capped and an unknown creation outcome cannot release its ownership lock', () => {
  assert.equal(probePlan('boundary').maximum_named_resources, 1); assert.equal(probePlan('smoke').maximum_named_resources, 10);
  for (const historical of ['diagnose', 'diagnose-boundary', 'diagnose-chromium']) assert.throws(() => probePlan(historical));
  assert.equal(Object.hasOwn(probePlan('boundary'), 'maximum_vms'), false);
  assert.throws(() => probePlan('arbitrary'));
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: true }]), true);
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, identity_observed: false, absence_verified: true, snapshot_absence_verified: true }]), false);
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: false }]), false);
  assert.equal(canReleaseProbeLock([{ name: 'eps-native-synthetic', attempted: true, absence_verified: false }]), false);
});
test('SDK qualification separates named-resource retries from no-retry commands and forbids VM-count credit', () => {
  assert.equal(SDK_TRANSPORT_POLICY.sdk_default_retries_maximum, 2);
  assert.equal(SDK_TRANSPORT_POLICY.sdk_default_retry_loop_attempts_maximum, 3);
  assert.equal(SDK_TRANSPORT_POLICY.non_detached_command_http_retries, 0);
  assert.equal(SDK_TRANSPORT_POLICY.sandbox_auto_resume_possible, true);
  assert.equal(SDK_TRANSPORT_POLICY.exact_wire_or_vm_count_proven, false);
});
test('LIST identity cannot mask a changed active SDK GET/operation session or release its later absent resource', () => {
  const source = 'bc774c88083d106fd522ee6277fc8a81033a6b94ff05e9debdfe1d6ee661a735';
  const marker = { name: 'eps-native-synthetic', image: 'SYNTHETIC_IMAGE', tags: { owner: 'eps-native', run: 'SYNTHETIC_RUN', source },
    session_id: 'session_SYNTHETIC_INITIAL', initial_session_id: 'session_SYNTHETIC_INITIAL', cleanup_session_id: 'session_SYNTHETIC_INITIAL',
    attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: true, session_consistency_failed: false };
  const handle = { name: marker.name, image: marker.image, tags: marker.tags, persistent: false, networkPolicy: 'deny-all', region: 'dub1',
    vcpus: 1, memory: 2048, failoverRegions: [], mounts: {}, routes: [], currentSession: () => ({ sessionId: 'session_SYNTHETIC_CHANGED' }) };
  assert.throws(() => probeOwnership(handle, marker, true));
  assert.equal(marker.session_consistency_failed, true);
  handle.currentSession = () => ({ sessionId: 'session_SYNTHETIC_INITIAL' });
  probeOwnership(handle, marker, true);
  assert.equal(stableProbeSession(marker), false);
  assert.equal(canReleaseProbeLock([marker]), false);
});
test('current and cleanup sessions must equal the successful creation session; drift never overwrites its evidence', () => {
  const marker = { session_id: null, initial_session_id: null, cleanup_session_id: null };
  assert.equal(stableProbeSession(marker), false);
  recordProbeSession(marker, 'session_SYNTHETIC_INITIAL', 'created');
  recordProbeSession(marker, 'session_SYNTHETIC_INITIAL', 'cleanup');
  assert.equal(stableProbeSession(marker), true);
  const original = structuredClone(marker);
  assert.throws(() => recordProbeSession(marker, 'session_SYNTHETIC_RESUMED', 'cleanup'));
  assert.equal(stableProbeSession(marker), false);
  assert.equal(marker.initial_session_id, original.initial_session_id);
  assert.equal(marker.cleanup_session_id, original.cleanup_session_id);
  recordProbeSession(marker, 'session_SYNTHETIC_INITIAL', 'cleanup');
  assert.equal(stableProbeSession(marker), false);
  assert.equal(canReleaseProbeLock([{ ...marker, name: 'eps-native-synthetic', attempted: true, identity_observed: true, absence_verified: true, snapshot_absence_verified: true }]), false);
  assert.throws(() => recordProbeSession(marker, 'session_SYNTHETIC_RESUMED', 'created'));
  const unknown = { session_id: null, initial_session_id: null, cleanup_session_id: null };
  recordProbeSession(unknown, 'session_SYNTHETIC_DISCOVERED', 'cleanup');
  assert.equal(stableProbeSession(unknown), false);
});
test('same-repository historical image cannot be mislabeled as the patched reviewed source graph', () => {
  const expected = { source_sha256: 'bc774c88083d106fd522ee6277fc8a81033a6b94ff05e9debdfe1d6ee661a735', files: [{ path: 'package.json', sha256: 'a'.repeat(64), bytes: 1 }] };
  assert.doesNotThrow(() => validateImageSourceSeal(structuredClone(expected), expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, source_sha256: '973030386fc0fe2d591bb727a9b77d43a6ee474f5a7eac8ce45918c588ba2516' }, expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, source_sha256: '0ddf519a91a23a11904dbd9880f48d24a2d543a8249f9ab267dbab323d6fb297' }, expected));
  assert.throws(() => validateImageSourceSeal({ ...expected, source_sha256: '5f9114a20cfa195282b53a89b3e3614e706f16fb1e4ed986d477e451086c5558' }, expected));
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
