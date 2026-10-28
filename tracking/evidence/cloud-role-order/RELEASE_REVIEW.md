# Role-only ordering release

The ninth immutable migration `20261028184145_m02_role_order.sql` (SHA256
`14f96c7e635fe46cb11393a881bca26068d696c32f5e454df8655299702b1efa`)
passed exact cloud dry-run/apply and independent readback at19:31:14Z on
2026-10-28. All eight prior applied files remain unchanged. Latest receipt:
`2026-10-28T19-31-14-242836Z-dc97d5dc-readback.json`.

Readback verifies32 authenticated public RPCs,60 distinct inspected routine
contracts and19 forced-RLS app/canonical tables. The release adds one public
reorder RPC and one private write-gated Workspace DTO helper. Only the reviewed
manual-owner `roles.sort_order` UPDATE column right and three narrow replay/audit
policies were added. Frozen8 validation is reused after removing only those
explicitly verified additions; unknown source/signature/ACL/RLS drift remains a
failure. No anonymous/service-role execution, new login or direct source authority
was granted.

Before/after business counts, workspace version/branding digest and digest-only
snapshots of all specs/roles/slots/preferences match. One real user/client/project/
workspace/media/upload/Storage object and the four existing grants are preserved.
The existing Spec is pristine; roles, slots and queue remain empty. This DDL
release did not create or reorder real business roles. No cloud fixtures, provider,
workflow, identity, runtime flag or secret were provisioned by it.

## Local proof

The initial local9 application passed on its first attempt. The23-stage dedicated
proof at `../m02/role-order-local/2026-10-28T19-02-20-589Z-b9d09e55.json` records
four exact sampled holder/waiter backend pairs:

- Reorder then role editor: both serialized successfully; distinct edits survive.
- Role create then stale reorder: the obsolete workspace revision is rejected.
- Membership revocation while cached reorder waits: fresh scope denies replay.
- New source committed while real cleanup waits: cleanup refuses to erase it;
  only the exact known synthetic sentinel is restored before strict cleanup.

Legitimate cached replay, source/slot identity and effect/cardinality checks also
passed. Subsequent9-version regressions passed25 M01 stages/three races,29 queue
stages/six pairs/graceful same-volume restart,24 manual-specs stages/four pairs
and11 replay cases, all with strict cleanup. Their exact source/proof/catalog
seals are bound by `tools/release_role_order.py`. Seventeen offline release
regressions inject uncertain responses/drift with all real transport blocked.

The owned local PostgreSQL17.6 uses simulated Auth/Storage catalogs; cloud is17.11.
No local fixture is a hosted Auth/Storage/browser or provider acceptance claim.
The historical rollback candidate and earlier8-version failures/proofs remain
unchanged. Future changes must be additive.

## Runtime boundary

The actual new-RPC Data API anonymous check returns401/42501, with no user JWT or
business payload recorded. Schema lookup resolves; no explicit cache notification
was performed. This is not the real authenticated reorder journey. Controlled
browser reorder tests use synthetic HTTP responses and are labelled separately.

Fresh advisors report33 WARN:32 intentional curated authenticated-definer RPC
findings and one unresolved Auth leaked-password protection configuration item.
No Auth/billing change or zero-warning sign-off is implied. See the earlier
[manual8 review](../cloud-manual-specs/RELEASE_REVIEW.md) for the Auth limitation.

Role-only reordering uses the existing PUT workspace order contract and preserves
source facts, explicit slots, assignments and historical output. Slot/assignment
ordering maps remain an explicit503 until those contracted operations are built.
The complete source/worker/n8n/lease/result pipeline and production remain unfinished.
