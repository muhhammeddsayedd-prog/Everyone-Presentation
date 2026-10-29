# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: file-source-intake-ui.spec.ts >> controlled refresh-failure retains confirmed checkpoints and retries exact intent
- Location: tests\e2e\file-source-intake-ui.spec.ts:130:92

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.click: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Reload accepted document', exact: true })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "Skip to content":
    - /url: "#main-content"
  - generic [ref=e2]:
    - complementary [ref=e3]:
      - link "Everyone Presentation Studio home" [ref=e4] [cursor=pointer]:
        - /url: /projects
        - img "everyone." [ref=e5]
        - generic [ref=e6]: Presentation Studio
      - generic [ref=e7]: Workspace
      - navigation "Main navigation" [ref=e8]:
        - link "Projects" [ref=e9] [cursor=pointer]:
          - /url: /projects
        - link "Cast Library" [ref=e15] [cursor=pointer]:
          - /url: /library/cast
        - link "Presentations" [ref=e20] [cursor=pointer]:
          - /url: /presentations
        - link "Processing" [ref=e25] [cursor=pointer]:
          - /url: /processing
        - link "Settings" [ref=e29] [cursor=pointer]:
          - /url: /settings
      - generic [ref=e35]:
        - generic [ref=e36]: Central workspace
        - paragraph [ref=e37]: Authorized projectsEveryone account
        - text: Casting · Selection & Shortlist
    - generic [ref=e38]:
      - banner [ref=e39]:
        - generic [ref=e40]:
          - generic [ref=e41]: Presentation Studio
          - generic [ref=e43]: Casting
        - generic [ref=e44]:
          - generic [aria-hidden] [ref=e45]: S
          - generic [ref=e46]: Synthetic File Producer
          - button "Sign out" [ref=e47] [cursor=pointer]
      - generic [ref=e50]: Central Supabase workspace. Setup and release verification are in progress.
      - main [ref=e53]:
        - generic [ref=e54]:
          - link "Projects" [ref=e55] [cursor=pointer]:
            - /url: /projects
          - generic [ref=e56]: /
          - generic [ref=e57]: Synthetic File Project
          - generic [ref=e58]: /
          - generic [ref=e59]: Casting
        - generic [ref=e60]:
          - generic [ref=e61]:
            - heading "Synthetic File Project" [level=1] [ref=e62]
            - paragraph [ref=e63]: Client not provided·Casting workspace
          - generic [ref=e64]:
            - generic [ref=e65]: Working output
            - combobox "Working output" [ref=e66] [cursor=pointer]:
              - option "Cast Selection" [selected]
              - option "Cast Shortlist"
        - navigation "Casting workspace steps" [ref=e67]:
          - link "1 Project" [ref=e68] [cursor=pointer]:
            - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/project
            - generic [ref=e69]: "1"
            - text: Project
          - link "2 Specs" [ref=e70] [cursor=pointer]:
            - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/specs
            - generic [ref=e71]: "2"
            - text: Specs
          - link "3 Candidates" [ref=e72] [cursor=pointer]:
            - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/cast
            - generic [ref=e73]: "3"
            - text: Candidates
          - link "4 Casting" [ref=e74] [cursor=pointer]:
            - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/organize
            - generic [ref=e75]: "4"
            - text: Casting
          - link "5 Review" [ref=e76] [cursor=pointer]:
            - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/review
            - generic [ref=e77]: "5"
            - text: Review
          - link "6 Presentation" [ref=e78] [cursor=pointer]:
            - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/presentations
            - generic [ref=e79]: "6"
            - text: Presentation
        - generic [ref=e80]:
          - generic [ref=e81]:
            - generic [ref=e83]:
              - heading "Source brief" [level=2] [ref=e84]
              - paragraph [ref=e85]: Supply the brief to request requirements extraction. You can also enter requirements manually below.
            - group [ref=e86]:
              - generic "Read the saved source" [ref=e87] [cursor=pointer]
            - group "Source input" [ref=e88]:
              - button "Paste text" [disabled] [ref=e89]
              - button "Upload PDF, DOCX or text" [disabled] [pressed] [ref=e90]
            - generic [ref=e91]:
              - generic [ref=e92]:
                - generic [ref=e93]: Document source
                - button "Document source" [disabled] [ref=e94]
                - paragraph [ref=e95]: Text-rich PDF, DOCX or UTF-8 text · up to 20 MiB. Save legacy .doc as DOCX. For scanned PDFs, paste the brief when readable text is unavailable.
                - generic [ref=e96]:
                  - button "Choose document" [disabled] [ref=e97]
                  - generic [ref=e98]: synthetic-brief.txt
              - status [ref=e99]: File request unconfirmed
              - alert [ref=e100]:
                - paragraph [ref=e101]: The file request could not be confirmed. Retry this same request to check its saved outcome.
              - generic [ref=e102]:
                - button "Retry this file request" [ref=e103] [cursor=pointer]
                - button "Reload saved requirements" [ref=e104] [cursor=pointer]
                - button "Discard local file selection" [ref=e105] [cursor=pointer]
              - paragraph [ref=e106]: Discarding the selection does not delete an uploaded original or cancel saved processing.
          - generic [ref=e107]:
            - generic [ref=e108]:
              - generic [ref=e109]:
                - heading "General requirements" [level=2] [ref=e110]
                - paragraph [ref=e111]: Keep project-wide instructions separate from each role.
              - status [ref=e112]: Up to date
            - generic [ref=e113]:
              - generic [ref=e114]: General instructions
              - textbox "General instructions" [ref=e115]:
                - /placeholder: Not provided
                - text: Manual instructions retained
          - generic [ref=e116]:
            - generic [ref=e117]:
              - generic [ref=e118]:
                - heading "Roles and individual slots" [level=2] [ref=e119]
                - paragraph [ref=e120]: A role may cover several scenes. Its headcount determines the number of slots.
              - button "Reload saved requirements" [disabled] [ref=e121]
            - status [ref=e122]
            - generic [ref=e123]:
              - heading "No casting requirements yet" [level=3] [ref=e124]
              - paragraph [ref=e125]: Add a role when its requirements are available. You can continue while information is missing.
          - generic [ref=e126]:
            - paragraph [ref=e127]: Missing requirements do not block preparation.
            - link "Continue to Candidates" [ref=e128] [cursor=pointer]:
              - /url: /projects/92800000-0000-4000-8000-000000000001/casting/93800000-0000-4000-8000-000000000001/cast
      - contentinfo [ref=e131]:
        - generic [ref=e132]: everyone. Presentation Studio
        - generic [ref=e133]: Foundation in progress · M01
  - button "Open Next.js Dev Tools" [ref=e139] [cursor=pointer]
  - alert [ref=e143]
```

# Test source

```ts
  32  |   diagnostics.set(page, () => ({ requested_paths: calls.map(call => call.path), transfer_count: transfers.length, page_errors: errors }));
  33  |   const session = () => ({ id: uploadId, asset_id: assetId, protocol: 'signed_put', status: 'open', maximum_bytes: 20 * 1024 * 1024,
  34  |     expires_at: '2030-01-01T00:00:00Z', upload_headers: { 'Content-Type': reservation!.mime_type, 'x-upsert': 'false' },
  35  |     upload_url: `${storage}/storage/v1/object/upload/sign/eps-specs-assets/assets/${assetId}/original.${String(reservation!.filename).split('.').at(-1)}?token=synthetic-capability` });
  36  |   const accepted = { job_id: jobId, resource_id: specId, poll_url: `/api/v1/jobs/${jobId}`, status: 'queued' };
  37  |   await page.route(`${storage}/**`, async route => {
  38  |     const request = route.request();
  39  |     const headers = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:3100', 'Access-Control-Allow-Methods': 'PUT, OPTIONS', 'Access-Control-Allow-Headers': 'content-type,x-upsert' };
  40  |     if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
  41  |     expect(request.method()).toBe('PUT');
  42  |     expect(new URL(request.url()).pathname).toBe(new URL(session().upload_url).pathname);
  43  |     transfers.push({ bytes: request.postDataBuffer()!, headers: request.headers() }); stored = true;
  44  |     if (mode === 'unknown-put' && !lost) { lost = true; return route.abort('failed'); }
  45  |     return route.fulfill({ status: 200, body: '', headers });
  46  |   });
  47  |   await page.route('**/api/**', async route => {
  48  |     const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
  49  |     const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'controlled-file-source', data } });
  50  |     const fail = (code: string, status: number) => route.fulfill({ status, json: { request_id: 'controlled-file-source', error: { code, message: 'Controlled response', details: {}, retryable: true } } });
  51  |     if (path === '/api/session') return ok({ mode: 'supabase', ...(mode === 'no-origin' ? {} : { storage_origin: storage }), actor: {
  52  |       id: '91800000-0000-4000-8000-000000000001', name: 'Synthetic File Producer', capabilities: ['projects.read', 'workspaces.read', 'workspaces.write'],
  53  |       upload_purposes: mode === 'no-capability' ? [] : ['specs'] }, actors: [] });
  54  |     if (path === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic File Project', client_id: null, client_name: null, client_logo_asset_id: null,
  55  |       row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: true });
  56  |     if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic File Project',
  57  |       logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 11, draft_revision: 5, has_unpublished_changes: true,
  58  |       created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
  59  |     if (path === `/api/v1/workspaces/${workspaceId}/roles` && method === 'GET') return route.fulfill({ json: { request_id: 'controlled-file-source', data: [], page: { next_cursor: null } } });
  60  |     if (path === sourcePath && method === 'GET') { if (failRead) { failRead = false; return fail('DEPENDENCY_UNAVAILABLE', 503); } return ok(spec); }
  61  |     if (path === sourcePath && method === 'PATCH') { spec = { ...spec, normalized_instructions: request.postDataJSON().normalized_instructions, row_version: spec.row_version + 1 }; return ok(spec); }
  62  |     if (path === `/api/v1/jobs/${jobId}`) return ok({ id: jobId, workspace_id: workspaceId, resource_id: specId, kind: 'specs_extract', status: 'queued',
  63  |       stage: 'prepare_document', attempt: 0, progress_completed: 0, progress_total: 3, batch_id: null, input_asset_id: assetId, error: null,
  64  |       row_version: 1, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
  65  |     if (method === 'POST') calls.push({ path, body: request.postDataJSON(), serialized: request.postData()!, key: request.headers()['idempotency-key'] });
  66  |     if (path === '/api/v1/uploads' && method === 'POST') { reservation = request.postDataJSON(); return ok(session(), 201); }
  67  |     if (path === `/api/v1/uploads/${uploadId}` && method === 'GET') return ok(session());
  68  |     if (path === `/api/v1/uploads/${uploadId}/complete` && method === 'POST') {
  69  |       if (!stored) return fail('UPLOAD_INCOMPLETE', 409);
  70  |       if (mode === 'unknown-complete' && !lost) { lost = true; return fail('DEPENDENCY_UNAVAILABLE', 503); }
  71  |       return ok({ status: 'ready', processing_job_id: null, asset: { id: assetId, purpose: 'specs', filename: reservation!.filename, mime_type: reservation!.mime_type,
  72  |         size_bytes: reservation!.size_bytes, sha256: reservation!.sha256, status: 'ready', width: null, height: null, duration_ms: null,
  73  |         source_asset_id: null, source_timestamp_ms: null, created_at: '2026-10-28T00:00:00Z' } });
  74  |     }
  75  |     if (path === sourcePath && method === 'POST') {
  76  |       if (hold) await hold;
  77  |       if (mode === 'unavailable') return fail('FEATURE_NOT_IMPLEMENTED', 503);
  78  |       if (mode === 'stale' && !lost) { lost = true; spec = { ...spec, row_version: 9 }; return fail('STALE_RESOURCE_VERSION', 409); }
  79  |       if (!spec.processing_job_id) spec = { ...spec, row_version: spec.row_version + 1, source_text: null, source_asset_id: assetId, processing_job_id: jobId };
  80  |       if (mode === 'unknown-submit' && !lost) { lost = true; return fail('DEPENDENCY_UNAVAILABLE', 503); }
  81  |       if (mode === 'refresh-failure' && !lost) { lost = true; failRead = true; }
  82  |       return ok(accepted, 202);
  83  |     }
  84  |     return fail('CONTROLLED_ROUTE_UNAVAILABLE', 503);
  85  |   });
  86  |   return { calls, transfers, errors, spec: () => spec,
  87  |     hold: () => { hold = new Promise<void>(resolve => { release = resolve; }); }, release: () => { release?.(); hold = null; } };
  88  | }
  89  | 
  90  | async function selectFile(page: Page) {
  91  |   await page.getByRole('button', { name: 'Upload PDF, DOCX or text' }).click();
  92  |   await page.getByLabel('Document source', { exact: true }).setInputFiles(plainFile);
  93  | }
  94  | 
  95  | test('controlled file acceptance preserves original bytes, uses real returned asset and restores durable source/job after reload', async ({ page }, info) => {
  96  |   const model = await fileWorkspace(page); model.hold(); await page.goto(view); await selectFile(page);
  97  |   await page.getByRole('button', { name: 'Process document', exact: true }).click();
  98  |   await expect.poll(() => model.calls.filter(call => call.path === sourcePath).length).toBe(1);
  99  |   expect(model.spec().source_text).toBe('Previously saved source');
  100 |   await expect(page.getByRole('button', { name: 'Saving document…' })).toBeDisabled();
  101 |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveAttribute('readonly', '');
  102 |   model.release(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  103 |   const reserve = model.calls.find(call => call.path === '/api/v1/uploads')!;
  104 |   expect(reserve.body).toEqual({ purpose: 'specs', workspace_id: workspaceId, filename: plainFile.name, mime_type: 'text/plain', size_bytes: plainFile.buffer.length,
  105 |     sha256: createHash('sha256').update(plainFile.buffer).digest('hex') });
  106 |   expect(model.transfers[0].bytes).toEqual(plainFile.buffer); expect(model.transfers).toHaveLength(1);
  107 |   expect(model.transfers[0].headers.authorization).toBeUndefined(); expect(model.transfers[0].headers.cookie).toBeUndefined(); expect(model.transfers[0].headers['x-upsert']).toBe('false');
  108 |   expect(model.calls.find(call => call.path.endsWith('/complete'))!.body.start_processing).toBe(false);
  109 |   expect(model.calls.find(call => call.path === sourcePath)!.body).toEqual({ source_asset_id: assetId, row_version: 7 });
  110 |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Manual instructions retained');
  111 |   for (const width of [1440, 320]) { await page.setViewportSize({ width, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: info.outputPath(`file-source-${width}.png`), fullPage: true }); }
  112 |   await page.reload(); await expect(page.getByRole('link', { name: 'View source processing' })).toHaveAttribute('href', `/processing?job=${jobId}`);
  113 |   await expect(page.getByText('A source document is recorded.', { exact: true })).toBeVisible(); expect(model.errors).toEqual([]);
  114 | });
  115 | 
  116 | test('controlled unknown immutable PUT checks completion before any retry and locks local mode changes', async ({ page }) => {
  117 |   const model = await fileWorkspace(page, 'unknown-put'); await page.goto(view); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  118 |   await expect(page.getByRole('button', { name: 'Retry this file request' })).toBeVisible(); await expect(page.getByRole('button', { name: 'Paste text', exact: true })).toBeDisabled();
  119 |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveAttribute('readonly', '');
  120 |   await page.getByRole('button', { name: 'Retry this file request' }).click(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  121 |   expect(model.transfers).toHaveLength(1); expect(model.calls.filter(call => call.path === '/api/v1/uploads')).toHaveLength(1);
  122 |   expect(model.calls.filter(call => call.path.endsWith('/complete'))).toHaveLength(1);
  123 | });
  124 | 
  125 | test('controlled stale submit reloads the Spec version while reusing the verified original', async ({ page }) => {
  126 |   const model = await fileWorkspace(page, 'stale'); await page.goto(view); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  127 |   await expect(page.getByRole('button', { name: 'Process document', exact: true })).toBeDisabled();
  128 |   await page.locator('.source-file-intake').getByRole('button', { name: 'Reload saved requirements', exact: true }).click();
  129 |   await expect(page.getByRole('button', { name: 'Process document', exact: true })).toBeEnabled(); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  130 |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  131 |   const submits = model.calls.filter(call => call.path === sourcePath); expect(submits.map(call => call.body.row_version)).toEqual([7, 9]);
> 132 |   expect(submits[1].key).not.toBe(submits[0].key); expect(submits.every(call => call.body.source_asset_id === assetId)).toBe(true);
      |                                                                                                                                              ^ Error: locator.click: Test timeout of 90000ms exceeded.
  133 |   expect(model.transfers).toHaveLength(1); expect(model.calls.filter(call => call.path.endsWith('/complete'))).toHaveLength(1);
  134 | });
  135 | 
  136 | for (const mode of ['unknown-complete', 'unknown-submit', 'refresh-failure'] as const) test(`controlled ${mode} retains confirmed checkpoints and retries exact intent`, async ({ page }) => {
  137 |   const model = await fileWorkspace(page, mode); await page.goto(view); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  138 |   await page.getByRole('button', { name: mode === 'refresh-failure' ? 'Reload accepted document' : 'Retry this file request', exact: true }).click();
  139 |   await expect(page.getByRole('button', { name: 'Process document', exact: true })).toBeVisible();
  140 |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  141 |   expect(model.transfers).toHaveLength(1); expect(model.calls.filter(call => call.path === '/api/v1/uploads')).toHaveLength(1);
  142 |   const repeatPath = mode === 'unknown-complete' ? `/api/v1/uploads/${uploadId}/complete` : sourcePath;
  143 |   const repeated = model.calls.filter(call => call.path === repeatPath);
  144 |   if (mode === 'refresh-failure') expect(repeated).toHaveLength(1); else { expect(repeated).toHaveLength(2); expect(repeated[1]).toEqual(repeated[0]); }
  145 | });
  146 | 
  147 | test('controlled unavailable submit preserves selected original and allows manual work; dirty mode switch requires consent', async ({ page }) => {
  148 |   const model = await fileWorkspace(page, 'unavailable'); await page.goto(view);
  149 |   await page.getByLabel('Pasted source text').fill('Unsubmitted local correction'); page.once('dialog', dialog => dialog.dismiss());
  150 |   await page.getByRole('button', { name: 'Upload PDF, DOCX or text' }).click(); await expect(page.getByLabel('Pasted source text')).toHaveValue('Unsubmitted local correction');
  151 |   page.once('dialog', dialog => dialog.accept()); await selectFile(page); await page.getByRole('button', { name: 'Process document', exact: true }).click();
  152 |   await expect(page.getByRole('alert').filter({ hasText: 'Document processing is not available yet' })).toBeVisible();
  153 |   await expect(page.getByLabel('General instructions', { exact: true })).toBeEditable();
  154 |   await page.getByLabel('General instructions', { exact: true }).fill('Manual work continues'); await expect.poll(() => model.spec().normalized_instructions).toBe('Manual work continues');
  155 |   expect(model.spec().source_text).toBe('Previously saved source'); await expect(page.getByText(plainFile.name, { exact: true })).toBeVisible();
  156 | });
  157 | 
  158 | for (const mode of ['no-capability', 'no-origin'] as const) test(`controlled ${mode} cannot select or send original bytes`, async ({ page }) => {
  159 |   const model = await fileWorkspace(page, mode); await page.goto(view); await expect(page.getByRole('button', { name: 'Upload PDF or Word' })).toBeDisabled();
  160 |   await expect(page.getByLabel('Pasted source text')).toBeEditable(); await expect(page.getByLabel('Document source', { exact: true })).toHaveCount(0);
  161 |   expect(model.transfers).toHaveLength(0); expect(model.calls).toHaveLength(0);
  162 | });
  163 | 
```