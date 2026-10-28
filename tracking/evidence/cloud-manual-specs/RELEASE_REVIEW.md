# Manual specs persistence release

The fixed eight-version source history passed the exact cloud dry-run, apply and
independent readback at 2026-10-28T18:21:07Z. Migration8 is
`20261028172320_m02_manual_specs_draft.sql`, SHA256
`8ab866a49cb2e01eabf3b83076fe4519a60255263d0a1a170ef3ba9718a2349c`.
All seven prior migration hashes are unchanged. The immutable final receipt is
`2026-10-28T18-21-07-451865Z-b7e8cd80-readback.json`.

Readback verifies31 authenticated public RPCs,58 distinct inspected routine
contracts and19 forced-RLS app/canonical tables. The26 new routines comprise17
private helpers and nine manual specs/role/slot RPCs. Function source, argument
names, signatures, returns, owners, security mode, search path and effective ACLs
are checked. Exact policy-expression hashes, source/working column rights, role
inheritance and the workspace initializer are bound to the actual local catalog.
Same-name relations of any kind are rejected before dispatch; after application
the three specs relations must be ordinary forced-RLS tables.

Existing business/Storage counts and the workspace version/branding digest match
before and after. One pristine empty Spec was backfilled for the existing
workspace; roles and slots remain empty. No source result, job, identity, grant,
service login, provider, workflow or credential was created. One real Auth user,
client, project, workspace, media/upload record and Storage object remain, with
four existing capabilities and the prior setup/runtime records.

## Local proof and recovery

- The initial local7-to8 application/backfill succeeded, then the harness rejected
  an inner PL/pgSQL END as transaction control. Its overall failed receipt is
  retained at `../m02/specs-local/2026-10-28T18-02-35-594Z-b35f9f60.json`.
  Strict cleanup/count restoration passed; this is not a successful full suite.
- A driver-only repair and truthful already-applied8 rerun passed23 stages,
  narrow column-right denials and four actually sampled blocker pairs at
  `../m02/specs-local/2026-10-28T18-07-04-016Z-0fdcf864.json`. It does not claim to
  rerun the initial backfill. Source-sentinel cleanup correctly refused to erase
  data committed while it waited; only the known fixture sentinel was restored.
- Fresh8-version M01 regression passed24 stages/three races; queue regression
  passed28 stages/six pairs and a graceful same-volume PostgreSQL restart with
  fencing; all11 replay-scope cases passed. Exact proof/harness hashes are sealed
  in `tools/release_manual_specs.py`; strict cleanup passed.
- Twelve new offline release tests, plus six existing release tests, pass. All
  real subprocess transport is blocked in those tests. They inject lost replies,
  failed/partial readback, data/version drift, nonempty backfill, changed preflight
  and already-applied history, preserving attempts/status and forbidding blind
  reapplication. These are local operational tests, not extra cloud executions.

The owned local PostgreSQL17.6 uses simulated Auth/Storage catalogs; cloud is17.11.
Manual source submission, provider stages, assignments, native media work and
hosted Storage HTTP are outside this proof. Applied SQL bytes must never be
rewritten to repair a later issue.

## Runtime and security boundaries

The new `eps_get_specs` RPC resolves through the actual Data API and returns
401/42501 to an anonymous publishable-key request. No user JWT or business payload
was recorded. This is an anonymous denial/schema-lookup check, not a signed-in
editor journey. No explicit schema-cache notification was needed or performed.

Fresh advisors report32 WARN:31 intentional curated authenticated-definer RPC
findings and one unresolved `auth_leaked_password_protection` configuration item.
The RPC owners are narrow NOLOGIN/non-BYPASS roles, tables use forced RLS, scope
checks use the acting user, and inherited Storage rights are restricted. Source
evidence/identity fields have no manual update authority. The remaining Auth
configuration must be resolved before production; no Auth or billing setting
changed. See the earlier detailed [Auth assessment](../cloud-processing-foundation/RELEASE_REVIEW.md).

The manual editor checkpoint passes139 module tests, lint/typecheck/build and
seven controlled browser journeys. Those browser tests intercept synthetic API
responses and prove UI behavior only. They cover preserved multilingual/array
wording, provisional count confirmation, explicit slot retirement, uncertain
create retry, stale edits, navigation protection, archive-in-flight controls and
320/768/1024/1440 layouts. Node color-environment warnings remain in the logs.
The full authenticated cloud/Storage journey, source processing and M02/release
acceptance remain unverified. The owner closed review tabs; none were reopened.
