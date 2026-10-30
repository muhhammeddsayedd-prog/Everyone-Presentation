# Current29 local issuer proof

This additive proof targets the actual owned local history29 baseline. It never
runs the frozen history28 Hook30 harness, applies migration30 to the original,
registers a provider hook/client, or changes canonical configuration. Prior
Hook30 code, notes and receipts remain unchanged.

**Local result: passed.** The actual
[`01f780ed` receipt](../../../tracking/evidence/m07/oauth-hook29/2026-10-30T14-37-15-683Z-01f780ed.json)
records an absent-hook RED followed by all nine native-Auth/public-role/RLS SQL
stages on current29. Elapsed 40784 ms is test duration, not an RTO or issuance SLA.
After rollback the function and issuer role are absent; history remains 29 with
users 0, sessions 0 and registry 0. Clone catalogue/data/Settings match exactly.
The exact disposable database is absent, original29 data/profile/full catalogue
and every global role OID/attribute/membership are unchanged, and the lock is
released. No hook, migration30 or configuration persists anywhere.

`candidate.sql` is derived from frozen candidate30 SHA
`8c2081c02dfda6a6d081a6a3a4eaf76a59bee56c91a5fb24e91becfe32de19ca`.
Exactly five local admission strings change: owned database prefix, ownership
comment, test GUC value, history28→29 and guard error label. The complete issuer
function and privilege suffix remain byte-identical. `provenance.json` records
the exact substitutions and new candidate SHA. This is a local rollback-only
candidate, not a coordinated migration or provider registration.

```powershell
node --test development/m07/oauth-hook29/prepare.test.mjs development/m07/oauth-hook29/notices.test.mjs
node development/m07/oauth-hook29/run.mjs
```

The controller pins the source candidate and current29 profile, verifies the
owned local container/system, acquires the existing shared test lock, then creates
one UUID-named, commented, OID-verified disposable database. Original29 is read-only.
It preserves the already established eight exact dump representations in that
clone; it does not normalize or correct them. Its full pre-proof catalogue must
match the independently observed history29 dump catalogue.

An actual absent-hook RED precedes the GREEN proof. Candidate DDL, its new issuer
role/membership, private function, column grants/RLS policies and all synthetic
events share one database transaction ending in ROLLBACK. There is no manual role
drop or replay of candidate29. Real `supabase_auth_admin`, authenticated, anon
and service-role execution paths participate. The original seven tests and two
new current29 stages cover:

- Complete ordinary browser/unrelated client claims preservation.
- Trusted event claims rather than metadata/top-level client authority.
- Disabled/ambiguous registrations, principal/role/session and exact openid gates.
- Current active atomic grants, empty grants and capability revocation.
- Only resource audience/delegation changes for the approved issuer client.
- Private native-Auth-only EXECUTE, constrained owner and forced RLS.
- Current29 Settings/history preservation and exact operator resource binding.

After rollback the hook, temporary issuer role and all synthetic rows must be
absent, with history29, empty Auth/session/client registry and exact prior clone
catalogue/data/Settings. Final cleanup checks the exact database's name, marker,
owner, normalized uint32 OID and zero clients, then independently proves absence.
Original29 safe data/profile/full catalogue and every global role OID/attribute/
membership must remain exact before releasing only this run's lock. Unresolved
ownership/cleanup retains the lock and a protected diagnostic; nothing broadens
deletion. Diagnostics stay in user/SYSTEM-only `.local/m07-oauth-hook29/`.

Five pure checks pass, including exact source/body
provenance and installed `pglast` parsing of actual outer ownership predicates.
Independent security source review found no material issue in this local scope;
that review itself executed no database/provider work.

The initial compiler tests failed before its module existed. The first actual
[`069873ae` attempt](../../../tracking/evidence/m07/oauth-hook29/2026-10-30T14-35-42-343Z-069873ae.json)
returned successfully from the SQL proof but its reporting regex omitted the two
new stage names containing 29, so it failed 7-versus-9 stage accounting. Exact
controller bytes and the failed receipt remain preserved. A focused collector
regression reproduced that omission, then passed after adding digit support and
an exact nine-stage allowlist. Unknown/duplicate/private notices cannot inflate
proof or appear in the public stage projection. No SQL/issuer/privilege behavior
changed for that correction.

Refresh-labelled synthetic events prove the SQL function preserves trusted
client/scope independently of method labels. The separate
[pinned Auth source research](../OAUTH_HOOK_RESEARCH.md) describes Authv2.197.0
generating those claims on refresh. Neither proves actual provider hook invocation,
signed JWT issuance, authorization-code/refresh/revocation, hosted gateway `/user`,
PostgREST audience behavior or intended Claude clients. Those remain distinct
live acceptance gates. No broad/browser-token fallback, original migration30,
provider configuration or hosting action is introduced.
