import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '../../packages/domain/src/types.ts';
import type { Assignment, AssignmentPatch, CastingOperations } from '../../packages/domain/src/casting-types.ts';
import { handleCastingRequest } from '../../apps/web/lib/casting-http.ts';

test('ordinary assignment HTTP PATCH preserves the complete AI review guard and rejects partial or mixed intent before dispatch', async () => {
  const calls: unknown[][] = []; const actor = { principal_id: 'synthetic-producer' };
  const input = { row_version: 2, slide_wording: { city: 'Supplied project city' }, ai_suggestion_id: 'suggestion', expected_series_id: 'series', expected_input_fingerprint: 'a'.repeat(64) };
  const service = { async updateAssignment(...args: unknown[]) { calls.push(args); return { id: 'assignment', row_version: 3 } as Assignment; } } as unknown as CastingOperations;
  const context = { requestId: 'synthetic-guard-http', clientType: 'browser' as const, idempotencyKey: 'synthetic-exact-guard-intent' };
  const request = (body: unknown) => new Request('http://127.0.0.1/api/v1/assignments/assignment', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const response = await handleCastingRequest(request(input), ['assignments', 'assignment'], actor, service, context);
  assert.equal(response.status, 200); assert.deepEqual(calls[0], [actor, 'assignment', input, context]);
  for (const body of [{ row_version: 2, ai_suggestion_id: 'suggestion' }, { ...input, position: 'backup' }, { ...input, slide_wording: { city: null } }, { ...input, slide_wording: { city: ' ' } }]) {
    await assert.rejects(handleCastingRequest(request(body), ['assignments', 'assignment'], actor, service, context));
  }
  assert.equal(calls.length, 1);
  service.updateAssignment = async (_actor, _assignment, body: AssignmentPatch) => { assert.deepEqual(body, input); throw new DomainError('INPUT_CHANGED', 'The proposal source changed.', 409); };
  await assert.rejects(handleCastingRequest(request(input), ['assignments', 'assignment'], actor, service, context), error => error instanceof DomainError && error.code === 'INPUT_CHANGED' && error.status === 409);
});
