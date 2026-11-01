# Frontend route and interaction matrix

This matrix maps every studio and guest view to its interactions and to the backend operation each one calls. API paths are relative to `/api/v1`. The capability column is the server's requirement; the UI uses it only to hide or disable controls. Every write sends `row_version` (or the contract's `expected_*` field) and an `Idempotency-Key`.

The statuses are defined in [IMPLEMENTATION_RECORD.md](IMPLEMENTATION_RECORD.md#status-vocabulary):

| Status | Meaning |
|---|---|
| **Verified (mock)** | Implemented; verified by specs against mocked responses or the fixture server |
| **Awaiting connected** | Not yet run against the connected pilot |
| **Restyled** | Interaction work remains |
| **Blocked** | Needs a missing contract |

No row has connected-backend evidence from this worktree yet.

## Shell and access

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| All studio routes | Session, sign out | `GET`, `DELETE /api/session` | — | Verified (mock) |
| | Leave with unsaved or pending writes | Alert dialog | — | Verified (mock) |
| | Mobile navigation sheet; recent workspaces | localStorage only | — | Verified (mock) |
| Development sign-in | Identity, enter | `POST /api/dev/session` | — | Verified (mock) |
| Central sign-in | Magic link; callback failure | `POST /api/auth/sign-in`, `GET /api/auth/callback` | — | Restyled (logic unchanged; connected flow not re-run here) |
| `/oauth/consent` | Inspect, approve or deny; reconnect | `POST /api/oauth/authorization`, `POST /api/oauth/sign-in` | — | Unchanged; specs pass |

## Projects and workspace

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `/projects` | Search, filter loaded rows, load more, project panel | `GET /projects`, `GET /workspaces/{id}`, `GET /presentation-series?workspace_id` | projects.read | Verified (mock) |
| | Open or resume casting | `POST /workspaces`, `GET /workspaces/{id}` | workspaces.write | Verified (mock) |
| Workspace header | Output toggle; steps; Review & generate | `PATCH /workspaces/{id}` | workspaces.write | Verified (mock) |
| | Step and summary counts | Needs `GET /workspaces/{id}/summary` | — | Blocked |
| `…/project` | Project and client autosave; reload | `PATCH /projects/{id}` | `can_edit` | Verified (mock) |
| | Logo upload, replace, use client logo, remove, placement | `/uploads…`, `PATCH /workspaces/{id}` | workspaces.write | Verified (mock) |

## Specs

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `…/specs` | Paste or file brief, extract, retry, source-mode switch confirm | `POST /workspaces/{id}/specs`, `/uploads…`, `GET /jobs/{id}` | workspaces.write | Verified (mock) |
| | Instructions and clarifications autosave | `PATCH /workspaces/{id}/specs` | workspaces.write | Verified (mock) |
| | Add, edit or archive a role (consequence dialog) | `POST /workspaces/{id}/roles`, `PATCH /roles/{id}`, `POST /roles/{id}/archive` | workspaces.write | Verified (mock) |
| | Headcount stepper; choose slots to retire; slot labels; retirement Undo | `POST /roles/{id}/slots/resize`, `PATCH /slots/{id}`, retirement get and undo | workspaces.write | Verified (mock) |
| | Change role order (keyboard panel) | `PUT /workspaces/{id}/order` | workspaces.write | Verified (mock) |

## Candidates, Cast Library and profile

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `…/cast` | Rows; inspector: introduction, ≤ 3 frames, availability, fresh material, confirmation, notes, files, new introduction; remove (consequence dialog with Undo) | `GET /workspaces/{id}/candidates`, `PATCH /workspace-candidates/{id}`, `POST …/remove`, `GET /candidates/{id}/media` | workspaces.write | Verified (mock) |
| | Cast Library tab: role filter suggestions, add to project | `GET /roles/{id}/candidate-filters`, `GET /candidates`, `POST /workspaces/{id}/candidates` | cast.read | Verified (mock) |
| | Uploads tab (resumable, per file) | `/uploads…`, `GET /jobs` | cast.upload | Verified (mock), existing queue |
| `/library/cast` | Facets (supported params), chips, missing-values toggle, grid or list, manual create | `GET /candidates?…`, `POST /candidates` | cast.read / cast.write | Verified (mock) |
| `/library/cast/{id}` | Facts, Reviewed confirmation, duplicates, archive (confirm) | `PATCH /candidates/{id}`, `POST …/reviewed`, `…/duplicates/resolve`, `…/archive` | cast.write / cast.review | Verified (mock) |
| | Video, English transcript, frame picker and extraction | `POST /media/{id}/playback`, `PUT /candidate-media/{id}/frames`, `POST …/frames/extract` | cast.write | Verified (mock) |
| | Supporting files (archive confirm) | `GET …/supporting-files`, `POST /candidate-support/{id}/archive` | cast.write | Implemented; archive confirm has no spec |

## Casting

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `…/organize` | All roles overview or one role; coverage per role; role order (move, drag) | `GET` roles, slots, pool, assignments; `PUT /workspaces/{id}/order` | workspaces.read / write | Verified (mock) |
| | Assign from a slot list or from the tray menu (keyboard) | `POST /workspaces/{id}/assignments`, `PATCH /assignments/{id}` (Shortlist) | workspaces.write | Verified (mock) |
| | Option / Backup; Set as Main with Undo toast; clear Main to Backup | `PATCH /assignments/{id}`, `PUT /slots/{id}/main`, `POST /slots/{id}/main/undo` | workspaces.write | Verified (mock) |
| | Shortlist star; notes drawer; order within slot; remove (confirm); uncertain-write retry | `PATCH /assignments/{id}`, `PUT …/order`, `POST /assignments/{id}/remove` | workspaces.write | Verified (mock) |
| | Move to another slot | No contracted operation | — | Blocked (dependency 5) |

## Review, presentations and sharing

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `…/review` | Series context: choose or create | `GET /audience-presets`, `GET`, `POST /presentation-series` | presentations.generate | Verified (mock) |
| | Grouped checks with repair actions | `GET …/review?series_id`, `POST …/review/fit`, plus navigation | workspaces.read / write | Verified (mock) |
| | Inspector: wording, AI proposal, availability, Reviewed confirmation, English source transcript | `PATCH /assignments/{id}`, `/ai-suggestions`, `PATCH /workspace-candidates/{id}`, `POST /candidates/{id}/reviewed` | workspaces.write / cast.review | Verified (mock) |
| `…/presentations` | Draft, preflight summary, generate, stale notice, uncertain confirm, history | `GET …/review`, `POST /presentation-series/{id}/versions`, `GET …/versions` | presentations.generate | Verified (mock) |
| Version viewer | Slide rail, App / PDF preview, keys, PDF, media with English transcript | `GET /versions/{id}`, `…/pdf/content`, `…/media/{a}/playback` | workspaces.read | Verified (mock) |
| Share drawer and sharing page | Create (copy-once), expiry, PDF, extend, revoke, rotate | `/review-links…` | review_links.manage | Verified (mock) |
| | Feedback per version (internal and external) | `GET /versions/{id}/feedback`, comments | workspaces.write | Verified (mock) |
| | Feedback summary counts | Needs `GET /versions/{id}/feedback/summary` | — | Blocked |
| `/presentations` | Rename, archive, restore series | `PATCH /presentation-series/{id}` | presentations.generate | Verified (mock) |
| `/r/{token}` | Open; identity; preference radio group; comments; unsent-comment guard; PDF; English transcript | `/review/*` | link token | Verified (mock) |

## Operations and settings

| Route / surface | Interaction | Operation | Capability | Status |
|---|---|---|---|---|
| `/processing` | Filter, pages, batch file strip (page-scoped counts) | `GET /jobs?status&cursor` | operations.read | Verified (mock) |
| | Job drawer: state, stage, progress, safe failure, retry, cancel (confirm) | `GET /jobs/{id}`, `POST /jobs/{id}/retry`, `POST /jobs/{id}/cancel` | operations.retry | Verified (mock) |
| | Batch totals across pages | Needs `GET /jobs?batch_id=` | — | Blocked |
| `/settings` | Defaults (timezone, template; validation, uncertain save, conflict) | `GET`, `PATCH /settings` | settings.manage | Verified (mock) |
| | Audience presets: create, rename, archive (confirm) | `/audience-presets…` | settings.manage | Verified (mock) |
