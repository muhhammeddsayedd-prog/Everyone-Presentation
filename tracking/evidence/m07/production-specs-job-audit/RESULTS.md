# Production specs and immutable-version metadata audit

Read-only canonical observations, with rollback and bounded normal Supabase2.122
CLI output. No job/controller replay, mutation, restore, provider processing or
source/prompt/transcript/person-fact payload capture was performed.

- [Specs job](2026-11-02T03-40-13-527982Z-job6e3c.json): job6e3c succeeded in
  apply_specs. Prepare, extract and apply each had one stage attempt, one applied
  non-stale success event and one delivered outbox dispatch. Recorded n8n refs
  are31922/31923/31924. The source-bound OpenAI metadata records gpt-6.1-sol,
  request/response IDs and usage1153input+481output=1634tokens. Retained input is
  215bytes, source-hash verified and marked CONTROLLED SYNTHETIC. One source-bound
  role/headcount1 and one nonprovisional slot persisted. This is one authorized
  synthetic text execution; business accuracy and English/mixed quality are unproved.
- [V1 baseline](2026-11-02T03-43-50-093717Z-v1-snapshots.json) and
  [final comparison](2026-11-02T03-48-46-775064Z-v1-v2-compare.json): Selection
  and Shortlist v1 each remained exact across all six stored/canonical hashes
  (version row, slides, assets, snapshot, manifest, inventory). V2 is Ready in
  the same Selection series, with2pages/3frames/10fieldkeys. The known synthetic
  verification note is present by boolean only; internal_notes keys are absent.
  The current source profile remains Reviewed. Hash equality is between the
  stated03:43:50 baseline and final read, without an earlier-time claim.
- [Historical preservation](2026-11-02T03-52-18-532909Z-historical-preservation.json):
  against the unchanged protected pre-release39 checkpoint, all10preexisting
  Ready version rows,57slides,42asset pins and candidate25a's whole Reviewed
  profile match exactly. Only IDs/hashes/counts were queried or recorded. Numeric/
  Unicode canonicalization was verified within that same read. Client revisions
  and updated_at were neither compared nor restored.
- [Independent observation limits](independent-observation-limits.json): n8n
  metadata-only connector lookup returned -32603. The scoped worker-log connector
  returned403/forbidden; this does not mean no logs exist. Durable DB attempts
  record orchestration IDs but no instance identity. Root's fresh production
  worker identity receipt is referenced separately; direct job-to-instance log
  attribution and independent n8n retained status are not claimed.

Root separately owns real UI assignment/render/download/playback, Poppler/PDF
inspection and production deployment evidence. These reads do not close guest,
MCP/authprotocol, screen-reader, broad accuracy, recovery or AT069 acceptance.
