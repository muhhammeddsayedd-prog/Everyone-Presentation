# M03 candidate library work in progress

Started 2026-10-29. Hosting remains deferred. Core library migration
`20261029090724_m03_candidate_library.sql` is applied locally and in the canonical
cloud database. Its cloud comparison failure and bounded read-only reconciliation
are preserved under `tracking/evidence/cloud-candidate-library/`. Application,
kernel, asset and lifecycle SQL fragments in this directory remain forward
development composition until their own coordinated release is verified. None
of the SQL fixtures proves native video bytes or a live provider request.

The inspected canonical source has no existing cast/person relation. A single
`eps.candidates` owner stores reusable supplied facts and their lightweight
provenance. `eps.candidate_media` preserves source recordings independently;
`eps.workspace_candidates` pins the chosen recording, frames and project-only
availability. Confirmation fingerprints exclude project choices. No source text
can supply capabilities, identity resolution or SQL instructions.

Current evidence: domain boundary/review/unknown-filter/pinning tests, strict
central SDK adapter tests, local MCP protocol tests, forced RLS/capability
negatives, local14 candidate rollback and local15 persisted library rollback.
The composed local15 pipeline proof `d380c9a7` covers mixed Arabic/English source,
grounded populated fields, three registered frame metadata records, invalid quote
rejection, stale manual edits/review, media appends/pins, lease recovery/cancel,
and retained archived/merged profiles. It explicitly uses synthetic SQL metadata.

The forward lifecycle fragment preserves the immutable core15, keeps search
active-only while allowing retained ID reads, resolves two profiles already in
one project without replacing the existing selected recording, and stores
optional archive/remove reasons as private audit context. M04 must integrate
assignment transfer/retirement before enabling that storage; the current guard
prevents guessed assignment mutation. Worker/native bytes, real provider quality,
resumable upload/reload, broader batch capacity and app acceptance remain separate.
