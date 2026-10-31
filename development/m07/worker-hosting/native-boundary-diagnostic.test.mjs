import test from 'node:test';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
import { boundaryDiagnosticProgram, validateBoundaryDiagnostic, DENIAL_PATHS } from './native-boundary-diagnostic.mjs';
function fixture(category = 'UID_OWNED') {
  return { protocol: 'eps-native-boundary-deep-v1', node_started: true, counted_uid: 65432, visible_native_processes: 2, visible_native_threads: 12, proc_entries_examined: 7, proc_scan_truncated: false,
    spawn: { exit_code: 0, signal: null, error_code: null, stderr_code: null },
    child: { protocol: 'eps-native-boundary-child-v1', runtime_started: true, uid: 65432, gid: 65432, cap_effective: '0000000000000000', cap_bounding: '0000000000000000', no_new_privileges: true,
      identity_gate_passed: true, audit_attempted: true, audit_passed: false, checked_paths: null, writable_outside_tmp: null,
      first_failure: 'filesystem_audit', first_problem: { path: '/var/SYNTHETIC', category, uid: 65432, gid: 65432, mode: 493, error_code: null },
      denials: DENIAL_PATHS.map(path => ({ path, result: 'not_attempted', error_code: null })), known_write_denials: 0 } };
}
test('first filesystem cause is closed safe metadata and never full file contents', () => {
  const v = fixture(); assert.deepEqual(validateBoundaryDiagnostic(v), v);
  assert.equal(v.child.first_problem.category, 'UID_OWNED');
});
test('strict OS paths, closed keys, known categories and UID/capability gates reject unsafe or contradictory results', () => {
  for (const mutate of [v => v.stderr = 'SYNTHETIC_PRIVATE', v => v.child.env = 'SYNTHETIC_PRIVATE',
    v => v.child.first_problem.path = '/bad\nPRIVATE', v => v.child.first_problem.category = 'PRIVATE',
    v => v.child.uid = 0, v => v.child.uid = 1000, v => v.counted_uid = 1000, v => v.child.first_problem.uid = 1000,
    v => v.child.cap_effective = 'ffffffffffffffff', v => v.child.first_failure = null,
    v => v.child.denials[0].path = '/proc/self/environ']) {
    const v = fixture(); mutate(v); assert.throws(() => validateBoundaryDiagnostic(v));
  }
});
test('Node startup failure remains separate from a child gate/audit failure', () => {
  const v = fixture(); v.child = null; v.node_started = false; v.spawn = { exit_code: 1, signal: null, error_code: null, stderr_code: 'EAGAIN' };
  assert.deepEqual(validateBoundaryDiagnostic(v), v);
});
test('generated program parses without execution and pins original privilege limits and exported audit', () => {
  const source = boundaryDiagnosticProgram(); assert(source.length < 30000); assert.doesNotThrow(() => new Script(source));
  for (const token of ['--cpu=20', '--nproc=64', '--nofile=256', '--core=0', '--reuid=65432', '--regid=65432', '--clear-groups', '--inh-caps=-all', '--bounding-set=-all', '--no-new-privs', 'auditNativeFilesystem']) assert(source.includes(token));
  assert(!source.includes('process.env') && !source.includes('/proc/self/environ') && !source.includes('fetch('));
});
