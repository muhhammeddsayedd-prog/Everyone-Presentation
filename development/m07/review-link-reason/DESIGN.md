# Durable review-link action reasons

Isolated compatibility implementation, 2026-11-02. A candidate migration and
disabled owned-local proof now accompany this document. No product change,
database query, provider call or OAuth action has been performed by this work.
Main39 and the deployed J3/c88 product stay frozen until root completes the owned
temporary OAuth session's cleanup. This proposal does not authorize application
of a later migration or claim that current production supports `reason`.

## Verified source gap

The published OpenAPI `ArchiveRequest` and the two MCP tools already allow
`{row_version, reason?: string | null}`. Only `row_version` is required;
`NullableText` declares no maximum length. Both review-link actions instead use
`parseGuestRowVersion`, which rejects any other key in HTTP and the central
adapter. Their domain interfaces also expose only `{row_version}`.

The canonical source functions independently reject `reason` through
`eps.review_body(p_input, array['row_version'], array['row_version'])`. Their
replay hashes already include the complete `p_input`, but a hash is not durable
storage of its reason. `eps.review_remember` stores a request hash/response and
inserts an audit action/resource only; `eps.audit_events` has no reason or
details column. Accepting and discarding `reason`, or merely hashing it, would
leave the advertised field without useful durable semantics.

Relevant current source:

- `contracts/openapi.yaml`: `NullableText`, `ArchiveRequest`, revoke/rotate routes.
- `contracts/mcp-tool-catalog.json`: `revoke_review_link`, `rotate_review_link`.
- `packages/domain/src/guest.ts:54`, `guest-types.ts:61-62`.
- `apps/web/lib/guest-http.ts:44` and `packages/central/src/guest-reviews.ts:102-103`.
- `supabase/migrations/20261028010943_m01_canonical_foundation.sql:107-122`:
  replay and actual audit table columns.
- `supabase/migrations/20261029202629_m04_review_series_processing.sql:81-88`:
  generic review replay/remember helpers.
- `supabase/migrations/20261030002634_m06_guest_review_feedback_exports.sql:245-270`:
  revoke and original rotate implementations.
- `supabase/migrations/20261030004643_m06_credential_admission_guest_retry.sql:31-54`:
  later rotate credential-MAC admission before replay. Replacing the old25
  rotate body verbatim would remove this security fix.

These are local source observations. The live catalogue was not queried for
this design; any future executable migration must bind its fresh exact state.

## Recommended meaning and request compatibility

Treat reason as an optional private audit annotation on the accepted revoke or
rotate intent. It does not change authorization, expiration, token generation,
grant invalidation, response DTOs, ready snapshots or guest-visible content.

Preserve the supplied string exactly: no trim, case conversion, empty-string
normalization, truncation, or invented 2,000/10,000-character limit. Keep omitted
reason omitted in the parsed request, and explicit null explicit. Both mean no
text in the nullable audit column, while their complete JSON request hashes
remain distinct. The existing HTTP JSON-body bound is 64 KiB. Any future field
limit must be an explicit coordinated contract change, not a hidden parser cap.
PostgreSQL/JSON UTF-8 representability is still a transport boundary; include
unrepresentable text in validation tests and return a safe validation error
rather than leaking a raw database exception.

Add a specific `ReviewLinkAction` type/parser with `row_version` required and
`reason` optional string/null. Use it in the two domain operation interfaces,
HTTP route and central adapter. Leave `MutationContext` as transport metadata;
put reason in the actual typed mutation input. The parser must preserve unknown
key rejection and positive safe-integer row-version checks. Keep the existing
row-version-only parser available for callers whose contract is row-version
only; do not broadly relax unrelated operations.

The central rotation path must pass the complete parsed input unchanged into
both `p_input` and the existing backend credential MAC. Do not filter reason
out of the MAC, replay hash or SQL payload. Existing contract tools already
advertise the field, so this narrow change needs no new tool or output schema.

## Proposed additive database delta

Use one later coordinated migration, with a fresh CLI-allocated version after
the current exact39 baseline is revalidated. Do not edit historical migrations.
The intended catalogue delta is:

1. One nullable `text` column, `eps.audit_events.reason`, with no default,
   backfill, index or guest/API projection. All old audit rows remain null.
2. Replace the existing revoke and rotate function bodies under the same exact
   signatures, owners, OIDs, security modes, empty search paths and ACLs. Admit
   only the additional `reason` key and validate its string/null JSON type.
3. Persist `p_input ->> 'reason'` on their first successful audit insert within
   the same transaction as the mutation and replay record. Do not persist the
   complete request, credentials, encrypted response or token digest in audit.
4. Replace the same-signature shared `review_remember` body to preserve the
   existing closed request/client trace headers and extract reason only for
   approved link actions. Replace the same-signature gateway verifier to admit
   the closed rotation envelope described below; retain its ordinary bound for
   every other operation.

No new role, schema, table, RLS policy, table grant, RPC overload or capability
is needed. The existing review owner already has an INSERT table grant and a
principal/action-constrained audit policy. The migration must prove their
exact current values unchanged; it must not rely on this source-level inference
as a live privilege readback. No audit read endpoint or public SELECT grant is
introduced, and the reason is never logged or returned in guest/link DTOs.

Keep the shared five-argument `eps.review_remember` signature and request-hash
algorithm unchanged. Its existing request-ID/client-type omission is repaired
with the established `finish_mutation` header allowlist and fallback rules.
Reason extraction is limited to `revoke_link`/`rotate_link` nested input; other
review actions never copy arbitrary input into audit. Rotation already performs
its own encrypted replay/audit inserts; extend that existing audit insert with
the same closed trace fields and reason after credential admission/mutation.
It does not acquire another generic idempotency record or relaxed null-key path.

The existing shared body validator admits up to 65,536 canonical request bytes.
Its two-field ArchiveRequest gains at most three JSONB separator spaces. The
old gateway's 65,536-byte whole-envelope cap could reject that legal body once
actor, subject, key and encrypted-response metadata were added. Only
`rotate_review_link` receives a new exactly six-field envelope allowance. Its
bound derives from the canonical body, existing key200/ciphertext16384 character
limits, at most six JSON escape bytes per character, two UUID36 fields, digest64
and fixed JSON syntax. The full-envelope closure is checked directly; calling
the old 65,536-byte shared body validator on that envelope would defeat the fix.
Nested body validation, actual MAC bytes, key, nonce, freshness and session
fences remain. Every other gateway operation retains its original 65,536 bound.

Do not replace rotation from the original25 body. Its current26 MAC validation
must remain before any replay acknowledgement, and must bind the reason. Keep
the current link-before-replay locking order, authorization before cache return,
generation/revocation checks, stale-version behavior, token encryption and
current replay-expiry rules. A replay must not append another audit row or
overwrite the original reason.

## Idempotency and concurrency cases

Old requests with only `row_version` retain exactly the same input JSON and
request hash; existing acknowledgements remain replayable under the current
authorization and replay-window checks. Existing rows must not be rewritten or
canonicalized into `reason: null` during migration or request parsing.

- Same principal/operation/key/link/body, including the same reason, returns the
  original acknowledgement and produces one mutation, replay and audit row.
- Changing only reason with the same key is `IDEMPOTENCY_KEY_REUSED`, with no
  audit append or token/grant change. Omitted versus explicit null is also a
  different input under the existing full-JSON hash convention.
- Different keys retain the existing row-version conflict behavior. Failed
  authorization, stale input, invalid reason type or credential-MAC mismatch
  must leave mutation, replay and audit rows unchanged.
- Rotation replay keeps the existing response-encryption and generation
  restrictions; a changed or expired token response is not reconstructed.

Use real independent SQL sessions to prove same-key serialization and
different-key stale-version behavior, with bounded observation of the actual
lock wait. Local fixture concurrency alone is insufficient database evidence.

## Required evidence before release

First add focused RED/GREEN domain, HTTP, central-RPC/MAC and official-MCP
transport cases. Cover omitted/null/empty/whitespace/multiline/non-ASCII reason,
wrong types/unknown keys, byte preservation and unchanged published DTOs. Run
the existing guest-sharing suites with their meaningful permission assertions.

In a newly owned disposable local current39 cluster, apply the new migration
and exercise the actual two functions. Verify durable exact audit text,
single audit on replay, changed-reason conflict, stale revisions, denied
principals/projects, credential-MAC reason tampering and revoked/rotated old
guest sessions/media grants. Include old row-version-only requests and old
cached acknowledgements. Retain failed attempts and exact resource cleanup.

A full-row JSON hash changes when a null column is added even though every old
value is preserved. Compare the preimage's exact old-column projection for
every preexisting audit row, and independently prove the new reason is null on
all of them. Preserve all other old row sets/values, ready snapshots/media,
history and catalogue metadata, allowing only the declared column and two
function-body changes plus the new history entry. Do not waive a whole-table
hash or use an unqualified broad metadata exclusion.

Before a cloud action, root needs fresh exact history/function/ACL metadata,
a protected backup with a compatible recovery path, narrowly reviewed additive
DDL and bounded transaction/lock admission. Adding an audit column may briefly
block concurrent audit inserts; fail safely on the bounded lock timeout and
retain unknown outcomes. Do not replay consumed historical controllers or hide
legitimate application writes from preservation checks.

## Deployment and recovery order

Finish and prove temporary owned OAuth cleanup before changing Main product
source or its pinned deployment. Then review/merge the implementation separately.
Apply the additive database change first: the existing J3/c88 app continues
sending row-version-only input, which the new functions must accept unchanged.
Deploy the new parser/adapter only after independent database readbacks pass.
Run an authorized actual MCP/API revoke or rotate with reason and prove its
safe receipt plus private audit persistence and old access denial.

The compatible web rollback remains row-version-only J3/c88 against the additive
database. Retain accepted reason data; do not drop the column, rebuild the audit
table, erase audit events or undo accepted revocations/rotations. A database
defect should receive a scoped forward fix or the established proven recovery
procedure, with existing operation effects and replay evidence preserved.

The alternative is a separate private reason-event table keyed to audit IDs.
That adds a table, FK, RLS/grants and restore/catalogue surfaces without a product
need for separate retention; the nullable existing-audit column is the smaller
compatible delta. Removing `reason` from public contracts or silently ignoring
it does not meet the accepted scope.
