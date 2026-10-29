# Role candidate-filter suggestion slice

Implemented locally on 29 October 2026. The published `suggest_candidate_filters` operation returns editable values from the current authorized role: age range, stated gender requirement, each supplied language/accent/skill, and explicit category. Each value identifies its role field or array index. Identical field/value pairs retain the first source path. Missing values produce no suggestion. `include_unknown` is explicitly true; the existing search service labels unknown supplied candidate fields and still excludes known contradictions.

The pure domain projection, strict public DTO parser and verified-user central service are in `packages/domain/src/candidate-filters.ts` and `packages/central/src/candidate-filters.ts`. The SQL candidate is `development/m03/remaining-filters.sql`. Its initial role-only source was SHA256 `460de287071017f3b6f28aac94467506e0479494d8a68217277ae77a1dc4d74d`; the current forward-correction source is recorded below. It adds one scoped read RPC owned by the existing forced-RLS `eps_specs_owner`, with both `workspaces.read` and `cast.read`, active role/workspace and canonical project scope checks. Existing table grants, data and runtime authority are preserved. Function security follows the [official Supabase database-function guidance](https://supabase.com/docs/guides/database/functions).

Seven focused domain/installed-SDK tests passed after the initial missing-module RED result. They exercise supplied Arabic/English values, exact source paths, current role changes, adjustable and cleared searches, labelled unknowns, same-user binding, current permission denial and rejection of hidden/cross-role/forged responses. Focused ESLint and TypeScript checks passed. Commands:

```
node tools/run-tests.mjs tests/domain/candidate-filters.test.ts packages/central/test/candidate-filters.test.ts
npm.cmd run typecheck
npx.cmd eslint packages/domain/src/candidate-filters.ts packages/central/src/candidate-filters.ts tests/domain/candidate-filters.test.ts packages/central/test/candidate-filters.test.ts tools/test-m03-candidate-filters.mjs --max-warnings 0
```

Initial role-only owned-local17 rollback proof: [30271e14](2026-10-29T12-50-41-080Z-30271e14.json). It executes the candidate and synthetic fixture under the shared test lock against the fixed container/system identity, then compares the full catalogue/business snapshot before and after rollback. It covers exact values/order/indexed provenance, current edited requirements, archived role, both independently missing capabilities, project outsider, guest, private-table access and restored temporary schema ownership grant. The SQL assertion fixture is `tests/db/m03-candidate-filters.sql`; runner: `node tools/test-m03-candidate-filters.mjs`.

Earlier failure [2d25b2ca](2026-10-29T12-46-26-066Z-2d25b2ca.json) stopped before candidate DDL because the generic local transport could not select the managed-Auth fixture role. Rollback was verified. The runner now uses the existing fixed local candidate-kernel admin Unix-socket transport for synthetic Auth fixture setup. No grants or managed-Auth configuration were changed. Intermediate passed receipts remain retained.

## Forward search correction

Integration review reproduced two existing matching defects: supplied `Female` positively matched filter `male`, and supplied age `42` did not match `40–50`. The first two new regression scenarios failed before the correction. The current TypeScript matcher and additive SQL replace substring gender matching with exact case/outer-space normalization. Age matching interprets only complete integer or integer-range wording, bounded to 0–130 inclusive, with hyphen/en dash/em dash and optional spaces around the separator. Parsed intervals match when they overlap. Reversed, fractional, unparseable or out-of-bounds wording retains literal matching; supplied but unparseable text is never reclassified as missing. Raw facts, observation dates and query parameter names are unchanged.

Current SQL SHA256: `2215674d0da0f7c37e766b58902b7e0a8fb08b48de17d1cab80b5354085c8198`. Final local17 proof [81795c48](2026-10-29T12-58-02-540Z-81795c48.json) includes actual user-RPC age overlap, gender contradiction, both unknown settings, bounds/parser controls and full catalogue/business restoration. It changes the existing private matcher body and adds one private immutable bounds helper under the existing `eps_cast_owner`; immutable migrations15 and17 remain unchanged. The new suggestion RPC remains owned by `eps_specs_owner`.

Related domain/candidate/SDK suites pass **18/18**; focused ESLint passes. The initial seven suggestion checks and their earlier receipts above remain historical evidence. Command: `node tools/run-tests.mjs tests/domain/candidate-filters.test.ts tests/domain/candidates.test.ts packages/central/test/candidate-filters.test.ts`.

This proof is local and synthetic. Cloud release, actual browser adjustment and HTTP/MCP parity are separate integration work owned by the root agent. Long role values retain their full wording; the UI must allow shortening them explicitly to the existing search limit before applying a filter. Candidate filter suggestions do not mutate profiles, infer candidate facts or rank/select candidates.
