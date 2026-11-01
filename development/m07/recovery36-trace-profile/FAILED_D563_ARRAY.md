# Catalogue/data restored; array result was discarded

Actual `d5634756-f3e0-48be-b17a-1c3c69213890` failed at the later synthetic
English-companion assertion in frozen `recovery36/runtime.mjs:115`.
Receipt: `tracking/evidence/m07/recovery36-trace-profile/2026-11-01T04-10-16-185Z-d5634756.json`.
The one-table correction and unchanged original profile helper passed, with
17,684 exact portable catalogue fields. Full populated-table hash comparison,
source/restored synthetic Auth boundaries and workspace-summary equality also
passed before this assertion. This is bounded progress, not a full recovery pass.

The inherited `rows` transport accepts only lines starting with `{`. The fixed
English query emits a top-level JSON array, so `ctx.value` returns undefined.
Root separately projected only this synthetic table's row count/status from the
protected dump: one row, status available. No transcript or other row was
published. The assertion failure does not demonstrate lost English data.

Forward correction belongs at the new purpose's exact query/transport boundary:
wrap that known aggregate in a closed object envelope, then return its array to
the unchanged content/immutability checks. Keep the frozen generic parser and
all other queries unchanged. Regression must exercise its actual object-only
parser and value helper, including rejection of the prior unwrapped form.

Automatic cleanup passed: both owned databases/all three owned roles removed;
original29 rows, full Auth/Storage catalogue, profile/settings and existing
global-role identities/attributes/memberships unchanged; shared lock released.
All145 source seals matched before six executed sources were archived under
`source-history/d5634756/source-archive.json` (SHA256
`5c4347e4f15b21ee43b181cffe3a7972d65548ada2a0d113219c57acc923b29d`).
The old claim is permanent. No replay, cloud write or restore acceptance occurred.
