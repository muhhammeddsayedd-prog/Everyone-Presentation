# Disabled Main-scoped diagnostic storage correction

This small new purpose preserves7c251681 and all consumed source/claims. That run
ended with a closed Python bridge error before any diagnostic artifact or COMMIT
was confirmed. No poststate or acceptance is inferred from it.

The source issue is a workspace boundary: the reviewed private-file guard is
Main-scoped, while the prior diagnostic path was in the sibling worktree. The
correction stores only the two closed diagnostic files at:

```text
Main/.local/reason40-main-diagnostics/<fresh run UUID>/diagnostic.claim.json
Main/.local/reason40-main-diagnostics/<fresh run UUID>/diagnostic-poststate.json
```

`local.py` delegates rendering/comparison to the frozen ACL helper. Only private
claim/capture handling is local: the existing Main guard creates the files with
the same owner/SYSTEM ACL, exclusive create, verification, flush/fsync and hash.
The fresh Main run directory is created exclusively for the claim. No old file
or directory is overwritten. Private artifact references explicitly say
`workspace:'Main'`. Directories/artifacts remain as evidence after Docker cleanup.

There is no guard replacement, ROOT/global/cache modification, new I/O subprocess
port, new generic I/O layer, canonical transport copy or privilege change. The
existing bridge subprocess is reused with only its script URL changed. The
read-only actual path-guard test accepts this precise Main location and rejects
the sibling equivalent; it creates no real file or marker.

All SQL, collector/checkpoint/render bytes, ACL/type guards, diagnostic phase,
zero-difference rollback gate and single guarded COMMIT acceptance are byte-exact
from the reviewed ACL version. In particular state1e9ee34b, checkpoint061ba5e2,
config95e9, qualification9ca7 and migration08bf are unchanged. The Python helper
still captures full normalized poststate/closed attribute metadata privately and
returns only bounded differing paths/hashes. A nonzero difference or unknown
result still stops before COMMIT. No acceptance gate is relaxed.

The new opt-in wrapper/namespace uses `eps-r40m-<fresh UUID>`, labels
`eps.reason40main.*` and sibling private runtime records at
`.local/reason40-main-store-validation/<fresh UUID>/`. Only the two diagnostic
artifacts use Main. Shared lock, network-none PG17, exact38→39 restore, synthetic
config/three-row qualifications, original29 preservation and exact resource
cleanup remain unchanged. No previous claim/main is replayed.

The latest canonical entry inherits all existing phase/transport/checkpoint
behavior, injects the query-identical Context, and adds the new storage/source
provenance to admission. Operational READ/APPLY pairs, intermediate entry flags
and the new local flag remain false. Root reviews this concrete source/plan
before separately authorizing any new owned run; no owner approval is added.

Four focused tests exercise the actual read-only Main path guard, fake Main-only
capture/exclusive claims, exact frozen query/case source identity, generated Node
syntax, delegation and default-off refusal. Fake-file checks do not claim actual
Windows ACL creation or SQL execution. No new local run, diagnostic, nonce or
canonical checkpoint exists in this preparation.

```powershell
& '<Main>/.venv-skills/Scripts/python.exe' -X utf8 -B -m unittest discover -s development/m07/review-link-reason40-main-diagnostics -p test_storage.py -v
```
