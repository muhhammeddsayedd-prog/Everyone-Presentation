# English pilot release 34

Prepared source only. The agent that authored this folder has performed **no
cloud SQL, provider call, deployment, image adoption or activation**. Root owns
review, the actual release, and its receipts. Previous controllers, inputs and
once-only claims remain frozen.

The existing pilot is canonical 33. The protected M02 waiting job must remain
attempt 3 / apply_specs / row_version 7. English processing is controlled by
`eps.candidate_asset_config.english_transcript_version`, initially absent, then
NULL after 34. It is not a web environment flag.

## Order

1. Finish the English display patch and backend regressions. Stage the current
   sparse web source with `development/m07/controlled-pilot/stage-web.mjs` and
   deploy to the existing web pilot. Observe the actual stable alias deployment.
2. Stage **fresh native and daemon images from the same source seal** using
   `tools/worker-hosting-build.mjs`. The old worker-forward31 and protected31
   operators pin previous source/canonical history; never replay or edit them.
   Native readiness, boundary/native smoke and daemon import checks must refer
   to this fresh seal/digest. Adopt only its public manifest hash and future
   frame image pin, preserving frozen inputs and rows, then deploy the daemon.
   Observe its actual Ready/alive 2 GiB dub1 runtime. English is still disabled.
3. Root reviews the six actual deployment/source/native/adoption receipts and
   writes the local admission file described below. Run `preflight`, review its
   exact 33 metadata hashes, then `apply`. Apply retains an exclusive claim
   before dispatch, checks the same state inside the transaction, applies the
   unchanged migration, records its history, and checks the exact intended delta.
   Two independent reads verify the committed state. Any unknown dispatch is
   reconciled with **readback only**, never a repeated apply.
4. `readback` must pass before `enable`. Enable has its own exclusive claim and
   exact 34 comparison; its only update is NULL -> 1.0 on the existing enabled
   config row. It preserves all other state. Then process one controlled new
   job through the app/n8n/OpenAI, save a new version and test internal/guest
   English playback. Compare old Ready rows/PDFs and Reviewed candidate facts.

All CLI commands run from the repository using the existing pinned CLI login:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/test_release.py
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/release.py preflight
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/release.py apply
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/release.py readback
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/release.py enable
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/release.py enable-readback
```

## Root-reviewed deployment admission

The missing file `.local/m03-english-release34/deployment-admission.json` prevents
apply/enable. It is a root review record, not fabricated provider evidence. It
must have exactly `target` (pyibofyctwnqpvktepse), `english_disabled` (true), actual
new `web_deployment` / `worker_deployment` IDs, and `references`. The latter has
exactly six keys: `web_ready`, `web_source`, `worker_runtime`, `worker_source`,
`native_smoke`, `manifest_adoption`. Each is `{path,sha256}` pointing to the actual
public receipt under tracking/evidence. Root must inspect their semantics and
cross-bind deployment IDs, source seal, native/daemon images, English fields/UI
and flag-off DB state. The loader checks paths/hashes and prevents reuse of the
old Ccw/CVDM deployments; it does **not** infer deployment compatibility merely
from the existence of a JSON file.

## Fresh public native adoption

The three native helpers are root-executed and use their own new claim paths.
After actual native readiness, final daemon image/import proof and the fresh
native smoke complete, prepare the offline native binding (the three trailing
arguments are actual public receipt paths):

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/native_admission.py <native-ready-receipt> <daemon-import-receipt> <native-smoke-receipt>
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/native_manifest.py inspect
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/native_manifest.py apply
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/native_manifest.py readback
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/native_pin.py inspect
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/native_pin.py apply
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-release34/native_pin.py readback
```

This pins the actual run 4186fd1e-55c7-4ea5-956e-ad9ad92f64b1 / source b3489d64 /
160 files, verifies every sealed context file and public manifest, and invokes
the pure `native-probe34/admit-native-probe34.mjs` proof validator. It requires
all nine native tasks, substantive PDF checks, 10 cleaned resources and session/
snapshot/lock fences. No token, provider call or job occurs during preparation.

Manifest adoption reads all 28 environment IDs/types/targets/timestamps using
decrypt=false, reads only the already public manifest value, then PATCHes only
that same environment ID/value. The CLI may internally retry that same-value
PATCH; no exact wire count is claimed. It preserves every other environment
entry. A timeout cannot create a process-return proof and remains unconfirmed.
Frame adoption requires the successful manifest proof, exact canonical 33/drain,
the exact old image and absence of frame-config triggers; only the future image
pin changes. Both compare all stored data and protected M02 metadata. Deployment
of the matching daemon is a separate root action after adoption.

## Preserved and intentionally changed

Apply hashes all existing candidate facts/Reviewed metadata, source/raw media,
workspace selection, version rows/slides/asset pins/raw companions/PDF asset
metadata, processing configs, settings, all job inputs/results, outbox rows,
stage payloads, frame requests and specs. Only the new English columns are
subtracted when comparing old row bytes. The separate frame configuration is
compared in full; native pin adoption is an earlier, separate intended delta.
All eight patched routines retain their complete pg_proc attributes. The fixed
33 OAuth/Auth catalogue/security snapshot is preserved, including no Auth schema
USAGE for the consent coordinator. The new companion table must be empty with
forced RLS, narrow roles/immutable trigger; helper bodies/owners/ACL denials match
the exact migration. All old media remains not_captured, old versions NULL.

These SQL hashes establish stored metadata preservation, not a cloud media
restore or a download/playback assertion. Completed local recovery and owner
Claude acceptance carry forward unchanged. Screen-reader acceptance remains
pending; mobile remains skipped. Keep the hosted pilot running.

Disable future opt-in as a forward config change if needed. Already frozen
English jobs still require the compatible worker. Do not roll back to the old
strict SDK, drop columns, backfill old versions or rewrite Ready content.
