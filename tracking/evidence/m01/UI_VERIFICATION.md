# M01 local UI verification — 2026-10-28

Scope: persistent **synthetic development adapter** served by the local Next.js app at `http://127.0.0.1:3000`. This is not central Supabase/auth acceptance, cloud storage, provider processing, approved presentation-template acceptance, or production release proof.

Later checkpoint: the fixture suite now owns port3100 with separate build/state. Port3000 currently serves actual central Supabase sign-in. Cloud migrations/readback, real local PostgreSQL role/race proof and central anonymous UI evidence are under `../cloud-foundation/`, `../../evidence/m01/DB_CONCURRENCY.json` and `development/local-db/receipts/` from the project root. These extend the foundation evidence without claiming an authenticated real Producer journey or central logo uploads. The latest whole repository run has60 app tests and four fixture browser/API tests; the central anonymous check is separate. Root independently inspected both central desktop/mobile captures. Historical paths and failures below remain unchanged.

Session-bearing failed trace ZIPs were moved to ignored private retention; `PRIVATE_TRACE_RETENTION.json` preserves their original paths/hashes. Screenshots, JSON summaries and failure contexts remain in the recorded directories. Future traces are disabled.

## Implemented surface

- `apps/web/app/`: root redirect, catch-all route, layout, stylesheet and copied/adapted design tokens. The supplied SVG wordmark is preserved in `apps/web/public/brand/`.
- `apps/web/components/`: development session, authorized project search/pagination/open, persistent six-step shell, canonical development project/client autosave, stale-edit recovery, logo byte upload/replace/remove/placement, working-output preference, audience preset create/edit/archive, and explicit pending states for unimplemented milestones.
- Brand font binaries were not supplied. The stylesheet intentionally uses system fallback without making missing font requests. Exact brand typography remains unverified.

## Commands and results

`npm.cmd run test:e2e` runs `tests/e2e/foundation.spec.ts` in isolated headless Chromium with the repository Playwright configuration.

| Attempt | Result | Finding and disposition |
|---|---|---|
| 01 | 2 failed | Login denied by local origin guard. Next normalized `Request.url` differently from the actual configured Host/Origin. Root corrected the guard and added a regression. Original tool output records this run; Playwright replaced the first transient report before it was archived. No original screenshot/trace is claimed for this attempt. |
| 02 | 2 failed | Shared canonical edit advanced the workspace revision while the UI retained the old version, causing logo-save 409; signout navigation exposed the next identity form before route completion. Fixed by refreshing workspace after canonical save and showing pending auth state until destination session refresh. Full failure artifacts preserved in `e2e-attempt-02/test-results/`. |
| 03 | 1 failed, 1 passed | The controlled placement radio waited for the server and snapped to its prior value during a check. UI now keeps pending placement visible, with retry/reload after failure. Full artifacts preserved in `e2e-attempt-03/test-results/`. |
| 04 | 1 failed, 1 passed | Previous failed run had already persisted Every slide. The test expected another change event from an already checked radio. The test now establishes Cover before testing the placement transition. Full artifacts preserved in `e2e-attempt-04/test-results/`. |
| 05 | 2 passed, 17.1 seconds | Full journeys passed. Captures revealed an off-viewport fixed skip link in full-page screenshots and concatenated narrow header copy. Both visual issues corrected. Artifacts preserved in `e2e-attempt-05-pass/test-results/`. |
| 06 | 2 passed, 17.9 seconds | Final capture run passed after those visual changes. Artifacts preserved in `e2e-attempt-06-pass/test-results/`. |

`npm.cmd exec -- eslint apps/web/components apps/web/app tests/e2e --max-warnings=0`: PASS, zero warnings, after final UI changes. Root owns the full repository typecheck/build/check records.

## Exercised behavior

1. Producer development sign-in; inaccessible project absent from listing; existing project opens its persistent Casting workspace.
2. Canonical development project rename autosaves, is visible through a fresh API read, and survives browser reload. Original fixture name is restored through the UI.
3. Real generated PNG bytes with transparency upload through the authenticated transport and decode to the expected 96-pixel width. Every-slide placement survives reload. A different 144-pixel PNG replaces the selection. Removing selection retains authorized access to the prior original asset bytes.
4. All six workspace steps remain reachable with no specs/candidates. Pending features do not simulate provider work or generation.
5. Contributor direct canonical edit is denied 403; inaccessible project is denied 404; shared details render read-only. After signout, a library-only identity sees no accessible projects.
6. No uncaught page errors in the main journey. Desktop and 320-pixel mobile captures were inspected; the mobile page has no document-wide horizontal overflow. Navigation rows intentionally scroll within their own containers.

Final captures are under `e2e-attempt-06-pass/test-results/foundation-persistent-M01--14327--bytes-and-accessible-steps-chromium/`: `project-desktop.png` and `project-mobile.png`. Desktop uses the configured Desktop Chrome viewport; mobile is 320×760 CSS pixels. Images are full-page captures and have greater document height than viewport height.

## Limits

Audience preset CRUD is implemented and HTTP-tested as described below, but not exercised through its UI in this browser journey. Search paging, stale edit UI recovery, failed upload UI, session expiry and late-upload navigation cancellation have code paths and/or other domain/server coverage as recorded by the integration owner, but are not claimed as browser-tested here. Full keyboard traversal, screen-reader and axe acceptance were not performed. Real central records, canonical auth, Supabase DB/storage, real provider processing, approved template/fonts and deployment remain separate gates.

## Actual HTTP contract and behavior checks

`npm.cmd exec -- playwright test tests/e2e/api-contracts.spec.ts`: PASS — 2/2, 4.6 seconds, against the same running local development service. The report is preserved under `api-e2e-attempt-01-pass/test-results/`. API traces are explicitly disabled and tests never read, print or attach cookies or keys.

These requests validate actual response data through `validateContract` against the generated authoritative OpenAPI schemas, with exact success/error/page envelope keys and no-store headers checked separately:

- Unauthenticated project request: 401 `AUTH_REQUIRED`, valid `ErrorResponse`.
- Producer sign-in and capabilities; four concurrent create-workspace requests with one idempotency key return one workspace ID and valid `Workspace` DTOs. Same key with changed input: 409 `IDEMPOTENCY_KEY_REUSED`.
- Project PATCH with fresh revision succeeds; stale PATCH returns 409 `STALE_RESOURCE_VERSION` and cannot overwrite the saved name. Extra `principal_id` input returns 400 `VALIDATION_FAILED`. Original canonical development project name is restored in `finally` using a fresh revision.
- Invalid actual PNG bytes reach the authenticated transport and are rejected 422 `SOURCE_UNREADABLE`. Completion remains blocked 409 `UPLOAD_INCOMPLETE`; upload session is cancelled during cleanup.
- Producer creates, edits and archives a uniquely labelled audience preset with validated DTOs. Archived preset disappears from future selection. Contributor create, edit and archive requests are all denied 403 `CAPABILITY_REQUIRED`. Cleanup archives any unique test preset if an earlier assertion fails.

The targeted lint rerun after adding these API tests failed while loading the root ESLint configuration because `@eslint/js` was unavailable during the integration owner's dependency update (ESLint 10.13.0). It did not report a UI/API-test source lint failure. The prior final UI lint pass remains recorded above; the integration owner must record the current full lint result after dependency installation settles.

## Later foundation checkpoint — 2026-10-28

The earlier observations above are retained as historical evidence. Current full lint, typecheck, 60 application tests and build passed in `tracking/evidence/local-checks/summary.json`. Actual guarded PostgreSQL role and concurrent-session checks are separate evidence in `tracking/evidence/m01/DB_CONCURRENCY.json` and `development/local-db/receipts/`; browser fixtures do not prove that layer.

After separating logo upload availability from workspace write permission, `npm.cmd run test:e2e` passed all four browser/HTTP tests in 27.6 seconds. The fixture server uses port 3100 and isolated persistent synthetic state. JSON results and screenshots are preserved in `fixture-capability-checkpoint/`. Authorized placement/removal stays available even when the central upload pipeline is unavailable; upload controls follow the server capability list.

The actual central-mode app uses port 3000. Its separate anonymous browser/API proof, email form captures and Auth configuration/readiness receipts are under `tracking/evidence/cloud-foundation/`. It has no fixture identity chooser. Signed-in Producer writeback and private central logo transfer are still unverified; the agent has not requested a sign-in email.

Network traces are disabled. Earlier signed-cookie-bearing trace ZIPs were moved into ignored private retention, with their hashes and original artifact paths recorded in `PRIVATE_TRACE_RETENTION.json`. They are excluded from source control.
