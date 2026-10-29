# M05 acceptance checkpoint

This completed M05 slice separates implemented contracts, disposable local proof, actual
native artifacts and the signed-in canonical app journey. The milestone status
remains owned by `PROGRESS.md` and the handoff. Hosting is deferred.

The [acceptance matrix](../../tracking/evidence/m05/ACCEPTANCE_MATRIX.md) maps the
M05 packet to individual receipts. Real casting words, transcripts, photographs,
signed URLs, credentials and private snapshots are not included here.

## Delivered behavior

Generation uses the selected output/audience/template series and requires all
three guards: workspace row version, draft revision and complete review input
fingerprint. One locked transaction captures immutable content and selected
asset identities, allocates the series version number and commits its job/outbox.
The worker renders that captured input; later draft edits do not replace it.

The private render snapshot and derived closed manifest are separate. Candidate
pages retain all ten accepted display fields; empty output slots retain Pending
requirements. Each assignment gets its own page, including a repeated person.
Missing information and fewer frames remain permitted. Native preparation,
rendering, independent PDF validation and publication are four durable stages.
Ready requires both verified manifest and PDF assets. Latest-ready publication
is monotonic within the same series.

The app provides frozen saved-version viewing, slide navigation, a keyboard
frame carousel, generation status/history, canonical PDF download and retained
original-video access. Review/Presentation/index links carry the chosen series;
an explicit inaccessible or malformed context is rejected. HTTP and MCP expose
the corresponding acting-user operations. External Claude OAuth acceptance is
separate from the tested official SDK transport.

## Registered layout and native proof

The separately retained **1.1.0** template displays Pending category and every
one of the eleven labelled requirements, including `Not provided`. Existing
1.0.0 source/registry/font bytes stay retained; an old series is not silently
repinned. The 1.1.0 content SHA256 is
`bbe72bf2bb08f37fe394c75563e2eca3ab8da72b1775db75704d47ae54f4f638`.

The exact bundled fonts are **IBM Plex Sans and IBM Plex Sans Arabic**, licensed
under SIL OFL1.1. They are the documented development substitution for unavailable
General Sans; this is not an exact General Sans fidelity claim. The white brand
variant retains the original path geometry. See [native pipeline details](NATIVE_PIPELINE.md)
and the [snapshot/API contract](SNAPSHOT_CONTRACT.md).

[Actual synthetic artifacts](../../tracking/evidence/m05/native/2026-10-29T22-05-38.046Z-synthetic.json)
and their [eleven-page visual review](../../tracking/evidence/m05/native/2026-10-29T22-05-38.046Z-visual-review.json)
cover 0/1/2/3 geometric frames, wide/tall images, transparent logos, mixed
Arabic/English soft wraps and complete Pending/no-role pages. The independent
[SQL-capture PDFs](../../tracking/evidence/m05/native/2026-10-29T22-04-53.263Z-sql-capture-pdf.json)
and [fourteen inspected pages](../../tracking/evidence/m05/native/2026-10-29T22-04-53.263Z-sql-visual-review.json)
establish the synthetic Selection **8-page** and Shortlist **6-page** contract.
Those fixture counts are not the live project's assignment count.

## Canonical release and operational boundary

Migration 24 is
`20261029215218_m05_immutable_presentation_versions.sql`, SHA256
`09d78c225ca02d436a8b1c2bcc6e55f273dfea116976807af4a8b228b99de5f4`.
The [local rollback proof](../../tracking/evidence/m05/versions-local/2026-10-29T22-10-01-204Z-9e1811b5.json),
[two-actor race](../../tracking/evidence/m05/presentation-race-local/2026-10-29T22-09-10-701Z-7c35b61c.json)
and [local promotion](../../tracking/evidence/m05/presentation-promotion/2026-10-29T22-10-57-848Z-3587be8c.json)
are distinct from the actual cloud apply.

The canonical apply committed24, but its original exact comparison failed because
the new managed Storage bucket contained five additional platform fields absent
from the local bucket schema. The failed [apply](../../tracking/evidence/cloud-m05-presentations/2026-10-29T22-13-00-310531Z-267e06a1-apply.json)
and [readback](../../tracking/evidence/cloud-m05-presentations/2026-10-29T22-13-29-418588Z-0db34869-readback.json)
remain unchanged. No migration retry or corrective write was used. The separate
[read-only reconciliation](../../tracking/evidence/cloud-m05-presentations/2026-10-29T22-18-18-933100Z-c8396a58-managed-bucket-reconciliation.json)
verified the exact five values and current column types/defaults/constraints,
then normalized only a comparison copy of that new bucket. Every other catalog,
old data/configuration/Storage hash and new-state comparison remained exact.

The [authenticated startup](../../tracking/evidence/m05/presentation-runtime/2026-10-29T22-18-48-194Z-b4c69635.json)
bound22 stable public sources and claimed no jobs. The separate
[owned worker transition](../../tracking/evidence/m05/worker-transition/2026-10-29T22-21-30-427132Z-9426536c.json)
verified idle state, replaced the owned old process, matched startup sources and
reported no public listener. The [one-shot enable receipt](../../tracking/evidence/m05/presentation-activation/2026-10-29T22-22-47-241238+00-00-4a529fc8-enable.json)
verified only the new processing flag changed; existing review readiness and the
protected waiting M02 job remained preserved. Its sealed historical test source
is retained in `activation-source-history/`; a later test-only isolation repair
does not reseal or re-execute that activation. Its current-source validator now
deliberately rejects the changed working fixture. Later state belongs to the
fixed read-only app observer, not a rerun of the historical activation helper.

The [published WF03 probe](../../tracking/evidence/m05/n8n-wf03/2026-10-29T21-56-23-452Z-c2a6be14-probe.json)
executed all four real metadata dispatch tuples and denial cases. Those probes
did not claim database work or invoke a provider. Actual presentation jobs have
their own canonical stage evidence. No new AI call is needed to render accepted
frozen content.

## Live app checkpoint

The first real Selection version is
`47b39b6c-ffc4-41fb-ac11-70a697bf19de`. The signed-in app generated it through
the canonical four-stage pipeline and downloaded an actual **113,482-byte PDF**,
SHA256 `6cb70be4122557fad74a212f7470d8e11a52cee6667a1366de3ebb22f3a5a28a`.
The live output has **6 pages: cover +3 candidate assignments +2 Pending**.

The [downloaded-file inspection](../../tracking/evidence/m05/live-artifacts/2026-10-29T22-36-17.626Z.json)
verified exact frozen text, fonts, six actual PDF pages, two image draws with
declared frame geometry and one fixed-version original-video link. The
[independent visual review](../../tracking/evidence/m05/live-artifacts/2026-10-29T22-36-17.626Z-visual-review.json)
viewed every page, including both available frames together, readable ten-field
candidate content and all Pending labels without visible clipping. The offline
inspector did **not** independently retrieve the original image bodies or compare
pixel identity; actual worker source-byte validation is separate evidence.

The [signed-in browser journey](../../tracking/evidence/m05/live-app/2026-10-29T22-46-40-524986Z-5f2674be.json)
played the linked retained original video to its end at 19.776009 seconds with
no media error. It also exercised the two-frame carousel and all 12 Pending
category/requirement labels, and preserved the selected series in both
Review/Presentation navigation directions.

The [later canonical capture](../../tracking/evidence/m05/app-capture/2026-10-29T22-43-01-866603Z-a630f28c.json)
records all three versions Ready with succeeded jobs. Shortlist V1 is
`beeba12d-8a95-4ef7-8d0e-d9d32be9278d`; Selection V2 is
`bd795ab9-1247-4f64-9703-61142959b1b0`. Their stored PDF metadata is respectively
78,907 and 113,597 bytes, each with 6 pages. The consolidated browser journey now
also confirms both actual downloads match their canonical SHA256:

- Shortlist V1: `3e875330f311eccc1268afaa842b6dfc0afcfa0b0396d66205525f2ba18fb874`.
- Selection V2: `38bae0b8cb44fe08368b99add025cc09b1648229e4f6c6d0c6d7783e84faa4a3`.

A presentation-only wording edit invalidated the old Selection fit; the app
obtained a new zero-overflow fit before Selection V2 generation. The saved V1
viewer did not acquire the new note. After V2, a repeated V1 download was
byte-for-byte identical and its entire observed canonical metadata remained
unchanged. The new wording appears once in V2 and zero times in V1. The later
capture preserves the waiting M02 job and the owner-confirmed Reviewed source
status.

The [second independent downloaded-file inspection](../../tracking/evidence/m05/live-artifacts/2026-10-29T22-47-00.640Z.json)
and [twelve-page visual review](../../tracking/evidence/m05/live-artifacts/2026-10-29T22-47-00.640Z-visual-review.json)
now pass for both newer files. Shortlist V1 is cover +1 candidate +4 Pending,
with 134 checked text regions, no image draws and no video links. Selection V2
is cover +3 candidates +2 Pending, with 126 text regions, two image draws and
one video link. Both have 6 actual PDF pages and 3 embedded fonts. All pages were
independently viewed without visible clipping/overlap; Selection V2 pages 3–6
have the same rendered PNG hashes as V1. The accepted note change is visible
on its changed candidate page. Independent Selection source-image-body and
pixel-identity verification remain outside this artifact proof; the Shortlist
contains no images to retrieve.

[Eleven actual anonymous API requests](../../tracking/evidence/m05/anonymous-access/2026-10-29T22-44-30-406Z-ab883e30.json)
against these versions, their PDF downloads and retained frame/video routes all
returned 401. This proves denial without an internal session; it does not create
guest review/export access. The connected browser journey records instrumentation
warnings and does not claim a clean production console.

## Final quality gates and separate release boundaries

The [final quality receipt](../../tracking/evidence/m05/quality/2026-10-29-final.json)
records **613 module tests**, **57 full controlled browser tests**, operational
offline suites of 143 TypeScript and 355 Python checks, and 7 supplementary offline
checks passing. Lint, typecheck, production build and both production-fixture
denial guards pass. All 53 project-local skills/550 files pass static integrity
with no errors/warnings; this does not establish runtime skill execution.
Controlled browser cases use synthetic intercepted data and do not replace the
live downloads above. Focused/supplementary suites overlap broader suites and
are not added into a unique total.

The three live downloads and their independent artifact/visual checks are
recorded, with no remaining M05 check listed in this matrix. Guest links,
guest export variants, feedback, guest playback grants and external Claude OAuth
are not credited here. External review belongs to M06; complete agent/API/MCP
release acceptance belongs to M07. Hosting, maximum-load capacity/endurance and
production metadata-plus-media restore/release acceptance remain unverified.

M03's broader factual/semantic quality coverage remains explicitly unverified.
Successful media processing, one confirmed Reviewed source or these frozen PDF
checks do not establish roster-wide factual accuracy or casting approval.
