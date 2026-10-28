# Storage operation context and signed upload upsert

Research date: 2026-10-28. Status: source-supported policy proposal; no Storage mutation or transfer performed by this research task.

## Result

Supabase provides a documented way to distinguish signed-upload URL creation from ordinary authenticated upload in RLS: `storage.allow_only_operation()`. The hosted database has the required helpers. Current official Storage source also passes the signing request's `x-upsert` header to transaction-local `request.headers`, and uses that same header to decide the signed token's upsert authority. A mint-time INSERT check can therefore reject upsert signing while allowing ordinary user-JWT uploads **on that implementation**. The deployed HTTP service's context propagation remains an endpoint acceptance gate; a database helper's presence alone does not prove it.

The least dependent fallback is an operation allowlist permitting only `object.upload` for app object INSERTs, with all `object.sign_upload_url` operations denied. That retains user-JWT Storage upload, but requires the explicit transport-contract adaptation described in [the logo boundary proposal](logo-storage-boundary.md). No application upload capability is enabled by this note.

## Observed deployed database evidence

The parent's read-only [fixed metadata query](../../tools/sql/discover-storage-policy-context.sql) produced [storage-policy-context.json](storage-policy-context.json), observed at `2026-10-28T02:37:52.769726+00:00` in canonical project `pyibofyctwnqpvktepse`:

- `storage.operation()` reads `current_setting('storage.operation', true)`.
- `storage.allow_only_operation(text)` and `storage.allow_any_operation(text[])` exist, are invoker functions, and are executable by `authenticated`.
- The helpers normalize the optional `storage.` prefix and compare complete operation names. An absent operation does not match.
- There are no `storage.objects` policies in that receipt. HMAC is in `extensions`; this does not establish key provisioning or receipt verification.

This was metadata inspection, not an authenticated Storage request, deployed-service version receipt, policy test, bucket creation, or upload. No duplicate introspection query was introduced.

## Official implementation trace

The [helper documentation](https://supabase.com/docs/guides/storage/schema/helper-functions#storageallow_only_operation) explicitly supports operation-aware RLS and links to the operation-name source. The following implementation links are pinned to official repository commit `b11f751abe0fdd6c7f56d3a858b5527f683b7a37`, committed `2026-10-27T21:12:22Z`. This is the observed upstream commit, not a claim about the hosted service's deployed commit.

| Step | Official source evidence |
|---|---|
| Select operation from server route configuration | [log-request.ts, lines 83–115](https://github.com/supabase/storage/blob/b11f751abe0fdd6c7f56d3a858b5527f683b7a37/src/http/plugins/log-request.ts#L83) assigns `req.operation` from `req.routeOptions.config.operation`. It does not read an operation HTTP header. |
| Identify the two routes | [operations.ts, lines 16–35](https://github.com/supabase/storage/blob/b11f751abe0fdd6c7f56d3a858b5527f683b7a37/src/http/routes/operations.ts#L16) defines direct upload as `storage.object.upload`, sign minting as `storage.object.sign_upload_url`, and signed-token transfer separately as `storage.object.upload_signed`. |
| Read effective signing flag | [getSignedUploadURL.ts, lines 63–99](https://github.com/supabase/storage/blob/b11f751abe0fdd6c7f56d3a858b5527f683b7a37/src/http/routes/object/getSignedUploadURL.ts#L63) sets the sign operation and uses `request.headers['x-upsert'] === 'true'`. Other spellings/values do not enable upsert in this code. |
| Pass context to the database | [db.ts, lines 65–77](https://github.com/supabase/storage/blob/b11f751abe0fdd6c7f56d3a858b5527f683b7a37/src/http/plugins/db.ts#L65) passes the same request headers and a server operation accessor. [pg-connection.ts, lines 654–670](https://github.com/supabase/storage/blob/b11f751abe0fdd6c7f56d3a858b5527f683b7a37/src/internal/database/pg-connection.ts#L654) JSON-serializes those headers. [scope.ts, lines 13–22 and 48–66](https://github.com/supabase/storage/blob/b11f751abe0fdd6c7f56d3a858b5527f683b7a37/src/internal/database/postgres/scope.ts#L13) binds them into transaction-local `request.headers` and `storage.operation`. |
| Authorize before signing | [object.ts, lines 1646–1673](https://github.com/supabase/storage/blob/b11f751abe0fdd6c7f56d3a858b5527f683b7a37/src/storage/object.ts#L1646) invokes `canUpload` before signing; the token contains the resulting `upsert` boolean. [uploader.ts, lines 84–121](https://github.com/supabase/storage/blob/b11f751abe0fdd6c7f56d3a858b5527f683b7a37/src/storage/uploader.ts#L84) tests INSERT or upsert inside a rolled-back permission transaction. No object need already exist. |
| Consume token authority later | [uploadSignedObject.ts, lines 82–100](https://github.com/supabase/storage/blob/b11f751abe0fdd6c7f56d3a858b5527f683b7a37/src/http/routes/object/uploadSignedObject.ts#L82) verifies the token, then uses Storage's privileged `asSuperUser()` upload path with the token's `upsert` value. The [SDK reference](https://supabase.com/docs/reference/javascript/storage-from-uploadtosignedurl) states transfer-time `upsert` does not change that authority. |

Thus `x-upsert` is caller-supplied input, not an authorization identity. It is usable here because the policy inspects the same request value from which Storage derives token authority. The trusted discriminator is the server-selected operation. Do not expose a general RPC that sets either context value, and do not substitute an `X-Storage-Operation` header for the operation helper.

## Proposed enforcement

Keep existing reservation/JWT/resource authorization in the app-specific INSERT policy. Add operation restrictions for the exact app bucket/key; they do not replace those checks.

1. Ordinary user-JWT upload: require `storage.allow_only_operation('object.upload')`. Prefer rejecting `x-upsert='true'` here too, since logo keys are immutable and the app needs only new uploads.
2. Optional signed upload mint: require `storage.allow_only_operation('object.sign_upload_url')`, valid object-shaped `request.headers`, and no effective `x-upsert='true'`.
3. A stronger fail-closed mint variant requires the JSON header value to be **explicitly the string `false`**, rather than allowing a missing header. The mint request must deliberately send `x-upsert: false`. This denies missing header propagation instead of treating it as a safe default. The installed `storage-js` method otherwise omits this header when its `upsert` option is false; its user-scoped transport/header configuration must therefore set it explicitly. An attacker supplying `true` still causes denial.
4. Deny unknown or absent operation context. Grant no ordinary object UPDATE/DELETE rights for these keys. Restrict the corresponding SELECT policy to intended read operations/reservation access as well.

These are policy requirements, not executable migration SQL. For composition safety, an app-bucket operation guard should be a restrictive INSERT policy (or be present in every applicable permissive INSERT policy): PostgreSQL combines permissive policies with OR, so an unrelated broad grant could otherwise bypass the guard. A restrictive policy still needs a permissive reservation policy. [PostgreSQL policy composition](https://www.postgresql.org/docs/17/sql-createpolicy.html#SQL-CREATEPOLICY-MULTIPLE-POLICIES)

Omitting UPDATE alone does not prove dangerous minting is impossible: the upsert permission probe can take the INSERT path when a key is absent. PostgreSQL applies UPDATE row checks when the conflict UPDATE path is taken. Reject the signing operation/flag at mint time, before a transferable upsert capability exists. [PostgreSQL INSERT/UPDATE RLS behavior](https://www.postgresql.org/docs/17/sql-createpolicy.html)

## Remaining proof before enabling signed transfer

Use real user-JWT HTTP/SDK requests against the actual policy implementation, separately from SQL GUC fixtures:

- New reserved key: normal upload succeeds; minting with `upsert:true` fails **before the object exists**, with no token returned.
- Hardened variant: explicit false mint succeeds; omitted/true/malformed header and unknown/missing operation fixtures fail. HTTP operation-header spoofing cannot change the server discriminator.
- A false-upsert token cannot be promoted by transfer headers/options; reuse after completion cannot replace bytes. Verify the stored checksum remains unchanged after direct update, direct upsert, signed-token replay, move and delete attempts.
- Nonmember/cross-actor/expired/cancelled reservations fail; current scope is rechecked at completion. Preserve the disclosed limit that an already issued non-upsert token can deliver private orphan bytes until provider expiry, without publishing Ready media.
- Confirm no other permissive policy grants the mint path, and no runtime client has service-role/bypass authority.

No such endpoint tests were performed by this read-only research. If deployed header propagation is unavailable or uncertain, deny **all** sign minting by exact operation and implement the reviewed direct user-JWT transport adaptation. If deployed operation propagation itself is unavailable, keep both paths disabled until there is a reliable boundary.
