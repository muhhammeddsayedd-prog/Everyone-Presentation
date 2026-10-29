"""Source-only M05 fixed-version/public viewer and scoped media contracts."""
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
schemas = api['components']['schemas']
ref = lambda name: {'$ref': '#/components/schemas/' + name}
nullable = lambda value: {'anyOf': [value, {'type': 'null'}]}
obj = lambda properties: {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': list(properties)}
identifier = ref('Id')
schemas['VersionSlide']['properties']['role_category'] = nullable({'type': 'string'})
if 'role_category' not in schemas['VersionSlide']['required']: schemas['VersionSlide']['required'].append('role_category')
# Compatibility only: saved M04 review/fit1.0 receipts retain their old shape.
schemas['ReviewSlide']['properties']['role_category'] = nullable({'type': 'string'})
schemas['PresentationSlideContext'] = obj({'slide_id': identifier, 'role_id': nullable(identifier), 'slot_id': nullable(identifier), 'provisional': {'type': 'boolean'},
    'review_status': nullable({'type': 'string', 'enum': ['reviewed', 'unreviewed']}), 'frames': {'type': 'array', 'maxItems': 3, 'items': ref('ReviewFrame')}})
schemas['PresentationRenderContext'] = obj({'cover': ref('ReviewCover'), 'template': ref('TemplateIdentity'),
    'slide_contexts': {'type': 'array', 'minItems': 2, 'maxItems': 1000, 'items': ref('PresentationSlideContext')}})
version = schemas['PresentationVersion']
version['properties'].update({'manifest_asset_id': nullable(identifier), 'generated_by': identifier,
    'failure_code': nullable({'type': 'string', 'pattern': '^[A-Z][A-Z0-9_]{0,99}$'}), 'render_context': ref('PresentationRenderContext')})
for key in ('manifest_asset_id', 'generated_by', 'failure_code', 'render_context'):
    if key not in version['required']: version['required'].append(key)
version['properties']['manifest_hash'] = {'type': 'string', 'pattern': '^[a-f0-9]{64}$'}
version['properties']['slides'].update(minItems=2, maxItems=1000)
version['description'] = 'Internal fixed-version projection. All content and render_context derive from its immutable snapshot; no private storage destinations or live library values are returned. Ready requires both manifest and PDF assets.'
schemas['GenerateVersion']['properties']['generation_note'] = nullable({'type': 'string', 'maxLength': 8000})
schemas['VersionMediaPlayback'] = copy.deepcopy(schemas['Playback'])
schemas['VersionMediaPlayback']['properties']['source_version_id'] = identifier
if 'presentation_render' not in schemas['Job']['properties']['kind']['enum']:
    schemas['Job']['properties']['kind']['enum'].append('presentation_render')
schemas['Job']['properties'].update({'can_retry': {'type': 'boolean', 'description': 'Current server-derived action for presentation_render, independent of the lifetime attempt count.'},
    'can_cancel': {'type': 'boolean', 'description': 'Current server-derived cancellation action for presentation_render.'}})
action_rule = {'if': {'properties': {'kind': {'const': 'presentation_render'}}, 'required': ['kind']}, 'then': {'required': ['can_retry', 'can_cancel']}}
schemas['Job']['allOf'] = [rule for rule in schemas['Job'].get('allOf', []) if rule != action_rule] + [action_rule]

play = copy.deepcopy(api['paths']['/media/{asset_id}/playback']['post'])
play.update(operationId='play_version_media', summary='Authorize the original video retained by an exact fixed version', tags=['versions'],
    **{'x-capability': 'workspaces.read', 'x-shared-service-operation': 'play_version_media', 'x-mcp-exposed': True})
play['parameters'] = [{'name': name, 'in': 'path', 'required': True, 'schema': identifier} for name in ('version_id', 'asset_id')]
play['responses']['200']['content']['application/json']['schema']['properties']['data'] = ref('VersionMediaPlayback')
api['paths']['/versions/{version_id}/media/{asset_id}/playback'] = {'post': play}
for route, name, content in [('/versions/{version_id}/media/{asset_id}/content', 'get_version_media_content', ['image/jpeg', 'image/png', 'image/webp']),
    ('/versions/{version_id}/pdf/content', 'get_version_pdf_content', ['application/pdf'])]:
    operation = copy.deepcopy(api['paths']['/versions/{version_id}']['get'])
    operation.update(operationId=name, summary='Read authenticated fixed-version bytes with bounded integrity verification', tags=['versions'],
        **{'x-capability': 'workspaces.read', 'x-shared-service-operation': name, 'x-mcp-exposed': False})
    operation['parameters'] = [{'name': name, 'in': 'path', 'required': True, 'schema': identifier} for name in (('version_id', 'asset_id') if 'media' in route else ('version_id',))]
    operation['responses']['200'] = {'description': 'Private authenticated content; no-store and nosniff.',
        'content': {mime: {'schema': {'type': 'string', 'format': 'binary'}} for mime in content}}
    api['paths'][route] = {'get': operation}
path.write_text(yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140), encoding='utf-8')
manifest_path = ROOT / 'contracts/json-schema/presentation-manifest.schema.json'
manifest_schema = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest_slide = manifest_schema['$defs']['VersionSlide']
manifest_slide['properties']['role_category'] = nullable({'type': 'string'})
if 'role_category' not in manifest_slide['required']: manifest_slide['required'].append('role_category')
manifest_path.write_text(json.dumps(manifest_schema, indent=2) + '\n', encoding='utf-8')

def convert(value):
    if isinstance(value, dict): return {key: item.replace('#/components/schemas/', '#/$defs/') if key == '$ref' else convert(item) for key, item in value.items()}
    if isinstance(value, list): return [convert(item) for item in value]
    return value

def definitions(value):
    names = set()
    def visit(item):
        if isinstance(item, dict):
            if '$ref' in item and item['$ref'].startswith('#/$defs/'):
                name = item['$ref'].split('/')[-1]
                if name not in names: names.add(name); visit(convert(schemas[name]))
            for key, sub in item.items():
                if key != '$defs': visit(sub)
        elif isinstance(item, list):
            for sub in item: visit(sub)
    visit(value)
    return {name: convert(schemas[name]) for name in sorted(names)}

catalog_path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
for tool in catalog['tools']:
    for side in ('inputSchema', 'outputSchema'):
        if '$defs' in tool[side]: tool[side]['$defs'] = definitions(tool[side])
names = {'list_versions', 'generate_version', 'get_version', 'download_version_pdf', 'play_version_media'}
for route, methods in api['paths'].items():
    for method, operation in methods.items():
        if not isinstance(operation, dict) or operation.get('operationId') not in names: continue
        existing = next((tool for tool in catalog['tools'] if tool['name'] == operation['operationId']), None)
        tool = copy.deepcopy(existing or next(tool for tool in catalog['tools'] if tool['name'] == 'play_media'))
        tool.update(name=operation['operationId'], description=operation['summary'], operationId=operation['operationId'],
            http={'path': route, 'method': method.upper()}, capability=operation['x-capability'])
        properties = {}; required = []
        for parameter in operation.get('parameters', []):
            if '$ref' in parameter:
                parameter = {'name': 'idempotency_key', 'schema': {'type': 'string', 'minLength': 16, 'maxLength': 200}, 'required': True} if parameter['$ref'] == '#/components/parameters/IdempotencyKey' else api['components']['parameters'][parameter['$ref'].split('/')[-1]]
            properties[parameter['name']] = convert(parameter['schema'])
            if parameter.get('required'): required.append(parameter['name'])
        if 'requestBody' in operation:
            properties['body'] = convert(operation['requestBody']['content']['application/json']['schema']); required.append('body')
        tool['inputSchema'] = obj(properties); tool['inputSchema']['required'] = required; tool['inputSchema']['$defs'] = definitions(tool['inputSchema'])
        status = next(str(status) for status in operation['responses'] if str(status).startswith('2'))
        tool['outputSchema'] = convert(operation['responses'][status]['content']['application/json']['schema']); tool['outputSchema']['$defs'] = definitions(tool['outputSchema'])
        if existing: catalog['tools'][catalog['tools'].index(existing)] = tool
        else: catalog['tools'].append(tool)
catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
index_path = ROOT / 'docs/integrations/OPERATION_INDEX.md'; text = index_path.read_text(encoding='utf-8')
for route, name, exposed in [('/versions/{version_id}/media/{asset_id}/playback', 'play_version_media', True),
    ('/versions/{version_id}/media/{asset_id}/content', 'get_version_media_content', False), ('/versions/{version_id}/pdf/content', 'get_version_pdf_content', False)]:
    if '`' + name + '`' not in text: text = text.rstrip() + f"\n| `{name}` | `{'POST' if exposed else 'GET'} {route}` | workspaces.read | {'Yes' if exposed else 'No; binary companion to playback/download'} |\n"
index_path.write_text(text, encoding='utf-8')
local_ref = lambda name: {'$ref': '#/$defs/' + name}
digest = {'type': 'string', 'pattern': '^[a-f0-9]{64}$'}
private_defs = copy.deepcopy(manifest_schema['$defs'])
private_defs['ReviewCover'] = convert(copy.deepcopy(schemas['ReviewCover']))
private_defs['ReviewFrame'] = convert(copy.deepcopy(schemas['ReviewFrame']))
private_defs['FrozenTemplate'] = convert(copy.deepcopy(schemas['TemplateIdentity']))
private_defs['FrozenTemplate']['properties']['font_hashes'] = {'type': 'object', 'minProperties': 6, 'maxProperties': 6,
    'propertyNames': {'pattern': r'^apps/web/public/fonts/IBMPlexSans(?:Arabic)?-(?:Regular|Medium|SemiBold)\.woff2$'}, 'additionalProperties': digest}
private_defs['FrozenTemplate']['required'].append('font_hashes')
private_defs['FrozenAsset'] = obj({**copy.deepcopy(manifest_schema['properties']['asset_inventory']['items']['properties']),
    'bucket': {'type': 'string', 'pattern': '^[a-z0-9][a-z0-9_-]{0,99}$'}, 'object_key': {'type': 'string', 'minLength': 1, 'maxLength': 1024},
    'width': nullable({'type': 'integer', 'minimum': 1, 'maximum': 10000}), 'height': nullable({'type': 'integer', 'minimum': 1, 'maximum': 10000}),
    'duration_ms': nullable({'type': 'integer', 'minimum': 1, 'maximum': 1800000}), 'source_asset_id': nullable(local_ref('Id')),
    'timestamp_ms': nullable({'type': 'integer', 'minimum': 0, 'maximum': 1800000})})
private_defs['FrozenAsset']['properties']['sha256'] = digest
private_defs['FrozenAsset']['properties']['byte_size'] = {'type': 'integer', 'minimum': 1, 'maximum': 268435456}
private_defs['FrozenAsset']['properties']['asset_kind'] = {'type': 'string', 'enum': ['client_logo', 'candidate_frame', 'candidate_video']}
private_defs['FrozenSlide'] = obj({**copy.deepcopy(private_defs['VersionSlide']['properties']), 'role_id': nullable(local_ref('Id')),
    'slot_id': nullable(local_ref('Id')), 'candidate_media_id': nullable(local_ref('Id')), 'provisional': {'type': 'boolean'},
    'review_status': nullable({'type': 'string', 'enum': ['reviewed', 'unreviewed']}), 'frames': {'type': 'array', 'maxItems': 3, 'items': local_ref('ReviewFrame')}})
private_defs['RenderConfiguration'] = obj({'renderer_version': {'const': 'everyone-casting-pdf-v1'},
    'application_origin': {'type': 'string', 'format': 'uri', 'maxLength': 1000, 'description': 'Captured from owner-managed server configuration, never request Origin/Host/body.'}})
snapshot_properties = {'schema_version': {'const': '1.0'}, 'hash_protocol': {'const': 'eps-cast-canonical-v1'},
    **{key: local_ref('Id') for key in ('version_id', 'series_id', 'workspace_id', 'project_id')}, 'version_no': {'type': 'integer', 'minimum': 1},
    'created_at': local_ref('DateTime'), 'input_workspace_row_version': local_ref('RowVersion'), 'input_draft_revision': {'type': 'integer', 'minimum': 0},
    'input_fingerprint': digest, 'template': local_ref('FrozenTemplate'), 'render_configuration': local_ref('RenderConfiguration'),
    'audience_snapshot': local_ref('AudiencePreset'), 'cover': local_ref('ReviewCover'),
    'slides': {'type': 'array', 'minItems': 2, 'maxItems': 1000, 'items': local_ref('FrozenSlide')},
    'asset_inventory': {'type': 'array', 'maxItems': 4001, 'items': local_ref('FrozenAsset')}}
snapshot_schema = {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$id': 'https://contracts.everyone.example/presentation-render-snapshot.schema.json',
    'title': 'Private immutable render snapshot', 'description': 'Private server/worker contract. Never returned as a user or guest payload. Domain validation additionally enforces exact ordered slide, selected-source, inventory and byte budgets.',
    **obj(snapshot_properties), '$defs': private_defs}
(ROOT / 'contracts/json-schema/presentation-render-snapshot.schema.json').write_text(json.dumps(snapshot_schema, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'source_only': True, 'operations': sorted(names)}))
