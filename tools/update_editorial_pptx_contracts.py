"""Add the Claude/MCP editable PowerPoint operation for 1.2.0 versions; source generation only."""
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


NAME = 'download_version_pptx'
PATH = '/versions/{version_id}/pptx'
SUMMARY = 'Build and link the editable PowerPoint of a fixed Ready version'
DESCRIPTION = ('Build the editable PowerPoint of a Ready version saved with the Everyone Film editorial template 1.2.0, from the same frozen '
    'content as its PDF, using only the caller\'s own version and media access. Returns the slide count, size and filename of the '
    'verified build and download_url: the in-app content route that requires the same signed-in user (no bearer or public URL). '
    'Open it in a browser signed in to the app; it is rebuilt from the same frozen content on download. Retained 1.0.0/1.1.0 '
    'versions return PPTX_TEMPLATE_UNSUPPORTED; unfinished versions return PRESENTATION_NOT_READY. Nothing is stored or shared.')
schema = {'type': 'object', 'additionalProperties': False, 'properties': {
    'version_id': {'$ref': '#/components/schemas/Id'},
    'download_url': {'type': 'string', 'format': 'uri'},
    'access': {'type': 'string', 'enum': ['signed_in_session']},
    'filename': {'type': 'string'},
    'size_bytes': {'type': 'integer', 'minimum': 0},
    'slide_count': {'type': 'integer', 'minimum': 1},
    'template_version': {'type': 'string', 'enum': ['1.2.0']}},
    'required': ['version_id', 'download_url', 'access', 'filename', 'size_bytes', 'slide_count', 'template_version']}

path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
assert PATH not in api['paths'] or api['paths'][PATH]['post']['operationId'] == NAME
api['components']['schemas']['PptxDownload'] = schema
operation = copy.deepcopy(api['paths']['/versions/{version_id}/pdf']['post'])
operation.update(operationId=NAME, summary=SUMMARY, description=DESCRIPTION, **{'x-shared-service-operation': NAME})
operation['responses']['200']['content']['application/json']['schema']['properties']['data'] = {'$ref': '#/components/schemas/PptxDownload'}
api['paths'][PATH] = {'post': operation}
write_source(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))

path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
tool = copy.deepcopy(next(t for t in catalog['tools'] if t['name'] == 'download_version_pdf'))
tool.update(name=NAME, operationId=NAME, description=DESCRIPTION, http={'method': 'POST', 'path': PATH})
tool['outputSchema']['properties']['data'] = {'$ref': '#/$defs/PptxDownload'}
defs = tool['outputSchema']['$defs']
defs.pop('PdfDownload', None)
defs['PptxDownload'] = converted(schema)
# The catalog has historical mixed newlines; append the entry by byte splice so
# existing lines keep their exact bytes (CRLF, the file's dominant convention).
raw = path.read_bytes()
end = raw.find(b'\r\n  ],\r\n  "excluded_operations": [', raw.find(b'"tools": ['))
assert end > 0 and raw[end - 5:end] == b'    }' and f'"name": "{NAME}"'.encode() not in raw
entry = '\r\n'.join('    ' + line for line in json.dumps(tool, indent=2).split('\n')).encode('utf-8')
path.write_bytes(raw[:end] + b',\r\n' + entry + raw[end:])
assert json.loads(path.read_text(encoding='utf-8'))['tools'][-1] == tool

path = ROOT / 'contracts/operation-parity.json'
parity = json.loads(path.read_text(encoding='utf-8'))
group = next(group for group in parity['groups'] if any(row['operation'] == 'download_version_pdf' for row in group['operations']))
group['operations'] = [row for row in group['operations'] if row['operation'] != NAME] + [{
    'operation': NAME, 'domain_symbol': 'versionPptxDownload', 'domain_source': 'apps/web/lib/presentation-pptx.ts',
    'http_source': 'apps/web/lib/presentation-http.ts'}]
write_source(path, json.dumps(parity, indent=2) + '\n')

path = ROOT / 'docs/integrations/OPERATION_INDEX.md'
index = path.read_text(encoding='utf-8')
anchor = '| `download_version_pdf` | `POST /versions/{version_id}/pdf` | workspaces.read | Yes |'
line = '| `download_version_pptx` | `POST /versions/{version_id}/pptx` | workspaces.read; 1.2.0 Ready version, caller\'s media access | Yes |'
if line not in index:
    assert anchor in index
    index = index.replace(anchor, anchor + '\n' + line)
write_source(path, index)
