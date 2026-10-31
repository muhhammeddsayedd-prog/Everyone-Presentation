# Frontend and backend work coordination

Owner explicitly assigned the frontend/UI/UX redesign to Claude Code in the
separate `frontend/redesign` worktree, originally based on93981ca. Codex backend
continues in the main working tree. This note records file ownership and contract
impact; it does not claim the other agent has acknowledged it.

- Frontend worktree: `D:/Everyone/Presentation/Everyone-Presentation-Studio-Frontend`.
- Backend changes: Central SDK response identity fences, worker/integration/SQL
  recovery and operator validation tools, and progress/release evidence.
- Current CentralStudio fix changes no request fields, response schemas, operation
  IDs, routes, capability names or normal valid results. No frontend adaptation
  is required; malformed cross-resource RPC results now produce existing typed
  `CENTRAL_RESPONSE_INVALID`503.
- Codex will not edit frontend components/styles/layouts in that worktree or
  absorb its changes into a backend deployment. Keep API/public contracts stable;
  record and coordinate any necessary change before either side depends on it.
- Frontend worktree commits are not automatically in main. Preserve both branches
  and reconcile backend commits when integrating the redesign. No merge or push
  was performed by this note.

Completed owner Claude connection acceptance stays passed. Mobile remains skipped,
manual screen-reader/remaining M03 checks stay pending, and pilot remains running.

## English transcript requirement coordination

Owner clarified English-only display for all source speech; no language selector
and no further per-language answer-key collection required. Additive backend
contract is docs/integrations/ENGLISH_TRANSCRIPT.md. A new coordination note was
placed in the frontend worktree at tracking/CODEX_BACKEND_COORDINATION.md; no
frontend code changed, and acknowledgment is not yet observed.

Backend compatibility seam: root adds the fixed ENGLISH_TRANSCRIPT_UNAVAILABLE message in apps/web/components/CandidateProcessingIssues.tsx so the closed technical-issue union typechecks. No layout/style changes. Preserve this new enum label when reconciling the redesign; frontend branch file was clean at inspection.

Backend checkpoints available for frontend reconciliation:35cd663 (English processing/domain/SDK/HTTP-MCP read groups and fixed failure label),3cc50d4 (owned SQL proof and release safeguards). Current pilot is still Ccw/canonical33; English flag off. Please use english_transcript/status in candidate views and frozen english_text/status/hash in version/guest playback; absent legacy groups mean not_captured, never fall back to original-language text. No v1 language selector. Root has not merged or edited frontend code; this note does not assert acknowledgment.

## Small English display rollout patch (2026-10-31)

The owner now authorizes a minimal English display patch in main before the full
redesign. Read-only inspection found Claude's `frontend/redesign` at `a787fd3`,
with its English transcript implementation committed in `8aed642` and an explicit
acknowledgment in the existing frontend coordination note. No redesign code,
styles, branch commit or unrelated frontend changes were merged.

Main adapts only the English rendering in these overlapping files:
`CandidateDetailView.tsx`, `WorkspaceReviewView.tsx`, `SourceTranscript.tsx`,
`english-transcript.tsx`, `CandidateProcessingIssues.tsx`,
`tests/e2e/review-ui.spec.ts` and `tests/e2e/version-transcript-ui.spec.ts`.
The new focused `tests/e2e/english-candidate-ui.spec.ts` checks English display
states and read-only preservation of Reviewed facts. Keep Claude's layout/style
changes when reconciling these paths; do not overwrite either complete component.

The exact read dependencies are CandidateMedia `english_transcript` and
`english_transcript_status` for shared profiles and draft review; saved playback
uses only VersionTranscriptCompanion `english_text`, `english_status` and
`english_sha256` from its requested version and video. `SourceTranscript` is
shared by `PresentationVersionView`, `GuestReviewView` and `GrantMediaView`, so
the internal saved-video, guest-player and saved-PDF-video destinations share the
same English projection without new live-library reads. Their existing fetch,
access, refresh-denial and version/asset checks remain. The existing raw companion
shape check remains, but raw text is never rendered.

The main helper uses the landed shared types and direct browser-safe
`packages/domain/src/english-transcript.ts` validators, rather than Claude's
temporary local field aliases. Retain those shared validators when reconciling:
partial or malformed English groups produce an explicit error. A wholly missing
legacy group means English not captured; no selector or facts mutation is added.

Desktop HTTP/DOM verification passed 17 Chromium tests on main: candidate English
states, read-only Reviewed facts, paginated introductions/project choices, draft
review, guest/internal/saved-PDF frozen playback, absent/failed English states,
escaped markup, cross-video/cross-version rejection, partial-group rejection,
retained raw-shape guard and refresh denial removing previously delivered text.
The guest English test first failed against the old UI before the patch. Final
typecheck and focused ESLint passed. Controlled screenshots are local-only at
`.local/m03-english-ui/profile.png` and `guest.png`; these use synthetic HTTP data,
not real AI/media or hosted acceptance. Hosted deployment, real AI output, new
saved-version capture and preservation evidence remain separate release work.
Screen-reader acceptance stays pending and mobile testing stays skipped.

Root review found a further English-display seam in saved playback's optional
spoken-language metadata: unknown provider values could render verbatim.
`SourceTranscript` now preserves known English aliases, resolves recognized
language codes with English `Intl.DisplayNames` labels, and uses the neutral
English label `Other spoken language` otherwise. The new non-English-metadata
regression failed before the fix; all 14 saved/guest/PDF transcript Chromium
checks pass after it. No layout, selector, authorization or frozen-data change.
