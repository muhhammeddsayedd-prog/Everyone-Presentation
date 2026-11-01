# Nested batch-filter SQL proof — disabled source preparation

This new purpose reuses the frozen feedback37 pure compiler and wire renderer.
It changes no old217/365 source, metadata33 restore path, product file, migration
history, credential, owner client configuration or provider integration. A new
UUID, private directory, permanent claim and evidence folder are required.

The existing owned controller creates a disposable source29 and executes30–33.
The wire executes actual34–37 inside the old outer savepoint. Before the original
feedback37 fixture, a new nested savepoint runs the five pinned batch drafts and
supplemental synthetic delegated-claims checks. Exact full37 catalogue, all table
row counts/hashes (payloads remain SQL-side), history and role metadata must match
after nested rollback; the new RPC, helpers and fixture identities must be absent.
Then the unchanged original37 fixture runs. The outer rollback must restore33;
original29/Auth/Storage/profile/global roles, both disposable DBs and shared-lock
cleanup remain mandatory.

Only outer BEGIN/COMMIT are removed from the batch candidate. Functional DDL and
fixture bytes stay exact. A proof-only top-level SET LOCAL SESSION AUTHORIZATION
postgres follows exact owned name/OID/marker/system-ID and initially authenticated
supabase_admin-superuser guards. It preserves the frozen transport and unchanged
candidate session-user checks. It is inside the new savepoint; rollback must
restore both original session and current identity before old37 validation. The
existing postgres SET-role paths to authenticated and anon are checked before
the identity switch; the proof never grants missing memberships. The
syntax/authority rule is documented in the [PostgreSQL17 reference](https://www.postgresql.org/docs/17/sql-set-session-authorization.html).

The supplemental fixture gives an existing synthetic actor broad business grants
and a synthetic OAuth session whose delegated claims allow only cast.read. It
checks effective capabilities, own-frame reads, ordinary/foreign-frame denial and
synthetic session expiry. This exercises native SQL claim enforcement; it does
not verify JWT signatures, real OAuth sign-in, provider refresh or an actual MCP
request. All fixture Auth/resource/session rows and GUC changes roll back.

Actual injected and original base wire hashes are reported separately. The proof
grants PostgreSQL functional/authority/rollback scope only: no native media, HTTP,
MCP transport, provider, hosted release, restore, endurance or production credit.
No preparation, SQL, Docker or provider call occurs during authoring/inert tests.

Root must copy the five stable drafts into Main, review the new sources, arm the
disabled gate and perform one fresh owned execution. Unknown outcomes never
authorize replay. Inert tests: `node --test development/m07/job-batch-filter-proof/proof.test.mjs`.
