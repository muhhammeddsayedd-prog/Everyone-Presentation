# Canonical admission still to be completed

The guard proposal is intentionally incomplete and inert. Its unconditional
`M07_ISSUER30_REVIEW_ONLY_FRESH_PREFLIGHT_REQUIRED` error prevents dispatch of
this review file as a working migration. The future release must replace the
review package with a separately sealed executable artifact after completing
the metadata and transaction proofs below; this is existing release preparation,
not another product-owner approval barrier.

## Facts pinned from canonical evidence

`historical29-expected.json` copies exact selected safe metadata from canonical
readback `f553771a`, including its exact29 ordered version list. It contains no
Auth rows, keys, session/token payloads or client identities. The migration29
file hash is `6531e8decab5496e212eb01575aca666cd9e03b0575f92dd66bd380760f84af4`.

The preview checks exact history rather than only count/max, requires postgres
on database postgres, refuses any existing issuer role/function overload or
same-name issuer policy, and preserves these historical source hashes:

| Function | CRLF-to-LF normalized `prosrc` SHA256 |
| --- | --- |
| `eps.mcp_claim_uuid(text)` | `349e340f118aa7edc5df906af303ae43f6193e703c76613ef400b83e4704f2a7` |
| `eps.mcp_token_permits_capability(text)` | `5eb6c1272a78a4ca821569082c54d2b1ce434516585c8eac533c29ec1c445ccc` |
| `public.eps_validate_own_oauth_session(text)` | `9fe44accb3998d924bb0f453c721a33f5603f20e4c245abbf0e46807561891f6` |
| `eps.has_capability(text)` | `f6cffbe4308b858e28d606fcb454ac7aa5c0dcce6ea6d7e8a47c827279358813` |
| `public.eps_get_capabilities()` | `33766419ad2c561145d791704f34bb2dbf503e82ffcfd957acf79a138a5daee5` |

It also asserts the three delegated-session functions' existing narrow owner,
language, empty search path, security/return properties and exact ACL; the
nonlogin/nonsuperuser/nonbypass attributes of the existing session and Settings
owners; postgres ownership and forced RLS of registry/Settings; and the six
required typed, non-dropped lookup columns. It creates no client/resource rows.
These assertions cannot fill in metadata never observed in the saved receipt.

## Fresh canonical preflight for the next phase

1. Bind the authorized connection to exact central project
   `pyibofyctwnqpvktepse` using the existing release targeting mechanism. A
   database called postgres, SQL GUC, URL shape or local file alone cannot prove
   project identity. Record safe target, query-role, observation time and source
   hashes without credentials or raw hook/token payloads.
2. Capture full structural catalogue plus safe all-role OIDs, attributes and
   complete memberships. Confirm the exact ordered29 history, original
   migration29 bytes, and all preserved function hashes/owners/ACL/configuration.
   Capture and pin current source hashes of the guard, candidate body, readback,
   rollback/forward-fix, source manifest and release controller.
3. Freshly prove no `eps_mcp_issuer_owner`, no hook overload in eps, no policy
   collision and no incompatible dependency. Capture full current metadata of
   `public.app_capability_grants` and `eps.mcp_oauth_resources`: owner, columns,
   defaults/nullability/ACL, constraints/indexes, forced RLS, policies and existing
   table/column effective privileges. Capture eps/public schema ownership/ACLs,
   default function ACLs, and Auth-admin effective executable functions before
   changing schema USAGE. Do not guess missing capability-table owner or ACL.
4. Preserve existing Auth/table ownership, own-session RLS, narrow column grants,
   migration29 Settings/session/claim functions and all existing roles/OIDs.
   Confirm current resources, Settings, capability grants, business/Auth data,
   immutable ready-version/media state and runtime12 permission surface through
   protected safe before/after fingerprints. Mutable business state must use a
   fresh baseline; do not overwrite or demand historical row_version1/defaults.
5. Establish release quiescence and the shared local-test lock discipline for
   rehearsals. Do not run canonical jobs, seeds, resets, identity provisioning,
   workflow changes or provider configuration. Reject unexpected history,
   metadata or existing issuer objects; do not adopt, replace or normalize them.

The final executable admission must compare the entire pinned relevant metadata
and the protected remainder, not only these preview checks. Confirm source
hashes immediately before dispatch and after readback. If an object is missing,
an exact comparison returns NULL, the role/source changes, or a new migration is
present, fail closed before DDL. Do not expand an allowlist to conceal drift.

The preserved issuer suffix adds one NOLOGIN/NOBYPASSRLS owner, its postgres
membership, six column SELECT privileges, two role-specific SELECT policies,
one private definer function, Auth-admin-only function EXECUTE and eps schema
USAGE. Its temporary schema CREATE is revoked before transaction completion.
Forced RLS still applies to its non-bypass owner. Prove effective privileges,
including any unrelated functions newly reachable through Auth-admin eps USAGE;
a raw GRANT list alone is insufficient. No Auth schema/table read or ownership
change is part of this issuer body.

Existing provider hook state is a separate read-only discovery requirement
before any activation. Preserve/compose an unrelated configured hook rather
than replacing it. Keep existing issuer, Site URL and signing settings. The
resource registry stays empty through issuer migration30; registration requires
the real returned UUID and an exact independently verified resource binding in
a separate reviewed operation.
