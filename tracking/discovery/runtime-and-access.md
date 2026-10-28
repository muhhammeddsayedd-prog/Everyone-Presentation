# Runtime, service access and permission plan

Updated 2026-10-28. Current database facts are in [cloud readback](../evidence/cloud-foundation/readback.json); initial host observations remain unchanged in [local-inventory.json](local-inventory.json). The owner-approved canonical source and coordinated migration ownership are resolved.

## Implemented runtime

Observed host tools: Node 24.18.0, npm 11.16.0, pnpm 10.34.7, Python 3.14.7, Git 2.55.0.windows.2 and Docker CLI/engine 29.6.1. The app pins Node 24/npm 11, Next 16.4.3, React 19.3.1, TypeScript 6.0.3, ESLint 10.13.0, tsx 4.23.15, Sharp 0.35.5 and Playwright 1.64.1. The lockfile records exact resolution. Initial TypeScript 7/lint incompatibility was retained and corrected rather than bypassed.

Central integration pins `@supabase/supabase-js 2.118.0`, `@supabase/ssr 0.12.7`, and Supabase CLI 2.122.0. The document module pins PDF.js 6.4.299, Mammoth 1.13.0, Yauzl 3.4.0 and XML DOM 0.8.15. OpenAI uses official SDK 7.45.1 with an explicitly required extraction model; no model was chosen without account/sample evaluation.

The separate local PostgreSQL runtime uses the pinned official Supabase image digest recorded in [local acceptance](../../development/local-db/receipts/2026-10-28T01-46-46-146Z-test-db-summary-8fbb2c6b.json), loopback `127.0.0.1:55433`, owned labels/volume/system identity and exact reviewed SQL hashes. The current cloud is PostgreSQL 17.11; local patch/image and managed helper differences are documented, not represented as identical hosted Auth behavior.

## Actual service observations

| Service | Current observed state | Evidence boundary |
| --- | --- | --- |
| Canonical Supabase | Three M01 migrations applied/read back; 12 scoped RPCs and 11 forced-RLS relations | Actual cloud metadata/counts; zero real users/projects/grants |
| Auth configuration | Email enabled, signup enabled, autoconfirm false; loopback site/callback diff applied and later diff empty | Actual public settings/config readback; no email or session created |
| Browser | Central-mode sign-in and anonymous API denial, fixture endpoints denied, desktop/320px reflow, no browser overlay/errors | [Anonymous smoke](../evidence/cloud-foundation/anonymous-smoke.json); signed-in journey not run |
| Storage | Zero cloud buckets/media; central upload capability reports no available purposes | Known unavailable implementation, not a working logo pipeline |
| n8n | Initial and fresh authorized project-list calls returned `-32603 Internal error` | [Fresh metadata receipt](service-metadata-refresh-2026-10-28.json); no workspace/workflow identity or version obtained |
| Vercel | Read-only Everyone-name project search succeeded with zero matches in the default scope | Other teams/names not inspected; no hosting vendor selected |
| OpenAI | Strict Responses adapter and actual SDK transport tested deterministically | No real provider call, configured model evaluation or quota evidence |

The initial shell had no relevant provider configuration variable names or populated root `.env`; that remains an initial observation only. Later app/CLI configuration was established privately by the root agent. No credential values are copied into these records.

## Permission implementation and tests

Managed `auth.users(id)` is the principal key. `public.app_capability_grants` owns explicit active capabilities; project/client memberships own independent resource/write scope. User RPCs derive `auth.uid()` and reject anonymous JWTs. The server verifies credentials with `getUser`; request-body roles, user metadata and declared browser/API/MCP audit labels do not grant authority.

| Actor | Implemented boundary / required behavior |
| --- | --- |
| Producer/designated editor | Explicit app grants plus target project/client membership; no access from an admin label alone |
| Contributor | Writable project preparation can exist without shared `projects.write`, `cast.review` or settings authority |
| Library-only user | Library grant does not grant project/workspace access |
| Nonmember | Even global capability strings do not authorize another project; ID guessing and custom actor GUCs do not restore access |
| Guest | Future M06 scoped bearer/session projection; no current general anonymous database access |
| Service worker | Future constrained job/attempt/lease/output operations; not a user service-role bypass |

Real local restricted-role assertions, canonical writeback/revisions, idempotency, revoked-membership replay denial and separate-session workspace races passed. Cloud readback confirms owner/role/grant/RLS properties. No actual user memberships have been provisioned in cloud, so hosted signed-in behavior is a separate gate.

## Worker and delegated-client plan

Web/API is the selected Next.js/Node application. Native media/document/PDF tasks remain a separate Node container/process with enforced time/CPU/memory/egress limits, FFmpeg/ffprobe and Chromium as needed; n8n Cloud orchestrates database-backed stages. Document parsing modules exist, while the actual scoped storage/service runtime, native binary versions/container digest and workload sizing remain M02/M03/M05 implementation gates. The PostgreSQL container is not a deployed media worker.

Remote MCP will use delegated acting-user credentials and the same domain/RPC permissions, never a service-role key or extra human-only confirmation. The existing managed Supabase identity is known; intended Claude clients, compatible OAuth registration/redirect flow, protocol/SDK pin and actual file-transfer/client tests remain to be established in M07. The compatibility plan is documented without advertising an implemented endpoint or tested client.

## Remaining external/release facts

n8n connection restoration/workspace version and workflow credentials; configured OpenAI model/account/sample evaluation; real auth user/project provisioning and lifecycle/session revocation behavior; private bucket/retention/restore setup; existing hosting/CI/secret management and isolated real-service staging topology; approved template/font binaries; representative videos; intended Claude clients. Their unknown state is explicit and does not erase the completed canonical metadata, ownership and local development-path discovery.
