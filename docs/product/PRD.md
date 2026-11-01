# Product requirements — Everyone Presentation Studio

Version 1.0 • 27 October 2026 • Product specification for implementation

## 1. Purpose and outcome

Everyone Presentation Studio turns production requirements and supplied casting material into consistent, reviewable presentations. The first complete release covers Cast Selection and Cast Shortlist end to end: select a real business project, interpret casting specs, reuse or scan candidates, assign them to individual roles and slots, review the information, generate a presentation, collect feedback, and download a PDF. It preserves Everyone's presentation design while reducing repeated data entry and manual slide assembly.

The app is part of Everyone's business ecosystem. It uses the existing central Supabase database and project identity. It will be operated by internal users and by Claude through a complete API/MCP interface. Codex is the development agent; OpenAI supplies the app's embedded AI; n8n Cloud orchestrates background work. These are different responsibilities.

This document specifies intended behavior. The delivered HTML prototype demonstrates a user journey and has simulated AI; it is not a working production backend. The live database has not been inspected for this pack. No claims about achieved accuracy, throughput, user adoption, deployment, or cost are made.

## 2. Release scope

### Included in the first production release

- Central project creation and selection, permission-aware project/client editing, and client logo upload/reuse.
- Specs upload as PDF/Word or pasted text; extraction into editable role requirements and individual slots.
- Shared internal Cast Library with search/filter, media reuse, Unreviewed/Reviewed states, and possible-duplicate resolution.
- Multiple direct file uploads, persistent per-file progress, real video/audio preparation, OpenAI transcription and structured extraction, up to three selected actual frames per candidate, and retryable partial failure.
- Casting board with independent assignments, Option/Main/Backup positions, Selection, and explicit Shortlist.
- Final information and layout review; direct edits and contextual AI wording assistance.
- Deterministic branded cover/candidate/Pending layouts, browser presentation view and downloadable PDF.
- Immutable generated versions, audience presets, expiring guest review links, comments/preferences, and default PDF access.
- API/MCP parity for the complete user journey, service monitoring, recovery, migrations, and production acceptance.

### Later modules and excluded work

The app shell accommodates Wardrobe, Art Direction, Storyboard, vehicle/animal/options, fitting, pre-PPM/PPM and production documents. Users can select these types when creating a real central project; the saved project opens a Planned overview. Only Casting has a presentation workflow in this release.

V1 excludes Google Drive or other external ingestion connectors, billing, bookings/payments, an independent project-management product, a freeform slide editor, a specs revision/diff feature, and a dedicated candidate fact-conflict interface. Historical cast imports use normal upload/reuse paths; a separate migration product is not required. A revised specs manager and fact-conflict manager were explicitly declined.

## 3. Users and authority

| Actor | Job to accomplish | Access model |
|---|---|---|
| Producer | Build/review casting material, confirm reusable facts, decide options, deliver and manage review | Authorized project access plus relevant capabilities; can correct library facts and mark Reviewed |
| Designated casting editor | Prepare and maintain cast data, media and casting assignments | Same shared-fact editing/review authority when designated; mapped to existing business roles in M00 |
| Contributor | Upload and prepare permitted project work | May prepare work under assigned capabilities; does not automatically gain shared-fact confirmation |
| Approved internal casting user | Reuse/search shared historical cast | Library search/read permission independent from project access |
| External reviewer | Review a specific shared presentation, state preferences, comment, download when allowed | Bearer link; no account/sign-in; name before first feedback |
| Claude | Carry out the complete app workflow on behalf of a user | Exactly the acting user's permissions; no agent-specific human approval barrier |
| Operations/admin | Configure services and recover failed work | Mapped capabilities; administrative title is not automatic access to every business project |

Concrete role names and membership tables are discovered in M00. Capabilities in [CONTRACT_BASELINE.md](../../CONTRACT_BASELINE.md) are the implementation contract. External reviewer names are self-declared labels, not verified identities.

## 4. User journey

### Project

The user opens Projects and selects an authorized central project or creates one with a name, presentation type and optional authorized existing client. Creation requires projects.read and projects.write and writes the canonical business records, including the creator's project membership. The saved overview starts/resumes Casting through the existing workspace operation, or clearly labels a future type Planned. The workspace displays central project/client details. Authorized corrections update those shared records. The Project tab supports uploading a client logo, replacing/removing the workspace selection, and choosing cover-only or every-slide placement. New generated versions capture branding, so later logo changes do not rewrite history.

Project connection is required in production. Other missing presentation content remains allowed. The earlier prototype's ability to skip every step is a testing convenience, not a bypass of production permissions or referential integrity.

### Specs

The user uploads a PDF or Word document, or pastes text. The app creates an extraction job and shows progress. The resulting draft has role names, people required, classification, scene references, age range, gender requirement, appearance/performance requirements, languages/accents/skills, shoot dates/location/availability, and other instructions. Missing or ambiguous fields are marked Needs clarification. The user can correct them while working, without a mandatory questionnaire.

Headcount creates named slots: Waiter 1, Waiter 2, Waiter 3. A role may span multiple scenes. Scene appearances do not automatically multiply headcount. For unknown count, the recommended default is one provisional slot marked Needs clarification, visibly editable; this is a technical/product default, not evidence that the sheet specified one person. Decreasing count with assigned slots requires showing which assignments are affected; never discard assignments silently.

### Candidates

The user opens the library with filters suggested from the current role and can adjust/clear them. Filters operate on supplied profile data: age/range, stated gender, height/measurements, languages/accents, skills, city, previous roles/projects and recorded classification. Missing values are not invented or treated as matching evidence.

Alternatively the user uploads one video per candidate, normally an introduction/interview. Processing preserves the original-language transcript and derives English candidate information only from supplied evidence. It chooses up to three clear, distinct, representative actual frames. The user can inspect/edit facts, select different source timestamps, reorder frames, accept fewer frames, or replace media. Silent/noisy video may still yield usable frames with missing textual facts. Unsupported or corrupt media fails independently.

Scanned new profiles enter the shared library as Unreviewed immediately after a valid profile is saved; final-review confirmation marks Reviewed. Possible matches are shown for explicit attachment to an existing candidate or creation of a new one. Do not silently merge identities or use face recognition to identify people. Saved project material is reused unless fresh material is required.

### Casting

Each role contains its individual slots and their candidates. One person may be considered for multiple roles independently. Assignments start as Option. Each slot allows zero or one Main, multiple Backups and multiple Options. The recommended Main replacement interaction demotes the former Main to Backup atomically and offers Undo.

Selection always contains all active assigned candidates. Shortlist is an explicit per-assignment inclusion flag. Main does not automatically mean Shortlist, and a shortlisted Option is valid. Adding a person directly to Shortlist creates the underlying assignment, so that person also appears in Selection. The unassigned project pool is not part of Selection.

### Review

The user checks role requirements, assignments, candidate facts, chosen frames, availability, slide wording and missing values before generating. Corrections to reusable facts update the shared library or discovered canonical field. Project availability and presentation-specific notes remain project/assignment data. Slide wording is a separate display override and does not silently shorten the stored full profile.

Missing fields, Unreviewed profiles, fewer frames, open slots and no Main are visible warnings, not blanket blockers. If content overflows the single-page layout, the producer edits wording or applies an optional AI suggestion. No hidden clipping, omitted fields or unexpected extra candidate pages are allowed. Production integrity errors (invalid project, lost access, unreadable render asset) are actionable failures rather than facts to pretend are complete.

### Presentation

The user selects Selection or Shortlist, chooses an audience preset, and generates. A fixed snapshot is captured, then rendered in the background. The previous successful version remains available if the new render fails. A ready version can be viewed, shared and downloaded as PDF. New files and corrections update the working draft and show a change summary; they never rewrite a ready version or silently change explicit casting choices.

## 5. Exact presentation contract

| Page type | Required content |
|---|---|
| Cover | Project/client identity, output type, version/date, Everyone design, selected client logo |
| Candidate | One page for each included assignment, role/slot context, position, selected frames and all ten fields below |
| Pending | One page for a slot with no candidates in the selected output, showing its requirements and Pending status |

The ten candidate fields are: name or casting ID; age or stated range; height or other supplied measurements; languages and accents; skills/performance experience; city/usual location; previous projects/roles; classification; current-project availability; presentation-specific notes. Every absent field displays **Not provided**. Gender is a library/search field, not an additional agreed candidate-page field.

The browser uses a photo carousel. PDF shows all available selected frames together on one candidate page. The same person in two slots receives two pages. Slots containing only Options are not empty. An empty Shortlist slot gets Pending even when Selection has candidates. Order follows explicit role, slot and assignment ordering, not incidental database insertion order. English labels and candidate display information are required; original Arabic/mixed source remains available internally.

The template must implement the current content contract while preserving Everyone's existing visual design. The Market Radar design reference contributes brand/UI tokens; it is not a casting slide specification. The existing casting PDFs are visual references, not permission to revert to their older side-by-side Main/Backup composition.

## 6. Review and delivery rules

Every presentation series has one output and audience scope. A review link follows the newest successfully ready version of that series. Working drafts, failed renders, another output type or an internal-audience series must never replace the guest view. Version numbering and ready-pointer updates must handle jobs completing out of order.

Links default to 30 days and support revocation and expiry changes. The recommended clock starts at creation and does not renew on generation. A valid link permits immediate viewing. Before first comment/preference the guest supplies a name; company is optional. The browser may remember that label. All external reviewers of the same series can see each other's external comments/preferences, even through different links; internal notes remain private. Feedback records the version and assignment snapshot actually viewed.

Preferences are Preferred, Maybe, or Not preferred. They do not change Option/Main/Backup. PDF downloads are enabled by default and can be disabled per link. A downloaded PDF is a fixed document. Its video links identify its original version/media and recheck access through the app; they must not be storage URLs that expire independently in the PDF. Revoking a link stops future authorized requests; it cannot erase an already downloaded PDF or buffered media.

## 7. AI boundaries and user control

AI extracts supplied facts, translates them for English output, suggests filters and selects technical frame candidates, and helps shorten slide wording. It must not infer age, gender, ethnicity, health, identity or suitability from appearance; fill missing fields using the role requirements; rank candidates for casting automatically; or decide Shortlist inclusion from inferred preferences. Explicit source selections and producer/Claude choices drive inclusion.

Source text is untrusted input, never an instruction to invoke tools, export data, bypass access or modify the app. Extracted values retain a source reference and uncertainty when applicable. Structured-output validation protects shape, not factual truth. An authorized actor can correct and confirm values. Providers, prompts and schema versions are recorded so failures can be reproduced without dumping private transcripts into ordinary logs.

## 8. Operational and quality requirements

Target batch sizing is up to 200 candidate videos, with actual concurrency set through measurement and provider quotas. A 200-file batch is not a requirement to process 200 files simultaneously. Uploads support progress, interrupted-transfer recovery and independent errors. Closing a tab does not cancel server jobs. Retrying a stage cannot duplicate profiles, assignments, versions or notifications.

The app must support keyboard operation, clear focus and status text, responsive guest review on mobile, readable original Arabic text, and robust autosave/error recovery. Internal desktop/tablet workflow is the primary production editing surface; mobile must not expose clipped or inaccessible controls. App/server/worker logs correlate by request/job IDs. They exclude bearer links, tokens, full transcripts and credentials.

Release requires real integrated tests through Supabase, OpenAI, n8n, worker, rendering and Claude/MCP, plus domain and permission tests. Mocks are useful for deterministic tests but are not proof of live integrations. Performance and extraction quality must be measured on authorized representative files before declaring production readiness. Proposed service targets and measurements are in the operations and quality docs; no fabricated service-level achievement is claimed.

## 9. Success measures

Track time from first upload to editable draft and ready PDF; active producer effort per presentation; extraction correction rate on labelled samples; per-stage failure/retry rate; cost per processed minute/candidate/deck; review completion and use of preferences; and percentage of meaningful UI operations covered by API/MCP. Store technical usage without making it a billing product. Record baseline measurements during pilot use before setting promises or ROI claims.

## 10. Requirement authority and completion

Stable rules BR-001–BR-036 in [the contract baseline](../../CONTRACT_BASELINE.md) are traced to acceptance tests in [the quality plan](../quality/TEST_STRATEGY.md). The source decisions, recommended defaults and unresolved discovery inputs are recorded in [DECISIONS.md](../../tracking/DECISIONS.md). M00–M07 implement the release in dependency order; each packet repeats the business rules relevant to its work and lists the exact companion contracts to load.

Completion means a permitted human and Claude can independently carry out the real full journey using the same stored data and business rules, while an external reviewer can consume the intended version safely and reliably. A polished prototype or mocked generation button does not satisfy that outcome.
