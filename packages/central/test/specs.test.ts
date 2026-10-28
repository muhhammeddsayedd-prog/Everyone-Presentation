import assert from 'node:assert/strict';
import test from 'node:test';
import { addManualRole, createEmptySpecsDraft, DomainError, editRole, editSlot, editSpecs,
  planRoleOrder, planRoleSlotsResize, roleToDto, slotToDto } from '@eps/domain';
import { createBearerUserClient } from '../src/client.ts';
import { createCentralSpecs } from '../src/specs.ts';

// Real installed Supabase SDK; synthetic HTTP boundary and pure domain state.
// This is not PostgreSQL/RLS/provider acceptance.
const principal = '81700000-0000-4000-8000-000000000001';
const workspace = '82700000-0000-4000-8000-000000000001';
const actor = { principal_id: principal };
const config = { url: 'https://synthetic-specs.example.invalid', publishableKey: 'sb_publishable_synthetic-specs' };
const token = `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub: principal, role: 'authenticated' })).toString('base64url')}.synthetic`;
const requirements = () => ({ age_range: null, gender_requirement: null, appearance_performance: null,
  languages: [], accents: [], skills: [], scene_references: ['1', '3'], shoot_dates: [],
  location: null, availability_requirements: null, other_instructions: null });
const trace = (key?: string) => ({ requestId: 'synthetic-specs-request', clientType: 'mcp' as const, ...(key ? { idempotencyKey: key } : {}) });
const errorCode = (expected: string) => (value: unknown) => value instanceof DomainError && value.code === expected;
function fixture(override?: (name: string, args: Record<string, unknown>) => unknown) {
  let state = createEmptySpecsDraft({ id: '83700000-0000-4000-8000-000000000001', workspace_id: workspace, draft_revision: 17 });
  state.spec.source_text = 'العمر غير محدد. Original synthetic source.';
  let allocated = 0; const ids = () => `generated-${++allocated}`;
  const calls: { name: string; args: Record<string, unknown>; headers: Headers }[] = [];
  const cache = new Map<string, { input: string; result: unknown }>();
  let workspaceVersion = 19;
  const workspaceDto = () => ({ id: workspace, project_id: 'project', module: 'casting', title: 'Synthetic',
    logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: workspaceVersion,
    draft_revision: state.draft_revision, has_unpublished_changes: true, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/auth/v1/user') return Response.json({ id: principal, role: 'authenticated', aud: 'authenticated',
      email: 'synthetic@example.invalid', is_anonymous: false, app_metadata: {}, user_metadata: {}, identities: [], created_at: '2026-10-28T00:00:00Z' });
    const name = url.pathname.split('/').at(-1)!; const args = JSON.parse(String(init?.body)) as Record<string, unknown>;
    calls.push({ name, args, headers: new Headers(init?.headers) });
    if (override) { const response = override(name, args); return response instanceof Response ? response : Response.json(response); }
    try {
      const identity = `${name}:${args.p_idempotency_key}`; const fingerprint = JSON.stringify(args);
      if (args.p_idempotency_key && cache.has(identity)) {
        const cached = cache.get(identity)!;
        if (cached.input !== fingerprint) throw new DomainError('IDEMPOTENCY_KEY_REUSED', 'Synthetic mismatch', 409);
        return Response.json(cached.result);
      }
      let result: unknown;
      if (name === 'eps_get_specs') result = state.spec;
      else if (name === 'eps_update_specs') { state = editSpecs(state, args.p_input); result = state.spec; }
      else if (name === 'eps_reorder_workspace') {
        const plan = planRoleOrder(workspaceDto(), state.roles, args.p_input);
        workspaceVersion = plan.next_row_version;
        state = { ...state, draft_revision: plan.next_draft_revision, roles: state.roles.map(role => {
          const change = plan.changes.find(item => item.id === role.id);
          return change ? { ...role, sort_order: change.sort_order, row_version: role.row_version + 1 } : role;
        }) };
        result = workspaceDto();
      }
      else if (name === 'eps_list_roles') result = { data: state.roles.filter(role => !role.archived).sort((a, b) => a.sort_order - b.sort_order).map(roleToDto), page: { next_cursor: null } };
      else if (name === 'eps_create_role') { state = addManualRole(state, args.p_input, ids); result = roleToDto(state.roles.at(-1)!); }
      else if (name === 'eps_update_role') { state = editRole(state, String(args.p_role_id), args.p_input); result = roleToDto(state.roles.find(role => role.id === args.p_role_id)!); }
      else if (name === 'eps_list_slots') result = { data: state.slots.filter(slot => slot.role_id === args.p_role_id && !slot.archived).map(slotToDto), page: { next_cursor: null } };
      else if (name === 'eps_update_slot') { state = editSlot(state, String(args.p_slot_id), args.p_input); result = slotToDto(state.slots.find(slot => slot.id === args.p_slot_id)!); }
      else if (name === 'eps_resize_role_slots') {
        const role = state.roles.find(role => role.id === args.p_role_id)!;
        const plan = planRoleSlotsResize(role, state.slots.filter(slot => slot.role_id === role.id), [], args.p_input, ids);
        state = { ...state, roles: state.roles.map(item => item.id === role.id ? plan.role : item),
          slots: [...state.slots.filter(item => item.role_id !== role.id), ...plan.slots], draft_revision: state.draft_revision + 1 };
        result = roleToDto(plan.role);
      } else if (name === 'eps_archive_role') {
        const role = state.roles.find(role => role.id === args.p_role_id)!;
        assert.equal((args.p_input as { row_version: number }).row_version, role.row_version);
        const affected = state.slots.filter(slot => slot.role_id === role.id && !slot.archived);
        state = { ...state, roles: state.roles.map(item => item.id === role.id ? { ...item, archived: true, row_version: item.row_version + 1 } : item),
          slots: state.slots.map(item => item.role_id === role.id ? { ...item, archived: true } : item) };
        result = { success: true, affected_ids: [role.id, ...affected.map(slot => slot.id)] };
      } else throw new Error('Unexpected fixture RPC');
      if (args.p_idempotency_key) cache.set(identity, { input: fingerprint, result: structuredClone(result) });
      return Response.json(result);
    } catch (error) {
      if (!(error instanceof DomainError)) throw error;
      return Response.json({ code: 'P0001', message: error.code, details: JSON.stringify(error.details) }, { status: 400 });
    }
  };
  return { client: createBearerUserClient({ ...config, accessToken: token }, { fetch: fetcher }), calls };
}

test('SDK role order persists a permutation, replays its original result and rejects stale/unsupported scope', async () => {
  const data = fixture(); const service = await createCentralSpecs(data.client);
  const first = await service.createRole(actor, workspace, { name: 'First', headcount: null, requirements: requirements() }, trace('first'));
  const second = await service.createRole(actor, workspace, { name: 'Second', headcount: 1, requirements: requirements() }, trace('second'));
  const beforeSlots = await service.listSlots(actor, first.id);
  const input = { row_version: 19, role_ids: [second.id, first.id] };
  const saved = await service.reorderWorkspace(actor, workspace, input, trace('order'));
  assert.equal(saved.row_version, 20);
  assert.deepEqual(await service.reorderWorkspace(actor, workspace, input, trace('order')), saved);
  const roles = (await service.listRoles(actor, workspace)).data;
  assert.deepEqual(roles.map(role => role.id), input.role_ids);
  assert.deepEqual(await service.listSlots(actor, first.id), beforeSlots);
  await assert.rejects(service.reorderWorkspace(actor, workspace, { row_version: 19, role_ids: [first.id, second.id] }, trace('stale-order')), errorCode('STALE_RESOURCE_VERSION'));
  await assert.rejects(service.reorderWorkspace(actor, workspace, { row_version: 20, role_ids: [first.id] }, trace('invalid-order')), errorCode('ROLE_ORDER_INVALID'));
  const count = data.calls.length;
  await assert.rejects(service.reorderWorkspace(actor, workspace, { row_version: 20, slot_ids_by_role: {} }, trace('unsupported')), errorCode('FEATURE_NOT_IMPLEMENTED'));
  await assert.rejects(service.reorderWorkspace({ principal_id: 'other' }, workspace, input, trace('forged')), errorCode('ACCESS_DENIED'));
  assert.equal(data.calls.length, count);
  const bad = await createCentralSpecs(fixture(() => ({ ...saved, id: 'another-workspace' })).client);
  await assert.rejects(bad.reorderWorkspace(actor, workspace, input), errorCode('CENTRAL_RESPONSE_INVALID'));
  const unavailable = await createCentralSpecs(fixture(() => Response.json({ code: 'PGRST202', message: 'private-signature' }, { status: 404 })).client);
  await assert.rejects(unavailable.reorderWorkspace(actor, workspace, input), errorCode('FEATURE_NOT_IMPLEMENTED'));
});

test('SDK manual journey preserves source, provisional count, slot identities, edits and replay through all nine RPCs', async () => {
  const data = fixture(); const service = await createCentralSpecs(data.client);
  const spec = await service.getSpecs(actor, workspace);
  await service.updateSpecs(actor, workspace, { row_version: spec.row_version, normalized_instructions: 'Producer correction' }, trace());
  const input = { name: 'Waiter', headcount: null, requirements: requirements() };
  const role = await service.createRole(actor, workspace, input, trace('create-one'));
  assert.equal((await service.createRole(actor, workspace, input, trace('create-one'))).id, role.id);
  await assert.rejects(service.createRole(actor, workspace, { ...input, name: 'Changed' }, trace('create-one')), errorCode('IDEMPOTENCY_KEY_REUSED'));
  assert.equal(role.headcount, null);
  assert.ok(role.clarifications.some(item => item.field_path === 'headcount' && !item.resolved));
  const originalSlot = (await service.listSlots(actor, role.id)).data[0];
  const grown = await service.resizeRoleSlots(actor, role.id, { row_version: role.row_version, desired_count: 3 }, trace('grow'));
  const three = await service.listSlots(actor, role.id);
  assert.equal(three.data[0].id, originalSlot.id); assert.equal(three.data.length, 3);
  await assert.rejects(service.resizeRoleSlots(actor, role.id, { row_version: grown.row_version, desired_count: 2 }, trace('unsafe-shrink')), errorCode('SLOT_RETIREMENT_REQUIRED'));
  const smaller = await service.resizeRoleSlots(actor, role.id, { row_version: grown.row_version, desired_count: 2,
    retire_slot_ids: [three.data[1].id] }, trace('shrink'));
  const survivors = (await service.listSlots(actor, role.id)).data;
  assert.deepEqual(survivors.map(slot => slot.id), [three.data[0].id, three.data[2].id]);
  await service.updateSlot(actor, originalSlot.id, { row_version: survivors[0].row_version, label: 'Waiter A' }, trace());
  const edited = await service.updateRole(actor, role.id, { row_version: smaller.row_version,
    requirements: { ...requirements(), age_range: '20–35' } }, trace());
  await assert.rejects(service.updateRole(actor, role.id, { row_version: smaller.row_version, name: 'Stale' }, trace()), errorCode('STALE_RESOURCE_VERSION'));
  assert.equal((await service.listRoles(actor, workspace)).data[0].requirements.age_range, '20–35');
  const reloaded = await service.getSpecs(actor, workspace);
  assert.equal(reloaded.source_text, spec.source_text); assert.equal(reloaded.processing_job_id, null);
  const archived = await service.archiveRole(actor, role.id, { row_version: edited.row_version, reason: null }, trace('archive'));
  assert.equal(archived.success, true); assert.ok(archived.affected_ids.includes(role.id));
  assert.deepEqual(await service.archiveRole(actor, role.id, { row_version: edited.row_version, reason: null }, trace('archive')), archived);
  assert.equal((await service.listRoles(actor, workspace)).data.length, 0);
  assert.ok(data.calls.every(call => call.headers.get('authorization') === `Bearer ${token}`));
  assert.equal(data.calls.find(call => call.name === 'eps_create_role')?.headers.get('x-eps-client-type'), 'mcp');
  assert.equal(data.calls.find(call => call.name === 'eps_create_role')?.headers.get('x-eps-request-id'), 'synthetic-specs-request');
});

test('malformed or private DTO fields and cross-scope list responses fail closed', async () => {
  const spec = { id: 'spec', workspace_id: workspace, source_asset_id: null, source_text: null,
    normalized_instructions: null, clarifications: [], row_version: 1, processing_job_id: null };
  for (const response of [{ ...spec, source_extraction: { private: true } }, { ...spec, workspace_id: 'other' },
    { ...spec, row_version: 0 }, { ...spec, clarifications: [{ field_path: 'age', reason: 'Unknown', source: null }] }]) {
    const service = await createCentralSpecs(fixture(() => response).client);
    await assert.rejects(service.getSpecs(actor, workspace), errorCode('CENTRAL_RESPONSE_INVALID'));
  }
  const role = { id: 'role', workspace_id: workspace, name: 'Waiter', headcount: null, category: null,
    requirements: requirements(), clarifications: [], sort_order: 0, row_version: 1, archived: false };
  for (const response of [{ data: [{ ...role, workspace_id: 'other' }], page: { next_cursor: null } },
    { data: [{ ...role, requirements: { ...requirements(), languages: [42] } }], page: { next_cursor: null } },
    { data: [role, role], page: { next_cursor: null } }, { data: [role], page: { next_cursor: 'not-last-role' } }]) {
    const service = await createCentralSpecs(fixture(() => response).client);
    await assert.rejects(service.listRoles(actor, workspace), errorCode('CENTRAL_RESPONSE_INVALID'));
  }
  const foreignCursor = await createCentralSpecs(fixture(() => ({ data: [role], page: { next_cursor: 'another-role' } })).client);
  await assert.rejects(foreignCursor.listRoles(actor, workspace, { limit: 1 }), errorCode('CENTRAL_RESPONSE_INVALID'));
  const slot = { id: 'slot', role_id: 'role', label: 'Waiter 1', sort_order: 0, row_version: 1, archived: false };
  for (const response of [{ ...slot, provisional: true }, { ...slot, role_id: 'other' }, { ...slot, sort_order: -1 }]) {
    const service = await createCentralSpecs(fixture(() => ({ data: [response], page: { next_cursor: null } })).client);
    await assert.rejects(service.listSlots(actor, 'role'), errorCode('CENTRAL_RESPONSE_INVALID'));
  }
  for (const response of [{ success: false, affected_ids: ['role'] }, { success: true, affected_ids: [] },
    { success: true, affected_ids: ['role', 'role'] }, { success: true, affected_ids: ['role'], receipt: 'private' }]) {
    const service = await createCentralSpecs(fixture(() => response).client);
    await assert.rejects(service.archiveRole(actor, 'role', { row_version: 1 }, trace('archive-invalid')), errorCode('CENTRAL_RESPONSE_INVALID'));
  }
});

test('forged principals/source fields, invalid count/reason and missing intent never reach RPC', async () => {
  const data = fixture(); const service = await createCentralSpecs(data.client);
  await assert.rejects(service.getSpecs({ principal_id: 'another' }, workspace), errorCode('ACCESS_DENIED'));
  await assert.rejects(service.createRole(actor, workspace, { name: 'Waiter', headcount: 0, requirements: requirements() }, trace('zero')));
  await assert.rejects(service.createRole(actor, workspace, { name: 'Waiter', headcount: 1, requirements: requirements() }));
  await assert.rejects(service.updateSpecs(actor, workspace, { row_version: 1, source_text: 'Forged' } as never));
  await assert.rejects(service.updateRole(actor, 'role', { row_version: 1, principal_id: 'forged' } as never));
  await assert.rejects(service.archiveRole(actor, 'role', { row_version: 1, reason: 42 } as never, trace('bad-reason')));
  await assert.rejects(service.listSlots(actor, 'role', { limit: 101 }));
  assert.equal(data.calls.length, 0);
});

test('new domain errors retain safe actionable codes and redact provider bodies/prototype keys', async () => {
  for (const [code, status] of [['SLOT_ALLOCATION_LIMIT_EXCEEDED', 422], ['SLOT_RETIREMENT_REQUIRED', 409],
    ['SLOT_RETIREMENT_INVALID', 409], ['SPECS_STATE_INVALID', 409], ['ASSIGNMENT_RETIREMENT_UNAVAILABLE', 503]] as const) {
    const data = fixture(() => Response.json({ code: 'P0001', message: code, details: 'private-provider-detail' }, { status: 400 }));
    const service = await createCentralSpecs(data.client);
    await assert.rejects(service.getSpecs(actor, workspace), value => value instanceof DomainError
      && value.code === code && value.status === status && !JSON.stringify(value).includes('private-provider-detail'));
  }
  for (const code of ['toString', 'constructor', '__proto__']) {
    const data = fixture(() => Response.json({ code: 'P0001', message: code, details: 'private-provider-detail' }, { status: 400 }));
    const service = await createCentralSpecs(data.client);
    await assert.rejects(service.getSpecs(actor, workspace), value => value instanceof DomainError
      && value.code === 'DEPENDENCY_UNAVAILABLE' && value.status === 503 && !JSON.stringify(value).includes('private-provider-detail'));
  }
});
