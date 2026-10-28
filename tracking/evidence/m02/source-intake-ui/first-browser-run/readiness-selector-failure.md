# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: source-intake-ui.spec.ts >> controlled processing readiness failure retains pasted text and allows manual editing
- Location: tests\e2e\source-intake-ui.spec.ts:91:5

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('alert')
Expected substring: "Source processing is not available yet"
Error: strict mode violation: getByRole('alert') resolved to 2 elements:
    1) <div role="alert" class="notice notice-error">…</div> aka getByRole('alert').filter({ hasText: 'Source processing is not' })
    2) <div role="alert" aria-live="assertive" id="__next-route-announcer__"></div> aka locator('[id="__next-route-announcer__"]')

Call log:
  - Expect "toContainText" getByRole('alert') with timeout 5000ms
  - waiting for getByRole('alert')

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
          - generic [ref=e46]: Synthetic Source Producer
          - button "Sign out" [ref=e47] [cursor=pointer]
      - generic [ref=e50]: Central Supabase workspace. Setup and release verification are in progress.
      - main [ref=e53]:
        - generic [ref=e54]:
          - link "Projects" [ref=e55] [cursor=pointer]:
            - /url: /projects
          - generic [ref=e56]: /
          - generic [ref=e57]: Synthetic Source Project
          - generic [ref=e58]: /
          - generic [ref=e59]: Casting
        - generic [ref=e60]:
          - generic [ref=e61]:
            - heading "Synthetic Source Project" [level=1] [ref=e62]
            - paragraph [ref=e63]: Client not provided·Casting workspace
          - generic [ref=e64]:
            - generic [ref=e65]: Working output
            - combobox "Working output" [ref=e66] [cursor=pointer]:
              - option "Cast Selection" [selected]
              - option "Cast Shortlist"
        - navigation "Casting workspace steps" [ref=e67]:
          - link "1 Project" [ref=e68] [cursor=pointer]:
            - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/project
            - generic [ref=e69]: "1"
            - text: Project
          - link "2 Specs" [ref=e70] [cursor=pointer]:
            - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/specs
            - generic [ref=e71]: "2"
            - text: Specs
          - link "3 Candidates" [ref=e72] [cursor=pointer]:
            - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/cast
            - generic [ref=e73]: "3"
            - text: Candidates
          - link "4 Casting" [ref=e74] [cursor=pointer]:
            - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/organize
            - generic [ref=e75]: "4"
            - text: Casting
          - link "5 Review" [ref=e76] [cursor=pointer]:
            - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/review
            - generic [ref=e77]: "5"
            - text: Review
          - link "6 Presentation" [ref=e78] [cursor=pointer]:
            - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/presentations
            - generic [ref=e79]: "6"
            - text: Presentation
        - generic [ref=e80]:
          - generic [ref=e81]:
            - generic [ref=e83]:
              - heading "Source brief" [level=2] [ref=e84]
              - paragraph [ref=e85]: Paste the brief to request requirements extraction. You can also enter requirements manually below.
            - group [ref=e86]:
              - generic "Read the saved source" [ref=e87] [cursor=pointer]
            - generic [ref=e88]:
              - button "Upload PDF or Word" [disabled] [ref=e89]
              - paragraph [ref=e90]: File uploads are not available yet. Paste the brief or edit requirements manually.
            - generic [ref=e91]:
              - generic [ref=e92]:
                - generic [ref=e93]: Pasted source text
                - textbox "Pasted source text" [ref=e94]: Retained unsaved source
                - paragraph [ref=e95]: The supplied wording is preserved. Correcting the source does not discard your manual requirements.
              - status [ref=e96]
              - alert [ref=e97]:
                - paragraph [ref=e98]: Source processing is not available yet. Your pasted text is retained, and you can edit requirements manually below.
              - button "Process pasted text" [ref=e100] [cursor=pointer]
          - generic [ref=e101]:
            - generic [ref=e102]:
              - generic [ref=e103]:
                - heading "General requirements" [level=2] [ref=e104]
                - paragraph [ref=e105]: Keep project-wide instructions separate from each role.
              - status [ref=e106]: Up to date
            - generic [ref=e107]:
              - generic [ref=e108]: General instructions
              - textbox "General instructions" [ref=e109]:
                - /placeholder: Not provided
                - text: Saved manual instructions
          - generic [ref=e110]:
            - generic [ref=e111]:
              - generic [ref=e112]:
                - heading "Roles and individual slots" [level=2] [ref=e113]
                - paragraph [ref=e114]: A role may cover several scenes. Its headcount determines the number of slots.
              - button "Reload saved requirements" [ref=e115] [cursor=pointer]
            - status [ref=e116]
            - generic [ref=e117]:
              - heading "No casting requirements yet" [level=3] [ref=e118]
              - paragraph [ref=e119]: Add a role when its requirements are available. You can continue while information is missing.
          - generic [ref=e120]:
            - generic [ref=e122]:
              - heading "Add a role" [level=2] [ref=e123]
              - paragraph [ref=e124]: Leave the count blank when it is unknown. One provisional slot will keep preparation moving.
            - generic [ref=e125]:
              - generic [ref=e126]:
                - generic [ref=e127]: New role name
                - textbox "New role name" [ref=e128]:
                  - /placeholder: Not provided
              - generic [ref=e129]:
                - generic [ref=e130]: Headcount
                - spinbutton "Headcount" [ref=e131]
              - generic [ref=e132]:
                - generic [ref=e133]: Classification
                - textbox "Classification" [ref=e134]:
                  - /placeholder: Not provided
            - button "Add role" [ref=e135] [cursor=pointer]
          - generic [ref=e136]:
            - paragraph [ref=e137]: Missing requirements do not block preparation.
            - link "Continue to Candidates" [ref=e138] [cursor=pointer]:
              - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/cast
      - contentinfo [ref=e141]:
        - generic [ref=e142]: everyone. Presentation Studio
        - generic [ref=e143]: Foundation in progress · M01
  - button "Open Next.js Dev Tools" [ref=e149] [cursor=pointer]
  - alert [ref=e153]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import type { Spec } from '@eps/domain';
  3   | 
  4   | // Controlled browser/HTTP evidence only. No Auth, provider, Storage or database.
  5   | const projectId = '82800000-0000-4000-8000-000000000001';
  6   | const workspaceId = '83800000-0000-4000-8000-000000000001';
  7   | const specId = '84800000-0000-4000-8000-000000000001';
  8   | const base = `/projects/${projectId}/casting/${workspaceId}/specs`;
  9   | const endpoint = `/api/v1/workspaces/${workspaceId}/specs`;
  10  | async function sourceWorkspace(page: Page, mode: 'normal' | 'unknown' | 'unavailable' | 'stale' | 'refresh-failure' | 'readonly' | 'manual-pending' = 'normal') {
  11  |   let spec: Spec = { id: specId, workspace_id: workspaceId, source_asset_id: null, source_text: '\ufeffOriginal brief\r\n\r\nثلاثة أشخاص',
  12  |     normalized_instructions: 'Saved manual instructions', clarifications: [], row_version: 7, processing_job_id: null };
  13  |   const posts: { body: { source_text: string; row_version: number }; serialized: string; key: string }[] = [];
  14  |   const keys = new Map<string, unknown>(); let created = 0; let failed = false; let shouldFailRefresh = false;
  15  |   let releasePost: (() => void) | null = null; let releaseManual: (() => void) | null = null;
  16  |   let heldPost: Promise<void> | null = null; const manualGate = new Promise<void>(resolve => { releaseManual = resolve; });
  17  |   const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  18  |   await page.route('**/api/**', async route => {
  19  |     const request = route.request(); const path = new URL(request.url()).pathname; const method = request.method();
  20  |     const ok = (data: unknown, status = 200) => route.fulfill({ status, json: { request_id: 'controlled-source-request', data } });
  21  |     const failure = (code: string, status: number) => route.fulfill({ status, json: { request_id: 'controlled-source-request', error: { code, message: 'Controlled response', details: {}, retryable: true } } });
  22  |     if (path === '/api/session') return ok({ mode: 'supabase', actor: { id: '81800000-0000-4000-8000-000000000001', name: 'Synthetic Source Producer', capabilities: mode === 'readonly' ? ['projects.read', 'workspaces.read'] : ['projects.read', 'workspaces.read', 'workspaces.write'], upload_purposes: [] }, actors: [] });
  23  |     if (path === `/api/v1/projects/${projectId}`) return ok({ id: projectId, name: 'Synthetic Source Project', client_id: null, client_name: null, client_logo_asset_id: null, row_version: 1, client_row_version: null, casting_workspace_id: workspaceId, can_edit: mode !== 'readonly' });
  24  |     if (path === `/api/v1/workspaces/${workspaceId}`) return ok({ id: workspaceId, project_id: projectId, module: 'casting', title: 'Synthetic Source Project', logo_asset_id: null, logo_placement: 'cover', active_output: 'selection', row_version: 51, draft_revision: 12, has_unpublished_changes: true, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z' });
  25  |     if (path === `/api/v1/workspaces/${workspaceId}/roles` && method === 'GET') return route.fulfill({ json: { request_id: 'controlled-source-request', data: [], page: { next_cursor: null } } });
  26  |     if (path === endpoint && method === 'GET') {
  27  |       if (shouldFailRefresh) { shouldFailRefresh = false; return failure('DEPENDENCY_UNAVAILABLE', 503); }
  28  |       return ok(spec);
  29  |     }
  30  |     if (path === endpoint && method === 'PATCH') {
  31  |       if (mode === 'manual-pending') await manualGate;
  32  |       const input = request.postDataJSON(); spec = { ...spec, normalized_instructions: input.normalized_instructions, row_version: spec.row_version + 1 }; return ok(spec);
  33  |     }
  34  |     if (path === endpoint && method === 'POST') {
  35  |       const body = request.postDataJSON(); const key = request.headers()['idempotency-key']; posts.push({ body, serialized: request.postData()!, key });
  36  |       if (heldPost) await heldPost;
  37  |       if (keys.has(key)) return ok(keys.get(key), 202);
  38  |       if (mode === 'unavailable') return failure('FEATURE_NOT_IMPLEMENTED', 503);
  39  |       if (mode === 'stale' && !failed) { failed = true; spec = { ...spec, source_text: 'Another saved correction', row_version: 9 }; return failure('STALE_RESOURCE_VERSION', 409); }
  40  |       if (body.row_version !== spec.row_version) return failure('STALE_RESOURCE_VERSION', 409);
  41  |       const job = `85800000-0000-4000-8000-${String(++created).padStart(12, '0')}`;
  42  |       spec = { ...spec, source_text: body.source_text, row_version: spec.row_version + 1, processing_job_id: job };
  43  |       const accepted = { job_id: job, resource_id: specId, poll_url: `/api/v1/jobs/${job}`, status: 'queued' }; keys.set(key, accepted);
  44  |       if (mode === 'unknown' && !failed) { failed = true; return failure('DEPENDENCY_UNAVAILABLE', 503); }
  45  |       if (mode === 'refresh-failure' && !failed) { failed = true; shouldFailRefresh = true; }
  46  |       return ok(accepted, 202);
  47  |     }
  48  |     return failure('CONTROLLED_ROUTE_UNAVAILABLE', 503);
  49  |   });
  50  |   return { posts, spec: () => spec, created: () => created, errors,
  51  |     holdPost: () => { heldPost = new Promise<void>(resolve => { releasePost = resolve; }); }, releasePost: () => { releasePost?.(); heldPost = null; },
  52  |     releaseManual: () => releaseManual?.() };
  53  | }
  54  | 
  55  | test('controlled pasted intake preserves saved source until acceptance, then persists correction and job link', async ({ page }, testInfo) => {
  56  |   const model = await sourceWorkspace(page); model.holdPost();
  57  |   await page.goto(base); await expect(page.getByLabel('Pasted source text')).toBeVisible();
  58  |   const replacement = '\ufeff  Corrected brief\n\nثلاثة ممثلين 😀  ';
  59  |   await page.getByLabel('Pasted source text').fill(replacement);
  60  |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  61  |   await expect.poll(() => model.posts.length).toBe(1); await expect(page.getByLabel('Pasted source text')).toHaveAttribute('readonly', '');
  62  |   await expect(page.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
  63  |   expect(model.spec().source_text).toContain('Original brief');
  64  |   await page.getByText('Read the saved source', { exact: true }).click(); await expect(page.locator('.source-brief pre')).toContainText('Original brief');
  65  |   model.releasePost();
  66  |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  67  |   await expect(page.locator('.source-brief pre')).toHaveText(replacement);
  68  |   expect(model.posts[0].body).toEqual({ source_text: replacement, row_version: 7 });
  69  |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Saved manual instructions');
  70  |   await page.reload(); await expect(page.getByRole('link', { name: 'View source processing' })).toHaveAttribute('href', `/processing?job=${model.spec().processing_job_id}`);
  71  |   await expect(page.getByLabel('Pasted source text')).toHaveValue(replacement);
  72  |   await page.getByLabel('Pasted source text').fill('Second ordinary correction'); await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  73  |   await expect.poll(() => model.created()).toBe(2); expect(model.posts[1].body.row_version).toBe(8); expect(model.posts[1].key).not.toBe(model.posts[0].key);
  74  |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  75  |   for (const width of [1440, 320]) { await page.setViewportSize({ width, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: testInfo.outputPath(`source-intake-${width}.png`), fullPage: true }); }
  76  |   expect(model.errors).toEqual([]);
  77  | });
  78  | test('controlled lost acceptance response retries identical key/body and creates no second job', async ({ page }) => {
  79  |   const model = await sourceWorkspace(page, 'unknown'); await page.goto(base);
  80  |   // Unchanged server text retains its original CRLF/BOM through the first request.
  81  |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  82  |   await expect(page.getByRole('button', { name: 'Retry this source request' })).toBeVisible();
  83  |   expect(model.posts[0].body.source_text).toBe('\ufeffOriginal brief\r\n\r\nثلاثة أشخاص');
  84  |   await expect(page.getByLabel('Pasted source text')).toHaveAttribute('readonly', '');
  85  |   page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link', { name: 'Projects', exact: true }).first().click();
  86  |   await expect(page.getByRole('button', { name: 'Retry this source request' })).toBeVisible();
  87  |   await page.getByRole('button', { name: 'Retry this source request' }).click();
  88  |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  89  |   expect(model.posts).toHaveLength(2); expect(model.posts[1]).toEqual(model.posts[0]); expect(model.created()).toBe(1);
  90  | });
  91  | test('controlled processing readiness failure retains pasted text and allows manual editing', async ({ page }) => {
  92  |   const model = await sourceWorkspace(page, 'unavailable'); await page.goto(base);
  93  |   await page.getByLabel('Pasted source text').fill('Retained unsaved source'); await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
> 94  |   await expect(page.getByRole('alert')).toContainText('Source processing is not available yet');
      |                                         ^ Error: expect(locator).toContainText(expected) failed
  95  |   await expect(page.getByLabel('Pasted source text')).toBeEditable(); await expect(page.getByLabel('Pasted source text')).toHaveValue('Retained unsaved source');
  96  |   await expect(page.getByRole('button', { name: 'Upload PDF or Word' })).toBeDisabled();
  97  |   await page.getByLabel('General instructions', { exact: true }).fill('Manual work continues'); await expect.poll(() => model.spec().normalized_instructions).toBe('Manual work continues');
  98  |   expect(model.created()).toBe(0); expect(model.spec().source_text).toContain('Original brief'); await expect(page.getByRole('link', { name: 'View accepted processing' })).toHaveCount(0);
  99  | });
  100 | test('controlled stale source reload retains correction and submits with freshly read Spec version', async ({ page }) => {
  101 |   const model = await sourceWorkspace(page, 'stale'); await page.goto(base); await page.getByLabel('Pasted source text').fill('My source correction');
  102 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click(); await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeDisabled();
  103 |   await page.getByRole('button', { name: 'Reload saved source', exact: true }).click();
  104 |   await expect(page.getByLabel('Pasted source text')).toHaveValue('My source correction'); await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeEnabled();
  105 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  106 |   expect(model.posts.map(post => post.body.row_version)).toEqual([7, 9]); expect(model.posts[1].key).not.toBe(model.posts[0].key);
  107 | });
  108 | test('controlled dirty manual saves block source replacement without discarding either text', async ({ page }) => {
  109 |   const model = await sourceWorkspace(page, 'manual-pending'); await page.goto(base); await page.getByLabel('Pasted source text').fill('Source after manual work');
  110 |   await page.getByLabel('General instructions', { exact: true }).fill('Manual text retained while saving');
  111 |   await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeDisabled();
  112 |   await expect(page.getByText('Save or resolve the other requirement edits before submitting or reloading a source.')).toBeVisible(); expect(model.posts).toHaveLength(0);
  113 |   model.releaseManual(); await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeEnabled();
  114 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  115 |   expect(model.posts[0].body.row_version).toBe(8); await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Manual text retained while saving');
  116 | });
  117 | test('controlled accepted request refresh failure retries only persisted reads', async ({ page }) => {
  118 |   const model = await sourceWorkspace(page, 'refresh-failure'); await page.goto(base); await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  119 |   await expect(page.getByRole('button', { name: 'Reload accepted source', exact: true })).toBeVisible();
  120 |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible(); await page.getByRole('button', { name: 'Reload accepted source', exact: true }).click();
  121 |   await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeVisible(); expect(model.posts).toHaveLength(1); expect(model.created()).toBe(1);
  122 | });
  123 | test('controlled read-only source has no submit action', async ({ page }) => {
  124 |   const model = await sourceWorkspace(page, 'readonly'); await page.goto(base); await expect(page.getByRole('heading', { name: 'Source brief', exact: true })).toBeVisible();
  125 |   await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toHaveCount(0); await expect(page.getByLabel('Pasted source text')).toHaveCount(0); expect(model.posts).toHaveLength(0);
  126 | });
  127 | 
```