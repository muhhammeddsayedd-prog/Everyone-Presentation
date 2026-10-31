import { createHash } from 'node:crypto';
import { test, expect, type Page } from '@playwright/test';
import type { Spec } from '@eps/domain';

// Controlled browser/HTTP evidence only. Every API and Storage request is
// intercepted. These tests do not claim real parsing, Auth or Storage acceptance.
const projectId = '92800000-0000-4000-8000-000000000001';
const workspaceId = '93800000-0000-4000-8000-000000000001';
const specId = '94800000-0000-4000-8000-000000000001';
const uploadId = '95800000-0000-4000-8000-000000000001';
const assetId = '96800000-0000-4000-8000-000000000001';
const jobId = '97800000-0000-4000-8000-000000000001';
const storage = 'https://synthetic.supabase.co';
const sourcePath = `/api/v1/workspaces/${workspaceId}/specs`;
const view = `/projects/${projectId}/casting/${workspaceId}/specs`;
const plainFile = { name: 'synthetic-brief.txt', mimeType: 'text/plain', buffer: Buffer.from('\ufeffOriginal Arabic عربي\r\n\r\nثلاثة ممثلين 😀') };
type Mode = 'normal' | 'unknown-put' | 'unknown-submit' | 'unknown-complete' | 'refresh-failure' | 'stale' | 'unavailable' | 'no-capability' | 'no-origin';
const diagnostics = new WeakMap<Page, () => unknown>();
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && diagnostics.has(page)) await info.attach('controlled-flow-diagnostics', {
    body: JSON.stringify(diagnostics.get(page)!()), contentType: 'application/json' });
});

async function fileWorkspace(page: Page, mode: Mode = 'normal') {
  let spec: Spec = { id: specId, workspace_id: workspaceId, source_asset_id: null, source_text: 'Previously saved source',
    normalized_instructions: 'Manual instructions retained', clarifications: [], row_version: 7, processing_job_id: null };
  const calls: { path: string; key: string; body: Record<string, unknown>; serialized: string }[] = [];
  const transfers: { bytes: Buffer; headers: Record<string, string> }[] = [];
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  let stored = false; let lost = false; let failRead = false; let reservation: Record<string, unknown> | null = null;
  let hold: Promise<void> | null = null; let release: (() => void) | null = null;
  diagnostics.set(page, () => ({ requested_paths: calls.map(call => call.path), transfer_count: transfers.length, page_errors: errors }));
  const session = () => ({ id: uploadId, asset_id: assetId, protocol: 'signed_put', status: 'open', maximum_bytes: 20 * 1024 * 1024,
    expires_at: '2030-01-01T00:00:00Z', upload_headers: { 'Content-Type': reservation!.mime_type, 'x-upsert': 'false' },
    upload_url: `${storage}/storage/v1/object/upload/sign/eps-specs-assets/assets/${assetId}/original.${String(reservation!.filename).split('.').at(-1)}?token=synthetic-capability` });
  const accepted = { job_id: jobId, resource_id: specId, poll_url: `/api/v1/jobs/${jobId}`, status: 'queued' };
  await page.route(`${storage}/**`, async route => {
    const request = route.request();
    const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3100', 'Access-Control-Allow-Methods': 'PUT, OPTIONS', 'Access-Control-Allow-Headers': 'content-type,x-upsert' };
    if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
    expect(request.method()).toBe('PUT');
    expect(new URL(request.url()).pathname).toBe(new URL(session().upload_url).pathname);
    transfers.push({ bytes: request.postDataBuffer()!, headers: request.headers() }); stored = true;
    if (mode === 'unknown-put' && !lost) { lost = true; return route.abort('failed'); }
    return route.fulfill({ status: 200, body: '', headers });
  });
  await page.route('**/api/**', async route => {
    const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
    const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'controlled-file-source', data } });
    const fail = (code: string, status: number) => route.fulfill({ status, json: { request_id: 'controlled-file-source', error: { code, message: 'Controlled response', details: {}, retryable: true } } });
    if (path === '/api/session') return ok({ mode: 'supabase', ...(mode === 'no-origin' ? {} : { storage_origin: storage }), actor: {
      id: '91800000-0000-4000-8000-000000000001', name: 'Synthetic File Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write'],
      upload_purposes: mode === 'no-capability' ? [] : ['specs'] }, actors: [] });
    if (path === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic File Project', client_id: null, client_name: null, client_logo_asset_id: null,
      row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: true });
    if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic File Project',
      logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 11, draft_revision: 5, has_unpublished_changes: true,
      created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
    if (path === `/api/v1/workspaces/${workspaceId}/roles` && method === 'GET') return route.fulfill({ json: { request_id: 'controlled-file-source', data: [], page: { next_cursor: null } } });
    if (path === sourcePath && method === 'GET') { if (failRead) { failRead = false; return fail('DEPENDENCY_UNAVAILABLE', 503); } return ok(spec); }
    if (path === sourcePath && method === 'PATCH') { spec = { ...spec, normalized_instructions: request.postDataJSON().normalized_instructions, row_version: spec.row_version + 1 }; return ok(spec); }
    if (path === `/api/v1/jobs/${jobId}`) return ok({ id: jobId, workspace_id: workspaceId, resource_id: specId, kind: 'specs_extract', status: 'queued',
      stage: 'prepare_document', attempt: 0, progress_completed: 0, progress_total: 3, batch_id: null, input_asset_id: assetId, error: null,
      row_version: 1, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
    if (method === 'POST') calls.push({ path, body: request.postDataJSON(), serialized: request.postData()!, key: request.headers()['idempotency-key'] });
    if (path === '/api/v1/uploads' && method === 'POST') { reservation = request.postDataJSON(); return ok(session(), 201); }
    if (path === `/api/v1/uploads/${uploadId}` && method === 'GET') return ok(session());
    if (path === `/api/v1/uploads/${uploadId}/complete` && method === 'POST') {
      if (!stored) return fail('UPLOAD_INCOMPLETE', 409);
      if (mode === 'unknown-complete' && !lost) { lost = true; return fail('DEPENDENCY_UNAVAILABLE', 503); }
      return ok({ status: 'ready', processing_job_id: null, asset: { id: assetId, purpose: 'specs', filename: reservation!.filename, mime_type: reservation!.mime_type,
        size_bytes: reservation!.size_bytes, sha256: reservation!.sha256, status: 'ready', width: null, height: null, duration_ms: null,
        source_asset_id: null, source_timestamp_ms: null, created_at: '2026-10-28T00:00:00Z' } });
    }
    if (path === sourcePath && method === 'POST') {
      if (hold) await hold;
      if (mode === 'unavailable') return fail('FEATURE_NOT_IMPLEMENTED', 503);
      if (mode === 'stale' && !lost) { lost = true; spec = { ...spec, row_version: 9 }; return fail('STALE_RESOURCE_VERSION', 409); }
      if (!spec.processing_job_id) spec = { ...spec, row_version: spec.row_version + 1, source_text: null, source_asset_id: assetId, processing_job_id: jobId };
      if (mode === 'unknown-submit' && !lost) { lost = true; return fail('DEPENDENCY_UNAVAILABLE', 503); }
      if (mode === 'refresh-failure' && !lost) { lost = true; failRead = true; }
      return ok(accepted, 202);
    }
    return fail('CONTROLLED_ROUTE_UNAVAILABLE', 503);
  });
  return { calls, transfers, errors, spec: () => spec,
    hold: () => { hold = new Promise<void>(resolve => { release = resolve; }); }, release: () => { release?.(); hold = null; } };
}

async function selectFile(page: Page) {
  await page.getByRole('button', { name: 'Upload PDF, DOCX or text' }).click();
  await page.getByLabel('Document source', { exact: true }).setInputFiles(plainFile);
}

test('controlled file acceptance preserves original bytes, uses real returned asset and restores durable source/job after reload', async ({ page }, info) => {
  const model = await fileWorkspace(page); model.hold(); await page.goto(view); await selectFile(page);
  await page.getByRole('button', { name: 'Process document', exact: true }).click();
  await expect.poll(() => model.calls.filter(call => call.path === sourcePath).length).toBe(1);
  expect(model.spec().source_text).toBe('Previously saved source');
  await expect(page.getByRole('button', { name: 'Saving document…' })).toBeDisabled();
  await expect(page.getByLabel('General instructions', { exact: true })).toHaveAttribute('readonly', '');
  model.release(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  const reserve = model.calls.find(call => call.path === '/api/v1/uploads')!;
  expect(reserve.body).toEqual({ purpose: 'specs', workspace_id: workspaceId, filename: plainFile.name, mime_type: 'text/plain', size_bytes: plainFile.buffer.length,
    sha256: createHash('sha256').update(plainFile.buffer).digest('hex') });
  expect(model.transfers[0].bytes).toEqual(plainFile.buffer); expect(model.transfers).toHaveLength(1);
  expect(model.transfers[0].headers.authorization).toBeUndefined(); expect(model.transfers[0].headers.cookie).toBeUndefined(); expect(model.transfers[0].headers['x-upsert']).toBe('false');
  expect(model.calls.find(call => call.path.endsWith('/complete'))!.body.start_processing).toBe(false);
  expect(model.calls.find(call => call.path === sourcePath)!.body).toEqual({ source_asset_id: assetId, row_version: 7 });
  await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Manual instructions retained');
  for (const width of [1440, 320]) { await page.setViewportSize({ width, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath(`file-source-${width}.png`), fullPage: true }); }
  await page.reload(); await expect(page.getByRole('link', { name: 'View source processing' })).toHaveAttribute('href', `/processing?job=${jobId}`);
  await expect(page.getByText('A source document is recorded.', { exact: true })).toBeVisible(); expect(model.errors).toEqual([]);
});

test('controlled unknown immutable PUT checks completion before any retry and locks local mode changes', async ({ page }) => {
  const model = await fileWorkspace(page, 'unknown-put'); await page.goto(view); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Retry this file request' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Paste text', exact: true })).toBeDisabled();
  await expect(page.getByLabel('General instructions', { exact: true })).toHaveAttribute('readonly', '');
  await page.getByRole('button', { name: 'Retry this file request' }).click(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  expect(model.transfers).toHaveLength(1); expect(model.calls.filter(call => call.path === '/api/v1/uploads')).toHaveLength(1);
  expect(model.calls.filter(call => call.path.endsWith('/complete'))).toHaveLength(1);
});

test('controlled stale submit reloads the Spec version while reusing the verified original', async ({ page }) => {
  const model = await fileWorkspace(page, 'stale'); await page.goto(view); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Process document', exact: true })).toBeDisabled();
  await page.locator('.source-file-intake').getByRole('button', { name: 'Reload saved requirements', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Process document', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  const submits = model.calls.filter(call => call.path === sourcePath); expect(submits.map(call => call.body.row_version)).toEqual([7, 9]);
  expect(submits[1].key).not.toBe(submits[0].key); expect(submits.every(call => call.body.source_asset_id === assetId)).toBe(true);
  expect(model.transfers).toHaveLength(1); expect(model.calls.filter(call => call.path.endsWith('/complete'))).toHaveLength(1);
});

for (const mode of ['unknown-complete', 'unknown-submit', 'refresh-failure'] as const) test(`controlled ${mode} retains confirmed checkpoints and retries exact intent`, async ({ page }) => {
  const model = await fileWorkspace(page, mode); await page.goto(view); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  await page.getByRole('button', { name: mode === 'refresh-failure' ? 'Reload accepted document' : 'Retry this file request', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Process document', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  expect(model.transfers).toHaveLength(1); expect(model.calls.filter(call => call.path === '/api/v1/uploads')).toHaveLength(1);
  const repeatPath = mode === 'unknown-complete' ? `/api/v1/uploads/${uploadId}/complete` : sourcePath;
  const repeated = model.calls.filter(call => call.path === repeatPath);
  if (mode === 'refresh-failure') expect(repeated).toHaveLength(1); else { expect(repeated).toHaveLength(2); expect(repeated[1]).toEqual(repeated[0]); }
});

test('controlled unavailable submit preserves selected original and allows manual work; dirty mode switch requires consent', async ({ page }) => {
  const model = await fileWorkspace(page, 'unavailable'); await page.goto(view);
  await page.getByLabel('Pasted source text').fill('Unsubmitted local correction');
  await page.getByRole('button', { name: 'Upload PDF, DOCX or text' }).click(); await page.getByRole('alertdialog', { name: 'Switch source input?' }).getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.getByLabel('Pasted source text')).toHaveValue('Unsubmitted local correction');
  await page.getByRole('button', { name: 'Upload PDF, DOCX or text' }).click(); await page.getByRole('alertdialog', { name: 'Switch source input?' }).getByRole('button', { name: 'Discard and switch', exact: true }).click();
  await page.getByLabel('Document source', { exact: true }).setInputFiles(plainFile); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Document processing is not available yet' })).toBeVisible();
  await expect(page.getByLabel('General instructions', { exact: true })).toBeEditable();
  await page.getByLabel('General instructions', { exact: true }).fill('Manual work continues'); await expect.poll(() => model.spec().normalized_instructions).toBe('Manual work continues');
  expect(model.spec().source_text).toBe('Previously saved source'); await expect(page.getByText(plainFile.name, { exact: true })).toBeVisible();
});

for (const mode of ['no-capability', 'no-origin'] as const) test(`controlled ${mode} cannot select or send original bytes`, async ({ page }) => {
  const model = await fileWorkspace(page, mode); await page.goto(view); await expect(page.getByRole('button', { name: 'Upload PDF or Word' })).toBeDisabled();
  await expect(page.getByLabel('Pasted source text')).toBeEditable(); await expect(page.getByLabel('Document source', { exact: true })).toHaveCount(0);
  expect(model.transfers).toHaveLength(0); expect(model.calls).toHaveLength(0);
});
