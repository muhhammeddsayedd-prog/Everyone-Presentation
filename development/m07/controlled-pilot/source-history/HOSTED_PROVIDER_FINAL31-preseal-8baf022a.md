INERT FINAL31: GUARD_SHA is empty and HOSTED_CORE9 is absent. Canonical31 evidence is separate; this new family refuses before CLI/provider/private access. No activation is performed by these source checks.

# Hosted Auth provider operator

`hosted-provider-final31.py` is a new, inert-on-import operator for root execution after
actual signed-in hosted core acceptance. The existing callback-only
`auth-redirects.py` and loopback helpers are unchanged. No provider command,
credential read, database statement or hosted login was executed by its author.

The fixed target is `pyibofyctwnqpvktepse`. Its six desired Management API fields
are Site URL `https://everyone-presentation-pilot.vercel.app`, OAuth server
enabled, authorization path `/oauth/consent`, dynamic registration disabled,
custom-access-token hook enabled, and hook URI
`pg-functions://postgres/eps/mcp_custom_access_token_hook`.

The operator requires the actual public
`tracking/evidence/m07/controlled-pilot/HOSTED_CORE.json` before any CLI auth
access. Its closed schema is shared with hosted-binding: schema `1.0`, result
`passed`, fixed central target/origin/web project, a deployment ID, a canonical
nonzero acting-user UUID, all nine exact core checks passed, and unique bounded
public evidence references. Core and referenced leaf files must be regular,
bounded, contained files with unchanged stat/hash pins before and after the
operation. Synthetic pure tests are not this gate. M03 semantics and owner-managed
Claude acceptance remain separate.

## One coherent Auth update

The [pinned CLI 2.122.0 Auth encoder](https://github.com/supabase/cli/blob/v2.122.0/apps/cli/src/commands/config/push/push.encoders.ts)
maps the four scalar Site URL/OAuth fields and groups hook enabled plus URI.
`encodeAuthBody` constructs one body; the [resource dispatch](https://github.com/supabase/cli/blob/v2.122.0/apps/cli/src/commands/config/push/push.handler.ts)
calls `updateAuthServiceConfig({ ref, ...body })` once for Auth. Thus a strict diff
containing only these intended changed leaves is one Auth PATCH, with both hook
fields supplied when either changes. The three OAuth leaves are independent:
when enabling an off server this operator requires enabled, path and DCR in that
same planned body. Already-correct fields stay unchanged; it never disables a
server to manufacture a diff. No other service or hook secret is declared.

Public source files inspected at `v2.122.0` (SHA256 of downloaded bytes):

| Source | SHA256 |
| --- | --- |
| `push/push.encoders.ts` | `db3cf18ee5a3c03b95a28ebb550ce4987b2b3860763d782831b19882af4be3d8` |
| `push/push.handler.ts` | `21feb418b256c629addf1cdc669252a7303750164f1b1a2d222dda47837a9570` |
| `push/push.command.ts` | `6e7df3af092731ae77ffb0c7c18d9c0c56eb5e309dbdc052a04d764946ddcdc7` |
| `packages/config/src/project-config/project-config.ts` | `438c1c6446837475e4e589cbf3cae09cf2a9a5afe9ec88a5c824aa9ca6bb158f` |
| `packages/config/src/project-config/registry-auth.ts` | `e59b101316a3d798e1b73e11083018f0c511fd4a9db023d15c2decf2156a1a9f` |
| `packages/api/src/internal/client.ts` | `96dd2fb197cb91793d20317a9e106fec907b18c89bbe47795f053cdad0f3aa39` |

One logical Auth PATCH is not a promise of one wire request. The pinned
[API client's retry classifier](https://github.com/supabase/cli/blob/v2.122.0/packages/api/src/internal/client.ts)
does not retry PATCH after a transport failure, timeout or 5xx. It permits up to
five retries after explicit HTTP429, whose upstream contract means the request
was not processed. The operator adds no retry and never replays an unknown
outcome. It rejects inherited Node injection, debug, TLS/CA and target override
variables before core/private access and again before every CLI invocation.

The [convergence projection](https://github.com/supabase/cli/blob/v2.122.0/packages/config/src/project-config/project-config.ts)
deliberately prunes DCR/path while OAuth is off and URI while a hook is off.
These three absent baseline values are recorded as unknown/pruned, never actual
observations. Only these source-proven missing children may become local-only
changes; unexpected missing parents, Site URL, active children or unrelated
enabled hook refuse dispatch. Disabled unrelated-hook URI cannot be observed by
this CLI projection; the operator does not claim it was empty.

Equal/default comparator values can also be suppressed. Each logical read uses
three fixed counterfactual **local** minimal TOMLs with `config pull --dry-run`:
two enabled configurations with complementary scalar values and one with off
parents. None is pushed. Unioned explicit remote observations must agree, and
all nonselected returned paths/values must agree across all three pulls. The
desired write TOML contains only the six selected fields. Both final logical
readbacks require all six active desired values to have been explicitly returned.

The two exact ordinary callbacks must remain unchanged:

- `http://127.0.0.1:3000/api/auth/callback`
- `https://everyone-presentation-pilot.vercel.app/api/auth/callback`

All other returned comparator paths and values, including missing-path sets,
are compared in memory before/after. They are never copied or hashed into
public evidence. Unreturned/secret plaintext state is not independently proven;
the minimal declaration and reviewed encoder leave it untouched. No service key,
Management token extraction, HTTP hook secret, raw provider dump or token digest
is persisted.

## Dispatch and readback

Root may execute `python -X utf8 development/m07/controlled-pilot/hosted-provider-final31.py inspect`.
After reviewing its actual plan, `apply` permits a single fsynced exclusive
claim at `.local/m07-pilot/hosted-provider-final31/apply.claim.json`, followed by another
complete baseline/diff/source/core-pin check, then one pinned
`supabase@2.122.0 config push`. A lost response still gets two independently
attempted fresh logical readbacks. No push retry exists; retain the permanent
claim on success, failure or unknown outcome. No helper removes it.

`readback` and a reused claim can report current desired configuration but cannot
prove preservation of a lost original baseline, so remain `unconfirmed` for
application acceptance. `inspect` passing means source/core/config admission and
plan inspection, not activation. Public receipts label actual operator requests
separately from pure synthetic tests and never credit database ACL or OAuth
client acceptance.

A subprocess timeout has a separate unresolved-process meaning: killing the
`npx.cmd` parent does not establish descendant absence. The helper still attempts
both readbacks, retains the claim, records `process_cleanup_unconfirmed: true`,
and forces application acceptance to `unconfirmed` even when desired settings
are observed. Root must pause further provider/ACL actions and reconcile only
owned pending CLI processes before proceeding. No broad process kill exists in
this helper. A completed command with a lost HTTP response can be established
by the two readbacks; it is distinct from an unresolved command process.

After provider selection, independently inspect all eight database hook-security
checks: exact canonical30/body/narrow owner; AuthAdmin EXEC; public/anon/
authenticated/service direct EXEC denied; AuthAdmin eps USAGE; no other eps
routine reachability; owner no schema CREATE; forced RLS on registry and grants.
Provider config readback alone proves none of them. Generic hook delete/replace
is not rollback: Studio may regrant direct EXEC. A coordinated reviewed ACL
restoration/forward fix and fresh effective-privilege readback are required.

The [official OAuth setup guide](https://supabase.com/docs/guides/auth/oauth-server/getting-started)
resolves the path relative to Site URL; the hosted consent endpoint is
`https://everyone-presentation-pilot.vercel.app/oauth/consent`. Public-client
registration, one-resource registry binding, four public app variables and
owner login are subsequent independently evidenced operations.
