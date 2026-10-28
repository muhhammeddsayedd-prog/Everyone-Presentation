#!/usr/bin/env python3
"""Validate documentation/contract consistency. Does not test or deploy the app."""
from __future__ import annotations
import argparse
from collections import Counter
import importlib.util
import json
import os
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
HTTP = {"get", "put", "post", "delete", "patch", "options", "head", "trace"}
EXCLUDED_SOURCE_DIRS = {".claude", ".agents", ".venv-skills", "__pycache__",
    ".git", "node_modules", ".next", ".local", ".temp", ".branches",
    ".impeccable-engine", "test-results", "playwright-report", "dist"}

def pack_source_files():
    """Walk owned pack sources without traversing vendored skills or tooling environments."""
    for directory, subdirs, files in os.walk(ROOT):
        subdirs[:] = [name for name in subdirs if name not in EXCLUDED_SOURCE_DIRS]
        for name in files:
            yield Path(directory) / name

def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)

def pointer(doc, ref):
    value = doc
    for item in ref.removeprefix("#/").split("/"):
        value = value[item.replace("~1", "/").replace("~0", "~")]
    return value

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true", help="Require optional full JSON Schema/OpenAPI validators")
    parser.add_argument("--report", action="store_true", help="Write PACK_VALIDATION.md")
    args = parser.parse_args()
    try:
        import yaml
    except ImportError:
        sys.exit("PyYAML required: install tools/requirements.txt in an isolated environment.")
    errors, checks, limitations = [], [], []

    def check(ok, message):
        (checks if ok else errors).append(message)

    source_files = tuple(pack_source_files())
    json_files = sorted(p for p in source_files if p.suffix == ".json" and "context-packets" not in p.parts)
    docs = {}
    for p in json_files:
        try:
            docs[p.relative_to(ROOT).as_posix()] = json.loads(p.read_text())
        except Exception as exc:
            errors.append(f"JSON parse {p.relative_to(ROOT)}: {exc}")
    check(len(docs) == len(json_files), f"{len(json_files)} JSON source files parse")

    yaml_files = sorted(p for p in source_files if p.suffix == ".yaml" and "context-packets" not in p.parts)
    for p in yaml_files:
        try:
            docs[p.relative_to(ROOT).as_posix()] = yaml.safe_load(p.read_text())
        except Exception as exc:
            errors.append(f"YAML parse {p.relative_to(ROOT)}: {exc}")
    check(all(p.relative_to(ROOT).as_posix() in docs for p in yaml_files), f"{len(yaml_files)} YAML source files parse")

    api = docs["contracts/openapi.yaml"]
    refs = 0
    for name, doc in docs.items():
        if "mcp-tool-catalog" in name:
            continue  # Tool schemas resolve independently below.
        for node in walk(doc):
            ref = node.get("$ref")
            if ref and ref.startswith("#/"):
                refs += 1
                try:
                    pointer(doc, ref)
                except Exception:
                    errors.append(f"Unresolved reference {name}: {ref}")
    checks.append(f"{refs} local source-schema references checked")

    operations = {}
    for path, item in api["paths"].items():
        for method, op in item.items():
            if method not in HTTP:
                continue
            operation_id = op.get("operationId")
            check(bool(operation_id) and operation_id not in operations, f"Unique operation {operation_id}")
            operations[operation_id] = op
            params = item.get("parameters", []) + op.get("parameters", [])
            params = [pointer(api, p["$ref"]) if "$ref" in p else p for p in params]
            expected = set(re.findall(r"\{([^}]+)\}", path))
            actual = {p["name"] for p in params if p["in"] == "path" and p.get("required")}
            check(expected == actual, f"Path parameters {method.upper()} {path}")
            if any("ServiceBearer" in s for s in op.get("security", [])):
                check(op.get("x-capability") == "service.job-scoped" and not op.get("x-mcp-exposed"), f"Service scope isolated {operation_id}")

    catalog = docs["contracts/mcp-tool-catalog.json"]
    tools = catalog["tools"]
    exposed = {name for name, op in operations.items() if op.get("x-mcp-exposed")}
    tool_ids = [t["operationId"] for t in tools]
    check(len(set(tool_ids)) == len(tool_ids) and set(tool_ids) == exposed, f"{len(tools)} MCP tools exactly cover intended internal operations")
    for tool in tools:
        check(tool["name"] == tool["operationId"], f"MCP operation name {tool['name']}")
        for key in ("inputSchema", "outputSchema"):
            schema = tool[key]
            for node in walk(schema):
                if "$ref" in node:
                    try:
                        pointer(schema, node["$ref"])
                    except Exception:
                        errors.append(f"MCP {tool['name']} {key} reference: {node['$ref']}")

    # Explicit business-interface assertions catch subtle schema drift.
    schemas = api["components"]["schemas"]
    generate = schemas["GenerateVersion"]
    check("expected_input_fingerprint" in generate.get("required", []), "Generation requires exact reviewed input fingerprint")
    review = operations["get_workspace_review"]
    check(any(p.get("name") == "series_id" and p.get("required") for p in review.get("parameters", [])), "Final review requires audience/output series context")
    check("confirm_candidate_reviewed" in exposed and "generate_version" in exposed, "Claude covers confirmation and generation")

    ai_names = ("specs-extraction", "candidate-extraction", "frame-selection", "slide-wording")
    for name in ai_names:
        schema = docs[f"contracts/json-schema/{name}.schema.json"]
        for node in walk(schema):
            if node.get("type") == "object" and "properties" in node:
                check(node.get("additionalProperties") is False and set(node.get("required", [])) == set(node["properties"]), f"Strict AI object keys: {name}")

    fixture = docs["fixtures/casting-happy-path.json"]
    assignments = fixture["assignments"]
    pairs = [(a["slot_id"], a["candidate_id"]) for a in assignments]
    check(len(pairs) == len(set(pairs)), "Fixture has no duplicate candidate/slot assignments")
    main_counts = Counter(a["slot_id"] for a in assignments if a["position"] == "main")
    check(all(n <= 1 for n in main_counts.values()), "Fixture has at most one Main per slot")
    role_order = {r["id"]: r["sort_order"] for r in fixture["roles"]}
    slots = sorted(fixture["slots"], key=lambda s: (role_order[s["role_id"]], s["sort_order"]))
    for output in ("selection", "shortlist"):
        slides = [{"kind": "cover"}]
        for slot in slots:
            values = sorted([a for a in assignments if a["slot_id"] == slot["id"] and (output == "selection" or a["shortlisted"])], key=lambda a: a["sort_order"])
            slides.extend([{"kind": "candidate", "assignment_id": a["id"]} for a in values] or [{"kind": "pending", "slot_id": slot["id"]}])
        expected = fixture["expected"][output]
        check(slides == expected["ordered_slides"] and len(slides) == expected["page_count"], f"Independent {output} page order/count = {len(slides)}")

    sql = (ROOT / "contracts/database/design-reference.sql").read_text()
    tables = set(re.findall(r"create table eps\.([a-z_]+)", sql, re.I))
    fk_tables = set(re.findall(r"references eps\.([a-z_]+)", sql, re.I))
    check(fk_tables <= tables, f"All reference SQL FK table names resolve within {len(tables)} design tables")
    check(sql.index("raise exception") < sql.index("create schema") and sql.rstrip().lower().endswith("rollback;"), "Reference SQL execution guard and rollback intact")
    check("assignments_one_active_main" in sql and "enable row level security" in sql, "One-Main constraint and RLS design declarations present (not executed)")

    # File references in prose, excluding fenced examples and generated dossiers.
    link_count = 0
    for p in (p for p in source_files if p.suffix == ".md"):
        if "context-packets" in p.parts or p.name in {"DEVELOPMENT_HANDBOOK.md"}:
            continue
        prose = re.sub(r"```[\s\S]*?```", "", p.read_text())
        for target in re.findall(r"\[[^\]]+\]\(([^)]+)\)", prose):
            target = target.split("#", 1)[0]
            if not target or re.match(r"^[a-zA-Z][a-zA-Z0-9+.-]*:", target):
                continue
            link_count += 1
            if not (p.parent / target).resolve().exists():
                errors.append(f"Broken local link {p.relative_to(ROOT)} -> {target}")
    checks.append(f"{link_count} local source-document file links checked")
    testdoc = (ROOT / "docs/quality/TEST_STRATEGY.md").read_text()
    test_ids = re.findall(r"^\|\s*(AT-\d+)\s*\|", testdoc, re.M)
    check(bool(test_ids) and len(test_ids) == len(set(test_ids)), f"{len(test_ids)} unique acceptance cases")
    all_brs = {f"BR-{n:03}" for n in range(1, 37)}
    check(all_brs <= set(re.findall(r"BR-\d{3}", testdoc)), "Every BR-001–BR-036 appears in acceptance traceability")
    progress = docs["tracking/progress.json"]
    check(len(progress["milestones"]) == 8, "Eight milestone status records present")

    # Optional complete meta-validation; never claim it ran when unavailable.
    if importlib.util.find_spec("jsonschema"):
        from jsonschema import Draft202012Validator
        try:
            for name, doc in docs.items():
                if name.startswith("contracts/json-schema/"):
                    Draft202012Validator.check_schema(doc)
            for tool in tools:
                for key in ("inputSchema", "outputSchema"):
                    Draft202012Validator.check_schema(tool[key])
            checks.append("Full JSON Schema meta-validation passed")
        except Exception as exc:
            errors.append(f"Full JSON Schema meta-validation: {exc}")
    else:
        limitations.append("Full JSON Schema meta-validator unavailable; structural/reference checks only.")
    if importlib.util.find_spec("openapi_spec_validator"):
        from openapi_spec_validator import validate
        try:
            validate(api)
            checks.append("Full OpenAPI meta-validation passed")
        except Exception as exc:
            errors.append(f"Full OpenAPI meta-validation: {exc}")
    else:
        limitations.append("Full OpenAPI meta-validator unavailable; parsing/structural/reference/parity checks only.")
    if importlib.util.find_spec("pglast"):
        from pglast import parse_sql
        try:
            statements = parse_sql(sql)
            checks.append(f"PostgreSQL SQL syntax parsed: {len(statements)} statements; no SQL executed")
        except Exception as exc:
            errors.append(f"PostgreSQL SQL syntax parse: {exc}")
    else:
        limitations.append("PostgreSQL SQL parser unavailable; reference SQL structural checks only.")
    if args.strict:
        errors.extend(limitations)
    limitations.append("Vendored skills, tooling/dependency environments, Git metadata, private local state, linked-provider metadata and generated runtime/test output are excluded from pack-source checks. Validate installed skills and application behavior with their separate checks.")
    limitations.append("Reference SQL was not executed against a database; function-body compilation, migration semantics and RLS behavior require M00–M07 implementation tests.")
    limitations.append("No cloud database, OpenAI request, n8n execution, live application, actual production PDF or MCP client was tested by this pack checker.")
    summary = {"status": "PASS" if not errors else "FAIL", "checks": len(checks), "errors": errors, "limitations": limitations,
               "api_paths": len(api["paths"]), "api_operations": len(operations), "mcp_tools": len(tools),
               "sql_design_tables": len(tables), "json_schemas": len(list((ROOT / "contracts/json-schema").glob("*.json"))), "acceptance_cases": len(test_ids)}
    print(json.dumps(summary, indent=2))
    if args.report:
        lines = ["# Development pack validation", "", "Date: 27 October 2026. These checks validate the specification, not the future app.", "", f"**Validation result: {summary['status']}.** {len(checks)} schema, syntax, structural, reference, parity and business-contract assertions passed.", "", "## Scope", "", f"- {len(api['paths'])} API paths, {len(operations)} unique operations and {len(tools)} intended internal MCP tools.", f"- {len(tables)} proposed design tables; foreign-key table references and execution guards checked.", f"- {summary['json_schemas']} standalone JSON schemas; source references and AI-object key contracts checked.", f"- {len(test_ids)} unique acceptance cases; all 36 business rules represented.", "- Fixture Selection = 8 pages and Shortlist = 6 pages, independently derived in correct order.", f"- {link_count} source-document local file links checked."]
        lines.extend(f"- {x}" for x in checks if x.startswith("Full ") or x.startswith("PostgreSQL SQL syntax"))
        lines += ["", "## Limitations", ""]
        lines.extend(f"- {x}" for x in limitations)
        if errors:
            lines += ["", "## Errors", ""] + [f"- {x}" for x in errors]
        lines += ["", "## Reproduce", "", "Run `python3 tools/validate_pack.py --report`. For complete meta-validation install tools/requirements.txt in an isolated environment, then run with `--strict`. M00 must also validate the chosen actual implementation toolchain. No app/service gate is marked complete by this report.", ""]
        (ROOT / "PACK_VALIDATION.md").write_text("\n".join(lines))
    return 1 if errors else 0

if __name__ == "__main__":
    raise SystemExit(main())
