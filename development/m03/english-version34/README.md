# Exact new saved-version English capture

Prepared source only. Root reviews these helper bytes before executing the
read-only observer after actual app generation. No SQL, provider request, media
fetch or job has been run by preparation or the synthetic tests.

Create a protected ignored
`.local/m03-english-component/english-version-plan.json` with the **actual** new
version and controlled-scan bindings, using the existing owner+SYSTEM private
file helper (the same guard used for the preservation baseline):

```json
{
  "version_id": "actual new Ready version UUID",
  "job_id": "actual succeeded controlled candidate scan UUID",
  "candidate_media_id": "actual new candidate media UUID",
  "source_asset_id": "actual new source video UUID",
  "source_sha256": "ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a"
}
```

The plan must reference a version outside the captured old Ready cohort. The
original Reviewed scan/media is refused. The helper pins the already frozen
preservation guard, actual preflight history33 and reviewed migration34 bytes;
it requires exact canonical34. Source reads use the existing linked CLI2.122.0,
bounded in-memory stdout/stderr, no ambient DEBUG/connection overrides, read-only
transaction, ten-second statement deadline and rollback. A version-specific
permanent claim prevents automatic replay. Private plan/claim/SQL files use the
existing protected Windows file implementation. No guest token or URL is read.

The exact joined record proves a new Ready version with cohort1.0 and a pinned
original video from the controlled source job. Its saved raw and English
companions bind the same version/video/media and captured media row revision.
Snapshot candidate slides must reference that media/video and its current
canonical candidate; multiple assignments of the same candidate remain allowed.
The original job result binds the media/source IDs, allowing an ordinary explicit
duplicate resolution to choose the resulting canonical candidate.

English status must be available. The saved English SHA must hash its actual
captured text and equal the hash of the corresponding stored candidate English
text. Captured text must also equal the validated v2 extraction stage, with raw
source/input-hash equality and version creation/capture timestamps matching.
The expected English/raw/version immutability triggers must be present/enabled.
Only closed IDs, statuses, lengths, SHA and fixed boolean checks leave SQL; no
raw transcript, English text, facts, snapshot, object key or provider payload is
returned. A public receipt exposes the expected English SHA for display proof.

Root-reviewed invocation:

```powershell
python -X utf8 -B development/m03/english-version34/observe.py
```

`visible-region-proof.mjs` separates browser capture from Node hashing because
the supported CUA DOM evaluator provides neither WebCrypto nor TextEncoder.
After the actual saved-player or guest UI is opened and its transcript expanded, evaluate
only the exact reviewed `captureVisibleEnglishRegion` function body in the page.
It accepts exactly one visible `English transcript` region, requires `lang=en`,
and returns at most 400,000 UTF16 characters of `textContent` plus visibility/
language metadata **into a private CUA Node variable only**. It makes no request,
reads no storage/URL/token,
performs no byte encoding or hashing and makes no DOM write. Collapsed,
ambiguous, wrong-language or over-character-limit regions fail without carrying
text. Avoid a TypeScript-transformed
`Function.toString()` serialization; the Node imports must not enter browser
evaluation.

Run `visibleEnglishRegionProof(privateCapture, expectedEnglishSha256)` in the
surrounding CUA Node runtime. It uses standard `node:crypto` SHA256 and Node's
`Buffer` UTF8 byte length, rejects more than 800,000 bytes, rechecks the bounded
capture, and returns only closed
hash/count/language/visibility/confirmation metadata. It removes `privateText`
from the capture on both success and failure. Clear the caller's private capture
reference in a `finally` block as well, then publish only the proof:

```javascript
// privateCapture was assigned from the connected tab's supported DOM evaluator.
// Never print it or pass its text to nodeRepl.write/console, files or logs.
let publicProof;
try {
  publicProof = visibleEnglishRegionProof(privateCapture, expectedEnglishSha256);
} finally {
  if (privateCapture) delete privateCapture.privateText;
  privateCapture = undefined;
}
nodeRepl.write(publicProof);
```

There is no custom UTF8/SHA implementation or in-page encoding/crypto dependency. Clearing
references is not a promise to zeroize immutable JavaScript string memory. Source
route, session and version/video access binding still need actual app/API
evidence; the DOM hash alone does not prove those or semantic translation
accuracy. Synthetic regression tests execute the capture in a DOM-only VM with
neither crypto nor TextEncoder/Node globals, compare the actual SHA of multiline non-ASCII UTF8 text,
and assert the public result contains neither payload nor URLs and that private
capture text is cleared on success, mismatch and validation failure.

Old Ready versions, raw companions, PDFs and Reviewed facts remain a separate
before/after proof from the frozen `english-preservation34` observer. This new
capture check does not grant that old-cohort preservation, app/guest journey,
PDF byte validity, semantic accuracy or full M07 acceptance.

Synthetic-only verification:

```powershell
python -X utf8 -B -m unittest discover -s development/m03/english-version34 -p test_observe.py
node --test development/m03/english-version34/visible-region-proof.test.mjs
```
