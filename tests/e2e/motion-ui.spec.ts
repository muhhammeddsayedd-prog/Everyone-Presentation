import { expect, test, type Page } from '@playwright/test';
import type { CentralJob } from '@eps/central';

// Controlled HTTP/DOM coverage of the motion layer: exits never leave a second dialog behind, reduced motion
// removes every exit copy, animated values and headings keep their exact text, and the segmented fill follows
// the selection.
const workspaceId = '93900000-0000-4000-8000-000000000021';
const projectId = '94900000-0000-4000-8000-000000000021';
const jobId = '92900000-0000-4000-8000-000000000021';
const job = { id: jobId, workspace_id: workspaceId, kind: 'candidate_scan', status: 'failed', stage: 'transcribe', attempt: 1,
  progress_completed: 0, progress_total: 1, batch_id: null, input_asset_id: null, resource_id: null,
  error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'synthetic', details: {}, retryable: true },
  row_version: 1, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' } as CentralJob;
const projects = ['Synthetic coffee campaign', 'Synthetic bank campaign'].map((name, index) => ({ id: `94900000-0000-4000-8000-00000000003${index}`, name,
  client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: index ? null : workspaceId, can_edit: false }));

async function mock(page: Page, signedIn = true) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    const ok = (data: unknown, extra: Record<string, unknown> = {}) => route.fulfill({ json: { request_id: 'controlled-motion', data, ...extra } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: signedIn ? { id: '91900000-0000-4000-8000-000000000021', name: 'Synthetic Operator', capabilities: ['projects.read', 'workspaces.read', 'operations.retry'], upload_purposes: [] } : null, actors: [] });
    if (path === '/api/v1/jobs') return ok([job], { page: { next_cursor: null } });
    if (path === `/api/v1/jobs/${jobId}`) return ok(job);
    if (path === '/api/v1/projects') return ok(projects, { page: { next_cursor: null } });
    if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic motion workspace', logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 1, draft_revision: 0, has_unpublished_changes: false, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
    if (path === `/api/v1/projects/${projectId}`) return ok({ ...projects[0], id: projectId });
    return route.fulfill({ status: 404, json: { error: { code: 'NOT_FOUND', message: 'Synthetic route unavailable' } } });
  });
}

async function closeDrawer(page: Page) {
  await page.goto('/processing');
  const opener = page.getByRole('link', { name: 'Candidate scan', exact: true });
  await opener.click();
  const drawer = page.getByRole('dialog', { name: 'Processing details' });
  await expect(drawer).toBeVisible();
  await page.evaluate(() => {
    const seen: { hidden: string | null; inert: boolean; role: string | null }[] = [];
    (window as unknown as { motionGhosts: typeof seen }).motionGhosts = seen;
    new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof HTMLElement && node.classList.contains('motion-ghost')) seen.push({ hidden: node.getAttribute('aria-hidden'), inert: node.inert, role: node.getAttribute('role') });
    }))).observe(document.body, { childList: true });
  });
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
  return opener;
}

test('a closing drawer plays its exit as an inert copy that leaves no dialog behind', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await mock(page);
  const opener = await closeDrawer(page);
  const seen = await page.evaluate(() => (window as unknown as { motionGhosts: unknown[] }).motionGhosts);
  expect(seen).toEqual([{ hidden: 'true', inert: true, role: null }, { hidden: 'true', inert: true, role: null }]);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('.motion-ghost')).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(errors).toEqual([]);
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('nothing animates out and no script animation runs', async ({ page }) => {
    await mock(page);
    await closeDrawer(page);
    expect(await page.evaluate(() => (window as unknown as { motionGhosts: unknown[] }).motionGhosts)).toEqual([]);
    const running = await page.evaluate(() => document.getAnimations().filter(animation => !(animation instanceof CSSTransition)).length);
    expect(running).toBe(0);
  });
});

test('the segmented fill follows the pressed option and the buttons keep their names', async ({ page }) => {
  await mock(page);
  await page.goto('/projects');
  const group = page.getByRole('group', { name: 'Filter loaded projects' });
  const indicator = group.locator('.segment-indicator');
  await expect(indicator).toHaveAttribute('data-active', '');
  const options = group.getByRole('button');
  const target = options.nth(1);
  await target.click();
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(async () => {
    const [a, b] = await Promise.all([indicator.boundingBox(), target.boundingBox()]);
    return a && b ? Math.round(Math.abs(a.x - b.x) + Math.abs(a.width - b.width)) : -1;
  }).toBeLessThanOrEqual(1);
});

test('the sign-in heading reveals word by word but reads as one sentence', async ({ page }) => {
  await mock(page, false);
  await page.goto('/projects');
  await expect(page.getByRole('heading', { level: 1, name: 'Your casting workspace.', exact: true })).toBeVisible();
});
