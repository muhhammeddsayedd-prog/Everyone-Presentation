"""Add the closed version-feedback aggregate contract; source generation only."""
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]


def write_source(path, value):
    """Keep each tracked contract's established byte newline convention."""
    previous = path.read_bytes()
    ending = b'\r\n' if b'\r\n' in previous else b'\n'
    if ending == b'\r\n':
        assert previous.count(b'\n') == previous.count(b'\r\n'), 'Mixed contract newlines require explicit reconciliation.'
    raw = value.replace('\r\n', '\n').encode('utf-8')
    path.write_bytes(raw.replace(b'\n', ending))


path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
obj = lambda fields: {'type': 'object', 'additionalProperties': False, 'properties': fields, 'required': list(fields)}
count = {'type': 'integer', 'minimum': 0, 'maximum': 9007199254740991}
uuid = {'type': 'string', 'format': 'uuid', 'pattern': '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'}
counts = obj({key: copy.deepcopy(count) for key in ['preferred', 'maybe', 'not_preferred', 'comment_count', 'unresolved_count']})
summary = obj({'version_id': uuid, 'per_slide': {'type': 'array', 'maxItems': 1000,
    'items': obj({'version_slide_id': uuid, **copy.deepcopy(counts['properties'])})},
    'totals': {'$ref': '#/components/schemas/FeedbackCounts'}})
description = ('Read full body-free feedback counts on the exact requested Ready version in one snapshot, without cursor/limit truncation. '
    'All actual slides appear in ordinal order, including zero cover rows. Pending slides have comments only. '
    'Count visible undeleted comment rows including replies, unresolved rows with resolved=false, and current stored votes by value. '
    'Totals sum per_slide; unresolved_count cannot exceed comment_count. No bodies, names or author/session identifiers. '
    'Signed-in authority remains workspaces.read plus current presentation/project scope; guest authority remains the existing '
    'live link/session/external-series checks and excludes all internal comment counts. No mutation or provider call.')
api['components']['schemas'].update(FeedbackCounts=counts, FeedbackSummary=summary)
for source, target, operation_id in [('/versions/{version_id}/feedback', '/versions/{version_id}/feedback/summary', 'get_feedback_summary'),
        ('/review/versions/{version_id}/feedback', '/review/versions/{version_id}/feedback/summary', 'guest_get_feedback_summary')]:
    operation = copy.deepcopy(api['paths'][source]['get'])
    operation.update(operationId=operation_id, summary='Read full scoped version feedback counts', description=description,
        **{'x-shared-service-operation': operation_id})
    operation['parameters'] = [p for p in operation['parameters'] if p['in'] != 'query']
    next(p for p in operation['parameters'] if p['name'] == 'version_id')['schema'] = copy.deepcopy(uuid)
    operation['responses']['200']['content']['application/json']['schema']['properties']['data'] = {'$ref': '#/components/schemas/FeedbackSummary'}
    api['paths'][target] = {'get': operation}
write_source(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))

def converted(value):
    if isinstance(value, dict):
        return {k: v.replace('#/components/schemas/', '#/$defs/') if k == '$ref' else converted(v) for k, v in value.items()}
    if isinstance(value, list):
        return [converted(v) for v in value]
    return value

path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
tool = copy.deepcopy(next(t for t in catalog['tools'] if t['name'] == 'list_feedback'))
tool.update(name='get_feedback_summary', operationId='get_feedback_summary', description=description,
    http={'method': 'GET', 'path': '/versions/{version_id}/feedback/summary'})
tool['inputSchema'] = {**obj({'version_id': uuid}), '$defs': {}}
tool['outputSchema']['properties']['data'] = {'$ref': '#/$defs/FeedbackSummary'}
tool['outputSchema']['$defs'] = {'FeedbackSummary': converted(summary), 'FeedbackCounts': counts,
    'Warning': tool['outputSchema']['$defs']['Warning'], 'Id': tool['outputSchema']['$defs']['Id']}
catalog['tools'] = [t for t in catalog['tools'] if t['name'] != tool['name']] + [tool]
write_source(path, json.dumps(catalog, indent=2) + '\n')

path = ROOT / 'contracts/operation-parity.json'
parity = json.loads(path.read_text(encoding='utf-8'))
group = next(group for group in parity['groups'] if group['id'] == 'sharing')
group['operations'] = [row for row in group['operations'] if row['operation'] != tool['name']] + [{
    'operation': tool['name'], 'domain_symbol': 'getFeedbackSummary', 'domain_source': 'packages/central/src/guest-reviews.ts',
    'http_source': 'apps/web/lib/guest-http.ts'}]
write_source(path, json.dumps(parity, indent=2) + '\n')

path = ROOT / 'docs/integrations/OPERATION_INDEX.md'
index = path.read_text(encoding='utf-8')
for anchor, line in [
    ('| `list_feedback` | `GET /versions/{version_id}/feedback` | workspaces.read | Yes |',
     '| `get_feedback_summary` | `GET /versions/{version_id}/feedback/summary` | workspaces.read; same version/project scope | Yes |'),
    ('| `guest_list_feedback` | `GET /review/versions/{version_id}/feedback` | guest | No |',
     '| `guest_get_feedback_summary` | `GET /review/versions/{version_id}/feedback/summary` | same live guest session/link/version | No |')]:
    if line not in index:
        assert anchor in index
        index = index.replace(anchor, anchor + '\n' + line)
write_source(path, index)
