import { expect, test, type Page } from '@playwright/test';
import { addManualRole, createEmptySpecsDraft, roleToDto, slotToDto } from '@eps/domain';

// Controlled HTTP/DOM lifecycle confirmations. No hosted identity, SQL,
// media or provider call is made by this synthetic transport fixture.
const project = '89000000-0000-4000-8000-000000000001';
const workspace = '89000000-0000-4000-8000-000000000002';
async function fixture(page: Page, options: { failPreview?: boolean; lostRemoval?: boolean } = {}) {
  let allocated = 0; const allocate = () => '89000000-0000-4000-8000-' + String(++allocated + 100).padStart(12, '0');
  const draft = addManualRole(createEmptySpecsDraft({ id: allocate(), workspace_id: workspace, draft_revision: 0 }), { name: 'Father', headcount: 2,
    requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [],
      scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null } }, allocate);
  const role = roleToDto(draft.roles[0]); const slots = draft.slots.map(slotToDto);
  const pool = [1, 2].map(n => ({ id: 'pool-' + n, workspace_id: workspace, candidate_id: 'profile-' + n, row_version: 1,
    selected_candidate_media_id: null, selected_frame_asset_ids: [], availability: null, internal_notes: null,
    fresh_material_required: false, media_confirmed: false }));
  const assignments = slots.map((slot, index) => ({ id: 'assignment-' + index, workspace_id: workspace, slot_id: slot.id,
    workspace_candidate_id: pool[index].id, position: index === 0 ? 'main' : 'backup', shortlist_included: index === 0,
    presentation_notes: index === 0 ? 'Assignment presentation note' : null, internal_notes: index === 0 ? 'Private assignment note' : null,
    slide_wording: {}, sort_order: 0, row_version: 1, archived: false }));
  const removed = new Set<string>(); const cache = new Map<string, unknown>();
  const writes: { path: string; key: string; body: unknown }[] = [];
  let version = 5; let revision = 4; let previewFailed = false; let lost = false; let deniedRetry = false; let effects = 0;
  const current = () => ({ id: workspace, project_id: project, module: 'casting', title: 'Synthetic retirement project', logo_asset_id: null,
    logo_placement: 'cover', active_output: 'selection', row_version: version, draft_revision: revision, has_unpublished_changes: true,
    created_at: '2026-10-29T00:00:00Z', updated_at: '2026-10-29T00:00:00Z' });
  await page.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname; const method = req.method();
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-retirement', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-retirement', data, page: { next_cursor: null } } });
    const fail = (code: string, status = 503) => route.fulfill({ status, json: { request_id: 'synthetic-retirement', error: { code, message: 'Synthetic preview unavailable.', details: {}, retryable: true } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read'], upload_purposes: [] }, actors: [] });
    if (method === 'GET') {
      if (path === '/api/v1/projects/' + project) return ok({ id: project, name: 'Synthetic retirement project', client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspace, can_edit: false });
      if (path === '/api/v1/workspaces/' + workspace) return ok(current());
      if (path.endsWith('/specs')) return ok(draft.spec);
      if (path.endsWith('/roles')) return list(role.archived ? [] : [role]);
      if (path.endsWith('/slots')) return list(slots.filter(slot => !slot.archived));
      if (path === '/api/v1/workspaces/' + workspace + '/candidates') return list(pool.filter(item => !removed.has(item.id)));
      if (path.endsWith('/assignments')) {
        if (options.failPreview && !previewFailed) { previewFailed = true; return fail('DEPENDENCY_UNAVAILABLE'); }
        return list(assignments.filter(row => !row.archived));
      }
      if (path.endsWith('/supporting-files') || path.endsWith('/media')) return list([]);
      if (path.startsWith('/api/v1/candidates/')) { const id = path.split('/').at(-1)!; return ok({ id, facts: { name: id === 'profile-1' ? 'Synthetic A' : 'Synthetic B', casting_id: null }, review_status: 'unreviewed' }); }
      return fail('CONTROLLED_ROUTE_NOT_IMPLEMENTED');
    }
    const body = req.postDataJSON(); const key = req.headers()['idempotency-key']; writes.push({ path, key, body });
    if (cache.has(key)) {
      if (options.lostRemoval && !deniedRetry) { deniedRetry = true; return fail('CAPABILITY_REQUIRED', 403); }
      return ok(cache.get(key));
    }
    let result: unknown;
    if (path === '/api/v1/workspace-candidates/pool-1/remove') {
      removed.add('pool-1'); assignments.filter(row => row.workspace_candidate_id === 'pool-1').forEach(row => { row.archived = true; });
      result = { success: true, affected_ids: ['pool-1', 'assignment-0'] };
    } else if (path === '/api/v1/roles/' + role.id + '/archive') {
      role.archived = true; slots.forEach(slot => { slot.archived = true; }); assignments.forEach(row => { row.archived = true; });
      result = { success: true, affected_ids: [role.id, ...slots.map(slot => slot.id), ...assignments.map(row => row.id)] };
    } else if (path.endsWith('/slots/resize')) {
      role.headcount = body.desired_count; role.row_version++;
      slots.filter(slot => body.retire_slot_ids.includes(slot.id)).forEach(slot => { slot.archived = true; });
      assignments.filter(row => body.retire_slot_ids.includes(row.slot_id)).forEach(row => { row.archived = true; });
      result = role;
    } else return fail('CONTROLLED_ROUTE_NOT_IMPLEMENTED');
    effects++; version++; revision++; cache.set(key, structuredClone(result));
    if (options.lostRemoval && !lost) { lost = true; return fail('DEPENDENCY_UNAVAILABLE'); }
    return ok(result);
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  return { writes, assignments, role, slots, errors, effects: () => effects, removed };
}

test('project removal fails closed on an unavailable preview and retries actual choices before confirmation', async ({ page }) => {
  const model = await fixture(page, { failPreview: true }); await page.goto(`/projects/${project}/casting/${workspace}/cast`);
  const person = page.locator('.project-candidate-list > article').filter({ has: page.getByRole('heading', { name: 'Synthetic A', exact: true }) });
  await person.getByRole('button', { name: 'Remove from project', exact: true }).click();
  const review = person.getByRole('region', { name: 'Review casting removal' });
  await expect(review.getByRole('alert')).toContainText('Synthetic preview unavailable');
  await expect(review.getByRole('button', { name: 'Confirm remove from project', exact: true })).toBeDisabled();
  expect(model.writes).toEqual([]);
  await review.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(review).toContainText('Currently shown: 1 casting assignment, 1 Main, 1 shortlisted.');
  await expect(review).toContainText('including choices added after this preview');
  await expect(review).toContainText('Candidate record profile-1');
  await expect(review).not.toContainText('Private assignment note');
  await review.getByRole('button', { name: 'Keep project candidate', exact: true }).click();
  await expect(review).toHaveCount(0); expect(model.effects()).toBe(0); expect(model.errors).toEqual([]);
});

test('interrupted retirement preserves one exact intent through a later denial and acknowledges one effect', async ({ page }) => {
  const model = await fixture(page, { lostRemoval: true }); await page.goto(`/projects/${project}/casting/${workspace}/cast`);
  const person = page.locator('.project-candidate-list > article').filter({ has: page.getByRole('heading', { name: 'Synthetic A', exact: true }) });
  await person.getByRole('button', { name: 'Remove from project', exact: true }).click();
  const review = person.getByRole('region', { name: 'Review casting removal' });
  await review.getByRole('button', { name: 'Confirm remove from project', exact: true }).click();
  await expect(review.getByRole('button', { name: 'Retry same removal', exact: true })).toBeVisible();
  await expect(review.getByRole('button', { name: 'Keep project candidate', exact: true })).toBeDisabled();
  await review.getByRole('button', { name: 'Retry same removal', exact: true }).click();
  await expect(review.getByRole('alert')).toContainText('Synthetic preview unavailable');
  await expect(review.getByRole('button', { name: 'Keep project candidate', exact: true })).toBeDisabled();
  await review.getByRole('button', { name: 'Retry same removal', exact: true }).click();
  await expect(person).toHaveCount(0);
  expect(model.writes).toHaveLength(3); expect(model.writes[1]).toEqual(model.writes[0]); expect(model.writes[2]).toEqual(model.writes[0]);
  expect(model.effects()).toBe(1); expect(model.assignments.map(row => row.archived)).toEqual([true, false]); expect(model.errors).toEqual([]);
});

test('role archive names current Main and Shortlist consequences before retiring the whole role scope', async ({ page }) => {
  const model = await fixture(page); await page.goto(`/projects/${project}/casting/${workspace}/specs`);
  const role = page.locator('.role-editor'); await role.getByText('Edit requirements', { exact: true }).click();
  await role.getByRole('button', { name: 'Remove role', exact: true }).click();
  const review = role.getByRole('region', { name: 'Review casting removal' });
  await expect(review).toContainText('Currently shown: 2 casting assignments, 1 Main, 1 shortlisted.');
  await expect(review).toContainText('Shared profiles, introductions and saved presentation versions remain.');
  expect(model.writes).toEqual([]); await review.getByRole('button', { name: 'Confirm archive', exact: true }).click();
  await expect(role).toHaveCount(0); expect(model.assignments.every(row => row.archived)).toBe(true); expect(model.removed.size).toBe(0); expect(model.errors).toEqual([]);
});

test('slot reduction previews only explicitly selected slots and retains other casting choices', async ({ page }) => {
  const model = await fixture(page); await page.goto(`/projects/${project}/casting/${workspace}/specs`);
  const role = page.locator('.role-editor'); await role.locator('.role-slots-disclosure > summary').click();
  await role.getByLabel('Required people', { exact: true }).fill('1');
  await role.getByRole('group', { name: 'Choose slots to archive' }).getByRole('checkbox', { name: 'Father 1', exact: true }).check();
  await role.getByRole('button', { name: 'Review slot reduction', exact: true }).click();
  const review = role.getByRole('region', { name: 'Review casting removal' });
  await expect(review).toContainText('Currently shown: 1 casting assignment, 1 Main, 1 shortlisted.');
  expect(model.writes).toEqual([]); await review.getByRole('button', { name: 'Confirm archive selected slots', exact: true }).click();
  await expect.poll(() => model.role.headcount).toBe(1); expect(model.assignments.map(row => row.archived)).toEqual([true, false]); expect(model.errors).toEqual([]);
});
