# Codex development skills

This project contains 53 supplied Claude skills with 550 source files. Their Codex installation lives in `.agents/skills/`; originals remain in `.claude/skills/`. Every supplied `SKILL.md` is a direct-child canonical entrypoint; there are no nested duplicate or fixture entrypoints to exclude. Supporting scripts, references, assets and notices are retained.

Read [the project policy](.agents/SKILL_POLICY.md) before applying the pack. The installation is project-local and leaves global Codex skills/settings unchanged. This setup does not advance app milestones: M00–M07 remain `not_started`.

## Discovery and use

Codex discovers project skills from `.agents/skills/` and selects relevant skills from their names/descriptions; skills can also be requested explicitly. Changes are detected automatically; if a newly installed skill is absent, restart the Codex session. See [official skill documentation](https://learn.chatgpt.com/docs/build-skills). A session can still read the applicable entrypoint directly when runtime discovery has not been confirmed.

Keep normal implicit invocation enabled. Apply the relevant skill to development work and read only the supporting references needed for that task. Do not load or execute every skill at once. When a supplied name also exists globally, use this project's `.agents/skills/<name>/SKILL.md` and its project policy for work here.

## Installation and validation

From the project root in PowerShell:

```powershell
python -m venv .venv-skills
.\.venv-skills\Scripts\python.exe -m pip install -r tools/skills-requirements.lock.txt
.\.venv-skills\Scripts\python.exe -X utf8 tools/manage_project_skills.py
.\.venv-skills\Scripts\python.exe -X utf8 tools/manage_project_skills.py --report
```

The skills are already installed. On an initial setup with no destination or lock,
use `--install`; it deliberately refuses to overwrite an existing installation.
Review changed sources or local adaptations before any future update. The ignored
`.venv-skills/` environment contains validation tools only; app versions remain a
separate M00 decision.

The direct dependencies are in `tools/skills-requirements.txt`; the lock records
the resolved validation environment. The first static run caught angle brackets
in the ViewTransition skill description. Its corrected Codex description passes;
the original source is preserved, and `tracking/SKILLS_VALIDATION.initial.json`
retains that initial failure.

The default invocation checks the installation. `--report` writes `tracking/SKILLS_VALIDATION.json`. Consult the actual report for results; this guide does not substitute for a validation run. `SKILLS_LOCK.json` records source/installed hashes and adaptations. The source folder has no Git repository, so its immutable reference is the supplied-file SHA256 snapshot, not an asserted upstream commit.

Codex entrypoints adapt Claude metadata/tool references and include project-specific precedence. Copied support-document paths are repaired where Vercel bundles used the wrong relative directory. The source tree remains unchanged. Runtime launchers, hooks, external browser tooling and integrations are not executed or activated by this setup. Static installation checks do not prove app or production acceptance.

Observed installation evidence is in `tracking/SKILLS_VALIDATION.json`,
`tracking/SKILLS_CREATOR_VALIDATION.json`, `tracking/SKILLS_REVIEW.json` and
`tracking/SKILLS_PACK_VALIDATION.json`. The independent review also observed all
53 entries in a refreshed Codex subagent skill catalog. This confirms discovery
for that session, separate from executing individual workflows or launchers.

## Inventory and routing

The 53 skills comprise 25 general development skills, 15 n8n skills, nine Vercel/interface skills, two Supabase skills and two design skills.

### General development — 25

| Skill | Use in this app |
|---|---|
| `api-and-interface-design` | Shared domain/API/MCP contracts and module boundaries. |
| `browser-testing-with-devtools` | Browser debugging, visual behavior and runtime evidence with available tools. |
| `ci-cd-and-automation` | Project quality gates and repeatable delivery checks. |
| `code-review-and-quality` | Review consequential diffs and integration correctness. |
| `code-simplification` | Improve clarity while preserving behavior. |
| `constraint-driven-development` | Enforce existing quality requirements; resolve actual missing standards. |
| `context-engineering` | Resume from project rules, tracking and focused context. |
| `debugging-and-error-recovery` | Reproduce failures and fix their root causes. |
| `deprecation-and-migration` | Additive compatibility and coordinated migration changes. |
| `documentation-and-adrs` | Record decisions, interfaces and acceptance evidence. |
| `doubt-driven-development` | Independent scrutiny of consequential uncertain claims. |
| `frontend-ui-engineering` | Accessible responsive interfaces using Everyone design. |
| `git-workflow-and-versioning` | Version control when a repository is initialized or supplied. |
| `idea-refine` | Explore genuinely unresolved product/implementation ideas within scope. |
| `incremental-implementation` | Deliver complete milestone slices in verifiable increments. |
| `interview-me` | Explicit interviews or consequential gaps absent from confirmed requirements. |
| `observability-and-instrumentation` | Correlation, structured telemetry and recoverable-job visibility. |
| `performance-optimization` | Measure and address demonstrated performance problems. |
| `planning-and-task-breakdown` | Convert the current milestone into concrete tracked work. |
| `security-and-hardening` | Scoped authorization, private media, credentials and input handling. |
| `shipping-and-launch` | Applicable release readiness and evidence closeout. |
| `source-driven-development` | Inspect actual implementations and authoritative sources. |
| `spec-driven-development` | Implement existing contracts; specify genuine contract gaps. |
| `test-driven-development` | Meaningful regressions for domain rules and failure cases. |
| `using-agent-skills` | Select relevant development skills without repeating settled discovery. |

### n8n — 15

| Skill | Use in this app |
|---|---|
| `using-n8n-skills-official` | Route to relevant n8n guidance before workflow work. |
| `n8n-agents-official` | n8n agent features only when required by the approved flow. |
| `n8n-ai-nodes-official` | OpenAI-backed extraction and contextual AI orchestration. |
| `n8n-binary-and-data-official` | Storage-backed file references and binary transport. |
| `n8n-code-nodes-official` | Small supported transformations; native processing stays in worker. |
| `n8n-credentials-and-security-official` | Scoped service authentication and secret-safe configuration. |
| `n8n-data-tables-official` | Understand existing ancillary Data Tables; preserve central database ownership. |
| `n8n-debugging-official` | Diagnose workflow failures using actual execution evidence. |
| `n8n-error-handling-official` | Structured failures, independent retries and callback handling. |
| `n8n-expressions-official` | Correct expressions and data mapping. |
| `n8n-extending-mcp-official` | Relevant gaps in n8n tools without replacing the app's own MCP contract. |
| `n8n-loops-official` | Batching and iteration across independent processing items. |
| `n8n-node-configuration-official` | Validate supported nodes and configuration. |
| `n8n-subworkflows-official` | Reusable scoped workflow contracts. |
| `n8n-workflow-lifecycle-official` | Discovery, validation, execution and authorized publication. |

### Vercel and interface guidance — 9

Hosting remains a discovery decision. Deployment-specific skills apply only when Vercel is selected and the requested action is authorized.

| Skill | Use in this app |
|---|---|
| `deploy-to-vercel` | Vercel deployment preparation and execution when applicable. |
| `vercel-cli-with-tokens` | Scoped token-based Vercel operations when applicable. |
| `vercel-composition-patterns` | Maintainable React component composition. |
| `vercel-optimize` | Evidence-based optimization of an actual Vercel deployment. |
| `vercel-react-best-practices` | React/Next.js performance and data-loading patterns. |
| `vercel-react-native-skills` | Retained native reference; does not change this app's chosen stack. |
| `vercel-react-view-transitions` | Supported interface transitions with accessible fallback. |
| `web-design-guidelines` | Interface review alongside the project's design/accessibility rules. |
| `writing-guidelines` | Clear product copy without invented factual claims. |

### Supabase — 2

| Skill | Use in this app |
|---|---|
| `supabase` | Current Supabase guidance for discovered database/auth/storage integration. |
| `supabase-postgres-best-practices` | Schema, SQL, RLS and performance within coordinated migration discipline. |

### Design — 2

| Skill | Use in this app |
|---|---|
| `design-taste-frontend` | Supplement Everyone tokens and layout with interface craft guidance. |
| `impeccable` | Design, critique and polish while preserving the supplied Everyone identity. |
