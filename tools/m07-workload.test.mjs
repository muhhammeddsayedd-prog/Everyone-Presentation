import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createWorkloadState, runBoundedWorkload, summarizeWorkload, resumeWorkload } from './m07-workload.mjs';
const descriptors = count => Array.from({ length: count }, (_, index) => ({ id: `file-${index}`, file: `${index}.mp4`, sha256: 'a'.repeat(64), size_bytes: index + 1, mime_type: 'video/mp4', mode: 'probe' }));
const state = count => createWorkloadState('07000000-0000-4000-8000-000000000001', descriptors(count), 1000);
test('bounded scheduling applies backpressure and admits at most two native tasks', async () => {
  const value = state(8); let active = 0, peak = 0;
  await runBoundedWorkload(value, async () => { active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 5)); active--; return { native_called: true }; }, { concurrency: 2, deadline_ms: Date.now() + 1000 });
  assert.equal(peak, 2); assert.equal(value.items.filter(item => item.status === 'succeeded').length, 8);
  assert.equal(summarizeWorkload(value).peak_inflight, 2);
  await assert.rejects(runBoundedWorkload(state(1), async () => ({}), { concurrency: 3, deadline_ms: Date.now() + 1000 }), /WORKLOAD_CONFIGURATION_INVALID/);
});
test('a partial failure does not block usable files and retry budget is bounded', async () => {
  const value = state(3);
  await runBoundedWorkload(value, async item => { if (item.id === 'file-1') throw { code: 'VIDEO_CONTAINER_UNAVAILABLE', retryable: true, message: 'private input' }; return { native_called: true }; }, { concurrency: 2, deadline_ms: Date.now() + 1000, maximum_attempts: 2 });
  assert.deepEqual(value.items.map(item => item.status), ['succeeded', 'failed', 'succeeded']);
  assert.equal(value.items[1].attempts.length, 2); assert.equal(summarizeWorkload(value).retries, 1);
  assert(!JSON.stringify(value).includes('private input'));
});
test('unknown outcomes stop automatic retry even when a caller marks them retryable', async () => {
  const value = state(1);
  await runBoundedWorkload(value, async () => { throw { code: 'VIDEO_CONTAINER_UNAVAILABLE', retryable: true, outcome: 'unknown' }; }, { concurrency: 1, deadline_ms: Date.now() + 1000 });
  assert.equal(value.items[0].status, 'unconfirmed'); assert.equal(value.items[0].attempts.length, 1);
});
test('drained checkpoint restart resumes only incomplete files without replaying completed work', async () => {
  const value = state(5); const calls = [];
  await runBoundedWorkload(value, async item => { calls.push(item.id); return {}; }, { concurrency: 2, maximum_items: 2, deadline_ms: Date.now() + 1000 });
  const resumed = resumeWorkload(JSON.parse(JSON.stringify(value)));
  await runBoundedWorkload(resumed, async item => { calls.push(item.id); return {}; }, { concurrency: 2, deadline_ms: Date.now() + 1000 });
  assert.equal(calls.length, 5); assert.equal(new Set(calls).size, 5); assert.equal(resumed.restarts, 1);
});
test('a running checkpoint is uncertain after restart and cannot silently replay', async () => {
  const value = state(2); value.items[0].status = 'running';
  const resumed = resumeWorkload(value); assert.equal(resumed.items[0].status, 'unconfirmed');
  let calls = 0; await runBoundedWorkload(resumed, async () => { calls++; return {}; }, { concurrency: 1, deadline_ms: Date.now() + 1000 }); assert.equal(calls, 1);
});
test('deadline prevents new admission and preserves the unstarted backlog', async () => {
  const value = state(4); let calls = 0;
  await runBoundedWorkload(value, async () => { calls++; return {}; }, { concurrency: 2, deadline_ms: Date.now() - 1 });
  assert.equal(calls, 0); assert.equal(summarizeWorkload(value).pending, 4);
});
test('quantiles, bytes and diagnostic codes are safe metadata with exact accounting', async () => {
  const value = state(2); let now = 1000;
  await runBoundedWorkload(value, async item => { now += item.id === 'file-0' ? 10 : 30; if (item.id === 'file-1') throw { code: 'private-secret-error', retryable: false }; return { native_called: true, transcript: 'private transcript ignored' }; }, { concurrency: 1, deadline_ms: 5000, now: () => now });
  const summary = summarizeWorkload(value); assert.equal(summary.total_input_bytes, 3); assert.equal(summary.duration_ms.p50, 10); assert.equal(summary.duration_ms.p95, 30);
  assert.equal(value.items[1].attempts[0].code, 'WORKLOAD_OPERATION_UNCONFIRMED'); assert(!JSON.stringify(value).includes('private'));
});
