# Casting development fixtures

These files are **synthetic test inputs and domain expectations**, not real casting records, cloud database exports, executable SQL seeds, or a claim that video processing has been validated.

## Files

| File | Purpose |
| --- | --- |
| `casting-happy-path.json` | Four fictional profiles, three roles, five individual slots, six active assignments, and exact expected Selection/Shortlist manifests. |
| `casting-edge-cases.json` | Seventeen scenario recipes derived from the base fixture, including unknown count, zero frames, Main/Shortlist independence, version races, retries, and external PDF access. |
| `source-specs.txt` | Equivalent source brief for pasted-text testing and local PDF/Word fixture generation. |
| `transcripts/samir-introduction-en.txt` | Synthetic English source introduction. |
| `transcripts/omar-introduction-mixed.txt` | Synthetic Arabic/English source introduction with deliberately missing height and prior-work values. |
| `transcripts/maya-introduction-ar.txt` | Synthetic Arabic source introduction. |

## How Codex should use them

Build fixture factories after M00 maps the shared database and contract types. Symbolic IDs such as `slot_father_1` are aliases for readable expectations; map them to actual valid IDs in local/test environments. Fixture field names describe the domain and may be adapted into the exact contract property names. Do not change the business meaning, inclusion rules, expected ordering, or missing-value expectations during that adaptation.

Create the synthetic canonical project/client in the test central dataset before creating the workspace. Production must never gain a free-form or unlinked project-creation fallback because a test fixture has a project object.

The source `.txt` files can be transformed into `.docx` and PDF fixtures for extraction parity tests. Such transformation is a test-fixture utility, not evidence that arbitrary real-world PDFs/Word files will extract perfectly.

The frame/media IDs are placeholders for a test factory's generated media assets. No real candidate video or portrait is included. Use obvious synthetic technical clips/images for codec, storage, rotation, error, and PDF layout tests. Use authorized representative introduction recordings with independently prepared expected facts for actual OpenAI/transcription/frame-selection evaluation. Do not count color-bar videos or supplied text transcripts as proof of speech-recognition quality.

## Required fixture assertions

- Selection: **8 pages** = 1 cover + 6 candidate assignment pages + 1 Pending page.
- Shortlist: **6 pages** = 1 cover + 3 explicit candidate assignment pages + 2 Pending pages.
- Samir appears for Father and Manager as separate assignments with independent positions.
- Omar's height and prior work remain absent and render **Not provided**.
- Omar has only two selected frames; do not duplicate either to reach three.
- Maya's current-project availability remains absent; do not borrow the shoot requirement as a candidate fact.
- Lina is in the project pool but unassigned and therefore absent from both output manifests.
- Waiter 2 has an Option but no shortlisted assignment: candidate page in Selection, Pending page in Shortlist.
- The internal-only note string is absent from external snapshots, guest payloads, and PDFs.
- Changing an assignment to Main does not automatically shortlist it or change its manual ordering.

## Privacy and repeatability

Keep fixture files separate from production data. Mark UI seed/demo environments clearly and disable accidental fixture-seeding against production credentials. Do not use the fictional candidate names as deduplication targets against the real shared library. Deterministic alias mapping and an isolated test namespace make reruns safe without deleting unrelated existing records.

Test factories should clean up their own synthetic records/media through the app's supported ownership constraints. They must not run a broad database reset against the central cloud database. A complete local Supabase reset is only a local-development action.

See `docs/quality/TEST_STRATEGY.md` for acceptance IDs and `docs/quality/RELEASE_EVIDENCE.md` for the evidence record. These paths are relative to the pack root.
