import test from 'node:test';
import assert from 'node:assert/strict';
import { chromiumDiagnosticProgram, chromiumDiagnosticChildProgram, classifyChromiumDiagnosticError, validateChromiumDiagnostic } from './native-chromium-diagnostic.mjs';

test('Chromium error projection identifies bounded resource causes without exposing messages', () => {
  const flags = classifyChromiumDiagnosticError(new Error('SYNTHETIC_PRIVATE pthread_create: Resource temporarily unavailable; File size limit exceeded'));
  assert.equal(flags.resource_exhausted, true); assert.equal(flags.file_size_limit, true);
  assert(!JSON.stringify(flags).includes('SYNTHETIC_PRIVATE'));
  assert.equal(classifyChromiumDiagnosticError(new Error('chrome_crashpad_handler: --database is required')).crashpad_database, true);
  assert.equal(classifyChromiumDiagnosticError(new Error('SYNTHETIC_PRIVATE')).unknown, true);
});
test('diagnostic program retains the failed task limits and exact native identity without input or provider access', () => {
  const program = chromiumDiagnosticProgram();
  for (const value of ['--cpu=90', '--nproc=64', '--nofile=256', '--fsize=4194304', '--reuid=65432', '--regid=65432', '--no-new-privs', '--import', 'tsx', '--max-old-space-size=512', 'measureReviewFit', 'nativeBrowserEnvironment']) assert(program.includes(value), value);
  assert(!program.includes('--nproc=128')); assert(!program.includes('process.env)'));
  assert(program.includes("timeout: 90000, killSignal: 'SIGKILL'"));
  new Function(program); new Function(chromiumDiagnosticChildProgram());
});
test('only a closed diagnostic projection can leave the VM', () => {
  for (const value of [{ protocol: 'eps-native-chromium-deep-v1', secret: 'SYNTHETIC_PRIVATE' }, null, []]) assert.throws(() => validateChromiumDiagnostic(value));
});
test('valid launch failure flags are retained, while raw errors and impossible successful proofs are denied', () => {
  const error_flags = classifyChromiumDiagnosticError(new Error('pthread_create EAGAIN SYNTHETIC_PRIVATE'));
  const resource = { native_processes: 1, native_threads: 12, proc_entries_examined: 4, proc_scan_truncated: false, tmp_total_bytes: 384 * 1024 ** 2, tmp_free_bytes: 380 * 1024 ** 2 };
  const value = { protocol: 'eps-native-chromium-deep-v1', spawn: { exit_code: 0, signal: null, error_code: null }, stderr_flags: classifyChromiumDiagnosticError(null), child: {
    protocol: 'eps-native-chromium-child-v1', uid: 65432, gid: 65432, cap_effective: '0'.repeat(16), cap_bounding: '0'.repeat(16), no_new_privileges: true, identity_gate_passed: true,
    limits: { cpu_seconds: 90, processes: 64, open_files: 256, file_bytes: 4194304 }, before: resource, after: structuredClone(resource),
    stages: ['fit_import', 'browser_launch', 'browser_context', 'browser_page', 'browser_content', 'browser_fonts', 'browser_measurement', 'fit_result'].map(stage => ({ stage, result: stage === 'fit_import' ? 'passed' : ['browser_launch', 'fit_result'].includes(stage) ? 'failed' : 'not_attempted' })),
    first_failure: 'browser_launch', error_flags, fit_error_code: 'FIT_MEASUREMENT_FAILED', fit_verified: false, overflow_count: null, chromium_version: null, browser_environment_keys: ['LANG', 'PATH'] } };
  assert.deepEqual(validateChromiumDiagnostic(value), value); assert(!JSON.stringify(value).includes('SYNTHETIC_PRIVATE'));
  for (const mutate of [v => v.child.stderr = 'SYNTHETIC_PRIVATE', v => v.child.error_flags.resource_exhausted = 'SYNTHETIC_PRIVATE', v => v.child.fit_verified = true,
    v => v.child.browser_environment_keys.push('VERCEL_OIDC_TOKEN'), v => v.child.limits.processes = 128, v => v.child.before.tmp_total_bytes = 512 * 1024 ** 2]) {
    const bad = structuredClone(value); mutate(bad); assert.throws(() => validateChromiumDiagnostic(bad));
  }
});
