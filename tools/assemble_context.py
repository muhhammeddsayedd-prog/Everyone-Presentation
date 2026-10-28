#!/usr/bin/env python3
"""Build a current milestone dossier and its relevant OpenAPI subset from source docs."""
from __future__ import annotations
import argparse
import copy
import json
import os
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

def refs(value):
    if isinstance(value, dict):
        if "$ref" in value:
            yield value["$ref"]
        for child in value.values():
            yield from refs(child)
    elif isinstance(value, list):
        for child in value:
            yield from refs(child)

def rebase_markdown(text, source, output):
    def replace(match):
        label, raw = match.group(1), match.group(2)
        if raw.startswith("#") or re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", raw):
            return match.group(0)
        target, sep, anchor = raw.partition("#")
        resolved = (source.parent / target).resolve()
        if not resolved.exists():
            return match.group(0)
        relative = Path(os.path.relpath(resolved, output.parent)).as_posix()
        return f"[{label}]({relative}{sep}{anchor})"
    return re.sub(r"\[([^\]]+)\]\(([^)]+)\)", replace, text)

def main():
    import yaml
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("milestone", choices=[f"M{i:02}" for i in range(8)] + ["all"])
    args = parser.parse_args()
    cfg = json.loads((ROOT / "milestones/context-map.json").read_text())
    api = yaml.safe_load((ROOT / "contracts/openapi.yaml").read_text())
    (ROOT / "context-packets").mkdir(exist_ok=True)
    selected = list(cfg["milestones"]) if args.milestone == "all" else [args.milestone]
    for milestone in selected:
        item = cfg["milestones"][milestone]
        output = ROOT / f"context-packets/{milestone}_CONTEXT.md"
        paths = list(dict.fromkeys([item["packet"]] + cfg["common_documents"] + item["documents"]))
        lines = [f"# {milestone} — consolidated Codex context", "", "Generated from this development pack. Edit source documents, then regenerate; do not edit this copy. Rebuild at session start so current progress and handoff are included. No original chat is required.", "", f"Primary packet: `{item['packet']}`. This dossier contains the product background, rules and implementation narrative relevant to this milestone. Exact machine schemas and reference assets remain companion files in the same pack, listed below; load them when implementing their contracts.", "", "## Companion machine contracts", ""]
        lines += [f"- `{p}`" for p in item["contracts"]]
        lines += [f"- `context-packets/{milestone}_OPENAPI.yaml` (generated relevant operations with transitive schema components)", "", "## Included source documents", ""]
        for n, rel in enumerate(paths, 1):
            lines.append(f"{n}. [{rel}](#source-{n})")
        for n, rel in enumerate(paths, 1):
            source = ROOT / rel
            lines += ["", "---", "", f'<a id="source-{n}"></a>', "", f"## Source {n}: {rel}", "", rebase_markdown(source.read_text(), source, output)]
        output.write_text("\n".join(lines))
        selected_ops = item["operations"]
        subset = {key: copy.deepcopy(api[key]) for key in ("openapi", "jsonSchemaDialect", "info", "servers") if key in api}
        subset["info"]["title"] += f" — {milestone} implementation subset"
        subset["paths"] = {}
        found = set()
        for path, path_item in api["paths"].items():
            keep = {method: copy.deepcopy(op) for method, op in path_item.items() if isinstance(op, dict) and "operationId" in op and (selected_ops == ["*"] or op["operationId"] in selected_ops)}
            if keep:
                subset["paths"][path] = keep
                found.update(op["operationId"] for op in keep.values())
        missing = set(selected_ops) - found - {"*"}
        if missing:
            raise ValueError(f"{milestone}: unknown operations {sorted(missing)}")
        subset["components"] = {"securitySchemes": copy.deepcopy(api["components"]["securitySchemes"])}
        queue = list(refs(subset))
        seen = set()
        while queue:
            ref = queue.pop()
            if ref in seen or not ref.startswith("#/components/"):
                continue
            seen.add(ref)
            _, _, group, name = ref.split("/", 3)
            value = copy.deepcopy(api["components"][group][name])
            subset["components"].setdefault(group, {})[name] = value
            queue.extend(refs(value))
        api_output = ROOT / f"context-packets/{milestone}_OPENAPI.yaml"
        api_output.write_text(yaml.safe_dump(subset, sort_keys=False, allow_unicode=True, width=110))
        print(f"{milestone}: {len(paths)} documents, {len(found)} operations, {len(output.read_text().split())} context words")

if __name__ == "__main__":
    main()
