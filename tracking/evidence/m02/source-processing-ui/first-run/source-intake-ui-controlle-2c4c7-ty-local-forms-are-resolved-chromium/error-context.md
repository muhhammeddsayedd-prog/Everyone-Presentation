# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: source-intake-ui.spec.ts >> controlled completed source is loaded from persisted reads only after dirty local forms are resolved
- Location: tests\e2e\source-intake-ui.spec.ts:156:5

# Error details

```
Error: expect(locator).toHaveValue(expected) failed

Locator: getByLabel('Label for Performer 1', { exact: true })
Expected: "Performer 1"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toHaveValue" getByLabel('Label for Performer 1', { exact: true }) with timeout 5000ms
  - waiting for getByLabel('Label for Performer 1', { exact: true })

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
  - text: Presentation Studio Casting Synthetic Source Producer
  - button "Sign out"
- text: Central Supabase workspace. Setup and release verification are in progress.
- main:
  - link "Projects":
    - /url: /projects
  - text: / Synthetic Source Project / Casting
  - heading "Synthetic Source Project" [level=1]
  - paragraph: Client not provided·Casting workspace
  - text: Working output
  - combobox "Working output":
    - option "Cast Selection" [selected]
    - option "Cast Shortlist"
  - navigation "Casting workspace steps":
    - link "1 Project":
      - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/project
    - link "2 Specs":
      - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/specs
    - link "3 Candidates":
      - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/cast
    - link "4 Casting":
      - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/organize
    - link "5 Review":
      - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/review
    - link "6 Presentation":
      - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/presentations
  - heading "Source brief" [level=2]
  - paragraph: Paste the brief to request requirements extraction. You can also enter requirements manually below.
  - group: Read the saved source
  - link "View source processing":
    - /url: /processing?job=85800000-0000-4000-8000-000000000001
  - button "Upload PDF or Word" [disabled]
  - paragraph: File uploads are not available yet. Paste the brief or edit requirements manually.
  - text: Pasted source text
  - textbox "Pasted source text": "Synthetic brief: two performers."
  - paragraph: The supplied wording is preserved. Correcting the source does not discard your manual requirements.
  - status
  - button "Process pasted text"
  - region "Source processing":
    - heading "Source processing" [level=2]
    - text: Completed
    - status: Processing completed. Load the saved requirements to refresh this view.
    - paragraph: Applying requirements
    - link "Processing details":
      - /url: /processing?job=85800000-0000-4000-8000-000000000001
    - button "Load saved requirements"
  - heading "General requirements" [level=2]
  - paragraph: Keep project-wide instructions separate from each role.
  - status: Up to date
  - text: General instructions
  - textbox "General instructions":
    - /placeholder: Not provided
    - text: Saved extracted requirements
  - heading "Roles and individual slots" [level=2]
  - paragraph: A role may cover several scenes. Its headcount determines the number of slots.
  - button "Reload saved requirements"
  - status
  - article "Extracted Performer requirements":
    - heading "Extracted Performer" [level=3]
    - paragraph: 2 slots
    - status: Up to date
    - group: Edit requirements
    - group: Individual slots
  - heading "Add a role" [level=2]
  - paragraph: Leave the count blank when it is unknown. One provisional slot will keep preparation moving.
  - text: New role name
  - textbox "New role name":
    - /placeholder: Not provided
  - text: Headcount
  - spinbutton "Headcount"
  - text: Classification
  - textbox "Classification":
    - /placeholder: Not provided
  - button "Add role"
  - paragraph: Missing requirements do not block preparation.
  - link "Continue to Candidates":
    - /url: /projects/82800000-0000-4000-8000-000000000001/casting/83800000-0000-4000-8000-000000000001/cast
- contentinfo: everyone. Presentation Studio Foundation in progress · M01
- alert
```

# Test source

```ts
  71  |     complete: () => {
  72  |       const job = jobs.get(spec.processing_job_id!)!; jobs.set(job.id, { ...job, status: 'succeeded', stage: 'apply_specs', progress_completed: 3, row_version: job.row_version + 1 });
  73  |       spec = { ...spec, normalized_instructions: 'Saved extracted requirements', row_version: spec.row_version + 1 };
  74  |       roles = [{ id: '86800000-0000-4000-8000-000000000001', workspace_id: workspaceId, name: 'Extracted Performer', headcount: 2, category: null,
  75  |         requirements: { age_range: null, gender_requirement: null, appearance_performance: null, languages: [], accents: [], skills: [], scene_references: [],
  76  |           shoot_dates: [], location: null, availability_requirements: null, other_instructions: null }, clarifications: [], sort_order: 0, row_version: 1, archived: false }];
  77  |       slots = [1, 2].map(number => ({ id: `87800000-0000-4000-8000-${String(number).padStart(12, '0')}`, role_id: roles[0].id,
  78  |         label: `Performer ${number}`, sort_order: number - 1, row_version: 1, archived: false }));
  79  |     },
  80  |     holdPost: () => { heldPost = new Promise<void>(resolve => { releasePost = resolve; }); }, releasePost: () => { releasePost?.(); heldPost = null; },
  81  |     releaseManual: () => releaseManual?.() };
  82  | }
  83  | 
  84  | test('controlled pasted intake preserves saved source until acceptance, then persists correction and job link', async ({ page }, testInfo) => {
  85  |   const model = await sourceWorkspace(page); model.holdPost();
  86  |   await page.goto(base); await expect(page.getByLabel('Pasted source text')).toBeVisible();
  87  |   const replacement = '\ufeff  Corrected brief\n\nثلاثة ممثلين 😀  ';
  88  |   await page.getByLabel('Pasted source text').fill(replacement);
  89  |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  90  |   await expect.poll(() => model.posts.length).toBe(1); await expect(page.getByLabel('Pasted source text')).toHaveAttribute('readonly', '');
  91  |   await expect(page.getByRole('button', { name: 'Submitting…' })).toBeDisabled();
  92  |   expect(model.spec().source_text).toContain('Original brief');
  93  |   await page.getByText('Read the saved source', { exact: true }).click(); await expect(page.locator('.source-brief pre')).toContainText('Original brief');
  94  |   model.releasePost();
  95  |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  96  |   await expect(page.locator('.source-brief pre')).toHaveText(replacement);
  97  |   expect(model.posts[0].body).toEqual({ source_text: replacement, row_version: 7 });
  98  |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Saved manual instructions');
  99  |   await page.reload(); await expect(page.getByRole('link', { name: 'View source processing' })).toHaveAttribute('href', `/processing?job=${model.spec().processing_job_id}`);
  100 |   await expect(page.getByLabel('Pasted source text')).toHaveValue(replacement);
  101 |   await page.getByLabel('Pasted source text').fill('Second ordinary correction'); await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  102 |   await expect.poll(() => model.created()).toBe(2); expect(model.posts[1].body.row_version).toBe(8); expect(model.posts[1].key).not.toBe(model.posts[0].key);
  103 |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  104 |   for (const width of [1440, 320]) { await page.setViewportSize({ width, height: 900 }); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.screenshot({ path: testInfo.outputPath(`source-intake-${width}.png`), fullPage: true }); }
  105 |   expect(model.errors).toEqual([]);
  106 | });
  107 | test('controlled lost acceptance response retries identical key/body and creates no second job', async ({ page }) => {
  108 |   const model = await sourceWorkspace(page, 'unknown'); await page.goto(base);
  109 |   // Unchanged server text retains its original CRLF/BOM through the first request.
  110 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  111 |   await expect(page.getByRole('button', { name: 'Retry this source request' })).toBeVisible();
  112 |   expect(model.posts[0].body.source_text).toBe('\ufeffOriginal brief\r\n\r\nثلاثة أشخاص');
  113 |   await expect(page.getByLabel('Pasted source text')).toHaveAttribute('readonly', '');
  114 |   page.once('dialog', dialog => dialog.dismiss()); await page.getByRole('link', { name: 'Projects', exact: true }).first().click();
  115 |   await expect(page.getByRole('button', { name: 'Retry this source request' })).toBeVisible();
  116 |   await page.getByRole('button', { name: 'Retry this source request' }).click();
  117 |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  118 |   expect(model.posts).toHaveLength(2); expect(model.posts[1]).toEqual(model.posts[0]); expect(model.created()).toBe(1);
  119 | });
  120 | test('controlled processing readiness failure retains pasted text and allows manual editing', async ({ page }) => {
  121 |   const model = await sourceWorkspace(page, 'unavailable'); await page.goto(base);
  122 |   await page.getByLabel('Pasted source text').fill('Retained unsaved source'); await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  123 |   await expect(page.getByRole('alert').filter({ hasText: 'Source processing is not available yet' })).toBeVisible();
  124 |   await expect(page.getByLabel('Pasted source text')).toBeEditable(); await expect(page.getByLabel('Pasted source text')).toHaveValue('Retained unsaved source');
  125 |   await expect(page.getByRole('button', { name: 'Upload PDF or Word' })).toBeDisabled();
  126 |   await page.getByLabel('General instructions', { exact: true }).fill('Manual work continues'); await expect.poll(() => model.spec().normalized_instructions).toBe('Manual work continues');
  127 |   expect(model.created()).toBe(0); expect(model.spec().source_text).toContain('Original brief'); await expect(page.getByRole('link', { name: 'View accepted processing' })).toHaveCount(0);
  128 | });
  129 | test('controlled stale source reload retains correction and submits with freshly read Spec version', async ({ page }) => {
  130 |   const model = await sourceWorkspace(page, 'stale'); await page.goto(base); await page.getByLabel('Pasted source text').fill('My source correction');
  131 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click(); await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeDisabled();
  132 |   await page.getByRole('button', { name: 'Reload saved source', exact: true }).click();
  133 |   await expect(page.getByLabel('Pasted source text')).toHaveValue('My source correction'); await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeEnabled();
  134 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  135 |   expect(model.posts.map(post => post.body.row_version)).toEqual([7, 9]); expect(model.posts[1].key).not.toBe(model.posts[0].key);
  136 | });
  137 | test('controlled dirty manual saves block source replacement without discarding either text', async ({ page }) => {
  138 |   const model = await sourceWorkspace(page, 'manual-pending'); await page.goto(base); await page.getByLabel('Pasted source text').fill('Source after manual work');
  139 |   await page.getByLabel('General instructions', { exact: true }).fill('Manual text retained while saving');
  140 |   await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeDisabled();
  141 |   await expect(page.getByText('Save or resolve the other requirement edits before submitting or reloading a source.')).toBeVisible(); expect(model.posts).toHaveLength(0);
  142 |   model.releaseManual(); await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeEnabled();
  143 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click(); await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible();
  144 |   expect(model.posts[0].body.row_version).toBe(8); await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Manual text retained while saving');
  145 | });
  146 | test('controlled accepted request refresh failure retries only persisted reads', async ({ page }) => {
  147 |   const model = await sourceWorkspace(page, 'refresh-failure'); await page.goto(base); await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  148 |   await expect(page.getByRole('button', { name: 'Reload accepted source', exact: true })).toBeVisible();
  149 |   await expect(page.getByRole('link', { name: 'View accepted processing' })).toBeVisible(); await page.getByRole('button', { name: 'Reload accepted source', exact: true }).click();
  150 |   await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toBeVisible(); expect(model.posts).toHaveLength(1); expect(model.created()).toBe(1);
  151 | });
  152 | test('controlled read-only source has no submit action', async ({ page }) => {
  153 |   const model = await sourceWorkspace(page, 'readonly'); await page.goto(base); await expect(page.getByRole('heading', { name: 'Source brief', exact: true })).toBeVisible();
  154 |   await expect(page.getByRole('button', { name: 'Process pasted text', exact: true })).toHaveCount(0); await expect(page.getByLabel('Pasted source text')).toHaveCount(0); expect(model.posts).toHaveLength(0);
  155 | });
  156 | test('controlled completed source is loaded from persisted reads only after dirty local forms are resolved', async ({ page }, testInfo) => {
  157 |   await page.clock.install(); const model = await sourceWorkspace(page, 'pristine'); await page.goto(base);
  158 |   await page.getByLabel('Pasted source text').fill('Synthetic brief: two performers.');
  159 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  160 |   const processing = page.getByRole('region', { name: 'Source processing', exact: true });
  161 |   await expect(processing.locator('.badge')).toHaveText('Queued'); model.complete();
  162 |   await page.clock.fastForward(5000); await expect(processing.locator('.badge')).toHaveText('Completed');
  163 |   await expect(page.getByRole('heading', { name: 'Extracted Performer', exact: true })).toHaveCount(0);
  164 |   await page.getByLabel('New role name', { exact: true }).fill('Unsaved role name');
  165 |   await expect(processing.getByRole('button', { name: 'Load saved requirements', exact: true })).toBeDisabled();
  166 |   await expect(page.getByLabel('New role name', { exact: true })).toHaveValue('Unsaved role name');
  167 |   await page.getByLabel('New role name', { exact: true }).fill('');
  168 |   await processing.getByRole('button', { name: 'Load saved requirements', exact: true }).click();
  169 |   await expect(page.getByRole('heading', { name: 'Extracted Performer', exact: true })).toBeVisible();
  170 |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Saved extracted requirements');
> 171 |   await expect(page.getByLabel('Label for Performer 1', { exact: true })).toHaveValue('Performer 1');
      |                                                                           ^ Error: expect(locator).toHaveValue(expected) failed
  172 |   await expect(page.getByLabel('Label for Performer 2', { exact: true })).toHaveValue('Performer 2');
  173 |   expect(model.posts).toHaveLength(1); expect(model.jobMutations).toEqual([]); expect(model.errors).toEqual([]);
  174 |   for (const width of [1440, 320]) {
  175 |     await page.setViewportSize({ width, height: 900 });
  176 |     await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  177 |     await page.screenshot({ path: testInfo.outputPath(`source-result-${width}.png`), fullPage: true });
  178 |   }
  179 | });
  180 | test('controlled source status rejects a different Spec job and never displays provider diagnostics', async ({ page }) => {
  181 |   await page.clock.install(); const model = await sourceWorkspace(page); await page.goto(base);
  182 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  183 |   const processing = page.getByRole('region', { name: 'Source processing', exact: true });
  184 |   await expect(processing.locator('.badge')).toHaveText('Queued');
  185 |   const job = model.jobs.get(model.spec().processing_job_id!)!;
  186 |   model.jobs.set(job.id, { ...job, resource_id: 'another-private-spec', status: 'succeeded', row_version: 2,
  187 |     error: { code: 'PROCESSING_FAILED', message: 'private-provider-diagnostic', details: {}, retryable: false } });
  188 |   await page.clock.fastForward(5000); await expect(processing.getByRole('alert')).toBeVisible();
  189 |   await expect(processing.getByRole('button', { name: 'Load saved requirements', exact: true })).toHaveCount(0);
  190 |   await expect(page.locator('body')).not.toContainText('private-provider-diagnostic');
  191 |   model.jobs.set(job.id, { ...job, status: 'running', row_version: 3 }); await processing.getByRole('button', { name: 'Try again', exact: true }).click();
  192 |   await expect(processing.locator('.badge')).toHaveText('In progress');
  193 |   expect(model.posts).toHaveLength(1); expect(model.jobMutations).toEqual([]); expect(model.errors).toEqual([]);
  194 | });
  195 | test('controlled saved source navigates through actual Processing actions and returns to its cancelled job after reload', async ({ page }) => {
  196 |   const model = await sourceWorkspace(page, 'operator'); await page.goto(base);
  197 |   await page.getByRole('button', { name: 'Process pasted text', exact: true }).click();
  198 |   const processing = page.getByRole('region', { name: 'Source processing', exact: true });
  199 |   await expect(processing.locator('.badge')).toHaveText('Queued'); const job = model.jobs.get(model.spec().processing_job_id!)!;
  200 |   model.jobs.set(job.id, { ...job, status: 'failed', row_version: 2,
  201 |     error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'private-provider-diagnostic', details: {}, retryable: true } });
  202 |   await processing.getByRole('link', { name: 'Processing details', exact: true }).click();
  203 |   await page.getByRole('button', { name: 'Retry failed processing', exact: true }).click();
  204 |   await expect(page.locator('.processing-detail .badge')).toHaveText('Queued');
  205 |   await page.reload(); await expect(page.locator('.processing-detail .badge')).toHaveText('Queued');
  206 |   await page.getByRole('button', { name: 'Cancel processing', exact: true }).click();
  207 |   await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
  208 |   await expect(page.locator('.processing-detail .badge')).toHaveText('Cancelled');
  209 |   await page.getByRole('link', { name: 'Open requirements', exact: true }).click();
  210 |   await expect(page.getByRole('region', { name: 'Source processing', exact: true }).locator('.badge')).toHaveText('Cancelled');
  211 |   await expect(page.getByLabel('General instructions', { exact: true })).toHaveValue('Saved manual instructions');
  212 |   expect(model.jobMutations.map(value => ({ action: value.action, body: value.body }))).toEqual([
  213 |     { action: 'retry', body: { row_version: 2 } }, { action: 'cancel', body: { row_version: 3 } },
  214 |   ]);
  215 |   expect(model.posts).toHaveLength(1); expect(model.created()).toBe(1);
  216 |   await expect(page.locator('body')).not.toContainText('private-provider-diagnostic'); expect(model.errors).toEqual([]);
  217 | });
  218 | 
```