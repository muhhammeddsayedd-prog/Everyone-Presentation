# Start here — Codex development brief

This pack is the complete initial implementation specification for Everyone Presentation Studio. Extract the entire archive into the intended repository/workspace while preserving its folder structure. If an implementation repo already exists, reconcile its instructions and code; do not overwrite unrelated files or migrations. A file named `AGENTS.md` is included for Codex's working rules.

## First session prompt

Copy this into Codex with the extracted folder/repository available:

```text
Build Everyone Presentation Studio from the attached development pack, milestone by milestone.

Read README.md, AGENTS.md, CONTRACT_BASELINE.md, PROGRESS.md,
tracking/progress.json, tracking/DECISIONS.md and tracking/HANDOFF.md.
Inspect the actual repository and begin the first incomplete milestone;
initially this is milestones/M00_DISCOVERY.md.

The product interview is complete. Use the confirmed decisions and documented
defaults. Do not restart the questionnaire or reduce the app to a mocked demo.
Use our existing central Supabase database, OpenAI API and existing n8n Cloud.
Discover the real cloud schema/auth/migration setup read-only first, reuse suitable
objects, develop locally and create coordinated tested migrations. Do not apply
the guarded design-reference.sql as a cloud migration.

Implement each milestone end to end, including data/API/workflow/UI/error states
and its acceptance tests. Shared operations must serve UI, API and MCP. Claude
must ultimately be able to do everything its acting user can do, including
confirming facts, generating presentations and managing review links.

If an external dependency is not available, finish useful local work, mark the
specific unverified gate honestly and continue independent tasks. Ask only for
a consequential choice or genuine access need that cannot be resolved from the
pack and observed environment. Never claim a mock proves a live integration.

Keep PROGRESS.md, tracking/progress.json and tracking/HANDOFF.md updated with
actual changes, commits, migrations, tests/evidence, blockers and exact next steps.
Start now with M00 and report concrete findings, not just a plan.
```

## Resume prompt

```text
Continue Everyone Presentation Studio from the repository's current state.
Read AGENTS.md, CONTRACT_BASELINE.md, PROGRESS.md, tracking/progress.json and
tracking/HANDOFF.md. Verify the recorded evidence against actual files/tests.
Resume the first incomplete milestone and load its listed context. Do not redo
verified work or reopen settled product questions. Update the ledger and handoff
with real outcomes before ending the session.
```

## Single-milestone prompt

```text
Work on Mxx of Everyone Presentation Studio. Read its milestone packet and
the required companion contracts. Run python3 tools/assemble_context.py Mxx
if a refreshed consolidated context file is useful. Confirm prerequisites
from actual implementation evidence. Complete the vertical slice and required
acceptance checks, then update progress and handoff. Do not mark live-service
checks passed if they were not run.
```

Replace `Mxx` with M00–M07. The generated context files in `context-packets/` repeat relevant source context for isolated sessions; regenerate after changes so they include current progress. The source documents remain authoritative.

## What the owner needs to provide when implementation reaches it

Existing repository/location and authorized Supabase access; existing n8n Cloud setup and secure credential access; OpenAI credentials through the development environment; known business hosting/auth setup; actual approved slide/font/logo assets; and authorized representative specs/candidate videos. These are technical integration inputs, not an invitation to repeat the product questionnaire. Codex first discovers what is already available.

## Initial status

The pack is written and checked as documentation. Every implementation milestone is not started. Cloud schema, services and production deployment remain unverified. The included prototype is a UI reference only. Exact SQL migrations, provider workflow exports and runtime code are developed through the milestones after discovery.
