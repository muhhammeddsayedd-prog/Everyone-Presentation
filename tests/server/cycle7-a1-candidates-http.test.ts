import test from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '@eps/domain';
import { handleCandidatesRequest, isCandidatesRoute } from '../../apps/web/lib/candidates-http.ts';
import type { CandidatesOperations } from '../../apps/web/lib/candidates-http.ts';

// Cycle 7 A1 HTTP mapping: idempotent add status, search workspace_id, uploads list and media repairs.
const actor = { principal_id: 'verified-current-user' };
const context = { requestId: 'a1-http-test', clientType: 'browser' as const, idempotencyKey: 'synthetic-a1-http-intent' };
function request(path: string, method = 'GET', body?: unknown) {
  return new Request('http://127.0.0.1/api/v1/' + path, { method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
const pool = { id: 'pool', workspace_id: 'workspace', candidate_id: 'person', selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: null,
  fresh_material_required: false, media_confirmed: false, internal_notes: null, portrait_asset_id: null, portrait_source: null, portrait_crop: null, media_selection_state: 'unset', row_version: 1 };

test('add answers 201 for a new membership and 200 when the person was already in the project', async () => {
  for (const [already, status] of [[false, 201], [true, 200]] as const) {
    const calls: unknown[][] = [];
    const service = { addWorkspaceCandidate: async (...args: unknown[]) => { calls.push(args); return { ...pool, already_member: already }; } } as unknown as CandidatesOperations;
    const path = ['workspaces', 'workspace', 'candidates'];
    const response = await handleCandidatesRequest(request(path.join('/'), 'POST', { candidate_id: 'person', portrait_asset_id: null, media_selection_state: 'pinned' }), path, actor, service, context);
    assert.equal(response.status, status);
    assert.equal((await response.json()).data.already_member, already);
    assert.deepEqual(calls[0], [actor, 'workspace', { candidate_id: 'person', portrait_asset_id: null, media_selection_state: 'pinned' }, context]);
  }
});

test('search forwards workspace_id; uploads and repairs routes keep their bounded parameters', async () => {
  const calls: unknown[][] = [];
  const service = {
    searchCandidates: async (...args: unknown[]) => { calls.push(['search', ...args]); return { data: [], page: { next_cursor: null } }; },
    listWorkspaceUploads: async (...args: unknown[]) => { calls.push(['uploads', ...args]); return { data: [], page: { next_cursor: null } }; },
    suggestMediaRepairs: async (...args: unknown[]) => { calls.push(['suggest', ...args]); return { data: [], has_more: false }; },
    applyMediaRepairs: async (...args: unknown[]) => { calls.push(['apply', ...args]); return { applied: [], skipped: [] }; },
  } as unknown as CandidatesOperations;
  await handleCandidatesRequest(request('candidates?q=Synthetic&workspace_id=workspace'), ['candidates'], actor, service, context);
  assert.deepEqual(calls[0], ['search', actor, { q: 'Synthetic', workspace_id: 'workspace' }]);
  const uploads = ['workspaces', 'workspace', 'candidate-uploads']; assert.equal(isCandidatesRoute(uploads), true);
  await handleCandidatesRequest(request(uploads.join('/') + '?limit=10'), uploads, actor, service, context);
  assert.deepEqual(calls[1], ['uploads', actor, 'workspace', { limit: 10 }]);
  await assert.rejects(handleCandidatesRequest(request(uploads.join('/') + '?q=nope'), uploads, actor, service, context), DomainError);
  const repairs = ['workspaces', 'workspace', 'media-repairs']; assert.equal(isCandidatesRoute(repairs), true);
  const suggested = await handleCandidatesRequest(request(repairs.join('/')), repairs, actor, service, context);
  assert.deepEqual(await suggested.json(), { request_id: context.requestId, data: [], has_more: false });
  await handleCandidatesRequest(request(repairs.join('/'), 'POST', { items: [{ workspace_candidate_id: 'pool', row_version: 1 }] }), repairs, actor, service, context);
  assert.deepEqual(calls[3], ['apply', actor, 'workspace', { items: [{ workspace_candidate_id: 'pool', row_version: 1 }] }, context]);
  await assert.rejects(handleCandidatesRequest(request(repairs.join('/'), 'POST', { items: [], extra: true }), repairs, actor, service, context), DomainError);
  assert.equal(calls.length, 4);
});
