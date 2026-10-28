# M02 — Specs intake, editable roles and durable processing

**Dependencies:** M01 authenticated persistent workspace/upload primitives; M00 service mappings. **Next:** M03. **Runnable slice:** supplied PDF/Word/text becomes editable requirements and individual slots through a real background pipeline.

## Required context

Read baseline/progress/handoff; PRD; architecture; data schema/transactions/security; API_CONTRACT and OPERATION_INDEX; AI_SPECIFICATION; `contracts/json-schema/specs-extraction.schema.json` and job-event schema; `workflows/README.md` and specs workflow; SITEMAP_AND_PAGES; TEST_STRATEGY; CONFIGURATION. Use the exact current workflow filenames from workflows/README.md. Read synthetic source-specs fixture and its expected role/slot structure.

## Domain context

BR-004–BR-006, BR-008, BR-016, BR-022, BR-032–BR-036. Inputs are PDF, Word or pasted text. Requirements include role/name, count, classification, scenes, age range, gender, appearance/performance, languages/accents/skills, shoot dates/location/availability and other instructions. English is default display, with Arabic/English/mixed source support. Preserve original text/source references. Unknown or unclear values stay null with Needs clarification; do not guess them from other projects.

One role can reference several scenes. Headcount creates individual slots. If count is missing, use a clearly provisional slot while the source count remains unknown. If no role is known, the user can continue with a pending-requirements state; do not invent a Father/Mother cast brief. Specs do not have a revision/diff manager. Ordinary correction is supported. Existing project authorization remains mandatory.

## Infrastructure to build here

This is the first real asynchronous feature, so implement durable jobs, stages/attempt leases, outbox, authenticated dispatch/callback, retries, correlation and persistent status now. Do not postpone them to video processing. n8n execution state alone is not sufficient. The web handler accepts work and returns a job ID quickly; it does not wait for the whole extraction before responding.

The native worker may normalize Word/legacy document formats, extract readable text or rasterize PDF pages as necessary. Use safe parser/conversion tasks, not arbitrary uploaded HTML execution. OpenAI structured extraction follows the published JSON schema; server validation and source checking happen before app facts are committed. Save provider/model/prompt/schema versions and redacted diagnostic references.

## Build sequence

1. Add coordinated local migrations for specs, roles, slots, jobs, job_events, outbox_events, idempotency/audit foundations if not already present. Add transaction boundaries for submission, stage claiming/completion and draft commit. Unique current specs/workspace and slot ordinals must be enforced.
2. Implement a purpose-aware specs upload/text submission API. Upload access requires workspace permission, not necessarily cast-library upload authority. Completion verifies bytes/type. Pasted text is normalized without discarding the original.
3. Implement dispatcher and the specs n8n workflow with credential references only in exported configuration. Each stage claims lease/fence, reads permitted source, transforms, validates and commits through backend operations. Schedule recovery for undelivered outbox events and expired leases.
4. Implement safe PDF/Word/text preparation. For PDFs, use an appropriate text/vision input path for readable vs scanned material; do not assume every PDF has extractable text. For legacy .doc, use isolated conversion if supported by the chosen runtime, otherwise state actionable conversion guidance and keep manual text entry available. Verify the exact supported-format promise in UI matches deployed converter capability.
5. Implement OpenAI specs extraction using strict schema, nulls and explicit uncertain fields. Preserve role/source order and distinguish requirement facts from candidate facts. Uploaded instructions cannot modify system behavior or issue downstream commands.
6. Commit roles/slots as editable draft. Protect producer corrections from late results using source revision/row_version. No dedicated conflict-resolution screen is needed; reject stale automatic commit and let ordinary editing proceed.
7. Build Specs screen: source input modes, processing state, editable role cards/table, clarification markers, count and scene controls, add/remove role, retry/cancel and persistent save status. User may proceed while fields are incomplete.
8. Implement count resizing with explicit affected-slot review. Empty slots can be archived/recreated safely. Assigned slots (introduced M04) must never lose assignments silently; implement the service contract now and test it with fixture assignments if necessary. Moving headcount from three to two is not permission to delete historical version content.
9. Build Processing list/detail with job/status/error and links back to workspace. Navigation/reload preserves state. Successful extraction and failed input are distinct, not fake success with sample roles.

## Data and API responsibilities

Use `submit_specs`, `get_specs`, `update_specs`, `create_role`, `update_role`, `archive_role`, `resize_role_slots`, `update_slot`, jobs read/retry/cancel, and the service stage callbacks from the OpenAPI contract. Callback actor identity is independent of user-provided IDs and cannot mutate another workspace. Job callback result types are schema-specific, not arbitrary patches to app tables.

Store original requirement evidence, normalized English requirements, clarification paths and actor edits. Preserve full source text separately from displayed shorthand. Every consumer reads explicit slot IDs, not a count inferred at render time. Register observable draft-change events without adding a specs-revision product.

## Acceptance and evidence

- Run text, PDF and supported Word inputs through the real configured pipeline in the integration environment. Report unsupported legacy formats honestly. Do not use only a mocked extraction response as evidence.
- Fixture requirements produce correct role names/counts and individual slots; repeated scene references do not multiply people.
- Missing count/age/date and ambiguous requirement remain Needs clarification; editing resolves only the actual clarified field.
- Arabic/mixed source survives storage and display; English normalized output is grounded in source.
- Reload during processing; state continues. Duplicate submission/callback produces one set of roles/slots. Crash dispatcher before sending then recover from outbox.
- Edit a requirement while extraction is pending; old result must not overwrite it.
- Corrupt/unsupported input shows a scoped error and does not block ordinary manual requirements editing or other file work.
- Producer can continue with incomplete requirements; guest/unauthorized project actor cannot read internal source or trigger jobs.
- Role resize preserves explicit affected-assignment rules and historical references.

Run relevant AT cases and schema/job transaction tests. Measure provider calls on labelled sample rather than claiming accuracy. Record prompt/schema/model, actual job IDs, tests, workflow export/ID, migration versions and UI demonstration.

## Handoff

M03 inherits a real durable job framework, purpose-aware upload completion, native document preparation and provider integration. Document callable task names, callback schemas, storage access mechanism, retry/lease settings, service health command and environment setup. Record any real-provider gate not run and why; update progress/handoff.

## Codex execution prompt

> Implement M02 end to end using the real durable workflow foundation. Extract supplied specs into editable grounded roles and individual slots, preserve missing/unclear values and user edits, and demonstrate processing/recovery through actual services where configured. Do not introduce specs revision management or replace missing information with sample roles. Finish with evidence and M03 handoff.
