# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: file-source-intake-ui.spec.ts >> controlled unknown-complete retains confirmed checkpoints and retries exact intent
- Location: tests\e2e\file-source-intake-ui.spec.ts:130:92

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('button', { name: 'Process document', exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('button', { name: 'Process document', exact: true }) with timeout 5000ms
  - waiting for getByRole('button', { name: 'Process document', exact: true })

```

```yaml
- link "Skip to content":
  - /url: "#main-content"
- complementary:
  - link "Everyone Presentation Studio home":
    - /url: /projects
    - img "everyone."
    - text: Presentation Studio
  - text: Workspace
  - navigation "Main navigation":
    - link "Projects":
      - /url: /projects
    - link "Cast Library":
      - /url: /library/cast
    - link "Presentations":
      - /url: /presentations
    - link "Processing":
      - /url: /processing
    - link "Settings":
      - /url: /settings
  - text: Central workspace
  - paragraph: Authorized projects Everyone account
  - text: Casting · Selection & Shortlist
- banner:
  - text: Presentation Studio Casting Synthetic File Producer
  - button "Sign out"
- text: Central Supabase workspace. Setup and release verification are in progress.
- main:
  - link "Projects":
    - /url: /projects
  - text: / Synthetic File Project / Casting
  - heading "Synthetic File Project" [level=1]
  - paragraph: Client not provided·Casting workspace
  - text: Working output
  - combobox "Working output":
    - option "Cast Selection" [selected]
    - option "Cast Shortlist"
  - navigation "Casting workspace steps":
    - link "1 Project":
      - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/project
    - link "2 Specs":
      - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/specs
    - link "3 Candidates":
      - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/cast
    - link "4 Casting":
      - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/organize
    - link "5 Review":
      - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/review
    - link "6 Presentation":
      - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/presentations
  - heading "Source brief" [level=2]
  - paragraph: Supply the brief to request requirements extraction. You can also enter requirements manually below.
  - group: Read the saved source
  - group "Source input":
    - button "Paste text" [disabled]
    - button "Upload PDF, DOCX or text" [disabled] [pressed]
  - text: Document source
  - button "Document source" [disabled]
  - paragraph: Text-rich PDF, DOCX or UTF-8 text · up to 20 MiB. Save legacy .doc as DOCX. For scanned PDFs, paste the brief when readable text is unavailable.
  - button "Choose document" [disabled]
  - text: synthetic-brief.txt
  - status: File request unconfirmed
  - alert:
    - paragraph: The file request could not be confirmed. Retry this same request to check its saved outcome.
  - button "Retry this file request"
  - button "Reload saved requirements"
  - button "Discard local file selection"
  - paragraph: Discarding the selection does not delete an uploaded original or cancel saved processing.
  - heading "General requirements" [level=2]
  - paragraph: Keep project-wide instructions separate from each role.
  - status: Up to date
  - text: General instructions
  - textbox "General instructions":
    - /placeholder: Not provided
    - text: Manual instructions retained
  - heading "Roles and individual slots" [level=2]
  - paragraph: A role may cover several scenes. Its headcount determines the number of slots.
  - button "Reload saved requirements" [disabled]
  - status
  - heading "No casting requirements yet" [level=3]
  - paragraph: Add a role when its requirements are available. You can continue while information is missing.
  - paragraph: Missing requirements do not block preparation.
  - link "Continue to Candidates":
    - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/cast
- contentinfo: everyone. Presentation Studio Foundation in progress · M01
- alert
```

# Test source

```ts
  33  |     const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3100', 'Access-Control-Allow-Methods': 'PUT, OPTIONS', 'Access-Control-Allow-Headers': 'content-type,x-upsert' };
  34  |     if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  35  |     expect(request.method()).toBe('PUT');
  36  |     expect(new URL(request.url()).pathname).toBe(new URL(session().upload_url).pathname);
  37  |     transfers.push({ bytes: request.postDataBuffer()!, headers: request.headers() }); stored = true;
  38  |     if (mode === 'unknown-put' && !lost) { lost = true; return route.abort('failed'); }
  39  |     return route.fulfill({ status: 200, body: '', headers });
  40  |   });
  41  |   await page.route('**/api/**', async route => {
  42  |     const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
  43  |     const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'controlled-file-source', data } });
  44  |     const fail = (code: string, status: number) => route.fulfill({ status, json: { request_id: 'controlled-file-source', error: { code, message: 'Controlled response', details: {}, retryable: true } } });
  45  |     if (path === '/api/session') return ok({ mode: 'supabase', ...(mode === 'no-origin' ? {} : { storage_origin: storage }), actor: {
  46  |       id: '91800000-0000-4000-8000-000000000001', name: 'Synthetic File Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write'],
  47  |       upload_purposes: mode === 'no-capability' ? [] : ['specs'] }, actors: [] });
  48  |     if (path === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic File Project', client_id: null, client_name: null, client_logo_asset_id: null,
  49  |       row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: true });
  50  |     if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic File Project',
  51  |       logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 11, draft_revision: 5, has_unpublished_changes: true,
  52  |       created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
  53  |     if (path === `/api/v1/workspaces/${workspaceId}/roles` && method === 'GET') return route.fulfill({ json: { request_id: 'controlled-file-source', data: [], page: { next_cursor: null } } });
  54  |     if (path === sourcePath && method === 'GET') { if (failRead) { failRead = false; return fail('DEPENDENCY_UNAVAILABLE', 503); } return ok(spec); }
  55  |     if (path === sourcePath && method === 'PATCH') { spec = { ...spec, normalized_instructions: request.postDataJSON().normalized_instructions, row_version: spec.row_version + 1 }; return ok(spec); }
  56  |     if (path === `/api/v1/jobs/${jobId}`) return ok({ id: jobId, workspace_id: workspaceId, resource_id: specId, kind: 'specs_extract', status: 'queued',
  57  |       stage: 'prepare_document', attempt: 0, progress_completed: 0, progress_total: 3, batch_id: null, input_asset_id: assetId, error: null,
  58  |       row_version: 1, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
  59  |     if (method === 'POST') calls.push({ path, body: request.postDataJSON(), serialized: request.postData()!, key: request.headers()['idempotency-key'] });
  60  |     if (path === '/api/v1/uploads' && method === 'POST') { reservation = request.postDataJSON(); return ok(session(), 201); }
  61  |     if (path === `/api/v1/uploads/${uploadId}` && method === 'GET') return ok(session());
  62  |     if (path === `/api/v1/uploads/${uploadId}/complete` && method === 'POST') {
  63  |       if (!stored) return fail('UPLOAD_INCOMPLETE', 409);
  64  |       if (mode === 'unknown-complete' && !lost) { lost = true; return fail('DEPENDENCY_UNAVAILABLE', 503); }
  65  |       return ok({ status: 'ready', processing_job_id: null, asset: { id: assetId, purpose: 'specs', filename: reservation!.filename, mime_type: reservation!.mime_type,
  66  |         size_bytes: reservation!.size_bytes, sha256: reservation!.sha256, status: 'ready', width: null, height: null, duration_ms: null,
  67  |         source_asset_id: null, source_timestamp_ms: null, created_at: '2026-10-28T00:00:00Z' } });
  68  |     }
  69  |     if (path === sourcePath && method === 'POST') {
  70  |       if (hold) await hold;
  71  |       if (mode === 'unavailable') return fail('FEATURE_NOT_IMPLEMENTED', 503);
  72  |       if (mode === 'stale' && !lost) { lost = true; spec = { ...spec, row_version: 9 }; return fail('STALE_RESOURCE_VERSION', 409); }
  73  |       if (!spec.processing_job_id) spec = { ...spec, row_version: spec.row_version + 1, source_text: null, source_asset_id: assetId, processing_job_id: jobId };
  74  |       if (mode === 'unknown-submit' && !lost) { lost = true; return fail('DEPENDENCY_UNAVAILABLE', 503); }
  75  |       if (mode === 'refresh-failure' && !lost) { lost = true; failRead = true; }
  76  |       return ok(accepted, 202);
  77  |     }
  78  |     return fail('CONTROLLED_ROUTE_UNAVAILABLE', 503);
  79  |   });
  80  |   return { calls, transfers, errors, spec: () => spec,
  81  |     hold: () => { hold = new Promise<void>(resolve => { release = resolve; }); }, release: () => { release?.(); hold = null; } };
  82  | }
  83  | 
  84  | async function selectFile(page: Page) {
  85  |   await page.getByRole('button', { name: 'Upload PDF, DOCX or text' }).click();
  86  |   await page.getByLabel('Document source', { exact: true }).setInputFiles(plainFile);
  87  | }
  88  | 
  89  | test('controlled file acceptance preserves original bytes, uses real returned asset and restores durable source/job after reload', async ({ page }, info) => {
  90  |   const model = await fileWorkspace(page); model.hold(); await page.goto(view); await selectFile(page);
  91  |   await page.getByRole('button', { name: 'Process document', exact: true }).click();
  92  |   await expect.poll(() => model.calls.filter(call => call.path === sourcePath).length).toBe(1);
  93  |   expect(model.spec().source_text).toBe('Previously saved source');
  94  |   await expect(page.getByRole('button', { name: 'Saving document…' })).toBeDisabled();
  95  |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveAttribute('readonly', '');
  96  |   model.release(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  97  |   const reserve = model.calls.find(call => call.path === '/api/v1/uploads')!;
  98  |   expect(reserve.body).toEqual({ purpose: 'specs', workspace_id: workspaceId, filename: plainFile.name, mime_type: 'text/plain', size_bytes: plainFile.buffer.length,
  99  |     sha256: createHash('sha256').update(plainFile.buffer).digest('hex') });
  100 |   expect(model.transfers[0].bytes).toEqual(plainFile.buffer); expect(model.transfers).toHaveLength(1);
  101 |   expect(model.transfers[0].headers.authorization).toBeUndefined(); expect(model.transfers[0].headers.cookie).toBeUndefined(); expect(model.transfers[0].headers['x-upsert']).toBe('false');
  102 |   expect(model.calls.find(call => call.path.endsWith('/complete'))!.body.start_processing).toBe(false);
  103 |   expect(model.calls.find(call => call.path === sourcePath)!.body).toEqual({ source_asset_id: assetId, row_version: 7 });
  104 |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Manual instructions retained');
  105 |   for (const width of [1440, 320]) { await page.setViewportSize({ width, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath(`file-source-${width}.png`), fullPage: true }); }
  106 |   await page.reload(); await expect(page.getByRole('link', { name: 'View source processing' })).toHaveAttribute('href', `/processing?job=${jobId}`);
  107 |   await expect(page.getByText('A source document is recorded.', { exact: true })).toBeVisible(); expect(model.errors).toEqual([]);
  108 | });
  109 | 
  110 | test('controlled unknown immutable PUT checks completion before any retry and locks local mode changes', async ({ page }) => {
  111 |   const model = await fileWorkspace(page, 'unknown-put'); await page.goto(view); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  112 |   await expect(page.getByRole('button', { name: 'Retry this file request' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Paste text', exact: true })).toBeDisabled();
  113 |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveAttribute('readonly', '');
  114 |   await page.getByRole('button', { name: 'Retry this file request' }).click(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  115 |   expect(model.transfers).toHaveLength(1); expect(model.calls.filter(call => call.path === '/api/v1/uploads')).toHaveLength(1);
  116 |   expect(model.calls.filter(call => call.path.endsWith('/complete'))).toHaveLength(1);
  117 | });
  118 | 
  119 | test('controlled stale submit reloads the Spec version while reusing the verified original', async ({ page }) => {
  120 |   const model = await fileWorkspace(page, 'stale'); await page.goto(view); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  121 |   await expect(page.getByRole('button', { name: 'Process document', exact: true })).toBeDisabled();
  122 |   await page.locator('.source-file-intake').getByRole('button', { name: 'Reload saved requirements', exact: true }).click();
  123 |   await expect(page.getByRole('button', { name: 'Process document', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  124 |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  125 |   const submits = model.calls.filter(call => call.path === sourcePath); expect(submits.map(call => call.body.row_version)).toEqual([7, 9]);
  126 |   expect(submits[1].key).not.toBe(submits[0].key); expect(submits.every(call => call.body.source_asset_id === assetId)).toBe(true);
  127 |   expect(model.transfers).toHaveLength(1); expect(model.calls.filter(call => call.path.endsWith('/complete'))).toHaveLength(1);
  128 | });
  129 | 
  130 | for (const mode of ['unknown-complete', 'unknown-submit', 'refresh-failure'] as const) test(`controlled ${mode} retains confirmed checkpoints and retries exact intent`, async ({ page }) => {
  131 |   const model = await fileWorkspace(page, mode); await page.goto(view); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  132 |   await page.getByRole('button', { name: mode === 'refresh-failure' ? 'Reload accepted document' : 'Retry this file request', exact: true }).click();
> 133 |   await expect(page.getByRole('button', { name: 'Process document', exact: true })).toBeVisible();
      |                                                                                     ^ Error: expect(locator).toBeVisible() failed
  134 |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  135 |   expect(model.transfers).toHaveLength(1); expect(model.calls.filter(call => call.path === '/api/v1/uploads')).toHaveLength(1);
  136 |   const repeatPath = mode === 'unknown-complete' ? `/api/v1/uploads/${uploadId}/complete` : sourcePath;
  137 |   const repeated = model.calls.filter(call => call.path === repeatPath);
  138 |   if (mode === 'refresh-failure') expect(repeated).toHaveLength(1); else { expect(repeated).toHaveLength(2); expect(repeated[1]).toEqual(repeated[0]); }
  139 | });
  140 | 
  141 | test('controlled unavailable submit preserves selected original and allows manual work; dirty mode switch requires consent', async ({ page }) => {
  142 |   const model = await fileWorkspace(page, 'unavailable'); await page.goto(view);
  143 |   await page.getByLabel('Pasted source text').fill('Unsubmitted local correction'); page.once('dialog', dialog => dialog.dismiss());
  144 |   await page.getByRole('button', { name: 'Upload PDF, DOCX or text' }).click(); await expect(page.getByLabel('Pasted source text')).toHaveValue('Unsubmitted local correction');
  145 |   page.once('dialog', dialog => dialog.accept()); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  146 |   await expect(page.getByRole('alert').filter({ hasText: 'Document processing is not available yet' })).toBeVisible();
  147 |   await expect(page.getByLabel('General instructions', { exact: true })).toBeEditable();
  148 |   await page.getByLabel('General instructions', { exact: true }).fill('Manual work continues'); await expect.poll(() => model.spec().normalized_instructions).toBe('Manual work continues');
  149 |   expect(model.spec().source_text).toBe('Previously saved source'); await expect(page.getByText(plainFile.name, { exact: true })).toBeVisible();
  150 | });
  151 | 
  152 | for (const mode of ['no-capability', 'no-origin'] as const) test(`controlled ${mode} cannot select or send original bytes`, async ({ page }) => {
  153 |   const model = await fileWorkspace(page, mode); await page.goto(view); await expect(page.getByRole('button', { name: 'Upload PDF or Word' })).toBeDisabled();
  154 |   await expect(page.getByLabel('Pasted source text')).toBeEditable(); await expect(page.getByLabel('Document source', { exact: true })).toHaveCount(0);
  155 |   expect(model.transfers).toHaveLength(0); expect(model.calls).toHaveLength(0);
  156 | });
  157 | 
```