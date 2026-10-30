# M06 acceptance checkpoint: implemented_unverified

Updated 30 October 2026. Guest sharing, feedback, actual PDF delivery, original
video playback and live access lifecycle work through canonical history 28.
The saved-video source-transcript companion and Cairo DST expiry-display fixes
are implemented and tested below. M06 remains **implemented_unverified** pending
AT-072 manual screen-reader acceptance. AT-054 physical phone-keyboard testing
is owner-deferred, not passed; the owner waived further mobile testing. The
V5 native save is now verified: five saved PDFs, with 24 independently reviewed
pages across the first three and fifth; V4 remains byte-only. The preserved
278985e source ZIP/scanner checkpoint predates this follow-up. Hosting remains
deferred; broader
independently labelled M03 English/mixed semantic evaluation remains unverified.

The [acceptance matrix](../../tracking/evidence/m06/ACCEPTANCE_MATRIX.md) separates
local SQL, controlled HTTP/MCP/browser cases, synthetic native PDFs, canonical
metadata and actual Chrome/owner-assisted evidence. A Ready row or download
acknowledgement alone is insufficient. No raw bearer, cookie, private snapshot,
real casting text or source image is reproduced in these documents.

## Canonical releases and preserved setup

Target is the owner-confirmed central Supabase project `pyibofyctwnqpvktepse`.
These writes completed once; preserve their claims and readbacks rather than
repeating setup.

| Step | Applied result and scope |
| --- | --- |
| Additive 25 | `20261030002634_m06_guest_review_feedback_exports.sql`, SHA256 `2c72507216efdcd3e9dcea3f9b94270b19e1275ebcd2fcf91dad9253ddde8d2a`; [apply](../../tracking/evidence/cloud-m06-review/2026-10-30T00-34-45-273785Z-a9218c10-apply.json) / [independent readback](../../tracking/evidence/cloud-m06-review/2026-10-30T00-40-49-572252Z-48f6139e-readback.json). Old state/runtime 11 preserved; only scoped operation 12 added, no new runtime login. |
| Forward 26 | `20261030004643_m06_credential_admission_guest_retry.sql`, SHA256 `a0fb9dfec8cdae2718719d455ed11b4f25dd9b79e8fc9de19bd53c229b64089e`; [apply](../../tracking/evidence/cloud-m06-forward26/2026-10-30T00-50-57-984640Z-4586599d-apply.json) / [readback](../../tracking/evidence/cloud-m06-forward26/2026-10-30T00-52-53-907860Z-83c5768f-readback.json). Backend credential provenance and scoped failed-export retry added; terminal cancellation and runtime 12 preserved. |
| Forward 27 | `20261030013832_m06_guest_storage_policy_composition.sql`, SHA256 `9e3ab85655c2fa0490aba07118fe730dae2c6193f651c3ba086910d82b7eb171`; [apply](../../tracking/evidence/cloud-m06-storage27/2026-10-30T01-44-03-055712Z-b9d43e22-apply.json) / [independent readback](../../tracking/evidence/cloud-m06-storage27/2026-10-30T01-44-36-031555Z-0347010f-readback.json). Exactly four Storage policy expressions plus one scoped media SELECT policy changed. Other noncredential business/catalog/defaults/Auth metadata/Storage/runtime/key metadata/flags remain preserved. |
| Forward 28 | `20261030030717_m06_frozen_video_source_transcripts.sql`, SHA256 `6334ea62a49966963e675c61e6a73d2acb5981d35f261cf2dff519d097905178`; [apply](../../tracking/evidence/cloud-m06-transcript28/2026-10-30T03-13-38-702487Z-0794757f-apply.json) / [independent readback](../../tracking/evidence/cloud-m06-transcript28/2026-10-30T03-14-18-265089Z-f6675f04-readback.json). Under owned runtime quiescence and idle jobs, adds an empty future-only video source companion table/private helpers and three guarded capture/playback source changes: 157 added catalog fields, three changed hashes, zero deletions. Old business/Auth metadata/catalog/defaults/Storage/Ready versions/runtime 12/key metadata/flags preserved; no old backfill, new login or configuration change. |
| Private verifier and activation | [Encrypted bootstrap](../../tracking/evidence/m06/guest-bootstrap26/2026-10-30T00-56-45-821531Z-2a41f391-apply.json), [full preservation](../../tracking/evidence/m06/guest-bootstrap26/2026-10-30T00-59-14-890286Z-37edbf14-full-after.json), [guest enable](../../tracking/evidence/m06/guest26-activation/2026-10-30T01-06-58-207550+00-00-1130c790-enable.json) / [readback](../../tracking/evidence/m06/guest26-activation/2026-10-30T01-07-18-497682+00-00-0ec17331-readback.json). Protected owner/SYSTEM configuration; no raw key or credential digest published. |
| Existing Producer grant | [Absent-only grant completion](../../tracking/evidence/m06/producer-review-links26/2026-10-30T01-07-48-991811Z-8f3dc27b-apply.json) / [readback](../../tracking/evidence/m06/producer-review-links26/2026-10-30T01-08-51-975472Z-1216bfb7-readback.json). Only review_links.manage added to the existing verified requester; other grants/memberships/Auth counts preserved. No new identity or inactive grant reactivated. |

The [actual Storage RED](../../tracking/evidence/m06/storage-diagnostic/2026-10-30T01-25-32-271758Z-fixed-storage.json)
showed gateway authorization succeeded while all eight tested frame/PDF route and
header combinations returned NoSuchKey. It remains historical evidence. Real-role
composed SELECT reproduced the restrictive-policy failure; the first four-policy
candidate then exposed missing review-owner visibility of unpinned export PDF
metadata. The [final composed-role GREEN](../../tracking/evidence/m06/storage-rls-local/2026-10-30T01-37-21-791Z-abba75e3.json)
checks anonymous/authenticated frame/logo/video/PDF GET/info, guest sign/list
rejection, lifecycle/scope denials, existing worker reads and actual internal
export RPC/GET/info/sign with read-only export denial. A narrow acyclic media
policy supplies that existing owner's current export metadata. Immutable version
pins, function owners/ACLs, roles, buckets and TTLs are unchanged. No transport or
Bearer-header workaround was applied.

## Implemented sharing and processing boundary

Internal link management, moderation and exports share domain/central/HTTP/MCP
validation and acting-user permissions. Twelve semantic MCP tools have controlled
SDK parity with HTTP operations. This is not an external Claude OAuth/client
acceptance claim. Guest content precedes name entry; separate context-selected
HttpOnly cookies identify sessions. Names/company are convenience labels and
never merge authors or authenticate them.

Links follow newest Ready only within the same external series/output/audience.
Viewed snapshots remain fixed until deliberate update. Comments, replies and
preferences retain their version-slide identity; internal notes are absent from
the closed guest projection. Preferences do not alter casting positions or
factual Reviewed state. Unknown writes retain their original semantic request
and idempotency key until acknowledged. Preparing, unavailable and PDF job
states are explicit.

Permanent bearer storage is digest-only, with a backend HMAC, clock fence and
single-use nonce protecting gateway admission. Creation/rotation replay uses
separately keyed AES-GCM ciphertext with the documented 24-hour bound. Forward 26
requires fresh backend credential provenance even for cached acknowledgements.
Private fixed-version exports replace access URLs in the frozen snapshot only;
cache identity includes version/link/template/export revision. Media grants
follow current parent access. Private proxy checks constrain destination, status,
type/range/length and full-stream checksum. See [API](API_ACCEPTANCE.md) and
[database](DB_ACCEPTANCE.md) scope details.

WF03 remains `kE4qSEcugaKhIoJU`, repaired active version
`eba0dccc-913b-4e26-a445-7b325fc886dd`; its [five-stage metadata probe](../../tracking/evidence/m06/n8n-wf03/2026-10-30T00-35-04-583Z-43a350e8-expression-probe.json)
is separate from actual export jobs. The [owned history-28 restart](../../tracking/evidence/m06/runtime28-transition/2026-10-30-owned-processes-ready.json)
and [authenticated startup proof](../../tracking/evidence/m06/guest-export-runtime/2026-10-30T03-15-25-486Z-b0f4cf8d.json)
retain 23 startup sources and the same 12 gateway operations, explicit specs-file/
guest-export flags and no public worker listener. The earlier [history-27 restart](../../tracking/evidence/m06/runtime27-transition/2026-10-30T01-48-08-2134478Z-a1405fee-owned-processes-ready.json)
remains a historical process observation. Startup is not an endurance or render
claim; existing credentials and unrelated workflows remain preserved.

## Actual app, downloaded artifacts and fixed media

The [current history-28 canonical observer](../../tracking/evidence/m06/app-capture28/2026-10-30T03-41-59-550514Z-e6594989.json)
records five Ready six-page versions in external Client Selection series
`9a4a2218-b250-4004-817b-760912305770`, Dummy Test workspace
`098d5b48-42a3-475b-b562-735c9eafce80`:

| Version | Actual frozen scope |
| --- | --- |
| V1 `796effc6-93d6-4602-97d7-c1199083114f` | Keeps the original introduction and two frames. Its downloaded guest PDF and original-media link were inspected and exercised. |
| V2 `3a3910f8-45b6-414a-a96a-2c223a72acb7` | Intentionally has no selected frames/video. Two distinct link-scoped PDFs were downloaded and inspected. |
| V3 `15995571-04b3-468e-9863-caf0db3dde19` | Also keeps its intentionally empty media selection; V1's original video still worked while V3 was latest. |
| V4 `7a4752bc-b277-4981-9c33-5c1f3d64496f` | Generated after restoring the existing original introduction and exactly 3.12 s/12.48 s frames; the library's extra 14.04 s frame remains unchecked. No new AI processing or replacement upload is claimed. V1/V2/V3 stay unchanged. |
| V5 `6e379406-6b87-4dbb-a6fb-8078eb1ce5ac` | One actual Producer Generate after 28 captured the selected original video's exact source companion. Same external Client Selection/template 1.1.0; no new AI/source-processing or render/PDF composition change. Guest/internal transcript equality and post-28 V4 absence are observed below. |

The [actual shared journey](../../tracking/evidence/m06/live-app/2026-10-30T01-29-47-291145Z-07d384ca-partial.json)
observed Preparing before Ready, first-feedback identification, same-name separate
edit controls, cross-link external comments/reply/preferences and the Producer's
internal note absent from guest DOM. A V1 draft survived a V2 offer and cancelled
discard, posted to V1, and changed version only after explicit opening. Keyboard
role navigation was observed. Canonical metadata retains distinct sessions and
version-slide preferences; direct ownership/scope attack permutations have
separate local/controlled evidence.

Three actual guest UI Blob downloads were matched to export metadata despite CUA
missing their download events: A/V1 export f6d03929..., C/V2 cf9cbc55... and B/V2
e55cd9b1.... The [combined 18-page inspector](../../tracking/evidence/m06/live-artifacts/2026-10-30T02-08-52.589Z.json)
validates their downloaded bytes, frozen content/text/image/link geometry and
independently verifies both V1 source JPEG bodies. Separate [six-page V1 visual
review](../../tracking/evidence/m06/live-artifacts/2026-10-30T01-49-43.094Z-independent-visual-review.json)
and [twelve-page V2 review](../../tracking/evidence/m06/live-artifacts/2026-10-30-v2-two-export-independent-visual-review.json)
cover all 18 pages. The two V2 exports have identical page pixels but different
whole-PDF hashes; with no V2 video selected, these artifacts reveal no video-grant
scope and do not establish cross-link authorization by pixel equality. The earlier
[synthetic native access-only comparison](../../tracking/evidence/m06/native/2026-10-30T00-15-06.908Z-access-only.json)
remains a distinct renderer proof, not a substitute for these actual artifacts.

The [actual original-PDF video](../../tracking/evidence/m06/live-app/2026-10-30-original-pdf-video.json)
played the fixed V1 original to 9.069 s, readyState 4, 853 to 480, 19.776 s duration and no
error while V3 had no media selected. The owner manually opened the real PDF and
clicked its video link after the agent's file-URL action was blocked. The agent
resumed only an already observed credential-free HTTP route with its existing
cookie; it did not extract/navigate a raw grant or tunnel the file. Full-duration
completion is not claimed. The same incognito context showed Projects sign-in
and internal Projects API AUTH_REQUIRED/no data, without business sign-in.

## Actual final lifecycle and mobile observations

The [final lifecycle/mobile receipt](../../tracking/evidence/m06/live-app/2026-10-30-final-lifecycle-mobile.json)
records 17 actual CUA events and explicit manual limits:

- A's download-only edit preserved 2026-11-29T01:09:31.930041Z exactly and its old V1 PDF video remained readyState 4. Setting expiry into the past made the same playback resume unavailable. Explicit extension to 2026-11-29T01:09:00Z restored it while downloads stayed off; revocation then denied a fresh request.
- B's previously Ready V3 cached PDF export 8061a0fe... returned DOWNLOAD_DISABLED on its actual observed download GET while ordinary synthetic content remained viewable. Rotation 3 to 4 denied both the old active session and old raw generation 3 URL; replacement 4 opened Ready V4 with downloads off. B was then revoked and its replacement session became unavailable. Independent C remained Ready V4 with downloads enabled.
- C in an account-free 390 by 844 viewport played actual V4 video with Space to 10.508 s, readyState 4 and no error, navigated roles, displayed all ten fields and persisted a synthetic V4 comment. Document scroll width 380 stayed within width 390; the override was reset. No physical-phone/native-keyboard or screen-reader check was performed.

A [fourth actual mobile-width PDF download](../../tracking/evidence/m06/live-artifacts/2026-10-30-v4-mobile-download.json)
for C/V4 export `b590351d-0b63-4991-bbe5-66c97dd43baf` was saved and read back:
113,628 bytes, SHA256
`3ae23d5cfd403403d2d4ab47122f7639aec5559629676099745a70552db28807`, matching
canonical metadata with a PDF signature and owner/SYSTEM protection. This fourth
PDF has **no independent visual inspection claim**; the earlier three-export,
18-page inspection remains unchanged. Private PDFs, source frames and screenshots
remain under protected local storage or user Downloads, outside Git/archives.

Local lifecycle tests additionally cover separately revoked-grant no-revival,
foreign scope and prepare/download denial. Actual observations do not imply
remote deletion of an already downloaded local PDF or live fault/endurance tests.

## Frozen source transcript and current app proof

The [actual V5 app receipt](../../tracking/evidence/m06/live-app/2026-10-30-v5-transcript-app.json)
records a single Producer Generate, Ready V5 and the source companion in both an
anonymous guest's original-video view and the authorized saved internal view.
Both expose exactly 159 characters/271 UTF8 bytes with matching SHA256 against
the protected frozen companion, dir=auto and lang=ar. Keyboard details opening
is observed. The source text is not reproduced in public receipts or this document;
matching a frozen source does not certify transcription accuracy or factual Reviewed
state. The source_kind is source_transcript, with no automatic-provenance or
reviewed-caption claim.

The same actual post-28 journey opens V4's retained original at readyState 4,
19.776 s duration and no error, while explicitly reporting that the transcript
was not captured for that saved version. The [current metadata](../../tracking/evidence/m06/app-capture28/2026-10-30T03-41-59-550514Z-e6594989.json)
contains one valid companion for V5 only. The [earlier pre-28 V4 observation](../../tracking/evidence/m06/live-app/2026-10-30-legacy-transcript-before28.json)
was an app fallback, not post-migration evidence; that distinction is preserved.
No old version was backfilled from the mutable library.

C's QA link was rotated to generation 2 for a fresh session, preserving expiry
2026-11-29T01:29:33.666060Z exactly. The new account-free session opened Ready V5
before identification. V5 export d683edb1-91fa-4a80-b022-8ce499506e78 reached
Ready through the existing export pipeline, and the guarded client transfer
completed without error. The [earlier app receipt](../../tracking/evidence/m06/live-app/2026-10-30-v5-transcript-app.json)
correctly records its then-pending native Save As dialog and
actual_saved_file_verified=false. That historical observation is preserved.
The owner subsequently confirmed "Saved to Downloads"; the [protected input proof](../../tracking/evidence/m06/live-artifacts/2026-10-30T10-05-18-057482Z-v5-protected-download-inputs.json)
verifies the saved PDF against canonical export metadata and the exact frozen
snapshot, preserving an owner/SYSTEM-only copy without publishing its text or
raw grant URLs.

The [V5 six-page offline inspector](../../tracking/evidence/m06/live-artifacts/2026-10-30T10-05-40.085Z.json)
and [independent root visual review](../../tracking/evidence/m06/live-artifacts/2026-10-30-v5-independent-visual-review.json)
now close the native save gate. The actual file has 113,628 bytes, SHA256
`f1b17a5decd2d3407b6242d7201154a156f30b1370d9e79d930519a587b5f2eb`,
matching canonical metadata. The inspector verifies frozen content/layout and
both actual selected JPEG bodies. All six rendered pages were independently
viewed: legible cover, three candidate slides with ten fields, both actual frames
together, and two Pending slides; no clipping, overlap or missing glyphs were
observed. Five actual guest PDFs are now saved and byte-verified. The first three
plus this fifth PDF account for **24 independently reviewed pages**; the fourth
V4 PDF retains byte-only acceptance. This offline file follow-up makes no new
URL-navigation, original-video playback, factual confirmation or manual
assistive-technology claim.

The companion is revealed on demand beside the opened original video, outside
the ten candidate fields and PDF composition. Existing Generate captures it once
per version+original-video identity from the selected locked source, preserving
exact text and known language order/duplicates. Source text SHA already belongs
to the input fingerprint; languages are atomically captured under the same source
lock, without changing that hash protocol. No new Producer publishing/approval
workflow, source editing, native renderer, snapshot/manifest/PDF, runtime or n8n
operation is introduced. Current parent/version/asset checks precede frozen reads
for internal, guest-session and original-PDF-grant playback. No live-library
fallback exists. Actual V5 guest/internal playback is observed; PDF-grant
companion scope has local real-role and controlled UI evidence, without a new
actual V5 PDF-link-click claim.

The [final meaningful SQL RED27](../../tracking/evidence/m06/transcript28-local/2026-10-30T03-05-52-813Z-1379bd45.json)
reproduces the missing companion in an actual saved-video RPC. The [real-role GREEN28](../../tracking/evidence/m06/transcript28-local/2026-10-30T03-04-24-606Z-d22399ca.json)
checks old cached ACK/no backfill, exact UTF8/hash/language preservation, repeated
assignments captured once, immutable/forced-RLS boundaries, missing/blank and
invalid source handling, stale source SHA, session/PDF-grant scope, separate
expiry/revocation/rotation and unchanged old Ready rows. All synthetic rows roll
back; no native or actual-source accuracy claim follows. The [exact catalog/data proof](../../tracking/evidence/m06/transcript28-release-local/2026-10-30T03-04-42-477Z-e9e0b59b.json),
[owned local promotion](../../tracking/evidence/m06/transcript28-promotion-local/2026-10-30T03-07-27-600Z-3d01d548.json)
and [19-case inert release gate](../../tracking/evidence/m06/transcript28-release-offline/2026-10-30T03-08-17-425587Z-93f57fa1.json)
remain separate from the later canonical apply/readback and actual app evidence.

The [strict API companion gate](../../tracking/evidence/m06/api-contracts/2026-10-30T02-55-32-734140Z-transcript-companion.json)
passes 44 focused cases plus type/lint checks, adding the optional closed companion
to existing playback responses without new routes/tools. The [controlled source/language UI gate](../../tracking/evidence/m06/controlled-browser/2026-10-30-transcript-language-green.json)
passes seven cases for keyboard details, escaped original text, fixed scope,
explicit legacy absence, authorization-refresh removal and language semantics.
Earlier [six-case UI results and fixture failures](../../tracking/evidence/m06/controlled-browser/2026-10-30-transcript-ui-green.json)
remain historical; their counts overlap the later seven and are not added.
No timed caption track or inferred mixed-language segmentation is claimed.

## Quality evidence and remaining acceptance

The [post-28 app gate](../../tracking/evidence/m06/quality/2026-10-30T03-32-14-327693Z-96ae3635-final.json)
passes 83 controlled E2E, 693 module cases, build/typecheck/lint and production
denial. Its [current composed operational overlay](../../tracking/evidence/m06/quality/2026-10-30T03-57-34-127660Z-87226dbf-validator-operational-overlay.json)
retains the exact 96ae app gate and [preceding whitespace overlay](../../tracking/evidence/m06/quality/2026-10-30T03-40-52-807507Z-8e8c40bd-operational-overlay.json).
Exactly four cumulative operational source changes differ from 96ae: the private
transcript-export helper/test for C1/ECMAScript whitespace parity, plus the JSON
pack validator and its new three-case test for optional UTF8 BOM handling.
Only the latter two differ from the preceding 8e8c overlay. Historical receipt
bytes remain unchanged. Genuine RED/GREEN evidence and a fresh complete offline
gate pass: 146 Node, 538 Python, 12 n8n and 12 TypeScript operational checks.
All 1,380 current functional source hashes and 34 release seals are verified.
App/runtime/schema/SQL sources remain identical to the preserved 83 E2E/693-module
app gate; no repeated app run or combined coverage total is claimed. The earlier
stale-source private export was correctly blocked after the whitespace helper
change; fresh source-sealed observer/export then succeeded.

The Cairo DST fix has its [meaningful RED](../../tracking/evidence/m06/controlled-browser/2026-10-30-expiry-dst-red.json)
and [GREEN helper/controlled Cairo app evidence](../../tracking/evidence/m06/controlled-browser/2026-10-30-expiry-dst-green.json):
three helper cases and five UI cases, including the unchanged inline-confirmation
cases. Explicit local date components preserve the intended minute across Cairo
DST, UTC and a half-hour offset; omitted expiry retains original precision.
This is controlled app evidence, not an additional live canonical timezone edit.
The original actual download-only microsecond-preservation/lifecycle evidence
remains valid.

The [805e pre-DST/pre-transcript gate](../../tracking/evidence/m06/quality/2026-10-30T02-39-14-028843Z-805e65f9-final.json)
passed 75 E2E/678 module cases and unchanged offline groups at its timestamp.
Earlier [69-case app quality](../../tracking/evidence/m06/quality/2026-10-30T02-06-40-276296Z-f19e4689-final.json)
and [offline receipt](../../tracking/evidence/m06/offline/2026-10-30T02-10-54-807508Z-9371b347-final-sequential-gate.json)
remain historical. Those older gates do not accept later source changes.
Controlled [429 retry/draft preservation](../../tracking/evidence/m06/controlled-browser/2026-10-30T02-36-25-524624Z-guest-rate-limit.json)
and [inline lifecycle/expiry checks](../../tracking/evidence/m06/controlled-browser/2026-10-30T02-35-45-392501Z-4f730761-inline-link-confirmation.json)
retain their recorded scopes; no live throttling claim is made.

M06 stays implemented_unverified pending **AT-072**, the manual screen-reader
journey through navigation/carousel state, preferences, comments and the video
transcript. The previous implementation gap is fixed; automated accessibility
and keyboard checks do not replace that manual journey. **AT-054 is owner-deferred,
not passed**: further mobile testing was explicitly waived, so no additional
physical-phone test is requested. The native V5 save is now verified by the
later saved-byte/inspector/visual receipts; the earlier pending observation is
retained. Hosting and broader release acceptance remain separate.

Historical 25 transport/bootstrap failures, n8n auto-publication/name/lexer probes,
clone/fixture errors, forward 26 credential/retry REDs, Storage NoSuchKey/composed
RLS REDs, UI/expiry/selector failures, source-companion REDs, blocked stale-source
private export and the unchanged-budget WF02/default-parallel timeout remain
retained. Later receipts explain fixes; old source seals and observations are not
rewritten. The V5 actual browser receipt also records reconnect/focus failures
and a development hydration warning; no clean production-console claim is made.

## Preserved source package and follow-up scope

The source ZIP/checkpoint for commit `278985e75764121fcf2b71f3a4cfcdb5830baa23`
is preserved as the frozen package before this V5 saved-file acceptance
follow-up. Its archive SHA256 is
`a1f8db6eeff770600b2f5758426cb0585aa3745d82210be2b336a001d3e6b385`.
The prior source/index/ZIP private-value scan and ignored source checkpoint
remain bound to that package; their bytes and recorded scope are unchanged.
This follow-up adds only PDF acceptance evidence and documentation, which are
not included in that ZIP. A separate ignored acceptance follow-up record may
identify the later documentation/evidence commit without relabelling the prior
archive as current. No regenerated archive, app-gate rerun, provider execution
or new long private-value scan is claimed; app/runtime/schema/SQL and current
8722 composed quality remain unchanged. The saved PDF, source assets and rendered
page images stay private, outside source and archives.

The current observer preserves the three old M05 Ready versions, protected M02
waiting/INPUT_CHANGED/manual text, and the owner-confirmed M03 Reviewed profile
and source checksum. No broader M03 semantic accuracy rate or new casting/factual
approval follows from this work. External Claude OAuth/client acceptance,
metadata-plus-media restore, endurance and production hosting remain separate
release/M07 boundaries; M07 is not started.
