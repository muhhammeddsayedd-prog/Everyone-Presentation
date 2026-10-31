"""Add English display projections to existing reads; no new operations or inputs."""
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
api_path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(api_path.read_text(encoding='utf-8'))
schemas = api['components']['schemas']
states = ['available', 'not_provided', 'unavailable', 'not_captured']
text = {'type': 'string', 'minLength': 1, 'maxLength': 200000,
        'pattern': r'^[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*\S[^\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]*$'}
digest = {'type': 'string', 'pattern': '^[a-f0-9]{64}$'}


def nullable(value):
    return {'anyOf': [copy.deepcopy(value), {'type': 'null'}]}


def projection(name, text_key, status_key, digest_key=None):
    schema = schemas[name]
    keys = [text_key, status_key] + ([digest_key] if digest_key else [])
    schema['properties'][text_key] = nullable(text)
    schema['properties'][text_key]['description'] = 'English display transcript. Absence is explicit; never substitute original-language text.'
    schema['properties'][status_key] = {'type': 'string', 'enum': states.copy()}
    if digest_key:
        schema['properties'][digest_key] = nullable(digest)
    # Preserve legacy required fields. A partially present new group fails closed.
    dependencies = schema.setdefault('dependentRequired', {})
    for key in keys:
        dependencies[key] = [other for other in keys if other != key]
    available = {text_key: copy.deepcopy(text)}
    absent = {text_key: {'type': 'null'}}
    if digest_key:
        available[digest_key] = copy.deepcopy(digest)
        absent[digest_key] = {'type': 'null'}
    rule = {'if': {'properties': {status_key: {'const': 'available'}}, 'required': [status_key]},
            'then': {'properties': available}, 'else': {'properties': absent}}
    rules = schema.setdefault('allOf', [])
    if rule not in rules:
        rules.append(rule)


projection('CandidateMedia', 'english_transcript', 'english_transcript_status')
projection('VersionTranscriptCompanion', 'english_text', 'english_status', 'english_sha256')
schemas['CandidateMedia']['properties']['original_transcript']['description'] = 'Retained original-language provenance; use english_transcript for English display.'
schemas['VersionTranscriptCompanion']['properties']['original_text']['description'] = 'Frozen original-language provenance; use the captured english_text for English display. Never read current library text for an old version.'
issues = schemas['CandidateMedia']['properties']['processing_issues']
issues['maxItems'] = 6
if 'ENGLISH_TRANSCRIPT_UNAVAILABLE' not in issues['items']['enum']:
    issues['items']['enum'].append('ENGLISH_TRANSCRIPT_UNAVAILABLE')
api_path.write_text(yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140), encoding='utf-8')


def convert(value):
    if isinstance(value, dict):
        return {key: item.replace('#/components/schemas/', '#/$defs/') if key == '$ref' else convert(item)
                for key, item in value.items()}
    if isinstance(value, list):
        return [convert(item) for item in value]
    return value


catalog_path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))
counts = {'CandidateMedia': 0, 'VersionTranscriptCompanion': 0}
for tool in catalog['tools']:
    for name in counts:
        definitions = tool['outputSchema'].get('$defs', {})
        if name in definitions:
            definitions[name] = convert(schemas[name])
            counts[name] += 1
if counts != {'CandidateMedia': 2, 'VersionTranscriptCompanion': 1}:
    raise SystemExit('Unexpected affected MCP definition inventory; review before writing.')
catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
print('Updated English groups on existing candidate/video reads: 2 candidate and 1 playback MCP definitions. No operations added.')
