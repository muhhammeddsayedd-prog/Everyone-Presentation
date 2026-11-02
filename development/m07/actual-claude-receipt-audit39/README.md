# Actual Claude receipt canonical audit

Fixed metadata-only read for supplied candidate scan, assignment, two fit jobs,
legacy Selection, empty new Shortlist and revoked review link. The normal pinned
reader uses one repeatable-read/read-only transaction and rollback. New SQL and
evidence exist only in Recovery. Main, deployed J3/c88, OAuth helper pins and all
existing records remain unchanged. No controller, MCP operation, generation,
token extraction, anonymous access, auth change or business mutation is performed.

Only IDs, enums, counts, timestamps, fingerprints/provider metadata and bounded
successful audit request IDs leave SQL. Person facts, names, notes, transcripts,
result bodies, token digests, encrypted replays, guest URLs and credentials do not.
Fit completion and current business permissions are explicitly distinct from
generation eligibility and capabilities in the actual issued Claude JWT.
