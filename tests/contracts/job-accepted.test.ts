import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { validateContract } from '../../apps/web/lib/validation';
import schemas from '../../apps/web/lib/generated-contracts.json';

const statuses = ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled'];

test('job acceptance reports a reused job status without pretending to enqueue finished work', () => {
  for (const status of statuses) {
    assert.doesNotThrow(() => validateContract('JobAccepted', { job_id: 'existing-job', resource_id: 'spec', poll_url: '/api/v1/jobs/existing-job', status }));
  }
  assert.throws(() => validateContract('JobAccepted', { job_id: 'existing-job', resource_id: 'spec', poll_url: '/api/v1/jobs/existing-job', status: 'unknown' }));
});

test('every self-contained MCP acceptance schema agrees with runtime durable status semantics', async () => {
  const catalog = JSON.parse(await readFile('contracts/mcp-tool-catalog.json', 'utf8'));
  const copies = catalog.tools.flatMap((tool: { outputSchema?: { $defs?: Record<string, unknown> } }) =>
    tool.outputSchema?.$defs?.JobAccepted ? [tool.outputSchema.$defs.JobAccepted] : []);
  assert.ok(copies.length > 0);
  for (const copy of copies) {
    assert.deepEqual(copy, schemas.$defs.JobAccepted);
  }
});
