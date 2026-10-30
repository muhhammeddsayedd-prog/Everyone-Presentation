# M06 database slice

Current owned local history is26. Migration25 below remains a retained
historical release; the bounded forward26 adds backend credential provenance
and scoped guest retry. Canonical release and app observations are owned by
root's separate receipts. No hosting acceptance is claimed here.

The first numbered additive migration is
`supabase/migrations/20261030002634_m06_guest_review_feedback_exports.sql`,
SHA256 `2c72507216efdcd3e9dcea3f9b94270b19e1275ebcd2fcf91dad9253ddde8d2a`
(130,807 bytes). The seven original fragments, candidate, baseline24 manifest
and [frozen release control](frozen-release.json) are retained. Do not edit or
rerun the guarded24-to25 migration on a later history.

This slice adds private links, opaque guest sessions, version-slide feedback,
preferences, link-scoped exports/media grants, backend HMAC configuration,
nonce/rate budgets and transient Storage grants. No new login, Auth identity,
public bucket or hosting choice is introduced. One narrow NOLOGIN function
owner has only the new tables and required frozen presentation reads. The old
eleven runtime operations retain their contracts; mint_review_media_grant is
the single additive operation12.

The permanent tables store token digests. Anonymous digest possession alone
does not authorize a gateway request: a distinct server-held HMAC proof binds
the exact operation/input, timestamp and single-use nonce. The server key is
absent and the gateway disabled in the migration. Creation/rotation response
replay is encrypted, scoped to the acting principal and semantic request, and
expires after24 hours. Expired ciphertext is nulled by the existing recovery
poll as well as valid guest activity. No raw link/session/grant token enters
the jobs, outbox or normal request SQL.

Guest reads use an explicit closed external version projection. Its frozen
series, audience snapshot, output and template must match the share scope.
Feedback records the exact viewed immutable slide/version. External feedback
is visible across links to that series; internal comments are filtered in SQL.
Same-name browser sessions remain separate owners. Preferences never update
casting positions. A series without a Ready version may be shared and returns
the explicit Preparing state, as required by M06.

Exports use frozen M05 snapshots and separate PDF assets. Only access links may
change. Rotation fences old sessions, grants and caches; expiry edits update
only non-revoked grants, including naturally expired grants. Download-disable
gates new preparations/downloads without revoking valid viewing or PDF video
grants. Actual worker processing is independently documented by its owner;
injected SQL artifact metadata is not native/PDF/browser acceptance.

## Observed local evidence

- [Final composed behavior](../../tracking/evidence/m06/guest-local/2026-10-30T00-24-31-067Z-6e803f6f.json): actual authenticated, anon and constrained worker roles on isolated local24, complete candidate/fixtures rolled back; HMAC and nonce enforcement, default30 days, encrypted response replay/mismatch, two-link external feedback, same-name ownership, stale revisions, independent assignment preferences, private note filtering/moderation, old fixed versions, expiry/extension/no-revival, download toggle, rotation/revoke, Preparing/internal-series rejection, worker TTL cleanup and10,000 Unicode codepoint boundary. Export claim/mint/output/commit/replay, failed attempt/retry/cancel are composed with the worker's focused SQL proof. These are synthetic local transactions, not a human browser session.
- [Exact release/readback proof](../../tracking/evidence/m06/release-local/2026-10-30T00-25-22-980Z-da1db68f.json): every old selected business field excluding credential columns, managed Auth metadata/counts, catalog/defaults/Storage and role metadata are unchanged outside the exact declared delta. New configuration is disabled/key-absent; new tables are empty except the single configuration row. Full outer rollback is verified. Auth user bodies and credential values/digests/ciphertext are excluded before serialization; no raw key or key-derived checksum is emitted.
- [Owned local25 promotion](../../tracking/evidence/m06/promotion-local/2026-10-30T00-26-51-581Z-e6dad39a.json): one exact reviewed DDL/history promotion, matching the independently proven readback. No fixtures, activation, key provisioning or cloud call. Shared local SQL lock released after exact comparison.
- [Actual current25 key bootstrap proof](../../tracking/evidence/m06/guest-pgp-local/2026-10-30T00-28-16-044Z-68ea7a1c.json): PostgreSQL-generated transient32-byte key, public-recipient PGP response, actual decryption/nonce-HMAC check over private IPC, repeat write changes zero rows, SELECT-only recovery and malformed public-recipient logging canary. Raw key variants are absent from SQL, statement statistics, error output and the observed owned server logs. Key-only changes roll back; disabled configuration and all other state remain exact. The earlier24/candidate proof and original runner remain unchanged; the current pointer update is recorded separately.
- `python -X utf8 -m unittest tests.operations.test_m06_review_release`:20 pure regression cases passed. These verify precise delta and one pending migration, old business/Auth/catalog preservation, runtime permission limits, immutable initial configuration, route/environment guards and one-shot apply admission. No CLI, private configuration or cloud call is made by that suite.

## Canonical release boundary

[review-release.json](review-release.json) pins36 dependencies and the current
proofs. `tools/release_m06_review.py` validates those inputs before any CLI
access. Root owns its independent review and actual `inspect`, `dry-run`,
single `apply`, and `readback`. An exclusive protected claim and retained
attempt precede the one write; an unknown result allows only readback. Raw CLI
diagnostics are private. `inspect_state` emits only key presence/length and
public configuration metadata, so root can compare state again around the
separate encrypted bootstrap. The old managed Storage shape is unchanged; no
new bucket is created.

This document does not claim canonical release, a real guest/PDF/video journey,
production security, external Claude OAuth, restore acceptance or hosting.
Those observations belong to root's later receipts and M06 acceptance matrix.
The remaining M03 labelled English/mixed semantic checks stay unverified.

## Bounded forward26

`supabase/migrations/20261030004643_m06_credential_admission_guest_retry.sql`
is10,602 bytes, SHA256
`a0fb9dfec8cdae2718719d455ed11b4f25dd9b79e8fc9de19bd53c229b64089e`.
[Its frozen control](frozen-forward26-release.json) retains baseline25 and both
new fragments. All25 SQL, source controls, helpers and historical receipts are
unchanged. A human scope-label typo in the new control was corrected before
promotion; its original bytes and explanation remain under
`forward26-source-history/`.

An acting-user project/capability check is necessary but cannot attest token
entropy or encrypted response provenance. The new private guest-owner verifier
checks a fresh backend HMAC over actor, operation, subject, semantic request,
Idempotency-Key, token digest, ciphertext, timestamp and nonce before either a
create/rotation effect or a cached acknowledgement. Authenticated/anonymous
callers cannot execute it directly or read its key. Same-key lost-response
recovery still returns the original ciphertext after a fresh valid backend
proof. A repeated nonce is denied even when the business acknowledgement is
already cached; rollback removes both nonce and incomplete business effects.
HTTP/MCP interfaces remain unchanged.

The same guest prepare operation can now retry its live link's failed export.
A narrow private stage-owner function checks parent/session/version/cache,
current original requester authority and immutable input. It requeues the same
job/export, revokes the failed grant, resets only render_export's budget and
advances dispatch generation. Attempts remain monotonic; the next lease,
grant and output reservation are fresh. Cancelled exports remain terminal.
No operations.retry permission, new login or arbitrary job update is granted
to guests.

- [Credential RED](../../tracking/evidence/m06/forward26-local/2026-10-30T00-41-48-686Z-a7ace6f0.json) observes unsigned direct credentials accepted on25; [retry RED](../../tracking/evidence/m06/forward26-local/2026-10-30T00-44-41-021Z-b950582a.json) reaches the failed-export-not-requeued assertion. Both fully roll back. The latter receipt's generic credential-RED field is false because it describes the separate retry assertion; its retained diagnostic identifies that exact failure.
- [Combined GREEN](../../tracking/evidence/m06/forward26-local/2026-10-30T00-45-20-762Z-a7493d50.json) uses actual authenticated/anon/worker roles and synthetic frozen external versions. It closes all MAC binding, forged/unsigned/replayed proof, fresh acknowledgement, current authority, nonce/row rollback and failed-export retry/cancel/scope/lease/grant/output checks.
- [Exact forward delta/readback](../../tracking/evidence/m06/forward26-release-local/2026-10-30T00-46-20-101Z-255c7bf7.json) includes established M06 rows, while excluding credential columns before SELECT/serialization. All old noncredential data, managed Auth metadata/counts, configuration, catalog/defaults and runtime authority remain exact except the declared function/column-permission additions. Configuration remains disabled/key-absent; DDL is fully rolled back.
- [Owned26 promotion](../../tracking/evidence/m06/forward26-promotion-local/2026-10-30T00-47-05-436Z-b1d4bb7b.json) applies once and verifies the exact proven state/history. [Separate actual26 PGP proof](../../tracking/evidence/m06/guest-pgp26-local/2026-10-30T00-47-44-196Z-0452cfe8.json) verifies root's new26 compiler and all source seals, actual roundtrip/recovery/canary and complete rollback. Its `activation_private_configuration_read:false` is explicit. The original24/25 PGP runners and receipts are retained.
- [Actual26 two-session race](../../tracking/evidence/m06/race26-local/2026-10-30T00-50-26-315Z-11c39589.json) uses Node's actual canonical JSON/HMAC and fresh backend nonces. Concurrent same-key create/rotation return one exact original acknowledgement/effect; two authorized principals fence a stale update and share one export job/cache. Real lock waiting is observed before first commit. A task-owned template0/schema-filtered pg_dump clone excludes Auth rows, password dumps and large objects; no existing managed session is stopped. The clone is removed only after owner/shared-comment/OID checks, and the original26 readback is unchanged. This is concurrency acceptance, not an assertion that pg_dump preserves every catalog byte.
- The new `tests.operations.test_m06_forward26_release` suite passes20 pure release-boundary checks. [forward26-review-release.json](forward26-review-release.json) pins31 dependencies for `tools/release_m06_forward26.py`; its current input validation passed without CLI. Root owns review and sequential canonical inspect/dry-run/one-apply/readback, plus the separate26 bootstrap and Producer capability helpers. Old25 helpers must not be rerun against26 history.

Failed clone infrastructure probes are retained. PostgreSQL refused copying
the active postgres database because two managed sessions were connected; the
successful approach uses template0 plus the existing schema-filtered dump
pattern. A shared-database-comment guard typo was corrected, and the exact
run-owned temporary database cleanup has its own retained addendum. Neither
failure changed the canonical local business/catalog state.

## Separate guest26 activation preparation

[enable-guest26.sql](enable-guest26.sql) updates only the guest gateway's
enabled flag after exact26 history, a present32-byte verifier, fixed TTLs,
enabled presentation processing, protected M02/manual text and global idle
checks. It locks jobs and outbox while observing idle, and refuses unexpected
configuration triggers/rules. Neither the key nor a key-derived digest is
selected. The only full-readback differences permitted are the enabled
metadata flag and its explicit public-column projection hash.

- [Owned26 rollback proof](../../tracking/evidence/m06/guest26-readiness-local/2026-10-30T00-56-10-533Z-9b06baf4.json) verifies the actual one-flag SQL, four real SQL negative preconditions, repeat denial, exact full state comparison and complete synthetic fixture/key rollback. The initial nested readback parsing failure is retained separately; the successful harness removes the trailing transaction terminator before nesting.
- `tests.operations.test_m06_guest26_enable` passes14 pure helper checks for exact deltas, bootstrap metadata preservation, readiness, source-bound12-operation startup, five repaired workflow stages, new worker ownership/mode, proof freshness and one-shot claims.
- `tools/enable_m06_guest26.py` is inert on import. Its configuration SHA is deliberately unset until root binds actual26 cloud apply/readback, bootstrap plus full metadata-only preservation, repaired WF03/probe and fresh startup/worker observations using [the template](guest26-activation.template.json). It retains an attempt and takes an exclusive protected claim before one flag write; unknown outcomes admit only read-only recovery. Historical setup graphs and unrelated test seals are not activation inputs.

These artifacts do not establish canonical guest activation, current worker
readiness, a real guest journey or hosting. No activation configuration or
private runtime key was loaded or created by this preparation.

## Storage policy forward27

The live [Storage diagnostic](../../tracking/evidence/m06/storage-diagnostic/2026-10-30T01-25-32-271758Z-fixed-storage.json)
returned NoSuchKey for all eight tested object/header variants despite successful
gateway asset authorization. The permissive guest policy did not satisfy the
older restrictive Storage policies. A real-role [RED26 transaction](../../tracking/evidence/m06/storage-rls-local/2026-10-30T01-32-59-816Z-5cc07f63.json)
reproduces the zero-row anonymous frame read through `storage.objects`.

The initial four-policy candidate passed every guest access/lifecycle check but
[failed internal export access](../../tracking/evidence/m06/storage-rls-local/2026-10-30T01-34-44-331Z-8a04f29d.json).
Its existing review-owner helper also lacked RLS visibility of the separate,
unpinned export PDF metadata. Original candidate/input bytes remain in
`storage27-source-history/`; no such candidate was promoted or applied.

The final4954-byte migration is
`20261030013832_m06_guest_storage_policy_composition.sql`, SHA256
`9e3ab85655c2fa0490aba07118fe730dae2c6193f651c3ba086910d82b7eb171`.
It preserves the existing three restrictive expressions and adds guest GET/info
access through the existing exact asset capability, bounds the guest permissive
policy to those read operations/four private buckets, and composes internal PDF
GET/info/sign with existing manage/project/current-parent checks. One acyclic
media SELECT policy gives only the existing review owner visibility of current
Ready export PDF metadata. It changes no function, owner, ACL, role, bucket,
credential, TTL, configuration or immutable version pin.

- [Composed-RLS GREEN](../../tracking/evidence/m06/storage-rls-local/2026-10-30T01-37-21-791Z-abba75e3.json) uses actual anon/authenticated SELECT on Storage rows. It covers frame/logo/video/PDF GET/info, guest sign/list denial, capability/session/parent scope, expiry/revoke/rotation, download-disable behavior, four existing worker reads, actual internal PDF asset RPC plus GET/info/sign, and read-only actor export denial with canonical reads preserved. All setup and DDL roll back.
- [Exact release/readback proof](../../tracking/evidence/m06/storage27-release-local/2026-10-30T01-38-28-229Z-80e340c2.json) permits exactly four changed Storage expressions and five fields of the one new media policy. All other catalog/data/managed Auth/Storage/runtime12 and key-safe configuration projections remain exact. Credential columns are excluded before serialization/hashing.
- [Owned27 promotion](../../tracking/evidence/m06/storage27-promotion-local/2026-10-30T01-38-40-683Z-23114a84.json) applies that proven DDL/history once and verifies exact preservation. `tools/release_m06_storage27.py` and [its config](storage27-review-release.json) pin33 public sources/proofs for root's separate sequential canonical review. No canonical call was made by this agent.
- New `capture-m06-app27.py` and `export-m06-private-snapshot27.py` reuse the unchanged26 closed parser/private writer while admitting the exact reviewed27 history. Production26 helpers retain their original bytes and refuse27. The new observer retains its actual27 history in output; only the reused parser's historical count check is adapted internally.
- Root authorized a fixture-only compatibility fix after actual27 history broke the historical26 test factory. [RED](../../tracking/evidence/m06/history26-test-compat/2026-10-30T01-38-59-192189Z-702918cd-red.json) and [GREEN](../../tracking/evidence/m06/history26-test-compat/2026-10-30T01-39-26-379216Z-7694efb2-green.json) retain exact original test bytes/provenance under `history26-tests/` and verify only the data factory changed to the SHA-bound immutable26 manifest. All nine historical cases/assertions remain; all51 focused old/new tests pass without skipped assertions.

These SQL-role/local preservation observations do not replace post-release
Storage HTTP, browser, native PDF or guest journey acceptance. Root owns the
canonical write, quiesced before/after comparisons and actual app verification.
