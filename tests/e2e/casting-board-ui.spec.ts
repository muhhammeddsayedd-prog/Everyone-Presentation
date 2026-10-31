import { expect, test, type Page } from '@playwright/test';

// Synthetic HTTP/DOM regression checks. Canonical transactions and actual
// signed-in app acceptance have separate receipts.
test.use({ actionTimeout: 10000 });
const project = '88000000-0000-4000-8000-000000000001';
const workspace = '88000000-0000-4000-8000-000000000002';
const roleA = '88000000-0000-4000-8000-000000000003';
const roleB = '88000000-0000-4000-8000-000000000004';
const slotA = '88000000-0000-4000-8000-000000000005';
const slotB = '88000000-0000-4000-8000-000000000006';
const path = '/projects/' + project + '/casting/' + workspace + '/organize';
async function board(page: Page, options: { lost?: boolean; deniedRetry?: boolean; readOnly?: boolean } = {}) {
  let version = 1; let revision = 0; let output = 'selection'; let next = 100; let lost = false; let deniedRetry = false;
  const stamp = '2026-10-29T00:00:00Z';
  const roles = [{ id: roleA, name: 'Father' }, { id: roleB, name: 'Manager' }].map((r, sort_order) => ({
    ...r, workspace_id: workspace, headcount: 1, archived: false, row_version: 1, sort_order,
    requirements: { age_range: null, gender_requirement: null, languages: [], skills: [] },
  }));
  const slots = [{ id: slotA, role_id: roleA, label: 'Father 1' }, { id: slotB, role_id: roleB, label: 'Manager 1' }]
    .map(s => ({ ...s, archived: false, row_version: 1, sort_order: 0 }));
  const pool = [1, 2, 3].map(n => ({ id: 'pool-' + n, workspace_id: workspace, candidate_id: 'person-' + n,
    availability: null, selected_frame_asset_ids: [], fresh_material_required: false }));
  type Assignment = { id: string; workspace_id: string; slot_id: string; workspace_candidate_id: string;
    position: string; shortlist_included: boolean; presentation_notes: string | null; internal_notes: string | null;
    sort_order: number; row_version: number; archived: boolean; slide_wording: Record<string, string>; created_at: string; updated_at: string };
  const assignments: Assignment[] = [];
  const calls: { path: string; method: string; key: string; body: Record<string, unknown> }[] = [];
  const cache = new Map<string, unknown>();
  const current = () => ({ id: workspace, project_id: project, module: 'casting', title: 'Synthetic casting project',
    active_output: output, row_version: version, draft_revision: revision, has_unpublished_changes: revision > 0,
    logo_asset_id: null, logo_placement: 'cover', created_at: stamp, updated_at: stamp });
  await page.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const method = req.method();
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-casting', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-casting', data, page: { next_cursor: null } } });
    const fail = (status: number, code: string) => route.fulfill({ status, json: { request_id: 'synthetic-casting',
      error: { code, message: 'The synthetic response was interrupted.', details: {}, retryable: status >= 500 } } });
    if (p === '/api/session') return ok({ mode: 'supabase', actor: { id: 'test-producer', name: 'Synthetic Producer',
      capabilities: ['projects.read', 'workspaces.read', 'cast.read', ...(options.readOnly ? [] : ['workspaces.write'])], upload_purposes: [] }, actors: [] });
    if (method === 'GET' && p === '/api/v1/projects/' + project) return ok({ id: project, name: 'Synthetic casting project',
      client_name: null, client_id: null, client_logo_asset_id: null, row_version: 1, casting_workspace_id: workspace, can_edit: false });
    if (method === 'GET' && p === '/api/v1/workspaces/' + workspace) return ok(current());
    if (method === 'GET' && p.endsWith('/roles')) return list(roles);
    if (method === 'GET' && p.endsWith('/slots')) return list(slots.filter(s => p.includes(s.role_id)));
    if (method === 'GET' && p === '/api/v1/workspaces/' + workspace + '/candidates') return list(pool);
    if (method === 'GET' && p.endsWith('/assignments')) return list(assignments.filter(a => !a.archived));
    if (method === 'GET' && p.startsWith('/api/v1/candidates/')) {
      const id = p.split('/').at(-1)!; return ok({ id, facts: { name: 'Synthetic ' + id }, review_status: 'unreviewed', archived: false });
    }
    if (!['PATCH', 'POST', 'PUT'].includes(method)) return fail(404, 'NOT_FOUND');
    const body = req.postDataJSON(); const key = req.headers()['idempotency-key'];
    calls.push({ path: p, method, key, body });
    if (options.deniedRetry && lost && !deniedRetry) { deniedRetry = true; return fail(403, 'CAPABILITY_REQUIRED'); }
    if (cache.has(key)) return ok(cache.get(key));
    if (options.readOnly) return fail(403, 'CAPABILITY_REQUIRED');
    let result: unknown;
    if (p === '/api/v1/workspaces/' + workspace && method === 'PATCH') {
      expect(body.row_version).toBe(version); output = body.active_output; result = current();
    } else if (p.endsWith('/order') && method === 'PUT') {
      expect(body.row_version).toBe(version); expect(new Set(body.role_ids)).toEqual(new Set(roles.map(r => r.id)));
      for (const r of roles) { r.sort_order = body.role_ids.indexOf(r.id); r.row_version++; }
      version++; revision++; result = { success: true, affected_ids: body.role_ids };
    } else if (p.endsWith('/assignments') && method === 'POST') {
      const slot = slots.find(s => s.id === body.slot_id)!; expect(body.expected_slot_row_version).toBe(slot.row_version);
      const row: Assignment = { id: 'assignment-' + ++next, workspace_id: workspace, slot_id: slot.id,
        workspace_candidate_id: body.workspace_candidate_id, position: 'option', shortlist_included: body.shortlist_included,
        presentation_notes: null, internal_notes: null, sort_order: assignments.filter(a => a.slot_id === slot.id && !a.archived).length,
        row_version: 1, archived: false, slide_wording: {}, created_at: stamp, updated_at: stamp };
      expect(assignments.some(a => !a.archived && a.slot_id === row.slot_id && a.workspace_candidate_id === row.workspace_candidate_id)).toBe(false);
      assignments.push(row); slot.row_version++; revision++; version++; result = row;
    } else if (p.startsWith('/api/v1/assignments/') && method === 'PATCH') {
      const row = assignments.find(a => a.id === p.split('/').at(-1))!; expect(body.row_version).toBe(row.row_version);
      Object.assign(row, body, { row_version: row.row_version + 1 }); revision++; version++; result = row;
    } else return fail(404, 'NOT_FOUND');
    cache.set(key, structuredClone(result));
    if (options.lost && method === 'PATCH' && p.includes('/assignments/') && !lost) { lost = true; return fail(503, 'DEPENDENCY_UNAVAILABLE'); }
    return ok(result);
  });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  return { calls, assignments, errors, output: () => output };
}

test('casting integration persists one output control and independent same-person assignments', async ({ page }) => {
  const model = await board(page); await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Casting choices', exact: true })).toBeVisible();
  await expect(page.getByLabel('Working output', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Shortlist', exact: true }).click();
  await expect.poll(model.output).toBe('shortlist');
  await expect(page.getByRole('button', { name: 'Shortlist', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Shortlist', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('combobox', { name: 'Project candidate', exact: true }).selectOption('pool-1');
  await page.getByRole('button', { name: 'Add to Shortlist', exact: true }).click();
  await expect.poll(() => model.assignments.length).toBe(1);
  await expect(page.getByRole('button', { name: 'Assign as Option', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Manager', exact: true }).click();
  await page.getByRole('combobox', { name: 'Project candidate', exact: true }).selectOption('pool-1');
  await page.getByRole('button', { name: 'Add to Shortlist', exact: true }).click();
  await expect.poll(() => model.assignments.length).toBe(2);
  expect(model.assignments.map(a => a.workspace_candidate_id)).toEqual(['pool-1', 'pool-1']);
  expect(model.assignments.map(a => a.slot_id)).toEqual([slotA, slotB]);
  expect(model.assignments.every(a => a.position === 'option' && a.shortlist_included)).toBe(true);
  await expect(page.getByText('2 assigned entries · 0 Pending slots', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Selection', exact: true }).click();
  await expect.poll(model.output).toBe('selection');
  await expect(page.getByText('2 assigned entries · 0 Pending slots', { exact: true })).toBeVisible();
  expect(model.errors).toEqual([]);
});

test('casting unknown write locks changes and retries exactly without a second effect', async ({ page }) => {
  const model = await board(page, { lost: true }); await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Casting choices', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Project candidate', exact: true }).selectOption('pool-1');
  await page.getByRole('button', { name: 'Assign as Option', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Include in Shortlist', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Include in Shortlist', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry same change', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Assignment actions for / }).first()).toBeDisabled();
  await page.getByRole('button', { name: 'Retry same change', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Include in Shortlist', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Retry same change', exact: true })).toHaveCount(0);
  const changes = model.calls.filter(c => c.path.includes('/assignments/') && c.method === 'PATCH');
  expect(changes).toHaveLength(2); expect(changes[1]).toEqual(changes[0]);
  expect(model.assignments[0].row_version).toBe(2); expect(model.errors).toEqual([]);
});

test('casting retains an unknown write after a later denial until the same acknowledgement returns', async ({ page }) => {
  const model = await board(page, { lost: true, deniedRetry: true }); await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Casting choices', exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Project candidate', exact: true }).selectOption('pool-1');
  await page.getByRole('button', { name: 'Assign as Option', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Include in Shortlist', exact: true })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Include in Shortlist', exact: true }).click();
  const retry = page.getByRole('button', { name: 'Retry same change', exact: true });
  await expect(retry).toBeVisible(); await retry.click();
  await expect(page.getByRole('alert').filter({ hasText: 'The synthetic response was interrupted.' })).toBeVisible();
  await expect(retry).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload saved board', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: /^Assignment actions for / }).first()).toBeDisabled();
  await retry.click();
  await expect(page.getByRole('checkbox', { name: 'Include in Shortlist', exact: true })).toBeChecked();
  await expect(retry).toHaveCount(0);
  const changes = model.calls.filter(c => c.path.includes('/assignments/') && c.method === 'PATCH');
  expect(changes).toHaveLength(3); expect(changes[1]).toEqual(changes[0]); expect(changes[2]).toEqual(changes[0]);
  expect(model.assignments[0].row_version).toBe(2); expect(model.errors).toEqual([]);
});

test('casting read-only and narrow-screen states retain keyboard access without writes', async ({ page }, testInfo) => {
  const model = await board(page, { readOnly: true }); await page.setViewportSize({ width: 320, height: 900 }); await page.goto(path);
  await expect(page.getByRole('heading', { name: 'Casting choices', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assign as Option', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Manager', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Manager', exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('casting-readonly-320.png'), fullPage: true });
  expect(model.calls).toEqual([]); expect(model.errors).toEqual([]);
});


test('casting pointer and keyboard ordering share the saved order across reload', async ({ page }) => {
  const model = await board(page); await page.goto(path);
  const father = page.getByRole('button', { name: 'Drag role Father to reorder', exact: true });
  const manager = page.getByRole('button', { name: 'Drag role Manager to reorder', exact: true });
  await expect(father).toHaveAttribute('draggable', 'true');
  await manager.scrollIntoViewIfNeeded();
  await father.dragTo(manager);
  await expect(page.getByRole('status').filter({ hasText: /^Casting order saved\.$/ })).toBeVisible();
  expect(model.calls.at(-1)?.body.role_ids).toEqual([roleB, roleA]);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Move role Father earlier', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Move role Father earlier', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({ hasText: /^Casting order saved\.$/ })).toBeVisible();
  expect(model.calls.at(-1)?.body.role_ids).toEqual([roleA, roleB]);
  expect(model.errors).toEqual([]);
});
