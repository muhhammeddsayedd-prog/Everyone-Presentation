# Frontend route and interaction matrix

This matrix maps every studio and guest view to its interactions and to the backend operation each interaction calls. API paths are relative to `/api/v1`. The capability column is the requirement enforced by the server; the UI uses it only to hide or disable controls.

The overlays (drawers, modals, menus and toasts) follow `redesign-output/README.md` §4. Every write sends `row_version` (or the `expected_*` field the contract names) and an `Idempotency-Key`.

**Status values:**

| Status | Meaning |
|---|---|
| `done` | Implemented in the redesign and verified. |
| `restyled` | Existing behaviour on the new design system; the layout has not been rebuilt yet. |
| `planned` | In a later batch. |
| `backend` | Waiting on an operation listed in the implementation record. |

## Shell and access

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| All studio routes (`StudioApp`) | Load session and actor | `GET /api/session` | — | done |
| | Sign out | `DELETE /api/session` | — | done |
| | Leave with unsaved or pending writes | Leave-page alert dialog (replaces `window.confirm`) | — | done |
| | Mobile navigation sheet with all five destinations | — | — | done |
| | Recent workspaces (per-browser convenience) | localStorage only | — | done |
| Sign-in, development | Pick an identity and enter | `POST /api/dev/session` | — | restyled |
| Sign-in, central | Request a magic link; show a callback failure | `POST /api/auth/sign-in`; `GET /api/auth/callback` | — | restyled (logic unchanged) |
| `/oauth/consent` | Inspect, approve or deny; signed-out link; reconnect | `POST /api/oauth/authorization`, `POST /api/oauth/sign-in` | — | Unchanged. Visual changes only after coordinating with Codex. |

## Projects and workspace

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `/projects` | Search; load more | `GET /projects?q&cursor&limit` | projects.read | done |
| | Filter loaded rows (all / in progress / not started) | Client-side over loaded rows | — | done |
| | Select a row, which opens the project panel | `GET /workspaces/{id}`; `GET /presentation-series?workspace_id` (central only) | workspaces.read | done |
| | Open casting (creates the workspace) or resume | `POST /workspaces`, or `GET /workspaces/{id}` | workspaces.write | done |
| Workspace header (all steps) | Selection / Shortlist working output | `PATCH /workspaces/{id}` (`active_output`) | workspaces.write | done. The casting board owns this control on Casting, Review and Presentation. |
| | Step navigation; Review & generate | Links (`?series_id=` kept on Review and Presentation) | — | done |
| | Per-step status counts | Needs `GET /workspaces/{id}/summary` | — | backend |
| `…/project` | Edit project name and client name (autosave) | `PATCH /projects/{id}` (`expected_client_row_version`) | projects.write (`can_edit`) | done |
| | Reload saved details | `GET /projects/{id}` behind a confirm dialog | — | done |
| | Upload or replace the logo | `POST /uploads` → PUT bytes → `POST /uploads/{id}/complete` → `PATCH /workspaces/{id}` | cast.upload or workspaces.write | done |
| | Use client logo; remove; placement (cover or every slide) | `GET /media/{id}`; `PATCH /workspaces/{id}` | workspaces.write | done |

## Specs

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `…/specs` | Paste or upload a brief; extract; retry | `POST /workspaces/{id}/specs` (202), `POST /uploads…`, `GET /jobs/{id}` | workspaces.write | restyled → planned (batch 3) |
| | Edit normalized instructions and clarifications | `PATCH /workspaces/{id}/specs` | workspaces.write | restyled → planned |
| | Add, edit or archive a role (remove-role consequence modal) | `POST /workspaces/{id}/roles`, `PATCH /roles/{id}`, `POST /roles/{id}/archive` | workspaces.write | restyled → planned |
| | Headcount stepper; reduce-slots retire modal; slot labels | `POST /roles/{id}/slots/resize`, `PATCH /slots/{id}`, `GET /workspaces/{id}/retirements/{id}` plus undo | workspaces.write | restyled → planned |
| | Order dialog (keyboard reorder of roles) | `PUT /workspaces/{id}/order` | workspaces.write | planned |

## Candidates, Cast Library and profile

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `…/cast`, "In this project" tab | Table of project candidates; inspector drawer (media, frames, availability, fresh material, internal notes, files) | `GET/POST /workspaces/{id}/candidates`, `PATCH /workspace-candidates/{id}`, `POST …/remove`, `GET /candidates/{id}/media` | workspaces.write | planned (batch 4) |
| `…/cast`, "Cast Library" tab | Role filter suggestions; add to project | `GET /roles/{id}/candidate-filters`, `GET /candidates?…` | cast.read | planned |
| `…/cast`, "Uploads" tab | Resumable per-file uploads; processing feedback; duplicate choice | `POST /uploads`, tus/PUT, `POST /uploads/{id}/complete`, `GET /jobs`, `GET /candidates/{id}/duplicates`, `POST …/duplicates/resolve` | cast.upload | planned |
| `/library/cast` | Facets (supported search params), applied chips, include-unknown toggle, portrait grid | `GET /candidates?q,age_or_range,stated_gender,height_measurements,language,accent,skill,city,previous_project_role,classification,review_status,include_unknown` | cast.read | planned (batch 7) |
| `/library/cast/{id}` | Edit facts; "Confirm profile information"; archive | `PATCH /candidates/{id}`, `POST …/reviewed`, `POST …/archive` | cast.write / cast.review | planned |
| | Play video; transcript; frame picker (≤ 3, reorder, replace, extract at timestamps) | `POST /media/{id}/playback`, `PUT /candidate-media/{id}/frames`, `POST …/frames/extract` | cast.write | planned |
| | Supporting files | `GET /candidates/{id}/supporting-files`, `POST /candidate-support/{id}/archive` | cast.write | planned |

## Casting

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `…/organize` | Role swimlanes; candidate tray; assign (button or keyboard alternative to drag) | `GET /workspaces/{id}/assignments`, `POST /workspaces/{id}/assignments` | workspaces.write | restyled → planned (batch 5) |
| | Card menu: Option / Backup | `PATCH /assignments/{id}` (`position`) | workspaces.write | planned |
| | Set as Main, then the Undo toast | `PUT /slots/{id}/main`, `POST /slots/{id}/main/undo` | workspaces.write | planned |
| | Shortlist star; notes and slide-wording drawer | `PATCH /assignments/{id}` | workspaces.write | planned |
| | Move to slot or order; remove (confirm dialog) | `PUT /workspaces/{id}/order`, `POST /assignments/{id}/remove` | workspaces.write | planned |

## Review, presentations and sharing

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `…/review` | Choose the audience, then create the series explicitly | `GET /audience-presets`, `POST /presentation-series` | presentations.generate | restyled → planned (batch 6) |
| | Grouped preflight with inline repairs; slide fit | `GET /workspaces/{id}/review?series_id`, `POST …/review/fit` | workspaces.read | planned |
| | AI wording proposal (marked as a proposal) | `POST /ai-suggestions`, `GET /ai-suggestions/{id}` | workspaces.write | planned |
| | Generate a version (shows a stale-fingerprint banner) | `POST /presentation-series/{id}/versions` | presentations.generate | planned |
| `…/presentations`, `/presentations/versions/{id}` | Slide rail, carousel, app/PDF preview, versions | `GET /versions/{id}`, `GET /presentation-series/{id}/versions` | workspaces.read | planned |
| | PDF download; play original media | `GET /versions/{id}/pdf/content`, `POST /versions/{id}/media/{a}/playback` | workspaces.read | planned |
| | Share-link drawer: create (copy once), expiry, PDF toggle, extend, revoke, rotate | `POST/PATCH /review-links…`, `POST …/revoke`, `POST …/rotate` | review_links.manage | planned |
| | Internal and external feedback per version | `GET /versions/{id}/feedback`, `POST /versions/{id}/comments`, `PATCH /comments/{id}` | workspaces.write | planned |
| | Feedback summary | Needs `GET /versions/{id}/feedback/summary` | — | backend |
| `/presentations` | Series index; rename or archive a series | `GET /presentation-series`, `PATCH /presentation-series/{id}` | presentations.generate | planned |
| `/r/{token}` (guest) | Open the link; identity before the first write; Preferred / Maybe / Not preferred; comments; PDF; video | `/review/open`, `/review/session`, `/review/identity`, `/review/presentation`, `/review/versions/{id}/…` | Link token | planned (batch 8; token and session flow untouched) |

## Operations and settings

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `/processing` | Jobs grouped by project and batch; per-file strip; detail drawer | `GET /jobs?workspace_id,status`, `GET /jobs/{id}` | operations.read | restyled → planned (batch 9) |
| | Retry or cancel | `POST /jobs/{id}/retry`, `POST /jobs/{id}/cancel` | operations.retry | planned |
| | Batch filter or summary | Needs `GET /jobs?batch_id=` | — | backend |
| `/settings` | Defaults (timezone, template); audience presets (create, edit, archive) | `GET/PATCH /settings`, `GET/POST/PATCH /audience-presets`, `POST …/archive` | settings.manage | restyled → planned |
