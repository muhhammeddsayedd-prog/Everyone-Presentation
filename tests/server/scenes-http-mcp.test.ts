import assert from 'node:assert/strict';
import test from 'node:test';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { DomainError } from '@eps/domain';
import { handleScenesRequest, isScenesRoute, type ScenesOperations } from '../../apps/web/lib/scenes-http.ts';
import { getScenesService } from '../../apps/web/lib/scenes.ts';
import { isManualSpecsRoute } from '../../apps/web/lib/specs-http.ts';
import { isCastingRoute } from '../../apps/web/lib/casting-http.ts';
import { isCandidatesRoute } from '../../apps/web/lib/candidates-http.ts';
import { isReviewRoute } from '../../apps/web/lib/review-http.ts';
import { createStudioMcpServer, implementedMcpTools, invokeMcpTool, type McpServices } from '../../apps/web/lib/mcp.ts';
import catalog from '../../contracts/mcp-tool-catalog.json';
import { syntheticMcpStudio } from '../fixtures/mcp-capabilities.ts';

const actor = { principal_id: 'synthetic-producer' };
const context = { requestId: 'synthetic-scene-request', clientType: 'browser' as const, idempotencyKey: 'synthetic-scene-key-0001' };
const occurrence = { id: 'occ', scene_id: 'scene', role_id: 'role', role_name: 'Father', slot_ids: [], display_title: null, setting_override: null,
  presentation_note: null, deck_placement: 'auto', status: 'confirmed', source_refs: [], sort_order: 0, row_version: 1, proposal_stale: false };
const scene = { id: 'scene', workspace_id: 'workspace', scene_number: '1', title: 'Kitchen', sequence_label: null, setting: null, notes: null,
  requirements: { items: [] }, source_refs: [], status: 'confirmed', sort_order: 0, row_version: 1, archived: false, occurrences: [occurrence] };
const roleOccurrence = { occurrence_id: 'occ', scene_id: 'scene', scene_number: '1', scene_title: 'Kitchen', setting: null, scene_position: 1,
  scene_status: 'confirmed', status: 'confirmed' };
const SCENE_TOOLS = ['list_scenes', 'create_scene', 'update_scene', 'reorder_scenes', 'archive_scene', 'link_scene_occurrence',
  'update_scene_occurrence', 'unlink_scene_occurrence', 'list_role_occurrences', 'confirm_scene_proposals', 'reject_scene_proposals'];

function service(overrides: Record<string, unknown> = {}) {
  const calls: { name: string; args: unknown[] }[] = [];
  const operation = (name: string, result: unknown) => async (...args: unknown[]) => { calls.push({ name, args }); return overrides[name] ?? result; };
  const scenes = {
    listScenes: operation('listScenes', { data: [scene], page: { next_cursor: null } }), createScene: operation('createScene', scene),
    updateScene: operation('updateScene', scene), reorderScenes: operation('reorderScenes', { workspace_id: 'workspace', row_version: 3, scene_ids: ['scene'] }),
    archiveScene: operation('archiveScene', { success: true, affected_ids: ['scene', 'occ'] }), linkSceneOccurrence: operation('linkSceneOccurrence', scene),
    updateSceneOccurrence: operation('updateSceneOccurrence', scene), unlinkSceneOccurrence: operation('unlinkSceneOccurrence', { ...scene, occurrences: [] }),
    listRoleOccurrences: operation('listRoleOccurrences', { data: [roleOccurrence], page: { next_cursor: null } }),
    confirmSceneProposals: operation('confirmSceneProposals', { workspace_id: 'workspace', row_version: 4, confirmed_scene_ids: ['scene'], confirmed_occurrence_ids: [], skipped_occurrence_ids: [] }),
    rejectSceneProposals: operation('rejectSceneProposals', { workspace_id: 'workspace', row_version: 5, rejected_scene_ids: ['scene'], rejected_occurrence_ids: ['occ'] }),
  } as unknown as ScenesOperations;
  return { scenes, calls };
}
function request(path: string[], method = 'GET', body?: unknown, query = '') {
  return new Request(`http://127.0.0.1:3000/api/v1/${path.join('/')}${query}`, {
    method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const rejectsWith = (code: string) => (error: unknown) => error instanceof DomainError && error.code === code;

test('scene routes are their own family and do not capture specs, casting, candidate or review routes', () => {
  const routes = [['workspaces', 'w', 'scenes'], ['workspaces', 'w', 'scene-order'], ['workspaces', 'w', 'scene-proposals', 'confirm'],
    ['scenes', 's'], ['scenes', 's', 'archive'], ['scenes', 's', 'occurrences'], ['scene-occurrences', 'o'], ['scene-occurrences', 'o', 'unlink'],
    ['roles', 'r', 'occurrences']];
  for (const path of routes) {
    assert.equal(isScenesRoute(path), true, path.join('/'));
    assert.equal(isManualSpecsRoute(path) || isCastingRoute(path) || isCandidatesRoute(path) || isReviewRoute(path), false, path.join('/'));
  }
  for (const path of [['workspaces', 'w', 'roles'], ['workspaces', 'w', 'order'], ['roles', 'r'], ['roles', 'r', 'archive'], ['scenes'],
    ['scenes', 's', 'other'], ['scene-occurrences', 'o', 'archive'], ['workspaces', 'w', 'scene-proposals']]) assert.equal(isScenesRoute(path), false, path.join('/'));
});

test('all eleven HTTP routes pass the verified actor, revision and mutation context to one shared operation', async () => {
  const { scenes, calls } = service();
  const cases: [string[], string, unknown, number, string, unknown[]][] = [
    [['workspaces', 'workspace', 'scenes'], 'GET', undefined, 200, 'listScenes', ['workspace', { limit: 10, cursor: 'scene-0' }]],
    [['workspaces', 'workspace', 'scenes'], 'POST', { title: 'Kitchen' }, 201, 'createScene', ['workspace', { title: 'Kitchen' }, context]],
    [['scenes', 'scene'], 'PATCH', { row_version: 1, setting: 'INT. KITCHEN' }, 200, 'updateScene', ['scene', { row_version: 1, setting: 'INT. KITCHEN' }, context]],
    [['workspaces', 'workspace', 'scene-order'], 'PUT', { row_version: 2, scene_ids: ['scene'] }, 200, 'reorderScenes', ['workspace', { row_version: 2, scene_ids: ['scene'] }, context]],
    [['scenes', 'scene', 'archive'], 'POST', { row_version: 1 }, 200, 'archiveScene', ['scene', { row_version: 1 }, context]],
    [['scenes', 'scene', 'occurrences'], 'POST', { role_id: 'role', slot_ids: [] }, 201, 'linkSceneOccurrence', ['scene', { role_id: 'role', slot_ids: [] }, context]],
    [['scene-occurrences', 'occ'], 'PATCH', { row_version: 1, deck_placement: 'hidden' }, 200, 'updateSceneOccurrence', ['occ', { row_version: 1, deck_placement: 'hidden' }, context]],
    [['scene-occurrences', 'occ', 'unlink'], 'POST', { row_version: 1 }, 200, 'unlinkSceneOccurrence', ['occ', { row_version: 1 }, context]],
    [['roles', 'role', 'occurrences'], 'GET', undefined, 200, 'listRoleOccurrences', ['role']],
    [['workspaces', 'workspace', 'scene-proposals', 'confirm'], 'POST', { row_version: 3 }, 200, 'confirmSceneProposals', ['workspace', { row_version: 3 }, context]],
    [['workspaces', 'workspace', 'scene-proposals', 'reject'], 'POST', { row_version: 3, scene_ids: ['scene'] }, 200, 'rejectSceneProposals', ['workspace', { row_version: 3, scene_ids: ['scene'] }, context]],
  ];
  for (const [path, method, body, status, name, args] of cases) {
    const query = name === 'listScenes' ? '?limit=10&cursor=scene-0' : '';
    const response = await handleScenesRequest(request(path, method, body, query), path, actor, scenes, context);
    assert.equal(response.status, status, name);
    const envelope = await response.json() as Record<string, unknown>;
    assert.equal(envelope.request_id, context.requestId);
    assert.deepEqual(calls.at(-1), { name, args: [actor, ...args] }, name);
    if (name.startsWith('list')) assert.deepEqual(envelope.page, { next_cursor: null });
  }
  assert.equal(calls.length, 11);
});

test('bodies are contract-validated and unsupported shapes, queries and methods never dispatch', async () => {
  const { scenes, calls } = service();
  const bad: [string[], string, unknown, string?][] = [
    [['workspaces', 'w', 'scenes'], 'POST', { title: 'K', status: 'confirmed' }], [['workspaces', 'w', 'scenes'], 'POST', { title: '  ' }],
    [['scenes', 's'], 'PATCH', { row_version: 1 }], [['scenes', 's', 'archive'], 'POST', { row_version: 1, reason: 'x' }],
    [['scenes', 's', 'occurrences'], 'POST', { role_name: 'Father' }], [['scenes', 's', 'occurrences'], 'POST', { role_id: 'r', deck_placement: 'twice' }],
    [['workspaces', 'w', 'scene-order'], 'PUT', { row_version: 1, scene_ids: ['a', 'a'] }],
    [['workspaces', 'w', 'scenes'], 'GET', undefined, '?limit=101'], [['workspaces', 'w', 'scenes'], 'GET', undefined, '?q=x'],
    [['roles', 'r', 'occurrences'], 'GET', undefined, '?limit=5'], [['scenes', 's'], 'DELETE', undefined], [['scenes', 's', 'archive'], 'GET', undefined],
  ];
  for (const [path, method, body, query] of bad) {
    await assert.rejects(handleScenesRequest(request(path, method, body, query ?? ''), path, actor, scenes, context), (error: unknown) => error instanceof DomainError
      && [400, 404].includes(error.status), `${method} ${path.join('/')}`);
  }
  assert.equal(calls.length, 0);
});

test('the scene service is supabase-only, like specs', async () => {
  const previous = process.env.CENTRAL_ADAPTER_MODE; process.env.CENTRAL_ADAPTER_MODE = 'local_fixture';
  try { await assert.rejects(getScenesService(), rejectsWith('FEATURE_NOT_IMPLEMENTED')); }
  finally { if (previous === undefined) delete process.env.CENTRAL_ADAPTER_MODE; else process.env.CENTRAL_ADAPTER_MODE = previous; }
});

test('the eleven MCP tools map to the same routes, require idempotency keys and validate their published output', async () => {
  const tools = implementedMcpTools();
  for (const name of SCENE_TOOLS) {
    const tool = tools.find(item => item.name === name); assert.ok(tool, name);
    const entry = catalog.tools.find(item => item.name === name)!;
    assert.equal(entry.capability, entry.http.method === 'GET' ? 'workspaces.read' : 'workspaces.write');
    if (entry.http.method !== 'GET') assert.ok((tool.inputSchema.required as string[]).includes('idempotency_key'), name);
  }
  const { scenes, calls } = service();
  const ports = { studio: syntheticMcpStudio(actor.principal_id), scenes } as unknown as McpServices;
  const key = 'mcp-scene-key-000001';
  const inputs: Record<string, Record<string, unknown>> = {
    list_scenes: { workspace_id: 'workspace', limit: 5 }, create_scene: { workspace_id: 'workspace', idempotency_key: key, body: { title: 'Kitchen' } },
    update_scene: { scene_id: 'scene', idempotency_key: key, body: { row_version: 1, title: 'Garden' } },
    reorder_scenes: { workspace_id: 'workspace', idempotency_key: key, body: { row_version: 2, scene_ids: ['scene'] } },
    archive_scene: { scene_id: 'scene', idempotency_key: key, body: { row_version: 1 } },
    link_scene_occurrence: { scene_id: 'scene', idempotency_key: key, body: { role_id: 'role' } },
    update_scene_occurrence: { occurrence_id: 'occ', idempotency_key: key, body: { row_version: 1, presentation_note: 'Flashback' } },
    unlink_scene_occurrence: { occurrence_id: 'occ', idempotency_key: key, body: { row_version: 1 } },
    list_role_occurrences: { role_id: 'role' }, confirm_scene_proposals: { workspace_id: 'workspace', idempotency_key: key, body: { row_version: 3, scene_ids: ['scene'] } },
    reject_scene_proposals: { workspace_id: 'workspace', idempotency_key: key, body: { row_version: 3, occurrence_ids: ['occ'] } },
  };
  for (const name of SCENE_TOOLS) {
    const result = await invokeMcpTool(name, inputs[name], actor, ports, 'mcp-request');
    assert.equal(result.isError, undefined, `${name}: ${JSON.stringify(result.structuredContent)}`);
    const args = calls.at(-1)!.args;
    assert.deepEqual(args[0], actor);
    if (catalog.tools.find(item => item.name === name)!.http.method !== 'GET') {
      assert.deepEqual(args.at(-1), { requestId: 'mcp-request', clientType: 'mcp', idempotencyKey: key }, name);
    }
  }
  assert.deepEqual(calls[0].args, [actor, 'workspace', { limit: 5 }]);
  const missingKey = await invokeMcpTool('create_scene', { workspace_id: 'workspace', body: { title: 'K' } }, actor, ports);
  assert.equal(missingKey.isError, true);
  const nameLink = await invokeMcpTool('link_scene_occurrence', { scene_id: 'scene', idempotency_key: key, body: { role_name: 'Father' } }, actor, ports);
  assert.equal(nameLink.isError, true);
  const leaked = service({ createScene: { ...scene, secret: 'private' } });
  const invalid = await invokeMcpTool('create_scene', inputs.create_scene, actor, { ...ports, scenes: leaked.scenes } as McpServices);
  assert.equal(invalid.isError, true); assert.equal((invalid.structuredContent as { error: { code: string } }).error.code, 'OPERATION_RESPONSE_INVALID');
  const unavailable = await invokeMcpTool('list_scenes', { workspace_id: 'workspace' }, actor, { ...ports, scenes: undefined } as McpServices);
  assert.equal(unavailable.isError, true); assert.equal((unavailable.structuredContent as { error: { code: string } }).error.code, 'FEATURE_NOT_IMPLEMENTED');
});

test('official MCP client lists the scene tools for an acting user with workspace authority and calls the shared service', async () => {
  const { scenes, calls } = service();
  const server = createStudioMcpServer(actor, { studio: syntheticMcpStudio(actor.principal_id), scenes } as unknown as McpServices);
  const client = new Client({ name: 'eps-scenes-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport); await client.connect(clientTransport);
  try {
    const names = (await client.listTools()).tools.map(tool => tool.name);
    for (const name of SCENE_TOOLS) assert.ok(names.includes(name), name);
    const result = await client.callTool({ name: 'list_role_occurrences', arguments: { role_id: 'role' } });
    assert.equal(result.isError, undefined);
    assert.deepEqual((result.structuredContent as { data: unknown[] }).data, [roleOccurrence]);
    assert.deepEqual(calls, [{ name: 'listRoleOccurrences', args: [actor, 'role'] }]);
  } finally { await client.close(); await server.close(); }
});
