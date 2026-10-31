import { expect, test, type Page } from '@playwright/test';

// Synthetic HTTP/DOM behavior; SQL/current-permission and real app checks are separate.
const project = '87000000-0000-4000-8000-000000000001';
const workspace = '87000000-0000-4000-8000-000000000002';
const role = '87000000-0000-4000-8000-000000000003';
const slot = '87000000-0000-4000-8000-000000000004';
async function fixture(page: Page, lost = false, unavailable = false) {
  let removed = false; let restored = false; let version = 5; let missed = false; let denied = false;
  const requests: { path: string; body: unknown; key: string }[] = []; const cache = new Map<string, unknown>();
  const person = { id: 'pool', workspace_id: workspace, candidate_id: 'person', selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: null, internal_notes: null, fresh_material_required: false, media_confirmed: false, row_version: 1 };
  const requirements = { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null };
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-retirement-undo', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-retirement-undo', data, page: { next_cursor: null } } });
    const fail = (status: number, code: string) => route.fulfill({ status, json: { request_id: 'synthetic-retirement-undo', error: { code, message: 'Synthetic restoration interrupted.', details: {}, retryable: status >= 500 } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read'], upload_purposes: [] }, actors: [] });
    if (method === 'GET') {
      if (path === '/api/v1/projects/' + project) return ok({ id: project, name: 'Synthetic Undo Project', client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspace, can_edit: false });
      if (path === '/api/v1/workspaces/' + workspace) return ok({ id: workspace, project_id: project, module: 'casting', title: 'Synthetic Undo Project', active_output: 'selection', row_version: version, draft_revision: version - 1, has_unpublished_changes: true, logo_asset_id: null, logo_placement: 'cover', created_at: '2026-10-29T00:00:00Z', updated_at: '2026-10-29T00:00:00Z' });
      if (path.endsWith('/retirements/pool')) return ok({ workspace_id: workspace, resource_id: 'pool', operation: 'remove_workspace_candidate', undo_event_id: 'event', expected_workspace_row_version: version, assignment_ids: ['assignment'], slot_ids: [slot], main_count: 1, shortlist_count: 1, can_undo: !unavailable, unavailable_reason: unavailable ? 'RETIREMENT_CHANGED' : null });
      if (path.endsWith('/roles')) return list([{ id: role, workspace_id: workspace, name: 'Father', headcount: 1, category: null, requirements, clarifications: [], row_version: 1, sort_order: 0, archived: false }]);
      if (path.endsWith('/slots')) return list([{ id: slot, role_id: role, label: 'Father 1', row_version: 1, sort_order: 0, archived: false }]);
      if (path === '/api/v1/workspaces/' + workspace + '/candidates') return list(removed ? [] : [person]);
      if (path.endsWith('/assignments')) return list(removed ? [] : [{ id: 'assignment', workspace_id: workspace, slot_id: slot, workspace_candidate_id: 'pool', position: 'main', shortlist_included: true, presentation_notes: null, internal_notes: null, slide_wording: {}, sort_order: 0, row_version: 1, archived: false }]);
      if (path.endsWith('/media') || path.endsWith('/supporting-files')) return list([]);
      if (path === '/api/v1/candidates/person') return ok({ id: 'person', facts: { name: 'Synthetic Undo Person', casting_id: null }, review_status: 'unreviewed' });
      return fail(404, 'CONTROLLED_ROUTE_NOT_IMPLEMENTED');
    }
    const body = request.postDataJSON(); const key = request.headers()['idempotency-key']; requests.push({ path, body, key });
    if (path.endsWith('/retirements/event/undo')) {
      if (unavailable) return fail(409, 'RETIREMENT_UNDO_UNAVAILABLE');
      if (cache.has(key)) { if (lost && !denied) { denied = true; return fail(403, 'CAPABILITY_REQUIRED'); } return ok(cache.get(key)); }
      expect(body).toEqual({ expected_workspace_row_version: 6 });
      removed = false; restored = true; version++; const response = { success: true, affected_ids: ['pool', 'assignment'], workspace_row_version: version }; cache.set(key, response);
      if (lost && !missed) { missed = true; return fail(503, 'DEPENDENCY_UNAVAILABLE'); } return ok(response);
    }
    if (path === '/api/v1/workspace-candidates/pool/remove') { removed = true; version++; return ok({ success: true, affected_ids: ['pool', 'assignment'] }); }
    return fail(404, 'CONTROLLED_ROUTE_NOT_IMPLEMENTED');
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  return { requests, restored: () => restored, errors };
}
async function removePerson(page: Page) {
  await page.goto(`/projects/${project}/casting/${workspace}/cast`);
  const card = page.locator('.project-candidate-list > article').filter({ has: page.getByRole('heading', { name: 'Synthetic Undo Person', exact: true }) });
  await card.getByRole('button', { name: /^Edit project material for / }).click();
  await card.getByRole('button', { name: 'Remove from project', exact: true }).click();
  await card.getByRole('button', { name: 'Confirm remove from project', exact: true }).click();
  await expect(card).toHaveCount(0);
}

test('confirmed project removal exposes a revision-fenced Undo and restores the retained choices', async ({ page }) => {
  const model = await fixture(page); await removePerson(page);
  const undo = page.getByRole('region', { name: 'Restore archived casting choices', exact: true });
  await expect(undo).toContainText('1 assignment'); await expect(undo).toContainText('1 Main');
  await undo.getByRole('button', { name: 'Undo removal', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Synthetic Undo Person', exact: true })).toBeVisible();
  expect(model.restored()).toBe(true); expect(model.requests.filter(row => row.path.endsWith('/undo'))).toHaveLength(1); expect(model.errors).toEqual([]);
});
test('unknown Undo retains its exact intent through a later403 until the cached acknowledgement returns', async ({ page }) => {
  const model = await fixture(page, true); await removePerson(page);
  const undo = page.getByRole('region', { name: 'Restore archived casting choices', exact: true });
  await undo.getByRole('button', { name: 'Undo removal', exact: true }).click();
  const retry = undo.getByRole('button', { name: 'Retry same Undo', exact: true }); await expect(retry).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload saved candidates', exact: true })).toBeDisabled();
  await retry.click(); await expect(retry).toBeVisible(); await expect(undo.getByRole('button', { name: 'Dismiss Undo', exact: true })).toBeDisabled();
  await retry.click(); await expect(page.getByRole('heading', { name: 'Synthetic Undo Person', exact: true })).toBeVisible();
  const writes = model.requests.filter(row => row.path.endsWith('/undo')); expect(writes).toHaveLength(3); expect(writes[1]).toEqual(writes[0]); expect(writes[2]).toEqual(writes[0]); expect(model.errors).toEqual([]);
});
test('a changed restoration snapshot exposes its reason and performs no Undo', async ({ page }) => {
  const model = await fixture(page, false, true); await removePerson(page);
  const undo = page.getByRole('region', { name: 'Restore archived casting choices', exact: true });
  await expect(undo).toContainText('A newer casting edit prevents this restoration.');
  await expect(undo.getByRole('button', { name: 'Undo removal', exact: true })).toBeDisabled();
  expect(model.requests.filter(row => row.path.endsWith('/undo'))).toEqual([]);
});
