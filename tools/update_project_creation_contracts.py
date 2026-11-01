"""Extend the authoritative API/catalog for canonical project creation."""
import copy
import json
from pathlib import Path
import yaml

def write_source(path, text):
    import difflib
    encoded = text.encode('utf-8')
    if path.exists():
        old = path.read_bytes().splitlines(keepends=True)
        new = encoded.splitlines(keepends=True)
        body = lambda line: line.rstrip(b'\r\n')
        for block in reversed(difflib.SequenceMatcher(a=[body(v) for v in old], b=[body(v) for v in new], autojunk=False).get_matching_blocks()):
            if block.size: new[block.b:block.b + block.size] = old[block.a:block.a + block.size]
        encoded = b''.join(new)
    path.write_bytes(encoded)

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
schemas = api['components']['schemas']
keys = ['casting', 'wardrobe', 'art_direction', 'storyboard', 'vehicles_animals', 'fitting', 'pre_ppm', 'ppm', 'production_documents']
type_key = {'type': 'string', 'enum': keys}
obj = lambda fields, required=None: {'type': 'object', 'additionalProperties': False, 'properties': fields, 'required': list(fields) if required is None else required}
schemas['Project']['properties']['presentation_type'] = copy.deepcopy(type_key)
schemas['ProjectCreate'] = obj({'name': {'type': 'string', 'minLength': 1, 'maxLength': 500}, 'presentation_type': type_key, 'client_id': {'type': 'string', 'format': 'uuid'}}, ['name', 'presentation_type'])
schemas['ClientSummary'] = obj({'id': {'$ref': '#/components/schemas/Id'}, 'name': {'type': 'string'}, 'row_version': {'type': 'integer', 'minimum': 1}})
schemas['PresentationType'] = obj({'key': type_key, 'label': {'type': 'string'}, 'status': {'type': 'string', 'enum': ['available', 'planned']}})

def response_schema(schema):
    return obj({'request_id': {'type': 'string'}, 'data': schema, 'warnings': {'type': 'array', 'items': {'$ref': '#/components/schemas/Warning'}}}, ['request_id', 'data'])

create = copy.deepcopy(api['paths']['/workspaces']['post'])
create.update(operationId='create_project', summary='Create a real central project and initial presentation intent', **{'x-shared-service-operation': 'create_project'})
create['description'] = 'Requires projects.read and projects.write. Creates canonical project, creator-only writer membership and presentation intent atomically. Optional client requires current write authority. No capability/client grants or workspace is created. Same-key replay rechecks current authority.'
create['requestBody']['content']['application/json']['schema'] = {'$ref': '#/components/schemas/ProjectCreate'}
create['responses']['201']['content']['application/json']['schema'] = response_schema({'$ref': '#/components/schemas/Project'})
api['paths']['/projects']['post'] = create

clients = copy.deepcopy(api['paths']['/projects']['get'])
clients.update(operationId='list_clients', summary='List active clients authorized for project association', **{'x-shared-service-operation': 'list_clients'})
clients['responses']['200']['content']['application/json']['schema']['properties']['data']['items'] = {'$ref': '#/components/schemas/ClientSummary'}
api['paths']['/clients'] = {'get': clients}
types = copy.deepcopy(api['paths']['/capabilities']['get'])
types.update(operationId='list_presentation_types', summary='List available and planned presentation types', **{'x-shared-service-operation': 'list_presentation_types'})
types['parameters'] = []
types['responses']['200']['content']['application/json']['schema'] = response_schema({'type': 'array', 'items': {'$ref': '#/components/schemas/PresentationType'}})
api['paths']['/presentation-types'] = {'get': types}
write_source(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))

def convert(value):
    if isinstance(value, dict): return {k: v.replace('#/components/schemas/', '#/$defs/') if k == '$ref' else convert(v) for k, v in value.items()}
    if isinstance(value, list): return [convert(v) for v in value]
    return value

def definitions(names):
    result = {}
    def include(name):
        if name in result: return
        result[name] = convert(schemas[name])
        def visit(value):
            if isinstance(value, dict):
                for key, item in value.items():
                    if key == '$ref' and item.startswith('#/$defs/'): include(item.split('/')[-1])
                    else: visit(item)
            elif isinstance(value, list):
                for item in value: visit(item)
        visit(result[name])
    for name in names: include(name)
    return result

path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
for tool in catalog['tools']:
    for group in ['inputSchema', 'outputSchema']:
        if 'Project' in tool[group].get('$defs', {}): tool[group]['$defs']['Project'] = convert(schemas['Project'])
templates = {tool['name']: tool for tool in catalog['tools']}
for name, template_name, endpoint, schema, capability in [
    ('create_project', 'create_workspace', '/projects', 'Project', 'projects.read AND projects.write'),
    ('list_clients', 'list_projects', '/clients', 'ClientSummary', 'projects.read AND projects.write'),
    ('list_presentation_types', 'get_capabilities', '/presentation-types', 'PresentationType', 'projects.read'),
]:
    tool = copy.deepcopy(templates[template_name])
    tool.update(name=name, operationId=name, description=api['paths'][endpoint]['post' if name == 'create_project' else 'get']['summary'], capability=capability)
    tool['http'] = {'method': 'POST' if name == 'create_project' else 'GET', 'path': endpoint}
    if name == 'create_project':
        tool['inputSchema']['properties']['body'] = {'$ref': '#/$defs/ProjectCreate'}
        tool['inputSchema']['$defs'] = {'ProjectCreate': convert(schemas['ProjectCreate'])}
        tool['outputSchema']['properties']['data'] = {'$ref': '#/$defs/Project'}
    elif name == 'list_clients':
        tool['outputSchema']['properties']['data']['items'] = {'$ref': '#/$defs/ClientSummary'}
    else:
        tool['outputSchema']['properties']['data'] = {'type': 'array', 'items': {'$ref': '#/$defs/PresentationType'}}
    tool['outputSchema']['$defs'] = definitions([schema, 'Id', 'Warning'])
    catalog['tools'] = [row for row in catalog['tools'] if row['name'] != name] + [tool]
write_source(path, json.dumps(catalog, indent=2) + '\n')
path = ROOT / 'contracts/operation-parity.json'
parity = json.loads(path.read_text(encoding='utf-8'))
group = next(group for group in parity['groups'] if group['id'] == 'projects')
group['label'] = 'Create/select canonical projects; type intent; authorized clients; workspace and branding'
for name, symbol in [('create_project', 'createProject'), ('list_clients', 'listClients'), ('list_presentation_types', 'listPresentationTypes')]:
    group['operations'] = [row for row in group['operations'] if row['operation'] != name] + [{'operation': name, 'domain_symbol': symbol, 'domain_source': 'packages/central/src/studio.ts', 'http_source': 'apps/web/app/api/v1/[...segments]/route.ts'}]
write_source(path, json.dumps(parity, indent=2) + '\n')
