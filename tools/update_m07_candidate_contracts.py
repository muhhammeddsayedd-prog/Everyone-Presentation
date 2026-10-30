"""Reconcile the existing candidate transport contract; no database mutation."""
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
api_path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(api_path.read_text(encoding='utf-8'))
mutations = {'update_candidate', 'update_candidate_frames', 'update_workspace_candidate'}
listings = {'get_candidate_media', 'list_duplicate_matches'}
for path_item in api['paths'].values():
    for operation in path_item.values():
        if not isinstance(operation, dict):
            continue
        name = operation.get('operationId')
        if name in mutations:
            parameters = operation.setdefault('parameters', [])
            if not any(item.get('$ref') == '#/components/parameters/IdempotencyKey' for item in parameters):
                parameters.append({'$ref': '#/components/parameters/IdempotencyKey'})
        if name in listings:
            operation['description'] = (
                'Returns a stable ID-ordered cursor page. The cursor is bound to the acting user, candidate and operation. '
                'Every page rechecks current access. This is a live keyset listing, not a frozen snapshot; '
                'refresh from the first page to include later inserts before the cursor. '
                'The existing authorized database array RPC is paged by the central adapter; database-side bounded reads are not claimed.'
            )
api_path.write_text(yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140), encoding='utf-8')

catalog_path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
key = {'type': 'string', 'minLength': 16, 'maxLength': 200}
for tool in catalog['tools']:
    if tool['name'] not in mutations:
        continue
    tool['inputSchema']['properties']['idempotency_key'] = copy.deepcopy(key)
    if 'idempotency_key' not in tool['inputSchema']['required']:
        tool['inputSchema']['required'].append('idempotency_key')
catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'source_only': True, 'idempotency_operations': sorted(mutations), 'documented_cursor_operations': sorted(listings)}))
