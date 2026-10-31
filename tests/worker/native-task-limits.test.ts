import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { NATIVE_TASKS } from '../../apps/worker/src/native-sandbox.ts';
// @ts-expect-error reviewed image-only ESM has no generated declaration
import { NATIVE_TASK_PROCESS_LIMITS, nativeTaskProcessLimit, NATIVE_TASK_FILE_SIZE_LIMITS, nativeTaskFileSizeLimit, readBoundedNativeOutput } from '../../apps/worker/src/native-task-limits.mjs';

test('only the five configured Chromium families receive bounded256 thread/process capacity', () => {
  const browser = ['review_fit', 'presentation_render', 'presentation_validate', 'presentation_export_render', 'presentation_export_validate'];
  assert.deepEqual(Object.keys(NATIVE_TASK_PROCESS_LIMITS).sort(), Object.keys(NATIVE_TASKS).sort());
  for (const task of Object.keys(NATIVE_TASKS)) assert.equal(nativeTaskProcessLimit(task), browser.includes(task) ? 256 : 64, task);
  assert(Object.isFrozen(NATIVE_TASK_PROCESS_LIMITS));
  for (const invalid of [undefined, null, '', 'init', 'review-fit', 'constructor', '__proto__', 'presentation_unknown', {}, new String('review_fit')]) assert.throws(() => nativeTaskProcessLimit(invalid));
});
test('supervisor selects the closed per-task capacity and retains its64 boundary limit and all other rlimits', async () => {
  const source = await readFile(new URL('../../apps/worker/src/native-sandbox-launch.mjs', import.meta.url), 'utf8');
  assert(source.includes("import { nativeTaskProcessLimit, nativeTaskFileSizeLimit, readBoundedNativeOutput } from './native-task-limits.mjs'"));
  assert(source.includes('`--nproc=${nativeTaskProcessLimit(task)}`'));
  assert(source.includes("['--cpu=20', '--nproc=64', '--nofile=256', '--core=0'"));
  assert(source.includes('`--fsize=${nativeTaskFileSizeLimit(task)}`') && source.includes('`--cpu=${seconds}`'));
  assert(source.includes("'--nofile=256'") && source.includes("'--core=0'") && source.includes('...nativePrivilegeArguments()'));
});
test('Chromium file capacity is96MiB independently of unchanged small protocol outputs; parsers retain prior limits', () => {
  const expectedMiB = { document: 24, video: 64, pdf_raster: 64, review_fit: 96, presentation_render: 96, presentation_validate: 96, presentation_export_render: 96, presentation_export_validate: 96 };
  assert.deepEqual(Object.keys(NATIVE_TASK_FILE_SIZE_LIMITS).sort(), Object.keys(NATIVE_TASKS).sort());
  for (const [task, expected] of Object.entries(expectedMiB)) assert.equal(nativeTaskFileSizeLimit(task), expected * 1024 ** 2, task);
  for (const task of ['review_fit', 'presentation_validate', 'presentation_export_validate']) {
    assert.equal(NATIVE_TASKS[task as keyof typeof NATIVE_TASKS].output, 4 * 1024 ** 2);assert(nativeTaskFileSizeLimit(task) > NATIVE_TASKS[task as keyof typeof NATIVE_TASKS].output);
  }
  assert(Object.isFrozen(NATIVE_TASK_FILE_SIZE_LIMITS));
  for (const invalid of [undefined, null, '', 'init', 'constructor', '__proto__', 'review-fit', {}, new String('review_fit')]) assert.throws(() => nativeTaskFileSizeLimit(invalid));
});
test('supervisor still refuses a4MiB protocol overflow before reading it despite96MiB browser file capacity', async () => {
  const source = await readFile(new URL('../../apps/worker/src/native-sandbox-launch.mjs', import.meta.url), 'utf8');
  const declaration = source.match(/const limits = (\{[^;]+\});/u);assert(declaration);
  const actual = JSON.parse(declaration[1].replace(/([a-z_]+):/gu, '"$1":')) as Record<string, number[]>;
  for (const task of ['review_fit', 'presentation_validate', 'presentation_export_validate']) assert.equal(actual[task][1], 4);
  for (const task of Object.keys(NATIVE_TASKS)) assert.equal(actual[task][1] * 1024 ** 2, NATIVE_TASKS[task as keyof typeof NATIVE_TASKS].output);
  const postcondition = source.indexOf('result.size > outputMiB * 1024 ** 2');const read = source.indexOf('await readBoundedNativeOutput');const actualBytes = source.indexOf('bytes.length > outputMiB * 1024 ** 2');const receipt = source.indexOf("await writeFile(ROOT + '/receipt.json'");
  assert(postcondition >= 0 && postcondition < read && read < actualBytes && actualBytes < receipt);assert(!source.includes("await readFile(ROOT + '/output.json')"));assert(!source.includes('`--fsize=${outputMiB * 1024 ** 2}`'));
});
test('an inherited output descriptor growing past4MiB cannot force an unbounded root read', async () => {
  const maximum = 4 * 1024 ** 2;let requested = 0;
  const growing = { read: async (buffer: Buffer, offset: number, length: number, position: number) => {
    assert.equal(buffer.length, maximum + 1);assert.equal(offset, 0);assert.equal(position, 0);requested += length;assert.equal(requested, maximum + 1);
    return { bytesRead: length };
  } };
  await assert.rejects(readBoundedNativeOutput(growing, maximum));assert.equal(requested, maximum + 1);
});
test('bounded output reads handle short reads, reject empty/invalid reads and never exceed the fixed maximum', async () => {
  const expected = Buffer.from('synthetic protocol');let calls = 0;
  const file = { read: async (buffer: Buffer, offset: number, length: number, position: number) => {
    calls++;const count = Math.min(3, expected.length - position, length);expected.copy(buffer, offset, position, position + count);return { bytesRead: count };
  } };
  assert.deepEqual(await readBoundedNativeOutput(file, 4 * 1024 ** 2), expected);assert(calls > 1);
  for (const bytesRead of [0, -1, 4 * 1024 ** 2 + 2, 1.5, '1']) await assert.rejects(readBoundedNativeOutput({ read: async () => ({ bytesRead }) }, 4 * 1024 ** 2));
  for (const maximum of [0, -1, 96 * 1024 ** 2 + 1, 1.5]) await assert.rejects(readBoundedNativeOutput({ read: async () => { throw Error('must not read'); } }, maximum));
});
