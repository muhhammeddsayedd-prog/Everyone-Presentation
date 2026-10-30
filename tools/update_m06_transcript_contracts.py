"""Source-only additive frozen-video transcript companion; no new operations."""
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
schemas = api['components']['schemas']
ref = lambda name: {'$ref': '#/components/schemas/' + name}
nullable = lambda schema: {'anyOf': [schema, {'type': 'null'}]}
text = {'type': 'string', 'minLength': 1, 'maxLength': 200000,
        'pattern': r'^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*\S[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$'}
digest = {'type': 'string', 'pattern': '^[a-f0-9]{64}$'}
properties = {
    'version_id': ref('Id'), 'asset_id': ref('Id'),
    'status': {'type': 'string', 'enum': ['available', 'not_provided', 'not_captured']},
    'original_text': nullable(text),
    'languages': {'type': 'array', 'maxItems': 100,
                  'items': {'type': 'string', 'minLength': 1, 'maxLength': 1000, 'pattern': r'^[^\u0000-\u001f\u007f]*\S[^\u0000-\u001f\u007f]*$'}},
    'source_kind': {'type': 'string', 'const': 'source_transcript'},
    'source_sha256': nullable(digest),
}
schemas['VersionTranscriptCompanion'] = {
    'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': list(properties),
    'description': 'Plain original source text captured immutably with this version/video. Not slide wording, captions or factual review. No live-library fallback; legacy versions explicitly report not_captured.',
    'allOf': [{'if': {'properties': {'status': {'const': 'available'}}, 'required': ['status']},
               'then': {'properties': {'original_text': text, 'source_sha256': digest}},
               'else': {'properties': {'original_text': {'type': 'null'}, 'source_sha256': {'type': 'null'}, 'languages': {'maxItems': 0}}}}],
}
schemas['VersionMediaPlayback']['properties']['transcript'] = ref('VersionTranscriptCompanion')
for route in ['/review/versions/{version_id}/media/{asset_id}', '/review-media/versions/{version_id}/media/{asset_id}/playback']:
    api['paths'][route]['post']['responses']['200']['content']['application/json']['schema']['properties']['data'] = ref('VersionMediaPlayback')
path.write_text(yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140), encoding='utf-8')

def convert(value):
    if isinstance(value, dict):
        return {key: item.replace('#/components/schemas/', '#/$defs/') if key == '$ref' else convert(item) for key, item in value.items()}
    if isinstance(value, list):
        return [convert(item) for item in value]
    return value

def definitions(value):
    names = set()
    def visit(item):
        if isinstance(item, dict):
            if '$ref' in item and item['$ref'].startswith('#/$defs/'):
                name = item['$ref'].split('/')[-1]
                if name not in names:
                    names.add(name)
                    visit(convert(schemas[name]))
            for key, sub in item.items():
                if key != '$defs':
                    visit(sub)
        elif isinstance(item, list):
            for sub in item:
                visit(sub)
    visit(value)
    return {name: convert(schemas[name]) for name in sorted(names)}

catalog_path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
tool = next(tool for tool in catalog['tools'] if tool['name'] == 'play_version_media')
success = api['paths']['/versions/{version_id}/media/{asset_id}/playback']['post']['responses']['200']['content']['application/json']['schema']
tool['outputSchema'] = convert(copy.deepcopy(success))
tool['outputSchema']['$defs'] = definitions(tool['outputSchema'])
catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
print('Updated one optional playback companion, two existing guest response references and existing MCP playback output; no new operations.')
