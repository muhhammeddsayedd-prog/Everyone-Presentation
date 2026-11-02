# Presentation facade diagnostics

The owner reproduced one failed generation request through the production UI on
the existing Selection series. The UI retained its uncertain intent. This change
does not retry or confirm that intent and does not diagnose the unknown original
database failure from a synthetic example.

`packages/central/src/presentation.ts` adds static mappings for the actual SQL
errors `SNAPSHOT_INVALID`, `ASSET_UNAVAILABLE`, `LAYOUT_NOT_READY`,
`PRESENTATION_PROCESSING_UNAVAILABLE` and `PDF_BUDGET_EXCEEDED`. Their status codes
come from the existing M05 presentation migration. Unknown errors preserve the
existing central permission/session/conflict mappings. Only the remaining
dependency fallback may expose a syntactically validated five-character
SQLSTATE or `PGRST` plus three digits, in a fixed message and `database_code`
detail. Provider message, details and hint are never copied. The shared
`packages/central/src/errors.ts` is unchanged.

The new regression first failed three of four tests on the original facade.
After the change, all four passed, and the focused run with existing presentation
HTTP and MCP tests passed 12/12:

```text
node --import tsx --test tests/server/presentation-error-projection.test.ts tests/server/presentation-http.test.ts tests/server/presentation-mcp.test.ts
npm run typecheck
node node_modules/eslint/bin/eslint.js packages/central/src/presentation.ts tests/server/presentation-error-projection.test.ts --max-warnings 0
```

Type checking and focused lint completed with zero errors. The initial test
invocation could not load `tsx` because this Recovery worktree had no installed
dependencies. `npm ci --ignore-scripts --offline --no-audit --no-fund` installed
the existing lock without changing package files; the actual regression was
then observed before the code edit.

Frontend independently reviewed the exact presentation source SHA256
`3f4ac0548b1e9d6b28dbf91993624036a3a01e280942f4c6af70e9a375abab4a`
and reran the four new tests: all passed. Its read-only closure review verified
the sealed165-file context056 and found an empty changed-executable intersection
with both native54 and daemon90 imports. The facade exists in the larger source
seal but is not imported by either worker runtime. This is source evidence,
not another worker/native execution or provider acceptance.

The separately authorized `audit.py` ran one bounded normal Supabase CLI2.122.0
read-only rollback query, without an RPC, JWT, acting role or synthetic caller.
Receipt:
`tracking/evidence/m07/presentation-facade-diagnostics/2026-11-02T09-43-53-820241Z-generation-metadata.json`.
At 09:43:53 UTC, canonical history remained39. The fixed owner-attempt window
09:34:00–09:37:00 UTC contained zero versions and zero `presentation_render`
jobs for the specified project, without truncation. Selection retained its
original one Ready version; Shortlist still had zero versions. These facts do
not recover the failed request's original SQL error.

No Main, deployed source, Auth configuration, canonical schema/data, worker
controller or production operation was changed by this work. Deployment and
actual UI/MCP error acceptance remain Root's later scope after Auth cleanup.
