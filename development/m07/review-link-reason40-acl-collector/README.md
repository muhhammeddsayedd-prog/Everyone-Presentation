# Disabled ACL-shape Context and rollback diagnostic

This is a new source version after retained66bca8e3. Every consumed source,
controller, claim, failure and intermediate plan remains unchanged. The new local
flag, new canonical flags and all historical canonical flags are false. No SQL,
Docker, provider or canonical call has occurred in this purpose.

The66b failure reached `REASON40_POSTIMAGE_CHANGED` before COMMIT. Source review
found a definite component: existing `eps.audit_events.request_id` has legitimate
column grants in the exact639 dump. The old shape predicate required its ACL to
be null and compared it directly to the new reason column. This was too strict
for a valid new nullable column; it did not authorize changing the old grants.

`context.py` inherits the frozen typed Context and overrides only `reason_sql`:

- Require **new `reason.attacl IS NULL`** independently.
- Compare the other complete `pg_attribute` fields, excluding only name, ordinal
  and ACL from this shape comparison.
- Preserve the reference column's ACL through the unchanged full old identity
  and catalogue checks. New reason catalogue ACL must separately remain null.

No privilege is copied or granted, no old ACL is skipped in preservation, and no
other field/permission/source patch/timeout is changed. Full collector/checkpoint
inverse comparisons prove the exact clause difference from the typed predecessor.
The six-key text-array correction and migration08bf remain unchanged.

## Diagnostic phase before the one correct commit

The new owned Context inherits the same strict owned identity qualifications.
The JSON bridge creates an exclusive protected `diagnostic.claim.json` before
the diagnostic SQL. Unknown claims are retained with no automatic replay.

The diagnostic SQL is derived from the actual guarded rendered transaction. It
retains the same locks, exact preimage assertion, unchanged migration/inner
guards and sole history insertion. Only the outer final postcondition assertion
and COMMIT/nonce tail are replaced with a closed normalized-state/attribute
SELECT followed by **ROLLBACK**. The original correct COMMIT transaction and its
full postcondition guard are untouched.

The actual normalized poststate plus the new/reference attribute metadata are
saved to protected
`.local/reason40-acl-collector-validation/<run>/diagnostic-poststate.json`.
This is synthetic owned rollback evidence, never a canonical checkpoint or
restore claim. Private creation uses the existing owner/SYSTEM Windows file
guard, exclusive create, flush/fsync and readback hash. Raw state/attributes are
never put in public receipts or stdout.

Comparison emits only differing JSON paths and SHA256 pairs, at most100 entries,
with depth32 and a truncation flag. Type differences are retained. The existing
16MiB SQL capture and private-file bounds,32MiB bridge input,8MiB bridge output,
15second bridge timeout and SQL timeouts remain unchanged. Overflow, malformed
capture or any difference refuses continuation. The preimage must be read back
exactly after rollback even when differences are present.

Only zero differences, no truncation, equal normalized hashes and exact rollback
readback permit the **single unchanged correct guarded COMMIT transaction**.
Its normal nonce, two post-commit collectors, full76 checkpoint/row/catalogue/
identity comparisons and cleanup are still required. A diagnostic result never
fabricates a normal COMMIT nonce. Failed diagnostics retain their private capture
and safe difference summary so another broad run is not needed merely to inspect
the mismatched components.

## Finite source composition and ownership

Frozen Node test functions are projected into a new private module with only
three declared changes: bridge URL, the two closed diagnostic actions, and the
bounded diagnostic block before the unchanged positive transaction call. The
inverse source check proves all other test code unchanged. The new false wrapper
precedes target/library use. The same valid synthetic config95e9, three busy-row
qualification9ca7, normal version trigger, five setup-table scope, native46 string
and full76 preservation remain unchanged. No canonical configuration acceptance.

New resources use `eps-r40a-<fresh UUID>` / `eps.reason40acl.*`, with private claims
under `.local/reason40-acl-collector-validation/<fresh UUID>/`. The normal shared
Main lock, network-none PG17 image/verified38→39 bootstrap, original29 data/
catalogue/global-role preservation and exact owned cleanup remain unchanged.
The existing public `reason40-collector-validation` family is retained.

The latest canonical entry subclasses the prior thin entry and injects the new
Context. Existing phase, transport, claim, nonce and checkpoint methods remain
inherited. Admission additionally requires the actual zero-difference rollback
proof, exact query hashes and every new/intermediate source seal. It does not use
the intermediate typed entry's narrower old proof predicate. Future arming is
only the latest entry and original orchestration library's intended flag pairs
before prepare; intermediate entry flags stay false. Both operational pairs stay
false now, and both use the reviewed flag-only source normalization.

## Current source checks and pending execution

Seven focused pure tests exercise the nonnull reference/null new ACL regression,
exact query/guard differences, diagnostic SQL/PLpgSQL parsing, bounded paths/hash
redaction, fake private capture/exclusive claims, inverse projected Node source,
and default-off refusal. Fake-session execution proves a diagnostic difference
causes zero positive transactions, while equality allows exactly one. These fake
checks are not SQL, CHECK, Windows ACL or production acceptance.

```powershell
& '<Main>/.venv-skills/Scripts/python.exe' -X utf8 -B -m unittest discover -s development/m07/review-link-reason40-acl-collector -p test_acl.py -v
```

Root must review the source/disabled plan before any separate flag arm and ONE
fresh owned run. Actual diagnostic equality, normal40 commit, complete checkpoint
preservation and cleanup remain unverified by this source preparation.
