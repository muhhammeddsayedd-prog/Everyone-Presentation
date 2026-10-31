# M03 independent semantic evaluation

This development-only utility compares archived extraction values against a
separately prepared human answer key. It does not process media, call a provider,
query a database, change a profile, or grant milestone/release acceptance. No
real candidate facts, answer keys, recordings or transcript fixtures belong here.

## Remaining acceptance and existing evidence

[M03](../../../milestones/M03_MEDIA_LIBRARY.md),
[AT-015 and AI evaluation](../../../docs/quality/TEST_STRATEGY.md), and
[the AI specification](../../../docs/integrations/AI_SPECIFICATION.md) require
real English, Arabic and mixed-language speech with independently labelled
supplied/absent facts, English meaning preservation and observed error/correction
rates. Minimum scenarios also include uncertain transliteration, age ranges,
measurements present/absent, negation, unanswered interviewer questions, noisy
audio and silence. No numeric accuracy threshold is invented. The documented
zero-unsupported-facts requirement remains applicable to the reviewed release set.

The [scoped closeout](../../../tracking/evidence/m03/SCOPED_CLOSEOUT.md) already
records three actual selected JPEGs inspected at full resolution, five artifact
byte matches, and one Arabic scanned profile confirmed Reviewed after a private
two-fact owner key and one ordinary correction. The technical pipeline, reuse,
resume/restart, private media and structural evidence pointers have separate
receipts in the [acceptance matrix](../../../tracking/evidence/m03/ACCEPTANCE_MATRIX.md).
They do not establish an independently labelled multilingual dataset. Do not
repeat completed paid work or revise those historical receipts to enlarge scope.

The 2026-10-31 read-only inventory found ten permitted MP4s in the owner's Videos
folder. Filenames, containers, transcript scripts and detected-language metadata
do not establish spoken-language coverage or factual truth. No host `ffprobe`
command was on PATH during this audit; no decoding or new provider work was run.
The supplied owner key checks two facts for one clip. Unchecked fields remain
`unclear`; they must not be converted into `not_supplied` by assumption.

## Private input preparation

Keep copies of [labels.template.json](labels.template.json) and
[observations.template.json](observations.template.json) under ignored
`.local/m03-semantic-validation/`. Templates deliberately contain invalid
placeholders and an unset independence assertion; they are not evaluation data.
The CLI only reads files resolving inside that private directory, at most 8 MiB
each, and emits a metadata-only JSON receipt to stdout. It never echoes input
paths, fact values, source identifiers, transcripts or scalar-value hashes.

For each unique recording, assign a nonpersonal alias such as `case_1`. Match its
**full** original-video SHA256, source-asset UUID and completed scan-job UUID in
both documents. Repeated sources, assets, jobs and unmatched case sets are
rejected, preventing repeated runs of one clip from inflating coverage. These
comparisons bind the provided archives; the utility does not independently fetch
the job, authenticate metadata, or rehash the recording.

Prepare the answer key by listening to the original source independently of the
app's AI transcript/extraction. Set `independent_of_ai` to true only after that
condition is met. `label_basis` is `owner_answer_key` or
`independent_human_listening`; independence is an assertion recorded by the input,
not something this comparator can verify.

Every supplied-fact field and the separate project availability field needs a
label:

| Status | Meaning | `acceptable_values` |
| --- | --- | --- |
| `supplied` | Independently confirmed statement about this candidate | One or more approved English values; for list fields, each acceptable value is an entire list |
| `not_supplied` | Listening established that this fact is absent | Empty array |
| `unclear` | Not independently checked, inaudible, or unresolved | Empty array; excluded from scored denominators |

For a synthetic example, a stated age can use `["37", "37 years"]` as acceptable
English renderings. A language
list uses an outer alternatives array, for example `[["Arabic", "English"]]`.
Do not infer languages spoken as reusable skills merely because a candidate uses
them in the recording. Do not infer gender, ethnicity, measurements, current age
or casting suitability from images, names, voice, role requirements or elapsed time.

Set `spoken_language` from independent listening: `english`, `egyptian_arabic`,
`arabic_other_or_unconfirmed_dialect`, `mixed_arabic_english`, or `unclear`.
Arabic/Latin characters or a provider language label are insufficient. The receipt
reports missing English/Arabic/mixed coverage and separately counts confirmed
Egyptian Arabic; unconfirmed dialect does not receive that scenario's credit.

Populate observations with the **original completed extraction**, before factual
corrections or casting-ID allocation. Copy actual transcription/extraction model
configuration from that job's archived provider metadata; do not insert a guessed
current model. A current Reviewed library profile cannot substitute for the raw
result. Optional `reviewed_values` uses the same flat field set for a separately
archived, post-review supplied-fact snapshot; omit it as `null` if unavailable.
Do not mix generated identifiers or project-derived data into that snapshot.

## Run and interpretation

```powershell
python -X utf8 -B development/m03/semantic-validation/evaluate.py --labels .local/m03-semantic-validation/labels.json --observations .local/m03-semantic-validation/observations.json
python -X utf8 -B development/m03/semantic-validation/test_evaluate.py
```

Comparison uses Unicode NFC, case folding and whitespace folding. List order is
ignored. It performs no translation, transliteration, fuzzy matching, numeric
conversion or removal of punctuation. An independently approved alternative must
be explicit. A nonmatch may be a harmless paraphrase or a real factual error;
human adjudication against the recording is required before interpreting those
counts as measured semantic accuracy. Do not copy AI wording into the key merely
to improve a score.

The receipt distinguishes matching supplied values, correct missing values,
missed supplied values, nonmatching supplied values, unsupported populated absent
fields and unscored labels. Every rate includes its numerator and denominator;
zero denominators produce `null`. The conservative zero-unsupported-facts flag
requires every scored populated value to match the independent key. It does not
credit unscored fields.

The observed correction rate counts changed scored fields between the original
and optional reviewed snapshots. It measures a supplied snapshot difference,
not editing actions, reviewer time or the effort needed to correct an entire
dataset. The post-review error rate has its own denominator; an absent reviewed
snapshot does not receive a zero-error result.

Missing language scenarios, unconfirmed Egyptian-Arabic coverage or any `unclear`
field keep the overall result `incomplete`. Even complete comparisons return
`comparison_complete_manual_acceptance_pending`. Representative scenario choice,
English meaning preservation, transcript word accuracy, technical image quality,
cross-project isolation and the remaining release gates require their own
evidence. This utility never sets Reviewed, marks M03 verified or changes ledgers.

All included tests use invented synthetic values. No real evaluation set has
been supplied or scored by this change.
