"""m18/m19 contract parity: default review audience, series cover note, role/slot presentation notes and the
1.4.0 PowerPoint template. Refreshes the MCP catalog's embedded schemas from contracts/openapi.yaml (the source of
truth, edited directly) so API and MCP stay identical. Source generation only; keeps each file's newline bytes."""
import json
import re
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
CHANGED = ['Settings', 'SettingsPatch', 'Role', 'RolePatch', 'Slot', 'SlotPatch', 'PresentationSeries', 'PresentationSeriesCreate',
           'PresentationSeriesPatch', 'PptxDownload']
DESCRIPTIONS = {
    'create_presentation_series': 'Create/reuse series scoped to workspace, output and audience snapshot. Omit audience_preset_id for an ordinary series: '
    'the configured default review audience is used (AUDIENCE_DEFAULT_REQUIRED when Settings has none). Pass an audience only for an explicit review context.',
    'update_presentation_series': 'Rename/archive a series or set its template 1.4.0 cover note without changing its audience scope',
    'update_role': 'Correct role name or requirements, or set its template 1.4.0 presentation note',
    'update_slot': 'Rename an individual slot or set its template 1.4.0 presentation note',
    'update_settings': 'Update allowed app settings (timezone, template for new series, default review audience) without exposing credentials',
}


def write_source(path, text):
    previous = path.read_bytes()
    ending = b'\r\n' if b'\r\n' in previous else b'\n'
    path.write_bytes(text.replace('\r\n', '\n').encode('utf-8').replace(b'\n', ending))


def converted(value):
    if isinstance(value, dict):
        return {k: v.replace('#/components/schemas/', '#/$defs/') if k == '$ref' else converted(v) for k, v in value.items()}
    if isinstance(value, list):
        return [converted(v) for v in value]
    return value


def refs(value):
    return set(re.findall(r'"#/\$defs/([A-Za-z0-9_]+)"', json.dumps(value)))


api = yaml.safe_load((ROOT / 'contracts/openapi.yaml').read_text(encoding='utf-8'))
schemas = {name: converted(schema) for name, schema in api['components']['schemas'].items()}
path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
for tool in catalog['tools']:
    if tool['name'] in DESCRIPTIONS:
        tool['description'] = DESCRIPTIONS[tool['name']]
    if tool['name'] == 'download_version_pptx':
        tool['description'] = tool['description'].replace('(1.2.0 or 1.3.0)', '(1.2.0, 1.3.0 or 1.4.0)')
    for side in ('inputSchema', 'outputSchema'):
        defs = tool.get(side, {}).get('$defs')
        if defs is None:
            continue
        for name in CHANGED:
            if name in defs:
                defs[name] = schemas[name]
        # Keep every embedded schema closed over its references.
        while True:
            missing = (refs(tool[side]) - set(defs))
            if not missing:
                break
            for name in missing:
                defs[name] = schemas[name]
        tool[side]['$defs'] = dict(sorted(defs.items()))
write_source(path, json.dumps(catalog, indent=2) + '\n')
print('updated', path)
