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

The Auth lookup for the requested email still matched zero accounts at this
readback. Producer grants remain absent. The user must request/open the email
sign-in link at http://127.0.0.1:3000/projects in the same browser profile. Never
copy callback links, codes, cookies or tokens into chat or tracking. The agent has
not requested an email, created a fake account or bypassed confirmation.

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

Next: run `python -X utf8 tools/producer_bootstrap.py inspect` after human sign-in,
then `grants` if the readiness predicates pass. Reload the browser and perform the
actual M01 journey. M01 remains in progress until that journey and hosted Storage
HTTP/byte acceptance pass.
