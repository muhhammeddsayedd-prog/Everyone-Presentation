# Fixed review release

Hosting remains deferred. This release adds series/review snapshots, typed
retirement Undo, durable wording suggestions and native measured fit. Its new
processing configuration starts disabled. Existing worker credentials, eleven
runtime operations, active media configuration and old records stay unchanged.

The release owner executes `tools/release_m04_review.py` only after independent
review, final migration22 local rollback/promotion proof and the exact source
seals are recorded. Missing seals deny access before any cloud CLI operation.

The fixed commands are `inspect`, `dry-run`, `apply` and `readback`. The helper
accepts no project, SQL, credential, force, seed, role export or retry arguments.
`dry-run` must name only migration22. `apply` requires the identical fresh
snapshot and source proof, writes a protected one-shot claim before dispatch,
then verifies exact preservation through a second read-only snapshot.

The compact readback returns business counts/hashes, managed Auth metadata,
schema defaults, source/media configuration, the protected M02 job, the exact
runtime identity and catalog hashes. It returns only the reviewed catalog delta
fields. It does not copy the former per-role effective-ACL crossproduct.
Explicit ACLs, ownership, schema/default ACLs and memberships remain covered.
All preexisting Storage bucket rows are hashed, including the established
candidate-support bucket.

An unknown dispatch result leaves its claim and receipts intact. Run only
`readback` to establish whether migration22 and its reviewed effects committed.
Do not repeat apply, edit old migration history, reset shared data or repoint
the helper. A mismatch needs a separately reviewed additive forward fix.

Raw CLI responses remain in protected ignored local files. Public receipts
contain metadata and hashes, with no credential, transcript or candidate facts.
The helper does not activate processing, restart a worker, publish n8n, grant a
new login or deploy hosting; the release owner coordinates those later steps.
