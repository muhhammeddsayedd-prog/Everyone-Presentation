# M04 assignment database slice

Author-only work against the reviewed local19 baseline. No numbered migration,
manifest change, promotion, cloud call, provider call or hosting choice is part
of this slice. Root must compose the assignment kernel and lifecycle forward
integration atomically before release.

The draft [assignment kernel](assignments.sql) adds `eps.assignments`, private
append-only `eps.assignment_change_events`, and append-only Undo consumptions.
The [lifecycle integration](lifecycle-forward.sql) forwards the actual post19
role/slot retirement, project removal, duplicate-link and safe source-correction
functions. It preserves the post18 supporting-asset merge hook and post19 frame
resubmission function.

Assignments start as Option, with explicit Shortlist false. Every active
assignment belongs in Selection; there is no writable Selection flag. Partial
unique indexes enforce one active candidate relationship per slot and at most
one active Main per slot. Composite foreign keys retain exact workspace/slot/
participation scope. Archived assignments retain their identity and notes.

Mutations lock affected workspace aggregates before roles, slots and assignment
rows, then recheck current permissions after waits. The Main operation demotes
the previous Main before promoting the chosen assignment. Undo loads its exact
inverse from the private event, checks the slot and affected assignment versions
and positions, and consumes that event once. Any currently authorized writer can
apply a still-valid inverse. PostgreSQL documents the lock waiting and conflict
behavior used here in [Explicit Locking](https://www.postgresql.org/docs/17/explicit-locking.html).

All published mutation RPCs require an acting-user idempotency key. The same key
and input return the original acknowledgement after current authority and parent
checks; a changed body conflicts. Cached assignment acknowledgements reject a
participation rekey instead of returning a DTO bound to an obsolete parent.
Ordinary Main changes require its dedicated operation. Shortlist, notes and
wording edits remain local to the assignment and never modify shared facts.

The operation budget is 64 KiB of compact UTF-8 JSON, including all supplied
fields. Ten wording overrides may accumulate through separate valid edits; the
stored object has a 786432-byte safety bound. Full private before/after evidence
is limited to 4 MiB and 100 rows per event. Large reorder/retirement effects are
batched without truncating the operation's eligible ID set. Outer ASCII space,
tab, CR and LF are trimmed; empty notes become null and null wording removes
the override. Interior whitespace, Arabic text and NBSP are retained.

`eps_casting_owner` is a NOLOGIN, non-BYPASSRLS function owner. New tables use
FORCE RLS and receive no direct authenticated/anonymous/service-role grants.
Internal audit helpers do not receive user EXECUTE. A separate NOLOGIN guard
owner can read only the metadata needed for scoped assignment existence and
complete duplicate-workspace visibility. Its boolean/ID helpers are private;
the specs service receives no assignment rows. This follows the distinction
between table privileges and row policies in [Row Security Policies](https://www.postgresql.org/docs/17/ddl-rowsecurity.html).
Definer functions use an empty search path and explicit grants, as recommended
by [Supabase database functions](https://supabase.com/docs/guides/database/functions).

## Current evidence

[Full composed rollback proof](../../tracking/evidence/m04/assignments-local/2026-10-29T16-25-14-012Z-b33636d0.json)
passed all 8 required markers on 2026-10-29 at 16:25:14Z. It bound the current draft
sources and captured the expected catalog before synthetic fixtures. Preexisting
row hashes, configuration and runtime metadata were preserved inside the draft;
the final catalog/business snapshot and Auth.users owner/RLS/ACL metadata exactly
matched the pre-run snapshot after rollback, with source stability confirmed.

The proof exercises non-owner public RPCs for create/reuse, exact idempotency,
two-role independence, local wording, Selection/Shortlist, cursor scope/staleness,
full reordering, Main replacement/clear, valid/forged/stale/consumed Undo,
another authorized writer's Undo, scoped removal, permission revocation,
private-table/helper denial, composite scope and the one-Main index. Independent
fixtures cover explicit role/slot retirement, project removal, source-baseline
protection without user claims, duplicate collapse and support retention, hidden
project denial, revoked replay and library-only linking without workspace
capabilities. Large-state tests retain more than 400 KB of
cumulative wording, produce a real private Main payload over 1 MiB, and reorder a
122-row synthetic board with 100 + 22 private audit batches. The large board is a
metadata constructor, not evidence of 122 browser/API creates.

Earlier failed rehearsal receipts remain alongside the passed proof. Three
failures were missing synthetic job provenance fields; a stress test that grouped
many separate public operations into one 30-second SQL statement was corrected
to use an existing-board metadata fixture. Production timeouts were not raised.

The separate [two-session helper](../../tools/test-m04-main-race-local.mjs) passed
the [actual two-actor race](../../tracking/evidence/m04/main-race-local/2026-10-29T16-44-42-247Z-f410889c.json)
on 2026-10-29 at 16:44:42Z. It observed the second actor waiting on a lock, then
committed the winner and received `STALE_RESOURCE_VERSION` from the loser.
Exactly one Main, slot revision4 and one Main event remained. The complete
original acknowledgement, including affected rows and Undo, equalled its
same-key replay. A separate permission revocation committed while a writer
waited; that writer received `CAPABILITY_REQUIRED` and changed no casting state.

This race used a disposable, unexposed, network-none container from the pinned
PostgreSQL 17 image. The reviewed catalog/application snapshot matched local19
exactly before installing the draft. Auth row data and large objects were
excluded. The helper preserved exact NOLOGIN owner memberships, managed
extension/event-trigger metadata, source public-schema ACL and the original
four BETWEEN checks; it did not mask catalog differences. Files containing the
fresh temporary password/dump/diagnostics had owner+SYSTEM protection from their
first bytes. Afterward the exact owned container was removed, canonical19 was
unchanged, and all canonical Auth owner/RLS/ACL metadata and nonsecret physical
row-revision fingerprints were preserved. Sources remained stable. Earlier
privacy/readiness/restore setup failures remain recorded with verified cleanup.

Synthetic claims test SQL authorization, not a hosted Auth sign-in. No cloud,
app or M04 milestone verification is claimed by these local receipts. Root still
owns shared service/barrel/HTTP/MCP/board wiring, guarded migration composition
and release, browser acceptance, series/review/template projection and WF-05.
