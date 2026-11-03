# One-statement slide insertion candidate

Source preparation only. `ENTRY_ENABLED = False`. No database, Docker, provider,
migration, benchmark or proof runner is included. This candidate has no measured
performance result and does not release production SQL.

## Exact source boundary

`candidate.py` loads the inert `presentation-asset-pin-batch/candidate.py` only
after verifying its fixed raw SHA:
`e6c41fb88f2d665c9b1b41982915339dc598f75dc2e90ff50e745ea63faa8d5a`.
That predecessor retains its own frozen four-body builder and metadata pins.
The optional `source_root` argument selects a checkout for offline assembly; it
does not replace the fixed relative path or any source seal. The default uses
the containing repository, so a later Main integration uses Main dependencies.

The sole body edit replaces GEN41fe's three-line `version_slides` INSERT loop:

- Before body: `41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d`.
- Candidate: `af486a7217ed5ddafea5d98dc2979d928a8e9ba675862ef0960c2930b362b198`.

Both full function attributes and body line count remain unchanged. The inverse
restores the complete previous definition byte for byte. `before-body.sql`,
`candidate-body.sql` and `body.diff` are exact review artifacts, not migrations.
The unused old `item` declaration is retained to keep this a one-block edit.

## Preserved values and order

The source is the existing private `slides` JSON array. No table reread, extra
text/full-row cache, new limit, filtering, DISTINCT, conflict handling or
RETURNING clause is added. The query uses WITH ORDINALITY and orders by actual
array position. It does not replace the stored ordinal with that position.

| Target column | Unchanged value |
| --- | --- |
| id | Item `id`, cast to UUID |
| version_id | Existing function-local version UUID |
| ordinal | Item `order`, cast to integer |
| kind | Item `kind` text |
| source_assignment_id | Item assignment UUID, including NULL |
| source_slot_id | Item slot UUID, including NULL |
| snapshot | Complete original item JSON |
| content_sha256 | `eps.presentation_hash` of that same item |

The `s.item` qualifier avoids collision with the retained PL/pgSQL `item`
variable. Its source alias exposes only item/slide_position, so `version_id`
still resolves to the original function variable.

The guard skips INSERT for an empty array or SQL NULL, as the old loop skipped
its body. Normal generation always constructs the cover before this point.
The old empty loop's FOUND value and its last `item` value can differ from the
new guarded statement; neither is read in the unchanged suffix. No empty-path
INSERT privilege or target-policy check is introduced.

All prefix validation, page limits, snapshot/manifest byte budgets, canonical
hashes, inventory cardinality, job and queued-version writes are byte-identical.
The complete suffix is also identical: asset pin batch, raw capture call,
series UPDATE, outbox write and public idempotent return. The candidate does not
alter the raw/English companion definitions or their fresh scope checks.

## RLS, constraints and concurrent authority

Frozen metadata SHA
`12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c`
contains the existing slide PK, unique `(version_id, ordinal)`, and FKs to the
version, assignment and slot. Its only slide trigger is immutable BEFORE
UPDATE/DELETE; there is no slide INSERT trigger. No DDL, policy, owner, ACL,
execution mode, search_path or constraint changes are included.

`presentation_slide_insert` still requires a queued version and
`presentation_scope(v.workspace_id, true)`. The version lookup is itself under
the unchanged `presentation_version_read` policy. Per-row RLS and constraints
remain enforced. No capability, membership, session or clock result is cached.

One INSERT uses one command snapshot instead of several commands. Concurrent
revocation visibility and error precedence are therefore not claimed identical.
The source-locking fence, later raw/capture fresh scope checks, series UPDATE
policy and public return path remain intact. A future owned proof must retain
the existing revoke/expiry and full rollback requirements; this source check is
not that proof. Dispatch order and row values are preserved, but a batch can
detect an error at a different execution point before the same transaction
rolls back.

The opportunity is fewer per-slide command boundaries. PL/pgSQL already caches
plans; this is not a claim of repeated parsing, fewer RLS evaluations, an
identified c20 hotspot or an eight-second generation success. Earlier diagnostic
intervals cannot be relabeled as isolated slide INSERT cost.

## Offline validation

Using Main's isolated Python environment from the author worktree:

```powershell
& 'D:/Everyone/Presentation/Everyone-Presentation-Studio/.venv-skills/Scripts/python.exe' -X utf8 -B -m unittest discover -s development/m07/presentation-slide-insert-batch -p test_candidate.py -v
```

The actual old-loop regression was RED (one failure), then GREEN after the
candidate changed the INSERT source query. Final six focused tests passed.
They parse the complete PL/pgSQL and both SQL statements, compare all eight
expressions/casts/NULL/hash arguments and attributes, verify array ordering,
reject reversed order/stored-ordinal/hash mutations, check frozen DDL/RLS and
trigger shape, and compare exact inverse/artifact bytes. No SQL was executed.
