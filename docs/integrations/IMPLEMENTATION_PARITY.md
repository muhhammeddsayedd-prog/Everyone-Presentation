# Implemented operation delivery

Updated 2026-10-28. The full OpenAPI and MCP catalogs remain the intended contract, not a claim that every operation is implemented.

Central mode now implements the 12 capability/project/workspace/audience operations through actual authenticated `public.eps_*` RPCs, verified users and strict DTOs. Their three migrations are applied in cloud and tested against real local roles. The five upload/media operations remain unavailable centrally (`available_purposes=[]`); the 17-operation complete surface below is available only in the explicit synthetic adapter. Real Producer journey, central private uploads and remote MCP remain unverified/incomplete.

| Operations | Domain | HTTP | UI | Remote MCP |
|---|---|---|---|---|
| get_capabilities | Development adapter | `/api/v1/capabilities` | Acting-user controls | Pending M07 |
| list_projects, get_project, update_project | Persistent synthetic canonical records | Contract paths | Search and autosaved shared edits | Pending M07 |
| list_workspaces, create_workspace, get_workspace, update_workspace | Persistent, scoped, concurrent and idempotent | Contract paths | Existing project and six-step shell, branding/output preferences | Pending M07 |
| create_upload_session, get_upload_session, complete_upload, cancel_upload | Verified local private logo bytes | Contract paths | Logo upload/replace/remove and recovery | Pending M07 |
| get_media | Private, project-scoped | Contract path | Logo preview | Pending M07 |
| list_audience_presets, create_audience_preset, update_audience_preset, archive_audience_preset | Persistent, settings capability and revisions | Contract paths | Settings | Pending M07 |
| Job leases, retries, fencing, outbox and recovery | Isolated `@eps/jobs` core with transactional repository interface | Not connected | Processing screen pending | Service callbacks excluded from user tools |
| OpenAI specs and n8n dispatch | Isolated `@eps/integrations` adapters | Not connected | Specs screen pending | Pending M07 |
| Remaining contract operations, including play_media | Pending later slices | Explicit unavailable response | Honest pending screens | Pending M07 |

Both adapters use thin HTTP handlers with acting-user validation. The central adapter derives identity from the same verified user JWT used by the RPC, never a browser-supplied principal or service-role key. Source project/client ownership is now canonical and scoped; actual human acceptance is still pending. No remote MCP endpoint or Claude-client file-transfer verification is claimed.

Development-only extensions are `/api/dev/session` (signed fixture identity), `/api/dev/uploads/:id/bytes` (same-origin bounded verified transfer), and `/api/v1/media/:id/content` (fixture private preview). These do not establish production TUS acceptance. Fixture sign-in is disabled in central mode and production/staging. `/api/session` uses the selected mode; `/api/auth/sign-in` and its PKCE callback use the real user-scoped Supabase Auth flow with no automatic Producer grant. HTTP bearer requests verify the same acting user before operations; delegated OAuth/MCP delivery remains M07. No ordinary user endpoint receives service-role credentials or arbitrary SQL.

Acceptance evidence: [UI verification](../../tracking/evidence/m01/UI_VERIFICATION.md), actual HTTP contract checks in `tests/e2e/api-contracts.spec.ts`, domain/contract tests under `tests/`, and the latest [handoff](../../tracking/HANDOFF.md). Tests against synthetic data do not verify central permission mapping or cloud writeback.
