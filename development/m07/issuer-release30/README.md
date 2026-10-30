# Issuer30 promotion review package

Prepared on 2026-10-30 for the next coordinated migration after canonical history29.
**Review only: nothing in this directory has been dispatched to any database or
provider. No migration30 file or client registration exists from this package.**

`candidate.review.sql.txt` replaces the disposable-local admission prefix with a
canonical-history29 guard proposal, followed by the exact issuer function,
role, policies and grants from proven candidate
`136de55221d05053f0d3ae40754f641d32d0edf3d8ed73f952c92e1d819bce03`.
The suffix is also byte-identical to its frozen `8c2081c0` ancestor. The first
statement unconditionally raises a review-only error. Removing that statement
alone does **not** make this an approved or complete executable migration.

The preserved function comment still says LOCAL-only. That is deliberate byte
provenance, not a claim that this package installs or registers a provider hook.
Any later change to that comment or issuer logic needs explicit new provenance.

The [local current29 receipt](../../../tracking/evidence/m07/oauth-hook29/2026-10-30T14-37-15-683Z-01f780ed.json)
passed an actual absent-hook RED and nine real-role/RLS SQL stages in 40784 ms.
All candidate DDL, the new issuer role and synthetic rows rolled back together;
the owned clone was removed and original29/global roles remained unchanged.
This establishes the local SQL contract. It does not establish committed
canonical migration behavior, provider invocation, signed tokens, real refresh,
gateway/PostgREST compatibility or Claude-client acceptance.

## Package

- `candidate.review.sql.txt`: inert review candidate; exact suffix plus partial
  canonical admission derived from historical canonical evidence.
- `historical29-expected.json`: exact selected metadata and history from the
  independent canonical `f553771a` readback, with its original observation time.
- `provenance.json`: source/evidence hashes, extraction boundary and known gaps.
- [ADMISSION.md](ADMISSION.md): missing fresh pins and the required final guard.
- [RELEASE_PLAN.md](RELEASE_PLAN.md): coordinated generation, rollback/forward-fix
  proof, apply/readback and separate provider acceptance stages.
- `verification.json`: local file/hash/body-equality and SQL-parser results only.

The saved canonical readback source-pins migration29 and its constrained session
helpers, registry, Settings and narrow owners. It is historical evidence from
11:52 UTC, not a fresh issuer preflight. The later 14:36 UTC Settings readback
still records the exact29 history and empty MCP registry; it does not enumerate
issuer-role/function absence or all capability-table metadata. Neither local
clone metadata nor those historical receipts may substitute for the fresh
canonical admission required by the next phase.

## Exact local client plan

| Item | Planned value | Status |
| --- | --- | --- |
| OAuth client name | `EveryoneStudioLocalM07` | Not created |
| Client | Public authorization-code client with PKCE | Not created |
| Exact redirect URI | `http://localhost:3118/callback` | Planned for Claude 2.1.301 |
| Protected MCP resource | `http://127.0.0.1:3000/mcp` | Local resource plan; recheck actual metadata before binding |
| Issuer | Existing central HTTPS Supabase issuer for `pyibofyctwnqpvktepse` | Do not replace or change signing settings |
| DCR | Off | Desired; current provider state unobserved by this package |
| Native hook | No activation in this phase | Existing provider hook configuration must be discovered/preserved |
| Client UUID | Unknown | Never invent or preinsert one |

The redirect URI and MCP resource have different purposes and intentionally
differ. Do not normalize localhost to 127.0.0.1, broaden the redirect list, or
derive the resource audience from the callback. OAuth-server enablement and
one public-client creation remain root's separate action-time consent scope;
neither implies hook activation. Keep the existing Site URL and signing
configuration unchanged. Hosting remains deferred.

No command in the release plan was executed during preparation. The only
validation here reads files and parses SQL locally. Frozen hook29/recovery
sources and receipts, migration29, runtime configuration, application code and
central progress/handoff records are untouched.
