# Bounded anonymous guest feedback-summary probe

This owner-operated helper fills the missing guest-side acceptance path. It
creates no review link, feedback, identity, producer credential, job or permission.
`POST review/open` creates an ordinary anonymous guest session. Every subsequent
request uses the existing public guest contract at the fixed pilot origin.

**Live acceptance is not run.** The owner's existing Claude session is occupied
with frontend work. Do not interrupt it, request another login/reconnect, prepare
an expiring inbox in advance, or treat the synthetic tests as hosted acceptance.
Root can include these steps in the already required future owner MCP journey.

## Prepare only when the owner is ready

From the checkout containing this helper, with Node24 and existing dependencies:

```text
node --import tsx development/m07/guest-summary-delta/inbox.mts prepare --version-id <actual-external-Ready-UUID> --denied-version-id <actual-other-series-or-internal-Ready-UUID>
```

All command arguments and output are nonsecret. Preparation creates a new UUID
directory under `.local/guest-summary-delta/`, protects it for the current Windows
owner and SYSTEM before writing, and returns `run_id`, `nonce`, `manifest_sha256`,
`handoff_file` and `expires_at`. The new handoff expires after30minutes; actual
probe timing also requires an unexpired link. It is unrelated to the upload inbox.
Nothing prepares itself on import.

Through the **existing** everyone-studio connection, the owner Claude session:

1. Reads the exact Ready version/series and producer `get_feedback_summary`.
   Chooses an actual existing internal-audience or foreign-series Ready version
   for denial, rather than inventing a nonexistent UUID.
2. Creates a temporary review link for the external series with downloads disabled
   and an explicit expiry. Retains the exact creation result privately. It must
   still follow the intended newest Ready version when probed.
3. Determines the complete expected external counts from known authorized test
   feedback. The helper compares the full closed `FeedbackSummary`; it never
   estimates counts from a first list page. Existing nonzero external feedback
   and an internal note can establish privacy without adding feedback. If both
   snapshots have equal comments, the receipt reports internal filtering
   **unverified**. A zero summary does not prove nonzero counting.
4. Uses built-in **structured Write**, creating exactly `handoff_file` with this
   closed object. No raw link/token belongs in a shell command, heredoc, chat,
   stdout, general log, Git or an environment variable:

```json
{
  "schema_version": "1.0",
  "run_id": "<prepare-returned-UUID>",
  "nonce": "<prepare-returned-nonce>",
  "manifest_sha256": "<prepare-returned-SHA256>",
  "probe": {
    "schema_version": "1.0",
    "review_link_id": "<create_review_link result link.id>",
    "series_id": "<same link.series_id>",
    "version_id": "<prepared external Ready version UUID>",
    "denied_version_id": "<prepared existing inaccessible version UUID>",
    "denied_version_kind": "internal_audience",
    "link_expires_at": "<same link.expires_at>",
    "review_token": "<exact private create_review_link result token>",
    "expected_guest_summary": "<replace this string with complete counts-only FeedbackSummary object>",
    "producer_summary": "<replace this string with complete get_feedback_summary object>"
  }
}
```

`denied_version_kind` can instead be `foreign_series`. Summary DTO fields are
defined by `packages/domain/src/feedback-summary.ts`; arbitrary extra fields,
comment bodies, author names, duplicate JSON keys and malformed counts refuse.
Producer snapshot and link identity are explicitly owner-supplied evidence,
not a second independently authenticated producer API observation.

## Probe and then deny access

```text
node --import tsx development/m07/guest-summary-delta/inbox.mts probe --run-id <UUID> --manifest-sha <SHA256>
node --import tsx development/m07/guest-summary-delta/inbox.mts deny --run-id <UUID> --manifest-sha <SHA256> --reason revoked
```

The first command verifies ACLs, regular/single-link identity, nonce, exact
version binding, TTL and six source seals. A durable exclusive claim precedes
network dispatch, then the known handoff file is unlinked. Six requests verify:
missing-session denial; a fresh anonymous open; exact saved-version counts;
unchanged reload; selected inaccessible version denial; unsupported query denial.
The helper sends neither Authorization nor Cookie, uses `credentials: omit`,
rejects redirects, keeps tokens out of URLs, and never creates feedback. The
only destinations are fixed `/api/v1/review/...` paths at the pilot origin.

After probe succeeds, the owner revokes **this newly created link** through MCP
and records that actual result separately, then runs `deny ... --reason revoked`
before the link or session naturally expires. Both the old session summary and
the original link open must reject. Otherwise revocation is unverified. Successful
denial removes the private session file and returns only safe IDs/receipt paths.

To test natural expiry, use a **separate** temporary link/run, with a short
explicit expiry sufficient to finish the probe. After its recorded expiry, run
`deny ... --reason expired`. This proves old-session and original-link rejection
after the known deadline. It does not independently inspect producer lifecycle
state; retain owner/MCP link metadata separately. Revoke this expired test link
through MCP afterward as normal cleanup. Do not extend/revoke between its probe
and expiry check or label a denial caused by both events as isolated expiry.

Early/expired input gates refuse before creating a dispatch claim. Once a network
phase is claimed, unknown outcomes never authorize automatic replay. After any
failed probe/denial, use the known link ID to revoke via normal MCP; the helper
does not acquire producer credentials to do so. Use of a retained private session
is limited to a one-hour observation window; its file remains until successful
denial or a later authorized cleanup. No background process deletes it.
JavaScript strings are not guaranteed RAM-zeroized and unlinking is not secure
disk erasure. The client may retain its own MCP tool result independently.

Receipts are new exclusive files under `tracking/evidence/m07/guest-summary-delta/`.
They contain exact counts, safe IDs, request IDs and source hashes; no tokens,
URLs, raw errors, private notes or source/media payloads. No existing trackers,
app/frontend source, releases, historical proofs or deployed configuration change.

## Verification and retained cleanup blocker

```text
node --import tsx --test development/m07/guest-summary-delta/probe.test.mts development/m07/guest-summary-delta/inbox.test.mts
node node_modules/typescript/bin/tsc --project development/m07/guest-summary-delta/tsconfig.json
node node_modules/eslint/bin/eslint.js development/m07/guest-summary-delta/*.mts --max-warnings 0
```

Tests use synthetic fetch and data; one test verifies actual Windows owner/SYSTEM
ACLs on a newly prepared empty temporary directory. Current tests register cleanup
of their exact guarded temporary paths. Earlier six synthetic test directories
predating that registration remain because automatic approval rejected their
explicit PowerShell cleanup as **`blocked by policy`**. No deletion was performed,
retried or reimplemented through another transport. Exact retained basenames:

- `eps-guest-delta-1BCvtD`
- `eps-guest-delta-acl-ZgKS6h`
- `eps-guest-delta-dvsEBZ`
- `eps-guest-delta-IAvr4g`
- `eps-guest-delta-SHDenK`
- `eps-guest-delta-ZdfUQ4`

They are under the current user's OS TEMP and contain only synthetic test inputs,
not live credentials. This cleanup rejection is separate from the existing AT069
rollback-preparation rejection. Preserve these directories pending normal
resolution; do not invoke a manual equivalent or alter tools to evade review.
