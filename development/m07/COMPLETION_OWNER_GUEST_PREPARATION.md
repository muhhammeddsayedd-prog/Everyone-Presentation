# Existing Claude connection: guest preparation only

Use the existing `everyone-studio` connection and its normal producer authority.
Keep generation paused. Do not reconnect, sign in, change grants, assign cast,
create a presentation version, or alter historical content.

This prepares the first bounded guest-feedback and manual-reader case against
the already generated human Selection output:

- Project: `bf650022-0f7f-4928-a8eb-46a27ef555d4`
- Workspace: `5505def3-f7af-4684-968c-d1b154931601`
- Selection series: `0b26d206-645a-4c9c-bbee-7307265ac68c`
- Expected newest Ready version: `1b20ec2d-f133-4912-8efe-df2e21a3865e` (v2)

1. Read the series and version through MCP. Confirm this exact version is Ready,
   Selection and an external audience. Stop if a different Ready version has
   superseded it. Select the actual first **candidate** slide ID from the version,
   not a cover, assignment, pool entry or fabricated ID. Do not change content.
2. Read every page of feedback for this exact version, including internal notes
   with producer authority. Use an existing clearly labelled internal test note
   on that candidate slide. If none exists, create exactly one internal note:
   `Release guest acceptance internal note - 2026-11-02.` Keep its idempotency key
   private and preserve the note and audit. Do not edit other feedback.
3. Re-read every feedback page and get the exact-version producer summary.
   Derive a complete external-only `FeedbackSummary` using all version slides,
   including zero-count slides, and every external feedback page. Preserve
   complete-count semantics for comments, unresolved comments and preferences.
   The producer comment count must exceed the external count because of the
   known internal note. Use the current contract fields; do not invent a DTO.

Return only safe series/version/candidate-slide/internal-note IDs, request IDs,
the two complete counts-only summary objects, and page completion/counts.
Keep feedback bodies, candidate facts, keys, credentials and private URLs out of
chat. Report a safe code/request ID if an operation fails, and stop after these
three steps.

**Do not create a review link yet.** Root will prepare the fresh protected inbox
after receiving these IDs/counts, then use the existing
[bounded guest handoff](completion-guest/OWNER_TASK.md). Its private capability
will enter only through structured Write, and the new temporary link will be
revoked after the HTTP and real screen-reader checks. No unrelated link or
session will be revoked.
