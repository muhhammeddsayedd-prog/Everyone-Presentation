# Retained full-name mismatch investigation

This is an offline diagnosis of the existing captured sample. It starts from the
same private `source-binding.json` used by the failed English component check,
verifies the raw-text SHA and exact candidate/media/source/job tuple, and pins the
retained Reviewed proof. It does not transcribe the video again, call a provider,
change a candidate, or create a new human answer key.

The original normalization output was held only in RAM and sent with
`store:false`. Its exact spelling is unavailable. The historical
`accepted:false` receipt remains unchanged; this investigation cannot turn it
into a translation pass.

The existing owner key has three name tokens. An investigator's Arabic spelling
mapping of that existing key is kept only in the ignored private directory. The
comparison canonicalizes Arabic hamza/diacritics/tatweel and removes word
separators. One expected token is still absent from the original ASR source.
The existing independent Reviewed proof also records that `facts.name` was the
one corrected field. Therefore the captured ASR name differs from the corrected
Reviewed name before English normalization begins. This cannot be explained
solely by a different English transliteration of the complete correct name.

The confirmed verification defect was requiring a faithful rendering of that
original ASR text to contain the separately corrected full Reviewed name. The
safe remedy is to verify source-faithful English separately from preservation of
Reviewed facts. Do not put the corrected name into the translation prompt,
overwrite the original transcript, rescan the Reviewed record to replace its
facts, or silently treat arbitrary spellings as equal. A new controlled job may
have its own extraction facts; it does not alter this Reviewed record.

`inspect-retained-source.py` publishes only bounded classifications. The private
mapping states `investigator_spelling_mapping_of_existing_owner_key`; it is not a
new independent listening label. Substring presence is intentionally a
conservative test: an absent canonical token establishes a character mismatch,
while presence would not prove a semantically correct name. The helper does not
measure ASR accuracy, decide the exact discarded English wording, or infer that
the normalization model made a new factual error.

Observed evidence:

- `tracking/evidence/m03/english-name-review/2026-10-31T16-31-07-348316Z-5ed61ea9-8c38-4c1a-a3a2-958d6ccd5d72.json`:
  original source/key unchanged; expected source token absent; no provider,
  network, business-data or Reviewed-fact mutation.
- Four synthetic comparison/privacy regressions passed with
  `python -X utf8 -B -m unittest discover -s development/m03/english-name-review -p test_inspect.py`.

The controlled hosted rollout still needs its own actual processing, persisted
English display, immutable companion, guest and presentation evidence. This
offline diagnostic alone grants none of those acceptance results.

## Prepared controlled-job observer

`inspect-controlled-job.py` is prepared for a single exact read after a new
app-created job reports success. It has not run against the cloud at preparation
time. The root must review its bytes before dispatch and provide only this
object under the already protected ignored
`.local/m03-english-component/controlled-job-plan.json`:

```json
{
  "job_id": "the actual new job UUID",
  "candidate_media_id": "the actual new media UUID",
  "source_asset_id": "the actual new source UUID",
  "source_sha256": "the permitted original video SHA256"
}
```

It pins the linked canonical project, existing video hash, exact job/media/source
joins, history34 and the previous Reviewed proof. The SQL uses a read-only
transaction, an8-second statement timeout and rollback. Only validated UUIDs and
digests enter its private SQL snapshot. A permanent job-specific observation
claim prevents automatic replay. CLI stdout/stderr stay in bounded RAM; DEBUG and
unapproved credential/environment overrides do not enter the subprocess.

The observer verifies the new frozen English flag, succeeded job, v2 stage,
stage-to-row raw/English equality, exact original-source hash, job-input hash,
actual per-chunk provider metadata and conservative Latin-letter script check.
It separately verifies the previous Reviewed facts fingerprint, review state,
row version, raw transcript and legacy English cohort remain intact. It stores
the newly captured raw/English pair only beneath a new ignored private run
directory. Neither that pair nor name values enter the public receipt. Unexpected
metadata fields are refused before publication.

The observer deliberately does not require a new translation to equal the
separately corrected historical name. Source-faithfulness assessment remains
separate from these persistence checks. App display, guest playback, new frozen
version and preservation of all existing versions require their own evidence.
The observer grants none of those claims.

Prepared helper verification: eleven synthetic-only comparison, source binding,
privacy, malformed metadata, preservation-failure and SQL-input regressions
passed with:

```powershell
python -X utf8 -B -m unittest discover -s development/m03/english-name-review -p 'test_*.py'
```
