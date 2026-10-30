# M06 guest PDF export pipeline

The guest PDF uses the same retained renderer, template, frozen display fields,
images, branding, page order and fonts as the Ready version. Only original-video
annotation targets use the link-scoped media grant. Canonical Ready version
content, its internal PDF and its media pins are never overwritten.

## Runtime boundary

`presentation_export` has one leased `render_export` stage. Its exact metadata
input identifies workspace, series, version, export, review link, export revision,
token generation, frozen hashes and render configuration. The private service
input adds the already captured Ready snapshot; it does not read current profile
facts or run transcription/extraction/casting again.

The worker's new explicit `mint_review_media_grant` port is the twelfth finite
operation under the existing narrow login. Original eleven operation signatures
retain their meanings. Per-transaction role, function inventory, no table/schema
privilege, finite credential expiry, TLS/SCRAM and log hygiene checks still apply.
`EPS_GUEST_EXPORTS_ENABLED=true` must be supplied explicitly to the reviewed local
launcher; presentation/file modes and the exact twelve-operation role are required.
No provider management key or guest backend HMAC/replay key belongs in the worker.

Mint verifies the current job/attempt/lease, parent link's live generation and
download permission, fixed Ready version and export revision. A new issuance
revokes the prior unpublished grant. The raw grant appears once in the authenticated
response and stays in that invocation's memory. Only the private PDF holds the
usable URL. Callback/job/outbox/manifest payloads contain grant IDs and fixed hashes,
never raw grants or URLs. The closed callback includes actual native render and
independent PDF validation proofs alongside the verified output asset reference.

The worker renders, independently validates text/geometry/images/fonts/links, uploads
the separate per-attempt `presentation_pdf` object, downloads/verifies it through
the existing asset port, then commits Ready. Native work is fenced by heartbeats
and the same bounded callback acknowledgement replay. Lost completion acknowledgement
does not remint a grant, re-render or upload again.

Failed/cancelled/expired attempts revoke unpublished grants; explicit retry resets
only the stage budget and keeps fixed version/export identity. A new attempt receives
a fresh grant and output path. Expiry edits propagate to non-revoked grants, including
naturally expired grants; revoked grants stay revoked. Download-disable prevents
new preparation/download while otherwise authorized existing PDF video viewing
continues. Rotation invalidates old generation sessions/grants/cache variants.

## Orchestration and verification tools

- `tools/build-guest-export-wf03.mjs` extends the retained exact WF03 graph with one
  additional kind/stage pair. Nodes, pinned versions, credential, route, connections
  and settings are retained. Only its closed metadata mapper changes.
- The original `tools/update-guest-export-n8n.mjs` targeted existing WF03 with
  write-once claims. Its PUT actually auto-published on this instance, contrary to
  its draft-retention comparator. That failed comparison and the subsequent
  read-only reconciliation remain historical evidence; do not rerun their claims.
- `tools/repair-m06-wf03-expression.mjs inspect|repair|verify|probe` supplies the
  current serialization-only repair. It binds the observed pre-repair version and
  exact historical graph, permits one claimed PUT, verifies saved and active graphs
  after the instance's auto-publication, and has no activate or automatic retry path.
  Root reviews and invokes actions individually. Metadata probes execute n8n only;
  they do not claim database jobs or render PDFs.
- `tools/check-guest-export-runtime.mts` verifies complete authenticated startup
  with twelve exact operations. It never polls, claims, recovers, invokes OpenAI,
  contacts the webhook or reads a job's source data.

The connector/type-definition access boundary remains explicit. If full definitions
return HTTP401, the helper accepts only the already published and live-tested
three pinned node contracts plus current credential-schema readback. It does not
infer an instance version. Actual cloud/update/startup outcomes belong to separate
dated receipts; offline tests do not establish them.

The first M06 mapper worked as standalone JavaScript but placed three adjacent
object-closing-brace pairs inside n8n's outer expression. The
[pinned official lexer](https://github.com/n8n-io/n8n/blob/b09efb706cc9f8b7f4d4328e5bfe13fee9e145eb/packages/%40n8n/tournament/src/ExpressionSplitter.ts)
terminated that code early. The repair adds insignificant whitespace only, with
exact lexical token comparison, unchanged string literals and 37 old/new semantic
cases. The full outer expression is now tested after actual vendor lexing.
[Failure diagnosis](../../tracking/evidence/m06/n8n-wf03/2026-10-30-expression-lexer-diagnosis.json)
and [offline repair proof](../../tracking/evidence/m06/n8n-wf03/2026-10-30-expression-serialization-proof.json)
remain separate from root's actual repair/probe receipts. Exact old builder,
helpers and live-matching graph bytes are retained in `workflow-source-history/`;
old source-bound reconciliation helpers intentionally remain historical after
the current builder changes.

The actual bounded repair completed on 2026-10-30: one claimed PUT auto-published
version `eba0dccc-913b-4e26-a445-7b325fc886dd`, followed by exact saved/active
[verification](../../tracking/evidence/m06/n8n-wf03/2026-10-30T00-35-00-209Z-4d7f5a4b-expression-verify.json).
The [live metadata probes](../../tracking/evidence/m06/n8n-wf03/2026-10-30T00-35-04-583Z-43a350e8-expression-probe.json)
passed all five stage routes (executions 31468–31472), unauthorized 403 and four
invalid-input 400 cases. These probes did not claim business jobs, process media
or call an AI provider. The original failed comparison, failed live probe and
read-only reconciliation remain preserved beside the repair receipts.

## Current native and SQL evidence

[Actual offline synthetic PDFs](../../tracking/evidence/m06/native/2026-10-30T00-15-06.908Z-access-only.json)
contain six pages each: cover, zero/one/two/three frames, bilingual text and Pending.
Every canonical/guest page PNG is byte-identical, and measured text strings,
geometry, direction and actual font styles match. PDF.js's per-document generated
font identity is replaced by its actual style/metrics in that comparison. The
[initial raw-font-ID comparison failure](../../tracking/evidence/m06/native/2026-10-30-initial-text-metadata-comparison.json)
and original artifacts remain retained. All six guest pages were
[visually inspected](../../tracking/evidence/m06/native/2026-10-30T00-15-06.908Z-visual-review.json)
without observed clipping or overlap. PDFs may differ in object IDs/render timestamps;
binary PDF equality is not claimed.

`tests/db/m06-export-processing.sql` tests scoped claim/replay/mint supersession,
output verification, closed commit/callback replay, canonical preservation, cached
Ready reuse, expiry/extension/no revival, download-disable, failure/retry and cancel.
Its artifact metadata is explicitly injected synthetic SQL data, not native bytes
or Storage HTTP. Current local test receipts establish its actual result.

The additive `guest-export-retry-forward.sql` repairs the failed-cache prepare path
without changing migration25. The existing guest `prepare_export` operation can
requeue its live session's failed export on the same frozen version/link/revision.
It keeps the export/job/input identity, resets only the render-export stage budget
and revokes old grants; the next claim receives a higher global attempt, fresh
lease/grant and private artifact path. Cancelled jobs remain terminal. The helper
is executable only by the existing guest owner role, with no new public operation
or worker credential privilege. Real-role rollback-only checks are in
`tests/db/m06-guest-export-retry.sql`; the [local forward26 receipt](../../tracking/evidence/m06/forward26-local/2026-10-30T00-45-20-762Z-a7493d50.json)
records the combined credential-admission/retry proof. It does not establish a
canonical release or live guest retry by itself.

The guest viewer keeps slide/version navigation and the unload guard locked while
PDF preparation is busy or its acknowledgement is unknown. Confirmation replays
the original request; an acknowledged background export releases that lock.
Update checks fence out-of-order responses and only offer a higher version number;
the viewed version's saved content remains fixed. A cancelled export shows an
explicit terminal message without a retry action. The producer may explicitly
rotate the link and prepare the same frozen version for a new scoped export;
rotation also revokes the old generation's sessions and media grants.
The [controlled browser proof](../../tracking/evidence/m06/controlled-browser/2026-10-30T00-53-11-453148Z-01ca8d4e-review-findings-green5.json)
passes five cases after preserved behavioral RED receipts. Its API responses are
intercepted fixtures, not canonical browser or real media delivery evidence.

These checks do not establish live guest delivery, fresh-browser playback,
production hosting or broader M03 factual accuracy. Those remain separate evidence.
