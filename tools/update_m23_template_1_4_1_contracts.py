"""m23 contract parity: editorial template 1.4.1 (1.4.0 with name, age and height captions) can be exported as an
editable PowerPoint. Edits contracts/openapi.yaml (the source of truth), regenerates the runtime schemas and refreshes
the MCP catalog's embedded PptxDownload schema and tool description so API and MCP stay identical. Idempotent;
keeps each file's newline bytes."""
import json
import subprocess
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
OLD, NEW = '(1.2.0, 1.3.0 or 1.4.0)', '(1.2.0, 1.3.0, 1.4.0 or 1.4.1)'


def write_source(path, text):
    previous = path.read_bytes()
    ending = b'\r\n' if b'\r\n' in previous else b'\n'
    path.write_bytes(text.replace('\r\n', '\n').encode('utf-8').replace(b'\n', ending))


openapi = ROOT / 'contracts/openapi.yaml'
text = openapi.read_bytes().decode('utf-8').replace('\r\n', '\n')
text = text.replace('template ' + OLD[1:], 'template ' + NEW[1:]).replace('template ' + OLD, 'template ' + NEW)
enum = '        template_version:\n          type: string\n          enum:\n          - 1.2.0\n          - 1.3.0\n          - 1.4.0\n      required:\n      - version_id\n'
if enum in text:
    text = text.replace(enum, enum.replace('          - 1.4.0\n', '          - 1.4.0\n          - 1.4.1\n'))
write_source(openapi, text)
api = yaml.safe_load(openapi.read_text(encoding='utf-8'))
assert api['components']['schemas']['PptxDownload']['properties']['template_version']['enum'] == ['1.2.0', '1.3.0', '1.4.0', '1.4.1']
subprocess.run([sys.executable, str(ROOT / 'tools/generate_runtime_contracts.py')], check=True)


def converted(value):
    if isinstance(value, dict):
        return {k: v.replace('#/components/schemas/', '#/$defs/') if k == '$ref' else converted(v) for k, v in value.items()}
    if isinstance(value, list):
        return [converted(v) for v in value]
    return value


path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
pptx = converted(api['components']['schemas']['PptxDownload'])
for tool in catalog['tools']:
    if tool['name'] == 'download_version_pptx':
        tool['description'] = tool['description'].replace(OLD, NEW)
        assert NEW in tool['description']
    for side in ('inputSchema', 'outputSchema'):
        defs = tool.get(side, {}).get('$defs')
        if defs and 'PptxDownload' in defs:
            defs['PptxDownload'] = pptx
write_source(path, json.dumps(catalog, indent=2) + '\n')
print('updated', openapi, path)
