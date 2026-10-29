import assert from 'node:assert/strict';
import test from 'node:test';
import type { Envelope } from '../../apps/web/components/api';
import { readCastingRetirementPreview, type CastingReadPort } from '../../apps/web/components/casting-retirement';

function fixture() {
  const paths: string[] = []; let workspaceReads = 0;
  const workspace = { id: 'workspace', project_id: 'project', row_version: 8, draft_revision: 7 };
  const roles = [{ id: 'father', workspace_id: 'workspace', name: 'Father', sort_order: 0, row_version: 2, archived: false },
    { id: 'manager', workspace_id: 'workspace', name: 'Manager', sort_order: 1, row_version: 1, archived: false }];
  const slots = [{ id: 'father-1', role_id: 'father', label: 'Father 1', sort_order: 0, row_version: 2, archived: false },
    { id: 'manager-1', role_id: 'manager', label: 'Manager 1', sort_order: 0, row_version: 3, archived: false }];
  const pool = [{ id: 'person', candidate_id: 'person-profile', workspace_id: 'workspace', row_version: 3 }, { id: 'other', candidate_id: 'other-profile', workspace_id: 'workspace', row_version: 1 }];
  const assignments = [{ id: 'a1', workspace_id: 'workspace', slot_id: 'father-1', workspace_candidate_id: 'person', position: 'main', shortlist_included: true,
    presentation_notes: 'This assignment only', internal_notes: null, sort_order: 0, row_version: 1, archived: false },
  { id: 'a2', workspace_id: 'workspace', slot_id: 'manager-1', workspace_candidate_id: 'person', position: 'option', shortlist_included: false,
    presentation_notes: null, internal_notes: 'Private internal note', sort_order: 0, row_version: 1, archived: false },
  { id: 'a3', workspace_id: 'workspace', slot_id: 'father-1', workspace_candidate_id: 'other', position: 'backup', shortlist_included: false,
    presentation_notes: null, internal_notes: null, sort_order: 1, row_version: 1, archived: false }];
  let alter: (path: string, response: Record<string, unknown>) => Record<string, unknown> = (_path, response) => response;
  const read: CastingReadPort = async <T,>(path: string, init: RequestInit): Promise<Envelope<T>> => {
    paths.push(path); assert.equal(init.method, undefined); assert.ok(init.signal);
    let data: unknown; let page: { next_cursor: string | null } | undefined;
    const url = new URL(path, 'http://synthetic.invalid');
    if (url.pathname === '/api/v1/workspaces/workspace') { workspaceReads++; data = { ...workspace }; }
    else {
      page = { next_cursor: null };
      if (url.pathname.endsWith('/roles')) data = roles;
      else if (url.pathname.endsWith('/candidates')) data = pool;
      else if (url.pathname.endsWith('/assignments')) {
        assert.equal(url.searchParams.get('output_type'), 'selection');
        data = url.searchParams.get('cursor') ? assignments.slice(1) : assignments.slice(0, 1);
        page.next_cursor = url.searchParams.get('cursor') ? null : 'next-assignment-page';
      } else data = slots.filter(slot => url.pathname.includes('/' + slot.role_id + '/'));
    }
    return alter(path, { request_id: 'synthetic-preview', data, ...(page ? { page } : {}) }) as Envelope<T>;
  };
  return { read, paths, workspace, roles, slots, pool, assignments, workspaceReads: () => workspaceReads, alter: (callback: typeof alter) => { alter = callback; } };
}

test('retirement preview reads every Selection page and shows this participation independently across roles', async () => {
  const h = fixture(); const result = await readCastingRetirementPreview('workspace', { kind: 'workspace_candidate', id: 'person', row_version: 3 }, new AbortController().signal, h.read);
  assert.deepEqual(result.choices.map(row => [row.assignment_id, row.role, row.slot, row.position, row.shortlisted]),
    [['a1', 'Father', 'Father 1', 'main', true], ['a2', 'Manager', 'Manager 1', 'option', false]]);
  assert.equal(result.choices[0].has_presentation_notes, true); assert.equal(result.choices[1].has_internal_notes, true);
  assert.equal(JSON.stringify(result).includes('Private internal note'), false);
  assert.equal(h.paths[0], '/api/v1/workspaces/workspace'); assert.equal(h.paths.at(-1), '/api/v1/workspaces/workspace');
  assert.equal(h.workspaceReads(), 2); assert.equal(result.draft_revision, 7);
});

test('role and selected-slot previews retain every affected person and reject foreign or stale scopes', async () => {
  const h = fixture();
  for (const scope of [{ kind: 'role' as const, id: 'father', row_version: 2 }, { kind: 'slots' as const, id: 'father', row_version: 2, slot_ids: ['father-1'] }]) {
    const result = await readCastingRetirementPreview('workspace', scope, new AbortController().signal, h.read);
    assert.deepEqual(result.choices.map(row => row.assignment_id), ['a1', 'a3']);
  }
  for (const scope of [{ kind: 'role' as const, id: 'father', row_version: 1 }, { kind: 'slots' as const, id: 'manager', row_version: 1, slot_ids: ['father-1'] }]) {
    await assert.rejects(readCastingRetirementPreview('workspace', scope, new AbortController().signal, h.read));
  }
});

test('incomplete, duplicate, cross-scope or changing data never becomes an empty retirement preview', async () => {
  for (const change of ['missing-page', 'duplicate', 'foreign', 'missing-parent', 'revision', 'empty-page-with-cursor']) {
    const h = fixture(); h.alter((path, response) => {
      if (path.includes('/assignments')) {
        if (change === 'missing-page') delete response.page;
        if (change === 'duplicate') response.data = [h.assignments[0], h.assignments[0]];
        if (change === 'foreign') response.data = [{ ...h.assignments[0], workspace_id: 'another' }];
        if (change === 'missing-parent') response.data = [{ ...h.assignments[0], slot_id: 'unknown-slot' }];
        if (change === 'empty-page-with-cursor') response.data = [];
      }
      if (change === 'revision' && h.workspaceReads() > 1 && path === '/api/v1/workspaces/workspace') response.data = { ...h.workspace, draft_revision: 8 };
      return response;
    });
    await assert.rejects(readCastingRetirementPreview('workspace', { kind: 'workspace_candidate', id: 'person', row_version: 3 }, new AbortController().signal, h.read), Error, change);
  }
});

test('failed preview reads propagate without a fabricated zero-choice result', async () => {
  const h = fixture(); const unavailable: CastingReadPort = async (path, init) => {
    if (path.includes('/assignments')) throw new Error('Synthetic unavailable preview');
    return h.read(path, init);
  };
  await assert.rejects(readCastingRetirementPreview('workspace', { kind: 'role', id: 'father', row_version: 2 }, new AbortController().signal, unavailable), /Synthetic unavailable/);
});
