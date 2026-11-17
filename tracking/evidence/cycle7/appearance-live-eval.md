# Bounded live appearance evaluation (2026-11-16) — corrected 2026-11-17

Authorisation: owner, at most 20 real candidates under one aggregate $5 ceiling (session 2026-11-16). This evaluation
does not authorise ongoing analysis or a Library backfill. Read-only selection from the live database (archive
candidates with a cover photo and supplied hair/playing-age labels, deterministic md5 order), two existing archive
photos each. Nothing was written to any database; no confirmed facts changed. Photos were deleted after the run;
per-candidate records stay in the git-ignored `.local/cycle7/eval/` (real people) and only aggregates are committed.

Corrected 2026-11-17 against the retained ledger and per-candidate records (`live-ledger.jsonl`, `live-eval.json`):
the first version said "1 low-confidence unknown" (actual: 25 abstentions, below), described the photo review as the
integration owner's (it was the agent's own visual review, not an independent human validation) and did not separate
provider spend from the ledger's conservative total.

## Sample and spend

| Item | Result |
|---|---|
| Model | `gpt-6.1-sol` (worker `OPENAI_EXTRACTION_MODEL`); official docs: image input + Structured Outputs; $2 / $10 per 1M input / output tokens |
| Image token multiplier | not published for this model; 2.5 used only for pre-dispatch worst-case estimates |
| Selected | 20 candidates, 40 archive photos (2 each) |
| Sent to the provider | 19 candidates, 38 photos — 19 Responses calls, 0 retries, 0 provider failures |
| Completed | 19 candidates (all 19 provider calls returned a valid structured result) |
| Excluded | 1 candidate, refused locally before any request: its two archive photos were byte-identical (`APPEARANCE_INPUT_INVALID`); no provider call, no usage |
| Tokens | 50,218 input + 19,800 output (returned usage of the 19 calls) |
| Provider spend | **$0.2984** (sum of returned usage at the published prices) |
| Ledger total | $0.3603 — also charges the excluded candidate at its worst-case estimate ($0.0618), which no request incurred |
| Identity terms | 0 refusals for forbidden wording; race, ethnicity, nationality, religion, gender identity are never asked or stored |
| Multi-person / ambiguous media | 0 in this sample (all single-person photos); person targeting is verified by fixtures and SQL tests only |

## Agreement with stored archive labels

The archive labels are the comparison basis, not ground truth (they may describe other photos or be coarse).
Denominator = analysed candidates that have an archive label for the attribute; the model's `unknown` would count
separately and never as agreement (it did not occur for these attributes).

| Attribute | Agree / compared | Rate | Archive label missing | Model `unknown` |
|---|---|---|---|---|
| hair_length | 12 / 12 | 100 % | 7 | 0 |
| hair_colour | 15 / 19 | 79 % | 0 | 0 |
| playing_age | 18 / 19 | 95 % | 0 | 0 |
| skin_tone | 12 / 19 | 63 % | 0 | 0 |
| hair_texture | 1 / 1 | not rated (n = 1) | 16 | 0 on the compared one |

Abstentions across all 38 analysed photos (attributes without archive labels included): hair_texture 6, facial_hair
1, build 10, visible_tattoos 8 — 25 `unknown` readings, each low confidence, none on the four rated attributes.
Not observed by design: stated gender, tags (including regional "Look" labels), nationality/ethnicity.

## Visual review (agent, not independent validation)

The agent (Claude) looked at 8 of the evaluated photos (6 disagreements, 2 agreements). Hair-colour disagreements were
shade boundaries (light vs dark brown, black vs dark brown, ombré); in 2 cases the model's reading of the photo looked
at least as accurate as the archive label and 2 were genuinely ambiguous. Skin-tone disagreements were all one step
apart (archive Light vs model tan/medium) and lighting-sensitive. This is a plausibility check by the agent; no
independent human rating was done.

## Consequences for the release

- Observations stay review-required suggestions: only values a person confirms enter Library search (as implemented).
- Skin tone stays a low-weight facet that is always reviewed before use.
- Ordinary analysis remains disabled in the proposed release (`EPS_APPEARANCE_ENABLED` unset, `eps.appearance_config`
  disabled) until an operating budget is approved; see the release document for the decision prepared.
- A Library backfill is not authorised. At these token counts the provider cost is about $0.016 per candidate with two
  photos (≈ $16 per 1,000 candidates), plus the human review effort.
