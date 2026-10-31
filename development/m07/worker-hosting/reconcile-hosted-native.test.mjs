import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRetainedRun, absenceComplete, reconcileAbsentRun, validateReconcileEnvironment } from '../../../tools/reconcile-hosted-native.mjs';
const names = ['eps-native-probe-7113cb6d-b93e-4fab-9fc2-329f164717c3','eps-native-42d71299-ca8e-4f33-b93a-1b13003acb5f','eps-native-b95d6bb6-8745-4922-b36b-9554546fdd86'];
const observation = () => ({ gets: names.map(name => ({ name, http_status: 404 })), sandboxes: { http_status: 200, count: 0, row_count: 0, has_more: false }, snapshots: { http_status: 200, count: 0, row_count: 0, has_more: false } });
test('parent debug, injection and TLS overrides cannot precede the credentialed raw GET process', () => {
  assert.doesNotThrow(() => validateReconcileEnvironment({}));
  for (const key of ['NODE_OPTIONS', 'NODE_DEBUG', 'NODE_DEBUG_NATIVE', 'DEBUG', 'NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_EXTRA_CA_CERTS']) assert.throws(() => validateReconcileEnvironment({ [key]: 'SYNTHETIC_PRIVATE' }), error => !error.message.includes('SYNTHETIC_PRIVATE'));
});
test('only complete successful list/snapshot observations and all three exact GET404s prove absence', () => {
  assert(absenceComplete(observation()));
  for (const mutate of [v => v.gets[0].http_status = 403, v => v.gets[0].name = 'other', v => v.snapshots.http_status = 429, v => v.sandboxes.has_more = true, v => v.snapshots.row_count = 1, v => v.snapshots.count = null, v => v.gets.pop(), v => v.private = 'SYNTHETIC_PRIVATE']) {
    const v = observation(); mutate(v); assert.equal(absenceComplete(v), false);
  }
});
test('inspect never unlocks and unknown second observation or source drift never earns unlock', async () => {
  for (const mode of ['inspect', 'unlock']) {
    let reads = 0, unlocked = 0, proofs = 0;
    const io = { observe: async () => { reads++; return observation(); }, verify: async () => {}, persistProof: async () => { proofs++; }, unlock: async () => { unlocked++; } };
    const result = await reconcileAbsentRun(io, mode); assert(result.absence_confirmed); assert.equal(reads, mode === 'unlock' ? 2 : 1); assert.equal(unlocked, mode === 'unlock' ? 1 : 0); assert.equal(proofs, unlocked);
  }
  for (const drift of [false, true]) {
    let reads = 0, unlocked = 0;
    const io = { observe: async () => { reads++; const v = observation(); if (!drift && reads === 2) v.gets[0].http_status = 0; return v; }, verify: async () => { if (drift) throw new Error('SYNTHETIC_PRIVATE'); }, persistProof: async () => {}, unlock: async () => { unlocked++; } };
    await assert.rejects(reconcileAbsentRun(io, 'unlock')); assert.equal(unlocked, 0);
  }
});
test('retained receipt/lock validation rejects unowned or inconsistent session identity', () => {
  assert.throws(() => validateRetainedRun({}, {}));
  const source = 'bc774c88083d106fd522ee6277fc8a81033a6b94ff05e9debdfe1d6ee661a735';
  const image = 'muhammed-abdelrahman/everyone-presentation-worker-pilot/native@sha256:7846b45931a0394eafafdca0d0ae2791b8de74ee9a736fd39534e34134d0d16c';
  const lock = { run_id: '7113cb6d-b93e-4fab-9fc2-329f164717c3', project_id: 'prj_I4SMkDzaDy0KHNgiF00v4Da5aLb6', image, source_sha256: source };
  const sessions = ['sbx_88Yak4vD9nmjh83gKxNi3WtM4LnB', 'sbx_BH8xAb4GvGW6lC6m3MhlCSvc2ST3', 'sbx_LOl50Ixc274kdMHdYoUmMq7fiaKz'];
  const receipt = { ...lock, team_id: 'team_gboXPxTevpCOZuaA8eY9PmR1', result: 'unconfirmed', cleanup_confirmed: false, lock_released: false, initial_current_cleanup_sessions_equal: true,
    resources: names.map((name,i) => ({ name, attempted: true, identity_observed: true, session_id: sessions[i], initial_session_id: sessions[i], current_session_id: sessions[i], cleanup_session_id: sessions[i], initial_current_cleanup_session_equal: true, session_consistency_failed: false, absence_verified: false, snapshot_absence_verified: false })) };
  assert(validateRetainedRun(receipt,lock));
  for (const mutate of [v => v.resources[1].current_session_id = sessions[0], v => v.resources[2].session_consistency_failed = true, v => v.resources[0].name = 'other-owned-run', v => v.resources[0].extra = 'SYNTHETIC_PRIVATE']) {
    const bad = structuredClone(receipt); mutate(bad); assert.throws(() => validateRetainedRun(bad,lock));
  }
});
