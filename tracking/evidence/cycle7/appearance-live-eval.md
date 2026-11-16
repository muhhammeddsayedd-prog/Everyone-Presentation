# Bounded live appearance evaluation (2026-11-16)

Authorisation: owner, 20 real candidates, one aggregate ceiling of $5 (session 2026-11-16). Read-only selection from the
live database (archive candidates with a cover photo and supplied hair/playing-age labels, deterministic md5 order),
up to two existing archive photos each; nothing was written to any database; no confirmed facts changed.

| Item | Result |
|---|---|
| Model | `gpt-6.1-sol` (worker `OPENAI_EXTRACTION_MODEL`); docs: image input + Structured Outputs supported, $2 / $10 per 1M input/output |
| Image token multiplier | not published for this model; 2.5 used for pre-dispatch worst-case estimates (documented models 1.2–2.46) |
| Candidates / photos | 20 / 40 (19 analysed, 1 refused locally before dispatch: its two archive photos are byte-identical → `APPEARANCE_INPUT_INVALID`) |
| Calls / retries | 19 provider calls, 0 retries, 0 provider failures |
| Usage | 50,218 input + 19,800 output tokens (actual) ≈ $0.30; ledger total $0.3603 (the local refusal is charged at its worst-case estimate) |
| Identity-term refusals | 0 (no forbidden wording produced) |
| Ambiguous / multi-person media | 0 in this sample (all single-person photos) — person targeting is verified by fixtures/SQL only |
| Unknown / abstentions | 1 low-confidence `unknown` (facial hair on one photo); no attribute fell back to unknown otherwise |

Agreement with stored archive labels (comparison labels, not ground truth; they may describe other media):

| Attribute | Compared | Agree | Disagree | Rate |
|---|---|---|---|---|
| hair_length | 12 | 12 | 0 | 100 % |
| hair_colour | 19 | 15 | 4 | 79 % |
| hair_texture | 1 | 1 | 0 | — |
| playing_age | 19 | 18 | 1 | 95 % |
| skin_tone | 19 | 12 | 7 | 63 % |

Not observed by design: stated gender, tags (incl. regional "Look" labels), nationality/ethnicity.

Manual assessment by the integration owner of 8 photos (6 disagreement cases + 2 agreements): the hair-colour
disagreements are shade boundaries (light vs dark brown, black vs dark brown, ombré blonde/brown) where the model's
reading of the evaluated photo was as good as or better than the archive label in 2 cases and genuinely ambiguous in
2. Skin-tone disagreements are all one step apart (archive Light vs model tan/medium) and lighting-sensitive; the
photos support either reading. Glasses and facial hair (absent from archive labels) were correct in every checked
photo.

Recommendation: keep observations as review-required suggestions (as implemented; only confirmed values are
searchable). Treat skin tone as a low-weight, always-reviewed facet. A full-Library backfill is NOT authorised by this
evaluation; if approved later, estimated cost ≈ $0.016 per candidate with two photos (≈ $16 per 1,000 people at
these token counts) plus review effort.
