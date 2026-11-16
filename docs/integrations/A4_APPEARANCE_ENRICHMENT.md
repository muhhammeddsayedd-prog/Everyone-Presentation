# A4 — Appearance observations, enrichment batches and Library facets (cycle 7)

Status: implemented and tested locally (fixtures, disposable replica `eps-cycle7-a4`). **Not applied to any cloud
database, n8n workflow not deployed, no paid provider call made.** Migration: `supabase/migrations/20261116140000_m20_appearance_observations.sql`.

## What search uses (product rule)

* **Default search and every facet count use confirmed and corrected (overridden) observations only.** Model output is
  stored as *suggestions awaiting review* and is never searchable or counted until a person with `cast.review` confirms
  or corrects it. The review panel shows the counts "N awaiting review / N searchable", an *Awaiting review* view, and
  labels each row *Suggestion awaiting review*, *Confirmed*, *Corrected by reviewer* or *Rejected*.
* Supplied information keeps its real source and is never presented as confirmed:
  * archive labels (m09 `eps.candidate_attributes`) → *Imported from the cast archive (source project, record id)*;
    neither self-reported nor reviewer-confirmed; they count in facets as supplied labels, except look, nationality and
    country (never facets) and screened tags (below);
  * supplied facts (`stated_gender`, `age_or_range`, `city`, `languages`) → source from `field_sources` (manual /
    transcript) or *archive* for archive-imported people;
  * **stated age is supplied information; playing age is a reviewable casting range** and never written to age facts.
* Never inferred: race, ethnicity, nationality, religion, gender identity (or any synonym/look-alike phrasing). The model
  schema has no such field; free text naming a protected identity term (`contracts/appearance-taxonomy.json`
  `forbidden_terms`, e.g. "Middle Eastern", "Saudi lookalike", "woman") is refused by the provider adapter
  (`AI_APPEARANCE_FORBIDDEN_INFERENCE`) and again by the database apply (`RESULT_INVALID`, check constraints).
  "Look" exists only as the attributed archive label: it is shown on the profile and is **not** a facet or filter
  (`look`/`regional_look`/`nationality`/`country` are taxonomy `forbidden_attributes`).
* Archive tags are screened by `eps.appearance_tag_facet_ok` (TypeScript mirror `isTagFacetAllowed`): a tag naming a
  forbidden term ("European Look", "Middle Eastern Look", "Khaleeji", "Emirati", …), a look label (look, looks, lookalike,
  مظهر) or equal to the person's supplied nationality/country never becomes a facet key or `q` search key. It still
  displays as an attributed archive label. Free-text archive skin tone counts only when it maps onto the closed vocabulary.
* Group/ambiguous media: several people or an unclear subject → `ambiguous=true`, per-person rows, nothing searchable
  until a reviewer confirms a value for one person (that selects `target_person_index`); other people then conflict
  (`TARGET_PERSON_CONFLICT`). Nothing is merged across people.
* Reanalysis refreshes only `suggested` rows; confirmed, rejected and overridden rows are never changed. A reviewer-set
  target person is kept. If a rerun reports a different people count (e.g. now two people, so the media becomes
  ambiguous) and no target was recorded, the person whose rows were already confirmed/overridden becomes the target, so
  those decisions stay searchable; the new people's rows stay suggestions. Only a reviewer changes the target (reset or
  reject that person's last confirmed row, then confirm another person).

## Facets in A1's search (wired)

m20 patches A1's `public.eps_search_candidates` (m16; preceding source hash pinned) through one seam: the two row
predicates are replaced by `eps.cast_library_row_ok(candidate, p_search)`, and `facets` / `facet_include_unknown` join
the accepted keys. Newest-first cursor v2 (its fingerprint covers every key except cursor/limit, so facets are bound to
the cursor), membership batching and the card DTO are unchanged. `eps.cast_library_row_ok` is the single predicate used
by both search results and `public.eps_candidate_facets` (A1's supplied-fact filters via `eps.cast_search_match`; its `q`
or the normalised EN/AR name/casting-id/tag match `eps.cast_text_match`; Reviewed status; `eps.cast_facet_match`), so for
the same filters the result count equals the facet total (replica test: 12 filter combinations).

* HTTP/MCP: `GET /api/v1/candidates?facets={"hair_colour":["black"]}&facet_include_unknown=true` (`facets` is a JSON
  object string, ≤4000 chars); MCP `search_candidates` accepts the same two arguments.
* Facet counts: `POST /api/v1/candidate-facets/query` with `{facets, include_unknown, search: {...the same A1 filters, q}}`.
* UI: `CastLibraryView` (A1) receives `renderFacets={facets => <CastLibraryFacets {...facets} />}` on `/library/cast` and in
  the project Library tab. The bridge keeps facet state in A1's pass-through params (`facets`, `facet_include_unknown`)
  and forwards the view's own filters and query (A1's `renderFacets` argument gained `search`) so counts match results.
* Helpers for other callers (granted to `eps_cast_owner`): `eps.cast_facet_match(uuid, jsonb)`, `eps.cast_text_match(uuid, text)`,
  `eps.cast_library_row_ok(eps.candidates, jsonb)`, and `eps.candidate_search_projection` (GIN `facet_keys`).
* `LibraryFacetFilters` URL helpers for standalone use: `facetFiltersToSearchParams` / `facetFiltersFromSearchParams`
  (repeatable `facet=<key>:<value>`); development preview at `/dev/library-filters` (local fixture).

Facet keys: `talent_type, city, stated_gender, playing_age, skin_tone, hair_length, hair_colour, hair_texture,
facial_hair, glasses, build, languages, tags`. Counts are distinct active people (`cast.read`), never tapes or rows.

## Operations (UI / HTTP / MCP parity)

| MCP tool | HTTP | Capability |
| --- | --- | --- |
| `list_candidate_observations` | `GET /api/v1/candidates/{id}/observations` | cast.read |
| `review_candidate_observation` | `POST /api/v1/candidate-observations/{id}/review` (Idempotency-Key) | cast.review |
| `start_enrichment_batch` | `POST /api/v1/enrichment-batches` (Idempotency-Key) | cast.write (+ workspace write) |
| `get_enrichment_batch` | `GET /api/v1/enrichment-batches/{id}` | cast.read (requester or operations.read) |
| `get_candidate_facets` | `POST /api/v1/candidate-facets/query` (read-only) | cast.read |

`review_candidate_observation` records its Idempotency-Key (`eps.idempotency_begin` / `eps.finish_mutation`, operation
`appearance.review_observation`): the same key and body replays the first response, a different body is
`IDEMPOTENCY_KEY_REUSED`; capabilities are checked before any replay. A `start_enrichment_batch` replay re-checks current
workspace write authority (`ACCESS_DENIED`) before it advances the batch.

Contracts change only through `tools/update_cycle7_a4_contracts.py` (idempotent), then `tools/generate_runtime_contracts.py`.

## Job pipeline

Kind `candidate_appearance`, single stage `analyze_appearance`, enqueued by batches through `eps.jobs` + `eps.outbox_events`,
routed by n8n WF-02 (`n8n/eps-wf02-candidate-stage.json`, handler `openai.analyze_appearance`; export regenerated, not
deployed) to the worker (`EPS_APPEARANCE_ENABLED=true`). The worker reads only the frozen photo/frame list through
60-second read grants (`eps.appearance_asset_grants`), sends the JPEGs once, and posts `candidate-appearance-result.v1`
through `eps.record_job_event`. The five existing service dispatchers gain one closed branch each (preceding source
hash pinned); the worker login gets no new function. Spend: `eps.appearance_config` holds the model and operator
prices (disabled by default); batches freeze them; cost = tokens × USD/Mtok from returned usage; a batch stops at
its cap (at most `max_in_flight` = 2 items may finish after the cap is reached).

Storage: m20 adds `eps_appearance_read` (anon, grant header) and composes the same branch into the restrictive read
guards `eps_candidate_photos_read_guard` (required) and `eps_candidate_read_guard` (when present). A readback fails the
migration closed if the policy is missing or any present guard was not updated. Replica limitation: the disposable
replica has only a minimal storage stub (`storage.objects` shape, `storage.allow_only_operation` returning false, no
`eps_candidate_read_guard`), so it proves the catalogue composition, not Storage API behaviour; object reads through a
grant need Supabase Storage evidence.

## Evaluation runner (integration owner runs the paid evaluation)

```
node --import tsx tools/cycle7/appearance-eval.mjs --manifest eval.json \
  --input-usd-per-mtok <from model page> --output-usd-per-mtok <from model page> --image-token-multiplier <from vision guide> \
  [--execute --max-usd 3.00 --limit 20 --max-images 6 --detail high --max-output-tokens 16384 --retries 0 --ledger .local/cycle7/eval-ledger.jsonl]
```

Dry run by default. With `--execute` one aggregate `--max-usd` covers all calls, retries and failures: every call's
worst case (prompt estimate + image tokens from JPEG size × multiplier, capped at the documented 30,000 patches, +
`--max-output-tokens`) is checked **before dispatch**. The JSONL ledger records each estimate, usage and cost. Manifest
entries may carry `supplied` archive labels; the report gives per-attribute agreement, disagreement, abstention
(`model_unknown`), unmapped supplied labels and ambiguous-media counts; stated gender and tags are reported as *not
observed by design*.

Official sources checked 2026-11-16 (documentation only; not live acceptance):
* https://developers.openai.com/api/docs/guides/images-vision — Responses `input_image` with Base64 `data:image/jpeg;base64,…`
  and `detail` (`low|high|original|auto`), multiple images per request, ≤512 MB payload, ≤1,500 images, images over 30,000
  patches rejected, image tokens = patches × model multiplier (multipliers listed for several models; **none listed for
  gpt-6.1-sol**, so the runner requires the operator to pass one).
* https://developers.openai.com/api/docs/guides/structured-outputs — `text.format` `json_schema` with `strict: true`;
  all fields required, `additionalProperties: false`, ≤5,000 properties, ≤10 nesting levels, ≤1,000 enum values; refusals
  arrive as `refusal` content; check `status`/`incomplete_details`.
* https://developers.openai.com/api/docs/models/gpt-6.1-sol — the model the existing PDF vision path documents
  (`apps/worker/PDF_VISION.md`): image input and Structured Outputs supported; listed $2 / 1M input, $0.10 cached input,
  $10 / 1M output; 1,050,000 context, 128,000 max output. Confirm the actual `OPENAI_EXTRACTION_MODEL` value and its
  page before running; prices are passed as flags, never hardcoded.
