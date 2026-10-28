# Specs stage kernel: owned-local rollback proof

Root executed the final reviewed rehearsal on **2026-10-28 at 20:46:58 UTC**. The [receipt](2026-10-28T20-46-58-625Z-a863a766-rollback.json) reports `passed`, completed the explicit rollback, verified exact catalog and all business-table count restoration, settled its backend and released the shared test lock. All nine migration versions remained unchanged. No candidate objects or service identity persisted; no cloud or provider was called.

| Artifact | SHA256 |
|---|---|
| [Candidate SQL](../../../../development/m02/specs-stages-candidate.sql) | `35214cb1b6a35b609c4a3fef92d7ebe91bb6fdeb5978049cf2b5c745764d2b22` |
| [Rollback assertions](../../../../tests/db/m02-specs-stages-candidate.sql) | `1ac2fff725118aa88d05ed7148bad66ff285df128cd28bd93cab8ad154d3ef29` |
| [Fixed runner](../../../../tools/test-m02-specs-stages-candidate.mjs) | `4fb9ca57358da7739a521b939b943ca2de53b5c7d77c0065b477c63f3a02f61e` |
| Final receipt | `d34bbac7fdcddbaafc11228fa8235ffdb8f3176bf5610b3ef0119668b9e152ea` |

The runner used the verified local Docker pipe and immutable container ID, the owned volume and PostgreSQL system identifier `7701520506262638626`. Its fixed local administrator session enabled Auth RLS inside the transaction to reproduce the observed hosted policy shape, then ran the candidate as `postgres`. The temporary reader grant and Auth RLS setting rolled back with every other fixture/catalog change. This simulation is not hosted Auth acceptance.

The SQL assertions exercised:

- Claims, heartbeats, progress, exact event replay, ID/sequence conflicts, stale attempts, lease recovery, three-attempt retry limits, cancellation and revoked requester authority.
- Original UTF8 source binding, CRLF normalization, UTF16 paragraph offsets, exact adapter preparation hash, grounded evidence, ECMAScript whitespace parity and reviewed prompt/schema/model metadata binding.
- Initial `prepare_document` → `extract_specs` → `apply_specs`, including null-asset pasted text, private payload staging, references-only job metadata and one provisional slot for unknown headcount.
- Pristine-draft publication, preserved original evidence/manual edits, exact role/slot/Spec/workspace fields and counters, one application audit, silent-write and altered-field rejection, expiry after fact writes, and durable nonretryable rejection of a 1001-slot allocation.

The narrow owners are non-login and non-BYPASS; the executor has only private function execution. One deliberately isolated exception, `eps.job_requester_active(uuid)`, is a private, volatile, `postgres`-owned boolean lookup of current Auth status. It has no DML, dynamic SQL, JWT/GUC impersonation or public/user/executor execute grant. Its owner/signature/body/ACL/path must remain explicitly checked in any future release readback.

## Retained failures

All earlier receipts remain failures. They were not replaced by the successful run.

| UTC attempt | Outcome |
|---|---|
| [20:37:52](2026-10-28T20-37-52-824Z-1cb33bc5-rollback.json) | Stopped before candidate SQL: object property order caused a false metadata mismatch. |
| [20:38:01](2026-10-28T20-38-01-828Z-ee23fdc7-rollback.json) | Duplicate coordinated-start attempt stopped at the same pre-SQL guard. Root then became the exclusive execution owner. |
| [20:39:54](2026-10-28T20-39-54-034Z-53410743-rollback.json) | Local Auth reader grantability differed from hosted metadata. Full rollback verified. |
| [20:42:25](2026-10-28T20-42-25-155Z-276c6b9e-rollback.json) | Invalid function-qualified local variable reference. Full rollback verified. |
| [20:45:07](2026-10-28T20-45-07-008Z-bdb47e73-rollback.json) | Missing single-column SELECT privilege in the apply postcondition. Full rollback verified. |

## Limits and next gate

This is one real SQL transaction with synthetic fixtures, outside migration history and the reviewed migration manifest. It proves neither persistent stage operation nor new two-backend races/restart durability. It does not compose the separately reviewed source-submission candidate or enable processing configuration. File outputs, replacement-source retention, deployed gateway/service identity, native executor transport, OpenAI/n8n execution, WF-01 and M02 acceptance remain separate gates. Hosting remains deferred. Preserve this frozen proof; any promotion requires the coordinated additive migration and fresh integration/concurrency evidence.
