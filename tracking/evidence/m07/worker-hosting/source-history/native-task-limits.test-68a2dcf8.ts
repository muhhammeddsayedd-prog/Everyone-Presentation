import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NATIVE_TASKS } from '../../apps/worker/src/native-sandbox.ts';
// @ts-expect-error reviewed image-only ESM has no generated declaration
import { NATIVE_TASK_PROCESS_LIMITS, nativeTaskProcessLimit } from '../../apps/worker/src/native-task-limits.mjs';

test('only the five configured Chromium families receive bounded256 thread/process capacity', () => {
  const browser = ['review_fit', 'presentation_render', 'presentation_validate', 'presentation_export_render', 'presentation_export_validate'];
  assert.deepEqual(Object.keys(NATIVE_TASK_PROCESS_LIMITS).sort(), Object.keys(NATIVE_TASKS).sort());
  for (const task of Object.keys(NATIVE_TASKS)) assert.equal(nativeTaskProcessLimit(task), browser.includes(task) ? 256 : 64, task);
  assert(Object.isFrozen(NATIVE_TASK_PROCESS_LIMITS));
  for (const invalid of [undefined, null, '', 'init', 'review-fit', 'constructor', '__proto__', 'presentation_unknown', {}, new String('review_fit')]) assert.throws(() => nativeTaskProcessLimit(invalid));
});
test('supervisor selects the closed per-task capacity and retains its64 boundary limit and all other rlimits', async () => {
  const source = await readFile(new URL('../../apps/worker/src/native-sandbox-launch.mjs', import.meta.url), 'utf8');
  assert(source.includes("import { nativeTaskProcessLimit } from './native-task-limits.mjs'"));
  assert(source.includes('`--nproc=${nativeTaskProcessLimit(task)}`'));
  assert(source.includes("['--cpu=20', '--nproc=64', '--nofile=256', '--core=0'"));
  assert(source.includes('`--fsize=${outputMiB * 1024 ** 2}`') && source.includes('`--cpu=${seconds}`'));
  assert(source.includes("'--nofile=256'") && source.includes("'--core=0'") && source.includes('...nativePrivilegeArguments()'));
});
