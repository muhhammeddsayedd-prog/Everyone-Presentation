# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: foundation.spec.ts >> persistent M01 development journey: shared edits, real logo bytes and accessible steps
- Location: tests\e2e\foundation.spec.ts:9:5

# Error details

```
Error: locator.check: Clicking the checkbox did not change its state
Call log:
  - waiting for getByLabel('Every slide', { exact: true })
    - locator resolved to <input type="radio" name="logo-placement"/>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action
    - click action done
    - waiting for scheduled navigations to finish
    - navigations have finished

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - link "Skip to content" [ref=f1e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=f1e3]:
    - complementary [ref=f1e4]:
      - link "Everyone Presentation Studio home" [ref=f1e5] [cursor=pointer]:
        - /url: /projects
        - img "everyone." [ref=f1e6]
        - generic [ref=f1e7]: Presentation Studio
      - generic [ref=f1e8]: Workspace
      - navigation "Main navigation" [ref=f1e9]:
        - link "Projects" [ref=f1e10] [cursor=pointer]:
          - /url: /projects
        - link "Cast Library" [ref=f1e16] [cursor=pointer]:
          - /url: /library/cast
        - link "Presentations" [ref=f1e21] [cursor=pointer]:
          - /url: /presentations
        - link "Processing" [ref=f1e26] [cursor=pointer]:
          - /url: /processing
        - link "Settings" [ref=f1e30] [cursor=pointer]:
          - /url: /settings
      - generic [ref=f1e36]:
        - generic [ref=f1e37]: Development
        - paragraph [ref=f1e38]: Synthetic dataPrivate local workspace
        - text: Casting · Selection & Shortlist
    - generic [ref=f1e39]:
      - banner [ref=f1e40]:
        - generic [ref=f1e41]: Presentation StudioCasting
        - generic [ref=f1e43]:
          - generic [aria-hidden] [ref=f1e44]: S
          - generic [ref=f1e45]: Synthetic Producer
          - button "Sign out of development session" [ref=f1e46] [cursor=pointer]
      - generic [ref=f1e49]: Development workspace — synthetic records. Central business integration is unverified.
      - main [ref=f1e52]:
        - generic [ref=f1e53]:
          - link "Projects" [ref=f1e54] [cursor=pointer]:
            - /url: /projects
          - generic [ref=f1e55]: /
          - generic [ref=f1e56]: Synthetic Campaign — Spring
          - generic [ref=f1e57]: /
          - generic [ref=f1e58]: Casting
        - generic [ref=f1e59]:
          - generic [ref=f1e60]:
            - heading "Synthetic Campaign — Spring" [level=1] [ref=f1e61]
            - paragraph [ref=f1e62]: Synthetic Client·Casting workspace
          - generic [ref=f1e63]:
            - generic [ref=f1e64]: Working output
            - combobox "Working output" [ref=f1e65] [cursor=pointer]:
              - option "Cast Selection" [selected]
              - option "Cast Shortlist"
        - navigation "Casting workspace steps" [ref=f1e66]:
          - link "1 Project" [ref=f1e67] [cursor=pointer]:
            - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/project
            - generic [ref=f1e68]: "1"
            - text: Project
          - link "2 Specs" [ref=f1e69] [cursor=pointer]:
            - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/specs
            - generic [ref=f1e70]: "2"
            - text: Specs
          - link "3 Candidates" [ref=f1e71] [cursor=pointer]:
            - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/cast
            - generic [ref=f1e72]: "3"
            - text: Candidates
          - link "4 Casting" [ref=f1e73] [cursor=pointer]:
            - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/organize
            - generic [ref=f1e74]: "4"
            - text: Casting
          - link "5 Review" [ref=f1e75] [cursor=pointer]:
            - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/review
            - generic [ref=f1e76]: "5"
            - text: Review
          - link "6 Presentation" [ref=f1e77] [cursor=pointer]:
            - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/presentations
            - generic [ref=f1e78]: "6"
            - text: Presentation
        - generic [ref=f1e79]:
          - generic [ref=f1e80]:
            - generic [ref=f1e81]:
              - heading "Shared project details" [level=2] [ref=f1e82]
              - paragraph [ref=f1e83]: Changes save to the canonical development records.
            - status [ref=f1e84]: Saved to the shared project
          - generic [ref=f1e85]:
            - generic [ref=f1e86]:
              - generic [ref=f1e87]: Project name
              - textbox "Project name" [ref=f1e88]: Synthetic Campaign — Spring
            - generic [ref=f1e89]:
              - generic [ref=f1e90]: Client name
              - textbox "Client name" [ref=f1e91]: Synthetic Client
          - paragraph [ref=f1e92]:
            - text: Project reference
            - generic [ref=f1e93]: 20000000-0000-4000-8000-000000000001
        - generic [ref=f1e94]:
          - generic [ref=f1e95]:
            - generic [ref=f1e96]:
              - heading "Client branding" [level=2] [ref=f1e97]
              - paragraph [ref=f1e98]: Choose the logo used in this presentation workspace.
            - generic [ref=f1e99]: Optional
          - generic [ref=f1e100]:
            - generic [ref=f1e101]:
              - img "Selected client logo" [ref=f1e102]
              - generic [ref=f1e103]: Cover background
            - generic [ref=f1e104]:
              - generic [ref=f1e105]: Client logo
              - paragraph [ref=f1e106]: PNG, JPEG or WebP · up to 5 MB.Aspect ratio and transparency are preserved.
              - button "Client logo" [ref=f1e107]
              - generic [ref=f1e108]:
                - button "Replace logo" [ref=f1e109] [cursor=pointer]
                - button "Remove" [ref=f1e112] [cursor=pointer]
              - group "Logo placement" [ref=f1e113]:
                - generic [ref=f1e115]:
                  - radio "Cover only" [ref=f1e116]
                  - text: Cover only
                - generic [ref=f1e117]:
                  - radio "Every slide" [checked] [ref=f1e118]
                  - text: Every slide
              - paragraph [ref=f1e119]: Removing the selection keeps the original asset. This does not replace a shared client logo.
          - status [ref=f1e120]: Branding saved
        - generic [ref=f1e121]:
          - paragraph [ref=f1e122]: Your workspace is saved on the local development server.
          - link "Continue to Specs" [ref=f1e123] [cursor=pointer]:
            - /url: /projects/20000000-0000-4000-8000-000000000001/casting/b299b22d-f691-4819-be7d-9775521c957d/specs
      - contentinfo [ref=f1e126]:
        - generic [ref=f1e127]: everyone. Presentation Studio
        - generic [ref=f1e128]: Local foundation · M01
  - button "Open Next.js Dev Tools" [ref=f1e134] [cursor=pointer]
  - alert [ref=f1e138]
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
  33 |   await expect(page.getByRole('status').filter({ hasText: 'Logo saved' })).toBeVisible();
  34 |   await expect(page.getByAltText('Selected client logo')).toBeVisible();
  35 |   await expect.poll(() => page.getByAltText('Selected client logo').evaluate(image => (image as HTMLImageElement).naturalWidth)).toBe(96);
> 36 |   await page.getByLabel('Every slide', { exact: true }).check();
     |                                                         ^ Error: locator.check: Clicking the checkbox did not change its state
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