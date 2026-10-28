# Test strategy and acceptance catalogue

**Status:** planned tests, not executed production evidence. **Traceability:** BR IDs refer to `CONTRACT_BASELINE.md`. **Milestones:** M00–M07 use the delivery plan's identifiers. The implementation must attach results to `PROGRESS.md` and the release evidence record; the existence of this catalogue does not mean the app has passed it.

## 1. What completion means

A milestone is complete when its behavior works through the real domain operations, persists correctly, is available through its intended user interface, obeys permissions, and has targeted evidence for the risks introduced in that milestone. A click-through mock does not satisfy a persistent data requirement. Mocked OpenAI/n8n responses can test handling deterministically, but production acceptance requires representative real service runs.

The first release is complete only when an authorized internal producer and an authorized Claude client can each perform the full casting journey: select an existing central project, import specs and videos, correct data, reuse/resolve library candidates, assign individual slots, review, generate a fixed version/PDF, manage a live review link, and inspect named external feedback. Guest review must also work independently in a browser without internal authentication.

## 2. Test layers

| Layer | What to verify | Preferred scope |
| --- | --- | --- |
| Domain unit tests | Inclusion, ordering, positions, page manifest, missing values, source ownership, state transitions | Pure rules with deterministic fixtures. Avoid tests that merely reproduce a getter's implementation. |
| Database integration | Unique constraints, transactions, authorization, optimistic concurrency, immutable snapshots, migration compatibility | Local Supabase with discovered central-schema fixtures. |
| API contract | Request validation, permission scope, errors, idempotency, pagination, async job receipts | Actual HTTP service against local/test infrastructure. |
| Worker/workflow integration | Media decoding, transcripts, typed extraction, retry stages, callbacks, render output | Real worker; mocked external provider for failure injection, plus real-provider acceptance runs. |
| UI end-to-end | Producer flow, guest mobile flow, save/reload, partial failure, permissions | Browser tests against running app and persisted backend. |
| Visual/export | Cover/candidate/Pending composition, fit, frames, logos, historical stability | Rendered HTML + opened PDF pages with actual bundled fonts. |
| MCP parity | Discover/call all supported operations with acting-user scope, async polling and upload transfer | Real authenticated test client plus selected Claude integration environment. |
| Operational | Deploy, rollback, resume jobs, revoke links, backup/restore procedure, alerts | Staging configured like the intended production topology. |

Do not broaden testing indefinitely. Run tests that establish the stated acceptance criteria, investigate actual failures, and satisfy the release gate. Store representative failing fixtures when a defect is fixed; do not add brittle snapshots for incidental formatting unrelated to behavior.

## 3. Deterministic fixture expectations

`fixtures/casting-happy-path.json` is a **domain fixture**, not a raw database seed or API request. Test factories map its symbolic IDs into the real discovered schema and contract types. All people, project names, dates, and statements are fictional. Its ordered result is:

| Output | Candidate pages | Pending pages | Cover | Total |
| --- | ---: | ---: | ---: | ---: |
| Selection | 6 | 1 | 1 | **8** |
| Shortlist | 3 | 2 | 1 | **6** |

The candidate assigned to Father and Manager is deliberately repeated. One candidate in the project pool has no assignments and appears in neither output. Waiter 2 has an Option in Selection but no explicit shortlist inclusion, so Shortlist has a Pending page for that slot. Waiter 3 is empty in both outputs. These distinctions must be asserted in order, not inferred only from totals.

Media paths in domain JSON are references for test factories, not claims that real candidate videos were supplied. Source transcript/text files are deterministic expected-input fixtures. A media test suite must provide generated synthetic media for technical errors and consented/authorized representative introduction recordings for actual recognition evaluation.

## 4. Acceptance cases by product area

### A. Central project, access, and persistence

| ID | BR / milestone | Scenario and required result |
| --- | --- | --- |
| AT-001 | BR-002, BR-032 · M00/M01 | Inspect central schema in read-only mode, record actual ownership/types/functions/policies, map canonical IDs, then build locally. Evidence includes discovery output and a reviewed migration plan; no guessed `public.projects` dependency. |
| AT-002 | BR-002 · M01 | Attempt workspace creation without a valid accessible central project. API rejects it; UI directs to existing project selection. It never silently creates an unlinked project. |
| AT-003 | BR-002 · M01 | Two requests start Casting for the same project at once. They resolve to one connected workspace under the chosen uniqueness contract; no duplicated cast work. |
| AT-004 | BR-002 · M01 | Authorized project/client name edit is visible through the canonical integration and another connected-reader path. A display-only override does not satisfy this case. |
| AT-005 | BR-002, BR-030 · M01 | Actor without project write or library-edit capability cannot perform the privileged API operation even if the client enables its control manually. Read-only UI remains useful. |
| AT-006 | BR-022 · M01–M04 | Save content, reload, sign in on a fresh browser session, and reopen. Server-backed state and job progress persist. Failed writes remain visibly unsaved until repaired. |
| AT-007 | BR-022, BR-036 · M01–M04 | Navigate all six workspace steps with missing optional data. Existing project access remains mandatory; missing candidate height or open casting slots do not become navigation gates. |
| AT-008 | BR-002, BR-021 · M01/M05 | Upload transparent, wide, and tall client logos; inspect cover-only and every-slide placement. Failed replacement retains previous logo. A late upload callback after project switching cannot attach to the wrong project. |

### B. Specs and role/slot organization

| ID | BR / milestone | Scenario and required result |
| --- | --- | --- |
| AT-009 | BR-004 · M02 | Supply equivalent PDF, `.docx`, and pasted-text specs. Extracted roles and requirements preserve supplied meaning; file failures have a retry/manual-entry path. Legacy `.doc` follows the documented conversion support or a clear unsupported-format message. |
| AT-010 | BR-004, BR-036 · M02 | Omit headcount or age; include an ambiguous availability instruction. Missing values remain null/unclear and visibly Needs clarification. A provisional slot does not turn unknown headcount into a claimed fact. |
| AT-011 | BR-006 · M02 | A Father role appears in two scenes with headcount one. It remains one role/slot with multiple scene references. A Waiter role with count three produces three distinct slots. |
| AT-012 | BR-005 · M02 | Correct extracted requirements manually and retry a failed extraction stage. Confirmed corrections survive; no specs revision/diff workflow is introduced. |
| AT-013 | BR-006, BR-013 · M02/M04 | Raise a role's headcount and then reduce it with assigned slots. New slots appear; retirement explicitly identifies affected slots and does not delete library profiles or rewrite historical versions. |
| AT-014 | BR-003, BR-004 · M02 | Direct upload and pasted text work without Google Drive or other external source connectors being configured. No connector setup is a hidden prerequisite. |

### C. Candidate ingestion and library

| ID | BR / milestone | Scenario and required result |
| --- | --- | --- |
| AT-015 | BR-008 · M03 | Process one introduction per video in English, Arabic, and mixed Arabic/English. Preserve original-language transcript and normalized English supplied facts. Record actual field accuracy against an independently prepared answer key. |
| AT-016 | BR-007, BR-008 · M03 | Video does not state age, height, gender, or city. Output leaves those facts absent rather than inferring from the face, voice, filename, role specs, or visual appearance. |
| AT-017 | BR-009 · M03 | A video has three distinct clear views. Selected frames are actual source frames, with source timestamps and preserved order; no image-generation operation creates them. |
| AT-018 | BR-009, BR-036 · M03/M05 | Video offers two, one, or no usable frames. UI reports available material honestly, allows confirmation/replacement, and generated output follows the documented fewer/zero-frame layout without duplicating an image. |
| AT-019 | BR-010, BR-030 · M03 | Successful scan creates a reusable Unreviewed profile immediately. An authorized casting user can add it to another project before confirmation. An unapproved internal actor cannot search the global library. |
| AT-020 | BR-011 · M03 | Similar supplied identity data produces possible matches. Choosing existing links material to the selected profile; choosing new creates a separate profile. Neither branch performs automatic face identification or destructive merge. |
| AT-021 | BR-012, BR-024 · M03/M05 | Reuse saved media, then require a fresh video for another project. Each workspace uses its selected source, and already-generated versions retain their original source. |
| AT-022 | BR-007 · M03/M04 | Role-based filter suggestions are visible and editable. Clear/change a filter and inspect supplied-value matches; unknown fields remain discoverable through the documented missing-value option. No silent ranking substitutes for explicit producer selection. |
| AT-023 | BR-003, BR-008 · M03 | Upload a video with supporting images/docs. Attachments remain associated with the intended candidate; the app does not create one fictional person for each attachment. Ambiguous association asks for an explicit choice within the work item. |
| AT-024 | BR-010, BR-017, BR-030 · M03/M04 | Producer/designated editor corrects and confirms current profile information. Reviewed persists with actor/time and reusable-facts/source fingerprint; contributor cannot perform that mutation. Change a canonical reusable fact through another app: projected status becomes Unreviewed until reconfirmed, with no fact-conflict UI. Change only project availability, position, template, or unrelated job timestamps: fact review stays valid. Reviewed does not set Main, availability, or booking. |

### D. Assignments, selection, and wording

| ID | BR / milestone | Scenario and required result |
| --- | --- | --- |
| AT-025 | BR-013 · M04 | Assign one person to Father and Manager. Change Father's position, shortlist inclusion, and notes. Manager's choices remain unchanged. Duplicate same-person/same-slot assignment is prevented. |
| AT-026 | BR-014 · M04 | New assignment starts Option. Set a Main, then another Main. Exactly one remains Main; previous Main moves to Backup under the implementation default. Reversal through Undo obeys current concurrency rules. |
| AT-027 | BR-014 · M04 | Two actors concurrently set different candidates Main for one slot. Transaction/constraint prevents two Mains. API returns coherent winning state or a typed concurrency response; no temporary invalid state is persisted. |
| AT-028 | BR-015 · M04 | Run happy-path fixture. Selection contains all six active assignments and excludes the unassigned pool. Shortlist contains only the three explicit inclusions. Positions never create implicit Shortlist membership. |
| AT-029 | BR-015 · M04 | Add a person directly while working in Shortlist. The assignment also appears in Selection. Remove only Shortlist membership; Selection assignment remains. |
| AT-030 | BR-016 · M04/M05 | Leave a slot empty and another with only Option candidates. Empty slot becomes Pending in that output; Options produce candidate slides without requiring Main. |
| AT-031 | BR-017 · M04 | Correct a reusable height and separately shorten assignment experience wording. Library height changes; full library experience remains intact; only the assignment display wording is shorter. |
| AT-032 | BR-020 · M04/M05 | Force actual template overflow with long notes. Final review identifies offending field, offers edit/AI wording, and prevents silent clipping, tiny text, missing field, or a second unplanned candidate page. |
| AT-033 | BR-022, BR-031 · M04/M07 | Direct controls and optional AI instructions apply to the named object/scope. Authorized Claude can perform the same correction/confirmation without a human-only gate. |
| AT-034 | BR-023 · M04/M05 | Add material after generation. Working draft shows new/changed items; explicit casting positions and shortlist choices are preserved; ready version content is unchanged. |

### E. Presentation generation and PDF

| ID | BR / milestone | Scenario and required result |
| --- | --- | --- |
| AT-035 | BR-018, BR-019 · M05 | Assert exact happy-path ordered manifest: Selection 8 pages and Shortlist 6 pages. Repeated candidate appears within each assigned role/slot. Validate names, positions, IDs, and pending slots, not just totals. |
| AT-036 | BR-019 · M05 | All ten fields render in English. Missing values use Not provided. A supplied zero/false-like string is not mistaken for missing; no unsupplied availability is invented. |
| AT-037 | BR-018 · M05 | App candidate view cycles selected frames; downloaded PDF shows every available selected frame together on the same single candidate page. |
| AT-038 | BR-016, BR-021 · M05 | Pending pages show their own requirements. All-empty assignments yield one cover plus one Pending per slot. No-role draft follows the documented cover-plus-pending-summary default. |
| AT-039 | BR-021, BR-024 · M05 | Edit project text, logo, facts, frame selection, role wording, and template after V1. V1 display/PDF/media remain fixed; V2 captures new content. No render-time joins pull mutable values into V1. |
| AT-040 | BR-024, BR-036 · M05 | Create/reuse output/audience-scoped series, fetch preflight and input_fingerprint, then change a canonical project/client/profile fact through another app without bumping the workspace counter. Generation with the stale fingerprint rejects and refreshes review. Changing output/audience/template also requires new preflight. Successful capture recomputes the fingerprint in the same consistent snapshot; it never silently incorporates unreviewed changed facts or mixes revisions. |
| AT-041 | BR-024 · M05 | Open the actual PDF in a viewer. Verify page count/ratio, text search/selection where supported, image orientation, fonts, colors, links, no clipped text, no missing assets, and valid file bytes. A download-button click alone is insufficient. |
| AT-042 | BR-024, BR-026 · M05/M06 | Queue V2 and V3; finish V3 first, V2 later. Latest-ready pointer never regresses to V2. A failed later version does not replace the last valid ready version. |
| AT-043 | BR-029 · M05/M06 | Download a link-scoped external PDF for V1, open in a fresh browser without internal login, replace current video, generate V2, and open V1 preview again. It opens V1 media while parent access is valid, or a clear denied/expired state; it never opens V2 media. Internal PDF uses authenticated media access. |
| AT-044 | BR-021, BR-036 · M05 | Worker font/image fetch fails or PDF is incomplete. Version does not become ready. Retry preserves correct snapshot and does not claim success for a missing file. |

### F. Guest access and feedback

| ID | BR / milestone | Scenario and required result |
| --- | --- | --- |
| AT-045 | BR-025, BR-026 · M06 | Create review link with default 30-day expiry. New ready version in the same series appears on new entry. A version from another output/audience never appears. Generating again does not renew expiry. |
| AT-046 | BR-026, BR-027 · M06 | Open in a clean browser without internal login. Slides display immediately. Name is requested only before first feedback; company is optional and browser remembers it. |
| AT-047 | BR-027, BR-028 · M06 | Two guests with different sessions comment on the same shared presentation, including through separate valid links to the same series. Each sees the other's external feedback. Internal production notes are absent from response payloads and UI. |
| AT-048 | BR-028 · M06 | Same candidate appears in Father and Manager. Preference on Father does not apply to Manager. Preference does not mutate Main/Backup/Option or Shortlist inclusion. |
| AT-049 | BR-028 · M06 | Guest starts a comment on V1 while V2 becomes ready. Submission remains tied to V1/assignment viewed. UI offers new-version notice without silently switching the composition underneath the draft. |
| AT-050 | BR-027 · M06 | Two different guest sessions use the same display name. Each can edit only its own permitted feedback. Display-name equality does not grant another session's edit rights. |
| AT-051 | BR-026, BR-029 · M06 | Revoke/expire link and retry page, feedback, media, and PDF endpoints. Each is denied appropriately. Token is absent from application logs, third-party referrers, and analytics payloads. |
| AT-052 | BR-029 · M06 | PDF is downloadable by default; external export shows Preparing PDF then ready with no AI rerun. Toggle download off and test prepare/download UI plus direct endpoints. New PDF access is denied, while already-downloaded PDF media grants continue under valid parent viewing access. The viewed version is what downloads. |
| AT-053 | BR-025, BR-027 · M06 | Attempt to read another project's library media, draft snapshot, internal notes, another series' versions, or another guest's private session through token/ID substitution. Access is denied without existence leaks. |
| AT-054 | BR-027, BR-029 · M06 | Mobile guest can read all fields, play video, navigate roles, comment with keyboard open, and download when allowed. No desktop-only hover control is needed. |
| AT-076 | BR-026, BR-029 · M06 | Extend parent expiry and reopen the same PDF: non-revoked grants follow the extension; separately revoked grants stay revoked. Rotate the review link: old URL/export media grants stop working and newly issued export uses new grants. Full URL is returned on creation/idempotent replay; later management does not reconstruct it from its digest. |

### G. Durable jobs, failures, and services

| ID | BR / milestone | Scenario and required result |
| --- | --- | --- |
| AT-055 | BR-034 · M03 | Start interrupted large-file upload, resume per supported protocol, close/reopen app, and finish. Existing uploaded bytes/results are reused; UI resumes from durable truth. |
| AT-056 | BR-033, BR-034 · M03 | Process a batch with successful, corrupt, and unsupported files. Successful candidates remain usable; failed files identify stage/reason and can be retried independently. |
| AT-057 | BR-033, BR-034 · M03/M05 | Simulate n8n/worker delivery duplication, callback retry, lost acknowledgment, and process restart. Idempotency prevents duplicate profiles, frame sets, and presentation versions. |
| AT-058 | BR-033, BR-034 · M03 | Commit upload metadata then interrupt dispatch. Durable outbox/lease recovery eventually starts the job once; a completed upload cannot remain stranded with a false success state. |
| AT-059 | BR-008, BR-017, BR-033 · M03 | AI produces malformed/refused/incomplete extraction or a retry completes after manual profile edit. Validation rejects bad output, and confirmed edits are not overwritten by a late scan. |
| AT-060 | BR-034 · M03/M07 | Run representative 200-video batch with bounded concurrency. Record actual duration, bytes, failures, queue latency, retry rate, and cost; do not call this 200 simultaneous requests or a guaranteed upper file-size limit. |
| AT-061 | BR-033, BR-036 · M03/M05 | Expire worker lease mid-task and submit forged/stale callback. Current authenticated job attempt only can commit the result; retries do not attach output to another project/candidate. |
| AT-062 | BR-036 · M03 | Supply extension/MIME mismatch, untrusted document text, malformed media, and oversize file. Server validates safely; embedded source instructions do not change system operations or expose other records. |

### H. API, MCP, deployment, and accessibility

| ID | BR / milestone | Scenario and required result |
| --- | --- | --- |
| AT-063 | BR-031, BR-035 · M07 | Inventory every meaningful UI operation against API and MCP catalogue. No UI-only profile confirmation, frame choice, position, generation, link management, or recovery action remains. |
| AT-064 | BR-031 · M07 | Claude authenticates as an authorized producer and performs the complete real workflow, including files/async waits, confirming Reviewed, generating PDF, and creating/revoking a link. No human-only gate is added because the caller is an agent. |
| AT-065 | BR-030, BR-031 · M07 | Claude with a contributor's capabilities receives the same denials as that contributor in the UI. It cannot use worker/service credentials or guest links to acquire stronger rights. |
| AT-066 | BR-031, BR-034 · M07 | Retry API/MCP create operations with same key/same body: original result returns; same key/different body: typed conflict. Pagination does not skip/duplicate records at stable cursors under contract. |
| AT-067 | BR-032 · M00/M07 | Apply coordinated migrations to local/staging copy of discovered schema and exercise existing shared-record workflows. Existing apps retain their tables/functions/policies and access. Record rollback/recovery evidence. |
| AT-068 | BR-033, BR-035 · M07 | Run staging with real Supabase, n8n Cloud, OpenAI, native worker, private assets, and authenticated MCP. A static demo or local-only mocked pipeline cannot pass this test. |
| AT-069 | BR-036 · M07 | Deploy replacement worker/API during queued jobs; verify graceful draining/retry and compatible contracts. Roll back application version without deleting completed user data. |
| AT-070 | BR-036 · M07 | Validate backup/restore and recovery procedure using nonproduction data. Restored DB metadata and asset references are reconciled; no claim that DB backup alone restores object bytes. |
| AT-071 | BR-022 · M01–M07 | Keyboard-only producer journey including role reorder and frame choice. Focus visible, modal return correct, save errors announced, no drag-only operation. |
| AT-072 | BR-018, BR-027 · M05/M06 | Assistive-technology spot-check for slide navigation, carousel state, preference group, comments, and video transcript. Automated accessibility scan supplements the manual journey. |
| AT-073 | BR-022, BR-027 · M01–M07 | Contrast, zoom/reflow, reduced motion, narrow viewport, long English names, and mixed Arabic/English source rendering. No critical controls disappear or overlap. |
| AT-074 | BR-024, BR-036 · M07 | Audit one real successful and one failed job end to end via correlation IDs, without secrets or full sensitive transcripts in logs. Producer error is actionable; operator can diagnose. |
| AT-075 | BR-001, BR-003, BR-005, BR-017 · M07 | Scope audit: no required Drive connector, competing project manager, billing, specs revision UI, fact-conflict manager, or unfinished other-module dependency has crept into release. |

## 5. AI quality evaluation

Create a small versioned evaluation set using authorized representative files: clear English introduction; Egyptian Arabic introduction; mixed-language introduction; noisy speech; missing measurements; self-correction; two similar names; unreadable document section; and a video with fewer than three distinct usable views. Keep an answer key prepared independently of the extraction result.

Measure, at minimum, whether each supplied field is extracted correctly; whether absent facts stay absent; whether English rendering preserves meaning; whether provenance points to the right source; whether every frame exists in the original video; whether selected views are distinct and usable; and whether manual corrections survive retries. Report per-case results, not a single unsupported “AI accuracy” claim.

No invented numeric launch threshold is assumed by this documentation pack. The initial safety/quality gate is **zero unsupported personal facts in the release evaluation set**, **zero synthetic or wrong-person frames**, and **no cross-project/profile corruption**. Extraction coverage and transcription quality must be measured and reviewed against the supplied material. A known difficult clip may use a manual correction path; a systemic silent-error pattern is a release blocker.

Do not derive candidate hiring suitability, attractiveness, personality, ethnicity, or other personal judgments from visual/voice signals. The agreed AI purpose is reading supplied casting information and preparing faithful assets and wording.

## 6. Performance and reliability evaluation

The 200-video scenario is an initial sizing target. M00/M03 must capture representative duration, codec, resolution, and file sizes before setting operational thresholds. In staging, report upload throughput, queue wait, median/p95 scan duration, frame-generation time, PDF generation time by page count, error/retry rate, memory pressure, and actual provider usage.

Set bounded concurrency based on observed service quotas and worker capacity. Producers should be able to use completed results while the rest of the batch runs. Measure UI responsiveness and pagination on a realistic shared library without loading all videos or full-resolution frames into the browser at once.

Treat expiration and generation race tests as correctness tests, not just performance tests. A fast PDF with another candidate's video or a leaked internal series is unacceptable.

## 7. Evidence and triage

For each test run record environment, app commit, schema/migration version, template version, workflow version, provider model identifier, fixture version, actor/capabilities, timestamps, result, and evidence links. Redact secrets and avoid placing real cast transcripts in a public repository.

Release blockers include wrong profile/media association; unsupported facts presented as supplied; broken source ownership; two Mains in a slot; incorrect inclusion; corrupted snapshots; cross-project access; guest internal-note leakage; unusable PDFs; nonfunctional real processing; and missing required Claude operation parity. Cosmetic defects with a documented workaround may be scheduled after the release only when they do not violate the approved presentation design or accessibility of a critical action.

Use `docs/quality/RELEASE_EVIDENCE.md` as the test evidence template. Keep the progress ledger factual: **Not run**, **Passed**, **Failed**, or **Blocked**, with a reason and next action. Never mark an acceptance case Passed because its code was written or because a mocked test returned a planned result.
