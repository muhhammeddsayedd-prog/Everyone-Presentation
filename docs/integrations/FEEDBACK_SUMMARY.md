# Version feedback summary contract

Implemented and deployed on canonical schema38 and pilot web4Gm85. The owned
PostgreSQL checks and signed-in exact-version HTTP/invalid-query checks passed.
The new owner MCP read and fresh anonymous guest-summary delta remain unverified.
This implements frontend dependency2 without UI or lockfile changes. Current
evidence and remaining boundaries are in
[the backend handoff](../../development/m07/BACKEND_CONTRACT_HANDOFF_2026-11-01.md).

Signed-in HTTP: `GET /api/v1/versions/{version_id}/feedback/summary`.
MCP: `get_feedback_summary`, using the same acting-user service and `workspaces.read`.
Guest HTTP: `GET /api/v1/review/versions/{version_id}/feedback/summary`, using
the existing guest-session/HMAC/origin/rate/no-store boundary. The signed-in
endpoint remains authenticated. No cursor, limit, filters or body are accepted.

```typescript
interface FeedbackCounts {
  preferred: number;
  maybe: number;
  not_preferred: number;
  comment_count: number;
  unresolved_count: number;
}
interface FeedbackSummary {
  version_id: string;
  per_slide: (FeedbackCounts & { version_slide_id: string })[];
  totals: FeedbackCounts;
}
```

The requested immutable Ready version is exact; never substitute newest Ready
or a series total. Include all actual version slides in ordinal order, at most
the existing1000-slide bound; IDs are unique UUIDs and counts are nonnegative
safe integers. Cover rows are zero; Pending rows have comments and zero
preferences; Candidate rows can have both. Count current stored preferences by
value, not historical toggles. Count each visible undeleted comment including
replies; unresolved is the visible rows with resolved=false. Signed-in readers
can see internal/external comments under existing authority; guests cannot learn
internal comments through any count. Preferences retain their existing version
visibility; no new private/public vote distinction is introduced.

All counts cover the full authorized data, independent of existing100-row list
pages. Aggregate comments and preferences independently to avoid join inflation.
Totals equal sums of the same per-slide read snapshot; unresolved<=comments.
No comment body, display name, company, author/session identifier, token, signed
URL, transcript or internal note belongs in this closed DTO.

Internal SQL reuses `eps.feedback_internal_require`: current acting user,
workspaces.read, Ready version and current presentation/project scope. Guest SQL
enters only a fixed operation inside the checksum-bound current
`public.eps_guest_operation`, preserving proof, nonce, credential cleanup,
session/link expiry/revocation/generation/rate and exact external-series/version
checks. Reuse the same SECURITY INVOKER aggregate behind both paths, with only
the existing review/guest owners allowed to call it. New additive37 only; old
M06 SQL, existing permission checks, table grants/RLS and mutations stay intact.

Focused verification must cover >100 combined rows, zeros/covers/Pending,
set/clear votes, replies/deletion/resolution, two versions, foreign scope,
expired/revoked guest access, internal-count nonleakage, malformed provider DTOs,
query refusal, signed-in/guest HTTP and real MCP contract validation. SQL proof
uses an explicitly owned disposable database and complete rollback/cleanup;
root executes it only after source review. Deterministic mocks/parsing are
reported separately from native SQL and hosted evidence.

Frontend coordination was appended to the separate worktree's
`tracking/CODEX_BACKEND_COORDINATION.md`. The historical proposal remains at
`development/m07/frontend-contracts/PROPOSAL.md`; this document fixes the approved
DTO/count semantics for the new implementation. Existing English, owner
connection, manual-screen-reader/mobile and running-pilot decisions stand.
