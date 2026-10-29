# M02 written acceptance checkpoint

Initial assessment 2026-10-29T09:36Z against [the M02 packet](../../../milestones/M02_SPECS.md),
with the passed PDF-vision acceptance follow-up below, observed on
2026-10-29T10:28:12.764925Z. Required M02 input/processing/editing/recovery proof
is now present. Hosting is deferred; the final combined repository checks and
milestone ledger remain the root's separate closeout. This matrix distinguishes
actual integrations from deterministic contracts and later milestone obligations.

| Written requirement | Evidence and scope |
|---|---|
| Text, PDF and supported Word through real pipeline | Actual signed-in text processing and [PDF/DOCX canonical metadata](live-specs-files/2026-10-29T07-27-45-389593+00-00-f054a457-metadata.json); PDF3384 and DOCX3286 OpenAI tokens. The [two-page image-only PDF acceptance](live-pdf-vision/2026-10-29T10-28-12-764925+00-00-2e8ab32d-readback.json) passes all10 checks through native rasterization, OpenAI OCR/extraction and n8n. Originals/private preparation and grounded references retained. Legacy `.doc` has explicit DOCX/text-rich-PDF/pasted-text conversion guidance, as permitted by the packet. |
| Correct roles/counts/individual slots; repeated scenes do not multiply people | [Live file cases](live-specs-files/2026-10-29T07-27-45-389593+00-00-f054a457-metadata.json) produced3roles/5slots. `tests/domain/specs.test.ts` covers repeated scenes, explicit order and slot identity; [historical local database proof](specs-local/2026-10-28T19-06-45-233Z-5698a461.json) is independently labelled SQL/synthetic. |
| Missing/ambiguous count, age and date remain unknown with clarifications | [Actual recovery case](service-http-probe/2026-10-29T09-30-49Z-real-recovery.json) retained unknown headcount/age/gender/category,7clarifications,1clearly provisional slot and an unresolved relative Friday; it did not invent a date. [App screenshot](service-http-probe/browser/recovered-specs.png). |
| Arabic/mixed original survives; normalized output grounded | Actual DOCX Arabic paragraphs and source references in [file proof](live-specs-files/2026-10-29T07-27-45-389593+00-00-f054a457-metadata.json); recovery case preserved Arabic and original source hash. This is labelled sample evidence, not a measured production accuracy rate. |
| Reload/process continuation, duplicate submission/callback, durable outbox recovery | Actual [app/worker restart](live-specs-restart/2026-10-29T01-20-45-384033+00-00-7529509b-metadata.json), [same-key HTTP lease replay after real web restart](service-http-probe/2026-10-29T09-24-08-943Z-1c4f9f3d-phase2.json), heartbeat duplicate and changed-input rejection. [Actual retryable failure/recovery](service-http-probe/2026-10-29T09-30-49Z-real-recovery.json) completed three stages through worker/n8n/OpenAI2233tokens, with exactly1stored heartbeat and1deliberate failure. Generation1became obsolete/dead; generations2–4delivered. [Historical SQL durability/races](local/2026-10-28T19-05-03-586Z-35d591fb.json) and job tests separately cover deterministic failure windows; a controlled worker stop is not relabelled an uncontrolled crash. |
| Pending manual correction protected from late extraction | [Actual manual-edit comparison](specs-protection/manual-edit-comparison.json): real3152-token extraction retained the manual note, every old role/slot and earlier origin; b3f90268 remains intentionally waiting_for_input/INPUT_CHANGED. [Reload proof](specs-protection/reload-verification.json). No auto-retry or erasure. |
| Corrupt/unsupported input isolated; manual editing/other work remains usable | [Actual corrupt-file proof](specs-protection/corrupt-file-verification.json): no new job or spec/role/slot change; original remains private/unready, and manual editing remains available. Its earlier AX comparison failure is retained. No unsupported HTTP422 claim. |
| Incomplete requirements allowed; guest/unauthorized source and job access denied | Actual incomplete source in recovered app; [anonymous/foreign-origin HTTP denials](http/access-boundary.json), [ungranted Storage reads](specs-runtime/2026-10-29T07-29-20-473Z-storage-denials.json), and local RLS/scope suites. The new ServiceBearer probe's different-job negative used a nonexistent job, not an unperformed cross-account business-data read. |
| Explicit affected-assignment retirement/history contract | `tests/domain/specs.test.ts` covers occupied-slot selection, assignment archival with values/history retained, stale/foreign/duplicate retirement choices. Existing SQL refuses retirement if future assignment storage exists without integration. Actual M04 assignments/version history must wire this contract when introduced; no M04 implementation proof is claimed here. |

The user/API/local MCP operations share the same domain/central services. Current
official SDK protocol tests include actual in-memory and local Streamable HTTP
negotiation with deterministic service ports; they do not represent an external
Claude OAuth session. [M07](../../../milestones/M07_API_MCP_RELEASE.md) owns that
external-client/resource-audience/production release proof. It is not an added
M02-only permission barrier.

The initial assessment identified scanned-page vision as a remaining M02
implementation requirement: image-only PDF raised `DOCUMENT_VISION_REQUIRED`.
M02 build step4 explicitly calls for an appropriate text/vision path. The worker
fallback was subsequently implemented and coordinated migration16 was
[applied/read back](../cloud-pdf-vision/2026-10-29T09-54-06-914141Z-9a0506a9-apply.json)
with [local metadata validation](pdf-vision-local/2026-10-29T09-44-04-388Z-c6863e17.json).
These establish implementation/schema behavior; migration16 changes only the
two document-preparation validation/storage helpers.
The [live OCR metadata projection](live-pdf-vision/2026-10-29T10-20-19-122534+00-00-3c6c36f6-ocr-only.json),
observed at 10:20:19.122534Z, establishes actual OpenAI processing of image-only
PDF pages 1 and 2 through `gpt-6.1-sol`/SDK 7.45.1 (3299 and 3416 tokens). It retains
only hashes/usage/version metadata. The first subsequent canonical
[readback attempt](live-pdf-vision/2026-10-29T10-22-23-211083+00-00-196ec09f-readback.json),
observed at 10:22:23.211083Z, is explicitly `unconfirmed` with
`PDF_VISION_EVIDENCE_UNCONFIRMED`. Its capture SQL had an extra closing
parenthesis: this was an evidence-query syntax error, not an application
processing failure. The failed SQL and receipt remain preserved.

The subsequent [canonical readback](live-pdf-vision/2026-10-29T10-28-12-764925+00-00-2e8ab32d-readback.json),
observed at 10:28:12.764925Z, passes all 10 checks. It binds the exact private Ready
original and `pdf_vision` derivative checksums, both actual OCR page receipts,
10 source-grounded references across pages 1/2 and the saved editable draft.
Real OCR used 6715 tokens combined; extraction used 2682 tokens. All three stages
completed through n8n execution 31304. The [saved app screenshot](live-pdf-vision/browser/scanned-requirements.png)
and [full AX tree](live-pdf-vision/browser/scanned-requirements.ax.txt) show one
Archive Clerk role, unknown age/headcount and one provisional slot; Arabic,
English, Cairo and scenes 9/11 remain. Relative next Monday stays in availability
requirements with exact-date clarification and no invented shoot date. The
protected original manual note and waiting job are retained. No new provider call
was needed to repair the capture query.

Separate [native fixture inspection](pdf-raster-fixture/2026-10-29T09-54-41-482Z.json)
covers image-only pages and a dominant scanned body with a small digital header.
`tests/worker/pdf-vision.test.ts` passed 4/4: text-rich no-provider routing,
mixed-page OCR/offsets, corrupt rejection and dominant-image detection. This is
local deterministic coverage, not another live hybrid-PDF OCR claim. The
[scrubbed-worker native proof](scrubbed-native-worker/2026-10-29T10-08-42-732Z.json)
separately verifies real pinned-container rasterization under the actual child
environment projector, with no inherited parent PATH, Docker host override or
provider/DB credentials. The earlier observation times and capture failure
remain unchanged. These results close the specific scanned-PDF M02 gap.
Text-rich PDF, DOCX and text acceptance above stay valid. Restore/endurance/
hosting and full end-to-end production release remain separate later evidence;
historical transient gateway failures are retained.

Selected extraction configuration in actual recovery: OpenAI `gpt-6.1-sol`, SDK
7.45.1, frozen model/prompt/schema metadata checked; n8n execution31291. No
credentials, raw provider payload, signed private URL or user token is embedded
in this matrix.
