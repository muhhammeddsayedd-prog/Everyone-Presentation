# Exact original-profile29 comparison review

The original migration bytes, reserved version, frozen plan, fbc clone proof,
first promotion helper and failed1cf precondition receipt remain unchanged.
The new tooling changes the comparison source only; it does not normalize ACLs,
ignore a catalogue hash, run a reset or alter executable migration29.

The first original-profile attempt preserved its source and failed before
candidate DDL because re-granting PUBLIC USAGE appended that ACL entry. The
additive v2 reproduces the original observed USAGE grant order inside the owned
clone, restores the exact explicit owner ACL and recreates only the four original
BETWEEN-derived CHECK representations. It then requires exact equality for all
16,103 raw catalogue fields and unchanged safe data/configuration/Auth counts.

The passed e56dec11 rehearsal applies frozen SHA6531 inside a clone transaction
and rolls it back. Its exact after delta has the same created fields and same29
changed fields as fbc. Only public-schema ACL before/after strings retain the
original PUBLIC USAGE entry. The protected catalogue hash remains exactly
`5a48e35b64005943ca425860689f571a4dd4332bdc4681d4d858672cb4d250ca`
before and after. Original28 metadata/data and existing role OIDs remain exact;
the clone was removed and the shared lock released.

`release29-original-profile.json`, SHA
`681fe120fea3ee70e35bd2c4ab4734e2b95e89e40ceef5a678f857adfa673cc2`,
binds the exact plan/migration, fbc proof, full metadata reconciliation, actual
original-profile rehearsal, raw before/after states and original-profile delta.
`tools/m07-original-profile29-comparison.mjs` pins that SHA and verifies all
upstream source hashes and proof flags before returning it.

`tools/promote-m07-local29-current.mjs` accepts only `inspect`, `promote`,
`readback`. It verifies exact reviewed29 source history, the owned database
fingerprint and unchanged original role OIDs, and owns the shared test lock.
Before promotion it requires the entire raw current snapshot to equal the
original-profile before state. The exclusive original promotion claim path is
shared with the first helper. It refuses any previous possible dispatch. A claim
precedes one reviewed migration call, followed by independent exact readback.
Unknown outcomes retain claim/lock; readback validates their source, before-state
and container/system identity before releasing a reconciled lock. Six offline
tests cover the actual refused snapshot, clone/hash/permission/data/history
denial, claim ordering, exact29 after state and unknown-outcome no-retry.

No current-helper database command or promotion retry has been executed by the
database agent. The Auth30 agent was notified that the shared test window is
free. Root owns scheduling the next inspection/promotion after review.

The proposed cloud-review integration is deliberately separate and is not yet
implemented:

1. Add one required `original_profile_review` path/SHA pair to the unsealed cloud
   review configuration. Verify this review manifest and every linked source,
   comparison module, original-profile rehearsal and delta. Keep the original
   frozen plan, fbc proof and first promotion helper as unchanged evidence.
2. Require an actual passed current local promotion receipt with its exact
   `comparison_profile` SHA and current helper source seals. Compare its raw
   before/after against the pinned original profile, including exactly one29
   history append, rather than comparing against the dump-normalized fbc states.
   An independently reconciled local readback may substitute only when it binds
   the original exclusive claim and proves the same exact after state.
3. Return the original-profile delta as the cloud helper's comparison delta.
   Require its created values and28 non-public-ACL changed values to equal the
   original frozen delta exactly; require both public-schema ACL strings to add
   only the already observed PUBLIC USAGE entry to the frozen profile. The
   executable migration remains SHA6531.
4. Keep canonical preflight strict for all selected delta values. Keep the
   actual canonical protected hash, old data/Auth/configuration and runtime12
   exact before-to-after. Do not substitute the local protected hash for a
   canonical baseline, whose managed Auth catalogue can differ from the local
   synthetic subset. An unknown canonical discrepancy still blocks release.
5. Retain fixed target, no seed/Vault/configuration actions, fresh quiescence,
   once-only protected claim, one push and independent readback unchanged.

The unsealed cloud helper/freezer have not been edited for this linkage. Root
must review this bounded integration before those edits or any canonical action.
