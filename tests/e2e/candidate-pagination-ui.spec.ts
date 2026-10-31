import { expect, test, type Page } from '@playwright/test';

// Desktop controlled HTTP/DOM proof only. No real identity, provider or SQL.
const candidate = '96000000-0000-4000-8000-000000000001';
const project = '96000000-0000-4000-8000-000000000002';
const workspace = '96000000-0000-4000-8000-000000000003';
const facts = { name: 'Synthetic paged person', casting_id: 'EPS-SYNTHETIC', age_or_range: null, stated_gender: null, height_measurements: null,
  languages: [], accents: [], skills_experience: null, city: null, previous_projects_roles: null, classification: null };
const source = (id: string, language: string) => ({ id, candidate_id: candidate, source_asset_id: `source-${id}`, preview_asset_id: null,
  transcript_asset_id: null, original_transcript: null, languages: [language], available_frames: [], selected_frame_asset_ids: [], processing_issues: [], row_version: 1 });

async function fixture(page: Page) {
  const requests: string[] = []; const writes: Record<string, unknown>[] = [];
  let pool = { id: 'pool', workspace_id: workspace, candidate_id: candidate, selected_candidate_media_id: 'second-source', selected_frame_asset_ids: [],
    availability: null, internal_notes: null, fresh_material_required: false, media_confirmed: true, row_version: 3 };
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname;
    const ok = (data: unknown) => route.fulfill({ json: { request_id: 'synthetic-page', data } });
    const list = (data: unknown[], next_cursor: string | null = null) => route.fulfill({ json: { request_id: 'synthetic-page', data, page: { next_cursor } } });
    if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: 'synthetic-reader', name: 'Synthetic Producer',
      capabilities: ['projects.read', 'workspaces.read', 'workspaces.write', 'cast.read', 'cast.write'], upload_purposes: [] }, actors: [] });
    if (path === `/api/v1/candidates/${candidate}`) return ok({ id: candidate, facts, row_version: 1, review_status: 'unreviewed', reviewed_at: null,
      possible_duplicate: true, merged_into_candidate_id: null, archived: false });
    if (path === `/api/v1/candidates/${candidate}/supporting-files`) return list([]);
    if (path === `/api/v1/candidates/${candidate}/media`) {
      requests.push('media:' + (url.searchParams.get('cursor') ?? 'first'));
      expect(url.searchParams.get('limit')).toBe('100');
      return url.searchParams.has('cursor') ? list([source('second-source', 'Arabic')]) : list([source('first-source', 'English')], 'media-next');
    }
    if (path === `/api/v1/candidates/${candidate}/duplicates`) {
      requests.push('duplicates:' + (url.searchParams.get('cursor') ?? 'first'));
      return url.searchParams.has('cursor') ? list([{ candidate_id: 'second-match', display_name: 'Second duplicate match', match_reasons: ['name'] }])
        : list([{ candidate_id: 'first-match', display_name: 'First duplicate match', match_reasons: ['name'] }], 'duplicates-next');
    }
    if (path === `/api/v1/projects/${project}`) return ok({ id: project, name: 'Synthetic paging project', client_id: null, client_name: null,
      client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspace, can_edit: false });
    if (path === `/api/v1/workspaces/${workspace}`) return ok({ id: workspace, project_id: project, title: 'Synthetic paging project', module: 'casting',
      active_output: 'selection', logo_asset_id: null, logo_placement: 'cover', row_version: pool.row_version, draft_revision: 1, has_unpublished_changes: true });
    if (path === `/api/v1/workspaces/${workspace}/candidates`) return list([pool]);
    if (path === '/api/v1/workspace-candidates/pool' && request.method() === 'PATCH') {
      const body = request.postDataJSON(); writes.push(body); expect(request.headers()['idempotency-key']).toHaveLength(36);
      expect(body.row_version).toBe(3); expect(body.selected_candidate_media_id).toBe('second-source'); expect(body.media_confirmed).toBe(true);
      pool = { ...pool, availability: body.availability, row_version: 4 }; return ok(pool);
    }
    return route.fulfill({ status: 404, json: { error: { code: 'CONTROLLED_ROUTE_UNAVAILABLE', message: 'Synthetic route unavailable.' } } });
  });
  return { requests, writes };
}

test('desktop shared profile reads introductions and duplicate matches beyond the first page', async ({ page }) => {
  const state = await fixture(page);
  await page.goto(`/library/cast/${candidate}`);
  await expect(page.getByRole('heading', { name: facts.name, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Play original video', exact: true })).toHaveCount(2);
  await expect(page.getByRole('link', { name: 'Second duplicate match', exact: true })).toBeVisible();
  expect(state.requests).toContain('media:media-next'); expect(state.requests).toContain('duplicates:duplicates-next'); expect(state.writes).toEqual([]);
});

test('desktop project choices retain a pinned introduction from a later page when saving availability', async ({ page }) => {
  const state = await fixture(page);
  await page.goto(`/projects/${project}/casting/${workspace}/cast`);
  await page.getByRole('button', { name: /^Edit project material for / }).click();
  const selected = page.getByRole('combobox', { name: 'Selected introduction', exact: true });
  await expect(selected).toHaveValue('second-source');
  await expect(selected.getByRole('option')).toHaveCount(3);
  await page.getByRole('textbox', { name: 'Project availability', exact: true }).fill('Friday');
  await page.getByRole('button', { name: 'Save project choices', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save project choices', exact: true })).toHaveCount(0);
  await expect(selected).toHaveValue('second-source'); expect(state.writes).toHaveLength(1);
  expect(state.requests).toContain('media:media-next');
});
