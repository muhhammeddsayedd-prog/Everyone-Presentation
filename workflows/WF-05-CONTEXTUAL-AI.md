# WF-05 — Optional contextual AI and slide wording

**Milestone:** M04, template-fit integration in M05. **Job kind:** `ai_suggestion`. **User entry:** `create_ai_suggestion`. **Business rules:** BR-017, BR-020, BR-022, BR-031.

## Scope

The app remains operable using direct controls. AI assistance appears beside a relevant field/selection: shorten slide text, normalize supplied text into English, or interpret a concise instruction for an existing role/assignment. It is not a replacement for the casting board and is not a requirement to type prompts for normal tasks.

The acting user/Claude may apply supported changes through the ordinary domain operations. No new human-only approval boundary is introduced. The app presents a proposed wording/change so its effect is reviewable and reversible; Claude is permitted to inspect and apply that proposal itself when acting within its user’s authority.

## Input

Capability, workspace ID, target type/ID, target row version, instruction, relevant current field text and template fit budget when applicable. The backend loads the target from authorized scope. Never use a prompt-supplied project/principal as authorization. Limit context to the relevant data; do not send the entire cast library to shorten one note.

## Stages

1. `prepare_suggestion`: load source facts/current wording and required context; fingerprint target version.
2. `generate_suggestion`: call configured OpenAI structured-output adapter with versioned prompt. Wording uses `slide-wording.schema.json`; contextual commands produce only allowlisted target fields/operations.
3. `validate_suggestion`: verify schema, evidence/field names, no added claims, and target binding. Preserve current data; result is a suggestion object.
4. User/Claude reads `get_ai_suggestion` and applies through `update_assignment`, `update_role`, `update_workspace_candidate` or `update_candidate` with the appropriate permission and current row version.

If the target changed while the suggestion was being prepared, mark the suggestion stale. It can be read, but applying it requires reviewing the current field and a new optimistic version. Do not automatically overwrite the newer edit.

## Casting-specific limits

An instruction such as “shorten experience to fit” edits slide wording and keeps the full reusable experience value. An explicit factual correction such as “the supplied height is 178 cm” belongs in the reusable candidate update and requires library editing permission. The model cannot infer the correction from a photo. “Choose the best person” must not invent evidence or silently rank by sensitive appearance; the product’s Shortlist uses explicit producer/source selections.

AI cannot change stable specs into a revision workflow or select people for Shortlist merely because they meet filters. It can map a clear authorized instruction such as “Add these three IDs to Father 1 as Options” into ordinary validated assignment operations.

## Acceptance

Test shortening with negation/qualifiers, English normalization from Arabic supplied text, unknown field refusal, unsupported operation handling, injected instructions inside source text, stale target version, no overwrite of Library facts from wording edits, and a complete manual route when AI is unavailable. Record provider usage and make retries bounded like the other workflows.
