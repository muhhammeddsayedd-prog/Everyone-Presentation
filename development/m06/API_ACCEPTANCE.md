# M06 API and guest boundary checkpoint

This document records the API slice. It does not upgrade the milestone or claim
canonical guest/browser/PDF acceptance; those belong in the final M06 matrix.
Hosting remains deferred, and the broader M03 semantic checks remain open.

## Implemented boundaries

- `packages/domain/src/guest-types.ts` and `guest.ts` define the closed public
  link, browser/session, frozen external version, feedback, preference and export
  contracts. External projection rejects internal visibility and private render
  fields. Guest writes cannot choose author, visibility or casting position.
- `packages/central/src/guest-reviews.ts` composes verified acting-user RPCs and
  a separate anonymous, backend-MAC-gated guest gateway. Raw256-bit tokens never
  enter SQL inputs. Link creation/rotation replay is AES-256-GCM ciphertext with
  actor/operation/subject/idempotency AAD and the specified24-hour lifetime.
- `review-credentials.ts` separates replay and gateway keys. The gateway MAC
  binds operation, canonical input, issued-at milliseconds and a random nonce;
  SQL independently checks the same representation, clock fence and replay.
- `apps/web/lib/guest-http.ts` mounts the same twelve internal operations in
  HTTP and MCP. Standard API header credentials retain their published DTOs;
  browser exchange uses `GuestBrowserAccess` and a context-specific HttpOnly
  SameSite=Strict cookie. The public session UUID selects a cookie and grants no
  access by itself. Browser writes validate exact trusted Host/Origin.
- `GET /review/session` resumes after the initial bearer URL is removed. A
  current-version null means Preparing; fixed historical feedback remains bound
  to its supplied version-slide. Frozen external cover/template identity is
  included without private render context or mutable library lookup.
- Four binary companions proxy private content. Native media selects its
  HttpOnly cookie with a public context query; grant playback exchanges into a
  fixed-version/asset-scoped cookie. No guest receives a signed Storage URL or
  transient Storage capability. Single-range status, type, length and Content-Range
  are verified; whole streams additionally check their saved checksum.
- Retained archived video/frame/logo metadata is accepted by the shared pinned
  asset reader; archived PDF outputs remain rejected. This fixes an HTTP parser
  inconsistency with the existing immutable SQL pin policy without rewriting
  the M05 migration or old snapshots.

## Executed local checks

The focused command executed36 passing tests with zero failures/skips:

```powershell
node tools/run-tests.mjs tests/domain/guest.test.ts tests/server/guest-http.test.ts tests/server/guest-mcp.test.ts packages/central/test/review-credentials.test.ts packages/central/test/guest-storage.test.ts packages/central/test/guest-reviews.test.ts
```

The cases include cross-origin denial, separate-tab cookie identity, named-only
mutation DTOs, exact optional replay context, malicious internal feedback
projection, Unicode character bounds, token encoding, MAC binding, authenticated
encrypted replay, private-only capability transport, full-byte corruption,
single ranges, archived-source retention and represented-user scope. The official
MCP SDK exercised all twelve operations over an in-memory transport and validated
both tool schemas; this is controlled protocol evidence, not remote OAuth or a
canonical user session.

The retained archived-source RED failed before the shared parser fix, then the
same six Storage tests plus five existing M05 adapter tests passed. The Unicode
10,000-character RED failed before counting codepoints; the same nine domain
tests then passed. The first credential test run had an empty-string assertion
fixture error; it was corrected without relaxing the implementation.

Type checking and focused ESLint passed. Strict pack validation passed357 checks
with98 paths,114 operations,86 intended MCP tools and12 standalone schemas. The
OpenAPI/MCP/runtime generators were rerun and their three outputs remained byte
identical. These source checks do not establish cloud, browser or native PDF
acceptance.

## Provider/source and outstanding proof

Cryptographic APIs were checked against the pinned [Node24.18.0 crypto
documentation](https://nodejs.org/download/release/v24.18.0/docs/api/crypto.html).
Existing pinned Supabase SDK Storage fetch behavior was inspected locally;
provider versions and the application stack were preserved.

The root owns actual canonical migration25 release, private key bootstrap,
existing Producer capability completion, fresh-browser feedback/PDF/media
journeys and final quality gates. The API agent made no cloud mutation.

The [fixed Producer capability helper](../../tools/complete_producer_review_links.py)
is qualified by an [actual owned-local25 rollback proof](../../tracking/evidence/m06/producer-review-links-local/2026-10-30T00-27-37.974Z-dd9914ba.json)
with18 negative cases and14 passing offline Python protocol tests. It derives the
existing requester from the fixed successful source job, requires active verified
Auth, two writable memberships and the eight Producer capabilities plus existing
generation authority. It inserts only an absent review_links.manage grant and
refuses active or revoked rows, preserves other grants/memberships/Auth revisions
in local proof, and records a protected exclusive claim before a possible cloud
dispatch. Its inputs require the exact reviewed25-history; root must establish
canonical25 before invoking it. A lost result permits only read-only reconciliation,
not automatic mutation retry. Local qualification is not canonical completion.

Historical M05 source seals, unrelated task files and all original Ready media
are retained.

## Credential admission forward fix26

Independent review found that migration25's authorized public create/rotate RPCs
could accept a caller-chosen digest/ciphertext, bypassing the backend's random
token generation and encrypted-response provenance. The gap was found after25
was applied and before guest feature enablement. Its migration, helper and proof
bytes are retained. The coordinated additive26 fix admits protected credentials
through the private guest owner, after current actor/project checks and before
any create/rotate/cache replay.

The server now supplies a fresh operation-bound HMAC over actor, subject, full
semantic input, idempotency key, digest and ciphertext, plus issued-at and nonce.
Each identical acknowledgement retry uses a fresh proof while preserving the
original encrypted cached response. Public HTTP/MCP request/response contracts
are unchanged. The new backend-proof RED failed before this extension; the
[current controlled API receipt](../../tracking/evidence/m06/api-contracts/2026-10-30T00-48-43-352907Z-acba09d0-credential-admission26.json)
records37 passing focused tests, lint/typecheck and exact source hashes. The
separate26 SQL proof establishes database admission; Node fixture tests alone do
not establish it. The pinned PostgREST source was also checked: POST RPCs do not
receive the automatic GET/HEAD/OPTIONS retry behavior.

The [separate26 Producer capability helper](../../tools/complete_producer_review_links26.py)
has its own [actual26 rollback proof](../../tracking/evidence/m06/producer-review-links26-local/2026-10-30T00-47-21.871Z-34cc8507.json)
with18 negative cases and14 passing offline Python protocol tests. It binds the
verified canonical25 readback, original absence evidence and exact26 source
history. The original25 helper remains byte-identical and is historical after
the forward migration. The new helper still adds only one absent
review_links.manage grant and performs no identity, membership, reactivation or
unrelated capability writes. Root owns any canonical invocation and acceptance.
