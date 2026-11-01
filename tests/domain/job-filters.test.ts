import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '../../packages/domain/src/types.ts';
import { parseJobListOptions } from '../../packages/domain/src/job-filters.ts';

const batch = 'b8380001-0000-4000-8000-000000000001';
const invalid = (error: unknown) => error instanceof DomainError && error.code === 'INVALID_REQUEST' && error.status === 400;

test('job batch grouping is an optional UUID filter; existing bounded filters remain unchanged', () => {
  const input = { workspace_id: 'existing-workspace', status: 'failed' as const, cursor: 'existing-job-cursor', limit: 1, batch_id: batch };
  assert.deepEqual(parseJobListOptions(input), input);
  assert.notEqual(parseJobListOptions(input), input);
  assert.deepEqual(parseJobListOptions({}), {});
  assert.deepEqual(parseJobListOptions({ workspace_id: undefined, batch_id: undefined }), {});
});

test('closed job filters reject malformed batch UUIDs and unsafe objects before any provider', () => {
  for (const value of [null, [], { batch_id: '' }, { batch_id: 'batch' }, { batch_id: batch.toUpperCase() },
    { batch_id: null }, { batch_id: 1 }, { batch_id: batch, actor: 'other' }, { limit: 101 }, { limit: -0 },
    { status: 'ready' }, { cursor: '' }, { workspace_id: 'x'.repeat(201) }]) assert.throws(() => parseJobListOptions(value), invalid);
  assert.throws(() => parseJobListOptions({ [Symbol('unknown')]: 'hidden' }), invalid);
  let getterRead = false;
  assert.throws(() => parseJobListOptions({ get batch_id() { getterRead = true; return batch; } }), invalid);
  assert.equal(getterRead, false);
  assert.throws(() => parseJobListOptions(Object.assign(Object.create({ batch_id: batch }), { limit: 1 })), invalid);
});
