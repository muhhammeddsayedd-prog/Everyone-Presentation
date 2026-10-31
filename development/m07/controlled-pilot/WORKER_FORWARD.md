# Worker packaging forward adoption

These are distinct forward-only operators. The successful initial environment
transfer `158e4d1e`, frame apply `b4a9ccd1`, frame readback `cb967b64`, their
original sources and their permanent claims remain unchanged.

The new plan binds actual context `77e14c2e-5ae9-4aa6-aec0-636f789c4625`, source
`3790b2b3…`, native digest `5e250047…`, and baked manifest hash `ea963472…`.
Actual native full-smoke receipt `7e99318e` and packaged daemon import receipt
`2026-10-31T00-48-27.722Z-packaged-daemon-image.json` are SHA-pinned in the plan.
Admission verifies all nine native operations, ten stable cleaned resources and
the final UID 1000, network-disabled production import. The final plan and helper
hashes now bind these actual observations. They do not establish business-job or
provider-service acceptance.

Root executes after those proofs, while owned workers and candidate/frame
submissions are quiescent:

```powershell
python -X utf8 development/m07/controlled-pilot/worker-forward.py inspect
python -X utf8 development/m07/controlled-pilot/worker-forward.py apply
python -X utf8 development/m07/controlled-pilot/worker-forward.py readback
python -X utf8 development/m07/controlled-pilot/future-frame-forward.py inspect
python -X utf8 development/m07/controlled-pilot/future-frame-forward.py apply
python -X utf8 development/m07/controlled-pilot/future-frame-forward.py readback
```

The environment operator checks all 28 existing production keys, types and IDs.
It reads the value of the single existing plain `EPS_NATIVE_MANIFEST_SHA256`
record, then sends one logical same-ID PATCH whose body contains only the new
public manifest hash. Two independent observations verify the value and all 28
IDs/classifications/scopes. No private loaders, bulk decryption, secret transfer
or deployment occurs. Unrelated values are not compared or hashed; their
preservation follows the one-record API scope. The edit endpoint has no
compare-and-set guard, so root remains the sole project environment operator
during this transition. CLI retries may resend the same-ID, same-value PATCH.
The helper has a 180-second overall deadline and at most 12 CLI commands, each
with at most 30 seconds remaining. Raw CLI output stays in memory.

The frame operator changes only future `native_image_id` from the actual
`7846b459…` pin to the actual plan digest. Its SQL retains the reviewed canonical
30 history/target checks, table locks, no-active-native-job/no-leased-native-outbox
guards and before/after fingerprints for frozen inputs, requests, media, Ready
snapshots and protected M02 state. Existing job inputs are never rewritten or
retried. Its SQL is a copy of the prior reviewed transition with the fixed old
pin, result identifiers and guard labels changed. This is DML, not a migration.

Each apply writes a different permanent exclusive, fsynced claim before its
single logical dispatch. A separate claim-bound normal-return marker is written
only immediately after the actual write subprocess returns, before response
parsing. A parent timeout cannot mint that marker. Apply and standalone readback
require it before granting application/preservation credit, even if the desired
value is currently visible. Matching values without a marker remain observations
with an unconfirmed result. No source path manufactures a marker after a timeout,
kills an unknown process, retries a write or removes a claim.

Both operators validate the complete public source inventory before reading any
listed file, then verify every one of the 156 source hashes, the owned context,
the baked manifest and the three successful historical receipts. Known target,
preload, TLS override and debug environment blockers are checked before CLI use.
Public receipts omit raw output and private values/digests. These operations
establish config adoption only; startup, jobs, provider services and business
results require separate actual evidence.

The API forms were checked against the official [same-ID environment edit
endpoint](https://vercel.com/docs/rest-api/projects/edit-an-environment-variable)
and [single environment-value read
endpoint](https://vercel.com/docs/rest-api/projects/retrieve-the-decrypted-value-of-an-environment-variable-of-a-project-by-id).
