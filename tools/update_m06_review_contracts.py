"""Source-only M06 scoped guest browser, media proxy and feedback contracts."""
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
schemas = api['components']['schemas']
ref = lambda name: {'$ref': '#/components/schemas/' + name}
identifier = ref('Id')
schemas['GuestBrowserAccess'] = copy.deepcopy(schemas['GuestAccess'])
schemas['GuestBrowserAccess']['properties'].pop('access_token')
schemas['GuestBrowserAccess']['required'].remove('access_token')
schemas['GuestBrowserAccess']['description'] = 'Cookie-based browser adapter. Raw session credential exists only in a scoped HttpOnly SameSite=Strict cookie; guest_session_id is a public context selector, never a bearer.'
external = schemas['ExternalPresentationVersion']
external['properties'].update({'cover': ref('ReviewCover'), 'template_version': {'type': 'string'}, 'template_content_hash': {'type': 'string', 'pattern': '^[a-f0-9]{64}$'}})
for name in ('cover', 'template_version', 'template_content_hash'):
    if name not in external['required']: external['required'].append(name)
external['description'] = 'Closed external projection from the exact immutable external-audience version. Frozen branding is included; private render destinations, internal notes and review diagnostics are excluded.'
for name in ('ReviewLinkCreate', 'ReviewLinkPatch'):
    schemas[name]['properties']['label'] = {'type': 'string', 'maxLength': 160}
schemas['Comment']['properties']['body'].update(minLength=1, maxLength=10000)
optional_idem = copy.deepcopy(api['components']['parameters']['IdempotencyKey'])
optional_idem['required'] = False
optional_idem['description'] = 'Optional exact-response replay for an uncertain mutation acknowledgement. A repeated key must keep the identical semantic request; current authority is rechecked.'
api['components']['parameters']['OptionalIdempotencyKey'] = optional_idem
for route, method in [('/review-links/{review_link_id}', 'patch'), ('/comments/{comment_id}', 'patch'), ('/review/comments/{comment_id}', 'patch'), ('/review/identity', 'put')]:
    parameters = api['paths'][route][method].setdefault('parameters', [])
    if not any(item.get('$ref') == '#/components/parameters/OptionalIdempotencyKey' for item in parameters): parameters.append({'$ref': '#/components/parameters/OptionalIdempotencyKey'})

browser_header = {'name': 'X-EPS-Review-Browser', 'in': 'header', 'required': False, 'schema': {'type': 'string', 'enum': ['1']}, 'description': 'Same-origin browser cookie adapter; response omits raw session secret.'}
context_header = {'name': 'X-Review-Context', 'in': 'header', 'required': False, 'schema': {'type': 'string', 'format': 'uuid'}, 'description': 'Public guest_session_id selects its own HttpOnly cookie. Different link tabs never overwrite one another.'}
for route, methods in api['paths'].items():
    if not route.startswith('/review/'):
        continue
    for method, operation in methods.items():
        if not isinstance(operation, dict) or 'operationId' not in operation: continue
        parameters = operation.setdefault('parameters', [])
        if operation['operationId'] != 'guest_open_review' and not any(item.get('name') == 'X-Review-Context' for item in parameters): parameters.append(copy.deepcopy(context_header))
        operation['x-browser-cookie-adapter'] = 'eps_review_<guest_session_id without dashes>; HttpOnly; SameSite=Strict; Path=/api/v1/review; Secure on HTTPS; expires no later than session/link'
        if method != 'get': operation['x-browser-csrf'] = 'Exact trusted Host and Origin required for cookie/browser writes. Explicit header credentials may omit Origin; a supplied foreign Origin is denied.'
for route, method in [('/review/open', 'post'), ('/review/identity', 'put')]:
    operation = api['paths'][route][method]
    if not any(item.get('name') == 'X-EPS-Review-Browser' for item in operation['parameters']): operation['parameters'].append(copy.deepcopy(browser_header))
    operation['responses']['200']['content']['application/json']['schema']['properties']['data'] = {'anyOf': [ref('GuestAccess'), ref('GuestBrowserAccess')]}
current = api['paths']['/review/presentation']['get']
current['responses']['200']['content']['application/json']['schema']['properties']['data'] = {'anyOf': [ref('ExternalPresentationVersion'), {'type': 'null'}]}
current['responses']['200']['description'] = 'Latest Ready external version, or data:null while the valid series has no Ready version (Preparing). Generation never renews link expiry.'
session = copy.deepcopy(api['paths']['/review/identity']['put'])
session.update(operationId='guest_get_session', summary='Resume the exact cookie-selected guest context after removing the initial URL bearer token', **{'x-mcp-exposed': False})
session.pop('requestBody', None)
session['parameters'] = [copy.deepcopy(context_header)]
session['responses']['200']['content']['application/json']['schema']['properties']['data'] = ref('GuestBrowserAccess')
api['paths']['/review/session'] = {'get': session}

range_parameter = {'name': 'Range', 'in': 'header', 'required': False, 'schema': {'type': 'string', 'maxLength': 50}, 'description': 'One bytes=start-end, bytes=start- or bytes=-suffix range. Multiple or unsatisfiable ranges return416.'}
for route, operation_name, guest, grant, params, mime in [
    ('/pdf-exports/{export_id}/content', 'get_pdf_export_content', False, False, ['export_id'], ['application/pdf']),
    ('/review/pdf-exports/{export_id}/content', 'guest_get_pdf_export_content', True, False, ['export_id'], ['application/pdf']),
    ('/review/versions/{version_id}/media/{asset_id}/content', 'guest_get_media_content', True, False, ['version_id', 'asset_id'], ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska']),
    ('/review-media/versions/{version_id}/media/{asset_id}/content', 'get_review_media_content', False, True, ['version_id', 'asset_id'], ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'])
]:
    operation = copy.deepcopy(api['paths']['/review/versions/{version_id}']['get'] if guest or grant else api['paths']['/pdf-exports/{export_id}']['get'])
    operation.update(operationId=operation_name, summary='Proxy private exact-version content with request-time parent authorization and bounded byte ranges',
        **{'x-mcp-exposed': False, 'x-shared-service-operation': operation_name})
    operation['security'] = [{'MediaGrant' if grant else 'ReviewSession' if guest else 'InternalBearer': []}]
    operation['parameters'] = [{'name': name, 'in': 'path', 'required': True, 'schema': identifier} for name in params] + [copy.deepcopy(range_parameter)]
    if guest:
        operation['parameters'] += [copy.deepcopy(context_header), {'name': 'review_context', 'in': 'query', 'required': False, 'schema': {'type': 'string', 'format': 'uuid'}, 'description': 'Public guest_session_id for native img/video/download cookie selection; never a raw credential. Allowed on binary GET only.'}]
    if grant: operation['x-browser-cookie-adapter'] = 'Version/asset-scoped HttpOnly grant cookie, created by play_review_media browser exchange; every request revalidates parent link.'
    operation['responses']['200'] = {'description': 'Private no-store content; no redirect or publicly issued signed Storage URL.', 'content': {item: {'schema': {'type': 'string', 'format': 'binary'}} for item in mime}}
    operation['responses']['206'] = copy.deepcopy(operation['responses']['200'])
    operation['responses']['206']['description'] = 'Verified single partial range; exact Content-Range/Content-Length and Accept-Ranges:bytes.'
    operation['responses']['416'] = {'description': 'Unsupported or unsatisfiable byte range.', 'content': {'application/json': {'schema': ref('ErrorResponse')}}}
    api['paths'][route] = {'get': operation}
play = api['paths']['/review-media/versions/{version_id}/media/{asset_id}/playback']['post']
if not any(item.get('name') == 'X-EPS-Review-Browser' for item in play['parameters']): play['parameters'].append(copy.deepcopy(browser_header))
play['description'] = 'Browser first exchange uses X-Media-Grant and exact same Origin; stores HttpOnly cookie bound to the fixed version/asset, then returns local proxy URL without the secret. Reload may use that cookie after initial /m/:grant URL is replaced. Parent link is checked on every request.'
for scheme in ('ReviewSession', 'MediaGrant'):
    browser_note = ' Browser uses the documented scoped HttpOnly cookie adapter; raw credentials are never stored in browser localStorage/sessionStorage.'
    if browser_note not in api['components']['securitySchemes'][scheme]['description']: api['components']['securitySchemes'][scheme]['description'] += browser_note
api['paths']['/review-links']['post']['description'] = 'External-audience series only. A link may be created before Ready output; its guest viewer then shows Preparing. Default expiry is exactly30 days and is not renewed by generation. Raw bearer returned only on create/rotation; encrypted exact creation replay retained24h and cleaned on later token operations.'
action_rule = {'if': {'properties': {'kind': {'const': 'presentation_export'}}, 'required': ['kind']}, 'then': {'required': ['can_retry', 'can_cancel']}}
if action_rule not in schemas['Job'].get('allOf', []): schemas['Job'].setdefault('allOf', []).append(action_rule)
path.write_text(yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140), encoding='utf-8')

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
names = {'list_review_links', 'create_review_link', 'update_review_link', 'revoke_review_link', 'rotate_review_link', 'list_feedback', 'create_comment', 'update_comment', 'set_preference', 'prepare_pdf_export', 'get_pdf_export', 'download_pdf_export'}
for tool in catalog['tools']:
    for side in ('inputSchema', 'outputSchema'):
        if '$defs' in tool[side]: tool[side]['$defs'] = definitions(tool[side])
for route, methods in api['paths'].items():
    for method, operation in methods.items():
        if not isinstance(operation, dict) or operation.get('operationId') not in names: continue
        tool = next(tool for tool in catalog['tools'] if tool['name'] == operation['operationId'])
        properties = {}; required = []
        for parameter in operation.get('parameters', []):
            if '$ref' in parameter: parameter = api['components']['parameters'][parameter['$ref'].split('/')[-1]]
            name = 'idempotency_key' if parameter['name'] == 'Idempotency-Key' else parameter['name']
            properties[name] = convert(parameter['schema'])
            if parameter.get('required'): required.append(name)
        if 'requestBody' in operation: properties['body'] = convert(operation['requestBody']['content']['application/json']['schema']); required.append('body')
        tool['inputSchema'] = {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}
        tool['inputSchema']['$defs'] = definitions(tool['inputSchema'])
        success = operation['responses'].get('200') or operation['responses'].get('201') or operation['responses'].get('202')
        tool['outputSchema'] = convert(copy.deepcopy(success['content']['application/json']['schema']))
        tool['outputSchema']['$defs'] = definitions(tool['outputSchema'])
catalog_path.write_text(json.dumps(catalog, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'source_only': True, 'operations': sorted(names), 'guest_binary_companions': 4, 'browser_resume': 'guest_get_session'}))
