# One bounded named anonymous guest feedback check

**Disabled; no live acceptance has run.** `LIVE_WRITES_ENABLED=false` blocks real
HTTP opening, identity, comment and lifecycle phases. Only injected synthetic
test ports ran. No real handoff/inbox was prepared. Root reviews the complete
source, then arms it before a fresh preparation. Wait until the owner's existing
Claude session has finished its current upload journey and is ready; do not
interrupt or reconnect it or prepare an expiring handoff in advance.

This new purpose adds **one clearly labeled external test comment**, preserving
that comment and its audit history. It never deletes feedback. It creates no
Auth identity, producer credential, grant, project, job or review link. The
owner creates and later revokes only the new temporary link through normal MCP.
Only this helper's new private handoff/session files are removed on the stated
successful phases. Existing sessions, links and feedback remain untouched.

The fixed anonymous label is `Release acceptance guest`; the body is
`Presentation release guest acceptance <run UUID>.` Identity and comment have
separate stable keys derived from that run UUID. No personal name or arbitrary
comment text is accepted. Display naming is a guest label, never an Auth user.

Use [OWNER_TASK.md](OWNER_TASK.md) for the exact private handoff. Bind an actual
current external Ready version, an actual slide from it, and a known existing
internal note on that same version. Compute complete external before-counts
from **every** feedback page; do not infer zeros from a partial/empty page or
reuse stale counts. Producer before-summary must contain more comments than
external before-summary. Owner-supplied snapshots remain explicitly labeled;
this helper does not independently authenticate as the producer.

`inbox.mts prepare` performs local work only. It creates a fresh UUID directory
under `.local/completion-guest`, checks real regular paths with no symlink or
hardlink substitution, and applies/verifies current-Windows-owner/SYSTEM ACLs
before writing. Its 30-minute manifest binds nonce, version, slide, internal note
and seven exact source seals. Private JSON is closed, duplicate-key rejected,
bounded to 64 KiB, and checked for stable file identity around reads. All CLI
arguments/output are safe IDs/hashes/paths; raw link/session capabilities enter
only through the protected structured Write handoff. No credentials are read
from environment/cache or sent in URLs, Authorization or Cookie.

`open` consumes the new handoff once after an exclusive dispatch claim. It
checks missing-session denial, opens the ordinary anonymous guest session,
validates the exact saved external Ready version/slide and complete external
before-summary/feedback. It saves the private session and baseline **before any
identity or comment write**. Opening failure is unconfirmed, with no replay;
owner revokes the known new link normally.

`confirm` is explicit. It names that session, posts the fixed external comment,
then deliberately replays the **same body/key** and requires the exact same
comment ID/DTO. It checks precise per-slide and total +1 comment/unresolved
counts, unchanged preferences, summary reload, all old external feedback
unchanged, and the known internal note absent from the guest list. All feedback
pages must finish within 10 pages/1,000 records; the private baseline also must
fit the existing DTO's 100-record and 64-KiB limits. A bound failure before the
comment creates none; a failure after dispatch remains unconfirmed. Concurrent
feedback edits cause refusal rather than accepting approximate counts.

If a response is lost, **nothing retries automatically**. Session, baseline,
fixed body and keys remain private on disk. Only after a recorded unconfirmed
first attempt can the owner explicitly invoke `resume` once. It uses the same
session/body/keys, so an accepted-but-lost comment is recovered without adding
a second comment. A successful confirmation blocks all later writes. A second
unknown outcome, process crash before its failure record, or unrelated source/
file changes require investigation and owner link revocation; never erase a
claim or prepare a replacement to replay this mutation.

After confirmation, owner MCP verifies the returned comment ID and unchanged
internal note, re-reads producer summary, and revokes **only this new link**.
Then `deny --reason revoked`, before known natural expiry, verifies both old
session and original token are denied and removes this private session file.
It preserves the test comment and audit. Optional `expired` checks have separate
deadline gates; do not conflate revocation with expiry or add another comment
without a separately bounded purpose. Capabilities remain protected if any
phase fails; unlinking is not secure erasure and JavaScript strings are not
guaranteed zeroized. Owner's MCP result can exist independently.

Public receipts under `tracking/evidence/m07/completion-guest` contain safe IDs,
request IDs, exact counts, source seals, scopes and preservation results.
They omit tokens, private paths/URLs, names, comment bodies and raw errors.
Deterministic tests do not establish hosted guest acceptance, production or a
producer-authenticated readback.

```text
node --import tsx --test development/m07/completion-guest/writer.test.mts
node node_modules/typescript/bin/tsc --project development/m07/completion-guest/tsconfig.json
node node_modules/eslint/bin/eslint.js development/m07/completion-guest/*.mts --max-warnings 0
```

Eight offline tests pass, including complete later-page feedback and accepted-but-lost response/reload/explicit
same-key resume, prior-feedback preservation, internal-note/privacy rejection,
nonce/source/ACL guards and actual Windows ACLs in a fresh synthetic temporary
directory. Every newly owned test directory was removed after exact-path checks.
