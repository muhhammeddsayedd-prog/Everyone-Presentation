# Claude Code compatibility evidence

This is an actual installed-client compatibility smoke test against Studio's
current `apps/web/lib/mcp-http.ts` and official MCP SDK transport. Business ports
are deliberately synthetic and held only in the test process. It is **not** the
M07 real-service Claude journey, OAuth issuance/revocation acceptance, canonical
database acceptance, a deployment, or production support proof.

## Actual observed client result

On 2026-10-30, Claude Code 2.1.301 using `claude-sonnet-5-5` completed all five
synthetic business calls in six turns and 10.555 seconds of reported client time.
It reported USD 0.0379727 estimated list cost, no permission denials, and the server
independently observed exactly one update plus revision-2 readback under the
expected synthetic principal.

The original run receipt is
`tracking/evidence/m07/claude-code/2026-10-30T11-18-40-826Z-d9825720.json`.
It remains `unverified`: the original capture expected legacy `initialize`, while
the actual client used modern `server/discover`. The exact protocol revision was
not captured. The separate dated offline assessment verifies the successful
business observations and preserves the original receipt/hash. No second model
call was made. Updated deterministic preflight now covers both legacy and modern
discovery and accepted protocol headers; this does not retroactively capture the
original client's missing header.

Actual initialization reported no built-in tools, no skills/slash commands or
additional directories, and one dynamic synthetic MCP server. It advertised 19
Studio MCP schemas; only the four exact permitted names were called. Two built-in
CLI plugin registrations remained listed (`cc-plugin-agents-md` and
`cc-plugin-plugin-authoring`); no plugin tool, skill or hook was exercised.

## Reproduce the isolated check

```powershell
node --import tsx --test tools/m07-client-smoke.test.mjs
```

This preflight uses the official SDK client, with no model call. It checks the
actual HTTP bridge, marker/origin boundary, acting principal, project read/write,
idempotent replay and revision-2 readback. It owns an ephemeral loopback listener
and closes it afterward.

The separately authorized actual-client command is:

```powershell
node --import tsx tools/m07-client-smoke.mjs
```

It invokes the existing Claude Code 2.1.301 executable directly. It does not
install or configure a global MCP server, sign in, extract credentials, modify
provider configuration or access real business services. Claude Code itself uses
its existing sign-in to make the explicitly authorized model call.

The runner owns `127.0.0.1:3117`, requires a random request marker, and composes the
real transport in explicit local mode with a synthetic principal. The accepted
business calls are `get_capabilities`, `list_projects`, `get_project` and
`update_project`. The update accepts one exact synthetic rename; the final read
must show row version 2 and exactly one committed synthetic update.

## Isolation and bounds

The CLI starts in an empty, separately created temporary working directory.
Built-in tools are disabled with `--tools ""`; four exact MCP tool names are
allowed, permissions use `dontAsk` with unanswered prompts denied, and the
per-invocation MCP configuration is exclusive. Restricted mode, disabled slash
commands/Chrome, no session persistence, empty settings sources, a replacement
synthetic-only system prompt, disabled hooks/connectors/workflows/auto-memory and
CLAUDE.md exclusions prevent normal project customizations from entering this
test. No bypass-permissions flag is used. The harness supplies only a bounded
allowlist of ordinary platform environment variables to the CLI.

The call is limited to eight turns and a USD 1.50 CLI budget estimate, with a
110-second client deadline inside a 120-second overall budget. The runner does
not retry. A separate retry would require reviewing the result and remaining
authorization; authentication or model-budget failures are not retried.

The [official CLI reference](https://code.claude.com/docs/en/cli-reference)
documents tool isolation, turn/budget limits and the replacement prompt flags.
The [settings reference](https://code.claude.com/docs/en/settings-reference)
documents the per-invocation customization controls. Local `claude --help` was
also inspected. Managed policies remain authoritative; known managed instruction
and settings files were absent during preflight. The test does not claim to
override an organization's policies.

## Evidence and cleanup

Sanitized, dated receipts belong under
`tracking/evidence/m07/claude-code/`. They record the actual client/version,
negotiated protocol, observed MCP names, synthetic IDs and state, reported
usage/cost, source hashes and cleanup. Inspect the receipt's actual result rather
than treating the existence of this document as a pass.

Per-run MCP/settings files and raw stdout/stderr remain in the Git-ignored
`.local/m07-client/<run-id>/`, protected for the current Windows user and SYSTEM.
No raw session log is copied into tracking evidence. The test closes its own
in-process server and observes the child CLI exit. Temporary-directory removal
requires its resolved absolute location, exact UUID name and matching ownership
marker. Existing app/worker listeners, other temporary directories, user MCP
configuration and account credentials are untouched by harness cleanup.
