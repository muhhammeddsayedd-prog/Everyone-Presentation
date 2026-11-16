"""Add the cycle-7 A2 structured scene operations; source generation only. Idempotent: entries are replaced in place.

  list_scenes              GET   /workspaces/{workspace_id}/scenes                    (workspaces.read)
  create_scene             POST  /workspaces/{workspace_id}/scenes                    (workspaces.write, 201)
  update_scene             PATCH /scenes/{scene_id}                                   (workspaces.write)
  reorder_scenes           PUT   /workspaces/{workspace_id}/scene-order               (workspaces.write)
  archive_scene            POST  /scenes/{scene_id}/archive                           (workspaces.write)
  link_scene_occurrence    POST  /scenes/{scene_id}/occurrences                       (workspaces.write, 201)
  update_scene_occurrence  PATCH /scene-occurrences/{occurrence_id}                   (workspaces.write)
  unlink_scene_occurrence  POST  /scene-occurrences/{occurrence_id}/unlink            (workspaces.write)
  list_role_occurrences    GET   /roles/{role_id}/occurrences                         (workspaces.read)
  confirm_scene_proposals  POST  /workspaces/{workspace_id}/scene-proposals/confirm   (workspaces.write)
  reject_scene_proposals   POST  /workspaces/{workspace_id}/scene-proposals/reject    (workspaces.write)

Every mutation requires an Idempotency-Key (the central RPCs reject a missing key).
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


def fresh(value):
    """An unshared copy, so PyYAML emits no new anchors (the existing ones are kept as loaded)."""
    return json.loads(json.dumps(value))


def ref(name):
    return {'$ref': f'#/components/schemas/{name}'}


def text(maximum, minimum=1):
    return {'type': 'string', 'minLength': minimum, 'maxLength': maximum}


def nullable(maximum):
    return {'anyOf': [text(maximum), {'type': 'null'}]}


def ids(maximum):
    return {'type': 'array', 'maxItems': maximum, 'uniqueItems': True, 'items': ref('Id')}


def obj(properties, required, **extra):
    return {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required, **extra}


STATUS = {'type': 'string', 'enum': ['proposed', 'confirmed']}
PLACEMENT = {'type': 'string', 'enum': ['auto', 'repeat', 'hidden'],
             'description': 'auto = printed once at the first occurrence with a combined setting caption; repeat = also printed here; hidden = not printed here.'}
SCENE_TEXT = {'scene_number': nullable(40), 'sequence_label': nullable(300), 'setting': nullable(300), 'notes': nullable(4000)}
OCCURRENCE_TEXT = {'display_title': nullable(300), 'setting_override': nullable(300), 'presentation_note': nullable(500)}
TITLE = {**text(300), 'pattern': '\\S', 'description': 'Scene title; not blank.'}
SLOT_IDS = {**ids(1000), 'description': "Subset of the role's active slots shown for this scene; [] = every slot of the role."}

SCHEMAS = {
    'SceneRequirements': obj({'items': {'type': 'array', 'maxItems': 50, 'items': text(500)}}, ['items']),
    'SceneOccurrence': obj({
        'id': ref('Id'), 'scene_id': ref('Id'), 'role_id': ref('Id'), 'role_name': {'type': 'string'}, 'slot_ids': SLOT_IDS,
        **OCCURRENCE_TEXT, 'deck_placement': PLACEMENT, 'status': STATUS,
        'source_refs': {'type': 'array', 'maxItems': 100, 'items': ref('SourceReference')},
        'sort_order': {'type': 'integer', 'minimum': 0}, 'row_version': ref('RowVersion'),
        'proposal_stale': {'type': 'boolean', 'description': 'True for a proposal made against an older version of the role (renamed or '
                           'requirements changed since); confirming skips it. Review and link again or reject it.'}},
        ['id', 'scene_id', 'role_id', 'role_name', 'slot_ids', 'display_title', 'setting_override', 'presentation_note', 'deck_placement',
         'status', 'source_refs', 'sort_order', 'row_version', 'proposal_stale'],
        description='A canonical role (character) appearing in a scene. Every occurrence of one role shares its slots, Main/Option/Backup and shortlist.'),
    'Scene': obj({
        'id': ref('Id'), 'workspace_id': ref('Id'), 'scene_number': nullable(40), 'title': TITLE, 'sequence_label': nullable(300),
        'setting': nullable(300), 'notes': nullable(4000), 'requirements': ref('SceneRequirements'),
        'source_refs': {'type': 'array', 'maxItems': 100, 'items': ref('SourceReference'), 'description': 'Read-only provenance from specs extraction.'},
        'status': STATUS, 'sort_order': {'type': 'integer', 'minimum': 0}, 'row_version': ref('RowVersion'), 'archived': {'type': 'boolean'},
        'occurrences': {'type': 'array', 'maxItems': 200, 'items': ref('SceneOccurrence')}},
        ['id', 'workspace_id', 'scene_number', 'title', 'sequence_label', 'setting', 'notes', 'requirements', 'source_refs', 'status',
         'sort_order', 'row_version', 'archived', 'occurrences'],
        description='A structured scene of the project. Scenes reference roles only through occurrences; casting stays on roles and slots.'),
    'RoleOccurrence': obj({
        'occurrence_id': ref('Id'), 'scene_id': ref('Id'), 'scene_number': nullable(40), 'scene_title': TITLE, 'setting': nullable(300),
        'scene_position': {'type': 'integer', 'minimum': 1, 'description': '1-based position in the active scene order.'},
        'scene_status': STATUS, 'status': STATUS},
        ['occurrence_id', 'scene_id', 'scene_number', 'scene_title', 'setting', 'scene_position', 'scene_status', 'status']),
    'SceneCreate': obj({'title': TITLE, **SCENE_TEXT, 'requirements': ref('SceneRequirements')}, ['title']),
    'ScenePatch': obj({'row_version': ref('RowVersion'), 'title': TITLE, **SCENE_TEXT, 'requirements': ref('SceneRequirements')},
                      ['row_version'], minProperties=2),
    'SceneReorder': obj({'row_version': {**ref('RowVersion'), 'description': 'The workspace row_version.'},
                         'scene_ids': {**ids(1000), 'description': 'Exactly the full active scene set in its new order.'}},
                        ['row_version', 'scene_ids']),
    'SceneOrder': obj({'workspace_id': ref('Id'), 'row_version': ref('RowVersion'), 'scene_ids': ids(1000)},
                      ['workspace_id', 'row_version', 'scene_ids']),
    'SceneVersionRequest': obj({'row_version': ref('RowVersion')}, ['row_version']),
    'SceneOccurrenceLink': obj({'role_id': ref('Id'), 'slot_ids': SLOT_IDS, **OCCURRENCE_TEXT, 'deck_placement': PLACEMENT}, ['role_id']),
    'SceneOccurrencePatch': obj({'row_version': ref('RowVersion'), 'slot_ids': SLOT_IDS, **OCCURRENCE_TEXT, 'deck_placement': PLACEMENT},
                                ['row_version'], minProperties=2),
    'SceneProposalConfirm': obj({'row_version': {**ref('RowVersion'), 'description': 'The workspace row_version.'},
                                 'scene_ids': ids(1000), 'occurrence_ids': ids(1000)}, ['row_version'],
                                description='Omit both lists to confirm every active proposal in the workspace.'),
    'SceneProposalConfirmResult': obj({'workspace_id': ref('Id'), 'row_version': ref('RowVersion'),
                                       'confirmed_scene_ids': ids(10000), 'confirmed_occurrence_ids': ids(10000),
                                       'skipped_occurrence_ids': {**ids(10000), 'description': 'Stale proposals left for review (the role changed since the proposal).'}},
                                      ['workspace_id', 'row_version', 'confirmed_scene_ids', 'confirmed_occurrence_ids', 'skipped_occurrence_ids']),
    'SceneProposalRejectResult': obj({'workspace_id': ref('Id'), 'row_version': ref('RowVersion'),
                                      'rejected_scene_ids': ids(10000), 'rejected_occurrence_ids': ids(10000)},
                                     ['workspace_id', 'row_version', 'rejected_scene_ids', 'rejected_occurrence_ids']),
}

RULES = ('A role is the canonical character; all occurrences of a role share its slots, Main/Option/Backup and shortlist. '
         'To cast a separate person (for example a younger Father), create a new role with create_role. '
         'Every scene change marks the draft as having unpublished changes.')
WS = ('workspace_id', 'workspace')
SCENE = ('scene_id', 'scene')
OCC = ('occurrence_id', 'occurrence')
ROLE = ('role_id', 'role')
# name, method, path, path parameter, tag, write, status, body schema, data schema (None = paged list), summary, description, annotations
OPERATIONS = [
    ('list_scenes', 'get', '/workspaces/{workspace_id}/scenes', WS, False, '200', None, ('list', 'Scene'),
     'List active scenes with their role occurrences, in order',
     'Active scenes ordered by sort_order; each includes its role occurrences. Pages use the last scene id as cursor. ' + RULES),
    ('create_scene', 'post', '/workspaces/{workspace_id}/scenes', WS, True, '201', 'SceneCreate', ('one', 'Scene'),
     'Create a confirmed scene at the end of the scene order',
     'Creates a confirmed scene appended last. Link roles to it with link_scene_occurrence. ' + RULES),
    ('update_scene', 'patch', '/scenes/{scene_id}', SCENE, True, '200', 'ScenePatch', ('one', 'Scene'),
     'Correct scene number, title, sequence, setting, notes or requirements',
     'Revision-fenced partial update of the scene record; source_refs and status are read-only here. ' + RULES),
    ('reorder_scenes', 'put', '/workspaces/{workspace_id}/scene-order', WS, True, '200', 'SceneReorder', ('one', 'SceneOrder'),
     'Reorder all active scenes',
     'Supply exactly the full active scene set in its new order with the workspace row_version; returns the new workspace row_version. ' + RULES),
    ('archive_scene', 'post', '/scenes/{scene_id}/archive', SCENE, True, '200', 'SceneVersionRequest', ('one', 'Success'),
     'Archive a scene and its occurrences',
     'Archives the scene and its occurrences only. Archiving a scene never touches roles, slots, assignments or candidates; '
     'affected_ids lists the scene and archived occurrence ids. ' + RULES),
    ('link_scene_occurrence', 'post', '/scenes/{scene_id}/occurrences', SCENE, True, '201', 'SceneOccurrenceLink', ('one', 'Scene'),
     'Link an existing role to a scene',
     'Links a role to the scene explicitly by role_id (never by name); returns the parent scene. slot_ids [] or omitted = every slot of '
     'the role. Re-linking a role whose link was removed reactivates it. ' + RULES),
    ('update_scene_occurrence', 'patch', '/scene-occurrences/{occurrence_id}', OCC, True, '200', 'SceneOccurrencePatch', ('one', 'Scene'),
     'Change which slots, title, setting or deck placement a scene occurrence shows',
     'Revision-fenced update of one occurrence; returns the parent scene. Casting decisions stay on the role and its slots. ' + RULES),
    ('unlink_scene_occurrence', 'post', '/scene-occurrences/{occurrence_id}/unlink', OCC, True, '200', 'SceneVersionRequest', ('one', 'Scene'),
     'Remove a role from a scene',
     'Removes the occurrence and returns the parent scene; the role, its slots and assignments are unchanged. ' + RULES),
    ('list_role_occurrences', 'get', '/roles/{role_id}/occurrences', ROLE, False, '200', None, ('fixed', 'RoleOccurrence'),
     'List the scenes a role appears in',
     'Every active occurrence of the role in active scene order (at most 500, one page). ' + RULES),
    ('confirm_scene_proposals', 'post', '/workspaces/{workspace_id}/scene-proposals/confirm', WS, True, '200', 'SceneProposalConfirm',
     ('one', 'SceneProposalConfirmResult'),
     'Confirm proposed scenes and occurrences from specs extraction',
     'Scenes and occurrences proposed by specs extraction stay proposed until confirmed or rejected. Omit scene_ids and occurrence_ids to confirm every '
     'active proposal in the workspace; supply the workspace row_version. A proposed occurrence whose role changed since the import '
     '(proposal_stale) is never confirmed over that edit; it is returned in skipped_occurrence_ids. ' + RULES),
    ('reject_scene_proposals', 'post', '/workspaces/{workspace_id}/scene-proposals/reject', WS, True, '200', 'SceneProposalConfirm',
     ('one', 'SceneProposalRejectResult'),
     'Reject proposed scenes and occurrences from specs extraction',
     'Rejects proposals (confirmed rows are not affected; use archive_scene or unlink_scene_occurrence for those). Rejecting a scene also '
     'removes its links. Rejected proposals are kept as reviewed history and a later import does not propose the same scene again. '
     'Omit both lists to reject every active proposal; supply the workspace row_version. ' + RULES),
]

path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
schemas = api['components']['schemas']
for name, value in SCHEMAS.items():
    schemas[name] = fresh(value)
template_read = api['paths']['/workspaces/{workspace_id}/roles']['get']
template_write = api['paths']['/workspaces/{workspace_id}/roles']['post']
errors = {code: copy.deepcopy(value) for code, value in template_read['responses'].items() if code != '200'}
cursor_parameters = [copy.deepcopy(p) for p in template_read['parameters'] if p['name'] in ('cursor', 'limit')]
warnings = copy.deepcopy(template_read['responses']['200']['content']['application/json']['schema']['properties']['warnings'])
assert template_write['parameters'][1] == {'$ref': '#/components/parameters/IdempotencyKey'}


def envelope(kind, schema):
    if kind == 'list':
        props = {'request_id': {'type': 'string'}, 'data': {'type': 'array', 'items': ref(schema)}, 'page': ref('Page'), 'warnings': copy.deepcopy(warnings)}
        return obj(props, ['request_id', 'data', 'page'])
    if kind == 'fixed':
        props = {'request_id': {'type': 'string'}, 'data': {'type': 'array', 'maxItems': 500, 'items': ref(schema)}, 'page': ref('Page'),
                 'warnings': copy.deepcopy(warnings)}
        return obj(props, ['request_id', 'data', 'page'])
    return obj({'request_id': {'type': 'string'}, 'data': ref(schema), 'warnings': copy.deepcopy(warnings)}, ['request_id', 'data'])


operations = {}
for name, method, route, (param, _label), write, status, body, (kind, schema), summary, description in OPERATIONS:
    operation = {'operationId': name, 'summary': summary, 'description': description, 'tags': ['scenes'],
                 'responses': {status: {'description': 'Successful operation', 'content': {'application/json': {'schema': envelope(kind, schema)}}},
                               **copy.deepcopy(errors)},
                 'x-capability': 'workspaces.write' if write else 'workspaces.read', 'x-mcp-exposed': True, 'x-shared-service-operation': name,
                 'security': [{'InternalBearer': []}],
                 'parameters': [{'name': param, 'in': 'path', 'required': True, 'schema': ref('Id')}]}
    if kind == 'list':
        operation['parameters'] += copy.deepcopy(cursor_parameters)
    if write:
        operation['parameters'].append({'$ref': '#/components/parameters/IdempotencyKey'})
        operation['requestBody'] = {'required': True, 'content': {'application/json': {'schema': ref(body)}}}
    operation = fresh(operation)
    operations[name] = operation
    api['paths'].setdefault(route, {})[method] = operation
write_source(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))


def closure(value, found):
    if isinstance(value, dict):
        for key, child in value.items():
            if key == '$ref' and isinstance(child, str) and child.startswith('#/components/schemas/'):
                target = child.rsplit('/', 1)[1]
                if target not in found:
                    found.add(target)
                    closure(schemas[target], found)
            else:
                closure(child, found)
    elif isinstance(value, list):
        for child in value:
            closure(child, found)
    return found


path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
tools = []
for name, method, route, (param, _label), write, status, body, (kind, schema), summary, description in OPERATIONS:
    operation = operations[name]
    properties = {param: ref('Id')}
    required = [param]
    if kind == 'list':
        for parameter in cursor_parameters:
            properties[parameter['name']] = copy.deepcopy(parameter['schema'])
    if write:
        properties['idempotency_key'] = {'type': 'string', 'minLength': 16, 'maxLength': 200}
        properties['body'] = ref(body)
        required += ['idempotency_key', 'body']
    input_schema = {'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required}
    output = operation['responses'][status]['content']['application/json']['schema']
    destructive = name in ('archive_scene', 'unlink_scene_occurrence')
    tools.append({
        'name': name, 'description': description, 'operationId': name, 'http': {'method': method.upper(), 'path': route},
        'capability': operation['x-capability'],
        'inputSchema': converted({**input_schema, '$defs': {n: schemas[n] for n in sorted(closure(input_schema, set()))}}),
        'outputSchema': converted({**output, '$defs': {n: schemas[n] for n in sorted(closure(output, set()))}}),
        'annotations': {'readOnlyHint': not write, 'destructiveHint': destructive, 'idempotentHint': True, 'openWorldHint': False},
    })
names = [tool['name'] for tool in tools]
retained = [tool for tool in catalog['tools'] if tool['name'] not in names]
catalog['tools'] = retained + tools
write_source(path, json.dumps(catalog, indent=2) + '\n')

path = ROOT / 'contracts/operation-parity.json'
parity = json.loads(path.read_text(encoding='utf-8'))
symbols = {'list_scenes': 'listScenes', 'create_scene': 'createScene', 'update_scene': 'updateScene', 'reorder_scenes': 'reorderScenes',
           'archive_scene': 'archiveScene', 'link_scene_occurrence': 'linkSceneOccurrence', 'update_scene_occurrence': 'updateSceneOccurrence',
           'unlink_scene_occurrence': 'unlinkSceneOccurrence', 'list_role_occurrences': 'listRoleOccurrences',
           'confirm_scene_proposals': 'confirmSceneProposals', 'reject_scene_proposals': 'rejectSceneProposals'}
group = {'id': 'scenes', 'label': 'Structure scenes; link roles to scenes; confirm or reject extracted scene proposals',
         'ui_sources': ['apps/web/components/workspace/scenes/scenes-api.ts'],
         'operations': [{'operation': name, 'domain_symbol': symbols[name], 'domain_source': 'packages/central/src/scenes.ts',
                         'http_source': 'apps/web/lib/scenes-http.ts'} for name in names]}
existing = next((index for index, item in enumerate(parity['groups']) if item['id'] == 'scenes'), None)
if existing is None:
    parity['groups'].insert(next(index for index, item in enumerate(parity['groups']) if item['id'] == 'specs') + 1, group)
else:
    # Keep UI sources added later by the UI work; regenerate the operation rows.
    group['ui_sources'] = parity['groups'][existing]['ui_sources'] or group['ui_sources']
    parity['groups'][existing] = group
write_source(path, json.dumps(parity, indent=2) + '\n')
print('ok')
