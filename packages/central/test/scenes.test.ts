import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralScenes } from '../src/scenes.ts';

// Real installed Supabase SDK against a synthetic HTTP boundary. Not PostgreSQL/RLS acceptance.
const principal = '81900000-0000-4000-8000-000000000001';
const workspace = '82900000-0000-4000-8000-000000000001';
const sceneId = '83900000-0000-4000-8000-000000000001';
const occurrenceId = '84900000-0000-4000-8000-000000000001';
const roleId = '85900000-0000-4000-8000-000000000001';
const actor = { principal_id: principal };
const key = 'synthetic-scene-key-0001';
const trace = (idempotencyKey: string | undefined = key) => ({ requestId: 'synthetic-scene-request', clientType: 'mcp' as const, idempotencyKey });
const code = (expected: string) => (error: unknown) => error instanceof DomainError && error.code === expected;
const occurrence = (overrides: Record<string, unknown> = {}) => ({ id: occurrenceId, scene_id: sceneId, role_id: roleId, role_name: 'Father',
  slot_ids: [], display_title: null, setting_override: null, presentation_note: null, deck_placement: 'auto', status: 'confirmed',
  source_refs: [], sort_order: 0, row_version: 1, proposal_stale: false, ...overrides });
const scene = (overrides: Record<string, unknown> = {}) => ({ id: sceneId, workspace_id: workspace, scene_number: '1', title: 'Kitchen',
  sequence_label: null, setting: null, notes: null, requirements: { items: [] }, source_refs: [], status: 'confirmed', sort_order: 0,
  row_version: 1, archived: false, occurrences: [occurrence()], ...overrides });

async function harness(respond: (name: string, args: Record<string, unknown>) => unknown) {
  const calls: { name: string; args: Record<string, unknown>; headers: Headers }[] = [];
  const client = createBearerUserClient({ url: 'https://synthetic-scenes.example.invalid', publishableKey: 'sb_publishable_synthetic', accessToken: 'synthetic-acting-token' }, {
    fetch: async (input, init) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated', is_anonymous: false });
      const name = url.pathname.split('/').at(-1)!; const args = JSON.parse(String(init?.body)) as Record<string, unknown>;
      calls.push({ name, args, headers: new Headers(init?.headers) });
      const result = respond(name, args);
      return result instanceof Response ? result : Response.json(result);
    },
  });
  return { api: await createCentralScenes(client), calls };
}
const rpcError = (message: string, details: unknown = null) => Response.json({ code: 'P0001', message, details: details && JSON.stringify(details) }, { status: 400 });

test('every scene RPC is called with exact arguments, trace headers and the required idempotency key', async () => {
  const order = { workspace_id: workspace, row_version: 8, scene_ids: [sceneId] };
  const confirmed = { workspace_id: workspace, row_version: 9, confirmed_scene_ids: [sceneId], confirmed_occurrence_ids: [occurrenceId], skipped_occurrence_ids: [] };
  const rejectedResult = { workspace_id: workspace, row_version: 10, rejected_scene_ids: [sceneId], rejected_occurrence_ids: [occurrenceId] };
  const results: Record<string, unknown> = {
    eps_list_scenes: { data: [scene()], page: { next_cursor: null } }, eps_create_scene: scene({ occurrences: [] }), eps_update_scene: scene({ row_version: 2 }),
    eps_reorder_scenes: order, eps_archive_scene: { success: true, affected_ids: [sceneId, occurrenceId] }, eps_link_scene_occurrence: scene(),
    eps_update_scene_occurrence: scene({ occurrences: [occurrence({ row_version: 2, deck_placement: 'repeat' })] }),
    eps_unlink_scene_occurrence: scene({ occurrences: [] }),
    eps_list_role_occurrences: { role_id: roleId, data: [{ occurrence_id: occurrenceId, scene_id: sceneId, scene_number: '1', scene_title: 'Kitchen',
      setting: null, scene_position: 1, scene_status: 'confirmed', status: 'confirmed' }] },
    eps_confirm_scene_proposals: confirmed, eps_reject_scene_proposals: rejectedResult,
  };
  const h = await harness(name => results[name]);
  assert.deepEqual(await h.api.listScenes(actor, workspace, { limit: 10 }), results.eps_list_scenes);
  assert.deepEqual(await h.api.createScene(actor, workspace, { title: 'Kitchen', scene_number: '1' }, trace()), results.eps_create_scene);
  assert.equal((await h.api.updateScene(actor, sceneId, { row_version: 1, notes: 'Rain' }, trace())).row_version, 2);
  assert.deepEqual(await h.api.reorderScenes(actor, workspace, { row_version: 7, scene_ids: [sceneId] }, trace()), order);
  assert.deepEqual(await h.api.archiveScene(actor, sceneId, { row_version: 1 }, trace()), results.eps_archive_scene);
  assert.equal((await h.api.linkSceneOccurrence(actor, sceneId, { role_id: roleId, slot_ids: [] }, trace())).occurrences[0].role_id, roleId);
  assert.equal((await h.api.updateSceneOccurrence(actor, occurrenceId, { row_version: 1, deck_placement: 'repeat' }, trace())).occurrences[0].deck_placement, 'repeat');
  assert.deepEqual((await h.api.unlinkSceneOccurrence(actor, occurrenceId, { row_version: 1 }, trace())).occurrences, []);
  assert.deepEqual(await h.api.listRoleOccurrences(actor, roleId), { data: (results.eps_list_role_occurrences as { data: unknown[] }).data, page: { next_cursor: null } });
  assert.deepEqual(await h.api.confirmSceneProposals(actor, workspace, { row_version: 8 }, trace()), confirmed);
  assert.deepEqual(await h.api.rejectSceneProposals(actor, workspace, { row_version: 9, scene_ids: [sceneId] }, trace()), rejectedResult);
  assert.deepEqual(h.calls.map(call => [call.name, call.args]), [
    ['eps_list_scenes', { p_workspace_id: workspace, p_cursor: null, p_limit: 10 }],
    ['eps_create_scene', { p_workspace_id: workspace, p_input: { title: 'Kitchen', scene_number: '1' }, p_idempotency_key: key }],
    ['eps_update_scene', { p_scene_id: sceneId, p_input: { row_version: 1, notes: 'Rain' }, p_idempotency_key: key }],
    ['eps_reorder_scenes', { p_workspace_id: workspace, p_input: { row_version: 7, scene_ids: [sceneId] }, p_idempotency_key: key }],
    ['eps_archive_scene', { p_scene_id: sceneId, p_input: { row_version: 1 }, p_idempotency_key: key }],
    ['eps_link_scene_occurrence', { p_scene_id: sceneId, p_input: { role_id: roleId, slot_ids: [] }, p_idempotency_key: key }],
    ['eps_update_scene_occurrence', { p_occurrence_id: occurrenceId, p_input: { row_version: 1, deck_placement: 'repeat' }, p_idempotency_key: key }],
    ['eps_unlink_scene_occurrence', { p_occurrence_id: occurrenceId, p_input: { row_version: 1 }, p_idempotency_key: key }],
    ['eps_list_role_occurrences', { p_role_id: roleId }],
    ['eps_confirm_scene_proposals', { p_workspace_id: workspace, p_input: { row_version: 8 }, p_idempotency_key: key }],
    ['eps_reject_scene_proposals', { p_workspace_id: workspace, p_input: { row_version: 9, scene_ids: [sceneId] }, p_idempotency_key: key }],
  ]);
  const mutation = h.calls[1].headers;
  assert.equal(mutation.get('X-EPS-Request-ID'), 'synthetic-scene-request'); assert.equal(mutation.get('X-EPS-Client-Type'), 'mcp');
});

test('missing/short keys, forged actors and invalid input are refused before any RPC', async () => {
  const h = await harness(() => scene());
  for (const context of [undefined, trace(''), trace('short'), trace(' '.repeat(20))]) {
    await assert.rejects(h.api.createScene(actor, workspace, { title: 'Kitchen' }, context), code('IDEMPOTENCY_KEY_REQUIRED'));
  }
  await assert.rejects(h.api.archiveScene(actor, sceneId, { row_version: 1 }), code('IDEMPOTENCY_KEY_REQUIRED'));
  await assert.rejects(h.api.createScene({ principal_id: 'other' }, workspace, { title: 'Kitchen' }, trace()), code('ACCESS_DENIED'));
  await assert.rejects(h.api.listScenes({ principal_id: 'other' }, workspace), code('ACCESS_DENIED'));
  await assert.rejects(h.api.createScene(actor, workspace, { title: ' ' }, trace()), code('VALIDATION_FAILED'));
  await assert.rejects(h.api.updateScene(actor, sceneId, { row_version: 1 }, trace()), code('VALIDATION_FAILED'));
  await assert.rejects(h.api.listScenes(actor, workspace, { limit: 101 }), code('INVALID_REQUEST'));
  await assert.rejects(h.api.listScenes(actor, '', {}), code('INVALID_REQUEST'));
  assert.equal(h.calls.length, 0);
});

test('responses that leave the contract, scope or request are refused as CENTRAL_RESPONSE_INVALID', async () => {
  const cases: [string, unknown, (api: Awaited<ReturnType<typeof harness>>['api']) => Promise<unknown>][] = [
    ['extra key', scene({ secret: 1 }), api => api.createScene(actor, workspace, { title: 'K' }, trace())],
    ['other workspace', scene({ workspace_id: 'other' }), api => api.createScene(actor, workspace, { title: 'K' }, trace())],
    ['created as proposal', scene({ status: 'proposed' }), api => api.createScene(actor, workspace, { title: 'K' }, trace())],
    ['other scene', scene({ id: 'other' }), api => api.updateScene(actor, sceneId, { row_version: 1, title: 'K' }, trace())],
    ['archived scene', scene({ archived: true }), api => api.updateScene(actor, sceneId, { row_version: 1, title: 'K' }, trace())],
    ['link missing role', scene({ occurrences: [] }), api => api.linkSceneOccurrence(actor, sceneId, { role_id: roleId }, trace())],
    ['still linked', scene(), api => api.unlinkSceneOccurrence(actor, occurrenceId, { row_version: 1 }, trace())],
    ['archive without scene', { success: true, affected_ids: [occurrenceId] }, api => api.archiveScene(actor, sceneId, { row_version: 1 }, trace())],
    ['order differs', { workspace_id: workspace, row_version: 8, scene_ids: ['b', 'a'] }, api => api.reorderScenes(actor, workspace, { row_version: 7, scene_ids: ['a', 'b'] }, trace())],
    ['order version regressed', { workspace_id: workspace, row_version: 6, scene_ids: ['a'] }, api => api.reorderScenes(actor, workspace, { row_version: 7, scene_ids: ['a'] }, trace())],
    ['page overflow', { data: [scene(), scene({ id: 'two' })], page: { next_cursor: null } }, api => api.listScenes(actor, workspace, { limit: 1 })],
    ['cursor mismatch', { data: [scene()], page: { next_cursor: 'other' } }, api => api.listScenes(actor, workspace, { limit: 1 })],
    ['archived listed', { data: [scene({ archived: true })], page: { next_cursor: null } }, api => api.listScenes(actor, workspace)],
    ['other role', { role_id: 'other', data: [] }, api => api.listRoleOccurrences(actor, roleId)],
    ['unordered role occurrences', { role_id: roleId, data: [
      { occurrence_id: 'a', scene_id: 'sa', scene_number: null, scene_title: 'A', setting: null, scene_position: 2, scene_status: 'confirmed', status: 'confirmed' },
      { occurrence_id: 'b', scene_id: 'sb', scene_number: null, scene_title: 'B', setting: null, scene_position: 1, scene_status: 'confirmed', status: 'confirmed' }] },
    api => api.listRoleOccurrences(actor, roleId)],
    ['confirm other workspace', { workspace_id: 'other', row_version: 9, confirmed_scene_ids: [], confirmed_occurrence_ids: [], skipped_occurrence_ids: [] },
      api => api.confirmSceneProposals(actor, workspace, { row_version: 8 }, trace())],
  ];
  for (const [label, response, call] of cases) {
    const h = await harness(() => response);
    await assert.rejects(call(h.api), code('CENTRAL_RESPONSE_INVALID'), label);
  }
});

test('central errors keep their public codes and never expose SQL diagnostics', async () => {
  const stale = await harness(() => rpcError('STALE_RESOURCE_VERSION', { current_row_version: 4 }));
  await assert.rejects(stale.api.updateScene(actor, sceneId, { row_version: 1, title: 'K' }, trace()),
    (error: unknown) => error instanceof DomainError && error.code === 'STALE_RESOURCE_VERSION' && error.status === 409 && error.details.current_row_version === 4);
  for (const [message, status] of [['RESOURCE_NOT_FOUND', 404], ['INVALID_REQUEST', 400], ['IDEMPOTENCY_KEY_REQUIRED', 400], ['IDEMPOTENCY_KEY_REUSED', 409]] as const) {
    const h = await harness(() => rpcError(message));
    await assert.rejects(h.api.archiveScene(actor, sceneId, { row_version: 1 }, trace()),
      (error: unknown) => error instanceof DomainError && error.code === message && error.status === status);
  }
  const missing = await harness(() => Response.json({ code: 'PGRST202', message: 'private signature' }, { status: 404 }));
  await assert.rejects(missing.api.listScenes(actor, workspace), code('FEATURE_NOT_IMPLEMENTED'));
  const raw = await harness(() => Response.json({ code: 'XX000', message: 'relation eps.scenes private detail' }, { status: 500 }));
  await assert.rejects(raw.api.listScenes(actor, workspace), (error: unknown) => error instanceof DomainError && !error.message.includes('eps.scenes'));
});
