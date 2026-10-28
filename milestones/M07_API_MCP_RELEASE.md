# M07 — Complete API/MCP parity and production readiness

**Dependencies:** M00–M06 feature slices and their actual evidence. **Outcome:** production app can be used end to end by humans and authorized Claude clients, with documented operations and verified recovery. This milestone is not a promise to deploy without actual environment access.

## Required context

Read current baseline, progress, decisions, handoff and environment inventory; all API/MCP contracts, OpenAPI/catalog and JSON schemas; API-to-DB mapping; database access/migration/transaction docs; every workflow spec; TEST_STRATEGY and RELEASE_EVIDENCE; CONFIGURATION and DEPLOYMENT_AND_RUNBOOK. Read each previous milestone's unresolved evidence. Do not infer completion from the fact that the docs exist.

## Full authority and parity requirement

BR-001–BR-036 all apply. Claude can perform every meaningful action available to the user it represents: select project; import specs/media; inspect jobs/results; correct facts/requirements; resolve duplicates; choose actual frames; assign/reorder cast; set Main/Backup/Option and explicit Shortlist; confirm Reviewed; edit wording; generate/inspect/download versions; manage review links and read feedback. No human-only approval or draft-only limit is added because the caller is Claude.

The same project/library capabilities remain enforced. Claude receives scoped delegated credentials, never a broad Supabase service-role key. A contributor-delegated Claude cannot confirm profile facts merely because an API exists. Guest and worker operations are separate identities/scopes; administrative stage endpoints are not exposed as ordinary agent tools.

## Implementation sequence

1. Audit every interactive UI action against OPERATION_INDEX/OpenAPI/MCP catalog and actual domain service implementation. Close missing operations or capability gaps. Verify typed bodies/results, pagination, errors, row_version/fingerprint concurrency, idempotency and async job semantics. Remove mock/demo routes from production behavior.
2. Complete the versioned external HTTP API and generated reference/examples. Validate OpenAPI against implementation rather than generating unrelated documentation. Explain upload session acquisition, byte transfer, completion, job polling/retry and exports; agent must not guess a local file path on the server or send giant base64 video blobs through chat.
3. Implement the compatible official MCP SDK adapter with advertised tool schemas/annotations, structured results and error mapping. Tools call the exact domain operations used by UI/API. Tool result content does not contain secrets, arbitrary private records or hallucinated status. Filter capabilities by acting user and resource scope server-side.
4. Implement remote MCP auth with protected resource metadata/issuer/scopes and compatible Streamable HTTP behavior based on current SDK/client documentation. Reuse existing business identity where feasible; do not assume a Supabase session automatically satisfies MCP OAuth. Pin tested SDK/protocol/client versions. Check cross-client session behavior, revocation and concurrent requests.
5. Complete external API integration docs and an operator/client onboarding runbook with actual environment URLs and configuration names but no tokens. Test actual intended Claude conversational client and Claude Code where available; explicitly list any inaccessible client as unverified, not supported by assertion.
6. Run full deterministic suite and live-service integration evidence using approved isolated resources. Actual Supabase, OpenAI, n8n Cloud, native worker, storage/PDF and guest flow must participate. Mock tests remain a separate deterministic suite.
7. Perform initial batch sizing with up to 200 representative or clearly labelled synthetic files as appropriate, bounded concurrency, backpressure, partial failures, restarts and resumable upload. Measure true processing duration/cost on real representative footage, not just a mocked control-plane load. Tune documented limits against provider quotas and worker resources.
8. Verify permission and token boundaries: cross-project/library denial, external audience isolation, callback replay/fencing, stale confirmations/input fingerprints, PDF grants, actor/user audit, production rejection of dev fixtures. Run dependency/security checks relevant to the actual stack; record material findings and fixes.
9. Prove backup/restore and deployment: metadata plus referenced video/PDF objects, schema/workflow/template version restore, expired lease recovery, compatible rollback/forward fix, test job through deployed services. Use existing release process and actual authorized targets; do not run shared production resets.
10. Complete production smoke test and handover only when evidence supports it. Document remaining limitations and actual deployment/service locations. If an access dependency blocks the final real test, leave release unverified and provide exact next action, with all unaffected work completed.

## Human acceptance journey

Start with existing project; save client logo; upload real specs; correct unknowns; reuse one library candidate and scan new intro videos through the real workflow; inspect/choose actual frames; resolve possible duplicate; assign same person to two roles; include explicit Shortlist and maintain one Main; retain an open slot; correct/confirm facts; shorten wording; generate both outputs; visually inspect/download PDFs; create guest link; collect two-reviewer shared feedback; add new media/generate later version; verify latest link and unchanged old PDF media; disable downloads and revoke/extend access appropriately.

## Claude acceptance journey

Repeat equivalent operations entirely through supported API/MCP under a permitted delegated user. Demonstrate acquisition/transfer of local bytes by a supported client upload mechanism, not an undocumented tool-side filesystem assumption. Let Claude confirm a profile and generate/manage sharing without human-only gates. Test insufficient user capability, stale row_version/fingerprint, failed job retry and repeated idempotency key. Return real saved IDs/status and files/authorized links rather than model-described fake deliverables.

The human and Claude journeys must operate on shared persisted data. A change made through MCP should appear in the app; a user edit should be visible through API with the same validation and permissions.

## Required release evidence

- UI → HTTP/domain → MCP parity matrix with meaningful-action coverage and explicit private service exclusions.
- Actual client SDK/protocol/issuer versions and successful connection/demo traces without secrets.
- Real-service job/request/asset IDs, environment, model/prompt/schema/template/workflow versions and measured outcomes.
- Migration replay and applied environment history; source mapping verified with existing business records.
- Exact PDF/viewer page and layout/media proof, expiry/feedback/link and concurrency/retry tests.
- Workload measurements, supported file/codec limits, alerting thresholds and estimated cost based on actual usage.
- Restore and deployment/recovery evidence; operator runbook and remaining limitations.
- Updated PROGRESS.md/progress.json/HANDOFF.md; every required gate explicitly Pass/Fail/Not run, no ambiguous “done.”

## Release decision

The app is ready when the agreed product works through real services, full agent parity is demonstrated, critical integrity/access failures are resolved, and operators can recover work. A polished UI, a reachable /mcp endpoint, a valid OpenAPI file or a green mock-only test suite is insufficient. Public/external exposure follows existing deployment authorization; no additional human signoff is imposed on everyday Claude app actions.

## Codex execution prompt

> Complete M07 by auditing and finishing all API/MCP parity, implementing compatible delegated auth/client integration, and proving real end-to-end service behavior. Run the human and Claude acceptance journeys, batch/recovery/access checks and actual deployment smoke under available authorization. Record truthful release evidence and exact unresolved dependencies. Never declare production readiness from mocks, generated docs or an untested hosted UI.
