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
