# M02 working specs domain

`src/specs.ts` is a pure, provider-independent draft and planning module. It does
not store data, authorize an actor, enqueue/complete a job, or call a provider.
The extraction adapter continues to validate the published extraction JSON schema
and check citations against prepared source text before `commitSpecsExtraction`.
Shared extraction data types now live in `src/specs-types.ts`; integrations only
type-reexports them. There is no domain dependency on the integration package.

`createEmptySpecsDraft` takes the actual workspace `draft_revision` explicitly.
The initial extraction commit checks both that revision and the specification row
version. It refuses to replace existing roles. Source text, source language codes,
original extracted values, citations and uncertainties are retained separately
from editable working values. Null names remain empty working names with a
clarification; neutral slot labels are implementation labels, not source facts.
No roles produces an empty pending requirements draft.

Manual operation parsers follow `SpecSubmit`, `SpecPatch`, `RoleCreate`,
`RolePatch`, `ResizeSlots` and `SlotPatch` in the OpenAPI contract. Ordinary edits
keep record IDs, source evidence and order. Clarification updates explicitly set
`resolved` on the exact field/reason/source marker. Omitting a marker, including
passing an empty list, does not erase an unresolved issue. Headcount is changed
only by the resize operation, rather than a general role patch.

Unknown headcount stays null and materializes one provisional slot. Confirming
its count retains that slot ID and resolves only its headcount clarification.
Count zero is invalid. The current public contract cannot change a confirmed
headcount back to unknown: `ResizeSlots.desired_count` is positive and `RolePatch`
has no headcount field. This module adds no uncontracted endpoint for that case.

`planRoleSlotsResize` takes all current role slots, including archived records,
and their assignment state. Reductions require the exact excess slot IDs;
occupied slots are never selected automatically. The result includes assignment
and slot before-images, archived states and expected row versions for a future
transaction/Undo. Generic assignment fields survive unchanged. Survivors keep
their IDs, ordinals, labels and order; growth appends new IDs and never reuses
archived ordinals. Generated presentation snapshots are outside this operation.

Materialization has a configurable `maximum_new_slots` transaction resource
budget (default 1,000). Aggregate new slots are checked before any ID allocation.
Exceeding the budget is explicit failure; no count is truncated or guessed.
Parsing a headcount does not impose that budget as a source fact maximum.

The future persistence operation must authorize current project/workspace access,
lock the parent and affected child records, recheck versions **and assignment
membership**, apply the full plan atomically, advance the shared workspace draft
revision, and emit the draft-change event. Extraction commit must additionally
check the current job attempt/lease, input fingerprint and source identity/version
in that transaction. These SQL, HTTP/MCP and workflow bindings are not implemented
by this isolated module. Tests use synthetic data and the existing extraction
validator; they are not live OpenAI, n8n or database acceptance evidence.
