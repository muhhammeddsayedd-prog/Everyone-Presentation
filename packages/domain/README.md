# Domain foundation

`createStudio` currently exposes the **development-only synthetic adapter** for the M01 foundation. It is not a central Supabase integration or a migration history. Real canonical authentication, grants, schemas, and storage must be mapped before implementing a production adapter. It rejects `environment: production|staging`, `NODE_ENV=production`, or `APP_ENV=production|staging`.

The HTTP adapter resolves a development session to an actor through `resolveFixtureActor`. Domain operations resolve the fixture identity's grants and project scopes on every call; request bodies cannot supply capabilities. `fixtureActors()` describes the four synthetic identities for the local identity chooser. These IDs are never represented as cloud identities.

Project and client records remain normalized within the synthetic central store. Workspaces retain project identity, separate branding pins, and per-user output preferences. Project/client edits change that store, including shared client reads from other permitted projects. Logo removal clears the workspace selection and preserves the private bytes and asset metadata.

The store is `<dataDir>/synthetic-studio.json`. Mutations use an exclusive directory lock, an fsynced temporary file and an atomic rename. Concurrent service instances and Node processes serialize through the same lock. A crashed process may leave `synthetic-studio.lock`; the adapter fails with `DEPENDENCY_UNAVAILABLE` instead of stealing a possibly live lock. To recover, stop the owning development process, inspect the lock's `owner.json` PID and the state file, back up the state, and remove only that verified abandoned lock. Do not remove the state or assets as a lock-recovery step.

Uploads reserve generated IDs, private immutable asset paths, type/size expectations and expiry. The web runtime supplies `decodeLogo`, which must fully decode PNG/JPEG/WebP under a pixel limit. `storeUploadedLogo` authorizes scope and owner before decoding and writing. `completeUpload` checks the actual stored bytes, size and hash before marking Ready. It never creates a fake processing job. The separate storage transport and media-content methods are local adapter operations; they are not user-facing worker/admin tools.

Creates, upload completion/cancellation and preset archival require `MutationContext.idempotencyKey`. Identical requests replay their recorded result; different input under the same operation/identity/key fails. Mutable project/client/workspace/preset operations use optimistic row versions. All file paths originate from generated stored asset IDs, never user filenames.

Run focused behavior checks with `node --test tests/domain/foundation.test.ts` on the pinned Node 24 runtime, or the root `test:unit` script. These checks use synthetic JSON persistence and a controlled decoder; they do not prove PostgreSQL/RLS, central business auth, private Supabase Storage, sharp decoding, or live-service acceptance.
