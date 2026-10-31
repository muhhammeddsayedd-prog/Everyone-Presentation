# Public web OAuth environment switch

This is source preparation for the root operator. Its author has not executed
the helper, read private configuration or contacted Vercel. No current core,
provider, client, binding or hosted OAuth acceptance is supplied by its tests.

`hosted-web-oauth-env.mjs` pins the dedicated web project/team, local CLI65.8.0,
existing protected global-config directory, corrected public plan and reviewed
provider/client/binding source. It loads no private or worker configuration.

Before any write, it requires the actual fixed `HOSTED_CORE.json` with all nine
core checks passed, an actual six-field provider apply receipt with independent
readbacks and no unresolved CLI process, the current public-client receipt and
the canonical binding receipt with all eight hook checks and preserved business
state. Client UUID and actor come from those receipts. All public receipt/source
bytes and file identities are checked again during the operation. No identifiers
are invented here. AT-072 and remaining M03 semantic checks stay separate; mobile
testing remains skipped and Studio production acceptance remains unverified.

From the repository root, the operator supplies the real metadata receipt paths:

```powershell
node development/m07/controlled-pilot/hosted-web-oauth-env.mjs preflight '<actual-provider-apply-receipt-relative-path>' '<actual-public-client-receipt-relative-path>' '<actual-binding-apply-or-readback-receipt-relative-path>'
```

Use `apply` in place of `preflight` only after reviewing that result. The helper
requires the existing25-variable metadata baseline and disabled MCP mode. It
creates only `MCP_AUTH_CLIENT_IDS`, `MCP_AUTH_ISSUER` and `MCP_RESOURCE_URL`, plain,
for preview and production. It verifies the complete28-variable state twice,
then PATCHes only the existing `MCP_AUTH_MODE` row's value to `oauth`, last.
Other row IDs, timestamps and returned nonvalue metadata stay equal; selected
public pilot values are preserved too. Private values/ciphertext are never
compared, hashed, journaled or published, so no secret-plaintext preservation
claim is made.

The permanent fsynced claim is
`.local/m07-pilot/hosted-web-oauth-env/apply.claim.json`; each logical write also
has an attempted/completed metadata journal. Existing new keys, an existing
claim or a preenabled mode refuse another initial write. There is no resume,
upsert, automatic claim deletion or helper-level write retry.

The pinned CLI itself retries network/HTTP5xx failures up to three times: at most
four retry-loop attempts per logical operation, including the first attempt.
Its DPoP nonce correction may additionally resend once inside each attempt, and
authentication maintenance can add requests. **Four is not an exact wire-request
count.** Both relevant installed public chunks are SHA-pinned. This qualification
was verified by reading the installed `api` and `Client.fetchWithRetry` source;
no provider request was used to determine it.

Creates use `upsert=false`, fixed unique keys and the same intended values.
An ambiguous successful create followed by a duplicate-key response stops later
writes. Mode PATCH retries target the same existing ID and `oauth` value, so they
retain the same public intent. Any unknown outer CLI result stops all remaining
logical writes and performs two metadata observations; it never resumes even
when the final value appears applied. Reconcile the exact state with:

```powershell
node development/m07/controlled-pilot/hosted-web-oauth-env.mjs inspect
```

Inspect/preflight write no files and emit closed public metadata. Apply adds an
immutable metadata receipt. The receipt distinguishes `helper_write_retry:false`
from `cli_network_5xx_retries_maximum:3` and
`cli_request_attempts_maximum_per_operation:4`; no strict single-wire claim is
made. This helper does not redeploy, approve consent, issue tokens, configure
Claude or prove the serving deployment changed. Root must deploy the reviewed
configuration and perform the separately reviewed hosted readiness and delegated
flow checks afterward. The owner connects and logs in to Claude themselves.
