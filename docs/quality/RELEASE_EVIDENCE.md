# Release evidence and test-data runbook

**Current state: production release unverified.** M00 discovery is verified after the owner designated the empty project as canonical. Three M01 migrations are applied/read back in cloud and local PostgreSQL; actual role/RLS/race checks and central anonymous UI checks pass. See [cloud foundation](../../tracking/evidence/cloud-foundation/readback.json), [discovery](../../tracking/discovery/README.md), [local UI evidence](../../tracking/evidence/m01/UI_VERIFICATION.md), [operation delivery](../integrations/IMPLEMENTATION_PARITY.md) and [progress](../../PROGRESS.md). Actual Producer/project sign-in/writeback and private central uploads are incomplete. Isolated M02 tests do not prove a connected service pipeline. No real AI evaluation, authenticated Claude/MCP journey, production PDF, app deployment or full release journey is claimed. The remaining sections retain the release requirements.

## 1. Release identity

| Item | Evidence to record |
| --- | --- |
| Release / candidate version | App release identifier and source commit. |
| Tested environment | Local, integration, or staging; stable environment identifier without secrets. |
| Test run dates | UTC timestamps plus user-facing Africa/Cairo display where needed. |
| Schema and migrations | Central schema mapping version and exact applied migration IDs. |
| Template | Template ID/version, bundled font version/checksum, approved reference. |
| API and MCP | OpenAPI/catalog versions, actual MCP protocol/SDK version, tested clients. |
| Workflow | n8n workflow versions/IDs and worker image/revision. |
| AI | Actual model identifiers and prompt/schema versions. |
| Data | Fixture version and authorized representative media set reference. |
| Operators | Acting user/capabilities for producer, contributor, administrator, guest, and Claude tests. |
| Result | Not run / Passed / Failed / Blocked, with evidence and remaining work. |

Never copy service credentials, bearer review tokens, private source URLs, full real transcripts, or private personal data into the public repository's evidence file. Store permitted artifacts in a controlled test-evidence location and record access-scoped references.

## 2. Required evidence groups

| Group | Acceptance cases | Status at document creation | Minimum evidence |
| --- | --- | --- | --- |
| Discovery and shared DB compatibility | AT-001–005, AT-067 | Not run | Read-only discovery report; mapping; migration diff; local/staging compatibility tests. |
| Producer workflow and persistence | AT-006–014, AT-025–034 | Not run | Actual browser journey with server-backed state; reload; shared-name write; independent assignment assertions. |
| Real source processing | AT-015–024, AT-055–062 | Not run | Representative actual files; input/expected/result comparison; job traces; frame source timestamps; partial failure and retry. |
| Presentation and PDF | AT-035–044 | Not run | Ordered manifests; opened actual PDFs; rendered pages; historical snapshot and link playback tests. |
| External review | AT-045–054, AT-076 | Not run | Clean-browser access; two-guest feedback; mobile review; expiry/revoke/direct-endpoint tests. |
| Full API/MCP parity | AT-063–066 | Not run | Operation coverage matrix and real authenticated Claude run under producer and restricted capabilities. |
| Production operations | AT-068–070, AT-074–075 | Not run | Real staging topology; deployment/recovery rehearsal; observability; scope check. |
| Accessibility | AT-071–073 | Not run | Keyboard journey; manual screen-reader spot-check; actual contrast/reflow and automation reports. |

Update this table with links to results, not just ticks. A blocked credential or unavailable external service is **Blocked**, not Passed and not silently replaced by a mock.

## 3. Producer end-to-end demonstration

Use a fresh authorized test project that already exists in the central-system staging dataset. The full demonstration must include these actions in one coherent persisted workspace:

1. Sign in; select the central project; start or resume Casting.
2. Change a permitted shared project/client field and confirm the canonical record changes.
3. Upload the client logo and choose cover-only or every-slide placement.
4. Upload a representative PDF/Word specs sheet or paste text; inspect extracted roles; correct an unclear field.
5. Confirm that headcount creates individual slots and multi-scene roles are not duplicated.
6. Reuse one candidate from the shared library; upload at least two real authorized introduction videos, including Arabic or mixed language.
7. Watch durable per-file processing, inspect original transcript and extracted facts, confirm actual chosen frames, and resolve one possible duplicate explicitly.
8. Correct a reusable fact and confirm one profile Reviewed as an authorized actor. Change a reusable canonical fact through the connected test app and verify Unreviewed until reconfirmed; project-availability or template-only changes must not reset that status.
9. Assign the same candidate to two roles with different positions/notes; leave one slot open; preserve an Option without a Main.
10. Include only selected assignments in Shortlist, proving Selection is derived from all assignments.
11. Shorten an overlong slide field while preserving its full library value.
12. Choose Selection/Shortlist and audience before final review, create/reuse the scoped series, and fetch preflight. Change relevant canonical data outside the workspace and verify stale preflight is rejected until refreshed. Generate each output from matching current review; open the actual PDFs and verify page content and links.
13. Create an external review link with default 30-day expiry and download enabled.
14. Open the link in a separate clean browser; view immediately; supply a self-declared name only when commenting; record a preference.
15. Open as a second guest; verify both see external feedback and neither sees internal notes.
16. Change the working candidate media or facts and generate a newer version. Verify current review link advances only after readiness, old feedback retains its version, and the old PDF plays original media in a new browser while authorized.
17. Disable new PDF download and confirm the already-downloaded PDF still plays its original media while parent viewing remains valid. Extend expiry and verify the same PDF follows the intended extended access. Then revoke/rotate the link and confirm prior media access is denied; exercise direct API routes too.
18. Reopen the producer workspace after a browser refresh. Work, versions, jobs, feedback, and audit records remain coherent.

Record exact results and defects. A narrated product video without checking saved data, actual file bytes, and access boundaries is not enough evidence.

## 4. Claude end-to-end demonstration

Use the documented authenticated MCP connection, with a test acting-user identity. Do not give Claude a service-role database credential or internal worker credential to bypass normal permissions.

Claude must be able to discover the tool catalogue, find an accessible project, create/resume workspace, obtain upload sessions and supply actual file bytes using the documented transfer mechanism, start processing, poll durable jobs, inspect result data, update roles, resolve duplicate choices, select frames, edit/confirm candidate information, assign positions and Shortlist, generate/download, create/manage review links, and inspect available feedback.

Record each meaningful UI operation and its actual MCP tool/HTTP operation mapping. An operation is not covered merely because a generic “execute arbitrary SQL” tool could theoretically do it. The app's typed domain operations are the supported integration.

Repeat a restricted subset as a contributor or non-casting user. The same domain permission denials must apply. The producer-capable Claude should not encounter an artificial human-only confirmation gate. Any real destructive-operation confirmation follows the same policy/UI rule as the acting user, not the caller's identity as an agent.

## 5. Test-data preparation

### Synthetic deterministic data

Use `fixtures/casting-happy-path.json` and `fixtures/casting-edge-cases.json`. They contain fictional people and domain aliases. Map aliases through factories to valid UUIDs and the discovered central identity tables. Keep data creation idempotent within a test environment so rerunning setup does not multiply projects/profiles.

The plain-text source specs/transcripts are author-written synthetic inputs. A document fixture builder may convert source specs into `.docx` and PDF to exercise equivalent extraction. Keep those generated files clearly labeled synthetic. Do not claim that synthetic text validates performance on real production scans, handwriting, noisy audio, or heterogeneous Word formatting.

Generate technical video fixtures with obvious test markers for codec/rotation/silence/corruption cases. A solid-color clip is sufficient to test storage and decoding, but cannot validate identity speech extraction, distinct representative views, or cast-frame quality. Keep these scopes separate in the evidence.

### Representative real material

Before declaring AI/media quality ready, use authorized production-like samples covering English, Arabic, mixed language, duration/size variation, common codecs/orientation, noisy intros, missing fields, and insufficient usable views. Record authorization/data handling and a dataset reference in the private test area. Do not place raw real casting material in public code fixtures.

Prepare expected facts manually and independently. For every field, classify as **supplied**, **not supplied**, or **unclear**; compare extraction against that answer key. A comparison between two AI outputs is not independent ground truth.

### Failure injection

Use deterministic injected failures at upload completion, outbox dispatch, provider call, worker lease, callback authentication, result validation, asset write, and PDF readiness. For each, confirm durable state, retry behavior, and no duplicated profile/version. Remove injection flags from production configuration and demonstrate that diagnostics identify the failed stage without leaking secrets.

## 6. Visual evidence record

For each final template version, save rendered examples for cover, candidate, Pending, 3/2/1/0 frames, long/short/missing fields, long candidate/role names, and logo variants. Open the generated PDF separately from the app preview. Record both manifest results and visual inspection notes.

| Fixture | App viewer | PDF opened | Page/order/text | Video link | Result |
| --- | --- | --- | --- | --- | --- |
| Happy-path Selection: 8 pages | Not run | Not run | Not run | Not run | Not run |
| Happy-path Shortlist: 6 pages | Not run | Not run | Not run | Not run | Not run |
| No assignments: 6 pages | Not run | Not run | Not run | N/A | Not run |
| No roles: cover + pending summary | Not run | Not run | Not run | N/A | Not run |
| Long text repaired in review | Not run | Not run | Not run | Not run | Not run |
| Two / one / zero frame variants | Not run | Not run | Not run | Not run | Not run |
| Cover-only / every-slide logo | Not run | Not run | Not run | Not run | Not run |
| Historical V1 after edited V2 | Not run | Not run | Not run | Not run | Not run |
| External PDF in fresh browser | Not run | Not run | Not run | Not run | Not run |

## 7. Performance evidence record

Do not replace measured values with estimates in this table.

| Measurement | Dataset/environment | Measured value | Interpretation / action |
| --- | --- | --- | --- |
| Input videos, total bytes, durations, codecs | Not run | Not measured | Required to interpret every duration/cost result. |
| Upload completion and resume rate | Not run | Not measured | Distinguish browser/network failures from server processing. |
| Queue wait and per-video processing p50/p95 | Not run | Not measured | Include configured concurrency and provider quotas. |
| Partial failures and successful retry rate | Not run | Not measured | Verify completed files remain usable. |
| Frame extraction/selection duration | Not run | Not measured | Include video resolution and sampled frame count. |
| PDF time by candidate/page count | Not run | Not measured | Include template/assets/font version. |
| 200-video batch completion and cost | Not run | Not measured | Initial sizing scenario; not promised max concurrency. |
| Mobile guest page/video load | Not run | Not measured | Record browser/network conditions. |
| Provider usage/cost reconciliation | Not run | Not measured | Actual model pricing/config as tested, no invented cost estimate. |

## 8. Release decision and remaining work

Release recommendation stays **Not assessed** until evidence is attached. List each unresolved issue with severity, user impact, owner, workaround if any, and next action. Distinguish a product decision from an infrastructure dependency. Do not restart a broad questionnaire for ordinary engineering choices that already have documented defaults.

The release gate requires: no unresolved critical data/access corruption; complete agreed casting output behavior; real service journey; valid usable PDF; full required Claude/API parity; supported guest feedback/download rules; and operational recovery evidence. A known blocked integration must be disclosed explicitly. The final handoff records what was tested, what remains limited, and how to run/deploy/recover the actual implementation.
