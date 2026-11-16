import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Synthetic HTTP/DOM checks of the scene breakdown. The canonical transactions (shared casting across occurrences,
// archive/reorder never touching casting) are proven separately by tests/db/cycle7/a2-*.sql.
test.use({ actionTimeout: 10000 });
const project = '89000000-0000-4000-8000-000000000001';
const workspace = '89000000-0000-4000-8000-000000000002';
const path = '/projects/' + project + '/casting/' + workspace + '/organize';
const stamp = '2026-11-16T00:00:00Z';

async function studio(page: Page) {
  let version = 1; let revision = 0; let next = 100;
  const roles = [['father', 'Father'], ['father-other', 'Father'], ['mother', 'Mother']].map(([id, name], sort_order) => ({ id, name, workspace_id: workspace, headcount: 1,
    category: id === 'father-other' ? 'Flashback' : null, archived: false, row_version: 1, sort_order, clarifications: [],
    requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [], shoot_dates: [], location: null, availability_requirements: null, other_instructions: null } }));
  const slots = [['slot-f', 'father', 'Father 1'], ['slot-o', 'father-other', 'Father 1'], ['slot-m', 'mother', 'Mother 1']]
    .map(([id, role_id, label]) => ({ id, role_id, label, archived: false, row_version: 1, sort_order: 0 }));
  const pool = [1, 2].map(n => ({ id: 'pool-' + n, workspace_id: workspace, candidate_id: 'person-' + n, availability: null, selected_frame_asset_ids: [], fresh_material_required: false }));
  const assignment = (id: string, slot_id: string, pool_id: string, sort_order: number) => ({ id, workspace_id: workspace, slot_id, workspace_candidate_id: pool_id, position: 'option',
    shortlist_included: false, presentation_notes: null, internal_notes: null, sort_order, row_version: 1, archived: false, slide_wording: {}, created_at: stamp, updated_at: stamp });
  const assignments = [assignment('a1', 'slot-f', 'pool-1', 0), assignment('a2', 'slot-f', 'pool-2', 1), assignment('b1', 'slot-o', 'pool-1', 0)];
  type Occurrence = { id: string; role_id: string; row_version: number; archived: boolean; status?: string; deck_placement?: 'auto' | 'repeat' | 'hidden' };
  type SceneRow = { id: string; scene_number: string | null; title: string; setting: string | null; sort_order: number; row_version: number; archived: boolean; occurrences: Occurrence[]; status?: string; quote?: string };
  const link = (id: string, role_id: string): Occurrence => ({ id, role_id, row_version: 1, archived: false });
  const scenes: SceneRow[] = [
    { id: 's1', scene_number: '1', title: 'Kitchen', setting: 'INT. KITCHEN - NIGHT', sort_order: 0, row_version: 1, archived: false, occurrences: [link('o1', 'father'), link('o2', 'mother')] },
    { id: 's2', scene_number: '2', title: 'Office', setting: null, sort_order: 1, row_version: 1, archived: false, occurrences: [link('o3', 'mother')] },
    { id: 's3', scene_number: '3', title: 'Garden', setting: 'EXT. GARDEN - DAY', sort_order: 2, row_version: 1, archived: false, occurrences: [link('o4', 'father')] },
    { id: 's5', scene_number: '5', title: 'Hospital', setting: null, sort_order: 3, row_version: 1, archived: false, occurrences: [link('o5', 'father')] }];
  const sceneDto = (scene: SceneRow) => ({ id: scene.id, workspace_id: workspace, scene_number: scene.scene_number, title: scene.title, sequence_label: null, setting: scene.setting,
    notes: null, requirements: { items: [] }, source_refs: scene.quote ? [{ asset_id: null, page: null, paragraph: 0, segment_index: null, start_ms: null, end_ms: null, quote: scene.quote }] : [],
    status: scene.status ?? 'confirmed', sort_order: scene.sort_order, row_version: scene.row_version, archived: scene.archived,
    occurrences: scene.occurrences.filter(o => !o.archived).map((o, sort_order) => ({ id: o.id, scene_id: scene.id, role_id: o.role_id, role_name: roles.find(r => r.id === o.role_id)!.name,
      slot_ids: [], display_title: null, setting_override: null, presentation_note: null, deck_placement: o.deck_placement ?? 'auto', status: o.status ?? 'confirmed', source_refs: [], sort_order, row_version: o.row_version, proposal_stale: false })) });
  const active = () => scenes.filter(s => !s.archived).sort((a, b) => a.sort_order - b.sort_order);
  const current = () => ({ id: workspace, project_id: project, module: 'casting', title: 'Synthetic scenes project', active_output: 'selection', row_version: version, draft_revision: revision,
    has_unpublished_changes: revision > 0, logo_asset_id: null, logo_placement: 'cover', created_at: stamp, updated_at: stamp });
  const calls: { path: string; method: string; body: Record<string, unknown> }[] = [];
  await page.route('**/api/**', async route => {
    const req = route.request(); const url = new URL(req.url()); const p = url.pathname; const method = req.method();
    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'synthetic-scenes', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-scenes', data, page: { next_cursor: null } } });
    const fail = (status: number, code: string) => route.fulfill({ status, json: { request_id: 'synthetic-scenes', error: { code, message: 'Synthetic refusal.', details: {}, retryable: false } } });
    if (p === '/api/session') return ok({ mode: 'supabase', actor: { id: 'test-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read'], upload_purposes: [] }, actors: [] });
    if (method === 'GET') {
      if (p === '/api/v1/projects/' + project) return ok({ id: project, name: 'Synthetic scenes project', client_name: null, client_id: null, client_logo_asset_id: null, row_version: 1, casting_workspace_id: workspace, can_edit: true });
      if (p === '/api/v1/workspaces/' + workspace) return ok(current());
      if (p.endsWith('/scenes')) return list(active().map(sceneDto));
      if (p.endsWith('/roles')) return list(roles);
      if (p.endsWith('/slots')) return list(slots.filter(s => p.includes('/' + s.role_id + '/')));
      if (p === '/api/v1/workspaces/' + workspace + '/candidates') return list(pool);
      if (p.endsWith('/assignments')) return list(assignments.filter(a => !a.archived));
      if (p.startsWith('/api/v1/candidates/')) { const id = p.split('/').at(-1)!; return ok({ id, facts: { name: 'Synthetic ' + id, casting_id: id, age_or_range: null, stated_gender: null, height_measurements: null, languages: [], accents: [],
        skills_experience: null, city: null, previous_projects_roles: null, classification: null }, review_status: 'unreviewed', archived: false }); }
      return fail(404, 'NOT_FOUND');
    }
    const body = req.postDataJSON() ?? {}; calls.push({ path: p, method, body });
    const changed = () => { version++; revision++; };
    if (p.startsWith('/api/v1/scenes/') && method === 'PATCH') {
      const scene = scenes.find(s => s.id === p.split('/').at(-1))!; expect(body.row_version).toBe(scene.row_version);
      Object.assign(scene, body, { row_version: scene.row_version + 1 }); changed(); return ok(sceneDto(scene));
    }
    if (p.endsWith('/scene-order') && method === 'PUT') {
      expect(body.row_version).toBe(version); expect(new Set(body.scene_ids as string[])).toEqual(new Set(active().map(s => s.id)));
      (body.scene_ids as string[]).forEach((id, index) => { const scene = scenes.find(s => s.id === id)!; if (scene.sort_order !== index) { scene.sort_order = index; scene.row_version++; } });
      changed(); return ok({ workspace_id: workspace, row_version: version, scene_ids: body.scene_ids });
    }
    if (p.endsWith('/archive') && p.startsWith('/api/v1/scenes/') && method === 'POST') {
      const scene = scenes.find(s => s.id === p.split('/').at(-2))!; expect(body.row_version).toBe(scene.row_version);
      scene.archived = true; scene.row_version++; scene.occurrences.forEach(o => { o.archived = true; }); changed();
      return ok({ success: true, affected_ids: [scene.id, ...scene.occurrences.map(o => o.id)] });
    }
    if (p.startsWith('/api/v1/slots/') && p.endsWith('/main') && method === 'PUT') {
      const slot = slots.find(s => s.id === p.split('/').at(-2))!; expect(body.expected_slot_row_version).toBe(slot.row_version);
      const before = assignments.find(a => a.slot_id === slot.id && a.position === 'main' && !a.archived);
      if (before) { before.position = 'backup'; before.row_version++; }
      const target = assignments.find(a => a.id === body.assignment_id)!; target.position = 'main'; target.row_version++; slot.row_version++; changed();
      return ok({ slot, affected_assignments: [target, ...(before ? [before] : [])], undo: null });
    }
    if (p.endsWith('/occurrences') && p.startsWith('/api/v1/scenes/') && method === 'POST') {
      const scene = scenes.find(s => s.id === p.split('/').at(-2))!; expect(Object.keys(body)).toEqual(['role_id']);
      expect(scene.occurrences.some(o => !o.archived && o.role_id === body.role_id)).toBe(false);
      scene.occurrences.push(link('o' + ++next, body.role_id as string)); changed(); return ok(sceneDto(scene), 201);
    }
    if (p.endsWith('/roles') && method === 'POST') {
      const role = { ...structuredClone(roles[0]), id: 'role-' + ++next, name: body.name as string, category: null, sort_order: roles.length }; roles.push(role);
      slots.push({ id: 'slot-' + next, role_id: role.id, label: role.name + ' 1', archived: false, row_version: 1, sort_order: 0 }); changed(); return ok(role, 201);
    }
    if (p.endsWith('/scene-proposals/confirm') && method === 'POST') {
      expect(body.row_version).toBe(version); const confirmed: string[] = [];
      for (const scene of scenes) if ((body.scene_ids as string[] ?? []).includes(scene.id) && scene.status === 'proposed') { scene.status = 'confirmed'; scene.row_version++; confirmed.push(scene.id); }
      const links = scenes.flatMap(scene => scene.occurrences).filter(o => (body.occurrence_ids as string[] ?? []).includes(o.id) && o.status === 'proposed');
      links.forEach(o => { o.status = 'confirmed'; o.row_version++; }); changed();
      return ok({ workspace_id: workspace, row_version: version, confirmed_scene_ids: confirmed, confirmed_occurrence_ids: links.map(o => o.id), skipped_occurrence_ids: [] });
    }
    if (p.startsWith('/api/v1/scene-occurrences/')) return fail(409, 'SYNTHETIC_NOT_MODELLED');
    return fail(404, 'NOT_FOUND');
  });
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  // Casting identity and choices (row versions move with ordinary reads/writes and are compared separately).
  const casting = () => JSON.stringify({ roles, slots: slots.map(row => [row.id, row.role_id, row.label, row.archived, row.sort_order]), pool,
    assignments: assignments.map(row => [row.id, row.slot_id, row.workspace_candidate_id, row.position, row.shortlist_included, row.archived, row.sort_order]) });
  return { calls, assignments, errors, casting, scenes };
}
const nav = (page: Page) => page.getByRole('navigation', { name: 'Scenes' });
const sceneButton = (page: Page, title: string) => nav(page).getByRole('button', { name: new RegExp(title) });

test('the view toggle persists per browser and switching views changes no project data', async ({ page }) => {
  const model = await studio(page); const before = model.casting(); await page.goto(path);
  await expect(page.getByRole('button', { name: 'Standard view', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Scene breakdown', exact: true }).click();
  await expect(sceneButton(page, 'Kitchen')).toHaveAttribute('aria-current', 'true');
  await expect(sceneButton(page, 'Kitchen')).toContainText('0/2 roles cast');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Scene breakdown', exact: true })).toHaveAttribute('aria-pressed', 'true');
  // Keyboard navigation moves through the ordered navigator.
  await sceneButton(page, 'Kitchen').focus(); await page.keyboard.press('ArrowDown');
  await expect(sceneButton(page, 'Office')).toHaveAttribute('aria-current', 'true'); await expect(sceneButton(page, 'Office')).toBeFocused();
  await page.keyboard.press('End'); await expect(sceneButton(page, 'Hospital')).toHaveAttribute('aria-current', 'true');
  await page.getByRole('button', { name: 'Standard view', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Casting choices', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Scene breakdown', exact: true }).click();
  await expect(nav(page)).toBeVisible();
  expect(model.calls).toEqual([]); expect(model.casting()).toBe(before); expect(model.errors).toEqual([]);
});

test('choosing Main from Scene 3 shows in Scenes 1 and 5 and the Standard view; the unrelated Father is unchanged', async ({ page }) => {
  const model = await studio(page); await page.goto(path);
  await page.getByRole('button', { name: 'Scene breakdown', exact: true }).click();
  await sceneButton(page, 'Garden').click();
  const card = page.getByRole('article', { name: 'Father', exact: true });
  await expect(card).toContainText('Appears in Scenes 1, 3 and 5 · one shared casting');
  await expect(card).toContainText('2 options');
  await card.getByRole('button', { name: 'Cast this role' }).click();
  await expect(page.getByRole('button', { name: 'Standard view', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'One role', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Assignment actions for Synthetic person-1' }).first().click();
  await page.getByRole('menuitem', { name: 'Set as Main' }).click();
  await expect.poll(() => model.assignments.find(a => a.id === 'a1')!.position).toBe('main');
  expect(model.assignments.find(a => a.id === 'b1')!.position).toBe('option');
  await expect(page.getByRole('article', { name: /Synthetic person-1, Main/u }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Back to scenes', exact: true }).click();
  await expect(page.getByRole('note').filter({ hasText: 'Father: casting is shared by Scenes 1, 3 and 5.' })).toBeVisible();
  for (const title of ['Kitchen', 'Garden', 'Hospital']) {
    await sceneButton(page, title).click();
    await expect(page.getByRole('article', { name: 'Father', exact: true })).toContainText('Main chosen');
  }
  await expect(sceneButton(page, 'Kitchen')).toContainText('1/2 roles cast');
  await expect(sceneButton(page, 'Office')).toContainText('0/1 role cast');
  // Only the one Main operation was written; no scene data changed.
  expect(model.calls.map(c => `${c.method} ${c.path}`)).toEqual(['PUT /api/v1/slots/slot-f/main']);
  expect(model.errors).toEqual([]);
});

test('renumbering, reordering and removing a scene preserve every casting record', async ({ page }) => {
  const model = await studio(page); const before = model.casting(); await page.goto(path);
  await page.getByRole('button', { name: 'Scene breakdown', exact: true }).click();
  await sceneButton(page, 'Garden').click();
  await page.getByRole('button', { name: 'Edit scene', exact: true }).click();
  await page.getByLabel('Scene number').fill('3A'); await page.getByLabel('Title', { exact: true }).fill('Garden at dusk');
  await page.getByRole('button', { name: 'Save scene', exact: true }).click();
  await expect(sceneButton(page, 'Garden at dusk')).toContainText('3A');
  await page.getByRole('button', { name: 'Move 3A · Garden at dusk earlier' }).click();
  await expect(nav(page).getByRole('listitem').nth(1)).toContainText('Garden at dusk');
  await sceneButton(page, 'Hospital').click();
  await page.getByRole('button', { name: 'Remove scene', exact: true }).click();
  const dialog = page.getByRole('alertdialog').or(page.getByRole('dialog'));
  await expect(dialog).toContainText('Roles, slots, candidates and every casting choice stay exactly as they are');
  await dialog.getByRole('button', { name: 'Remove scene', exact: true }).click();
  await expect(sceneButton(page, 'Hospital')).toHaveCount(0);
  const father = page.getByRole('article', { name: 'Father', exact: true });
  await sceneButton(page, 'Kitchen').click();
  await expect(father).toContainText('Appears in Scenes 1 and 3A');
  expect(model.calls.map(c => `${c.method} ${c.path}`)).toEqual(['PATCH /api/v1/scenes/s3', 'PUT /api/v1/workspaces/' + workspace + '/scene-order', 'POST /api/v1/scenes/s5/archive']);
  expect(model.calls[0].body).toEqual({ row_version: 1, title: 'Garden at dusk', scene_number: '3A', setting: 'EXT. GARDEN - DAY', sequence_label: null, notes: null, requirements: { items: [] } });
  expect(model.casting()).toBe(before);
  await page.getByRole('button', { name: 'Standard view', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Casting choices', exact: true })).toBeVisible();
  expect(model.errors).toEqual([]);
});

test('linking states same character versus a new role explicitly; identical names never auto-link; proposals are confirmed explicitly', async ({ page }) => {
  const model = await studio(page);
  model.scenes.push({ id: 's9', scene_number: '9', title: 'Rooftop', setting: null, sort_order: 4, row_version: 1, archived: false, status: 'proposed', quote: 'SCENE 9 - ROOFTOP',
    occurrences: [{ id: 'o9', role_id: 'mother', row_version: 1, archived: false, status: 'proposed' }] });
  await page.goto(path);
  await page.getByRole('button', { name: 'Scene breakdown', exact: true }).click();
  await sceneButton(page, 'Office').click();
  await page.getByRole('button', { name: 'Add a role to this scene', exact: true }).click();
  await expect(page.getByRole('radio', { name: 'Same character as an existing role' })).toBeChecked();
  const choice = page.getByLabel('Existing role', { exact: true });
  await expect(choice).toHaveValue('');
  const options = await choice.locator('option').allTextContents();
  expect(options).toEqual(['Choose a role…', 'Father — Appears in Scenes 1, 3 and 5 · 1 slot', 'Father — Not in any scene yet · 1 slot · Flashback']);
  await choice.selectOption('father-other');
  await expect(page.getByRole('note').filter({ hasText: 'Another role has the same name' })).toBeVisible();
  await page.getByRole('radio', { name: 'A new, separately cast role' }).check();
  await page.getByLabel('Role name', { exact: true }).fill('Father');
  await expect(page.getByRole('note').filter({ hasText: 'This creates a separate role that is cast separately' })).toBeVisible();
  await page.getByRole('radio', { name: 'Same character as an existing role' }).check();
  await page.getByLabel('Existing role', { exact: true }).selectOption('father');
  await expect(page.getByRole('note').filter({ hasText: 'Appears in Scenes 1, 3 and 5. Its casting will also show in this scene.' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to scene', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Father', exact: true })).toContainText('Appears in Scenes 1, 2, 3 and 5 · one shared casting');
  await sceneButton(page, 'Rooftop').click();
  await expect(page.getByRole('group', { name: 'Proposal from the specs' }).first()).toContainText('SCENE 9 - ROOFTOP');
  await page.getByRole('button', { name: 'Confirm scene and its links', exact: true }).click();
  await expect(sceneButton(page, 'Rooftop')).not.toContainText('Proposed');
  expect(model.calls.map(c => `${c.method} ${c.path}`)).toEqual(['POST /api/v1/scenes/s2/occurrences', 'POST /api/v1/workspaces/' + workspace + '/scene-proposals/confirm']);
  expect(model.calls[0].body).toEqual({ role_id: 'father' });
  expect(model.calls[1].body).toMatchObject({ scene_ids: ['s9'], occurrence_ids: ['o9'] });
  expect(model.errors).toEqual([]);
});

test('the live preview prints the confirmed scenes and follows the selected scene; switching views keeps the composition', async ({ page }) => {
  const model = await studio(page);
  // Father prints again in the Garden (repeat), so Scene 3 has its own divider; Office and Hospital print nobody new.
  model.scenes.find(s => s.id === 's3')!.occurrences[0].deck_placement = 'repeat';
  await page.goto(path);
  const stage = page.getByRole('region', { name: 'Slide preview' }); const slide = page.locator('.stage-frame .stage-slide');
  const names = page.getByRole('navigation', { name: 'Slides' }).locator('.strip-thumb-name');
  const deck = ['Cover', 'Synthetic person-1', 'Kitchen | INT. KITCHEN - NIGHT. · Divider', 'Father · Synthetic person-1, Synthetic person-2', 'Mother 1 · Pending',
    'Garden | EXT. GARDEN - DAY. · Divider', 'Father · Synthetic person-1, Synthetic person-2', 'Thank you'];
  await expect(names).toHaveText(deck);
  await expect(stage.getByText('Live preview · updates as you edit')).toBeVisible();
  await expect(slide).toHaveAttribute('aria-label', 'Slide 1 of 8: Cover');
  // Entering the Scene breakdown selects Scene 1, and the stage opens its divider.
  await page.getByRole('button', { name: 'Scene breakdown', exact: true }).click();
  await expect(sceneButton(page, 'Kitchen')).toHaveAttribute('aria-current', 'true');
  await expect(slide).toHaveAttribute('aria-label', 'Slide 3 of 8: Kitchen | INT. KITCHEN - NIGHT. · Divider');
  await expect(slide).toContainText('Kitchen | INT. KITCHEN - NIGHT.');
  await sceneButton(page, 'Garden').click();
  await expect(slide).toHaveAttribute('aria-label', 'Slide 6 of 8: Garden | EXT. GARDEN - DAY. · Divider');
  await expect(slide).toContainText('Garden | EXT. GARDEN - DAY.');
  // A scene that prints no page of its own leaves the stage where it is.
  await sceneButton(page, 'Hospital').click();
  await expect(sceneButton(page, 'Hospital')).toHaveAttribute('aria-current', 'true');
  await expect(slide).toHaveAttribute('aria-label', 'Slide 6 of 8: Garden | EXT. GARDEN - DAY. · Divider');
  await expect(names).toHaveText(deck);
  // Leaving the breakdown clears the focus but keeps the current page; the composition is the same in both views.
  await page.getByRole('button', { name: 'Standard view', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Casting choices', exact: true })).toBeVisible();
  await expect(slide).toHaveAttribute('aria-label', 'Slide 6 of 8: Garden | EXT. GARDEN - DAY. · Divider');
  await expect(names).toHaveText(deck);
  expect(model.calls).toEqual([]); expect(model.errors).toEqual([]);
});

test('the scene breakdown passes axe and fits a phone without sideways scrolling', async ({ page }) => {
  const model = await studio(page); await page.goto(path);
  await page.getByRole('button', { name: 'Scene breakdown', exact: true }).click();
  await sceneButton(page, 'Garden').click();
  await expect(page.getByRole('article', { name: 'Father', exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).include('.scene-breakdown').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(results.violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(sceneButton(page, 'Garden')).toHaveAttribute('aria-current', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(model.calls).toEqual([]); expect(model.errors).toEqual([]);
});
