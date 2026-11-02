# Production UI and manual screen-reader task

**Pending; preparation only.** Run after root confirms the new deployment and
live-switch resume. No browser, app/API/MCP or canonical writes were performed
while preparing this checklist. Preserve protected jobs, Reviewed facts, old
Ready versions and unrelated access. Use the release-test records/material
already selected for the journey; label and preserve any new test records.

Reuse [AT-071/072/073 in the test strategy](../../docs/quality/TEST_STRATEGY.md)
and the [M06 UI plan](../m06/UI_AND_SECURITY_PLAN.md). AT-072 still requires
actual assistive-technology use: slide navigation, carousel state, preference
group, comments and video transcript. Automated tests/axe and screenshots alone
do not pass it. Mobile testing remains skipped under the owner's existing waiver.

Before starting, record UTC time, exact serving deployment/source, normal acting
role, browser/version, desktop screen reader/version and zoom. Use the actual
reader and keyboard throughout; record the controls/states it announces, visible
focus, focus destination and each pass/fail/unperformed result. Keep private
screenshots/audio/diagnostics protected; publish only safe IDs, short control
announcements and outcomes, never credentials, review URLs or full transcripts.

| Area | Manual action and required observation |
| --- | --- |
| Shell and Projects | Reload the newly served interface. Navigate landmarks/headings and primary navigation by keyboard. Accessible names match visible labels; current page/filter/selected project is understandable. Search, All/Casting in progress/Not started, project details and pagination remain reachable with visible focus. Record actual permission/empty/error states rather than assuming an empty result is confirmed. |
| New project drawer | Open **New project**. Hear its dialog name/description; Tab/Shift-Tab stay within it. Check required **Project name**, **Presentation type**, optional **Find an existing client/Shared client**, loading state and **Load more clients**. Only permitted existing clients appear. Escape/Cancel, unsaved-discard confirmation and return focus behave coherently. Create one labeled Casting project; its same canonical ID/type/client survive reload. The saved overview precedes the separate **Start casting** action and Selection/Shortlist choice. |
| Planned types and recovery | Planned options announce **Planned**, with a clear explanation. Open an existing planned test project, or create one labeled planned test record if needed: reload preserves its type, and overview shows Planned without a new generation workflow/job. If a genuine uncertain create occurs, reload, use **Resume project creation → Confirm create request**, and confirm the retained request explicitly; fields remain frozen and the same project ID returns. Do not deliberately manufacture a lost response or submit a fresh request to bypass uncertainty. Unexercised recovery stays unperformed; deterministic recovery tests retain their own scope. |
| Files and folders | Reach **Choose files** and, where supported, **Choose folder** through the keyboard and native picker. Selection adds supported files to the queue without claiming upload completion. Filenames, confirmed bytes and Ready/Transferring/Reselect original states are understandable. **Upload / resume pending files**, Pause, Resume, Cancel file and View processing have meaningful names; pausing transfer does not claim that queued processing stopped. Unsupported folder selection retains ordinary file intake. |
| Workspace and casting | Inspect loaded workspace summary and its refresh/error state. With the assigned test records, reach requirements, role/slot editors, frame choices, shortlist and Main/Backup/Option controls without drag-only interaction. Where two test roles exist, **Move up/Move down** and the saved order/status are understandable. Save/error/discard dialogs retain and return focus. Pending/Not provided stays explicit; Reviewed remains factual confirmation. Do not change protected facts or jobs for this spot-check. |
| Processing and counts | Open an existing test job/batch. Hear job kind/status/progress, last-check/loading state, batch context, and First/Next jobs controls. Pagination keeps the batch scope; loaded-file counts do not masquerade as full totals. Refresh feedback/workspace summaries gives confirmed counts or a clear unavailable state, never stale counts presented as a fresh successful read. Observe recovery controls only under the acting user's existing capabilities; do not retry/cancel protected or in-flight work. |
| **AT-072: saved slides and frames** | In an existing Ready version and its shared viewer, read numbered slide buttons, role/slot, Pending and **Slide n of m**. Use Previous/Next slide; the current slide is announced and boundaries disable coherently. On a multi-frame candidate use Previous/Next frame: hear **Frame n of m**, useful image alternative text and boundary state. Missing/fewer frames are valid. App view/PDF preview selection is understandable; all ten saved fields remain readable. Arrow keys inside a form/video control must not unexpectedly change slides. |
| **AT-072: preference and comments** | Use the authorized temporary guest review context without producer navigation. View before identifying. Hear **Your preference for this candidate**, each option, selected state and saved/cleared announcement. Introduce the named guest only when writing. Use one already bounded labeled external-comment case; verify compose/post/own edit/reply, version/role context, unsent-comment discard/keep-writing focus, and saved/error/uncertain feedback. External feedback/counts are readable; internal notes and another session's edit authority remain unavailable. Preserve the test comment/audit. |
| **AT-072: video and English transcript** | Open the actual saved original introduction. Native video controls work with the reader/keyboard. Expand **Read English transcript** (or the internal English-transcript disclosure); expanded state and the labeled English transcript region are reachable/readable and tied to that saved video/version. Missing/not captured/unavailable messages remain explicit. Do not request new language labels or treat this navigation check as transcription-accuracy validation. |
| Sharing, dialogs and visual checks | Verify existing authorized Share/feedback/download controls, disabled-download/unavailable states and dialog focus. Use the existing bounded link lifecycle case; preserve saved content and old-version feedback. Spot-check desktop zoom/reflow, long labels, visible focus, contrast and reduced-motion behavior. Record real failures without relabeling prior desktop automation as fresh production or screen-reader acceptance. |

For each row retain: result, observed UTC time, route/record UUID, exact control,
actual announcement/focus result and any blocker. If a reader cannot complete a
required AT-072 action, record the defect and leave that acceptance pending.
Do not create new identities, change permissions, reconnect Claude, rotate secrets,
or add a second guest-write/processing cycle merely to make this checklist pass.

Report manual AT-072 separately from production UI smoke, deterministic tests,
provider/worker jobs, guest HTTP acceptance and the existing mobile waiver.
Root incorporates the actual results into the established acceptance matrix;
this task adds no new approval gate or release claim.
