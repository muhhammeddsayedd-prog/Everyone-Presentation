# Source review: append an introduction to the existing Reviewed person

**Recommendation:** add the existing Reviewed canonical candidate to Dummy Pilot
Test through the ordinary Cast Library action, then use that project entry's
**Add a new introduction for this person**. This reuses the already confirmed
identity/facts and avoids creating or resolving another duplicate profile. The
unreviewed5acab entry requires fewer casting edits if it is already assigned,
but does not supply the independently corrected Reviewed facts. Neither plan
justifies declaring the same video to be a different person.

This is source-only reasoning, not a new scan or preservation acceptance. No
SQL, upload, project mutation or provider operation was performed by this review.
Root's existing old-Ready/Reviewed baseline remains the actual before/after gate.

## Exact apply path

The retained canonical33 function archive is SHA-pinned to
`530383505920427743f61798b2260bb71d6f070e2e15afe386a3c83f0cef8384`.
Reconstructing `eps.apply_candidate_scan` with the exact five migration34 patches
matches the reviewed after-body digest
`ffd7c9fb5c05923c1a61a6a2a8170daca99dba308ab5b804d65d69cd205287b2`.
The entire function has zero UPDATE statements for `eps.candidates`,
`eps.candidate_media` or `eps.candidate_media_frames`.

The target-candidate branch selects the active existing candidate **FOR UPDATE**,
checks its row version against the version frozen in the upload/job, and then
performs no candidate value update. The alternative branch alone inserts a new
candidate. A lock does not increment the application's `row_version`, alter
`updated_at`, rewrite facts/provenance or clear the Reviewed fingerprint. If
facts change while processing, the frozen-version guard rejects apply instead
of overwriting those changes.

New source asset uniqueness then either confirms the same job's prior media row
for replay or inserts a **new** candidate-media row and its new frame relations.
Migration34 only adds validated English values to that insert; it does not add a
candidate-facts update. The raw/extracted result remains source evidence on the
new media and does not replace the existing candidate's confirmed facts.

Existing project participation is left unchanged by apply. Only if absent does
apply insert a workspace-candidate row. It advances the workspace draft/revision
and writes an audit event. Old media/frame rows and saved versions are not
rewritten. Source references are the target branch and append/pool logic in
`supabase/migrations/20261029100500_m03_candidate_pipeline.sql`, with the exact
canonical33-to34 patch block in
`supabase/migrations/20261031143711_m03_english_transcript_projection.sql`.

## Library and app path

- `eps_reserve_candidate_upload` reads the active target candidate's row version
  and freezes it in the upload; enqueue copies that target/version into job
  input. These operations do not update the candidate. The existing upload UI
  passes its `candidateId` into the reserve request.
- `add_workspace_candidate` calls the active-candidate guard (a row lock), then
  inserts the project participation and advances only that workspace through
  `eps.cast_changed`. It does not update shared candidate/media/frame rows.
- `update_workspace_candidate` changes only project media/frame choices,
  availability/material confirmation/notes and the workspace draft. Choosing a
  new introduction uses that media's selected frames by default and clears the
  project material-confirmed flag until explicitly confirmed. It does not call
  shared `update_candidate_frames` or change Reviewed facts.
- `WorkspaceCandidatesView.tsx` renders the existing-person upload with
  `candidateId={item.candidate_id}`. Its copy states that project choices stay
  pinned until explicitly changed. `CandidateResumableUploads.tsx` includes that
  candidate ID in the upload reservation.

Adding the Reviewed person creates a different project participation from the
existing5acab entry. The assignment PATCH contract cannot change
`workspace_candidate_id`. If the future presentation should replace that old
entry, use ordinary assignment removal/recreation for the Reviewed participation
with current slot/revision checks, keeping intended Main/Shortlist choices. That
changes the draft casting choice; immutable old Ready versions remain separate.
Do not merge profiles or select **Keep as a separate candidate** merely to run
this English check.

The prepared controlled-job and new-version observers accept an existing target
candidate. They require fresh job/media/source IDs, not a newly created person.
The old Reviewed candidate/full-row and old media/frame hashes must still match
the frozen preservation baseline after actual execution.
