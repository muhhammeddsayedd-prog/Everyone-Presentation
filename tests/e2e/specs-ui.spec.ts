import { test, expect, type Page } from '@playwright/test';
import { addManualRole, createEmptySpecsDraft, editRole, editSlot, editSpecs, parseRolePatch,
  planRoleSlotsResize, roleToDto, slotToDto, type RoleCreate } from '@eps/domain';

// Controlled HTTP/DOM tests only. No Supabase/Auth/Storage/provider is contacted;
// actual SQL/RLS/transactions have separately labelled PostgreSQL receipts.
const projectId = '82700000-0000-4000-8000-000000000001';
const workspaceId = '83700000-0000-4000-8000-000000000001';
const base = `/projects/${projectId}/casting/${workspaceId}/specs`;
async function controlledWorkspace(page: Page, options: { empty?: boolean; loseCreateResponse?: boolean; stalePatch?: boolean } = {}) {
  let draft = createEmptySpecsDraft({ id: '84700000-0000-4000-8000-000000000001', workspace_id: workspaceId, draft_revision: 0 });
  let allocated = 0; const allocate = () => `85700000-0000-4000-8000-${String(++allocated).padStart(12, '0')}`;
  if (!options.empty) {
    draft = addManualRole(draft, { name: 'Waiter', headcount: null, requirements: { age_range: null, gender_requirement: null,
      appearance_performance: null, languages: [], accents: [], skills: ['Tray carrying\nand balancing', '  Supplied wording  '],
      scene_references: ['Scene 1', 'Scene 3'], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null } }, allocate);
  }
  const originalSlot = draft.slots[0]?.id;
  const rolePatches: { key: string; input: ReturnType<typeof parseRolePatch> }[] = [];
  const creates: { key: string; input: unknown }[] = []; let slotGets = 0; let lost = false; let stale = false;
  const cache = new Map<string, unknown>();
  let releaseArchive: (() => void) | undefined;
  const archiveWait = new Promise<void>(resolve => { releaseArchive = resolve; });
  const workspace = () => ({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic Specs Project', logo_asset_id: null,
    logo_placement: 'cover', active_output: 'selection', row_version: draft.draft_revision + 1, draft_revision: draft.draft_revision,
    has_unpublished_changes: draft.draft_revision > 0, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const envelope = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'synthetic-ui-request', data } });
    const failure = (code: string, status: number) => route.fulfill({ status, json: { request_id: 'synthetic-ui-request', error: { code, message: 'The controlled request could not be confirmed.', details: {}, retryable: true } } });
    if (path === '/api/session') return envelope({ mode: 'supabase', actor: { id: '81700000-0000-4000-8000-000000000001', name: 'Synthetic Specs Producer',
      capabilities: ['projects.read', 'projects.write', 'workspaces.read', 'workspaces.write'], upload_purposes: [] }, actors: [] });
    if (method === 'GET' && path === `/api/v1/projects/${projectId}`) return envelope({ id: projectId, name: 'Synthetic Specs Project', client_id: null,
      client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: true });
    if (method === 'GET' && path === `/api/v1/workspaces/${workspaceId}`) return envelope(workspace());
    if (method === 'GET' && path === `/api/v1/workspaces/${workspaceId}/specs`) return envelope(draft.spec);
    if (method === 'PATCH' && path === `/api/v1/workspaces/${workspaceId}/specs`) { draft = editSpecs(draft, request.postDataJSON()); return envelope(draft.spec); }
    if (method === 'GET' && path === `/api/v1/workspaces/${workspaceId}/roles`) return route.fulfill({ json: { request_id: 'synthetic-ui-request', data: draft.roles.filter(role => !role.archived).map(roleToDto), page: { next_cursor: null } } });
    const key = request.headers()['idempotency-key'];
    if (method === 'POST' && path === `/api/v1/workspaces/${workspaceId}/roles`) {
      creates.push({ key, input: request.postDataJSON() });
      if (cache.has(key)) return envelope(cache.get(key), 201);
      draft = addManualRole(draft, request.postDataJSON() as RoleCreate, allocate);
      const result = roleToDto(draft.roles.at(-1)!); cache.set(key, result);
      if (options.loseCreateResponse && !lost) { lost = true; return failure('DEPENDENCY_UNAVAILABLE', 503); }
      return envelope(result, 201);
    }
    const roleId = /^\/api\/v1\/roles\/([^/]+)/u.exec(path)?.[1];
    if (roleId && method === 'GET' && path.endsWith('/slots')) {
      slotGets++; return route.fulfill({ json: { request_id: 'synthetic-ui-request', data: draft.slots.filter(slot => slot.role_id === roleId && !slot.archived).map(slotToDto), page: { next_cursor: null } } });
    }
    if (roleId && method === 'POST' && path.endsWith('/slots/resize')) {
      const role = draft.roles.find(role => role.id === roleId)!;
      const plan = planRoleSlotsResize(role, draft.slots.filter(slot => slot.role_id === roleId), [], request.postDataJSON(), allocate);
      draft = { ...draft, roles: draft.roles.map(role => role.id === roleId ? plan.role : role), slots: [...draft.slots.filter(slot => slot.role_id !== roleId), ...plan.slots], draft_revision: draft.draft_revision + 1 };
      return envelope(roleToDto(plan.role));
    }
    if (roleId && method === 'POST' && path.endsWith('/archive')) {
      await archiveWait; draft = { ...draft, roles: draft.roles.map(role => role.id === roleId ? { ...role, archived: true, row_version: role.row_version + 1 } : role), draft_revision: draft.draft_revision + 1 };
      return envelope({ success: true, affected_ids: [roleId] });
    }
    if (roleId && method === 'PATCH') {
      const input = parseRolePatch(request.postDataJSON()); rolePatches.push({ key, input });
      if (options.stalePatch && !stale) {
        stale = true; const role = draft.roles.find(role => role.id === roleId)!;
        draft = editRole(draft, roleId, { row_version: role.row_version, name: 'External correction' });
        return failure('STALE_RESOURCE_VERSION', 409);
      }
      draft = editRole(draft, roleId, input); return envelope(roleToDto(draft.roles.find(role => role.id === roleId)!));
    }
    const slotId = /^\/api\/v1\/slots\/([^/]+)$/u.exec(path)?.[1];
    if (slotId && method === 'PATCH') { draft = editSlot(draft, slotId, request.postDataJSON()); return envelope(slotToDto(draft.slots.find(slot => slot.id === slotId)!)); }
    return failure('CONTROLLED_ROUTE_NOT_IMPLEMENTED', 503);
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  return { rolePatches, creates, originalSlot, slots: () => draft.slots, roles: () => draft.roles, slotGets: () => slotGets, errors,
    releaseArchive: () => releaseArchive?.() };
}

test('controlled specs UI preserves supplied text, count clarifications and explicit slot retirement', async ({ page }, testInfo) => {
  const model = await controlledWorkspace(page);
  await page.goto(base);
  await expect(page.getByRole('heading', { name: 'General requirements' })).toBeVisible();
  expect(model.slotGets()).toBe(0);
  const article = page.locator('.role-editor');
  await article.locator('summary').filter({ hasText: 'Edit requirements' }).click();
  await article.getByLabel('Role name', { exact: true }).fill('Server');
  await expect.poll(() => model.roles()[0].name).toBe('Server');
  await expect(article.getByRole('status').filter({ hasText: /^Saved$/ })).toBeVisible();
  expect(model.rolePatches[0].input.requirements?.skills).toEqual(['Tray carrying\nand balancing', '  Supplied wording  ']);
  await article.locator('.role-slots-disclosure > summary').click();
  await article.getByLabel('Required people', { exact: true }).fill('3');
  await article.getByRole('button', { name: 'Confirm required count', exact: true }).click();
  await expect.poll(() => model.roles()[0].headcount).toBe(3);
  await expect(article.getByRole('checkbox', { name: 'Clarified: Headcount is not known. The single slot is provisional.' })).toBeChecked();
  await page.getByLabel('General instructions', { exact: true }).fill('تعليمات الإنتاج\nKeep the supplied wording.');
  await expect(page.locator('.editor-section').filter({ has: page.getByLabel('General instructions', { exact: true }) }).getByRole('status')).toHaveText('Saved');
  expect(model.rolePatches).toHaveLength(1); // Count confirmation did not reopen its old marker through autosave.
  expect(model.slots().some(slot => slot.id === model.originalSlot && !slot.archived)).toBe(true);
  await article.getByLabel('Required people', { exact: true }).fill('2');
  await expect(article.getByRole('button', { name: 'Archive selected slots' })).toBeDisabled();
  await article.getByRole('group', { name: 'Choose slots to archive' }).getByRole('checkbox', { name: 'Waiter 1', exact: true }).check();
  await article.getByRole('button', { name: 'Archive selected slots' }).click();
  await expect.poll(() => model.roles()[0].headcount).toBe(2);
  expect(model.slots().find(slot => slot.id === model.originalSlot)?.archived).toBe(true);
  expect(model.slots()).toHaveLength(3);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Server', exact: true })).toBeVisible();
  await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('تعليمات الإنتاج\nKeep the supplied wording.');
  await article.locator('summary').filter({ hasText: 'Edit requirements' }).click();
  await article.locator('.role-slots-disclosure > summary').click();
  await expect(article.getByLabel('Required people', { exact: true })).toBeEnabled();
  for (const width of [1440, 1024, 768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (width === 1440 || width === 320) await page.screenshot({ path: testInfo.outputPath(`controlled-specs-${width}.png`), fullPage: true });
  }
  await article.getByRole('button', { name: 'Remove role', exact: true }).click();
  try {
    const archive = page.waitForRequest(request => request.url().endsWith('/archive'));
    await article.getByRole('button', { name: 'Confirm archive', exact: true }).click(); await archive;
    await expect(article.getByLabel('Role name', { exact: true })).toHaveAttribute('readonly', '');
    await expect(article.getByRole('checkbox', { name: /Clarified:/ })).toBeDisabled();
  } finally { model.releaseArchive(); }
  await expect(article).toHaveCount(0);
  expect(model.errors).toEqual([]);
});

test('controlled unknown create outcome retries the same intent without a second role', async ({ page }) => {
  const model = await controlledWorkspace(page, { empty: true, loseCreateResponse: true });
  await page.goto(base); await page.getByLabel('New role name', { exact: true }).fill('Stand-in');
  await page.getByRole('button', { name: 'Add role', exact: true }).click();
  await expect(page.getByLabel('New role name', { exact: true })).toBeDisabled();
  await expect(page.getByLabel('New role name', { exact: true })).toHaveValue('Stand-in');
  await page.getByRole('button', { name: 'Retry adding this role' }).click();
  await expect(page.getByRole('heading', { name: 'Stand-in', exact: true })).toBeVisible();
  expect(model.creates).toHaveLength(2); expect(model.creates[0].key).toBe(model.creates[1].key);
  expect(model.creates[0].input).toEqual(model.creates[1].input); expect(model.roles()).toHaveLength(1);
  expect(model.roles()[0].headcount).toBeNull(); expect(model.errors).toEqual([]);
});

test('controlled stale edit stays visible and guards navigation until explicit reload', async ({ page }) => {
  const model = await controlledWorkspace(page, { stalePatch: true });
  await page.goto(base); const article = page.locator('.role-editor');
  await article.locator('summary').filter({ hasText: 'Edit requirements' }).click();
  await article.getByLabel('Role name', { exact: true }).fill('My correction');
  await expect(article.getByRole('alert')).toContainText('Reload the saved details');
  await expect(article.getByLabel('Role name', { exact: true })).toHaveValue('My correction');
  page.once('dialog', dialog => dialog.dismiss());
  await page.getByRole('link', { name: 'Continue to Candidates' }).click();
  await expect(page).toHaveURL(new RegExp('/specs$'));
  page.once('dialog', dialog => dialog.accept());
  await article.getByRole('button', { name: 'Reload saved requirements', exact: true }).click();
  await article.locator('summary').filter({ hasText: 'Edit requirements' }).click();
  await expect(article.getByLabel('Role name', { exact: true })).toHaveValue('External correction');
  expect(model.rolePatches).toHaveLength(1); expect(model.errors).toEqual([]);
});
