# Cycle 7 release candidate — intake, presentation pictures, scenes, Floward template 1.4.0

Branch `feature/cycle-intake-scenes-floward` (repository `github.com/muhhammeddsayedd-prog/Everyone-Presentation`),
base `main` @ `081e2dee` (live: history 50, template 1.3.0 default, worker 912ee4e2). Final commit: see
`tracking/handoffs/2026-11-16-cycle7.md` (status log). **Nothing in this document has been applied to a hosted
environment.** Every status below is local unless it says "live".

## Coverage

| Requirement | Migration / contract files | Owner | Status | Evidence |
|---|---|---|---|---|
| Newest-first ordering (candidate created_at desc, id tie-break, cursor v2) | m16 `eps_search_candidates`, `eps_list_workspace_candidates`; OpenAPI `search_candidates` | A1 | Implemented, locally verified | replica `a1-newest-first` (14 checks); integrated journey 6; e2e A1 |
| Membership, idempotent/concurrent Add, remove → re-add, old key after removal | m16 `eps.cast_mutate`; `add_workspace_candidate` 200/201 | A1 + review fix F1 | Implemented, locally verified | replica `a1-membership-media`; integrated journey 5 (3 parallel HTTP adds incl. second user) |
| Upload → processing → candidate + membership → automatic visibility; reload; retries | m16 `apply_candidate_scan`, `jobs_dto.candidate_result`, `eps_list_workspace_uploads`, `candidate_upload_row` | A1 + integration fix | Implemented, locally verified | replica `a1-upload-journey`; integrated journeys 1–3 (real app + DB + stage callbacks); real-backend browser screens |
| Extra tape while facts edited | m16 `apply_candidate_scan` (facts row_version dependency removed only) | A1 | Implemented, locally verified | replica; integrated journey 4 |
| Project presentation portraits (frame or photo), pins, repair | m15 columns; m16 `cast_default_media`, `cast_portrait_valid`, `eps_suggest/apply_media_repairs` | A1 / F1 | Implemented, locally verified | replica; integrated journeys 8–9; e2e repair panel |
| Unsaved changes dialog | web `ui/UnsavedChanges.tsx`, scenes adapter | A1 + integration + F3 | Implemented, locally verified (fixture UI) | e2e A1 (drawer/Escape/tab/navigation/failed save), scenes |
| Scenes, occurrences, proposals, Scene breakdown | m15 tables; m17 scene operations + specs v2 | A2 + F1 | Implemented, locally verified; live specs v2 pipeline switch is a release step | replica `a2-*` (82 checks); integrated journey 10; e2e scenes (6) |
| Presentation notes, default audience | m18 | A3 | Implemented, locally verified | replica `a3-template-1-4`; integrated journey 13 |
| Template 1.4.0 (Floward) + capture, gates, mirror, PDF, PPTX, saved/guest | m19; `packages/templates/versions/1.4.0` | A3 + F1 | Implemented, locally verified (synthetic fixtures; reference-equivalent text) | worker 290/290 incl. SQL mirror on 301 snapshots and 35-page render; PPTX rendered via PowerPoint; visual comparison doc |
| Observations, provenance, search projection, facets, batches | m20; `contracts/appearance-taxonomy.json` | A4 + F2 | Implemented, locally verified; live model evaluated on 20 people (local tool, not the hosted batch path) | replica `a4-appearance` (86+ checks); `tracking/evidence/cycle7/appearance-live-eval.md` |
| API/MCP parity | `contracts/openapi.yaml`, `mcp-tool-catalog.json`, `operation-parity.json` (112 tools) | integration | Implemented; checker passes except 3 pre-existing project-operation capability drifts | `tools/check_m07_parity.py` |

## Migration inventory (apply in this order; each refuses a second run)

| File | Purpose |
|---|---|
| `20261116090000_m15_cycle7_shared_schema.sql` | portrait columns on `workspace_candidates`; `eps.scenes`, `eps.scene_occurrences` (+ grants/RLS) |
| `20261116100000_m16_intake_membership_media.sql` | ordering + cursor v2, membership DTO, idempotent add, default pins, repair, upload rows, apply fixes |
| `20261116110000_m17_scene_operations.sql` | scene/occurrence operations, proposals, specs apply scenes |
| `20261116110500_m17_specs_extraction_v2.sql` | specs stage accepts v2 extraction (pipeline config stays v1) |
| `20261116120000_m18_notes_audience.sql` | role/slot/series notes; `app_settings.default_audience_preset_id` |
| `20261116130000_m19_editorial_template_1_4.sql` | template 1.4.0 registration, gates, snapshot capture, SQL mirror, photo inventory, storage read policy |
| `20261116140000_m20_appearance_observations.sql` | appearance owner role, observations, projection (backfilled), facets, batches, `candidate_appearance` job kind |

m09–m12 are already in live history (verified identical); this branch commits them byte-identical.

## Release procedure (requires owner approval for each hosted step)

1. **Preflight (read-only):** live history = 50 and latest `20261113120000`; function preimage hashes pinned by
   m16–m20 match live (each migration also fails closed on drift); `eps.app_settings.template_version='1.3.0'`.
2. **Migrations m15 → m20** through the owner's apply path (`Mostafa Database/migration/04-import/apply-migration.mjs
   --step=<name> --production`, one STEPS entry per file, each refusing unless live is exactly at the previous
   version), each followed by its readback. Old web/worker keep working after every step (additive; new behaviour is
   only reachable through new code or Settings).
3. **Worker release** (renders 1.4.0, reads `eps-candidate-photos`, runs `candidate_appearance`, understands specs v2):
   `tsx tools/worker-hosting-build.mjs stage` → native + daemon images → `worker_rollout.py` (pause, env, deploy, ready,
   pin, resume). Keep `EPS_APPEARANCE_ENABLED` unset (appearance stays disabled; `eps.appearance_config` disabled).
4. **Web release** from the final commit (stage-web, preview, then production with owner authorisation).
5. **Settings (in this order):** create/confirm the external **Client** audience preset → set it as
   `default_audience_preset_id` → set template default to **1.4.0** (`update_settings`). Until both are set, Review
   shows the recovery notice and new ordinary series cannot be created (by design: no implicit first preset).
6. **Optional, separately approved:** switch `eps.specs_pipeline_config` to `spec_extract_v2.0.0` / result schema 2.0
   (enables scene proposals from imports); enable `eps.appearance_config` + `EPS_APPEARANCE_ENABLED=true` with an
   explicit spend cap (the 20-person evaluation does not authorise a Library backfill).
7. **Post-release verification:** hosted storage reads of `eps-candidate-photos` for worker (render), review stage,
   guest and in-app viewers (replica storage is a stub); generate one 1.4.0 version with a photo-only portrait and one
   frame portrait; verify an existing 1.3.0 series still generates; guest link on an external series; internal series
   refused.

**Recovery:** migrations are additive and gated, so recovery is forward-fix or configuration: set Settings back to
template 1.3.0 (new series use 1.3.0 again; 1.4.0 series/versions remain readable), re-pin the previous worker
deployment, roll the web alias back to the previous deployment. Saved versions are immutable in every case. Restore
of business data is not expected; the standard metadata+media restore runbook applies if needed.

## Independent review (fresh-context reviewer, diff 081e2dee..HEAD) — dispositions

| # | Finding | Disposition |
|---|---|---|
| 1 (high) | Review-fit stage could not read archive photos (`eps_review_stage_owner` lacked `candidate_photos`) → 1.4.0 photo portraits never measurable | Fixed (grant + policy); a3 test now runs the real stage path |
| 2 | Old add key after removal re-added the person | Fixed: 409 `MEMBERSHIP_REMOVED`; UI drops stale keys; integrated journey 5 |
| 3 | Specs v2 (scene proposals from imports) off by default | Release step 6 (needs v2-aware worker first) |
| 4 | m17 replaced `specs_stage_apply` without preimage pin | Fixed: pinned (CRLF-normalised); v2 validators pinned too |
| 5 | Appearance rerun could hide confirmed values | Fixed: confirmed target person kept |
| 6 | Archive "look"/nationality labels usable as facets | Fixed: never facets; tags screened (EN/AR terms) |
| 7 | Profile facts editor lacked Save and continue | Fixed (registered save/discard) |
| 8 | App crop rect vs PDF focal point | Fixed: focal-only everywhere, default 0.5/0.4 |
| 9 | Processing picture shown as load failure | Fixed |
| 10 | Rejecting a scene archived confirmed occurrences; rejected occurrences re-proposed | Fixed: only proposed links rejected; `skipped_scene_ids`; rejection keys |
| 11 | 1.3.0 ignored "no picture (intentional)" silently | Fixed: `TEMPLATE_PORTRAIT_EMPTY_IGNORED` warning |
| 12 | Guests received unprinted scene data | Fixed |
| 13 | Batch replay skipped permission check | Fixed |
| 14 | Observation review ignored Idempotency-Key | Fixed |
| 15 | m18/m19 hashing not CRLF-normalised | Fixed |
| 16 | New series blocked until Settings are configured | By design; release step 5 |
| 17 | `candidate_scans_active` ignored job read rights | Fixed |
| 18 | New-tape outcome copy | Fixed; limit: after a reload the client cannot always tell whether the job created the membership |

Found during integration (not by the reviewer): an upload whose retry budget was spent still offered Retry → fixed in SQL and UI.

## Local verification (final commit)

- `npm run typecheck`, `npm run lint`: clean. `npm test`: unit 540, contracts 13, jobs 19, integrations 91, worker 290, central 219 — 1,172/1,172.
- Fresh live-state replica, m15–m20 in order, all `tests/db/cycle7` files: 9 files, 282 checks passed (92 functions added, 56 changed).
- Integrated local stack (real app, PostgREST, replica): journeys 1–6, 8–10, 13, 14 + setup pass (`tracking/evidence/cycle7/integrated-local-evidence.json`). Journeys 7, 11, 12, 15 are covered by browser specs (fixture/mocked API), SQL tests and worker renders respectively.
- Template registries 1.2.0/1.3.0/1.4.0 current; parity checker reconciles all 112 tools (3 pre-existing capability drifts remain).
- Visual: 10 reference pages measured within ~1 px with reference-equivalent text (`docs/templates/1.4.0-visual-comparison.md`); PPTX of the same deck rendered via PowerPoint (35 slides) and inspected.

## Walkthrough (what users see)

1. **Candidates step:** "Upload new candidates" or "Choose from Library". Uploads show live progress, survive reload and end with "Added to this project · Saved in Library". Library cards show portrait, type, English/Arabic names, tape count and a persistent "In this project" state; the Library stays open for several additions ("Done · Back to project").
2. **Project rows** show only the project's chosen picture, with clear badges (no picture / intentionally none / processing / can't be loaded), "Change picture", and "Suggested picture fixes" for older projects.
3. **Casting:** "Standard view | Scene breakdown". Scenes list roles with casting progress; a recurring character shows "Appears in Scenes 1, 3 and 5" and one shared casting. Imported scene proposals are confirmed or rejected in Specs.
4. **Review:** no Audience control; new series use the Client default; cover note; the 1.4.0 preview follows the selected scene. Other review contexts are chosen under Share as separate series.
5. **Presentation 1.4.0:** Floward layout — cover with note, scene dividers, "Cast Shortlist." pages with photos only, Main/Backup labels where applicable, highlighted notes, THANK YOU!; PDF and PowerPoint.
6. **Library search:** names in English or Arabic, casting IDs, facet filters with counts of people (confirmed values only); appearance suggestions are reviewed on the profile before they become searchable.
