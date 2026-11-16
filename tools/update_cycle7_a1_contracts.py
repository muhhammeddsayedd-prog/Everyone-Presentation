"""Cycle 7 A1 contract changes (m16); idempotent source generation only.

  search_candidates          + workspace_id query; rows are LibraryCandidate (card fields, membership)
  list_workspace_candidates  newest person first; versioned cursor (INVALID_CURSOR for older cursors)
  add_workspace_candidate    picture fields; 200 + already_member when the person is already in the project
  update_workspace_candidate picture fields and media_selection_state
  WorkspaceCandidate         + portrait_asset_id, portrait_source, portrait_crop, media_selection_state
  get_job / Job              + candidate_result for a finished candidate scan
  list_workspace_uploads     GET  /workspaces/{workspace_id}/candidate-uploads   (new)
  suggest_media_repairs      GET  /workspaces/{workspace_id}/media-repairs       (new)
  apply_media_repairs        POST /workspaces/{workspace_id}/media-repairs       (new)

Run with an interpreter that has PyYAML, then:  python tools/generate_runtime_contracts.py
"""
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
REF = '#/components/schemas/'


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
        return {k: v.replace(REF, '#/$defs/') if k == '$ref' else converted(v) for k, v in value.items()}
    if isinstance(value, list):
        return [converted(v) for v in value]
    return value


def ref(name):
    return {'$ref': REF + name}


def nullable(schema):
    return {'anyOf': [schema, {'type': 'null'}]}


ID, NULL_ID, DATE = ref('Id'), nullable(ref('Id')), ref('DateTime')
crop = {'type': 'object', 'additionalProperties': False,
        'description': 'Focus point (0..1 of width/height), used identically by preview, PDF and PowerPoint. No other keys (no crop rectangle).',
        'properties': {'focal_x': {'type': 'number', 'minimum': 0, 'maximum': 1}, 'focal_y': {'type': 'number', 'minimum': 0, 'maximum': 1}},
        'required': ['focal_x', 'focal_y']}
picture_props = {
    'portrait_asset_id': {**NULL_ID, 'description': 'Project presentation picture: a ready extracted frame or archive photo asset of this person. Library edits never change it.'},
    'portrait_source': nullable({'type': 'string', 'enum': ['frame', 'photo']}),
    'portrait_crop': nullable(ref('PortraitCrop')),
    'media_selection_state': {'type': 'string', 'enum': ['unset', 'pinned', 'intentionally_empty'],
                              'description': 'unset = legacy row, nothing chosen; pinned = chosen (by a person or the add default); intentionally_empty = deliberately no picture.'},
}
picture_input = {
    'portrait_asset_id': NULL_ID,
    'portrait_source': nullable({'type': 'string', 'enum': ['frame', 'photo']}),
    'portrait_crop': nullable(ref('PortraitCrop')),
    'media_selection_state': {'type': 'string', 'enum': ['pinned', 'intentionally_empty']},
}

path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
schemas = api['components']['schemas']
schemas['PortraitCrop'] = crop

pool = schemas['WorkspaceCandidate']
props = {k: v for k, v in pool['properties'].items() if k not in picture_props and k != 'row_version'}
props.update(picture_props)
props['row_version'] = pool['properties']['row_version']
pool['properties'] = props
pool['required'] = [k for k in props]
for name in ['WorkspaceCandidateCreate', 'WorkspaceCandidatePatch']:
    schemas[name]['properties'].update(copy.deepcopy(picture_input))
schemas['WorkspaceCandidateAdded'] = {'type': 'object', 'additionalProperties': False,
    'description': 'The project membership. already_member is true when the person was already in the project (added by someone else, a retry or a concurrent request); nothing was changed then.',
    'properties': {**copy.deepcopy(props), 'already_member': {'type': 'boolean'}}, 'required': [*props, 'already_member']}

library = copy.deepcopy(schemas['Candidate'])
library['description'] = 'A Cast Library search row: the profile plus card fields, read in the same query.'
library['properties'].update({
    'name_ar': {'anyOf': [{'type': 'string'}, {'type': 'null'}], 'description': 'Arabic name as supplied (render right-to-left).'},
    'talent_type': nullable({'type': 'string', 'enum': ['talent', 'real_family', 'group']}),
    'tape_count': {'type': 'integer', 'minimum': 0, 'description': 'Introduction recordings stored for this person.'},
    'portrait_photo': nullable({'type': 'object', 'additionalProperties': False, 'properties': {'photo_id': ID, 'asset_id': ID, 'thumb_asset_id': ID},
                                'required': ['photo_id', 'asset_id', 'thumb_asset_id']}),
    'portrait_frame_asset_id': NULL_ID,
    'processing': {'type': 'boolean', 'description': 'A new introduction for this person is still being processed.'},
    'membership': nullable({'type': 'object', 'additionalProperties': False, 'properties': {
        'workspace_candidate_id': ID, 'state': {'type': 'string', 'enum': ['in_project']}}, 'required': ['workspace_candidate_id', 'state']}),
})
library['required'] = list(library['required']) + ['name_ar', 'talent_type', 'tape_count', 'portrait_photo', 'portrait_frame_asset_id', 'processing', 'membership']
schemas['LibraryCandidate'] = library

job = schemas['Job']
job['properties']['candidate_result'] = {'type': 'object', 'additionalProperties': False,
    'description': 'Present on a succeeded candidate_scan: the person and the project row the upload produced (workspace_candidate_id is null for a re-scan).',
    'properties': {'candidate_id': ID, 'candidate_media_id': ID, 'workspace_candidate_id': NULL_ID},
    'required': ['candidate_id', 'candidate_media_id', 'workspace_candidate_id']}

schemas['CandidateUploadRow'] = {'type': 'object', 'additionalProperties': False,
    'description': 'One of the caller\'s candidate video uploads in a project, with its processing state.',
    'properties': {'upload_id': ID, 'workspace_id': ID, 'asset_id': ID, 'filename': {'anyOf': [{'type': 'string'}, {'type': 'null'}]},
                   'size_bytes': {'type': 'integer', 'minimum': 1}, 'mime_type': {'type': 'string'}, 'target_candidate_id': NULL_ID, 'created_at': DATE,
                   'upload_status': {'type': 'string', 'enum': ['open', 'completed', 'cancelled', 'expired']},
                   'state': {'type': 'string', 'enum': ['uploading', 'processing', 'ready', 'needs_attention', 'failed', 'cancelled', 'expired']},
                   'job': nullable({'type': 'object', 'additionalProperties': False, 'properties': {
                       'id': ID, 'status': {'type': 'string', 'enum': ['queued', 'running', 'waiting_for_input', 'succeeded', 'failed', 'cancelled']},
                       'stage': {'type': 'string'}, 'error_code': {'anyOf': [{'type': 'string'}, {'type': 'null'}]}, 'retryable': {'type': 'boolean'},
                       'row_version': ref('RowVersion'), 'updated_at': DATE},
                       'required': ['id', 'status', 'stage', 'error_code', 'retryable', 'row_version', 'updated_at']}),
                   'candidate_id': NULL_ID, 'workspace_candidate_id': NULL_ID},
    'required': ['upload_id', 'workspace_id', 'asset_id', 'filename', 'size_bytes', 'mime_type', 'target_candidate_id', 'created_at', 'upload_status', 'state', 'job', 'candidate_id', 'workspace_candidate_id']}
defaults = {'type': 'object', 'additionalProperties': False, 'properties': {
    'selected_candidate_media_id': NULL_ID, 'selected_frame_asset_ids': {'type': 'array', 'items': ID, 'maxItems': 3, 'uniqueItems': True},
    'portrait_asset_id': NULL_ID, 'portrait_source': nullable({'type': 'string', 'enum': ['frame', 'photo']})},
    'required': ['selected_candidate_media_id', 'selected_frame_asset_ids', 'portrait_asset_id', 'portrait_source']}
schemas['MediaRepairSuggestion'] = {'type': 'object', 'additionalProperties': False,
    'description': 'A legacy project row with nothing chosen and the default it would receive (newest ready introduction, its frames, cover photo else first frame).',
    'properties': {'workspace_candidate_id': ID, 'candidate_id': ID, 'row_version': ref('RowVersion'),
                   'reason': {'type': 'string', 'enum': ['default_available', 'no_media_available']}, 'suggestion': nullable(defaults)},
    'required': ['workspace_candidate_id', 'candidate_id', 'row_version', 'reason', 'suggestion']}
schemas['MediaRepairApply'] = {'type': 'object', 'additionalProperties': False, 'properties': {'items': {'type': 'array', 'minItems': 1, 'maxItems': 100,
    'items': {'type': 'object', 'additionalProperties': False, 'properties': {'workspace_candidate_id': ID, 'row_version': ref('RowVersion')},
              'required': ['workspace_candidate_id', 'row_version']}}}, 'required': ['items']}
schemas['MediaRepairResult'] = {'type': 'object', 'additionalProperties': False,
    'description': 'Rows repaired, and rows left alone with the reason (changed since listed, already chosen, nothing available, not found).',
    'properties': {'applied': {'type': 'array', 'items': ref('WorkspaceCandidate')}, 'skipped': {'type': 'array', 'items': {'type': 'object', 'additionalProperties': False,
        'properties': {'workspace_candidate_id': ID, 'reason': {'type': 'string', 'enum': ['changed', 'already_chosen', 'no_media_available', 'not_found']},
                       'current_row_version': ref('RowVersion')}, 'required': ['workspace_candidate_id', 'reason']}}},
    'required': ['applied', 'skipped']}

paths = api['paths']
search = paths['/candidates']['get']
search['description'] = ('Newest added to the app first (creation time, then id). The cursor is opaque and versioned; a cursor from an older list '
                         'or other filters fails with INVALID_CURSOR. With workspace_id (a project you can read) each row reports your project membership.')
search['parameters'] = [p for p in search['parameters'] if p.get('name') != 'workspace_id']
search['parameters'].insert(len(search['parameters']) - 2, {'name': 'workspace_id', 'in': 'query', 'schema': ref('Id'),
                                                              'description': 'Report membership in this project for each row.'})
search['responses']['200']['content']['application/json']['schema']['properties']['data']['items'] = ref('LibraryCandidate')
pool_path = paths['/workspaces/{workspace_id}/candidates']
pool_path['get']['description'] = 'Newest person first by their creation time in the app (not membership or edit time), id as tie-breaker. Versioned opaque cursor.'
add = pool_path['post']
add['description'] = ('Idempotent per person: if the person is already in the project the existing membership returns with already_member true and '
                      'status 200. A new membership pins the newest ready introduction, its frames and a picture (cover photo, else first frame) '
                      'unless the request chooses them. Replaying an Idempotency-Key whose membership was later removed fails with 409 '
                      'MEMBERSHIP_REMOVED (details.removed_workspace_candidate_id) and adds nobody; re-adding is a new request with a new key.')
created = copy.deepcopy(add['responses']['201'])
created['content']['application/json']['schema']['properties']['data'] = ref('WorkspaceCandidateAdded')
existing = copy.deepcopy(created)
existing['description'] = 'The person was already in this project; the existing membership is returned unchanged.'
add['responses'] = {'200': existing, '201': created, **{k: v for k, v in add['responses'].items() if k not in ('200', '201')}}

template_get = pool_path['get']
uploads = copy.deepcopy(template_get)
uploads.update(operationId='list_workspace_uploads', summary='List your candidate video uploads in a project with their processing state',
               description='Your candidate video uploads in this project, newest first, including ones still transferring or processing, so pending rows survive a refresh. A finished upload names the person and the project row it produced.',
               **{'x-capability': 'workspaces.read AND cast.read', 'x-shared-service-operation': 'list_workspace_uploads'})
uploads['tags'] = ['candidates']
uploads['responses']['200']['content']['application/json']['schema']['properties']['data']['items'] = ref('CandidateUploadRow')
paths['/workspaces/{workspace_id}/candidate-uploads'] = {'get': uploads}
suggest = copy.deepcopy(template_get)
suggest.update(operationId='suggest_media_repairs', summary='Suggest presentation media for legacy project rows',
               description='Project rows with nothing chosen (state unset) and the default each would receive. Nothing changes until apply_media_repairs is called with the rows to repair.',
               **{'x-capability': 'workspaces.read AND cast.read', 'x-shared-service-operation': 'suggest_media_repairs'})
suggest['parameters'] = [p for p in suggest['parameters'] if p.get('name') == 'workspace_id']
body = suggest['responses']['200']['content']['application/json']['schema']
body['properties'] = {'request_id': body['properties']['request_id'], 'data': {'type': 'array', 'items': ref('MediaRepairSuggestion')},
                      'has_more': {'type': 'boolean'}, 'warnings': body['properties']['warnings']}
body['required'] = ['request_id', 'data', 'has_more']
apply = copy.deepcopy(add)
apply.update(operationId='apply_media_repairs', summary='Apply suggested presentation media to listed legacy rows',
             description='Applies the default only to listed rows that are still unset and unchanged (row_version); pinned and intentionally empty rows are never touched. Replays with the same Idempotency-Key.',
             **{'x-capability': 'workspaces.write AND cast.read', 'x-shared-service-operation': 'apply_media_repairs'})
apply['requestBody'] = {'required': True, 'content': {'application/json': {'schema': ref('MediaRepairApply')}}}
result = copy.deepcopy(created)
result['description'] = 'Successful operation'
result['content']['application/json']['schema']['properties']['data'] = ref('MediaRepairResult')
apply['responses'] = {'200': result, **{k: v for k, v in add['responses'].items() if k not in ('200', '201')}}
paths['/workspaces/{workspace_id}/media-repairs'] = {'get': suggest, 'post': apply}
write_source(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))

# MCP catalog: refresh changed tools from OpenAPI and add the three new ones.
operations = {op['operationId']: (method.upper(), p, op) for p, item in paths.items() for method, op in item.items() if isinstance(op, dict) and 'operationId' in op}


def closure(schema):
    names, todo = set(), [schema]
    while todo:
        value = todo.pop()
        if isinstance(value, dict):
            target = value.get('$ref')
            if isinstance(target, str) and target.startswith((REF, '#/$defs/')):
                name = target.split('/')[-1]
                if name not in names:
                    names.add(name); todo.append(schemas[name])
            todo.extend(v for k, v in value.items() if k not in ('$ref', '$defs'))
        elif isinstance(value, list):
            todo.extend(value)
    return {name: converted(schemas[name]) for name in sorted(names)}


def tool_schemas(name, previous_input=None):
    method, _, op = operations[name]
    properties, required = {}, []
    for parameter in op.get('parameters', []):
        if '$ref' in parameter:
            properties['idempotency_key'] = {'type': 'string', 'minLength': 16, 'maxLength': 200}; required.append('idempotency_key'); continue
        properties[parameter['name']] = converted({k: v for k, v in parameter['schema'].items()})
        if parameter.get('required'): required.append(parameter['name'])
    body_schema = op.get('requestBody', {}).get('content', {}).get('application/json', {}).get('schema')
    if body_schema:
        properties['body'] = converted(body_schema); required.append('body')
    if previous_input is not None:  # keep the established ordering of an existing tool
        merged = dict(previous_input['properties'])
        merged.update(properties)
        properties, required = merged, previous_input['required']
    input_schema = {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}
    input_schema['$defs'] = closure(properties)
    success = next(r['content']['application/json']['schema'] for code, r in op['responses'].items() if str(code).startswith('2') and 'application/json' in r.get('content', {}))
    output_schema = {**converted(success), '$defs': closure(success)}
    return input_schema, output_schema


path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
tools = {tool['name']: tool for tool in catalog['tools']}
for name in ['search_candidates', 'add_workspace_candidate', 'update_workspace_candidate']:
    tool = tools[name]
    tool['inputSchema'], tool['outputSchema'] = tool_schemas(name, tool['inputSchema'])
tools['add_workspace_candidate']['description'] = 'Reuse a library person in the project (idempotent per person; already_member when already added) and pin default media'
new_tools = {
    'list_workspace_uploads': ('List your candidate video uploads in a project with their processing state', True),
    'suggest_media_repairs': ('Suggest presentation media for legacy project rows', True),
    'apply_media_repairs': ('Apply suggested presentation media to listed legacy rows', False),
}
for name, (description, read_only) in new_tools.items():
    method, http_path, op = operations[name]
    input_schema, output_schema = tool_schemas(name)
    entry = {'name': name, 'description': description, 'operationId': name, 'http': {'method': method, 'path': http_path}, 'capability': op['x-capability'],
             'inputSchema': input_schema, 'outputSchema': output_schema,
             'annotations': {'readOnlyHint': read_only, 'destructiveHint': False, 'idempotentHint': read_only, 'openWorldHint': False}}
    if name in tools:
        tools[name].clear(); tools[name].update(entry)
    else:
        catalog['tools'].append(entry); tools[name] = entry
# Tools embedding a changed component (Job, WorkspaceCandidate) follow the current OpenAPI definitions.
changed = {'Job', 'WorkspaceCandidate', 'WorkspaceCandidateCreate', 'WorkspaceCandidatePatch'}
for tool in catalog['tools']:
    for side in ['inputSchema', 'outputSchema']:
        if changed & set(tool[side].get('$defs', {})):
            tool[side]['$defs'] = closure({k: v for k, v in tool[side].items() if k != '$defs'})
path.write_bytes((json.dumps(catalog, indent=2, ensure_ascii=False) + '\n').replace('\n', '\r\n').encode('utf-8'))

path = ROOT / 'contracts/operation-parity.json'
parity = json.loads(path.read_text(encoding='utf-8'))
group = next(group for group in parity['groups'] if group['id'] == 'pool')
group['operations'] = [row for row in group['operations'] if row['operation'] not in new_tools] + [
    {'operation': name, 'domain_symbol': symbol, 'domain_source': 'packages/central/src/candidates.ts', 'http_source': 'apps/web/lib/candidates-http.ts'}
    for name, symbol in [('list_workspace_uploads', 'listWorkspaceUploads'), ('suggest_media_repairs', 'suggestMediaRepairs'), ('apply_media_repairs', 'applyMediaRepairs')]]
for source in ['apps/web/components/CandidateResumableUploads.tsx', 'apps/web/components/CandidatePortrait.tsx']:
    if source not in group['ui_sources']:
        group['ui_sources'].append(source)
write_source(path, json.dumps(parity, indent=2) + '\n')
print('ok')
