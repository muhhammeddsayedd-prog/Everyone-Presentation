import assert from 'node:assert/strict';
import test from 'node:test';
import { DomainError } from '@eps/domain';
import { handleSpecsRequest, isManualSpecsRoute, type SpecsOperations } from '../../apps/web/lib/specs-http.ts';
import { getSpecsService } from '../../apps/web/lib/specs.ts';
import { failure } from '../../apps/web/lib/http.ts';

const actor = { principal_id: 'synthetic-producer' };
const context = { requestId: 'synthetic-specs-request', clientType: 'browser' as const, idempotencyKey: 'one-intent' };
const requirements = { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [],
  skills: [], scene_references: ['1', '3'], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
function service() {
  const calls: { name: string; args: unknown[] }[] = [];
  const spec = { id: 'spec', workspace_id: 'workspace', source_asset_id: null, source_text: 'Synthetic original. العمر غير محدد.',
    normalized_instructions: null, clarifications: [], row_version: 1, processing_job_id: null };
  const role = { id: 'role', workspace_id: 'workspace', name: 'Waiter', headcount: null, category: null, requirements,
    clarifications: [], sort_order: 0, row_version: 1, archived: false };
  const slot = { id: 'slot', role_id: 'role', label: 'Waiter 1', sort_order: 0, row_version: 1, archived: false };
  const operation = (name: string, result: unknown) => async (...args: unknown[]) => { calls.push({ name, args }); return result; };
  const specs = { getSpecs: operation('get', spec), updateSpecs: operation('update', spec),
    listRoles: operation('roles', { data: [role], page: { next_cursor: null } }), createRole: operation('create', role),
    updateRole: operation('role', role), archiveRole: operation('archive', { success: true, affected_ids: ['role', 'slot'] }),
    listSlots: operation('slots', { data: [slot], page: { next_cursor: null } }), resizeRoleSlots: operation('resize', role), updateSlot: operation('slot', slot),
    reorderWorkspace: operation('order', { id: 'workspace', row_version: 2 }),
  } as unknown as SpecsOperations;
  return { specs, calls };
}
function request(path: string[], method = 'GET', body?: unknown, query = '') {
  return new Request(`http://127.0.0.1:3000/api/v1/${path.join('/')}${query}`, {
    method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test('manual route matcher leaves future Main/filter routes to their owning features', () => {
  for (const path of [['workspaces', 'workspace', 'specs'], ['workspaces', 'workspace', 'roles'], ['roles', 'role'],
    ['roles', 'role', 'archive'], ['roles', 'role', 'slots'], ['roles', 'role', 'slots', 'resize'], ['slots', 'slot']]) {
    assert.equal(isManualSpecsRoute(path), true);
  }
  for (const path of [['workspaces'], ['jobs'], ['slots', 'slot', 'main'], ['roles', 'role', 'candidate-filters'],
    ['workspaces', 'workspace', 'candidates'], ['roles', 'role', 'slots', 'unknown']]) assert.equal(isManualSpecsRoute(path), false);
});

test('existing workspace order PUT preserves intent and refuses unsupported maps before dispatch', async () => {
  const { specs, calls } = service(); const path = ['workspaces', 'workspace', 'order'];
  assert.equal(isManualSpecsRoute(path), true);
  const input = { row_version: 19, role_ids: ['b', 'a'] };
  const response = await handleSpecsRequest(request(path, 'PUT', input), path, actor, specs, context);
  assert.equal(response.status, 200); assert.deepEqual((await response.json()).data, { id: 'workspace', row_version: 2 });
  assert.deepEqual(calls[0], { name: 'order', args: [actor, 'workspace', input, context] });
  for (const maps of [{ slot_ids_by_role: {} }, { assignment_ids_by_slot: {} }]) {
    await assert.rejects(handleSpecsRequest(request(path, 'PUT', { row_version: 19, ...maps }), path, actor, specs, context),
      (error: unknown) => error instanceof DomainError && error.status === 503);
  }
  await assert.rejects(handleSpecsRequest(request(path, 'PUT', { row_version: 19, role_ids: ['a'], principal_id: 'other' }), path, actor, specs, context));
  await assert.rejects(handleSpecsRequest(request(path, 'POST', input), path, actor, specs, context));
  assert.equal(calls.length, 1);
});

test('all nine manual routes preserve exact envelopes, actor, versions and mutation intent', async () => {
  const { specs, calls } = service();
  const cases: [string[], string, unknown, string, number][] = [
    [['workspaces', 'workspace', 'specs'], 'GET', undefined, 'get', 200],
    [['workspaces', 'workspace', 'specs'], 'PATCH', { row_version: 1, normalized_instructions: null }, 'update', 200],
    [['workspaces', 'workspace', 'roles'], 'GET', undefined, 'roles', 200],
    [['workspaces', 'workspace', 'roles'], 'POST', { name: 'Waiter', headcount: null, requirements }, 'create', 201],
    [['roles', 'role'], 'PATCH', { row_version: 1, name: 'Server' }, 'role', 200],
    [['roles', 'role', 'archive'], 'POST', { row_version: 1, reason: null }, 'archive', 200],
    [['roles', 'role', 'slots'], 'GET', undefined, 'slots', 200],
    [['roles', 'role', 'slots', 'resize'], 'POST', { row_version: 1, desired_count: 2, retire_slot_ids: ['slot'] }, 'resize', 200],
    [['slots', 'slot'], 'PATCH', { row_version: 1, label: 'Waiter A' }, 'slot', 200],
  ];
  for (const [path, method, body, name, status] of cases) {
    const response = await handleSpecsRequest(request(path, method, body), path, actor, specs, context);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('cache-control'), 'private, no-cache, no-store, must-revalidate, max-age=0');
    const value = await response.json(); assert.equal(value.request_id, context.requestId); assert.ok(Object.hasOwn(value, 'data'));
    const call = calls.at(-1)!; assert.equal(call.name, name); assert.equal(call.args[0], actor);
    if (method !== 'GET') { assert.deepEqual(call.args[2], body); assert.equal(call.args[3], context); }
    else if (name === 'roles' || name === 'slots') assert.ok(Object.hasOwn(value, 'page'));
  }
  assert.equal(calls.length, 9);
});

test('list cursor/limit is bounded and duplicate or unsupported query fields never reach operations', async () => {
  const { specs, calls } = service(); const path = ['roles', 'role', 'slots'];
  await handleSpecsRequest(request(path, 'GET', undefined, '?cursor=previous&limit=7'), path, actor, specs, context);
  assert.deepEqual(calls[0].args, [actor, 'role', { cursor: 'previous', limit: 7 }]);
  for (const query of ['?cursor=', '?limit=0', '?limit=101', '?limit=1e1', '?limit=2.5', '?limit=7&limit=8', '?principal_id=other', '?q=Waiter', '?status=ready']) {
    await assert.rejects(handleSpecsRequest(request(path, 'GET', undefined, query), path, actor, specs, context),
      (error: unknown) => error instanceof DomainError && error.status === 400);
  }
  const patch = ['slots', 'slot'];
  await assert.rejects(handleSpecsRequest(request(patch, 'PATCH', { row_version: 1, label: 'A' }, '?cursor=foreign'), patch, actor, specs, context));
  assert.equal(calls.length, 1);
});

test('strict body contracts reject forged source/authority, missing values and malformed requests', async () => {
  const { specs, calls } = service();
  for (const [path, method, body] of [
    [['workspaces', 'workspace', 'specs'], 'PATCH', { row_version: 1, source_text: 'Overwrite original' }],
    [['workspaces', 'workspace', 'roles'], 'POST', { name: 'Waiter', requirements }],
    [['workspaces', 'workspace', 'roles'], 'POST', { name: 'Waiter', headcount: 0, requirements }],
    [['roles', 'role'], 'PATCH', { row_version: 1, principal_id: 'admin' }],
    [['roles', 'role', 'archive'], 'POST', { row_version: 1, reason: 42 }],
    [['slots', 'slot'], 'PATCH', { label: 'Missing version' }],
  ] as [string[], string, unknown][]) await assert.rejects(handleSpecsRequest(request(path, method, body), path, actor, specs, context));
  const path = ['roles', 'role'];
  const malformed = new Request('http://127.0.0.1:3000/api/v1/roles/role', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: '{broken' });
  await assert.rejects(handleSpecsRequest(malformed, path, actor, specs, context));
  await assert.rejects(handleSpecsRequest(request(path, 'PATCH', { row_version: 1, name: 'x'.repeat(65537) }), path, actor, specs, context));
  assert.equal(calls.length, 0);
});

test('source submission and fixture service fail honestly without invented processing output', async () => {
  const { specs, calls } = service(); const path = ['workspaces', 'workspace', 'specs'];
  await assert.rejects(handleSpecsRequest(request(path, 'POST', { source_text: 'Synthetic source' }), path, actor, specs, context),
    (error: unknown) => error instanceof DomainError && error.code === 'FEATURE_NOT_IMPLEMENTED' && error.status === 503);
  await assert.rejects(handleSpecsRequest(request(path, 'POST', { source_text: 'A', source_asset_id: 'asset' }), path, actor, specs, context),
    (error: unknown) => error instanceof DomainError && error.status === 400);
  assert.equal(calls.length, 0);
  const keys = ['CENTRAL_ADAPTER_MODE', 'APP_ENV', 'NODE_ENV', 'APP_BASE_URL'] as const;
  const saved = keys.map(key => [key, process.env[key]] as const);
  try {
    Object.assign(process.env, { CENTRAL_ADAPTER_MODE: 'local_fixture', APP_ENV: 'test', NODE_ENV: 'test', APP_BASE_URL: 'http://127.0.0.1:3000' });
    await assert.rejects(getSpecsService(), (error: unknown) => error instanceof DomainError
      && error.code === 'FEATURE_NOT_IMPLEMENTED' && error.status === 503);
  } finally { for (const [key, value] of saved) { if (value === undefined) Reflect.deleteProperty(process.env, key); else Reflect.set(process.env, key, value); } }
});

test('scoped denials remain intact and unexpected exceptions never expose provider details', async () => {
  for (const error of [new DomainError('RESOURCE_NOT_FOUND', 'Unavailable in this scope.', 404), new Error('private-source synthetic-token')]) {
    const { specs } = service(); specs.getSpecs = async () => { throw error; };
    const path = ['workspaces', 'workspace', 'specs'];
    const response = await handleSpecsRequest(request(path), path, actor, specs, context).catch(reason => failure(reason, context.requestId));
    assert.equal(response.status, error instanceof DomainError ? 404 : 503);
    assert.doesNotMatch(await response.text(), /private-source|synthetic-token/);
  }
});
