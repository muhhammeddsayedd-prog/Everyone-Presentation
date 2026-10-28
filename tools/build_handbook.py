#!/usr/bin/env python3
"""Compile narrative documents; machine contracts remain in the full pack."""
import json
from pathlib import Path
from assemble_context import rebase_markdown

ROOT = Path(__file__).resolve().parents[1]
order = json.loads((ROOT / "tools/handbook-order.json").read_text())
output = ROOT / "DEVELOPMENT_HANDBOOK.md"
parts = ["# Everyone Presentation Studio — Complete Development Handbook", "", "Version 1.0 • 27 October 2026", "", "This is the consolidated narrative specification for the Codex development pack. The ZIP is the primary implementation handoff: it also contains OpenAPI, the MCP catalog, eleven JSON schemas, guarded SQL, synthetic fixtures, eight context dossiers with API subsets, scripts and the UX prototype. This handbook contains the source narrative documents; implementation has not started and no live service has been verified.", "", "## Contents", ""]
for index, relative in enumerate(order, 1):
    title = (ROOT / relative).read_text().splitlines()[0].lstrip("# ")
    parts.append(f"{index}. [{title}](#document-{index})")
for index, relative in enumerate(order, 1):
    source = ROOT / relative
    parts += ["", "---", "", f'<a id="document-{index}"></a>', "", f"## Document {index}: {relative}", "", rebase_markdown(source.read_text(), source, output)]
output.write_text("\n".join(parts) + "\n")
print(f"Compiled {len(order)} narrative documents into {output.name}")
