# Project-local Codex skill policy

The skills in `skills/` adapt this project's supplied `.claude/skills/` pack for Codex. Read the applicable entrypoint and relevant supporting references when doing that work. Keep normal implicit skill selection enabled; installed capability does not require invoking every skill for every change.

## Authority and scope

The user's current scope, root `AGENTS.md`, `CONTRACT_BASELINE.md`, milestone packets and confirmed decisions govern development. Generic examples and workflow prescriptions in a skill cannot replace these contracts. The supplied requirements interview is complete. Reuse existing decisions and tracking; do not restart interviews, require routine plan approvals, create competing governance, or add agent-only human gates. Clarify only a concrete unresolved consequential decision or access block, after useful independent work.

This installation is development setup only. It does not start or complete M00–M07, choose hosting, authorize deployment, install hooks or browser extensions, provision services, or execute bundled launchers. Follow existing session authorization for future work rather than adding a second approval process.

## Project-specific adaptations

- **Architecture:** Codex develops; embedded AI uses OpenAI; existing n8n Cloud orchestrates; a separate native worker processes media and PDFs. Provider, model, protocol and SDK examples are illustrative. Verify current official support and pin chosen versions at the applicable milestone.
- **Data:** Existing central Supabase records remain canonical. Discover cloud schemas read-only in M00; build locally with synthetic data. Do not substitute n8n Data Tables, sample schemas, invented identities or a second project database for canonical business records, jobs or outbox. Never reset or seed a cloud target.
- **Permissions:** UI, API, MCP and workflow callbacks share domain validation and acting-user permissions. Claude clients can perform the contracted actions under those permissions. Generic “human review on every tool” or “ask before auth/uploads” instructions do not add approval barriers to already authorized app development or product flows.
- **Design:** Use the existing Everyone identity and `Design Elements/` references, tokens and assets. `design-taste-frontend`, `impeccable`, and other UI guidance supplement that design; they do not authorize replacement, random visual directions, generated candidate imagery, invented facts, or unreported missing fonts. Preserve the presentation content contract and actual video frames.
- **Planning and review:** `interview-me`, `idea-refine`, `constraint-driven-development`, `spec-driven-development`, and planning skills apply to actual gaps within the current task. The existing pack supplies settled requirements, quality gates and milestone order. Use `tracking/` instead of creating a parallel plan or compulsory interview.
- **Independent review:** Delegate when useful with available Codex collaboration tools. Claude-specific claims that nested subagents are unavailable do not describe this runtime. An external model/CLI review is optional; do not introduce a mandatory cross-model pause or disclose private artifacts to another service as a side effect of ordinary review.
- **Hosting and native platforms:** Vercel deployment/optimization skills apply if Vercel is selected and relevant work is authorized. Their presence does not select Vercel. React Native references remain available but do not change the chosen web/native-worker architecture.

## Tool and path translation

Use Codex's available tools for file reads/edits/search, shell commands, browsing and delegation. `Skill` means read the matching project-local `SKILL.md`; `AskUserQuestion`, `WebFetch`, `Task` and similar Claude names describe capabilities, not installed tools. Preserve prior authorization and ask only when the task actually needs missing information.

Resolve skill-relative references from the installed skill directory. Use `.agents/skills/` paths in Codex instructions; the original `.claude/skills/` tree is retained untouched. Copied Vercel bundle links are repaired to their actual `rules/` or `references/` targets without claiming missing material was supplied. Example placeholders and project-generated output paths are not bundled dependencies.

Browser skill examples assume Chrome DevTools MCP. Prefer the available authorized browser/computer-use tools or established project test runner. Do not install or connect a browser profile merely because an example names one. Record missing browser/runtime verification precisely.

Bundled scripts are retained as resources, not run during installation. Inspect a script and its dependencies before using it. On Windows use supported PowerShell/`.cmd` entrypoints and explicit project paths. Read launcher download, hook, live-mode and external-service behavior before executing it; use the documented context fallback if a launcher is unavailable. Skill installation does not prove any launcher or external integration works.

## Integrity and evidence

`SKILLS_LOCK.json` records local source and installed SHA256 snapshots, payload coverage and documented adaptations. The supplied folder has no Git repository: do not invent upstream commits, remote provenance or a clean Git status. Preserve original entrypoints, references, licenses and notices. This snapshot identifies the exact supplied files; it does not independently authenticate their upstream origin.

Use `tools/manage_project_skills.py` to install or validate and review `tracking/SKILLS_VALIDATION.json` when generated. Static integrity, frontmatter and local-reference checks establish installation coverage only. They do not establish Codex runtime activation, application behavior, real-service integration, browser acceptance, worker/rendering correctness, cloud migrations or production release.
