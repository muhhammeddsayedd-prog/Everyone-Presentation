# Owner project39 observation source

This finite, transport-free query is prepared for Root review. It has not run.
Use only the existing bounded normal Supabase reader after that review, with
the exact canonical target and pinned query bytes. It never invokes a business
RPC, sets an acting identity, reads Auth rows or writes business state.

The projection returns only known project/request IDs, counts and booleans. It
checks the actual owner-created storyboard project, absent client, row1, one
intent, one creator writer membership, one MCP create audit and one matching
idempotency receipt. Name, creator, key, request body, request hash and stored
DTO stay inside SQL comparisons. Resource counts include archived workspaces.

The stored canonical body hash and exact receipt are compared internally to
the actual project and intent, using the SQL39 canonical payload/DTO shape.
No raw row, client data, name, principal or credential is returned.

The owner reported create request `5cf2962f-5b7e-46fc-90ef-36980f15dd68`
and same-key replay request `0e6796aa-433b-469f-bed5-4b181f68fa1e` returning
the same project. A replay creates no second audit event. These DB observations
can establish stored atomic creation and no automatic Casting resources; they
cannot independently prove the replay request transport or reconstruct its
private key. Preserve the actual owner result as its separate witness.

Pure validation:

```text
python -X utf8 -B -m unittest discover -s development/m07/owner-project39-observation -p test_inspect.py -v
```

Acceptance requires every expected count to be1, all booleans true, every
resource count0, and canonical database/operator `postgres`. Retain a failed
or incomplete result honestly. There is no automatic retry or mutation path.
