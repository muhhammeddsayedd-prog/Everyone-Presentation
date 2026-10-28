import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { handleJobRequest, type JobOperations } from '../../apps/web/lib/job-http.ts';
import { failure } from '../../apps/web/lib/http.ts';

const actor = { principal_id: 'synthetic-principal' };
function service() {
  const calls: unknown[][] = [];
  const jobs = {
    async listJobs(...args: unknown[]) { calls.push(['list', ...args]); return { data: [], page: { next_cursor: 'next-page' } }; },
    async getJob(...args: unknown[]) { calls.push(['get', ...args]); return { id: 'job-1' }; },
    async retryJob(...args: unknown[]) { calls.push(['retry', ...args]); return { id: 'job-1', status: 'queued' }; },
    async cancelJob(...args: unknown[]) { calls.push(['cancel', ...args]); return { id: 'job-1', status: 'cancelled' }; },
  } as unknown as JobOperations;
  return { jobs, calls };
}
const request = (query = '', method = 'GET', body?: unknown) => new Request(`http://127.0.0.1:3000/api/v1/jobs${query}`, {
  method, headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'one-intent', Authorization: 'Bearer synthetic-user-token' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const context = { requestId: 'request-1', clientType: 'api' as const, idempotencyKey: 'one-intent' };

test('job list preserves cursor envelope, bounded filters and verified actor', async () => {
  const { jobs, calls } = service();
  const response = await handleJobRequest(request('?workspace_id=workspace-1&status=running&cursor=previous&limit=7'), ['jobs'], actor, jobs, context);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('cache-control') ?? '', /no-store/);
  assert.deepEqual(await response.json(), { request_id: 'request-1', data: [], page: { next_cursor: 'next-page' } });
  assert.deepEqual(calls, [['list', actor, { workspace_id: 'workspace-1', status: 'running', cursor: 'previous', limit: 7 }]]);
});

test('invalid or ambiguous list filters fail before querying any scope', async () => {
  const { jobs, calls } = service();
  for (const query of ['?principal_id=other', '?status=running&status=failed', '?workspace_id=', '?cursor=', '?status=other', '?limit=', '?limit=0', '?limit=101', '?limit=2.5', '?limit=1e1']) {
    await assert.rejects(handleJobRequest(request(query), ['jobs'], actor, jobs, context),
      (error: unknown) => error instanceof DomainError && error.status === 400);
  }
  assert.equal(calls.length, 0);
});

test('retry and cancel forward concurrency and the same intent without accepting actor overrides', async () => {
  const { jobs, calls } = service();
  for (const operation of ['retry', 'cancel']) {
    const response = await handleJobRequest(request('', 'POST', { row_version: 9, reason: null }), ['jobs', 'job-1', operation], actor, jobs, context);
    assert.equal(response.status, 200);
  }
  assert.deepEqual(calls, ['retry', 'cancel'].map(operation => [operation, actor, 'job-1', { row_version: 9, reason: null }, context]));
  for (const body of [{ row_version: 9, principal_id: 'other' }, { row_version: 0 }, { row_version: '9' }, { row_version: 9, lease_token: 'forged' }]) {
    await assert.rejects(handleJobRequest(request('', 'POST', body), ['jobs', 'job-1', 'retry'], actor, jobs, context));
  }
  assert.equal(calls.length, 2);
});

test('unsupported job routes and methods cannot fall through to an operation', async () => {
  const { jobs, calls } = service();
  for (const [method, path] of [['POST', ['jobs']], ['DELETE', ['jobs', 'job-1']], ['GET', ['jobs', 'job-1', 'retry']], ['POST', ['jobs', 'job-1', 'claim']]] as const) {
    await assert.rejects(handleJobRequest(request('', method), [...path], actor, jobs, context));
  }
  assert.equal(calls.length, 0);
});

test('service denial remains scoped and dependency exceptions never expose secrets', async () => {
  for (const error of [new DomainError('RESOURCE_NOT_FOUND', 'Unavailable in your scope.', 404), new Error('private-source-text synthetic-user-token')]) {
    const { jobs } = service(); jobs.getJob = async () => { throw error; };
    const response = await handleJobRequest(request(), ['jobs', 'job-1'], actor, jobs, context).catch(reason => failure(reason, context.requestId));
    assert.equal(response.status, error instanceof DomainError ? 404 : 503);
    assert.doesNotMatch(await response.text(), /private-source-text|synthetic-user-token/);
  }
});
