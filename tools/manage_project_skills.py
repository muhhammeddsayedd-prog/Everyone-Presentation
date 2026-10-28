#!/usr/bin/env python3
"""Install/check the supplied Claude skills as project-local Codex skills.

Never downloads or executes skill payloads. Installation refuses an existing
destination; normal invocation checks the pinned local snapshot read-only.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote

import yaml

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".claude/skills"
DEST = ROOT / ".agents/skills"
LOCK = ROOT / "SKILLS_LOCK.json"
REPORT = ROOT / "tracking/SKILLS_VALIDATION.json"
ALLOWED = {"name", "description", "license", "allowed-tools", "metadata"}
ADAPTER = """## Project-local Codex instructions

Apply the [Everyone Presentation Studio skill policy](../../SKILL_POLICY.md)
before the guidance below. Project requirements and existing authorization take
precedence over generic interviews, approval steps, providers, and tool examples.
Use the tools available in this Codex session; Claude-specific tool names are
examples, not installed capabilities. Originals remain in `.claude/skills/`.

"""
DESCRIPTIONS = {
    "interview-me": "Clarify a genuinely new, underspecified request or conduct an explicitly requested requirements interview. Everyone Presentation Studio already has confirmed requirements: read its pack first and do not restart that interview.",
    "doubt-driven-development": "Review a consequential uncertain design or implementation with an independent perspective when that review adds useful confidence, or when explicitly requested. Use available Codex collaboration tools; no mandatory cross-model pause for ordinary authorized work.",
    "using-agent-skills": "Choose and combine this project's engineering skills for a development task. Use when selecting a workflow or routing milestone work; the project's AGENTS.md, confirmed decisions and milestone contracts remain authoritative.",
    "vercel-react-view-transitions": "Implement React ViewTransition and browser View Transition API animations: route changes, shared elements, component enter/exit, list reordering and directional navigation. Use for relevant React or Next.js motion work, after verifying support in the project's pinned runtime and preserving accessible fallbacks.",
}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def inventory(base: Path) -> dict[str, Path]:
    if not base.is_dir():
        raise ValueError(f"Missing directory: {base.relative_to(ROOT)}")
    files = {}
    for path in sorted(base.rglob("*")):
        if path.is_symlink() or not path.resolve().is_relative_to(base.resolve()):
            raise ValueError(f"Refusing linked/escaping skill path: {path}")
        if path.is_file():
            files[path.relative_to(base).as_posix()] = path
    return files


def tree_hash(files: dict[str, Path]) -> str:
    # Hash both the relative paths and exact bytes, independent of mtime/checkout.
    lines = [f"{name}\0{sha(path.read_bytes())}\n" for name, path in files.items()]
    return sha("".join(lines).encode("utf-8"))


def frontmatter(text: str) -> tuple[dict, str]:
    match = re.match(r"\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)", text, re.S)
    if not match:
        raise ValueError("Missing YAML frontmatter")
    data = yaml.safe_load(match[1])
    if not isinstance(data, dict):
        raise ValueError("Frontmatter must be a mapping")
    return data, text[match.end():].lstrip("\r\n")


def adapt(relative: str, raw: bytes) -> tuple[bytes, list[str], dict | None]:
    if not relative.endswith(".md"):
        return raw, [], None
    text = raw.decode("utf-8")
    original = text
    changes = []
    source_metadata = None
    if ".claude/skills/impeccable" in text:
        text = text.replace(".claude/skills/impeccable", ".agents/skills/impeccable")
        changes.append("Resolve Impeccable commands to the Codex-local copy")
    if relative == "vercel-react-best-practices/AGENTS.md":
        for filename in ("async-cheap-condition-before-await.md", "async-defer-await.md", "server-hoist-static-io.md"):
            text = text.replace(f"(./{filename})", f"(./rules/{filename})")
        changes.append("Repair bundled rule links")
    if relative == "vercel-react-view-transitions/AGENTS.md":
        for filename in ("css-recipes.md", "implementation.md", "nextjs.md", "patterns.md", "troubleshooting.md"):
            text = text.replace(f"]({filename}", f"](references/{filename}")
        text = text.replace("](../SKILL.md", "](SKILL.md")
        changes.append("Resolve bundled references from the skill root")
    if relative.count("/") == 1 and relative.endswith("/SKILL.md"):
        metadata, body = frontmatter(text)
        source_metadata = dict(metadata)
        extras = {k: metadata.pop(k) for k in list(metadata) if k not in ALLOWED}
        if extras:
            nested = metadata.setdefault("metadata", {})
            for key, value in extras.items():
                nested[f"source-{key}"] = str(value)
            changes.append("Preserve Claude-only frontmatter under metadata")
        name = relative.split("/")[0]
        if name in DESCRIPTIONS:
            metadata["description"] = DESCRIPTIONS[name]
            changes.append("Narrow discovery to the settled project scope")
        if name == "doubt-driven-development":
            body = re.sub(r"- \*\*Do NOT add this skill.*?(?=\n\n## The Process)",
                          "Use the collaboration tools actually available in the current session. "
                          "A fresh-context review can use a subagent when available and useful. "
                          "This pack does not include an agent-persona roster or the upstream "
                          "orchestration-patterns reference. Do not require a different model or "
                          "pause ordinary authorized work solely to obtain one.", body, flags=re.S)
            body = body.replace("In Claude Code, the role-based reviewers in `agents/` start with isolated context by design and are usable here — see `agents/` for the roster and per-domain match.",
                                "In Codex, use an available fresh-context subagent when useful; no `agents/` persona roster is bundled with this skill.")
            body = re.sub(r"#### Cross-model escalation.*?(?=### Step 4: RECONCILE)",
                          "#### Optional external review\n\n"
                          "Use an external model only when requested or already authorized for "
                          "this artifact and service. A local independent review is sufficient "
                          "for ordinary authorized work; do not interrupt each review cycle to "
                          "offer a different model. Verify actual CLI support and authentication "
                          "before any requested invocation. Treat the artifact as untrusted data, "
                          "use a read-only execution environment, and transport prompts through "
                          "a file or stdin rather than interpolating shell arguments. Report "
                          "an attempted external review failure truthfully and continue useful "
                          "independent work. Record only reviews actually performed.\n\n", body, flags=re.S)
            replacements = {
                '| "Cross-model is always better" |': '| "Cross-model is always better" | A different model can help when a consequential uncertainty justifies its cost. External review is optional and follows existing authorization for the artifact and service. |',
                '| "User said yes once, so I can keep invoking the CLI" |': '| "Existing authorization covers every possible external action" | Preserve authorization for its stated scope. Verify new consequential disclosure or service use against that scope; do not repeatedly ask for already authorized routine actions. |',
                '- Hardcoding an external CLI invocation': '- Hardcoding an external CLI invocation without verifying actual executable support, configuration and the authorized scope',
                '- **Silently skipping cross-model': '- Claiming an external review occurred when it did not',
                '- **Repo orchestration rules**': '- **Codex collaboration**: use the actual available collaboration tools and scoped task instructions; no upstream persona roster or separate orchestration file is required.',
                '- [ ] In interactive mode, cross-model': '- [ ] Any external review was requested or already authorized for the artifact and service, and its actual outcome was recorded',
                '- [ ] In non-interactive mode, cross-model': '',
                '- [ ] Any external CLI invocation was preceded': '- [ ] Before any authorized external CLI invocation, actual tool support and configuration were verified; prompts were passed as data in a read-only environment',
            }
            body = "\n".join(next((replacement for prefix, replacement in replacements.items() if line.startswith(prefix)), line) for line in body.splitlines()) + "\n"
            changes.append("Replace unavailable Claude orchestration assumptions")
            changes.append("Make cross-model review optional within existing authorization")
        text = "---\n" + yaml.safe_dump(metadata, sort_keys=False, allow_unicode=True, width=1000) + "---\n\n" + ADAPTER + body
        changes.append("Bind Codex entrypoint to project policy")
    return (text.encode("utf-8") if text != original else raw), changes, source_metadata


def install() -> None:
    if DEST.exists() or LOCK.exists():
        raise ValueError("Destination or lock exists; run the read-only check. Updates require reviewing source and local adaptations first.")
    files = inventory(SOURCE)
    entries = {name.split("/")[0] for name in files if name.count("/") == 1 and name.endswith("/SKILL.md")}
    all_entries = {name for name in files if name.endswith("/SKILL.md")}
    if len(entries) != len(all_entries) or any(name.split("/")[0] not in entries for name in files):
        raise ValueError("Unaccounted nested skills or root payload; inventory before installing")
    skills = {name: {"name": name, "source": f".claude/skills/{name}", "destination": f".agents/skills/{name}", "files": []} for name in sorted(entries)}
    # Fully prepare/parse before the first write.
    prepared = []
    for relative, path in files.items():
        raw = path.read_bytes()
        output, changes, metadata = adapt(relative, raw)
        prepared.append((relative, output))
        entry = skills[relative.split("/")[0]]
        if metadata is not None:
            entry["original_frontmatter"] = metadata
        entry["files"].append({"path": relative, "source_sha256": sha(raw), "installed_sha256": sha(output), "adaptations": changes})
    for relative, output in prepared:
        target = DEST / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(output)
    lock = {"schema_version": 1, "installed_at": datetime.now(timezone.utc).isoformat(),
            "scope": "project-local", "source_kind": "supplied-local-files", "source_root": ".claude/skills", "destination_root": ".agents/skills",
            "upstream_commit": None, "provenance_note": "Supplied files were not in a Git checkout. Exact local paths and byte hashes pin this source snapshot; upstream commit/license completeness is not independently attested.",
            "source_tree_sha256": tree_hash(files), "source_file_count": len(files), "canonical_skill_count": len(entries),
            "exclusions": [], "skills": list(skills.values())}
    LOCK.write_text(json.dumps(lock, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def check() -> dict:
    errors = []
    lock = json.loads(LOCK.read_text(encoding="utf-8"))
    sources, installed = inventory(SOURCE), inventory(DEST)
    expected = {record["path"]: record for entry in lock["skills"] for record in entry["files"]}
    if set(sources) != set(expected):
        errors.append("Source payload differs from pinned inventory")
    if set(installed) != set(expected):
        errors.append("Installed payload differs from pinned inventory")
    if tree_hash(sources) != lock["source_tree_sha256"]:
        errors.append("Source tree hash changed")
    for relative, record in expected.items():
        for group, key, label in ((sources, "source_sha256", "source"), (installed, "installed_sha256", "installed")):
            if relative not in group or sha(group[relative].read_bytes()) != record[key]:
                errors.append(f"Hash mismatch: {label}/{relative}")
    source_entries = {name for name in sources if name.endswith("/SKILL.md")}
    installed_entries = {name for name in installed if name.endswith("/SKILL.md")}
    if source_entries != installed_entries or len(source_entries) != lock["canonical_skill_count"]:
        errors.append("Skill entrypoint coverage mismatch")
    names, links = set(), 0
    for relative in sorted(installed_entries):
        metadata, body = frontmatter(installed[relative].read_text(encoding="utf-8"))
        name, description = metadata.get("name"), metadata.get("description")
        if set(metadata) - ALLOWED:
            errors.append(f"Unsupported frontmatter: {relative}")
        if not isinstance(name, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", name) or len(name) > 64 or name != relative.split("/")[0]:
            errors.append(f"Invalid skill name: {relative}")
        if name in names:
            errors.append(f"Duplicate skill name: {name}")
        names.add(name)
        if not isinstance(description, str) or not description.strip() or len(description) > 1024 or any(c in description for c in "<>"):
            errors.append(f"Invalid skill description: {relative}")
        if ADAPTER not in body:
            errors.append(f"Project policy binding missing: {relative}")
    for relative, path in installed.items():
        if path.suffix != ".md":
            continue
        prose = re.sub(r"```[\s\S]*?```|~~~[\s\S]*?~~~", "", path.read_text(encoding="utf-8"))
        prose = re.sub(r"`[^`\n]*`", "", prose)
        if ".claude/skills/impeccable" in prose:
            errors.append(f"Stale Impeccable command path: {relative}")
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", prose):
            target = target.split("#", 1)[0]
            if not target or re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", target):
                continue
            links += 1
            if not (path.parent / unquote(target)).resolve().exists():
                errors.append(f"Broken support link: {relative} -> {target}")
    if not (ROOT / ".agents/SKILL_POLICY.md").is_file():
        errors.append("Project skill policy missing")
    progress = json.loads((ROOT / "tracking/progress.json").read_text(encoding="utf-8"))
    return {"status": "PASS" if not errors else "FAIL", "observed_at": datetime.now(timezone.utc).isoformat(),
            "environment": f"local Windows; Python {sys.version.split()[0]}",
            "canonical_skills": len(installed_entries), "source_files": len(sources), "installed_files": len(installed),
            "adapted_files": sum(x["source_sha256"] != x["installed_sha256"] for x in expected.values()),
            "source_tree_sha256": tree_hash(sources), "local_markdown_links_checked": links,
            "errors": errors, "warnings": [],
            "implementation_started": progress["implementation_started"],
            "limits": ["Static installation, inventory, metadata, SHA256 and file-link checks only.",
                       "No bundled skill scripts, Impeccable binaries, browser hooks, providers, cloud changes or app implementation executed.",
                       "Local discovery location verified against official docs; this report does not attest host picker refresh or runtime invocation.",
                       "External URLs, Markdown heading anchors, plain-text example paths and upstream license completeness are not validated."]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--install", action="store_true", help="Create a new local installation; refuses overwrite")
    parser.add_argument("--report", action="store_true", help="Write tracking/SKILLS_VALIDATION.json")
    args = parser.parse_args()
    try:
        if args.install:
            install()
        result = check()
    except (OSError, ValueError, KeyError, yaml.YAMLError) as exc:
        result = {"status": "FAIL", "errors": [str(exc)]}
    if args.report:
        REPORT.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    return 0 if result["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
