"""Generate runtime validation from the authoritative OpenAPI; no parallel hand-edited DTO schemas."""
import json
import hashlib
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
source = yaml.safe_load((ROOT / "contracts/openapi.yaml").read_text(encoding="utf-8"))

def convert(value):
    if isinstance(value, dict):
        return {k: v.replace("#/components/schemas/", "#/$defs/") if k == "$ref" else convert(v) for k, v in value.items()}
    if isinstance(value, list):
        return [convert(v) for v in value]
    return value

output = ROOT / "apps/web/lib/generated-contracts.json"
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps({"$schema": "https://json-schema.org/draft/2020-12/schema", "x-source-sha256": hashlib.sha256((ROOT / "contracts/openapi.yaml").read_bytes()).hexdigest(), "$defs": convert(source["components"]["schemas"])}, indent=2) + "\n", encoding="utf-8")
print(f"Generated {len(source['components']['schemas'])} schemas from contracts/openapi.yaml")
