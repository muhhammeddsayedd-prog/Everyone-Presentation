# Production specs job metadata audit

This fixed read-only audit observes only job6e3c in workspace5505/projectbf65.
It reuses pinned existing metadata-only projection/validation and bounded normal
Supabase2.122 CLI reads. Its SQL uses repeatable-read/read-only and rollback;
source text, extraction bodies, transcripts, prompts, lease tokens, credentials
and raw CLI output never enter receipts. No provider processing is triggered.

The source is owner-authorized CONTROLLED SYNTHETIC text. This can prove one
actual production pipeline execution and persisted source-bound role/slot counts,
not business accuracy, English/mixed quality, full end-to-end parity or recovery.
The audit records durable n8n/OpenAI metadata; stage traces have no instance-ID
field, so deployment/startup identity stays separately scoped without job logs.
