# Old Ready-version and Reviewed preservation observer

Prepared for the English34 rollout; root reviews these helper bytes before any
cloud execution. Importing and the synthetic tests do not execute SQL, a
provider, media fetch, job or deployment. The linked CLI target is fixed to
`pyibofyctwnqpvktepse`, using the existing private login and CLI2.122.0.

The initial observation requires exact canonical33 history and the eight routine
source/attribute digests in the passed16:47 English34 preflight. That receipt and
the reviewed port-patches file are SHA-pinned. The later comparison permits only
the exact34 history and planned function after-hashes with unchanged attributes.
Legacy column/RLS metadata hashes must match across that additive change; only
the specifically approved new English columns are excluded from legacy hashes.

The read-only SQL returns identifiers and whole-row digests for every existing
Ready version, its slides, pinned assets, frozen raw transcript companions,
Ready export rows and referenced media asset metadata. It separately captures
the exact previously Reviewed candidate/media/frame rows and effective review
state. Snapshot/manifest/fact/transcript/object-key values stay in PostgreSQL;
only their whole-row hashes leave SQL. No scalar personal fact hashes are made.

Baseline is stored under ignored
`.local/m03-english-component/preservation34/baseline.json`. The existing
SHA-pinned Windows file-security implementation creates the baseline, SQL and
claim files with a protected current-owner plus SYSTEM-only DACL before writing
and verifies the ACL again. The baseline contains only metadata IDs/hashes, no
payloads. CLI stdout/stderr stay bounded in RAM and DEBUG/credential overrides
are excluded by the retained pinned CLI harness. Public receipts disclose
counts, safe checks, source pins and the whole metadata-baseline digest only.

After reviewing source and confirming no new app intake/generation has begun:

```powershell
python -X utf8 -B development/m03/english-preservation34/observe.py baseline
```

There is one permanent baseline claim. Unknown outcomes are not automatically
replayed. Preserve failed receipts, claims and baseline bytes. Do not change this
helper/test/readme source after taking a baseline: their exact source pins are
required by the later comparison.

After the new real job and newly saved version are demonstrated:

```powershell
python -X utf8 -B development/m03/english-preservation34/observe.py compare
```

All old keyed rows must still exist with identical hashes. New Ready versions,
assets and exports may increase counts; existing access-variant export rows stay
unchanged. Extra slides/asset pins/raw companions on an old Ready version are
refused, as are English cohort markers or English companion backfills on those
old versions. New versions may have their own English companions. The old
Reviewed row, raw media, frame state and effective review status stay exact.

The comparison establishes this captured old cohort's preservation. It does not
fetch or revalidate media bytes, prove the new version's English content, run an
app/guest journey, measure semantic accuracy or establish full M07 acceptance.
Those retain separate real-service evidence. There is one permanent compare
claim; source/SQL failures remain failures for root reconciliation.

Nine synthetic parser/identity/privacy/subset/backfill/schema regressions:

```powershell
python -X utf8 -B -m unittest discover -s development/m03/english-preservation34 -p test_observe.py
```

At preparation time no canonical observation or comparison has been executed.
