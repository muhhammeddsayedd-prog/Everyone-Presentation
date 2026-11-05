import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { presentationFixture, presentationId as id, presentationVersionFixture } from '../fixtures/presentation';
import { reviewFromRenderSnapshot } from '../../packages/domain/src/presentation';
import type { PresentationVersion } from '../../packages/domain/src/presentation-types';

// Synthetic browser acceptance for the presentation-first P3 screens: Review, Versions, Share & feedback, the saved
// version viewer and its original-introduction page. Every record is invented; the API is mocked per test.
test.use({ actionTimeout: 10000 });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const stamp = '2026-11-05T09:00:00Z';
const external = { id: id(6), key: 'client', label: 'Client', scope: 'external', settings: {}, archived: false, row_version: 1 };
const internal = { id: id(66), key: 'internal', label: 'Internal production', scope: 'internal', settings: {}, archived: false, row_version: 1 };

interface Options { issues?: unknown[]; overflow?: boolean; staleGeneration?: boolean; badTemplate?: boolean; queued?: boolean }
async function studio(page: Page, options: Options = {}) {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const snapshot = presentationFixture({ frames: 1 }); snapshot.audience_snapshot = { ...external } as typeof snapshot.audience_snapshot;
  const W = snapshot.workspace_id, P = snapshot.project_id, S = snapshot.series_id, SI = id(60);
  const saved = structuredClone(snapshot); saved.slides[1].fields!.name_or_id = 'Saved Candidate Name';
  const v1 = presentationVersionFixture(saved); Object.assign(v1, { status: options.queued ? 'queued' : 'ready', ready_at: options.queued ? null : stamp, pdf_asset_id: options.queued ? null : id(70), manifest_asset_id: options.queued ? null : id(71) });
  const versions = new Map<string, PresentationVersion>([[v1.id, v1]]);
  if (options.badTemplate) { const v2 = structuredClone(v1); v2.id = id(61); v2.version_no = 2; v2.slides.forEach(slide => { slide.version_id = v2.id; }); v2.render_context.template.content_sha256 = 'f'.repeat(64); versions.set(v2.id, v2); }
  const draft = structuredClone(snapshot); draft.slides[1].fields!.name_or_id = 'Current Draft Name';
  const state = { revision: 2, reviewReads: 0, generations: [] as unknown[], feedbackReads: 0 };
  const seriesDto = (sid: string, audience: typeof external, title: string) => ({ id: sid, workspace_id: W, output_type: 'selection', audience_preset_id: audience.id, audience_snapshot: audience, title,
    latest_ready_version_id: sid === S && !options.queued ? v1.id : null, latest_ready_version_no: sid === S && !options.queued ? 1 : null, row_version: 1, archived: false,
    template_key: snapshot.template.key, template_version: snapshot.template.version, template_content_sha256: snapshot.template.content_sha256, font_key: snapshot.template.font_key });
  const comment = { id: id(80), series_id: S, version_id: v1.id, version_slide_id: id(7), guest_session_id: id(81), author_display_name: 'Synthetic Guest', company: 'Synthetic Agency', visibility: 'external',
    body: 'Synthetic external comment', parent_comment_id: null, resolved: false, row_version: 1, created_at: stamp, updated_at: stamp };
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname; const method = request.method();
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-p3', data } });
    const list = (data: unknown[]) => route.fulfill({ json: { request_id: 'synthetic-p3', data, page: { next_cursor: null } } });
    const fail = (status: number, code = 'NOT_FOUND', message = 'Synthetic route unavailable.') => route.fulfill({ status, json: { request_id: 'synthetic-p3', error: { code, message, details: {}, retryable: status >= 500 } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-p3-producer', name: 'Synthetic Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'cast.review', 'presentations.generate', 'review_links.manage'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/projects/${P}`) return ok({ id: P, name: 'Synthetic Project', client_id: null, client_name: 'Synthetic Client', client_logo_asset_id: null, row_version: 1, can_edit: true, presentation_type: 'casting' });
    if (path === `/api/v1/workspaces/${W}`) return ok({ id: W, project_id: P, module: 'casting', title: 'Synthetic Project', active_output: 'selection', row_version: snapshot.input_workspace_row_version, draft_revision: state.revision, has_unpublished_changes: true, logo_asset_id: null, logo_placement: 'cover', created_at: stamp, updated_at: stamp });
    if (path === `/api/v1/workspaces/${W}/summary`) return fail(404);
    if (path === '/api/v1/audience-presets') return list([external, internal]);
    if (path === '/api/v1/presentation-series') return list([seriesDto(S, external, 'Synthetic Selection'), seriesDto(SI, internal, 'Synthetic Internal')]);
    if (path === `/api/v1/presentation-series/${S}`) return ok(seriesDto(S, external, 'Synthetic Selection'));
    if (path === `/api/v1/presentation-series/${SI}`) return ok(seriesDto(SI, internal, 'Synthetic Internal'));
    if (path === `/api/v1/presentation-series/${SI}/versions`) return list([]);
    if (path === `/api/v1/presentation-series/${S}/versions` && method === 'GET') return list([...versions.values()].sort((a, b) => b.version_no - a.version_no));
    if (path === `/api/v1/presentation-series/${S}/versions` && method === 'POST') { state.generations.push(request.postDataJSON());
      return options.staleGeneration ? fail(409, 'STALE_REVISION', 'The presentation information changed since this draft was read.') : fail(503, 'DEPENDENCY_UNAVAILABLE', 'Synthetic unavailable'); }
    if (path === `/api/v1/workspaces/${W}/review`) {
      state.reviewReads++;
      const review = reviewFromRenderSnapshot(draft);
      return ok({ ...review, series_id: url.searchParams.get('series_id'), draft_revision: state.revision, can_generate: !options.issues?.some(issue => (issue as { severity: string }).severity === 'blocking'), issues: options.issues ?? [],
        fit: options.overflow ? { status: 'measured', input_fingerprint: draft.input_fingerprint, measured_at: stamp, overflows: [{ slide_index: 1, field: 'presentation_notes', overflow_px: 24.2, axis: 'vertical' }], error_code: null }
          : { status: 'measured', input_fingerprint: draft.input_fingerprint, measured_at: stamp, overflows: [], error_code: null } });
    }
    if (/\/content$/u.test(path) && method === 'GET') return route.fulfill({ status: 200, contentType: 'image/png', body: png });
    if (path === `/api/v1/versions/${v1.id}/feedback/summary`) return ok({ version_id: v1.id, per_slide: [{ version_slide_id: id(7), preferred: 0, maybe: 0, not_preferred: 0, comment_count: 1, unresolved_count: 1 }], totals: { preferred: 0, maybe: 0, not_preferred: 0, comment_count: 1, unresolved_count: 1 } });
    if (path === `/api/v1/versions/${v1.id}/feedback`) { state.feedbackReads++; return ok({ version_id: v1.id, comments: [comment], preferences: [], page: { next_cursor: null } }); }
    if (path.startsWith('/api/v1/versions/') && path.split('/').length === 5) { const found = versions.get(path.split('/')[4]); return found ? ok(found) : fail(404, 'NOT_FOUND', 'Version not found.'); }
    if (path === `/api/v1/versions/${v1.id}/media/${id(10)}/playback` && method === 'POST') return ok({ source_version_id: v1.id, asset_id: id(10), url: 'https://synthetic.invalid/retained-original.mp4' });
    if (path === '/api/v1/review-links' && method === 'GET') return list([{ id: id(90), series_id: S, label: 'Client review', expires_at: '2026-12-05T09:00:00Z', download_enabled: true, revoked_at: null, latest_ready_version_id: v1.id, row_version: 1, created_at: stamp }]);
    if (path.startsWith('/api/v1/candidates/') && path.endsWith('/media')) return list([]);
    return fail(404);
  });
  const base = `/projects/${P}/casting/${W}`;
  return { errors, state, base, S, SI, v1, moveDraft: () => { state.revision++; } };
}
const stage = (page: Page) => page.getByRole('region', { name: 'Slide preview' });
const field = (page: Page, name: string) => page.locator(`.stage-frame .stage-slide [data-fit-field="${name}"]`);
const marked = (page: Page) => page.evaluate(() => document.querySelector('.stage-frame .stage-slide-canvas')?.shadowRoot?.querySelector('style')?.textContent ?? '');
/** Opens a check group (blocking groups start open; a second click would close them). */
async function expand(page: Page, group: RegExp) { const toggle = page.getByRole('button', { name: group }); if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click(); }
const axe = async (page: Page) => (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()).violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(' ')).join(', ')}`);
const issues = [
  { code: 'UNREVIEWED_PROFILE', severity: 'warning', entity_id: id(9), field: null, message: 'Current Draft Name is Unreviewed.', repair_action: null },
  { code: 'MISSING_FIELD', severity: 'warning', entity_id: id(8), field: 'height_measurements', message: 'Height is not provided.', repair_action: null },
  { code: 'OPEN_SLOT', severity: 'information', entity_id: id(44), field: null, message: 'Synthetic Slot2 has no candidate yet.', repair_action: null },
  { code: 'NO_MAIN', severity: 'blocking', entity_id: id(41), field: null, message: 'Synthetic Slot1 needs a Main.', repair_action: null },
];

test('review: a check brings its slide with the field marked, Fix opens the inspector and unsaved wording is previewed as such', async ({ page }) => {
  const model = await studio(page, { issues }); await page.goto(`${model.base}/review?series_id=${model.S}`);
  await expect(stage(page).getByText('Server-checked draft · revision 2')).toBeVisible();
  await expect(page.getByText('1 check blocks generation', { exact: true })).toBeVisible();
  await expect(page.getByText('3 notes · 1 blocker', { exact: true })).toBeVisible();
  // Information: the field the server named is marked on the person's slide.
  await expand(page, /^Information/);
  await page.getByRole('button', { name: /^Show Current Draft Name on the slide: Height is not provided\./u }).click();
  await expect(page.locator('.stage-frame .stage-slide')).toHaveAttribute('aria-label', 'Slide 2 of 3: Current Draft Name');
  await expect.poll(() => marked(page)).toContain('[data-fit-field="height_measurements"]');
  // Pending slots: the open slot's Pending page.
  await expand(page, /^Pending slots/);
  await page.getByRole('button', { name: /^Show Synthetic Slot2 · Pending on the slide: Synthetic Slot2 has no candidate yet\./u }).click();
  await expect(page.locator('.stage-frame .stage-slide')).toHaveAttribute('aria-label', 'Slide 3 of 3: Synthetic Slot2 · Pending');
  // Profiles: Fix opens the inspector on the person's facts.
  await expand(page, /^Profiles not reviewed/);
  await page.locator('.check-group').filter({ has: page.getByRole('button', { name: /^Profiles not reviewed/ }) }).getByRole('button', { name: 'Fix Current Draft Name' }).click();
  const inspector = page.getByRole('complementary', { name: 'Assignment review' });
  await expect(inspector.getByRole('tab', { name: 'Facts' })).toHaveAttribute('aria-selected', 'true');
  await expect(inspector.getByText('Unreviewed · facts not yet confirmed')).toBeVisible();
  // A missing field opens the wording for that field; typing previews it on the slide and the stage says it is unsaved.
  await page.locator('.check-group').filter({ has: page.getByRole('button', { name: /^Information/ }) }).getByRole('button', { name: 'Fix Current Draft Name' }).click();
  await expect(inspector.getByRole('tab', { name: 'Wording' })).toHaveAttribute('aria-selected', 'true');
  await expect(inspector.getByRole('combobox', { name: 'Slide wording field' })).toHaveValue('height_measurements');
  await inspector.getByRole('textbox', { name: 'Presentation wording' }).fill('190 cm');
  await expect(stage(page).getByText('Previewing your unsaved edit')).toBeVisible();
  await expect(field(page, 'height_measurements')).toHaveText('190 cm');
  await inspector.getByRole('button', { name: 'Discard wording edit' }).click();
  await expect(field(page, 'height_measurements')).toHaveText('Not provided');
  await expect(stage(page).getByText('Server-checked draft · revision 2')).toBeVisible();
  // Someone moves the draft after this check: the panel says so instead of re-checking silently.
  model.moveDraft(); await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.getByText('The draft changed after this check (revision 2 → 3). The stage and checks show the checked revision.')).toBeVisible();
  await expect(stage(page).getByText('Draft changed since this check')).toBeVisible();
  const reads = model.state.reviewReads; await page.getByRole('button', { name: 'Check again' }).click();
  await expect.poll(() => model.state.reviewReads).toBeGreaterThan(reads);
  await expect(stage(page).getByText('Server-checked draft · revision 3')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  expect(model.errors).toEqual([]);
});

test('review: a measured overflow opens its page with the field marked as overflowing and its wording ready to shorten', async ({ page }) => {
  const model = await studio(page, { overflow: true }); await page.goto(`${model.base}/review?series_id=${model.S}`);
  await expect(page.getByRole('button', { name: /^Layout fit/ })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('1 overflow', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Edit Slide 2/ }).click();
  await expect(page.locator('.stage-frame .stage-slide')).toHaveAttribute('aria-label', 'Slide 2 of 3: Current Draft Name');
  await expect.poll(() => marked(page)).toContain('#ff6b6b');
  await expect(page.getByRole('complementary', { name: 'Assignment review' }).getByRole('combobox', { name: 'Slide wording field' })).toHaveValue('presentation_notes');
  expect(model.errors).toEqual([]);
});

test('versions: the stage shows either the server-checked draft or the selected saved snapshot, and a stale draft is refused', async ({ page }) => {
  const model = await studio(page, { staleGeneration: true, badTemplate: true }); await page.goto(`${model.base}/presentations?series_id=${model.S}`);
  await expect(stage(page).getByText('Working draft · revision 2')).toBeVisible();
  await page.getByRole('navigation', { name: 'Slides' }).getByRole('button', { name: 'Slide 2 of 3: Current Draft Name' }).click();
  await expect(field(page, 'name_or_id')).toHaveText('Current Draft Name');
  // Version 1 is its own snapshot: nothing from the working draft appears while it is selected.
  await page.getByRole('list', { name: 'Saved versions' }).getByRole('button', { name: /^Version 1 / }).click();
  await expect(page.getByRole('heading', { name: 'Saved version 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Slide 2: Synthetic Role / Synthetic Slot1', exact: true }).click();
  await expect(page.getByText('Saved Candidate Name', { exact: true })).toBeVisible();
  await expect(page.getByText('Current Draft Name')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute('href', `/api/v1/versions/${model.v1.id}/pdf/content`);
  // A version whose template is not registered says so instead of drawing an approximation.
  await page.getByRole('list', { name: 'Saved versions' }).getByRole('button', { name: /^Version 2 / }).click();
  await expect(page.getByText('This saved template is unavailable in this viewer. Open the original PDF or restore its registered template.')).toBeVisible();
  // Back to the draft; generating from a draft that changed meanwhile is refused by the server and stays refused.
  await page.getByRole('button', { name: 'Show on stage' }).click();
  await expect(stage(page).getByText('Working draft · revision 2')).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Saved version/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Generate saved version' }).click();
  await expect(page.getByText('The presentation information changed since this draft was read. Refresh the working draft, check it, then generate.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate saved version' })).toBeDisabled();
  expect(model.state.generations).toEqual([{ expected_workspace_row_version: 3, expected_draft_revision: 2, expected_input_fingerprint: 'c'.repeat(64) }]);
  expect(await axe(page)).toEqual([]);
  expect(model.errors).toEqual([]);
});

test('share: links stay in the panel, the stage shows the version guests see, and feedback follows the slide', async ({ page }) => {
  const model = await studio(page); await page.goto(`${model.base}/share?series_id=${model.S}`);
  await expect(page.getByRole('navigation', { name: 'Casting workspace steps' }).getByRole('link', { name: '7 Share & feedback', exact: true })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('heading', { name: 'Client review', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create review link', exact: true })).toBeVisible();
  await expect(page.getByText('Version 1 · guests see this version')).toBeVisible();
  const feedback = page.getByRole('complementary', { name: 'Feedback' });
  // On the cover, feedback asks for a candidate; choosing one there moves the stage to that slide.
  await expect(feedback.getByText('Choose a candidate slide · Version 1 · 1 comment in this version')).toBeVisible();
  await feedback.getByRole('combobox', { name: 'Role / slot' }).selectOption(id(7));
  await expect(page.getByRole('button', { name: 'Slide 2: Synthetic Role / Synthetic Slot1', exact: true })).toHaveAttribute('aria-current', 'step');
  await expect(feedback.getByText('Synthetic external comment')).toBeVisible();
  // An unsent comment is protected when the stage moves on.
  await feedback.getByRole('button', { name: 'Add feedback' }).click();
  await feedback.getByRole('textbox', { name: 'Comment' }).fill('Unsent thought');
  await page.getByRole('button', { name: 'Slide 3: Synthetic Role / Synthetic Slot2', exact: true }).click();
  await expect(page.getByRole('alertdialog', { name: 'Discard your unsent comment?' })).toBeVisible();
  await page.getByRole('button', { name: 'Keep writing' }).click();
  await expect(feedback.getByRole('textbox', { name: 'Comment' })).toHaveValue('Unsent thought');
  await expect(page.getByRole('button', { name: 'Slide 2: Synthetic Role / Synthetic Slot1', exact: true })).toHaveAttribute('aria-current', 'step');
  await feedback.getByRole('button', { name: 'Cancel' }).click();
  expect(await axe(page)).toEqual([]);
  // An internal series cannot be shared with guests: no link controls are offered.
  await page.getByRole('combobox', { name: 'Presentation series' }).selectOption(model.SI);
  await expect(page.getByText('This series has an internal audience. Use a separate external-audience series for guest sharing.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Create review link', exact: true })).toHaveCount(0);
  expect(model.errors).toEqual([]);
});

test('viewer: slide list, keyboard paging and feedback counts come from the saved version only', async ({ page }) => {
  const model = await studio(page); await page.goto(`/presentations/versions/${model.v1.id}`);
  await expect(page.getByRole('heading', { name: 'Saved version 1', exact: true })).toBeVisible();
  const list = page.getByRole('navigation', { name: 'Slides in saved version' });
  await expect(list.getByRole('button')).toHaveCount(3);
  await expect(list.locator('.version-slide-row').nth(1).locator('.pill')).toHaveText('1');
  await expect(list.locator('.version-slide-row').nth(1)).toContainText('Saved Candidate Name · Option');
  await page.getByRole('region', { name: /^Slide 1: Cover\. Use the arrow keys/ }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(list.getByRole('button', { name: 'Slide 2: Synthetic Role / Synthetic Slot1' })).toHaveAttribute('aria-current', 'step');
  await expect(page.getByText('Saved Candidate Name', { exact: true })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Feedback' }).getByText('Synthetic external comment')).toBeVisible();
  await page.keyboard.press('End');
  await expect(list.getByRole('button', { name: 'Slide 3: Synthetic Role / Synthetic Slot2' })).toHaveAttribute('aria-current', 'step');
  expect(await axe(page)).toEqual([]);
  expect(model.errors).toEqual([]);
});

test('viewer: a version still processing says so and offers no PDF; a missing version explains itself', async ({ page }) => {
  const model = await studio(page, { queued: true }); await page.goto(`/presentations/versions/${model.v1.id}`);
  await expect(page.getByText('The captured content is saved. Its PDF is still processing.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveCount(0);
  await page.goto(`/presentations/versions/${id(99)}`);
  await expect(page.getByRole('heading', { name: 'Saved version unavailable' })).toBeVisible();
  await expect(page.getByText('Version not found.')).toBeVisible();
});

test('original introduction: the saved video and transcript fit desktop, tablet and phone without sideways scrolling', async ({ page }) => {
  const model = await studio(page);
  for (const [width, height] of [[1440, 900], [1024, 768], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto(`/presentations/versions/${model.v1.id}/media/${id(10)}`);
    await page.getByRole('button', { name: 'Open saved video', exact: true }).click();
    await expect(page.locator('video')).toHaveAttribute('src', 'https://synthetic.invalid/retained-original.mp4');
    await expect(page.getByRole('link', { name: 'Back to saved version' })).toHaveAttribute('href', `/presentations/versions/${model.v1.id}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const box = await page.locator('.media-player').boundingBox(); expect(box && box.width <= width).toBe(true);
  }
  expect(await axe(page)).toEqual([]);
  expect(model.errors).toEqual([]);
});
