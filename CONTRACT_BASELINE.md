# Contract baseline — Everyone Presentation Studio

Pack version 1.0 • 27 October 2026 • Implementation specification, not an implemented app.

This file fixes names and cross-document rules. User-confirmed requirements take precedence over recommended implementation defaults. Defaults below are concrete build instructions unless discovery proves a technical incompatibility; record adaptations in tracking/DECISIONS.md. Never describe uninspected cloud schema or unfinished implementation as existing.

## Terminology and repository

App: Everyone Presentation Studio. First complete module: Casting (Selection and Shortlist). Logical app schema: `eps` (private; not directly exposed through the public Data API). Preferred repo: `apps/web`, `apps/worker`, `packages/domain`, `packages/contracts`, `packages/templates`, `packages/integrations`, `supabase`, `n8n`, `tests`, `docs`. Source folders are planned, not created by this documentation pack. Domain service operations back UI, API, MCP, and validated workflow callbacks. TypeScript web/API; native worker uses FFmpeg/ffprobe and Playwright. Existing Supabase and n8n Cloud; OpenAI API; authenticated MCP as final production integration.

## Canonical entities

`integration_bindings` (app UUID ↔ real canonical project/client/principal/candidate identity; no copied project/client names), `workspaces`, `specs`, `roles`, `slots`, `media_assets`, `candidates`, `candidate_media`, `workspace_candidates`, `assignments`, `audience_presets`, `presentation_series`, `presentation_versions`, `version_slides`, `review_links`, `guest_sessions`, `feedback_comments`, `feedback_preferences`, `jobs`, `job_events`, `outbox_events`, `idempotency_records`, `audit_events`.

Additional delivery entities: `presentation_exports` (guest PDF artifact and lifecycle, unique version/link/template variant) and `review_media_grants` (hash-only bearer grant bound to a parent review link and fixed generated version). The canonical internal PDF is stored on `presentation_versions` and uses authenticated playback. Guest download prepares/caches a link-scoped export of the same frozen pages with grant-backed fixed-version URLs. Worker obtains the raw grant once over an authenticated response; no raw grant/link token in jobs/outbox/logs. `/m/:grantToken/versions/:versionId/media/:assetId` validates grant, parent link, fixed version and asset every request. Cached private PDF holds the playback URL; no separate raw-token recovery is needed. Failed attempt grants revoked. This solves PDF creation before a review link exists and independent expiry/revocation across links. Changing review-link latest version never changes old PDF media.

Disabling PDF downloads denies preparation/download only; existing downloaded PDF video access still follows parent link view permission. Link expiry edits propagate to non-revoked child grants (including naturally expired grants); never revive revoked grants. Review-link rotation revokes old tokens/sessions/grants and invalidates affected export caches. Raw token is shown at creation; permanent storage is digest-only, with encrypted short-lived idempotent creation-response replay as explicitly specified in the security contract.

M0 discovers canonical project/client/person/auth records. Prefer actual foreign keys to those sources where types/ownership permit. `integration_bindings` is an identity bridge only, not a second project/client database. Binding creation validates the referenced canonical record via the discovered adapter; production cannot accept invented or unlinked project IDs. All business FKs are UUIDs internally. API IDs are opaque strings to clients. All timestamps UTC ISO 8601; display user's timezone, default Africa/Cairo. No real cloud table/column name is assumed.

Candidates hold casting-owned extension fields only where no suitable canonical shared field exists. `workspace_candidates` owns project availability and chosen media; `assignments` owns slot, position, explicit shortlist inclusion, presentation notes/wording. Full reusable facts are separate from slide wording. Where fact ownership is canonical, writes go to canonical record, not a second competing field. M0 records exact field mapping.

## UI routes

`/projects`; `/projects/:projectId/casting/:workspaceId/project`; `/specs`; `/cast`; `/organize`; `/review`; `/presentations` (last five appended to the same workspace prefix); `/library/cast`; `/library/cast/:candidateId`; `/presentations`; `/presentations/:seriesId/versions/:versionId`; `/processing`; `/settings`; guest `/r/:token`, version media `/r/:token/versions/:versionId/media/:assetId`. Internal selected project required before workspace creation. Guest URL token exchanged for short-lived scoped session; redact token from logs/referrers and remove it from subsequent internal requests where feasible.

## API and jobs

Versioned `/api/v1` HTTP API. Operation IDs snake_case and shared with MCP tool names. Internal Bearer auth; review token/session scoped guest auth; separate authenticated service identities for worker/n8n. Response envelopes include `request_id`; typed errors include `code`, `message`, `details`, `retryable`. Cursor pagination. `row_version` optimistic concurrency (409 stale update). Idempotency-Key for non-idempotent creates, assignment position changes, import/generation/dispatch; same key + different request = 409. Async create returns 202 with job/resource IDs. Document actual exact endpoints in OpenAPI; service operations are canonical.

Jobs: `queued`, `running`, `waiting_for_input`, `succeeded`, `failed`, `cancelled`. Media: uploading/ready/failed/quarantined/archived as needed. Version: `queued`, `rendering`, `ready`, `failed` (immutable content after input capture; only lifecycle metadata transitions). Outbox/lease states defined in data contract. A version becomes ready only after artifacts/manifest have been validated and persisted. Review links advance to newest *successfully ready* version in the SAME series; series includes workspace + output_type + audience preset snapshot/scope. Draft changes never change a ready snapshot. Reprocessing cannot clobber confirmed edits; use row_version guard without a dedicated fact-conflict UI.

One file job runs one leased stage at a time (parallelism across files/jobs); callbacks include current attempt UUID/fencing/event sequence. Workers reserve and verify derived output assets through scoped service operations before using their IDs. Review returns `input_fingerprint` over exact relevant central/profile/media/role/slot/assignment/template/audience inputs. Generation requires `expected_input_fingerprint` and recomputes it while capturing the immutable manifest in the same consistent snapshot. A draft counter alone cannot detect shared-record edits from another app/project. Stale input returns a refresh response; it does not create a fact-conflict feature or human-only gate.

Final review selects/reuses its output/audience-scoped series and template before computing the fingerprint (`get_workspace_review` requires `series_id`). M04 implements that minimal series foundation; M05 adds version generation. Confirmed reusable profile review stores `reviewed_facts_fingerprint`; changed reusable facts/evidence project as Unreviewed until reconfirmed. Project availability, assignment notes or template changes do not invalidate reusable profile review.

## Capabilities (implementation defaults mapped to existing roles in M0)

`projects.read`, `projects.write`, `workspaces.read`, `workspaces.write`, `cast.read`, `cast.upload`, `cast.write`, `cast.review`, `presentations.generate`, `review_links.manage`, `settings.manage`, `operations.read`, `operations.retry`. Internal project authorization AND capability required for project scope. Shared library access restricted to approved internal casting users. Reusable corrections and Reviewed require producer/designated casting-editor `cast.write`/`cast.review`. Contributor may upload and prepare project work, but cannot confirm shared facts. Admin role alone does not invent authorization to a central project. Claude gets same acting-user capabilities, no agent-only human approval gate. Guest sessions only read the shared version/media and external feedback, add own named feedback/preferences, download if enabled. No library/project-internal-note access.

## Business rules (stable IDs for traceability)

| ID | Required behavior |
|---|---|
| BR-001 | First complete module is Cast Selection + Cast Shortlist in one connected workspace; other module workflows deferred. |
| BR-002 | Existing authorized central project required in production; upload client logo in Project tab; authorized project/client edits update shared records. |
| BR-003 | Initial inputs direct multiple uploads and historical internal library; no external source connectors. |
| BR-004 | Specs accept PDF, Word (.docx; legacy .doc compatibility via conversion if needed) or written text. Extract role/count/classification/scenes/age/gender/appearance/performance/languages/accents/skills/shoot dates/location/availability/instructions. Missing or unclear marked Needs clarification, editable. |
| BR-005 | Specs stable; ordinary correction supported, no specs revision/diff manager. |
| BR-006 | Headcount always creates individual slots; one role may reference multiple scenes without duplicate cast needs. |
| BR-007 | Library suggests editable filters from role requirements; uses only supplied age/gender/measurements/languages/skills/city/experience/classification. |
| BR-008 | One candidate per video; spoken intro supplies facts. Preserve source transcript; English normalized slide information; Arabic/English/mixed sources supported. Never infer personal attributes from appearance. |
| BR-009 | Save up to three clear distinct representative ACTUAL video frames. Fewer frames allowed; user/Claude confirms available media or replaces video. No synthetic candidate imagery. |
| BR-010 | New scanned candidate is immediately reusable as Unreviewed; final information confirmation by authorized actor marks Reviewed. Reviewed is not casting/booking approval. |
| BR-011 | Possible duplicate: actor selects existing profile or creates new. No automatic identity merge or face identity recognition. |
| BR-012 | Saved media reused unless fresh project material required; selected source media pinned per workspace candidate and generated version. |
| BR-013 | Same candidate can occupy several slots with independent choices. At most one active assignment per candidate+slot. |
| BR-014 | New assignment starts Option; each slot allows zero or one Main, any number of Backups and Options. Main replacement is atomic; default moves previous Main to Backup with Undo. |
| BR-015 | Selection contains all active assigned candidates; unassigned pool excluded. Shortlist is explicit inclusion; adding in Shortlist creates an assignment visible in Selection. Position does not imply inclusion. |
| BR-016 | Missing facts, zero Main, undecided Options, and open slots permitted; empty output slot generates Pending slide showing its requirements. |
| BR-017 | Confirmed reusable factual corrections save to library/canonical facts. No dedicated fact-conflict feature. Slide wording edits do not silently overwrite full reusable facts. |
| BR-018 | Exactly one candidate slide per assignment; repeat within each relevant role/slot; app photo carousel; PDF all available selected frames together. |
| BR-019 | Show all ten agreed fields: name or ID; age/range; supplied height/measurements; languages/accents; skills/experience; city; recorded projects/roles; classification; current-project availability; presentation notes. Missing = Not provided. English labels. |
| BR-020 | Long text flagged during final review; actor edits wording with optional AI help. Never silently clip/omit; explicit editing needed to fit the approved single-page template. |
| BR-021 | Maintain existing Everyone design adapted to the above content contract; cover, candidate, Pending layouts. Optional logo on cover, optional every slide (prototype default; implementation default retained). |
| BR-022 | Direct controls plus contextual AI instructions; information reviewed before generation; all six stages support returning navigation and autosave. |
| BR-023 | New material updates working draft automatically with visible changes, preserving ready presentation versions; do not silently change explicit casting choices. |
| BR-024 | Review in app + PDF. Saved version captures selected media/facts/requirements/branding/template/output/audience/wording and ordered pages. |
| BR-025 | Producer chooses audience per series/version from saved presets; audience changes create/reuse a separate scoped series, never leak internal versions via external links. |
| BR-026 | External access by bearer link, no sign-in, defaults 30 days. Link follows latest ready version in same series; generation does not auto-renew expiry (implementation default). |
| BR-027 | Guest sees slides immediately; name before first feedback, company optional, browser remembers; self-declared identity. All reviewers of same presentation share external comments/preferences; internal notes private. |
| BR-028 | Feedback per version and assignment: Preferred/Maybe/Not preferred plus comments. It does not set casting Main/Backup/Option. Historical feedback remains attached to viewed version. |
| BR-029 | External PDF download enabled by default, link-level disable available. PDF video links pin original version/media behind current authorization, not short-lived storage URLs. |
| BR-030 | Shared Everyone library across projects restricted to approved internal casting users. Producer/designated casting editors can correct reusable facts and mark Reviewed. |
| BR-031 | Claude can perform every meaningful user action through API/MCP under acting-user permissions, including confirming data, generating and managing share links. No human-only gate added. |
| BR-032 | Existing central Supabase is source of truth; inspect cloud read-only, reuse suitable tables/functions, build locally, deliver coordinated tested migrations. Cloud schema has not been inspected for this pack. |
| BR-033 | Codex develops; embedded AI uses OpenAI; n8n Cloud coordinates processing; separate native worker handles media/PDF workloads. |
| BR-034 | Plan for batches up to 200 videos as initial sizing target, not hard product limit or concurrency count. Partial failures independent, resumable/retryable, status survives navigation. |
| BR-035 | API/MCP complete before production; shared operations designed from first feature milestone. No external source integration in first release. |
| BR-036 | Missing content never invents facts. Technical correctness/access/file/render failures may require repair or omission of failed media; production does not copy prototype's bypass of auth/project/integrity controls. |

## Delivery sequence

M00 Discovery and contracts → M01 Foundation/project/logo → M02 Specs/roles → M03 Media/library/processing → M04 Assignments/review → M05 Template/version/PDF → M06 External review → M07 API/MCP completion and production readiness. Shared APIs are built during each feature, not bolted on at M07. No hard time/cost estimate without representative files and cloud discovery.

## Explicitly deferred / unresolved external facts

No pricing/billing, external Drive/social connectors, specs revision workflow, fact-conflict comparison workflow, bookings/payments, new central project management product, director treatment generator, freeform slide editor, or full other-presentation module in v1. Hosting vendor, current auth setup, central schema, final template assets/fonts, representative real specs/video sizes, service credentials/quotas are discovery inputs. Proceed locally with synthetic fixtures when unavailable; log dependency, do not ask endless product questions. Existing prototype is UX reference only, contains simulated AI; no claim of implemented production services.
