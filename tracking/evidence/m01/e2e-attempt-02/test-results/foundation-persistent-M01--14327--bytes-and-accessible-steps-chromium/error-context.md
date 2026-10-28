# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: foundation.spec.ts >> persistent M01 development journey: shared edits, real logo bytes and accessible steps
- Location: tests\e2e\foundation.spec.ts:9:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('status').filter({ hasText: 'Logo saved' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('status').filter({ hasText: 'Logo saved' }) with timeout 5000ms
  - waiting for getByRole('status').filter({ hasText: 'Logo saved' })

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
  - text: Development
  - paragraph: Synthetic data Private local workspace
  - text: Casting · Selection & Shortlist
- banner:
  - text: Presentation Studio Casting Synthetic Producer
  - button "Sign out of development session"
- text: Development workspace — synthetic records. Central business integration is unverified.
- main:
  - link "Projects":
    - /url: /projects
  - text: / Synthetic Campaign — Spring / Casting
  - heading "Synthetic Campaign — Spring" [level=1]
  - paragraph: Synthetic Client·Casting workspace
  - text: Working output
  - combobox "Working output":
    - option "Cast Selection" [selected]
    - option "Cast Shortlist"
  - navigation "Casting workspace steps":
    - link "1 Project":
      - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/project
    - link "2 Specs":
      - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/specs
    - link "3 Candidates":
      - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/cast
    - link "4 Casting":
      - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/organize
    - link "5 Review":
      - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/review
    - link "6 Presentation":
      - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/presentations
  - heading "Shared project details" [level=2]
  - paragraph: Changes save to the canonical development records.
  - status: Saved to the shared project
  - text: Project name
  - textbox "Project name": Synthetic Campaign — Spring
  - text: Client name
  - textbox "Client name": Synthetic Client
  - paragraph: Project reference 20000000-0000-4000-8000-000000000001
  - heading "Client branding" [level=2]
  - paragraph: Choose the logo used in this presentation workspace.
  - text: Optional No client logo selected Cover background Client logo
  - paragraph: PNG, JPEG or WebP · up to 5 MB. Aspect ratio and transparency are preserved.
  - button "Client logo"
  - button "Upload logo"
  - group "Logo placement":
    - text: Logo placement
    - radio "Cover only" [checked]
    - text: Cover only
    - radio "Every slide"
    - text: Every slide
  - paragraph: Removing the selection keeps the original asset. This does not replace a shared client logo.
  - alert:
    - paragraph: This record changed since you opened it. Reload the saved details, then reapply your changes.
  - paragraph: Your workspace is saved on the local development server.
  - link "Continue to Specs":
    - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/specs
- contentinfo: everyone. Presentation Studio Local foundation · M01
- alert
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import sharp from 'sharp';
  3  | 
  4  | const producer = '10000000-0000-4000-8000-000000000001';
  5  | const contributor = '10000000-0000-4000-8000-000000000002';
  6  | const libraryViewer = '10000000-0000-4000-8000-000000000003';
  7  | const projectId = '20000000-0000-4000-8000-000000000001';
  8  | 
  9  | test('persistent M01 development journey: shared edits, real logo bytes and accessible steps', async ({ page }, testInfo) => {
  10 |   const pageErrors: string[] = [];
  11 |   page.on('pageerror', error => pageErrors.push(error.message));
  12 |   await page.goto('/projects');
  13 |   await page.getByLabel('Development identity').selectOption(producer);
  14 |   await page.getByRole('button', { name: 'Enter development workspace' }).click();
  15 |   await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  16 |   await expect(page.getByText('Synthetic Restricted Project', { exact: true })).toHaveCount(0);
  17 |   await page.getByRole('button', { name: /Open casting|Resume casting/ }).first().click();
  18 |   await expect(page.getByRole('heading', { name: 'Shared project details' })).toBeVisible();
  19 |   const currentProject = /\/projects\/([^/]+)\//.exec(page.url())![1];
  20 |   const workspaceId = /\/casting\/([^/]+)\//.exec(page.url())![1];
  21 |   const project = (await (await page.request.get(`/api/v1/projects/${currentProject}`)).json()).data;
  22 |   const changedName = `${project.name} · browser check`;
  23 |   await page.getByLabel('Project name', { exact: true }).fill(changedName);
  24 |   await expect(page.getByRole('status').filter({ hasText: 'Saved to the shared project' })).toBeVisible();
  25 |   expect((await (await page.request.get(`/api/v1/projects/${currentProject}`)).json()).data.name).toBe(changedName);
  26 |   await page.reload();
  27 |   await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(changedName);
  28 |   await page.getByLabel('Project name', { exact: true }).fill(project.name);
  29 |   await expect(page.getByRole('status').filter({ hasText: 'Saved to the shared project' })).toBeVisible();
  30 | 
  31 |   const transparentLogo = await sharp({ create: { width: 96, height: 48, channels: 4, background: { r: 255, g: 255, b: 255, alpha: .7 } } }).png().toBuffer();
  32 |   await page.locator('#client-logo').setInputFiles({ name: 'synthetic-logo.png', mimeType: 'image/png', buffer: transparentLogo });
> 33 |   await expect(page.getByRole('status').filter({ hasText: 'Logo saved' })).toBeVisible();
     |                                                                            ^ Error: expect(locator).toBeVisible() failed
  34 |   await expect(page.getByAltText('Selected client logo')).toBeVisible();
  35 |   await expect.poll(() => page.getByAltText('Selected client logo').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(96);
  36 |   await page.getByLabel('Every slide', { exact: true }).check();
  37 |   await expect(page.getByRole('status').filter({ hasText: 'Branding saved' })).toBeVisible();
  38 |   await page.reload();
  39 |   await expect(page.getByLabel('Every slide', { exact: true })).toBeChecked();
  40 |   await expect(page.getByAltText('Selected client logo')).toBeVisible();
  41 |   const oldAsset = (await (await page.request.get(`/api/v1/workspaces/${workspaceId}`)).json()).data.logo_asset_id;
  42 | 
  43 |   const replacement = await sharp({ create: { width: 144, height: 32, channels: 4, background: { r: 0, g: 205, b: 109, alpha: 1 } } }).png().toBuffer();
  44 |   await page.locator('#client-logo').setInputFiles({ name: 'synthetic-replacement.png', mimeType: 'image/png', buffer: replacement });
  45 |   await expect(page.getByRole('status').filter({ hasText: 'Logo saved' })).toBeVisible();
  46 |   await expect.poll(() => page.getByAltText('Selected client logo').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(144);
  47 |   await page.getByRole('button', { name: 'Remove', exact: true }).click();
  48 |   await expect(page.getByText('No client logo selected', { exact: true })).toBeVisible();
  49 |   expect((await page.request.get(`/api/v1/media/${oldAsset}/content`)).status()).toBe(200);
  50 |   await page.getByLabel('Cover only', { exact: true }).check();
  51 |   await expect(page.getByRole('status').filter({ hasText: 'Branding saved' })).toBeVisible();
  52 | 
  53 |   await page.screenshot({ path: testInfo.outputPath('project-desktop.png'), fullPage: true });
  54 |   const stepNav = page.getByRole('navigation', { name: 'Casting workspace steps' });
  55 |   for (const step of ['Specs', 'Candidates', 'Casting', 'Review', 'Presentation']) {
  56 |     await stepNav.getByRole('link', { name: new RegExp(`${step}$`) }).click();
  57 |     await expect(page.getByText('Implementation pending', { exact: true })).toBeVisible();
  58 |   }
  59 |   await stepNav.getByRole('link', { name: /Project$/ }).click();
  60 |   await expect(page.getByLabel('Project name', { exact: true })).toHaveValue(project.name);
  61 |   await page.setViewportSize({ width: 320, height: 760 });
  62 |   await expect(page.getByRole('heading', { name: 'Shared project details' })).toBeVisible();
  63 |   expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  64 |   await page.screenshot({ path: testInfo.outputPath('project-mobile.png'), fullPage: true });
  65 |   expect(pageErrors).toEqual([]);
  66 | });
  67 | 
  68 | test('acting-user scope is enforced in UI and direct requests', async ({ page }) => {
  69 |   await page.goto('/projects');
  70 |   await page.getByLabel('Development identity').selectOption(contributor);
  71 |   await page.getByRole('button', { name: 'Enter development workspace' }).click();
  72 |   await expect(page.getByRole('heading', { name: 'Projects', exact: true })).toBeVisible();
  73 |   expect((await page.request.patch(`/api/v1/projects/${projectId}`, { data: { row_version: 1, name: 'Unauthorized edit' }, headers: { 'Idempotency-Key': crypto.randomUUID() } })).status()).toBe(403);
  74 |   expect((await page.request.get('/api/v1/projects/20000000-0000-4000-8000-000000000003')).status()).toBe(404);
  75 |   await page.getByRole('button', { name: /Open casting|Resume casting/ }).first().click();
  76 |   await expect(page.getByLabel('Project name', { exact: true })).toHaveAttribute('readonly', '');
  77 |   await page.getByRole('button', { name: 'Sign out of development session' }).click();
  78 |   await page.getByLabel('Development identity').selectOption(libraryViewer);
  79 |   await page.getByRole('button', { name: 'Enter development workspace' }).click();
  80 |   await expect(page.getByRole('heading', { name: 'No accessible projects.' })).toBeVisible();
  81 | });
  82 | 
```