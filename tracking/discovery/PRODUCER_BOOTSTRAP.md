# Owner-requested initial test records and Producer enrollment

The owner supplied a Producer email privately and explicitly requested `Dummy Test`
with `Dummy Client`. These labels identify owner-requested test business records;
they are not claimed as production casting facts or representative media. The
empty Everyone-Presentation Supabase project remains the owner-selected canonical
system. No Auth user, workspace, media or broad administrator role was created.

At 2026-10-28T07:46:18Z the bounded setup action created and read back:

| Resource | Canonical ID |
|---|---|
| Client | f4a9937c-f575-4975-bdea-fb83b85e48c3 |
| Project | 4b70c8ce-18bd-4a8c-b5a9-bc1156c06463 |
| Private setup request | 403dcd71-0753-41e9-b448-e5a439886a1f |

The initial Auth lookup matched zero accounts; the 07:57 and 08:30 observations
remain historical. At 2026-10-28T14:09:34.372709Z, actual read-only inspection matched
one confirmed, previously signed-in, nonanonymous, nondeleted, nonbanned principal:
`0a79a703-caba-47e5-93d4-42e32197037a`. At 14:10:07.994212Z the reviewed grant action
completed and read back exactly active `projects.read`, `projects.write`,
`workspaces.read`, `workspaces.write` plus writable membership for the project and
client above. The principal UUID was pinned to the existing private setup request.
No Auth user, workspace or media was written by setup.

The owner reports a successful sign-in in another Chrome. The connected Chrome
Person1 profile remains logged out; its login attempt received generic HTTP429
email throttling. These observations do not prove an authenticated app journey.
The 14:17:24.131722Z read-only Auth configuration check found
`auth.email.max_frequency=1m0s`; it does not expose SMTP configuration or the
project email quota. No Auth/rate setting changed and no email was sent by the
agent. Never copy callback links, codes, cookies or tokens into chat or tracking.
No fake account or confirmation bypass was used.

`tools/producer_bootstrap.py` accepts only `prepare`, `inspect`, `records` and
`grants` against the fixed linked target. Its owner intent and protected state are
ignored under `.local/m01-enrollment/`. The setup introduces no email copy into SQL templates, tests or public receipts.
The unchanged supplied `Design Elements/DESIGN.md` already contains the same
business contact in an unrelated reference example; those original bytes are
preserved, with an exact-file-hash scan exception. No key is ever exempted. SQL uses a bounded hex JSON envelope decoded
to typed variables; all DML is static. No persistent admin helper/RPC is created.

Stable private resource IDs are prepared once. Before the first record action,
the target IDs and labels must be absent. A durable pending phase precedes the
transaction. A pending phase loaded from disk has an ambiguous prior outcome. Recovery can
confirm a complete pair or all pinned active grants without writing. Missing
state requires reviewed operator reconciliation; a pending retry never recreates
records or restores permissions after a hard deletion. It cannot adopt foreign
names or partial pairs. Confirmed phases use read-only confirmation, so
retries cannot recreate removed records or restore deleted grants. Existing label
edits are preserved. Inactive or read-only memberships are never reactivated.

After an actual unique confirmed, nonanonymous, nondeleted, nonbanned signed-in
principal exists, `grants` pins its UUID and checks it again with a row lock inside
the transaction. It grants exactly `projects.read`, `projects.write`,
`workspaces.read`, `workspaces.write` plus writable membership for this project and
client. It does not grant settings/global administration, future casting powers,
PostgreSQL role membership or permissions to another user. Future milestone
capability rollout follows the confirmed role contract. Normal record/workspace
edits remain application operations, not administrative SQL.

Actual proof is separate:

- `tracking/evidence/m01/producer-bootstrap/`: prepared state and successful cloud
  creation/readback, with identity flags and resource IDs only.
- `tracking/evidence/m01/producer-bootstrap/2026-10-28T14-09-59-341574Z-inspect.json`:
  actual readiness predicates and unique principal, observed 14:09:34.372709Z.
- `tracking/evidence/m01/producer-bootstrap/2026-10-28T14-10-26-482481Z-grants.json`:
  phase completed, exact four active capabilities and two write memberships,
  observed 14:10:07.994212Z; no Auth user/workspace creation.
- `tracking/evidence/m01/signed-in/auth-email-delivery-config.json`: allowlisted
  read-only configuration metadata, observed 14:17:24.131722Z; no setting changes
  or email request in that inspection.
- `tracking/evidence/m01/2026-10-28T07-46-04-309Z-producer-bootstrap-local.json`:
  24 synthetic SQL action invocations in one real local PostgreSQL rollback;
  before/after counts all zero. It covers collisions, label-preserving replay,
  account readiness/pinning, revoked/read-only permissions and exact grants.
- `tests/tools/test_producer_bootstrap.py`: fourteen Python tests, including actual
  coordinator dispatch under finalized retry/delete races and lost CLI responses.
- The initial local SQL test failed because the official image lacked
  `auth.users.is_anonymous`. Its failure receipt is preserved. Only the guarded
  local Auth catalog fixture was extended with six already-observed cloud columns;
  no managed cloud Auth DDL or privileges changed. The successful rehearsal
  verifies the added Auth row-lock operation locally, not hosted sign-in.

Next: establish this principal's session in the connected browser at
http://127.0.0.1:3000/projects and perform the actual M01 project/workspace journey
and hosted Storage HTTP/byte checks. Enrollment is completed; do not recreate
records, prepare new IDs or restore grants to resolve a logged-out browser.
Auth recovery UX and a safe development logo acceptance probe are under
implementation; the probe is not enabled or run. M01 remains in progress until
the authenticated journey and hosted Storage acceptance pass.
