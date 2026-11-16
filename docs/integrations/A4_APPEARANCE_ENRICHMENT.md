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
    neither self-reported nor reviewer-confirmed; they count in facets as supplied labels;
  * supplied facts (`stated_gender`, `age_or_range`, `city`, `languages`) → source from `field_sources` (manual /
    transcript) or *archive* for archive-imported people;
  * **stated age is supplied information; playing age is a reviewable casting range** and never written to age facts.
* Never inferred: race, ethnicity, nationality, religion, gender identity (or any synonym/look-alike phrasing). The model
  schema has no such field; free text naming a protected identity term (`contracts/appearance-taxonomy.json`
  `forbidden_terms`, e.g. "Middle Eastern", "Saudi lookalike", "woman") is refused by the provider adapter
  (`AI_APPEARANCE_FORBIDDEN_INFERENCE`) and again by the database apply (`RESULT_INVALID`, check constraints).
  "Look" exists only as the attributed archive label.
* Group/ambiguous media: several people or an unclear subject → `ambiguous=true`, per-person rows, nothing searchable
  until a reviewer confirms a value for one person (that selects `target_person_index`); other people then conflict
  (`TARGET_PERSON_CONFLICT`). Nothing is merged across people.
* Reanalysis refreshes only `suggested` rows; confirmed, rejected and overridden rows are never changed.

## Wiring facets into A1's search (`public.eps_search_candidates`)

A1 owns `eps_search_candidates`, `eps.cast_search_match` and `CastLibraryView.tsx`. A4 provides, granted to `eps_cast_owner`:

| Function | Meaning |
| --- | --- |
| `eps.cast_facet_match(p_candidate_id uuid, p_filters jsonb) returns boolean` | true when the candidate passes every facet filter (OR within a facet, AND across facets, `unknown` value and `include_unknown` honoured). Empty filters → true. Invalid facets raise `VALIDATION_FAILED`. |
| `eps.cast_text_match(p_candidate_id uuid, p_q text) returns boolean` | normalised substring match over English name, Arabic name (tatweel/diacritics removed, alef forms unified, ى→ي), casting id and tags. |
| `eps.candidate_search_projection` (select for `eps_cast_owner` with `cast.read`) | `facet_keys text[]` (`facet:value`, GIN), `facet_names`, `name_norm`, `name_ar_norm`, `casting_id_norm`, `tags`, `active`. |

Exact integration (inside A1's `eps_search_candidates(p_search jsonb)` candidate predicate):

```sql
-- p_search gains an optional "facets" object: {"facets":{"hair_colour":["black"]},"include_unknown":false}
and eps.cast_facet_match(c.id, jsonb_build_object('facets', coalesce(p_search->'facets','{}'::jsonb),
                                                  'include_unknown', coalesce(p_search->'facet_include_unknown','false'::jsonb)))
```

To keep result counts identical to facet counts, call `POST /api/v1/candidate-facets/query` (or `public.eps_candidate_facets`)
with the **same** `facets`, `include_unknown` and `q`; facet `q` uses `eps.cast_text_match`. If A1 keeps its own text
rule for `q`, counts differ only by that rule — prefer `eps.cast_text_match` for the name/tag part.

UI: `apps/web/components/library/LibraryFacetFilters.tsx` is controlled (`value: FacetFilters`, `onChange`). URL state:
`facetFiltersToSearchParams` / `facetFiltersFromSearchParams` (`@eps/domain`) → repeatable `facet=<key>:<value>` and
`include_unknown=true`. A development/test preview is at `/dev/library-filters`. HTTP search param mapping for A1:
`GET /api/v1/candidates?facet=hair_colour:black&facet=city:Dubai&include_unknown=true` → `p_search.facets`.

Facet keys: `talent_type, city, stated_gender, playing_age, skin_tone, hair_length, hair_colour, hair_texture,
facial_hair, glasses, build, languages, look, tags`. Counts are distinct active people (`cast.read`), never tapes or rows.

## Operations (UI / HTTP / MCP parity)

| MCP tool | HTTP | Capability |
| --- | --- | --- |
| `list_candidate_observations` | `GET /api/v1/candidates/{id}/observations` | cast.read |
| `review_candidate_observation` | `POST /api/v1/candidate-observations/{id}/review` (Idempotency-Key) | cast.review |
| `start_enrichment_batch` | `POST /api/v1/enrichment-batches` (Idempotency-Key) | cast.write (+ workspace write) |
| `get_enrichment_batch` | `GET /api/v1/enrichment-batches/{id}` | cast.read (requester or operations.read) |
| `get_candidate_facets` | `POST /api/v1/candidate-facets/query` (read-only) | cast.read |

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
