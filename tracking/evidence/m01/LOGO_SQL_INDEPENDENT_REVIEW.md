# M01 private logo SQL independent review

Reviewed at `2026-10-28T03:10:39Z` by the discovery/review agent. Disposition: no remaining substantive defect identified in this bounded review of the hashes below. This is not cloud application or real Storage acceptance.

| Artifact | Reviewed SHA256 |
|---|---|
| `supabase/migrations/20261028024205_m01_private_logo_boundary.sql` | `b04af5119b4e384bd96136573eec39e69f21a0ffb7d9f4aeb07bbf48f2976b9d` |
| `tests/db/m01-logo-boundary.sql` | `cbce9d3e929220b19d54ef702b55eb1085f6647a1e385c7abf220d324f8a2d64` |

The reviewer read the SQL/tests and the authoritative foundation helpers/policies, inspected exact file hashes and the parent's actual local probe receipt, and did not edit or execute the candidate SQL. Root performed the separate guarded local execution.

## Findings and disposition

| Finding | Resolution inspected in final candidate |
|---|---|
| Root: a completed response under a new completion key was not binding that key to the public request hash | `logo_remember_completion` records the exact public hash and response without another Ready-transition audit; tests exercise new prepare/finalize keys and changed-input conflict. |
| Reviewer: SELECT FOR UPDATE applied open/uploading UPDATE policies before terminal replay branches, filtering completed/cancelled rows | Finalize/cancel share a per-upload advisory transaction lock, refresh current scoped state and handle terminal responses before transition-only row locks. Direct new-key completed-finalize and cancelled-session regressions are present. |
| Root: verifier inherited ordinary bucket DML alongside managed Auth access | Restrictive false policies cover both `storage.objects` and `storage.buckets` for the verifier role. Tests add broad permissive policies and assert verifier inserts still fail. |
| Reviewer: expiry between the Ready-media and completed-session UPDATEs could silently produce zero rows on the second UPDATE and commit inconsistent state | Each transition UPDATE checks ROW_COUNT=1 or raises, rolling back the transaction. A deterministic owner-only test trigger expires the reservation between those UPDATEs and asserts metadata, expiry and idempotency effects roll back. Cancel transitions check row counts too. |

## Boundaries checked

- Verifier role has no login, superuser, CREATEROLE or BYPASSRLS; managed Auth access is inherited one-way, with no user/API-owner membership in the verifier. Private upload/key tables use FORCE RLS and narrow grants. The ordinary API owner cannot read keys or set verified checksum/dimensions.
- Boolean Storage helpers retain the caller JWT identity and current resource scope. Their app-table policy lookups do not recurse through `storage.objects`. Restrictive guards prevent a later permissive policy from granting brand overwrite/delete, unsafe mint/read operations or verifier Storage DML.
- Receipt validation bounds encoded input before decoding, requires canonical base64url and exactly 32 MAC bytes, rejects malformed UTF-8/nonobject JSON/duplicate or extra fields, authenticates exact original bytes, and checks purpose/audience/version, actor, reservation, asset, workspace, revision, verification ID, bucket/key, MIME/size/checksum, dimensions, expiry and key activation. The MAC comparison performs exactly 32 byte-comparison iterations; no language-level constant-time guarantee is inferred.
- Current scope is checked before cached mutation responses. Completion/cancellation serialize by upload; immutable completed responses can bind additional request keys without another Ready transition. Upload reservation replay refreshes current closed status instead of returning cached open transfer metadata.
- The migration seeds no key, user or object bytes, leaves advertised upload purposes empty, and relies on the observed managed Storage schema and narrow `supautils.policy_grants`. It does not replace managed ownership or configure a local fixture as cloud Storage.

## Actual local evidence and limits

Root's [successful probe](../../../development/local-db/receipts/2026-10-28T03-10-25-241Z-logo-probe.json) matches both reviewed hashes and reports `passed`. Candidate DDL and synthetic role/policy/receipt assertions ran in one rolled-back transaction on the owned local target. Its readback confirms candidate role, tables and migration-history entry are absent afterward. The [earlier failed probe](../../../development/local-db/receipts/2026-10-28T03-08-18-214Z-logo-probe.json) is retained as history.

Storage operation/header GUCs, metadata rows and the known test HMAC key are synthetic SQL fixtures. This evidence does not establish HTTP context propagation, real signed-token mint/transfer behavior, actual provider bytes, Sharp verification, Node-to-SQL receipt interoperability, a two-session upload race, hosted user access, key provisioning, cloud application or release completion. Those require their owning explicit acceptance evidence.
