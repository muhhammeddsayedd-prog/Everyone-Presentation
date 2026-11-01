"""Add the closed workspace-summary contract; source generation only."""
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
obj = lambda fields: {'type': 'object', 'additionalProperties': False, 'properties': fields, 'required': list(fields)}
count = {'type': 'integer', 'minimum': 0, 'maximum': 9007199254740991}
positive = {**count, 'minimum': 1}
uuid = {'type': 'string', 'format': 'uuid', 'pattern': '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'}
schema = obj({'workspace_id': uuid, 'row_version': positive, 'draft_revision': count,
    'roles_needing_clarification': count, 'project_candidate_count': count,
    'unreviewed_candidate_count': {'anyOf': [count, {'type': 'null'}]}, 'open_slot_count': count,
    'assignment_count': obj({'selection': count, 'shortlist': count}),
    'latest_ready_versions': {'type': 'array', 'maxItems': 1000, 'items': obj({
        'series_id': uuid, 'output_type': {'enum': ['selection', 'shortlist'], 'type': 'string'}, 'version_no': positive})},
    'review_issue_count': {'type': 'null'}})
description = ('Read one consistent current workspace snapshot. Requires workspaces.read and current canonical project access. '
    'Counts all active roles, participation and assignments without cursor truncation. Unknown headcount or unresolved role markers '
    'count once per role. Selection includes every active Option/Main/Backup assignment; Shortlist is explicit. Open slots have no '
    'Selection assignment, including provisional slots. Global library archival retains project participation. Unreviewed uses the '
    'Reviewed facts/source fingerprint and is null without cast.read. Ready entries retain every audience series, sorted by series_id; '
    'invalid pointers or more than 1000 Ready series fail explicitly. review_issue_count is always null. No mutation or provider call.')
api['components']['schemas']['WorkspaceSummary'] = schema
operation = copy.deepcopy(api['paths']['/workspaces/{workspace_id}']['get'])
operation.update(operationId='get_workspace_summary', summary='Read scoped workspace counts and latest Ready series',
    description=description, **{'x-shared-service-operation': 'get_workspace_summary'})
operation['parameters'][0]['schema'] = copy.deepcopy(uuid)
operation['responses']['200']['content']['application/json']['schema']['properties']['data'] = {'$ref': '#/components/schemas/WorkspaceSummary'}
api['paths']['/workspaces/{workspace_id}/summary'] = {'get': operation}
path.write_text(yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140), encoding='utf-8')

catalog_path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
tool = copy.deepcopy(next(t for t in catalog['tools'] if t['name'] == 'get_workspace'))
tool.update(name='get_workspace_summary', operationId='get_workspace_summary', description=description,
    http={'method': 'GET', 'path': '/workspaces/{workspace_id}/summary'})
tool['inputSchema']['properties']['workspace_id'] = copy.deepcopy(uuid)
tool['inputSchema']['$defs'] = {}
tool['outputSchema']['properties']['data'] = {'$ref': '#/$defs/WorkspaceSummary'}
tool['outputSchema']['$defs'] = {'WorkspaceSummary': copy.deepcopy(schema),
    **{k: v for k, v in tool['outputSchema']['$defs'].items() if k != 'Workspace'}}
catalog['tools'] = [t for t in catalog['tools'] if t['name'] != tool['name']] + [tool]
catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')

inventory_path = ROOT / 'contracts/operation-parity.json'
inventory = json.loads(inventory_path.read_text(encoding='utf-8'))
group = next(group for group in inventory['groups'] if group['id'] == 'projects')
group['operations'] = [row for row in group['operations'] if row['operation'] != 'get_workspace_summary'] + [{
    'operation': 'get_workspace_summary', 'domain_symbol': 'getWorkspaceSummary',
    'domain_source': 'packages/central/src/studio.ts', 'http_source': 'apps/web/lib/workspace-summary-http.ts'}]
inventory_path.write_text(json.dumps(inventory, indent=2) + '\n', encoding='utf-8', newline='\n')
index_path = ROOT / 'docs/integrations/OPERATION_INDEX.md'
index = index_path.read_text(encoding='utf-8')
line = '| `get_workspace_summary` | `GET /workspaces/{workspace_id}/summary` | workspaces.read; library review count null without cast.read | Yes |'
if line not in index:
    anchor = '| `get_workspace` | `GET /workspaces/{workspace_id}` | workspaces.read | Yes |'
    assert anchor in index
    index = index.replace(anchor, anchor + '\n' + line)
index_path.write_text(index, encoding='utf-8')
