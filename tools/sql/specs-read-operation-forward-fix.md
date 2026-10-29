If the read-operation compatibility change needs reversal, retain migration13
and every release receipt. Prepare a new coordinated migration containing only
three `ALTER POLICY ... USING (...)` statements for `storage.objects`:

- `eps_specs_original_read`
- `eps_specs_capability_read`
- `eps_specs_read_guard`

Use each exact old `using` expression from the immutable active12 contract
`tracking/evidence/cloud-specs-read-operation/2026-10-29T06-54-27-704770Z-4b1a2633-baseline.json`,
under `readback.catalog.policies`, matched by both table and policy name. Its
SHA256 is `40e4e28b2464c5ed2fecc88eecb8b34b486ffee7ad991f0a63bf341cd9a8ac0b`.
Preserve command, target roles, permissive/restrictive mode and `WITH CHECK`.
Review the generated new migration and rehearse it locally before release.

The restore must not delete metadata or bytes, alter identities, memberships,
keys, capabilities, flags, helpers or credentials, or roll back business data.
Use a fresh active-state snapshot with the fixed readback query, compare all
counts/fingerprints and unrelated catalogue entries, and confirm that only
those three expressions plus the new migration history changed. Reversal
restores the previous denial of metadata-info reads; it does not restore file
workflow acceptance. Do not automatically reverse or retry an unknown apply.
