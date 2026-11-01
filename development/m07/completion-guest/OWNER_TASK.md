# Owner's existing Claude session: bounded guest write handoff

Start only after root has reviewed/armed this new helper and your current
upload journey is finished. Use the existing `everyone-studio` connection and
normal producer permissions. No new account, login, reconnect or copied secret
configuration is needed.

1. Read the current external Ready version in the authorized project. Select
   its actual first slide ID from `get_version`, not an assignment ID or a
   fabricated UUID. Confirm the series, output and external audience. Keep
   old Ready versions unchanged.
2. Use a known actual internal test note on that same version (or create one
   clearly labeled internal test note through normal producer MCP, preserving
   it/audit). Read every page of `list_feedback`. Derive exact external-only
   per-slide/total comments, unresolved comments and preferences, including
   slides with zero counts as the summary contract requires. Call
   `get_feedback_summary` for the producer before-snapshot. Confirm its comment
   count exceeds the external count and retain the actual internal note ID.
   Do not infer external zeros from only the first page.
3. Tell root only safe series/version/slide/internal-note IDs and before-counts.
   Root prepares this new handoff only now:

```text
node --import tsx development/m07/completion-guest/inbox.mts prepare --version-id <Ready UUID> --slide-id <actual slide UUID> --internal-comment-id <actual internal note UUID>
```

4. Create one temporary review link for that same external series through MCP,
   with downloads disabled and an explicit short expiry sufficient for the
   immediate check/cleanup. Retain exact link ID/expiry and token privately.
   The link must still point to the selected newest Ready version.
5. Use built-in **structured Write** to create exactly the returned protected
   `handoff_file`. No shell, heredoc, argv, environment, chat, stdout or general
   log may carry the link token, URL or session capability. Write this closed
   object, replacing the two summary strings with complete counts-only
   `FeedbackSummary` objects (not JSON strings):

```json
{
  "schema_version": "1.0",
  "run_id": "<prepared UUID>",
  "nonce": "<prepared nonce>",
  "manifest_sha256": "<prepared hash>",
  "guest": {
    "run_id": "<same prepared UUID>",
    "review_link_id": "<new create_review_link link.id>",
    "series_id": "<same link.series_id>",
    "version_id": "<prepared Ready UUID>",
    "version_slide_id": "<prepared actual slide UUID>",
    "internal_comment_id": "<prepared actual internal note UUID>",
    "link_expires_at": "<same link.expires_at>",
    "review_token": "<exact private create_review_link token>",
    "expected_guest_before": "<complete external-only FeedbackSummary object>",
    "producer_before": "<complete producer get_feedback_summary object>"
  }
}
```

6. Root opens the bound anonymous session and explicitly confirms once:

```text
node --import tsx development/m07/completion-guest/inbox.mts open --run-id <UUID> --manifest-sha <hash>
node --import tsx development/m07/completion-guest/inbox.mts confirm --run-id <same UUID> --manifest-sha <same hash>
```

   If first confirmation is recorded unconfirmed, root may explicitly run
   `resume` once with those exact IDs. This reuses saved body/key/session; never
   make a replacement run to retry a possibly accepted comment. No automatic
   retry occurs. A blocked/failed phase is not acceptance.
7. Through normal MCP read the returned comment ID on that fixed version,
   confirm one external labeled test comment, preserve the old internal note
   and other feedback, and re-read producer summary (+1 external comment).
   These are actual authenticated owner observations, separate from the
   helper's anonymous HTTP result. Preserve the new test comment and audit.
8. Revoke only this newly created review link through MCP, retain the actual
   result, then have root run this before natural expiry:

```text
node --import tsx development/m07/completion-guest/inbox.mts deny --run-id <same UUID> --manifest-sha <same hash> --reason revoked
```

   Both old session and original link must deny. Successful denial removes only
   this helper's private session file. If anything is unconfirmed, revoke the
   known new link anyway and report the precise phase; do not delete feedback,
   revoke unrelated access, erase dispatch claims or claim full acceptance.
