# Actual Claude receipt canonical audit

[Canonical receipt](2026-11-02T08-31-01-523979Z-canonical-receipts.json) and
[closed findings](findings.json) came from one bounded read-only/rollback query.
All new audit source, private SQL and evidence are in Recovery. Main, deployed
J3/c88, OAuth helper pins, credentials and existing records were not changed.
No MCP/controller replay, generation, token extraction or anonymous call occurred.

The recorded flow is historical: upload23:34-23:35, scan23:35-23:36 and fits23:50-
23:51 on November1. It predates the November2 Cp/J3 release; it is not relabeled
as a fresh journey through that deployment.

- Upload ba067 / asset3e656 is completed/ready,4316429bytes. Scan e6e001e4 succeeded
  at apply_candidate/attempt5; all five source-bound stage payloads persist.
  Extraction/frame selection include OpenAI request/response/model metadata.
- The recorded media3938a081, poolfc0681d0, Street Football slotd73b212e and
  assignment4f57713a match. Assignment is Option with Shortlist true;12frames are
  available and3selected. Existing candidate25a remains Reviewed/row3 and its
  entire canonical profile matches the earlier preservation baseline exactly.
- Selection93fb7425 retains only Ready version4f1b81a1. The whole retained row,
  all slides and all asset pins match the prior baseline exactly. New Shortlist
  dcf357b7 still has zero versions.
- Both series are registered everyone-casting1.1.0 and satisfy the installed
  generate-version template gate. Both requested fit jobs succeeded, recorded
  measured results match their job fingerprints, and both have zero overflows.
  Legacy-template and recorded-overflow explanations are unsupported by these facts.
- Review link0d796f8c is revoked at2026-11-01T23:37:54.379415Z/row2, with zero
  guest sessions. This does not prove anonymous access denial.

Normal persisted MCP-declared request IDs exist for upload reservation055305b7,
completion30e584b7 and assignmentca5a23ed. Review/link/fit/series audit rows have
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

Workspace row119/draft118 legitimately postdate the fits. Root documented the
shared client temporary rename/restore that advanced these revisions. They were
preserved, and no updated_at rollback was attempted. Current fingerprint/stale
state alone cannot establish the cause of the earlier failed generation call.
