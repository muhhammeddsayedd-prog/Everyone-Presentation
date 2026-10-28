import { expect, test, type Page } from '@playwright/test';
import { addManualRole, createEmptySpecsDraft, planRoleOrder, roleToDto } from '@eps/domain';

// Controlled browser/HTTP acceptance only; no Supabase, provider or real identity.
const projectId = '82700000-0000-4000-8000-000000000001';
const workspaceId = '83700000-0000-4000-8000-000000000001';
const path = `/projects/${projectId}/casting/${workspaceId}/specs`;
async function controlledOrder(page: Page, mode: 'normal' | 'unavailable' | 'lost' | 'stale' = 'normal') {
  let draft = createEmptySpecsDraft({ id: 'spec', workspace_id: workspaceId, draft_revision: 17 });
  let counter = 0; const allocate = () => `allocated-${++counter}`;
  const requirements = { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [],
    skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
  for (const name of ['First', 'Second', 'Third']) draft = addManualRole(draft, { name, headcount: 1, requirements }, allocate);
  let rowVersion = 19; let attempted = false;
  const calls: { key: string; input: unknown }[] = []; const cache = new Map<string, unknown>();
  const workspace = () => ({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic Order Project',
    logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: rowVersion,
    draft_revision: draft.draft_revision, has_unpublished_changes: true, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
  const order = () => draft.roles.filter(role => !role.archived).sort((a, b) => a.sort_order - b.sort_order);
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const pathname = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-order', data } });
    const fail = (status: number, code: string, message: string) => route.fulfill({ status, json: { request_id: 'synthetic-order', error: { code, message, details: {}, retryable: false } } });
    if (pathname === '/api/session') return ok({ mode: 'supabase', actor: { id: 'producer', name: 'Synthetic Order Producer',
      capabilities: ['projects.read', 'workspaces.read', 'workspaces.write'], upload_purposes: [] }, actors: [] });
    if (pathname === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic Order Project', client_id: null,
      client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: false });
    if (pathname === `/api/v1/workspaces/${workspaceId}`) return ok(workspace());
    if (pathname === `/api/v1/workspaces/${workspaceId}/specs`) return ok(draft.spec);
    if (pathname === `/api/v1/workspaces/${workspaceId}/roles`) return route.fulfill({ json: { request_id: 'synthetic-order',
      data: order().map(roleToDto), page: { next_cursor: null } } });
    if (pathname === `/api/v1/workspaces/${workspaceId}/order` && request.method() === 'PUT') {
      const input = request.postDataJSON(); const key = request.headers()['idempotency-key']; calls.push({ key, input });
      if (mode === 'unavailable') return fail(503, 'FEATURE_NOT_IMPLEMENTED', 'Role ordering is not available yet. Your saved order has been kept.');
      if (cache.has(key)) return ok(cache.get(key));
      if (mode === 'stale' && !attempted) { attempted = true; rowVersion++; return fail(409, 'STALE_RESOURCE_VERSION', 'Synthetic stale workspace.'); }
      const plan = planRoleOrder(workspace(), draft.roles, input); rowVersion = plan.next_row_version;
      draft = { ...draft, draft_revision: plan.next_draft_revision, roles: draft.roles.map(role => {
        const change = plan.changes.find(item => item.id === role.id);
        return change ? { ...role, sort_order: change.sort_order, row_version: role.row_version + 1 } : role;
      }) };
      cache.set(key, structuredClone(workspace()));
      if (mode === 'lost' && !attempted) { attempted = true; return fail(503, 'DEPENDENCY_UNAVAILABLE', 'The order response was interrupted.'); }
      return ok(workspace());
    }
    return fail(503, 'CONTROLLED_ROUTE_NOT_IMPLEMENTED', 'This controlled operation is not available.');
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  return { calls, names: () => order().map(role => role.name), slots: () => structuredClone(draft.slots), errors };
}

test('controlled role move persists exact identities/order across reload', async ({ page }, testInfo) => {
  const model = await controlledOrder(page); const slots = model.slots(); await page.goto(path);
  await page.getByLabel('New role name', { exact: true }).fill('Unsaved role');
  await expect(page.getByRole('button', { name: 'Move Second up', exact: true })).toBeDisabled();
  await page.getByLabel('New role name', { exact: true }).fill('');
  await page.getByRole('button', { name: 'Move Second up', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Role order saved\.$/ })).toBeVisible();
  expect(model.names()).toEqual(['Second', 'First', 'Third']); expect(model.slots()).toEqual(slots);
  expect(await page.locator('.role-editor h3').allTextContents()).toEqual(['Second', 'First', 'Third']);
  await page.reload(); await expect(page.getByRole('button', { name: 'Move Second up', exact: true })).toBeDisabled();
  expect(await page.locator('.role-editor h3').allTextContents()).toEqual(['Second', 'First', 'Third']);
  await page.setViewportSize({ width: 320, height: 900 });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('controlled-role-order-320.png'), fullPage: true });
  expect(model.errors).toEqual([]);
});

test('controlled unavailable backend keeps saved order and permits ordinary edits', async ({ page }) => {
  const model = await controlledOrder(page, 'unavailable'); await page.goto(path);
  await page.getByRole('button', { name: 'Move Second up', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Role ordering is not available yet' })).toBeVisible();
  expect(model.names()).toEqual(['First', 'Second', 'Third']);
  await expect(page.getByRole('button', { name: 'Add role', exact: true })).toBeEnabled();
  await expect(page.getByRole('status').filter({ hasText: /^Role order saved\.$/ })).toHaveCount(0);
  expect(model.calls).toHaveLength(1); expect(model.errors).toEqual([]);
});

test('controlled lost response locks edits and retries identical key/body without a second effect', async ({ page }) => {
  const model = await controlledOrder(page, 'lost'); await page.goto(path);
  await page.getByRole('button', { name: 'Move Second up', exact: true }).click();
  const alert = page.getByRole('alert').filter({ hasText: 'The order response was interrupted.' });
  await expect(alert).toBeVisible();
  await expect(page.getByRole('button', { name: 'Move Third up', exact: true })).toBeDisabled();
  await expect(page.getByLabel('General instructions', { exact: true })).toHaveAttribute('readonly', '');
  expect(model.names()).toEqual(['Second', 'First', 'Third']);
  await alert.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: /^Role order saved\.$/ })).toBeVisible();
  expect(model.calls).toHaveLength(2); expect(model.calls[1]).toEqual(model.calls[0]);
  expect(model.names()).toEqual(['Second', 'First', 'Third']); expect(model.errors).toEqual([]);
});

test('controlled stale move retains visible order until explicit reload', async ({ page }) => {
  const model = await controlledOrder(page, 'stale'); await page.goto(path);
  await page.getByRole('button', { name: 'Move Second up', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Reload the saved details' })).toBeVisible();
  expect(model.names()).toEqual(['First', 'Second', 'Third']);
  await expect(page.getByRole('button', { name: 'Move Third up', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Reload saved requirements', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Move Second up', exact: true })).toBeEnabled();
  expect(model.calls).toHaveLength(1); expect(model.errors).toEqual([]);
});
