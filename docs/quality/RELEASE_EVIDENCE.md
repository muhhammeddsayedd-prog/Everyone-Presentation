# Release evidence and test-data runbook

**Current overview — 2026-10-31: M07 is in progress; production release remains unverified.** The [stable pilot](https://everyone-presentation-pilot.vercel.app) serves web deployment `CcwVabZ5PkadAPaeANRLJD4GqVg3`, confirmed by the [14:19 UTC alias/deployment receipt](../../tracking/evidence/m07/backend-continuation/2026-10-31-response-scope-web-deployment.json). The signed-in Dummy Pilot Test workspace passed after the SDK response-scope correction. Canonical history remains33; the original owned local database remains29. Worker `CVDMpdETNwZYxdEyJ8XM66kSppdQ` was [observed Ready with one live instance at14:20 UTC](../../tracking/evidence/m07/controlled-pilot/2026-10-31T14-20-21.838Z-c70a7099-daemon-runtime.json). The pilot stays running until the owner stops it.

**Scoped owner OAuth/MCP connection acceptance is passed and preserved.** The owner completed initial authorization and an authenticated Dummy Pilot Test read, then an already-consented redirect-only reconnect and another authenticated `get_project`. The [final acceptance receipt](../../tracking/evidence/m07/oauth-attempt-trace/2026-10-31-owner-connection-acceptance.json) binds the owner-visible request `23c439a1-4869-4228-a3f1-d4a6004ef4f0` to the expected acting principal, registered direct Claude Code client and exact project. This closes the earlier redirect-only limitation; it does not close refresh/rotation/revocation, contributor limits or the full delegated write/processing/generation/sharing journey. The owner retains Claude configuration, sign-in and consent control.

The owner declined further manual English/mixed-language answer-key collection and requested English facts/transcripts for any speech language, with no v1 language selector. The [English contract](../integrations/ENGLISH_TRANSCRIPT.md) preserves original sources, prior Arabic name/age Reviewed evidence and immutable Ready versions; absent/failed English has an explicit status without a raw-language display fallback. [Application source quality](../../tracking/evidence/m03/english-transcript34/2026-10-31-application-quality.json) passes881 tests, lint, typecheck, production guard and build with771 unchanged application inputs. English migration34 is not canonically applied, the flag remains disabled and the frontend/full-job/app integration is unverified. One real normalization component check was not accepted; these source gates provide no new semantic-accuracy or deployed English acceptance.

Recovery33 [run533 failed](../../tracking/evidence/m07/recovery33/2026-10-31T14-39-48-217Z-5332c86b.json) at full33 metadata restoration after actually executing functional migrations30–33 in an owned clone. Unknown exact ACL representations stopped the restore; an explicit role-membership REVOKE then failed cleanup. The [15:01 UTC guarded cleanup](../../tracking/evidence/m07/recovery33/2026-10-31T15-01-22.518Z-533-guarded-cleanup.json) subsequently passed committed and independent read-only checks: original29 native baseline/full catalogue and every preexisting global role remained exact, both owned roles/databases were absent and the shared lock was released. The failed receipt, false normalized-context comparison and source snapshots remain historical evidence. This is local preservation/cleanup proof, **not full33 metadata-plus-media or deployed recovery acceptance**.

Remaining release checks are the coherent human/delegated producer journey and contributor limits; live refresh/rotation/revocation; coherent English SQL/worker/frontend rollout and real app verification; release-version PDF/media/guest/version guarantees; complete operator/n8n correlation; current metadata/media/Auth/resource/config restore and deployed replacement/rollback; representative provider cost/endurance; and manual AT-072 screen-reader acceptance. Mobile testing stays skipped by owner instruction. Additional multilingual manual labels will not be requested; broader semantic accuracy remains unclaimed. The [M07 matrix](../../tracking/evidence/m07/ACCEPTANCE_MATRIX.md) retains the detailed scopes.

**Historical pre-pilot overview retained below.** Its hosting, Settings, provider and reconnect pending labels, and the older tables/checkpoints in this runbook, keep their dated scopes; the current overview and linked receipts above supersede those labels without rewriting historical evidence.

**Current state: production release unverified; M07 in progress.** Earlier M02–M06 matrices retain actual canonical/provider/native/browser/PDF/guest evidence, including the owner-saved V5 PDF. Those results must not be relabelled as a fresh M07 release journey. M07 now has86 reconciled user tools, guarded auth/transport/consent and settings sources, controlled permission/schema/UI evidence, a local metadata-plus-media restore, a bounded synthetic native workload and an actual Claude Code compatibility smoke with synthetic business ports. The [M07 matrix](../../tracking/evidence/m07/ACCEPTANCE_MATRIX.md) separates these scopes and links exact receipts. Migration29 is applied once locally and canonically, with [3a0afd9f apply](../../tracking/evidence/cloud-m07-29/2026-10-30T11-52-15-216806Z-3a0afd9f-apply.json) and [f553771a independent readback](../../tracking/evidence/cloud-m07-29/2026-10-30T11-52-36-310355Z-f553771a-readback.json). The post29 authenticated12-operation startup check passes; [new owned runtime](../../tracking/evidence/m07/runtime29-transition/2026-10-30-owned-processes-ready.json) is running. [Actual Settings](../../tracking/evidence/m07/live-app/2026-10-30-settings-sign-in-pending.json) loaded signed out; authenticated read/write proof awaits user sign-in. Public Auth metadata observations and unenabled hook30 remain separate. No hosting or full live delegated/human M07 journey is established. AT-072 and broader M03 semantic evaluation remain pending; mobile testing is skipped.

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

| Group | Acceptance cases | Current evidence boundary | Still required for release |
| --- | --- | --- | --- |
| Discovery and shared DB compatibility | AT-001–005, AT-067 | Historical discovery/foundation, original-profile reconciliation, real-role local29 proof and one-time local/canonical29 apply plus independent readback pass; earlier refusal preserved. | Actual updated runtime/browser/shared-workflow compatibility; preserve the exact applied29/source/readback history. |
| Producer workflow and persistence | AT-006–014, AT-025–034 | Historical M02/M04/M05/M06 persisted app evidence; M07 desktop fixtures cover paging/settings/retirement. | One coherent fresh M07 human journey against the release services and shared data. |
| Real source processing | AT-015–024, AT-055–062 | Historical real technical scans and one owner-grounded Arabic Reviewed profile; M03 broader labelled semantics still pending. M07200-file native diagnostic is synthetic/probe-heavy. | Representative independent English/Arabic/mixed ground truth, true provider/storage/queue duration/cost and required recovery. |
| Presentation and PDF | AT-035–044 | M05/M06 saved-file/native/visual evidence retained; isolated history28 restore validates synthetic PDF/video bytes. | Release-version human/Claude outputs, fixed-media access and layout proof through actual services. |
| External review | AT-045–054, AT-076 | M06 actual shared feedback/lifecycle/PDF/video evidence retained. | Preserve those guarantees through release. Mobile stays skipped by owner instruction; AT-072 remains distinct. |
| Full API/MCP parity | AT-063–066 | Source matrix86/86/115; controlled SDK/HTTP/SQL permission/replay tests. Actual Claude Code performs five calls over synthetic ports; exact original protocol revision unrecorded. | Full authorized producer/contributor Claude journeys, real-byte transfer, live OAuth issuance/refresh/revocation and shared app data parity. |
| Production operations | AT-068–070, AT-074–075 | Isolated history28 metadata/object restore; bounded-two native diagnostic and source scope audit. | Real staging/deployed replacement/rollback, operator correlation audit and environment-specific recovery. No hosting/endurance/RTO pass. |
| Accessibility | AT-071–073 | Earlier keyboard/controlled automated evidence retained; M07 desktop interaction tests add no screen-reader proof. | AT-072 manual screen-reader journey and remaining non-waived release accessibility evidence. |

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

The examples below remain the planned representative release dataset, not a denial of existing M05/M06 PDFs. Existing actual files/24 visually reviewed guest pages and the separately validated synthetic recovery PDF have their own source-bound receipts. Do not fill a named fixture's row using an unrelated saved PDF.

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

Observed M07 local diagnostics are [documented separately](../../development/m07/WORKLOAD.md):200 tiny distinct hashes/1,420,766bytes,198 successes/two expected failures, peak native concurrency2 and250775ms total. Six files used full preparation; most were probes of the same0.32s/no-audio footage. Attempt p50/p95 was2429/2835ms, with median/p95 local admission delay123639/235457ms. This does not populate the representative provider-processing/cost rows below. The installed Claude Code smoke's reported USD0.0379727 estimated list cost is development-client usage, not embedded OpenAI video/PDF processing cost.

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

## Current composed quality checkpoint

[The final correctly selected80desktop run](../../tracking/evidence/m07/quality/2026-10-30-desktop80-final.json) passes with all seven embedded narrow-viewport cases excluded. The earlier87-case label was overbroad: seven older mixed tests ran320px assertions despite the skip flag. Their historical receipts are preserved/qualified and provide no mobile acceptance. The prior five-case consent rerun also overlaps four existing cases; no counts are added together. Consent server coverage includes11cases: initial metadata-free redirects are denied, only same-request-bound recovery is accepted, and reconnect is unsupported. Hook30 has seven passing local SQL stages, without migration/provider enablement.

[Current final scoped quality](../../tracking/evidence/m07/quality/2026-10-30-final-documentation-overlay.json) passes747module cases,80desktop cases, typecheck/lint/build/production fixture guard; app/test source bytes with separate mapping-documentation overlay are unchanged. The Node24 structuredClone configuration correction did not edit the sealed SQL test. Earlier741/87-scope runs, source-change refusals and locator correction remain historical. These local passes are not full live release acceptance. Post29 restore is still on a bounded follow-up after the OID boundary fix; no success is pre-credited beyond the established partial history28 recovery proof.

## 8. Release decision and remaining work

Release remains **unverified** while the matrix's required external/full-journey gates are open. Local/controlled passes do not close them. List each unresolved issue with severity, user impact, owner, workaround if any, and next action. Distinguish a product decision from an infrastructure dependency. Do not restart a broad questionnaire for ordinary engineering choices that already have documented defaults.

The release gate requires: no unresolved critical data/access corruption; complete agreed casting output behavior; real service journey; valid usable PDF; full required Claude/API parity; supported guest feedback/download rules; and operational recovery evidence. A known blocked integration must be disclosed explicitly. The final handoff records what was tested, what remains limited, and how to run/deploy/recover the actual implementation.
