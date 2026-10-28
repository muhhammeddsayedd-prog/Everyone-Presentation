# Runtime, service access and permission plan

Updated 2026-10-28. Latest capability source/history/ACL proof is [the fifth release](../evidence/cloud-logo-capability/2026-10-28T07-48-14-630664Z-11769197-apply.json), completed07:48:14Z; the earlier03:32 release remains an immutable historical snapshot. Initial host observations remain unchanged in [local-inventory.json](local-inventory.json). The canonical source and coordinated migration ownership are resolved.

## Implemented runtime

Observed host tools: Node 24.18.0, npm 11.16.0, pnpm 10.34.7, Python 3.14.7, Git 2.55.0.windows.2 and Docker CLI/engine 29.6.1. The app pins Node 24/npm 11, Next 16.4.3, React 19.3.1, TypeScript 6.0.3, ESLint 10.13.0, tsx 4.23.15, Sharp 0.35.5 and Playwright 1.64.1. The lockfile records exact resolution. Initial TypeScript 7/lint incompatibility was retained and corrected rather than bypassed.

Central integration pins `@supabase/supabase-js 2.118.0`, `@supabase/ssr 0.12.7`, and Supabase CLI 2.122.0. The document module pins PDF.js 6.4.299, Mammoth 1.13.0, Yauzl 3.4.0 and XML DOM 0.8.15. OpenAI uses official SDK 7.45.1 with an explicitly required extraction model; no model was chosen without account/sample evaluation.

The separate local PostgreSQL runtime uses the pinned image in [current local acceptance](../../development/local-db/receipts/2026-10-28T07-37-24-591Z-test-db-summary-dc3c8a1d.json), loopback `127.0.0.1:55433`, owned labels/volume/system identity and reviewed SQL hashes. The cloud is PostgreSQL 17.11. Local helper differences and the [simulated Storage catalog](../../development/local-db/STORAGE_BASELINE.md) are explicit; no hosted Auth/Storage behavior is inferred from that simulation.

## Actual service observations

| Service | Current observed state | Evidence boundary |
| --- | --- | --- |
| Canonical Supabase | Five M01 migrations applied/read back;18 scoped RPCs and13 forced-RLS app relations; real account enrollment/scoped grants completed | Historical03:32 zero counts preserved. Later key plus requested Dummy Test / Dummy Client pair exist. Actual 14:09Z inspection and 14:10Z grant/readback establish one ready principal, four active M01 capabilities and project/client write memberships; no Auth user/workspace/media written by setup |
| Auth configuration | Historical email/signup enabled, autoconfirm false and loopback site/callback configuration; latest read-only 14:17Z check exposes only max_frequency=1m0s | [Allowlisted metadata](../evidence/m01/signed-in/auth-email-delivery-config.json); SMTP/project email quota not exposed by this check. No Auth/rate setting changed and no email sent by the agent during enrollment |
| Browser | Connected Chrome Person1 is logged out after generic HTTP429 email throttling; owner reports sign-in in another Chrome | Historical [anonymous smoke](../evidence/cloud-foundation/anonymous-smoke.json) and fixture reflow checks remain valid for their scope. Earlier extension-injected hydration warning recorded; connected-profile authenticated journey not run |
| Storage | Actual private `eps-brand-assets` bucket, 5 MiB PNG/JPEG/WebP; eight logo policies and receipt-gated SQL foundation | One active purpose key configured; fifth migration advertises only scoped client_logo and the owned dev process enables verification. User-JWT signing/transfer/Sharp path remains unverified |
| Verifier configuration | [Provision](../evidence/cloud-logo-verifier/2026-10-28T04-05-15-847982Z-658a983b-provision.json) at `04:04:59.429274+00:00`; [reopened inspection](../evidence/cloud-logo-verifier/2026-10-28T04-06-30-395598Z-21d6e564-inspect.json) at `04:06:23.761385+00:00` passed with matching protected runtime file | Historical configuration phase only; `.env.local` unchanged, no key values/raw diagnostics in receipts. Runtime development flag and actual scoped enrollment are subsequent, separately recorded actions |
| n8n | Initial and fresh authorized project-list calls returned `-32603 Internal error`; root reports another actual failure around 14:22Z | [Appended root-reported refresh](n8n-enrollment-refresh-2026-10-28T14-28-30Z.json) records note time separately from the approximate observation window; no workspace/workflow identity or version obtained |
| Vercel | Read-only Everyone-name project search succeeded with zero matches in the default scope | Other teams/names not inspected; no hosting vendor selected |
| OpenAI | Strict Responses adapter and actual SDK transport tested deterministically | No real provider call, configured model evaluation or quota evidence |

The initial shell had no relevant provider configuration variable names or populated root `.env`; that remains an initial observation only. Later app/CLI configuration was established privately by the root agent. No credential values are copied into these records.

The real logo key is protected in ignored `.local/cloud-logo-provision/verifier.json` for CurrentUser and SYSTEM; native exclusive CREATE_NEW phase/key files prevent overwrite and partial-state adoption. The dev launcher accepts only completed configuration for the fixed target and loads two key fields into the child environment. Root's actual loader probe passed without printing a key or setting an enable flag. The owned server was subsequently relaunched in session30061 with the explicit development enable flag; current HTTP anonymous boundaries pass. Hosted authenticated upload acceptance remains pending. This documentation did not open the secret file or inspect its values.

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

Local restricted-role assertions, canonical writeback/revisions, idempotency and revoked-membership replay denial passed. The latest21-stage SQL suite includes three independent-backend race pairs, including logo completion, with cleanup. [Actual Node signer to SQL verification](../../development/local-db/receipts/2026-10-28T03-20-25-083Z-logo-node-sql-interop.json) passed with synthetic authority and zero fixture leftovers. Cloud readback confirms 18 RPC/13 forced-RLS properties, the new narrow verifier role and key/verified-column denials. It inherits managed identity privileges with INHERIT true, SET/admin false and cannot manipulate Storage objects/buckets through inherited ordinary ACLs.

[The earlier read-only/reuse checkpoint](../evidence/m01/readonly-reuse-checkpoint/summary.json) passed 80 app tests, four browser/HTTP tests and build; [recovery review](../evidence/m01/LOGO_RECOVERY_REVIEW.md) records post-change typecheck/lint and protected Ready default reuse. Ready metadata/content, checksum checking, cancellation and completed replay are independent of optional upload signer/decoder readiness. New reserve/mint/completion remains unavailable without both, and capabilities intersect with actual upload readiness. Earlier [79-test full checks](../evidence/local-checks/summary.json) retain their original static/integrity and production-guard evidence. Those browser/SDK checks use synthetic adapters. The later real [enrollment inspection/grants](PRODUCER_BOOTSTRAP.md) established account readiness and four scoped capabilities at 14:09/14:10Z, without creating an Auth user, workspace or media; they do not establish the connected browser's session or hosted Storage acceptance.

## Worker and delegated-client plan

Web/API is the selected Next.js/Node application. Native media/document/PDF tasks remain a separate Node container/process with enforced time/CPU/memory/egress limits, FFmpeg/ffprobe and Chromium as needed; n8n Cloud orchestrates database-backed stages. Document parsing modules exist, while the actual scoped storage/service runtime, native binary versions/container digest and workload sizing remain M02/M03/M05 implementation gates. The PostgreSQL container is not a deployed media worker.

Remote MCP will use delegated acting-user credentials and the same domain/RPC permissions, never a service-role key or extra human-only confirmation. The existing managed Supabase identity is known; intended Claude clients, compatible OAuth registration/redirect flow, protocol/SDK pin and actual file-transfer/client tests remain to be established in M07. The compatibility plan is documented without advertising an implemented endpoint or tested client.

## Remaining external/release facts

n8n connection restoration/workspace version and workflow credentials; configured OpenAI model/account/sample evaluation; connected-profile authentication and normal real project/workspace journey, including lifecycle/session revocation behavior; actual hosted Storage signing/transfer/Sharp proof with the already-restarted configured development runtime; later media/PDF buckets, retention/restore; hosting/CI/secret management and isolated real-service staging topology; approved template/font binaries; representative videos; intended Claude clients. The latest root-reported n8n result remains `-32603`. These gates do not erase completed discovery, cloud DDL, successful key configuration or actual scoped enrollment.

Current owner setup and exact next action: [PRODUCER_BOOTSTRAP.md](PRODUCER_BOOTSTRAP.md). Establish the enrolled principal's session in connected Chrome Person1, then complete authenticated M01/private-logo acceptance; no regrant or record recreation is required. Auth recovery UX and a safe development logo acceptance probe are under implementation, with the probe not enabled or run. The setup tool has fourteen coordinator/guard tests plus a separate24-action actual SQL rollback. Three release-attempt failure tests prove sanitized evidence survives lost response/readback/count drift. Earlier n8n refresh receipts remain historical; the root-reported 14:22Z failure is appended separately. No provider/production acceptance is implied.
