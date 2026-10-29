"""Synchronize CandidateMedia subgraphs from authoritative OpenAPI only.

Preserves every operation, annotation and unrelated self-contained MCP schema.
Runtime validators are generated separately by generate_runtime_contracts.py.
"""
import json
from pathlib import Path
import yaml
ROOT = Path(__file__).resolve().parents[1]
api = yaml.safe_load((ROOT / 'contracts/openapi.yaml').read_text(encoding='utf8'))
def convert(value):
    if isinstance(value, dict): return {key: item.replace('#/components/schemas/', '#/$defs/') if key == '$ref' else convert(item) for key, item in value.items()}
    if isinstance(value, list): return [convert(item) for item in value]
    return value
catalog_file = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(catalog_file.read_text(encoding='utf8'))
changed = []
for tool in catalog['tools']:
    for side in ('inputSchema', 'outputSchema'):
        definitions = tool[side].get('$defs', {})
        if 'CandidateMedia' in definitions:
            definitions['CandidateMedia'] = convert(api['components']['schemas']['CandidateMedia'])
            changed.append(tool['name'] + '/' + side)
if not changed: raise ValueError('Existing CandidateMedia MCP subgraphs were not found.')
catalog_file.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf8')
print(json.dumps({'updated_subgraphs': changed, 'unrelated_operations_changed': False}))
