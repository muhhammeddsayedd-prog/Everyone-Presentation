import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { diagnosticProgram, diagnosticSetupProgram, validateInitDiagnostic, validateInitSetupDiagnostic, DIAGNOSTIC_PATHS, DIAGNOSTIC_STEPS } from './native-init-diagnostic.mjs';
function fixture(failed = 'mount_work') {
  let blocked = false;
  return { protocol: 'eps-native-init-diagnostic-v1', root: { uid: 0, gid: 0, cap_effective: '0000000000000000', cap_bounding: '0000000000000000', no_new_privileges: false, status_error_code: null },
    paths_before: DIAGNOSTIC_PATHS.map(path => ({ path, exists: false, error_code: 'ENOENT', is_directory: null, is_symlink: null, uid: null, gid: null, mode: null, size_bytes: null, fs_type: null, fs_bytes: null, fs_error_code: null })),
    paths_after: DIAGNOSTIC_PATHS.map(path => ({ path, exists: false, error_code: 'ENOENT', is_directory: null, is_symlink: null, uid: null, gid: null, mode: null, size_bytes: null, fs_type: null, fs_bytes: null, fs_error_code: null })),
    steps: DIAGNOSTIC_STEPS.map(step => { const result = blocked ? 'skipped' : step === failed ? 'failed' : 'passed'; if (step === failed) blocked = true;
      return { step, result, error_code: result === 'failed' ? 'EPERM' : result === 'skipped' ? 'PREVIOUS_FAILURE' : null, exit_code: step === failed ? 32 : null, signal: null }; }),
    first_failed_step: failed, exact_sequence_completed: failed === null, boundary_proof: null };
}
test('closed failure metadata identifies the exact INIT step without treating diagnosis as boundary acceptance', () => {
  const value = fixture(); const original = structuredClone(value);
  assert.deepEqual(validateInitDiagnostic(value), original); assert.equal(value.first_failed_step, 'mount_work');
});
test('arbitrary stderr/env keys, paths, status strings and false sequence claims are rejected', () => {
  for (const mutate of [v => v.stderr = 'SYNTHETIC_PRIVATE', v => v.root.env = 'SYNTHETIC_PRIVATE',
    v => v.paths_before[0].path = '/proc/self/environ', v => v.steps[0].error_code = 'SYNTHETIC_PRIVATE',
    v => v.first_failed_step = 'source_verify', v => v.exact_sequence_completed = true,
    v => v.steps.at(-1).result = 'passed', v => v.root.cap_effective = 'SYNTHETIC_PRIVATE']) {
    const value = fixture(); mutate(value); assert.throws(() => validateInitDiagnostic(value));
  }
});
test('fixed program is bounded, credential-free and preserves original INIT mutation ordering', () => {
  const source = diagnosticProgram(); assert(source.length < 24000);
  assert.doesNotThrow(() => new Script(source)); // Parse only; never execute VM operations locally.
  assert(source.indexOf("'mkdir_work'") < source.indexOf("'mount_work'"));
  assert(source.includes("stdio: ['ignore', 'pipe', 'pipe']") && source.includes('timeout: 10000'));
  assert(!source.includes('process.env') && !source.includes('/proc/self/environ') && !source.includes('fetch('));
  assert(source.includes("await mkdir('/eps-work', { mode: 0o700 })"));
  assert(source.includes('"native_uid":65432') && source.includes('"native_gid":65432') && source.includes('--reuid=65432') && source.includes('--regid=65432'));
  assert(source.includes('5f9114a20cfa195282b53a89b3e3614e706f16fb1e4ed986d477e451086c5558'));
  assert(!source.includes('--reuid=1000') && !source.includes('0ddf519a91a23a11904dbd9880f48d24a2d543a8249f9ab267dbab323d6fb297'));
});
test('setup-only repeats scratch setup but cannot claim the skipped original boundary executed', () => {
  const value = fixture(null); value.protocol = 'eps-native-init-setup-v1';
  for (const step of value.steps.slice(-2)) Object.assign(step, { result: 'skipped', error_code: 'SETUP_ONLY' });
  assert.deepEqual(validateInitSetupDiagnostic(value), value);
  assert.throws(() => validateInitDiagnostic(value));
  const source = diagnosticSetupProgram(); assert(source.includes('"setupOnly":true')); assert.doesNotThrow(() => new Script(source));
});
