# M07 implementation checkpoint

Current release state and next actions are in [the handoff](../../tracking/HANDOFF.md). M07 is in progress; production readiness remains unverified. Local/canonical history29 is applied once. No hosting or OAuth provider/client/hook activation was performed. AT-072 and broader M03 semantic checks remain pending; mobile acceptance is skipped.

| Slice | Guide / current evidence |
| --- | --- |
| UI/HTTP/domain/MCP parity | [Generated inventory](../../docs/integrations/IMPLEMENTATION_PARITY.md), [API/client transfers](API_CLIENT_RUNBOOK.md), [candidate scope](CANDIDATE_PARITY.md) |
| Resource auth and transport | [Auth](MCP_AUTH.md), [SDK transport](MCP_TRANSPORT.md), [consent/setup](OAUTH_CONSENT_SETUP.md) |
| Local issuance candidate | [Hook30](oauth-hook/README.md); seven real-role SQL stages, no provider registration |
| Settings/defaults | [Canonical29 release](db/RELEASE.md), [current quality](../../tracking/evidence/m07/quality/2026-10-30-final-documentation-overlay.json) |
| Actual installed client | [Claude Code](CLAUDE_CODE.md); synthetic business compatibility only |
| Native/filesystem recovery | [History28 proof](RECOVERY.md); [current history29 proof](../../tracking/evidence/m07/recovery29/2026-10-30T12-25-42-320Z-bda68ef0.json) restores4objects/71critical sources and all16430raw catalogue fields |
| Synthetic sizing | [Workload](WORKLOAD.md);200 tiny synthetic files, actual worker still serial |
| Overall acceptance | [M07 matrix](../../tracking/evidence/m07/ACCEPTANCE_MATRIX.md) |

`npm.cmd test`, `npm.cmd run typecheck`, `npm.cmd run lint` and `npm.cmd run build` are the ordinary application gates. Current scoped results are747 module and80 desktop cases. Do not invoke the full unfiltered e2e suite for this owner-scoped continuation: several historical cases embed320px checks. The final [desktop receipt](../../tracking/evidence/m07/quality/2026-10-30-desktop80-final.json) lists all selected cases, omitted legacy cases and the earlier scope correction. Existing review-tail checks also require `EPS_SKIP_MOBILE_TESTS=true`.

Completed migration/configuration actions are not setup commands to repeat. Preserve exact release source seals and once-only claims. Future local SQL/recovery work must target the owned current29 environment and shared lock; old28 harnesses intentionally refuse29. Unknown restore catalogue differences must be observed and reconciled explicitly inside owned disposable clones, never normalized generically or applied to canonical data.

Restore artifacts and real media remain private. Code/evidence source archives and privacy receipts are separate from the SQL/object backup. None is an actual Supabase Storage HTTP, deployed restore, full delegated journey or production smoke result.
