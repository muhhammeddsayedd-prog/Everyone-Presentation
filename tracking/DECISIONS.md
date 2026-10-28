# Decision register

Version 1.0 • 27 October 2026

This file separates confirmed product decisions from implementation defaults and discovery dependencies. Statuses: **Confirmed** (user stated), **Default** (concrete recommendation to build unless discovery requires adaptation), **Discovery** (external fact not yet observed), **Deferred** (intentionally outside v1). Do not convert an unanswered questionnaire item into a confirmed decision. Add new rows with date, reason, affected files and evidence; never erase superseded decisions without history.

## Confirmed product decisions

| ID | Decision | Consequence |
|---|---|---|
| D-001 | Casting first, Selection + Shortlist connected | One workspace; distinct output inclusion rules |
| D-002 | Existing central project required before generation work | No provisional unlinked production workspace |
| D-003 | Project tab supports client logo | Brand asset selected for rendered presentation |
| D-004 | Authorized project/client edits update shared business records | No presentation-only name override feature |
| D-005 | Direct multi-file upload and internal library for initial release | Earlier external Google Drive source idea superseded |
| D-006 | Specs PDF/Word/text; parse then correct | Missing requirements remain editable Needs clarification |
| D-007 | Specs stable; no revision feature | Do not build spec diff/reconciliation manager |
| D-008 | Individual slots for multiple people | Waiter 1/2/3, not undifferentiated headcount |
| D-009 | Reuse historical media unless project requires fresh material | Pin selected source per project candidate |
| D-010 | One candidate per intro video; original information extracted | No automatic multi-person video identity separation |
| D-011 | Up to three clear distinct actual frames; fewer acceptable | No forced front/profile/body pattern; no generated candidate images |
| D-012 | New scanned profiles immediately Unreviewed and reusable | Confirmation later marks Reviewed |
| D-013 | Possible duplicate decision explicit | Attach existing or create new, no automatic identity merge |
| D-014 | Same candidate can be in several roles independently | Assignment-level position/inclusion/notes |
| D-015 | Option initial; zero/one Main, many Backups and Options | Database and transactional enforcement |
| D-016 | Selection all assigned; Shortlist explicit | Position never automatically sets Shortlist |
| D-017 | Missing data and open/undecided slots allowed | Not provided fields and Pending pages |
| D-018 | Confirmed reusable corrections save to shared profile | Display-only shortening is a different edit |
| D-019 | No fact-conflict feature | Normal editing plus technical concurrency protection |
| D-020 | One candidate page per assignment, repeated per slot | App carousel; PDF frames together |
| D-021 | All ten supplied-information fields shown; English labels | Missing values Not provided; no silent omissions |
| D-022 | Long wording flagged and manually edited, optional AI help | No automatic hidden truncation |
| D-023 | Choose audience presets per presentation version | Scope ready versions and sharing by audience |
| D-024 | Link opens newest generated version | Only newest ready in same presentation/output/audience |
| D-025 | Guest bearer links, no sign-in, 30 days | Self-declared name before feedback; company optional |
| D-026 | All external feedback visible to reviewers of same presentation | Internal notes remain private; no audience-private external threads within same series |
| D-027 | Preferences Preferred/Maybe/Not preferred plus comments | Separate from casting decisions; version-specific |
| D-028 | Guest PDF download on by default; switch off per link | Access policy enforced at request |
| D-029 | Shared Everyone library for approved internal casting users | Reuse across projects; shared-fact edits/review producers/designated editors |
| D-030 | English default; Arabic/English/mixed source support | Preserve original transcript; English output |
| D-031 | Batch planning up to 200 videos | Sizing target, not simultaneous jobs/hard file limit |
| D-032 | Existing Supabase; Codex discovers and develops locally | Reuse shared entities; coordinated tested migrations |
| D-033 | OpenAI embedded AI; existing n8n Cloud operations | Separate native worker for unsupported heavy runtime work |
| D-034 | Claude full user-equivalent app operation | No human-only approval for shared-fact confirmation, generation or link management |
| D-035 | Full API/MCP before production | Shared service operations throughout feature development |
| D-036 | Brainstorm first, then documents | This pack now requested; no need further product questionnaire |

## Implementation defaults adopted for this pack

| ID | Default | Rationale / change rule |
|---|---|---|
| A-001 | Next.js/React/TypeScript web/API, separate container worker | Fits chosen integrations; M00 pins supported runtime versions |
| A-002 | Private eps schema and identity-only bindings where needed | Avoid accidental anonymous exposure and duplicated central truth; adapt physical FKs after inspection |
| A-003 | One Casting workspace per canonical project | Matches connected workflow; don't introduce multi-workspace UI without a real need |
| A-004 | Main replacement demotes previous Main to Backup atomically and offers Undo | Maintains max-one rule without deleting candidate |
| A-005 | Role → slot → explicit assignment ordering | Avoid unexpected ordering changes when position changes |
| A-006 | Client logo cover-only by default; every-slide option | Preserves delivered prototype interaction; generated snapshot captures choice |
| A-007 | Thirty-day link expiry measured from creation; generation never renews it | Makes expiry predictable and independent from content updates |
| A-008 | Separate scoped series for each output/audience policy | Prevents internal version leak through external latest link |
| A-009 | Empty specs count gets provisional slot with clarification; no roles gets pending-requirements page | Preserves nonblocking content flow without asserting invented requirements |
| A-010 | No-frame candidate can use honest image placeholder after explicit acknowledgement | Missing content allowed; do not invent imagery or claim successful extraction |
| A-011 | Canonical PDF plus link-scoped guest export variant | Fixed layout/content; guest-specific media authorization works before/after link creation and across browsers |
| A-012 | Hashed fixed-version media grants tied to parent review links | PDF video access honors original version, expiry/revoke without expiring storage URLs |
| A-013 | Existing suitable business hosting/auth reused; vendor choice deferred to discovery | User did not answer hosting question; do not invent approval or replace ecosystem |
| A-014 | Normal upload flow imports historical cast; existing suitable records reused | User did not choose a separate historical import product |
| A-015 | Test intended conversational Claude client and Claude Code when available | Client versions/features/access discovered; not a promised unsupported client |
| A-016 | Archive entities with live/historical references; no automatic cast/video purge | 30 days is review-link expiry, not a media-retention instruction |

## Discovery inputs and how to proceed

| ID | Input not yet observed | Owner/action | If temporarily unavailable |
|---|---|---|---|
| X-001 | Live Supabase schema and migration history | Codex M00 read-only inventory using provided authorized access | Build labelled local synthetic adapter; cannot mark cloud integration verified |
| X-002 | Canonical auth, memberships, capability source | Codex M00 mapping and permission tests | Local actors only; production auth remains blocked |
| X-003 | Existing hosting/CI/CD and worker capacity | Codex M00 environment inventory | Container/local runtime; no unapproved purchase |
| X-004 | Final production logo/font/template assets | Locate available references; use prototype layout contract; log exact asset gaps | Use clearly labelled placeholder fonts/assets locally; cannot claim design fidelity |
| X-005 | Representative specs and English/Arabic/mixed videos | Authorized pilot material for M02/M03/M07 evaluation | Synthetic fixtures for tests, no claimed extraction accuracy |
| X-006 | OpenAI credentials/quotas/models and n8n workflow access | Secure environment setup, real integration proof | Continue deterministic tests; mark real-service checks not run |
| X-007 | Media retention and business backup objectives | Apply existing business policy; record in operations inventory | Archive referenced records, no unrequested destructive purge |
| X-008 | Exact Claude clients/auth capabilities | M07 real connection testing | Complete protocol contract locally; list client-specific blocker |

No questionnaire is needed to settle the product flow. Ask only if a discovered incompatibility requires a consequential business choice that cannot be resolved from this pack or existing ecosystem evidence. Record a proposed solution and completed unaffected work with that request.

## Amendment log

| Date | Change | Status |
|---|---|---|
| 2026-10-27 | Consolidated conversation into BR-001–BR-036 and this register | Documentation complete; implementation not started |
| 2026-10-27 | Resolved external PDF playback lifecycle with link-scoped exports and fixed-version hashed grants | Implementation default, preserves user-requested behavior |
| 2026-10-28 | Installed all 53 supplied Claude skills project-locally for Codex in `.agents/skills/`, retaining originals and SHA256 provenance; project contracts and existing authorization override generic skill instructions | User-requested development setup; app milestones unchanged; see `SKILLS_SETUP.md` and `SKILLS_LOCK.json` |
| 2026-10-28 | Start a new local npm workspace in the supplied pack, preserving all source contracts/assets; initialize Git without a remote | No prior app or Git history existed; authorized implementation |
| 2026-10-28 | Use the explicitly development-only persistent synthetic canonical adapter until the actual central source is identified; deny fixture mode on either production environment signal and staging | Required fallback, never a replacement production database; M01 acceptance remains unverified |
| 2026-10-28 | Pin Node 24.18.0, npm 11.16.0, Next 16.4.3, React 19.3.1 and TypeScript 6.0.3; use ESLint 10 with compatible direct TypeScript/React/Next plugins | Official docs and registry checked; initial TS 7 compiler-API lint incompatibility corrected, no peer override retained |
| 2026-10-28 | Preserve the user's CLI link to `Everyone-Presentation`; inspect only metadata and non-personal service counts read-only | Observed empty business/auth/storage state; no schema/auth/storage mutation |
| 2026-10-28 | Keep canonical-source decision open: identify the existing central database or obtain explicit direction to make this new empty project central | Consequential discovered mismatch; asked the owner while unaffected local work continues; no changed product requirement assumed |
| 2026-10-28 | Treat M02 jobs/provider/document packages as independent preparation until a central transactional repository, service identities and scoped asset operations connect them | Deterministic adapter tests and synthetic binary parsing are distinct from provider and durable DB acceptance |
| 2026-10-28 | Retain session-bearing failed-browser traces under ignored `.local/private-test-traces/`, recording only SHA256/path receipts; disable future network traces | Preserve historical failures without committing development authentication cookies |
| 2026-10-28 | Product owner explicitly confirmed using the inspected empty `Everyone-Presentation` Supabase project as the canonical system | Supersedes the prerequisite to find pre-existing business tables. Establish additive canonical clients/projects/auth membership and one coordinated migration history here; existing-project-before-workspace and all permission/versioning rules still apply. No invented real projects/users or cloud seed/reset. Local schema/role proof precedes cloud migration application. |
| 2026-10-28 | Applied/read back the three reviewed M01 canonical migrations after real local role/RLS and two-session race proof; enabled only the authoritative root migration source, seeds disabled, Vault sync skipped | Authorized new canonical foundation; source hashes and actual cloud receipts in tracking/evidence/cloud-foundation; production app acceptance remains separate |
| 2026-10-28 | Correct managed Auth access through narrow one-way authenticated inheritance and preserve the original migration with two additive forward fixes | Real cloud/local grantability matched; no managed Auth owner/RLS changes; no reverse user-to-owner membership |
| 2026-10-28 | Configure only the localhost development site's canonical127.0.0.1 URL and exact PKCE callback allowlist; preserve confirmation/provider/MFA settings | Exact reviewed two-field diff, applied and read back; no email, auth user or business fixture created |
| 2026-10-28 | Keep dynamic fixture-file access outside Turbopack's source dependency graph; Node24 loads the typed workspace as a server external | A reproducible refresh loop was resolved and actual central anonymous browser/API, build and fixture tests pass; no production serving claim |
| 2026-10-28 | Closed upload sessions return `upload_url:null` and empty transfer headers; only open sessions carry a scoped URL | Corrected OpenAPI, MCP schemas, runtime schema, typed domain and UI guard. Creation replay projects current reservation state; no new transfer credential is minted for closed sessions. Red/green domain and contract checks recorded. |
| 2026-10-28 | Keep the supplied `MANIFEST.json` as historical provenance; package current Git-eligible source into ignored `dist/` with a separate archive manifest | The former recursive packager was unsafe after runtime/private directories were introduced. Explicit private/generated path guards and source-root checks now preserve runtime secrets and the original parent archive. |
| 2026-10-28 | Retain and review twelve intentional authenticated security-definer advisor warnings | Fixed empty search paths, narrow nonlogin/non-BYPASSRLS owner, forced RLS and scoped transaction functions are deliberate. See tracking/evidence/cloud-foundation/security-advisor-review.md; no zero-warning claim. |
