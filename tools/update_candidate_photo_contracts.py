"""Add the cast archive photo read operations (m14); source generation only.

  list_candidate_photos        GET /candidates/{candidate_id}/photos           (HTTP + MCP, cast.read)
  get_candidate_photo_content  GET /candidate-photos/{asset_id}/content       (HTTP bytes only, like get_media_content)
"""
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


def converted(value):
    if isinstance(value, dict):
        return {k: v.replace('#/components/schemas/', '#/$defs/') if k == '$ref' else converted(v) for k, v in value.items()}
    if isinstance(value, list):
        return [converted(v) for v in value]
    return value


LIST = 'list_candidate_photos'
LIST_PATH = '/candidates/{candidate_id}/photos'
LIST_SUMMARY = 'List a candidate\'s cast archive photos, cover first'
LIST_DESCRIPTION = ('List the photos imported with a person from the cast archive (at most 50), the cover photo first. Each row gives the '
                    'full-size asset_id and the small thumb_asset_id; read either through GET /candidate-photos/{asset_id}/content with '
                    'the same signed-in user. People without archive photos return an empty list.')
CONTENT = 'get_candidate_photo_content'
CONTENT_PATH = '/candidate-photos/{asset_id}/content'
schema = {'type': 'object', 'additionalProperties': False, 'properties': {
    'id': {'$ref': '#/components/schemas/Id'},
    'position': {'type': 'integer', 'minimum': 1},
    'cover': {'type': 'boolean'},
    'width': {'type': 'integer', 'minimum': 1, 'maximum': 4096},
    'height': {'type': 'integer', 'minimum': 1, 'maximum': 4096},
    'asset_id': {'$ref': '#/components/schemas/Id'},
    'thumb_asset_id': {'$ref': '#/components/schemas/Id'}},
    'required': ['id', 'position', 'cover', 'width', 'height', 'asset_id', 'thumb_asset_id']}

path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
api['components']['schemas']['CandidatePhoto'] = schema
operation = copy.deepcopy(api['paths']['/candidates/{candidate_id}/supporting-files']['get'])
operation.update(operationId=LIST, summary=LIST_SUMMARY, description=LIST_DESCRIPTION, **{'x-shared-service-operation': LIST})
operation['responses']['200']['content']['application/json']['schema']['properties']['data']['items'] = {'$ref': '#/components/schemas/CandidatePhoto'}
operation['parameters'] = [p for p in operation['parameters'] if p['name'] == 'candidate_id']
api['paths'][LIST_PATH] = {'get': operation}
content = copy.deepcopy(api['paths']['/media/{asset_id}/content']['get'])
content.update(operationId=CONTENT, summary='Read one cast archive photo or thumbnail',
               description='Private JPEG bytes of a ready candidate photo or its thumbnail, read with the caller\'s own session (cast.read). '
                           'Archive photos never change, so the response may be kept privately for a day.',
               **{'x-shared-service-operation': CONTENT, 'x-capability': 'cast.read', 'x-mcp-exposed': False})
content['responses']['200'] = {'description': 'Private authenticated exact JPEG bytes; private cache and nosniff.',
                               'content': {'image/jpeg': {'schema': {'type': 'string', 'format': 'binary'}}}}
api['paths'][CONTENT_PATH] = {'get': content}
write_source(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))

path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
tool = copy.deepcopy(next(t for t in catalog['tools'] if t['name'] == 'list_candidate_support'))
tool.update(name=LIST, operationId=LIST, description=LIST_DESCRIPTION, http={'method': 'GET', 'path': LIST_PATH})
tool['inputSchema']['properties'] = {'candidate_id': tool['inputSchema']['properties']['candidate_id']}
tool['outputSchema']['properties']['data']['items'] = {'$ref': '#/$defs/CandidatePhoto'}
tool['outputSchema']['$defs'].pop('CandidateSupport', None)
tool['outputSchema']['$defs']['CandidatePhoto'] = converted(schema)
raw = path.read_bytes()
end = raw.find(b'\r\n  ],\r\n  "excluded_operations": [', raw.find(b'"tools": ['))
assert end > 0 and raw[end - 5:end] == b'    }' and f'"name": "{LIST}"'.encode() not in raw
entry = '\r\n'.join('    ' + line for line in json.dumps(tool, indent=2).split('\n')).encode('utf-8')
path.write_bytes(raw[:end] + b',\r\n' + entry + raw[end:])
assert json.loads(path.read_text(encoding='utf-8'))['tools'][-1] == tool

path = ROOT / 'contracts/operation-parity.json'
parity = json.loads(path.read_text(encoding='utf-8'))
group = next(group for group in parity['groups'] if any(row['operation'] == 'list_candidate_support' for row in group['operations']))
group['operations'] = [row for row in group['operations'] if row['operation'] != LIST] + [{
    'operation': LIST, 'domain_symbol': 'listCandidatePhotos', 'domain_source': 'packages/central/src/candidate-photos.ts',
    'http_source': 'apps/web/lib/candidates-http.ts'}]
if 'apps/web/components/CandidatePortrait.tsx' not in group['ui_sources']:
    group['ui_sources'].append('apps/web/components/CandidatePortrait.tsx')
write_source(path, json.dumps(parity, indent=2) + '\n')
print('ok')
