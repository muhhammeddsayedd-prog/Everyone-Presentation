# Cycle 7 release candidate — intake, presentation pictures, scenes, Floward template 1.4.0

Repository `github.com/muhhammeddsayedd-prog/Everyone-Presentation`, branch `feature/cycle-intake-scenes-floward`
(base `main` @ `081e2dee`). Final tested commit: see the status log in `tracking/handoffs/2026-11-16-cycle7.md`.
Live (production) is unchanged: migration history 50, template 1.3.0 default, worker 912ee4e2. **Nothing in this
document has been applied to production.** "Staging" below means the isolated staging stack described in section 2.

## 1. What changed since the first release candidate (3902d952)

| Change | Why | Evidence |
|---|---|---|
| Next.js 16.4.3 → 16.4.6; `image-size` override 2.0.4 (pptxgenjs) | GHSA-mfr8-8qww-v76h (Next, moderate) is fixed in 16.4.6. The vulnerable `'use cache'` + `unstable_cache` path is not used by the app; upgraded anyway. The image-size DoS advisories (high) are unreachable (pptxgenjs never loads it), but the override removes the vulnerable version. Remaining: 9 moderate dev-only `minimatch` findings via eslint/typescript-eslint (the fix needs packages less than two weeks old; lint-time only) | `npm audit`; unit tests; `next build` |
| Parity checker: 3 failures fixed | OpenAPI `x-capability` for `create_project`, `list_clients`, `list_presentation_types` had been copied from other operations (commit 6a215ce0); the MCP catalogue and the SQL checks were already right. Declarations corrected; no permission changed | `check_m07_parity.py` PASS (112 tools) |
| 4 browser failures fixed | `api-contracts` ×2: a cycle-7 test regression (the spec hard-coded port 3100 after the port became configurable). **They did not fail on base, which corrects the earlier claim.** `foundation` ×2: the Next 16.4.3 dev security dialog overlay (same on base); the dev-only check is disabled for the fixture test server only | full suite (section 3) |
| Upload outcome after reload | the server records `candidate_outcome` (`created` / `tape_added` / `tape_rescanned`) and `membership_outcome` (`added` / `already_member` / `not_requested`); the page shows only those, or "Tape ready" / "In this project" when an older job has no outcome | replica `a1-upload-journey`; e2e A1 |
| m16: picture-repair parameter name | the app sent `p_idempotency_key` and the function took `p_key`, so "Suggested picture fixes" could never apply against a real database (unit tests mocked the call; the earlier integrated "stale repair" check passed vacuously). A static scan of all 122 central RPC calls against the real signatures found no other mismatch | staging journey 3 |
| m19: render owner reads archive photos | the render/export stage owner could see frames but not `candidate_photo` rows, so **no 1.4.0 deck with a photo portrait could render** | staging journey 6 |
| Guest view of photo portraits; live draft preview | guest content rejected `candidate_photo`; the in-app preview fetched photos from the media route | staging journey 7, screens 02b/04b |
| m19: 1.3.0 with a photo-pinned person | was blocking (existing 1.3.0 series could no longer be regenerated); now a warning: the slide shows no picture, exactly as before the release | staging journey 8 |
| m20: helper grants | pure appearance helpers were executable by PUBLIC, which widens the worker runtime login's executable set; **both the previous and the new worker would have refused to start in production after m20** | `z-compat-runtime` (12 checks); rehearsal |
| m21 (new): previous-client response shapes | the previous web/MCP release rejects any response with new keys. Requests without `X-EPS-Contract` (the previous release) now get the previous shapes for settings, role, slot, series, project candidate, Library candidate and job; the new release sends the header | rehearsal 1b (25 probes) |
| Worker render: archive photo keys | the runtime asset validator refused the `eps-candidate-photos` bucket | `tests/worker/presentation-assets.test.ts` |

## 2. Staging targets: what exists and what was used

There is no non-production resource for this product today:
- The only Everyone Supabase project is production (`pyibofyctwnqpvktepse`, no branches).
- Vercel Preview deployments use production Supabase, n8n and worker values, so a preview is not isolated.
- The worker and the hosted web build are **hard-pinned to the production project**: the database host and pooler
  user and the storage origin in `packages/central` and `apps/worker`, and `apps/web/lib/hosting-pilot.ts`.

Pushing the branch deploys nothing: neither Vercel project is linked to Git (`gitProviderOptions.createDeployments:
disabled`), and the repository has no Actions or hooks.

So the hosted checks ran on an **isolated staging stack built on this machine** with the same service software:

| Component | Staging target | Real or substituted |
|---|---|---|
| Database | Docker `eps-c7stg-db`, `supabase/postgres:17.11.0.011`; the canonical `eps`/`public` catalogue (live dump) + the 50 live migrations from the repository + the live Storage bucket/policy baseline and `extensions` ACL (read-only catalogue reads of production) | Real Postgres, real migrations, RLS, SECURITY DEFINER owners |
| Authentication | GoTrue v2.198.0 (`eps-c7stg-auth`); email + password users created through its admin API; real sessions and JWTs | Real |
| File storage | Storage API v1.96.0 (`eps-c7stg-storage`), file backend, private buckets with the live `storage.objects` policies; synthetic test-card JPEGs ("TEST CARD · NOT A PERSON") at the live object-key shapes | Real |
| Data API | PostgREST v14.13 | Real |
| API gateway | `gateway.mjs` (routes `/auth`, `/rest`, `/storage`; translates the publishable key to anon like the hosted gateway) | Substituted (Kong) |
| Web | this commit, Next 16.4.6 dev server, `CENTRAL_ADAPTER_MODE=supabase` (:3000); the previous release 081e2dee (:3161) | Real code; dev server (a production build refuses a non-production `SUPABASE_URL` by design) |
| Worker | this commit's worker code (and 081e2dee's) via `worker.mts`: the real runtime gateway SQL on the narrow `eps_specs_runtime` login (12-operation identity check), real stage executors, Chromium rendering, private Storage over HTTP | Real code. The connection is plain TCP (hosted: TLS pooler). Requests built for the production storage origin are rewritten to the staging gateway, and **every other outbound host is refused** |
| Job routing (n8n) | the work-order webhook answered locally with the WF01/03/05 mapping | Substituted |
| OpenAI | none, except journey 10, where the extraction answer is a fixed v2 payload served to the worker's Responses call | Controlled (stated) |
| Review/guest gateway | the web app's guest API, with a staging-only gateway key registered in `eps.review_gateway_config` | Real |

**Hosted isolated staging: requirement, cost and reason.** Not created, because it needs new paid resources and a
code change, which the approval did not cover:
1. **Database:** a Supabase preview branch of the Everyone project. Micro compute costs $0.01344/hour, about $0.65
   for two days plus egress; branches are outside the spend cap and the compute credits. Alternatively, a separate
   Supabase project (~$10/month).
2. **Code change:** a small reviewed change adding a recognised `EPS_RELEASE_MODE=staging` with an allow-listed
   staging project ref and origin, in the worker (`SPECS_RUNTIME_HOST`/project) and in the hosted web admission
   (`hosting-pilot.ts`). Today both refuse anything but production. That is correct for production, but it makes any
   hosted staging impossible.
3. **Deployments:**
   - a Vercel preview of the web project with deployment-level staging values;
   - a worker preview deployment with staging values and no production secrets;
   - staging copies of the n8n work-order workflows. One n8n instance can't host two workflows on the same webhook
     path, so this needs a second n8n project or instance, or a staging path variant.

## 3. Results

Final clean run on 2026-11-17 (`run-all.sh` rebuilds everything from nothing): **13 journeys, 114 checks, all passed.**
Machine-readable: `tracking/evidence/cycle7/staging-journeys.json`.

| # | Journey (staging stack) | Result |
|---|---|---|
| 0 | Previous release (081e2dee web + worker) at history 50: real sign-in, anonymous and outsider denied, live-shaped presets, people added, layout measured, 1.3.0 version generated and its PDF downloaded, guest link | Passed, 10 checks |
| 1 | Migration rehearsal m15 → m21: preflight, each file applied once with readback, second run refused, runtime login surface stays at 12, previous web smoke after each step, previous worker on the migrated schema, user data unchanged | Passed, 37 checks |
| 1b | Previous release on the migrated schema: 25 read/write probes | Passed, 1 check covering 25 probes |
| 2 | Client default: the existing Client preset found once and reused, presets unchanged, the new path refuses without a default | Passed, 5 checks |
| 3 | Picture repair for pre-release rows, default pin on add, chosen photo + crop, no-media row stays unset | Passed, 6 checks |
| 4 | Explicit 1.4.0 series (default kept at 1.3.0); Review carries frame and photo portraits with focal points | Passed, 2 checks |
| 5 | Layout measurement with private photos; intentionally empty pictures | Passed, 4 checks (re-run alone after correcting one wrong expectation, see handoff) |
| 6 | 1.4.0 generation: PDF + PowerPoint; the saved version serves the exact photo/frame bytes; outsider and anonymous denied | Passed, 9 checks |
| 7 | Guest: link opens on the current 1.4.0 version; photo and frame portrait content; session required; invalid token denied; pre-release link still opens; internal series not shareable; internal comment invisible to the guest; outsider denied | Passed, 12 checks |
| 8 | Default switch to 1.4.0; earlier series keep 1.3.0; the new worker measures and generates 1.3.0 | Passed, 5 checks |
| 9 | Unreadable picture: generation fails visibly (never a placeholder); earlier ready versions kept | Passed, 2 checks |
| 10 | Scene proposals (extraction v2): first import proposes; a repeated import before decisions re-proposes; a rejected link is not proposed again; after confirmations and casting a re-import stops as needs-attention and changes nothing | Passed, 10 checks |
| 11 | Recovery: the previous worker on an in-flight 1.4.0 job (nothing published; roll-forward completes it), template default reverted, series creation (new and previous web), previous web on post-release data, roll-forward restores everything | Passed, 11 checks |

Screens (real browser, real session): project candidates, Review with the live 1.4.0 preview and its photo slide,
the saved version and its photo slide, the guest view and its photo slide.

Local gates on the final commit: see `tracking/handoffs/2026-11-16-cycle7.md` (typecheck, lint, unit, replica SQL
tests, full browser suite, parity).

## 4. Production release procedure (each hosted step needs the owner's approval)

Production-specific differences from staging:
- the worker connects through the pooler with TLS and runs native work in the pinned Vercel Sandbox images;
- job routing goes through the hosted n8n workflows;
- the web runs a production build with production secrets, and the review gateway key is already registered in
  production.

1. **Preflight (read-only).**
   - History = 50, with latest `20261113120000`.
   - `eps.app_settings.template_version='1.3.0'`.
   - The Client preset `client` (external, not archived) exists; reuse it.
   - Record the current worker deployment id.
   - No `presentation_render`, `presentation_export` or `review_fit` job is running.
2. **Prepare, but don't promote.**
   - Web: `vercel deploy --prod --skip-domain` from the final commit (a production build with production values, not
     on the domain).
   - Worker: build and stage the native and daemon images (`worker-hosting-build.mjs stage`, regctl push,
     `manifest`, `emit`), with `EPS_APPEARANCE_ENABLED` unset.
3. **Pause the worker** (`worker_rollout.py pause`) and wait until no job is running (leases drained).
4. **Apply m15 → m21 back to back** through `apply-migration.mjs --step=<name> --production`.
   - One STEPS entry per file; each refuses unless live is exactly at the previous version.
   - Run the readback after each file: the rehearsal's `READBACK` queries plus the history count.
   - Apply the seven files without pausing between them; on the database itself the rehearsal took seconds per file.
   - Between m16 and m21, the previous web's candidate, role, series and settings screens answer an error. Saved
     versions, review, PDFs and guest links keep working. After m21 the previous release works fully (rehearsal 1b).
   - If the Data API schema cache lags, run `notify pgrst, 'reload schema'`.
5. **Release the worker** (`worker_rollout.py env, deploy, ready, pin, resume`). Confirm `specs_worker_started` and
   one layout measurement on an existing 1.3.0 test series.
6. **Verify the staged web build against production** on its deployment URL: sign-in, Library, a project's
   candidates, and Review of a 1.3.0 series.
   - With that deployment, set **Settings → default review audience = Client** (reuse `client`).
   - Then **promote** it to the domain.
   - New-series creation stays usable throughout: the previous web always sends an audience, and the new web finds the
     Client default.
7. **Template 1.4.0.**
   - In an owner test project, switch the default to 1.4.0, then create a series, measure and generate.
   - Check the PDF and PowerPoint (photo and frame portraits), the saved version, a guest link, and that an internal
     series is refused.
   - Keep 1.4.0 as the default.
8. **Scene proposals.**
   - Run `update eps.specs_pipeline_config set prompt_version='spec_extract_v2.0.0', result_schema_version='2.0' where
     id=1` with the owner tool.
   - Import specs into an owner test workspace and confirm the proposals appear in Specs and can be confirmed and
     rejected.
9. **Appearance analysis stays off** (section 5). No backfill.
10. **Post-release checks:**
    - hosted Storage reads of `eps-candidate-photos` by the worker (render), the review stage, guests and the app;
    - regenerate one existing 1.3.0 series;
    - a guest link on an external series;
    - an internal series is refused;
    - the worker identity check is healthy and no job is stuck.

**Recovery (rehearsed in journey 11):**
- *Configuration first.* Set the template default back to 1.3.0 (the Client default stays) and set scene proposals
  back to `spec_extract_v1.0.0` / `1.0`. Presentations can be created immediately afterwards, in the new and the
  previous web.
- *Worker.* Re-pin the previous deployment only after a drain: pause, and wait until no 1.4.0 render or export job is
  running or queued.
  - If the previous worker meets a 1.4.0 job, it publishes nothing. The job stays leased until the lease expires; then
    recovery requeues it and the new worker completes it after roll-forward, with no loss.
  - The m20/m21 grants keep the runtime login's surface identical, so the previous worker starts on the migrated
    schema.
- *Web.* The previous release works on the migrated schema (m21) **except for 1.4.0 presentations**: their versions,
  review, PDF and guest view answer an error until roll-forward (data intact). Prefer a forward fix. Roll the web back
  only as a last resort, and tell reviewers that 1.4.0 links are briefly unavailable.
- *Database.* No restore over newer work. The migrations add objects and gated behaviour, so recovery is configuration
  or a forward fix. Saved versions are immutable throughout.

## 5. Appearance analysis: activation is a separate decision

- **What triggers analysis:** only an explicit batch, started by someone with `cast.read` + `cast.write` in the
  workspace (`start_enrichment_batch`: named candidates or Library filters, a limit of 1–1000, a spend cap in cents,
  an idempotency key). Nothing runs on upload or on its own. While disabled, a start is refused with
  `ENRICHMENT_UNAVAILABLE`.
- **Configuration:** `eps.appearance_config` (enabled flag, model, operator-supplied USD prices per million tokens,
  prompt `appearance-v1`, taxonomy `appearance-taxonomy.v1`, at most 6 images per person), plus the worker's
  `EPS_APPEARANCE_ENABLED=true` with its `OPENAI_EXTRACTION_MODEL`.
- **Human review:**
  - results are suggestions on the profile;
  - only values a person confirms (or overrides) enter search;
  - a re-run never hides a confirmed value;
  - race, ethnicity, nationality, religion and gender identity are never asked for or stored;
  - the regional "Look" label is never a filter.
- **Budget and concurrency:** a per-batch spend cap (the batch stops at the cap with `stopped_spend_cap`), at most 2
  jobs in flight (configurable 1–4), and a bounded number of images per person.
- **Failures:** bounded retry per job (three attempts); a failure keeps existing observations; batches are resumable.
  The Operations page doesn't yet offer retry/cancel buttons for these jobs (the API does).
- **While disabled:** users search with supplied data and confirmed values only, and nothing is analysed.
- **Decision to prepare:** an operating budget (for example a monthly cap and a per-batch default) before enabling.
  The evaluation measured about $0.016 per person with two photos (section 7).

## 6. Search filters in this release

- **Supplied-data filters:** talent type, city (as supplied), gender as supplied, languages and popular tags
  (screened), plus English/Arabic names and casting IDs.
- **Appearance filters** (playing age, skin tone, hair length/colour/texture, facial hair, glasses, build) count only
  attributed archive labels or values a person confirmed. With analysis off, confirmation comes from people editing
  profiles.
- **Removed:** the archive "Look"/regional labels and nationality as filters, because their provenance and meaning are
  unsuitable. Tags containing identity terms are screened out.

## 7. Evaluation (corrected)

Full report: `tracking/evidence/cycle7/appearance-live-eval.md`.
- **Sample:** 20 candidates and 40 photos selected; 19 sent to the provider (38 photos, 19 calls), all 19 completed;
  1 excluded locally (identical photos, no request made).
- **Agreement with archive labels:** hair length 12/12, hair colour 15/19, playing age 18/19, skin tone 12/19 (hair
  texture 1/1, not rated).
- **Abstentions:** 25 low-confidence `unknown` readings, all on attributes without archive labels.
- **Spend:** $0.2984 provider spend. The ledger shows $0.3603 because it also charges a worst-case estimate for the
  excluded person.
- **Review:** the photo review was the agent's own, not an independent human validation.

## 8. Independent review findings (18) and later findings

| # | Finding | Disposition |
|---|---|---|
| 1 (high) | Review-fit stage could not read archive photos | Fixed (m19). The render stage had the same gap, fixed after staging (section 1) |
| 2 | Old add key after removal re-added the person | Fixed: 409 `MEMBERSHIP_REMOVED` |
| 3 | Specs v2 off by default | Release step 8 (verified on staging, journey 10) |
| 4 | m17 replaced `specs_stage_apply` without a preimage pin | Fixed (pinned, CRLF-normalised) |
| 5 | Appearance rerun could hide confirmed values | Fixed |
| 6 | Archive "look"/nationality usable as facets | Fixed: never facets; tags screened |
| 7 | Profile facts editor lacked Save and continue | Fixed |
| 8 | App crop rect vs PDF focal point | Fixed: focal-only everywhere |
| 9 | Processing picture shown as a load failure | Fixed |
| 10 | Rejecting a scene archived confirmed occurrences | Fixed; rejected links are not proposed again (staging journey 10) |
| 11 | 1.3.0 ignored "no picture" silently | Fixed: warning |
| 12 | Guests received unprinted scene data | Fixed |
| 13 | Batch replay skipped the permission check | Fixed |
| 14 | Observation review ignored Idempotency-Key | Fixed |
| 15 | m18/m19 hashing not CRLF-normalised | Fixed |
| 16 | New series blocked until Settings are configured | By design; release step 6 sets the Client default before the new flow is exposed |
| 17 | `candidate_scans_active` ignored job read rights | Fixed |
| 18 | New-tape outcome copy after reload | Fixed: server-recorded outcomes (section 1) |

Later findings: Retry was offered for exhausted uploads (fixed in the first release candidate), plus the staging
findings in section 1.

## 9. Remaining limitations (non-blocking)

- **No hosted staging:** it wasn't possible without new resources and a code change (section 2), so production is the
  first hosted run of this code. Release steps 6–7 verify on production before the new flow becomes the default.
- **Unreadable archive photo:** reported as a retryable `DEPENDENCY_UNAVAILABLE` after three attempts, not as a
  specific "source unavailable" message. Generation still never substitutes a placeholder.
- **Crop placement:** the PDF and the PowerPoint place a photo crop a few percent apart vertically; the focal point
  stays visible in both.
- **Open Backup position:** a Main without a Backup always shows the Backup silhouette (reference behaviour; there's no
  "no backup" flag).
- **Web rollback:** after a rollback, 1.4.0 presentations are unavailable in the previous release until roll-forward.
- **Operations page:** appearance jobs have no retry/cancel buttons there yet.
- **Dev tooling:** 9 moderate advisories (minimatch via eslint) wait for packages older than two weeks.
