# Actual Claude receipt canonical audit

[Canonical receipt](2026-11-02T08-31-01-523979Z-canonical-receipts.json) and
[closed findings](findings.json) came from one bounded read-only/rollback query.
All new audit source, private SQL and evidence are in Recovery. Main, deployed
J3/c88, OAuth helper pins, credentials and existing records were not changed.
No MCP/controller replay, generation, token extraction or anonymous call occurred.

The recorded flow is historical: upload 23:34-23:35, scan 23:35-23:36 and fits
23:50-23:51 UTC on November 1. It predates the November 2 Cp/J3 release; it is not relabeled
as a fresh journey through that deployment.

- Upload ba067 / asset 3e656 is completed/ready, 4,316,429 bytes. Scan e6e001e4 succeeded
  at apply_candidate/attempt 5; all five source-bound stage payloads persist.
  Extraction/frame selection include OpenAI request/response/model metadata.
- The recorded media 3938a081, pool fc0681d0, slot d73b212e and
  assignment 4f57713a match. Assignment is Option with Shortlist true; 12 frames are
  available and 3 selected. Existing candidate 25a remains Reviewed/row 3 and its
  entire canonical profile matches the earlier preservation baseline exactly.
- Selection 93fb7425 retains only Ready version 4f1b81a1. The whole retained row,
  all slides and all asset pins match the prior baseline exactly. New Shortlist
  dcf357b7 still has zero versions.
- Both series are registered everyone-casting 1.1.0 and satisfy the installed
  generate-version template gate. Both requested fit jobs succeeded, recorded
  measured results match their job fingerprints, and both have zero overflows.
  Legacy-template and recorded-overflow explanations are unsupported by these facts.
- Review link 0d796f8c is revoked at 2026-11-01T23:37:54.379415Z/row 2, with zero
  guest sessions. This does not prove anonymous access denial.

Normal persisted MCP-declared request IDs exist for upload reservation 055305b7,
completion 30e584b7 and assignment ca5a23ed. Review/link/fit/series audit rows have
API/null request metadata; these rows do not reconstruct the failed generation
response. The original structured error/code/request ID was not retrieved and
the failure was not retried. No exact permission/input/revision cause is claimed.

Current business grants include presentations.generate and one fixed-client
resource registry row is enabled. Those do not expose the capabilities in the
actual issued Claude JWT. The three reported session rows are scoped to this
scan requester and fixed client; they are not the global count and are not
attributed to Claude versus the separately owned SDK. Current catalogue grants
create_presentation_series and generate_version via presentations.generate,
while fit requests use workspaces.write; this is source evidence, not token proof.

Workspace row 119/draft 118 legitimately postdate the fits. Root documented the
shared client temporary rename/restore that advanced these revisions. They were
preserved, and no updated_at rollback was attempted. Current fingerprint/stale
state alone cannot establish the cause of the earlier failed generation call.
The preservation comparisons use the November 2 03:52 baseline, which itself
postdates the historical Claude flow; no earlier before-flow hash comparison is claimed.
