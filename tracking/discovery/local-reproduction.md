# Local canonical reproduction and isolation

Updated 2026-10-28. The owner-approved canonical database began empty. The same three immutable application migrations now exist in the guarded local PostgreSQL runtime and canonical cloud; no production personal data was copied into local tests.

## Current supported local path

`tools/local-postgres.mjs` owns the disposable runtime `eps-presentation-canonical-pg17-local`, bound only to `127.0.0.1:55433`. It verifies the exact image, every published IP, container/volume/workspace ownership labels and database fingerprint before a mutation. Source files must match the root-reviewed SHA256 manifest in `development/local-db/reviewed.json`. The cloud link remains intact in the repository root.

```powershell
node tools/local-postgres.mjs status
npm.cmd run test:db
```

The exact local image digest, system identifier, reviewed manifest hash, commands, role/SQL receipts, backend PIDs, overlapping transaction windows and successful fixture cleanup are in [the acceptance summary](../../development/local-db/receipts/2026-10-28T01-46-46-146Z-test-db-summary-8fbb2c6b.json). Both same-key and distinct-key races used separate real PostgreSQL sessions; wait-event sampling is not claimed.

`tests/db/m01-foundation.sql` begins a transaction, requires the exact local harness setting and rolls back synthetic Auth/canonical/media-metadata fixtures. The race setup commits only its known synthetic namespace to permit separate sessions, checks collisions, verifies effects, and performs identity-guarded scoped cleanup. These are local fixture records, never cloud users/projects or real storage bytes.

The local image already included managed Auth users/uid, while a missing `auth.jwt()` helper and managed permission assumptions needed a recorded local prerequisite repair. Local test setup represents the verified cloud signatures/permissions; it does not reproduce actual email sessions or identity lifecycle. The image uses PostgreSQL 17 with an older patch than the cloud's 17.11; exact hosted parity is not claimed.

## Preserved initial failure

Before the new canonical path was established, pinned CLI `supabase db start` attempted an empty `eps-local-dev` runtime. Docker advertised IPv4 loopback plus an unexpected IPv6 wildcard, so the safety probe failed. Only that owned runtime was stopped, with its network and backup retained. [Original receipt](local-runtime-evidence.json) preserves its actual result and observation time. The old Python preflight tools are historical; they are not the current canonical start/test path and must not start a runtime from this linked root.

Later actual SQL failures were retained: missing local `auth.jwt()` prerequisite, a test invoked after that failed atomic replay, inherited Auth schema access, then PL/pgSQL alias ambiguity. Applied migration files were preserved and the latter app defects fixed through additive forward migrations. The final real SQL/role/race suite passed.

## Staging and provider plan

Deterministic work uses this isolated local database and synthetic providers/files. Real-service acceptance needs an authorized isolated staging topology following the discovered business setup, separate workflows/object prefixes and scoped credentials. No staging account/branch or paid hosting purchase is assumed. The selected canonical cloud currently contains no real users/projects/media, and its metadata readback is separate from staged/live processing evidence.

Never run a reset/seed/start against the linked canonical root or remove its link to make a guard pass. Never pass a cloud connection string to fixture tooling. A database replay is not a media restore exercise; real bucket/asset recovery remains an M07 gate.
