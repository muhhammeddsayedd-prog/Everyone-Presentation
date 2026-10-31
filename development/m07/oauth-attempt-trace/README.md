# Hosted OAuth attempt investigation - 2026-10-31

This investigation concerns the failure after the earlier opaque-selector
correction. The historical Vercel trace showed browser verification at
12:45:40.382 UTC followed by a 503 at 12:45:40.449, with no native authorization
details call. **That trace did not capture SQLSTATE 42501.** It located the
failure in coordination before the provider GET; approval, client callback,
token exchange and MCP authorization had not been reached.

The only native request in the fixed 12:30-12:46 window was created at
12:45:37.494 UTC. Its public client ID was
`f2acafd5-d4b6-4176-b86c-067c57e45ecc`; its exact registered callback was
`http://localhost:3118/callback`, scope `openid`, and resource
`https://everyone-presentation-pilot.vercel.app/mcp`. It remained pending,
unbound and without a durable claim. This matches the documented direct local
Claude Code callback configuration, rather than a claude.ai callback. Metadata
does not independently prove which executable initiated the request.

## Confirmed defect and correction

Read-only inspection found that `eps_oauth_consent_owner` lacked `auth` schema
USAGE. The migration32 operator, `postgres`, has USAGE without its grant option;
its attempted managed-schema grant did not take effect. A separate actual
cloud, identity-free, read-only execution of the existing coordinator role's
`SELECT auth.uid()` prefix returned **SQLSTATE 42501, permission denied for
schema auth**. No JWT, acting identity, native selector or provider call was
supplied. This reproduces the existing wrapper's first expression and explains
the observed pre-provider failure; it is separate evidence from the old 503 log.

Applied migration33 adds a private postgres-owned context bridge that reuses
the unchanged strict ordinary-browser/active-session guard. Public wrappers
change only their principal/session initialization. Their transaction, binding,
permission, duplicate-call and native-outcome checks remain byte exact after
those two reviewed prefix replacements. The own-ledger policy derives the same
principal AND session predicates through the private context.

The ledger policy change removes a runtime namespace dependency. The local
fixture's nested `auth.uid()` to `auth.jwt()` failure is synthetic evidence;
it does not establish a second live policy failure. Managed Auth ACLs, schema
ownership, table flags, policies and role memberships are unchanged. Coordinator
Auth USAGE remains false. The new bridge's EXECUTE ACL contains only postgres
and the coordinator role; no managed grant or inherited-role workaround is used.

## Release evidence and pins

All following receipts are in
[tracking/evidence/m07/oauth-attempt-trace](../../../tracking/evidence/m07/oauth-attempt-trace/).

- `2026-10-31T12-57-23-192071Z-native-attempt-metadata.json`: bounded native
  request metadata, excluding selectors, codes, state, challenges and credentials.
- `2026-10-31T12-59-51-706264Z-coordinator-privileges.json`: effective permissions.
- `2026-10-31T13-00-21-492Z-anonymous-rpc.json`: expected anonymous 401/42501
  function denial, distinguishing the present RPC from a schema-cache miss.
- `2026-10-31T13-01-34-737311Z-role-prefix-proof.json`: actual identity-free
  coordinator namespace failure.
- `2026-10-31T13-08-22-153Z-d8b75cf0-local-context.json`: **47 SQL assertions,
  three independent connection races**, complete emitted SQL pre/post guards,
  history33 before COMMIT and a no-JWT functional guard check. Three additional
  source checks passed in `test_context_source.py`. The owned disposable DB and
  role were removed, original roles restored and shared lock released.
- `2026-10-31T13-12-18-136120Z-context33-rollback.json`: complete actual cloud
  wire with explicit ROLLBACK passed; two independent reads confirmed unchanged32.
- `2026-10-31T13-14-01-749687Z-context33-apply.json`: one apply returned its normal
  marker; two independent reads confirmed33, unchanged managed metadata, all
  sixteen existing checks, coordinator Auth USAGE false and protected M02 status.
- `2026-10-31-context33-web-deployment.json`: stable pilot alias resolves to Ready
  deployment `dpl_DeCpJGbLLEHX3FFNBz5twLFuV8p7`, observed 13:17:01 UTC.
- `2026-10-31-context33-deployed-denials.json`: deployed signed-out consent,
  missing-bearer and malformed-bearer denials passed. These are negative tests,
  not an owner authorization or MCP-read result.

| Artifact | SHA256 |
| --- | --- |
| Migration `20261031130207_m07_oauth_consent_browser_context.sql` | `9923e7a1cb52e160041aacea053a21cb9c25c1fc468db99eb7b7ea77e15dcb81` |
| Reviewed rollback controller source | `b285eb25a716c1c04ff8212c55b1807a9a2adbac8acc8a41fadd521d41487ca9` |
| Complete rollback wire | `05b48edeac8e8f3123f37d7b6dd72d52b30fbfd074be67bf022377c86be159aa` |
| Activated apply controller source | `89ded31f17961784e6611c3c12a4213fb24d155fdd0e69fa9570cabcfd740039` |

The reviewed draft remains frozen in `source-history/`. Rollback and apply
claims are retained in their distinct ignored local namespaces. **Do not replay
the apply, clear a claim, or edit frozen source to make a past receipt pass.**
Unknown outcomes require read-only reconciliation; future changes use a forward
fix. The worker, registered OAuth client and owner permissions were not changed.

## Trace coverage and privacy

| Stage | Available trace and limit |
| --- | --- |
| Consent/session | Browser-session verification and final consent HTTP status share a server trace UUID. Invalid SSR selector/query rejection has no provider event. No cookie, email or session credential is logged. |
| Coordination | Claim/finish operation, action/outcome, status, closed result state and allowlisted SQLSTATE/PostgREST/message enum. Successful approved bindings may include the public client UUID and fixed callback class; no raw selector, binding body or callback query is logged. |
| Native details/approval | Provider HTTP status, details-versus-redirect union, fixed field names/types and allowlisted error code. No values, selector, code, state, PKCE material, raw URL or response body is logged. |
| Client callback/token exchange | The localhost client callback and Supabase `/oauth/token` exchange occur outside Vercel. Studio `/api/oauth/callback` is its separate magic-link sign-in callback. Vercel traces alone cannot prove either client callback delivery or token exchange success. |
| MCP | Fixed boundary, bearer, JWT, delegation, native-session, business-context and authorized stages, with bounded status/reason/code enums. Tokens, raw claims and native session IDs are excluded. |
| Completed project read | The existing receipt contains only operation and bounded request/principal/client/project UUIDs after a successful contract-validated read. It proves server completion; the owner's client result is also required. |

The 13:19:33 UTC trace collection in
`tracking/evidence/m07/oauth-consent-fix/2026-10-31T13-19-33.847Z-948de421-pilot-trace.json`
accepted all five anonymous-test events, rejected none and reported a complete
window. Those events were generated at 13:17:30. This proves deployed trace
ingestion, not an owner attempt. The earlier historical trace remains
`2026-10-31T12-54-19.263Z-18b413c0-pilot-trace.json` in the same directory.

## Owner acceptance remains pending

The owner has been asked for one fresh connection attempt against the deployed
correction. The owner handles configuration, sign-in and consent. Initial
authorization, an authenticated MCP read of **Dummy Pilot Test**, and reconnect
must succeed before connection acceptance is complete. Do not directly probe a
valid native authorization-details URL: its GET can consume or approve it. The
ordinary pending Studio page reload is coordinated; the actual owner attempt
below verified that it used cached consent_ready without a second provider GET.
Do not revoke an existing grant to manufacture initial-consent proof.

Existing M03 and screen-reader checks remain pending; mobile testing is skipped.

## Fresh owner attempt after correction

At13:22:13 UTC the registered owner request reached provider GET200 with the full
authorization_details union. Claim and finish both returned200. At13:23:14 an
ordinary Studio consent-page reload returned cached consent_ready200. The
complete eight-event window contains exactly one upstream details GET. Ready
consent form is captured in2026-10-31-fresh-consent-ready.png; the earlier loading
screenshot captures only its intermediate state. Approval was requested from the
owner; no agent approval or credential operation occurred. Read and reconnect
remain pending. See2026-10-31-fresh-details-and-reload.json for trace IDs/receipt.

At13:23:49 the owner approval passed provider POST200 redirect and finish200. A
second approval request13:23:52 was denied at binding/claim400/22023 with final
503 and no second provider decision. It did not undo the successful first flow.
Actual delegated list_projects13:25:02 and direct get_project13:26:22 succeeded
for Dummy Pilot Test. Owner client-result confirmation and reconnect are pending.
The13:28 broad trace saturated100events; complete focused OAuth/read queries
recovered the relevant windows. Do not treat that incomplete broad query as an
absence proof. See owner-approval-server-read.json and owner-get-project.json.

The focused operator is now ready with10 passing tests (four focused and six
existing collector checks):

```powershell
node development/m07/oauth-attempt-trace/read-focused-trace.mjs oauth dpl_DeCpJGbLLEHX3FFNBz5twLFuV8p7 2026-10-31T13:29:00Z
node development/m07/oauth-attempt-trace/read-focused-trace.mjs reads dpl_DeCpJGbLLEHX3FFNBz5twLFuV8p7 2026-10-31T13:29:00Z
```

Queries are closed EPS AND OAuth / EPS AND MCP AND read. It retains the existing
CLI65.8.0/SHA, private child environment and closed projector, limits combined
output to2MiB/30s and writes exclusive sanitized receipts. Both actual modes
passed; complete empty windows through13:30:32/33 show no newer attempt yet.
Owner read-result confirmation and reconnect remain pending. No additional app
deployment is needed for this read-only operator helper.
