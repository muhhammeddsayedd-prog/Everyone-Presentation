# Sitemap and page contracts

**Product:** Everyone Presentation Studio · **Module:** Casting · **Baseline:** 27 October 2026

This document defines what users see and do. Product decisions in `CONTRACT_BASELINE.md` are authoritative. The existing HTML prototype is a reference for interaction and visual direction; its simulated AI, browser-only persistence, unrestricted project creation, and editable Selection inclusion must not become production behavior.

## 1. Navigation model

Use one connected casting workspace for each existing central project. The same workspace supplies both **Cast Selection** and **Cast Shortlist**. Switching output changes what the user is preparing, not the underlying cast library or project candidate pool.

The six persistent workspace steps are **Project → Specs → Candidates → Casting → Review → Presentation**. Users can return to any completed or available step directly; this is a workspace, not a wizard that discards state when moving backward. A valid central project is required to create the workspace. Once created, missing facts, open slots, undecided positions, or fewer frames are visible working states and must not disable ordinary navigation.

### Global destinations

| Destination | Purpose | Primary action | Principal empty state |
| --- | --- | --- | --- |
| Projects | Find a central business project and open its Casting workspace | Open project | “No projects match your search.” Show only projects the actor may access. |
| Cast Library | Search reusable candidate profiles and their saved material | Add casting material | “No candidates yet.” Offer upload for authorized users. |
| Presentations | Find generated Selection and Shortlist versions | Open version | “No presentations generated.” Link to accessible projects. |
| Processing | Inspect durable upload, scan, and generation jobs | Retry eligible failed work | “No processing jobs.” This is a quiet state, not an error. |
| Settings | View app configuration and integrations appropriate to the actor | Manage permitted settings | Read-only connection status for non-administrators. |

Other presentation types can appear in a clear “Planned” catalogue inside a project. They must not expose nonfunctional creation actions or imply that Wardrobe, Art Direction, Storyboard, vehicle/animal options, or PPM generation is complete.

### Recommended route inventory

These are page URLs, not a substitute for the API contract. Map path parameters to stable logical IDs through the central integration layer.

| Page ID | Route | Access | Purpose |
| --- | --- | --- | --- |
| PG-01 | `/projects` | Authenticated internal actor | Project search and access-controlled project list. |
| PG-02 | `/projects` selected-project panel | Actor has project access | Project overview and module entry. |
| PG-03 | `/projects/:projectId/casting/:workspaceId/project` | Casting workspace actor | Shared project/client details and logo. |
| PG-04 | `/projects/:projectId/casting/:workspaceId/specs` | Casting workspace actor | Source specs and requirements. |
| PG-05 | `/projects/:projectId/casting/:workspaceId/cast` | Casting workspace actor | Project pool, library selection, new uploads. |
| PG-06 | `/projects/:projectId/casting/:workspaceId/organize` | Casting workspace actor | Roles, individual slots, assignments, positions, shortlist. |
| PG-07 | `/projects/:projectId/casting/:workspaceId/review` | Casting workspace actor | Final content review and generation. |
| PG-08 | `/projects/:projectId/casting/:workspaceId/presentations` | Casting workspace actor | Current output, generated versions, sharing, PDF. |
| PG-09 | `/library/cast` | Approved internal casting user | Shared library search. |
| PG-10 | `/library/cast/:candidateId` | Approved internal casting user | Reusable profile, sources, media, review status. |
| PG-11 | `/presentations` | Authenticated internal actor | Accessible generated presentation index. |
| PG-12 | `/presentations/:seriesId/versions/:versionId` | Presentation access | Immutable generated version. |
| PG-13 | `/processing` | Authenticated internal actor | Authorized jobs and batches. |
| PG-14 | `/processing?job=:jobId` | Job access | Stage, error, retry, result. |
| PG-15 | `/settings` | Authenticated internal actor | Settings with capability-based sections. |
| PG-16 | `/r/:token` | Valid bearer review link | Latest ready version of one scoped presentation. |
| PG-17 | `/r/:token?version=:versionId` | Same link and authorized version | Historical version and its feedback. |
| PG-18 | `/m/:grantToken/versions/:versionId/media/:assetId` | Valid media grant and active parent review link | Stable external PDF video destination, bound to original media/version. |

Use a query parameter such as `output=selection|shortlist` for the working view. Keep it synchronized in the header and navigation links. Exchange a guest token for a short-lived scoped session; keep the route usable as the entry link while removing credentials from subsequent API requests where feasible. A guest token is a credential: do not include it in analytics events, error reports, page referrer URLs to third-party sites, or public indexing.

## 2. Cross-page interaction rules

### Saving and navigation

Show saving status for the current operation: **Saving…**, **Saved**, or **Could not save — Retry**. A changed control must not silently revert after an API failure. Preserve its unsaved value locally and make the failed field identifiable. Leaving a page with a failed or still-pending write prompts the actor to retry, leave with the unsaved changes clearly discarded, or remain. This protects work; it must not be used to demand completion of unrelated fields.

Use server-confirmed state as durable truth. The producer can refresh or open the workspace on another device and retrieve saved work. Processing continues when the tab closes. A reopening view shows current server state, not simulated success based on browser timers.

If another actor changes the same record, show a concise stale-edit message and offer reload/reapply through the supported concurrency contract. Do not invent a dedicated candidate-fact conflict-resolution product. This is ordinary concurrent-write handling, not a scan-observation comparison workflow.

### Output and status vocabulary

| Label | Meaning | Never means |
| --- | --- | --- |
| Not provided | No supplied value for this field | Zero, false, or a guessed value. |
| Needs clarification | A requirement was missing or unclear | The user cannot continue. |
| Unreviewed | Reusable profile information has not been confirmed | Candidate unsuitable or hidden from reuse. |
| Reviewed | Authorized actor confirmed reusable profile information | Cast booked, available, selected, or client-approved. |
| Option / Main / Backup | Producer's position for this assignment | Reviewer preference or automatic shortlist membership. |
| Preferred / Maybe / Not preferred | A guest's opinion on a particular assignment/version | Main / Backup / booking. |
| Pending | No candidate appears for this slot in the chosen output | A processing error. |

### Contextual AI

Offer focused actions where they help: extract requirements, suggest search filters, scan an introduction, translate supplied text into English, or shorten slide wording. The interface must describe whether it proposes a change or has already changed the working data. Candidate selection and Shortlist membership come from explicit source selections or the actor's choices, never an inferred attractiveness, personality, ethnicity, or suitability score.

Optional free-text instructions act on a named object and scope. For example, “Shorten this candidate's experience to fit” applies to the assignment's slide wording. It must not silently delete the full library experience. Claude operating through API/MCP has the same capabilities and permissions as the represented user, including confirming profiles and generating/sharing; do not introduce an agent-only approval button.

## 3. Project entry and Project step

### PG-01: Projects

**Entry:** authenticated internal actor. Fetch accessible existing projects from the central business integration.

**Display:** project/campaign name, client, existing casting activity, latest generated output where available, last updated time. Support text search and a useful recent-first default. Paginate large sets. Avoid fetching all business data simply to render cards.

**Actions:** Open project; resume existing casting workspace; start Casting for an accessible central project. An existing workspace is reopened rather than duplicated if two actors start at once. Choose Selection or Shortlist as the initial output; both remain available afterward.

**States:** loading; no accessible projects; no search results; central-service failure with Retry; project access removed; invalid/deleted project deep link. No “Create standalone project” fallback. Explain the central project requirement and provide the established project-management destination if one is configured.

### PG-02 and PG-03: Project overview and Project step

**Display:** shared project/client name, central project reference, Casting module, output switch, logo, relevant contextual dates/location when present. Dates must not be invented from source upload time.

**Editing:** authorized changes to project/client names write back to central business records. Say **“Saved to the shared project”** or **“Saved to the shared client”** as appropriate. Non-authorized actors see read-only values. A logo selected for the presentation references a persisted asset; the cloud mapping determines whether it also updates a central client-logo record. Do not silently replace a business-wide client logo merely because a different project presentation image was uploaded.

**Logo controls:** upload a supported raster logo; preview against the actual cover background; Replace; Remove; choose **Cover only** or **Every slide**. Cover only is the implementation default. Preserve aspect ratio and transparency. Restrict size/type server-side, show readable errors, and retain the previous valid logo if replacement fails. A missing logo is allowed. Generated versions retain the exact logo asset and placement used at generation.

**Primary action:** Continue to Specs. Direct navigation to the other workspace steps remains available.

## 4. Specs step

### PG-04: Casting requirements

**Inputs:** PDF, Word document, pasted written text. The interface may support multiple source files for the one initial brief; it must not introduce a revision manager or source-diff workflow. Existing requirement fields remain ordinarily editable when extraction needs correction.

**Layout:** source panel and extracted role list. Each source shows filename/type, upload/processing state, and a way to inspect the supplied content when supported. The producer can paste text without manufacturing a file. Source references remain visible in the editing panel, not as technical IDs on the presentation.

**Actions:** Add source; paste text; extract requirements; retry a failed source; add a role manually; edit a role; reorder roles; remove a role through the established consequence preview. Removing a role with assignments must state the affected slots and assignments and must not delete the reusable candidate profiles or historical versions.

**Role fields:** name, headcount, category/classification, scenes/settings, age range, stated gender requirement, appearance/performance requirement, language/accent/skills, shoot dates, shoot location, availability requirement, other instructions. Use free text where the source requires nuance, structured values where safe. Missing headcount stays null in the source/requirement data and is marked Needs clarification. To keep preparation moving, create one visibly provisional slot as an implementation default; it is not a claim that the role requires one person. Correcting headcount converts or expands the provisional slots without losing assignments.

**Role and slot relationship:** one role can reference several scenes. Headcount creates individual slots such as Waiter 1, Waiter 2, Waiter 3. Changing headcount upward appends slots. Reducing headcount with assigned slots requires an explicit choice of which slots to retire; never delete assignments through a silent number-field side effect. Preserve other roles and their assignments.

**Unclear extraction:** show the original excerpt/page reference plus **Needs clarification**, allow editing immediately, and continue. Do not assign demographic or appearance requirements to candidate profiles. Specs describe the role, not facts about the person.

**Primary action:** Continue to Candidates. Extraction can continue in the background; successful role results appear when ready and are distinguishable from manual corrections so a retry does not overwrite the producer's work.

## 5. Candidates step and shared library

### PG-05: Project candidates

Use three tabs: **In this project**, **Cast Library**, and **Uploads**. The project pool can contain candidates who are not yet assigned to a slot. Such candidates do not appear in Selection until assigned. A shared library profile can exist without appearing in any project.

**Library selection flow:** choose the role/slot context → show editable suggested filters from that role's specs → inspect candidate → choose saved material or request fresh material for this project → add to project and optionally assign to the current slot. Show the actual filter chips. Never hide an inference behind an unexplained ranking.

**Search/filter fields:** supplied age/range; stated gender; height/measurements; languages/accents; skills/performance experience; city; recorded previous projects/roles; category/classification. Include a control for missing values so unknown facts do not become an implicit rejection. Mark Unreviewed candidates clearly but keep them reusable.

**Upload flow:** choose multiple local files or drop files. One video is one candidate introduction. Supporting images/documents/PDFs can be attached to an identified candidate or queued for the actor to associate; do not create independent people from every attachment or group files by filename without making that association inspectable. Folder selection may be implemented through supported browser controls, but a normal multi-file input must remain available.

**Per-file rows:** filename, size, upload progress, scan stage, resulting candidate, failure reason when applicable, retry/cancel actions where supported. Show batch counts separately from per-file outcomes. A failed file must not block reviewing completed candidates. A 200-video batch is the initial sizing scenario, not a hard product limit or permission to run 200 AI requests at once.

**Duplicate step:** a possible existing-person match opens a compact comparison with name/ID and existing sources. Choose **Use existing profile** or **Create new profile**. A low-confidence name similarity must not merge people automatically. Associating new material does not erase older material or silently alter the source pinned to already-generated versions.

**After scan:** the reusable candidate appears immediately as Unreviewed. Clearly show which supplied facts were extracted, and enable normal corrections for authorized casting editors/producers. No separate candidate fact-conflict product is needed.

### PG-09 and PG-10: Cast Library and profile

**Read access:** approved internal casting users. **Fact edits and Reviewed:** producers and designated casting editors. Workspace preparation roles must not acquire global edit rights by using a project screen.

**Profile panel/page:** name/ID, review status, supplied facts, actual selected frames, playable introduction, original transcript, source and update information. Keep project-specific availability, notes, and casting positions outside the global reusable profile.

**Media actions:** play original video; inspect transcript; inspect automatically selected frames; choose another timestamp/frame; reorder frames; replace the video's material set; select existing saved media for a project. Preserve historical media with stable IDs. Replacing a current source does not rewrite prior version snapshots.

**Frame shortfall:** state “2 clear frames available” rather than pretending that extraction succeeded with three. The actor may keep the available frames or replace the video. No generated face images, invented full-body view, or repeated frame disguised as a distinct view.

**Profile confirmation:** a distinct **Confirm profile information** action marks Reviewed for the reusable facts and relevant source evidence being confirmed. Ordinary field-save and marking Reviewed should be distinguishable. Confirmation is available in final review as well. If those canonical/shared facts later change in another app or project, the profile returns to the ordinary Unreviewed state until an authorized actor confirms the current information. Do not add a fact-conflict comparison screen. Project availability, casting choices, presentation template changes, and unrelated processing timestamps do not themselves reset reusable-fact review status. Corrections to factual values save to the shared candidate profile; assignment-specific slide wording stays scoped to the assignment. A profile being Reviewed remains independently assignable to any permitted role.

## 6. Casting step

### PG-06: Role and slot board

**Layout:** role list on the left; role details and individual slot sections in the main area; candidate inspection drawer on demand. Small screens use a role selector and stacked slot cards. Provide an accessible list alternative to any drag-and-drop interaction.

**Each slot shows:** role/slot name, requirements summary, assigned candidates, Main/Backup/Option position, explicit Shortlist toggle, frames/status summary, current-project availability, and assignment notes. Open slots show **Pending** and **Add candidate**. Multiple slots of the same role stay individually identifiable.

**Candidate actions:** assign existing pool/library candidate; upload new candidate for the slot; remove assignment; move/copy assignment to another slot; set position; include/exclude Shortlist; reorder; edit assignment notes/slide wording; inspect profile/media. A person can be assigned to several slots; each assignment has its own position, Shortlist inclusion, and notes.

**Selection semantics:** every active assignment appears in Selection. There is no separate Selection checkbox. To remove a candidate from Selection in one slot, remove that assignment. This leaves the candidate in the library and any other assignments intact.

**Shortlist semantics:** membership is explicit. New assignments start as Option. Adding a candidate directly while preparing Shortlist also creates the assignment, so the candidate appears in Selection. Changing a position to Main or Backup does not itself add Shortlist membership. Removing Shortlist inclusion does not remove the assignment.

**Main cardinality:** each slot has zero or one Main and any number of Backups/Options. Setting a new Main must use the backend's atomic replacement behavior and display the previous Main's new state. Offer Undo through a valid inverse operation where possible. Two simultaneous users cannot produce two Main assignments. A blank Main is allowed.

**Ordering:** preserve user-defined role, slot, and assignment order. Main/Backup/Option is a visible label; do not unexpectedly reorder the user's presentation after changing the label. If a “Sort by position” action is added, make it an explicit reorder operation.

**Primary action:** Review presentation. Changes update the working draft automatically. Saved generated versions remain fixed.

## 7. Review step

### PG-07: Final content review

Show the selected output and a reliable slide-count preview. Group issues by meaningful action, not a wall of required-field errors:

| Group | Examples | Expected treatment |
| --- | --- | --- |
| Open casting choices | Empty slot, no Main, Options undecided | Allowed; explain Pending or visible Option behavior. |
| Missing supplied facts | Height, previous projects, availability | Allowed; preview the exact “Not provided” value. |
| Profile confirmation | Unreviewed profiles | Actor may confirm or continue with clear status. Do not hide candidates. |
| Media inspection | Fewer frames, no playable source, unreadable logo | Inspect/replace/confirm available material; never fabricate assets. |
| Slide fit | Experience/notes too long | Edit display wording or ask AI to shorten while preserving facts. |
| Technical failure | PDF rendering failed, upload unfinished | Specific recovery; no false successful generation. |

**Profile edits:** factual corrections update the reusable profile and are included in the new version. **Slide edits:** edit the assignment's display wording without replacing the full library facts. Display both scopes clearly in the editor.

**Audience and version:** choose a saved audience preset and an output before the final preflight. Create or reuse the matching scoped presentation series, then request review for that series so the displayed checks cover the chosen output, audience policy, and template. Make visible what external reviewers will receive. An audience preset does not create private reviewer-to-reviewer comments within the same shared presentation. Internal production notes remain internal and must not be copied into the external snapshot or PDF accidentally.

**Review freshness:** the preflight response carries an `input_fingerprint` for the exact content and selected series policy/template, including shared project/client/profile values that another app can edit. Keep this value internally, not as user-facing jargon. Changing output, audience, or template requires a fresh preflight. If relevant central information changes after review, show **“The presentation information changed. Refresh review to continue.”** Refresh the content/checks before generation; do not silently generate facts the actor did not review. A workspace draft counter alone is insufficient. Authorized Claude follows the same refresh-and-review path without a human-only gate.

**Generate action:** **Generate presentation** submits the selected series and expected preflight fingerprint, captures a coherent matching snapshot, and queues export. It need not force completion of missing supplied data. Renderability failures such as unresolvable text overflow need a clear correction path; do not shrink text below the template's minimum size or clip it silently to force success. Existing ready versions remain available while generation is running or if it fails.

**New files after a version exists:** the user sees a working-draft change summary, such as new candidates, updated selected material, or assignment changes. It is not a specs-revision workflow. The external link advances only after a new version is generated successfully, not immediately when a file is uploaded.

## 8. Presentation step and generated versions

### PG-08 and PG-12: Presentation viewer

**Display:** title, output, audience, version number, generated time, generated by, slide list, current slide, PDF readiness, and whether the workspace has ungenerated changes. The selected generated version is immutable. A separate **Working preview** must be visibly identified as a draft, never as a released version.

**Candidate slide:** exactly one candidate assignment per slide. Repeat the person in every applicable role/slot. Show role/slot, position, the agreed ten data fields, video action, and frame carousel in app view. **PDF preview** shows all selected frames together. A candidate with no value displays “Not provided”; an empty slot displays its Pending slide and requirements.

**Actions:** previous/next; keyboard navigation; go to role/slot; play video; switch app/PDF preview; download the exact version PDF; return to editing; generate new version; view version history; manage review links. Edits from a historical version open the current workspace with context, not the historical snapshot as an editable object.

**Generation states:** queued; preparing snapshot/assets; rendering; ready; failed; canceled if supported. Display a clear Retry on failure, preserving the intended snapshot or explicitly asking to generate the now-current draft instead. Late completion of an older queued generation must not move a live link backward from a newer successfully ready version.

### Share-link drawer

Select a presentation/output/audience scope, create a link, copy the full URL immediately, inspect expiry and download setting, extend expiry, revoke, or explicitly rotate/reissue. The server stores only a token digest; it cannot reconstruct the full URL indefinitely. The creation result and short-lived encrypted idempotency replay allow copying/recovering that original response. Later, use a previously saved URL or rotate/reissue with a clear notice that the old URL and its media grants stop working. Do not promise a permanent Copy button backed only by a hash. Default expiry is 30 days. PDF download is on by default and configurable off per link. State **“Anyone with this link can view until [date/time].”** No sign-in should be implied. Updating generated content does not silently reset expiry.

Do not send the link through email or messaging unless the actor explicitly requests that action and an approved delivery integration exists. Copying the link and returning it through the API/MCP are part of the app's normal capability.

## 9. External reviewer experience

### PG-16 and PG-17: Link landing and review

**Entry:** a valid, unexpired, unrevoked bearer link. View immediately without sign-in or a name gate. Resolve to the latest ready version in the same shared presentation scope. A valid link does not grant access to the internal app, other projects, unrelated library profiles, or unpublished draft material.

**Header:** client/project, output, version number/date, slide count, optional PDF download. Keep Everyone and client branding restrained. Guest review prioritizes mobile usage: swipe or explicit next/previous buttons, readable facts, touch-friendly video play, and a feedback drawer/panel.

**Feedback:** per assignment/version, choose Preferred, Maybe, or Not preferred; add a comment. Before first write, ask for **Name** and optional **Company / agency**. Remember the entry in the browser. The name is self-declared; do not label it a verified account. A session identifier, not the display name, identifies the guest's own feedback for edits.

**Visibility:** all external reviewers of this shared presentation can see each other's external comments and preferences. Internal production notes are never included. Show the candidate's role/slot so a preference for Father is not presented as a preference for Manager when the same person appears twice.

**Version context:** old feedback remains attached to the version viewed. If a new version becomes ready during a session, show **“A new version is available”** with a deliberate open action rather than swapping the current candidate beneath a comment in progress. On fresh entry, open the latest ready version. Historical feedback can be viewed with an explicit version label; it must not be silently reattributed to the latest facts or images.

**PDF:** if download is enabled, prepare/download the viewed version. An external PDF is a link-scoped export of the same frozen slides, with video URLs bound to this link and original version. Show **Preparing PDF…** until the cached or newly rendered export is ready; do not rerun AI. If download is disabled, hide the action and reject prepare/download endpoints. Previously downloaded files remain downloaded, and their video grants keep working while the parent link still permits viewing. Expiry, revocation, or rotation denies playback. Extending parent expiry updates non-revoked grants so the same old PDF can work for the extended period; separately revoked grants stay revoked.

### Expired, revoked, or unavailable link

Use a neutral page: **“This review link is no longer available.”** Do not expose project names, candidate faces, or whether a guessed token once existed. When appropriate, explain that the producer can provide a new link. A link with no ready version should show a waiting state without leaking an unfinished draft.

### PG-18: PDF video destination

An internal PDF uses an authenticated version-media URL. An external PDF uses a separate media-grant URL bound to its original version/asset and parent review link. The guest PDF export may be cached by version + review link + template, while the canonical version content stays immutable. It must open the original video in a fresh browser without internal sign-in while the parent viewing access remains active. The server validates both grant and parent link before issuing private-media access. It must not play a later replacement video merely because the general review link now follows the latest version. Expiry, revocation, or rotation leads to unavailable access; disabling new PDF downloads alone does not revoke already-issued playback grants. No raw review-link token is persisted into logs or job payloads.

## 10. Processing and settings

### PG-13 and PG-14: Processing center

Group by project and batch; show job stage, submitted time, completed files, failures, and result links. Support retrying failed stages/files without recreating successful candidates or generating duplicate versions. Cancel is best-effort and must indicate when already-completed work is retained. The client reads durable job state; refreshing is safe.

Display human language such as “Extracting spoken information” and “Selecting clear frames.” Keep provider IDs, stack traces, storage keys, and n8n details in expandable diagnostics for permitted operators rather than ordinary producer screens. Distinguish pending upload bytes from a server scan already queued.

### PG-15: Settings

Sections may include profile/session, saved audience presets, approved template/version information, integration connection health, authorized team/capability mapping, and processing configuration. Do not expose API secrets in the UI. Reuse business access administration where it already exists; this app should not create a competing employee directory.

Administrative configuration must separate shared business settings from presentation-specific preferences. The user sees which scope will change before saving.

## 11. Major modal and drawer contracts

| Component | Required content | Save/cancel and focus behavior |
| --- | --- | --- |
| Candidate inspector | Facts, media, transcript, review status, source | Preserve draft edits when opening a nested video view; return focus to trigger. |
| Frame picker | Original video, timestamps, selected frames and order | Changes saved to selected media set; Cancel restores pre-edit selection. |
| Duplicate choice | Possible existing profile and new material | Explicit existing/new decision; never destructive automatic merge. |
| Assignment chooser | Target slot, candidate(s), default Option | Show same candidate already assigned; do not duplicate same candidate/slot. |
| Main replacement | Old and new Main | Execute atomic replacement; Undo when safely applicable. |
| Slide wording | Full fact context, display wording, fit preview | Save only assignment wording; optional AI suggestion is inspectable. |
| Profile confirmation | Facts being confirmed and scope | Authorized user or Claude may confirm; Reviewed status persisted. |
| Reviewer identity | Name required, company optional | Only before feedback; Cancel returns to viewing without writing. |
| Share link | Output/audience, expiry, PDF permission, link state | Copy full URL at creation; later use saved URL or explicit rotation. Revocation/extension reflected immediately. |
| Remove/retire object | Affected roles/slots/assignments | Explain effects; preserve reusable profiles and historical versions. |

## 12. Interaction acceptance boundaries

The app should feel forgiving about missing production information while precise about what was actually saved, generated, or shared. A user can complete a meaningful presentation with pending casting choices. A user cannot bypass project access, make nonexistent upload bytes process successfully, or treat a failed PDF job as delivered. The unrestricted HTML playground remains useful for UX testing but is not a specification to remove production integrity controls.

See the acceptance plan in `docs/quality/TEST_STRATEGY.md` and the presentation template contract in `docs/experience/PRESENTATION_TEMPLATE.md`.
