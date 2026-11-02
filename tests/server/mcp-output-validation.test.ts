import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { validateMcpSuccess } from '../../apps/web/lib/mcp-output-validation.ts';

test('MCP output guard accepts the published page and rejects the old missing-page success shape', () => {
  for (const name of ['get_candidate_media', 'list_duplicate_matches']) {
    const response = { request_id: 'synthetic', data: [], page: { next_cursor: null } };
    assert.equal(validateMcpSuccess(name, response), response);
    assert.throws(() => validateMcpSuccess(name, { request_id: 'synthetic', data: [] }), error => error instanceof DomainError && error.code === 'OPERATION_RESPONSE_INVALID');
  }
});

test('MCP output guard refuses private unexpected data and unknown tools without serializing the failed payload', () => {
  const privateMarker = 'synthetic-private-result-must-not-cross';
  for (const [name, payload] of [
    ['list_duplicate_matches', { request_id: 'synthetic', data: [{ candidate_id: 'candidate', display_name: null, match_reasons: [], private_notes: privateMarker }], page: { next_cursor: null } }],
    ['arbitrary', { privateMarker }],
  ] as const) {
    assert.throws(() => validateMcpSuccess(name, payload), error => error instanceof DomainError && error.status === 503 && !JSON.stringify(error).includes(privateMarker));
  }
});

test('MCP output validation is transport-neutral and never prescribes mutation retries for reads', () => {
  for (const name of ['get_project', 'add_workspace_candidate']) {
    assert.throws(() => validateMcpSuccess(name, {}), error => error instanceof DomainError
      && error.code === 'OPERATION_RESPONSE_INVALID'
      && error.message === 'The operation result did not match its published contract.');
  }
});
