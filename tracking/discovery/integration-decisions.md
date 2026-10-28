# Current integration decisions

Current operational update: five M01 migrations are applied/read back; the requested canonical test project/client pair exists, and the owned dev process was restarted with scoped logo verification enabled. Actual Producer sign-in/grants and hosted Storage HTTP/bytes acceptance remain unrun. See [current enrollment](PRODUCER_BOOTSTRAP.md), [runtime evidence](../evidence/m01/central-enrollment/runtime.json) and [fifth release](../evidence/cloud-logo-capability/2026-10-28T07-48-14-630664Z-11769197-apply.json). The timestamped observations and earlier phase statements below are historical; their zero counts/disabled flags are not current-state assertions.

Updated 2026-10-28. The owner explicitly chose the inspected empty `Everyone-Presentation` project as canonical. That amendment supersedes the initial search for an existing business database. Three additive migrations have applied locally and to cloud; [canonical ownership](canonical-ownership.md) and [readback](../evidence/cloud-foundation/readback.json) identify the actual objects.

| Logical concern | Current decision / implementation | Remaining gate |
| --- | --- | --- |
| Project/client | Canonical `public.projects/clients`, UUID keys, shared writes through scoped RPCs | Real project records and authorized signed-in journey |
| Principal | Reuse managed `auth.users`; server `getUser` and database `auth.uid()` | Real user session/lifecycle acceptance |
| Capability and resource scope | Explicit active grants plus independent project/client memberships | Actual owner-authorized provisioning; no admin title shortcut |
| Workspace | Private `eps.workspaces`, one active Casting workspace per canonical project | Connected human app journey |
| View preferences | Per-principal `eps.user_workspace_preferences` | Broader feature-specific state as implemented |
| Canonical branding | Client default and workspace selection stay distinct; selected assets follow permitted pin relations | Real private logo upload/byte verification pipeline |
| Candidate identity/facts | No existing source records/fields were present to reuse; M03 must establish one reusable owner per fact | M03 schema/processing implementation |
| Project availability, media choice, assignments | Separate app concerns, never copied into reusable profile facts | M03/M04 implementation |
| Ready versions | Immutable snapshots and pinned media, as contracted | M05 implementation and real rendering |
| Jobs/outbox | Transactional interface and deterministic tests prepared | Real central transactional repository/service/dispatcher wiring in M02 |

`integration_bindings` is unnecessary for the current UUID-to-UUID canonical entities. The workspace directly references its actual canonical project. No second mutable project/client database was created. Future heterogeneous sources, if ever authorized, must not become a backdoor free-form production identity.

Private user RPCs use a non-login/non-BYPASSRLS owner with explicit RLS. It inherits existing managed `authenticated` identity access with SET/admin false. A separate narrow trigger owner updates only affected workspace counters after shared central edits. The managed Auth schema and its RLS policies were preserved.

Contributors can prepare their writable project workspace without permission to edit shared project/client records or confirm reusable facts. Cached idempotent responses recheck current resource access. Current local role/RLS and real-session races prove these rules at the database boundary; full user/API/browser/MCP parity retains its own acceptance scope.

Existing hosting remains unselected. A fresh Vercel Everyone-name search succeeded with zero matches in the queried default scope; n8n project discovery still returned `-32603`. These are precise observations, not permission to choose a replacement database/orchestrator or new paid service. See [fresh service metadata](service-metadata-refresh-2026-10-28.json).
