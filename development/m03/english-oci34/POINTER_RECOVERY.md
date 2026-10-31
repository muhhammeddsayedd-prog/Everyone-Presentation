# Successful transfer pointer recovery

The native copy and both remote index/runtime readbacks passed in the actual
`2026-10-31T17-29-35-418951Z-native-transfer.json` receipt. The frozen producer
then called its strict `accepted` guard on the local pre-enrichment dictionary,
which lacked `kind`, `run`, `source_sha256` and `target`. The saved receipt already
contained those fields because `oci.receipt` adds them. This is a local pointer
publication bug after successful transfer, not another registry failure.

Do not repeat native copy. Keep transfer.py at SHA
`f9694ac52fec08b24ab81c8a25ad4aa4c6ac0986fbfcdfc06d70ab724d23a5e3`
and preserve its claims, process-return proof, export and passed receipt.

Before baking the native manifest into the context, root runs:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-oci34/reconcile.py native tracking/evidence/m03/english-oci34/2026-10-31T17-29-35-418951Z-native-transfer.json
```

The reconciler validates that actual complete receipt against all retained
claim/return/export/current-source bindings, performs two fresh read-only remote
index/runtime checks, and publishes the pointer to the **original actual passed
receipt**. The original frozen `load_success` must then pass. It performs no copy,
export, credential refresh or V2-pointer write. An existing matching recovery
claim is read-only reconcilable; pointers are never overwritten.

For the future daemon transfer, use the narrow compatibility adapter instead of
the original daemon-copy entrypoint:

```powershell
.\.venv-skills\Scripts\python.exe -X utf8 -B development/m03/english-oci34/copy-compatible.py daemon
```

It records a separate wrapper hash/claim, delegates the unchanged copy operation,
and adds only the four known identity fields when the local post-copy dictionary
has none of them. Partial or already present identities still go through the
unchanged strict guard. Actual saved receipts and all copy/source/claim/remote
requirements remain intact. The adapter explicitly refuses native copy.

Three offline regressions pass, including the whole frozen main flow publishing
the actual enriched receipt pointer after one synthetic copy/two synthetic
readbacks. These are regression evidence; actual reconciliation is root-executed
and has its own separate receipt.
