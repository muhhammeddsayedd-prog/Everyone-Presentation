"""Cycle 7 A4 (m20): appearance observations, enrichment batches and Cast Library facets. Source generation only; idempotent.

  list_candidate_observations   GET  /candidates/{candidate_id}/observations          cast.read
  review_candidate_observation  POST /candidate-observations/{observation_id}/review  cast.review  (Idempotency-Key)
  start_enrichment_batch        POST /enrichment-batches                              cast.write   (Idempotency-Key)
  get_enrichment_batch          GET  /enrichment-batches/{batch_id}                   cast.read
  get_candidate_facets          POST /candidate-facets/query                          cast.read    (read-only; filters are an object)

Also adds the candidate_appearance job kind to the Job schema and updates the parity checker's operation count.
Run with an interpreter that has PyYAML, then: python tools/generate_runtime_contracts.py && python tools/check_m07_parity.py
"""
import copy
import json
import re
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
TAXONOMY = json.loads((ROOT / 'contracts/appearance-taxonomy.json').read_text(encoding='utf-8'))


def write_source(path, value):
    previous = path.read_bytes()
    ending = b'\r\n' if b'\r\n' in previous else b'\n'
    path.write_bytes(value.replace('\r\n', '\n').encode('utf-8').replace(b'\n', ending))


def converted(value):
    if isinstance(value, dict):
        return {k: v.replace('#/components/schemas/', '#/$defs/') if k == '$ref' else converted(v) for k, v in value.items()}
    if isinstance(value, list):
        return [converted(v) for v in value]
    return value


def refs(value, found=None):
    found = set() if found is None else found
    if isinstance(value, dict):
        for k, v in value.items():
            if k == '$ref' and v.startswith('#/components/schemas/'):
                found.add(v.rsplit('/', 1)[1])
            else:
                refs(v, found)
    elif isinstance(value, list):
        for v in value:
            refs(v, found)
    return found


R = lambda name: {'$ref': f'#/components/schemas/{name}'}
nullable = lambda schema: {'anyOf': [schema, {'type': 'null'}]}
obj = lambda props, required=None: {'type': 'object', 'additionalProperties': False, 'properties': props, 'required': list(props) if required is None else required}
STR = {'type': 'string'}
INT0 = {'type': 'integer', 'minimum': 0}
attributes = list(TAXONOMY['attributes'])
values = sorted({v['key'] for a in TAXONOMY['attributes'].values() for v in a['values']} | {'unknown'})
facets = [f['key'] for f in TAXONOMY['facets']]
SCHEMAS = {
    'AppearanceObservation': obj({
        'id': R('Id'), 'media_id': R('Id'), 'person_index': {'type': 'integer', 'minimum': 0, 'maximum': 9}, 'position_note': nullable(STR),
        'attribute': {'type': 'string', 'enum': attributes}, 'suggested_value': {'type': 'string', 'enum': values},
        'confidence': {'type': 'string', 'enum': ['low', 'medium', 'high']}, 'evidence': nullable(STR),
        'status': {'type': 'string', 'enum': ['suggested', 'confirmed', 'rejected', 'overridden']}, 'override_value': nullable({'type': 'string', 'enum': values}),
        'effective_value': nullable({'type': 'string', 'enum': values}), 'reviewed_by': nullable(R('Id')), 'reviewed_at': nullable(R('DateTime')), 'row_version': R('RowVersion')}),
    'ObservationMedia': obj({
        'id': R('Id'), 'asset_id': R('Id'), 'source_kind': {'type': 'string', 'enum': ['photo', 'frame']}, 'thumb_asset_id': nullable(R('Id')),
        'candidate_media_id': nullable(R('Id')), 'frame_timestamp_ms': nullable(INT0),
        'media_category': {'type': 'string', 'enum': [c['key'] for c in TAXONOMY['media_categories']]},
        'recording_context': {'type': 'string', 'enum': ['archive_photo', 'introduction_video']}, 'media_added_at': R('DateTime'),
        'people_count': {'type': 'integer', 'minimum': 0, 'maximum': 10}, 'ambiguous': {'type': 'boolean'}, 'target_person_index': nullable({'type': 'integer', 'minimum': 0, 'maximum': 9}),
        'quality_note': nullable(STR), 'model': STR, 'prompt_version': STR, 'analyzed_at': R('DateTime'), 'row_version': R('RowVersion'),
        'observations': {'type': 'array', 'maxItems': 200, 'items': R('AppearanceObservation')}}),
    'SuppliedAppearance': obj({
        'archive': nullable(obj({
            'source': obj({'kind': {'type': 'string', 'enum': ['archive_import']}, 'source_project': nullable(STR), 'source_id': nullable(STR), 'imported_at': nullable(R('DateTime'))}),
            'name_ar': nullable(STR), 'talent_type': STR, 'look': nullable(STR), 'skin_tone': nullable(STR),
            **{k: {'type': 'array', 'items': STR} for k in ['playing_age', 'hair_length', 'hair_texture', 'hair_colour', 'hair_style', 'hair_colouring', 'tags']}})),
        'facts': nullable({'type': 'array', 'items': obj({'key': {'type': 'string', 'enum': ['stated_gender', 'age_or_range', 'city', 'languages']},
            'value': {'anyOf': [STR, {'type': 'array', 'items': STR}, {'type': 'null'}]},
            'source': nullable({'type': 'string', 'enum': ['manual', 'transcript', 'archive']})})})}),
    'CandidateObservations': obj({'candidate_id': R('Id'), 'supplied': R('SuppliedAppearance'), 'media': {'type': 'array', 'maxItems': 100, 'items': R('ObservationMedia')}}),
    'ObservationReview': {'type': 'object', 'additionalProperties': False, 'properties': {
        'row_version': R('RowVersion'), 'action': {'type': 'string', 'enum': ['confirm', 'reject', 'override', 'reset']}, 'value': {'type': 'string', 'enum': [v for v in values if v != 'unknown']}},
        'required': ['row_version', 'action'], 'allOf': [{'if': {'properties': {'action': {'const': 'override'}}}, 'then': {'required': ['value']}, 'else': {'not': {'required': ['value']}}}]},
    'FacetFilters': {'type': 'object', 'additionalProperties': False, 'properties': {
        'facets': {'type': 'object', 'additionalProperties': False, 'properties': {f: {'type': 'array', 'maxItems': 50, 'items': {'type': 'string', 'minLength': 1, 'maxLength': 200}} for f in facets}},
        'include_unknown': {'type': 'boolean'}, 'q': {'type': 'string', 'maxLength': 200},
        'search': {'type': 'object', 'additionalProperties': False, 'description': 'The same supplied-fact filters sent to search_candidates, so counts match its results.',
                   'properties': {k: ({'type': 'boolean'} if k == 'include_unknown' else {'type': 'string', 'enum': ['reviewed', 'unreviewed']} if k == 'review_status' else {'type': 'string', 'maxLength': 500})
                                  for k in ['q','include_unknown','review_status','age_or_range','stated_gender','height_measurements','language','accent','skill','city','previous_project_role','classification']}}}, 'required': []},
    'CandidateFacets': obj({'total': INT0,
        'filters': obj({'facets': {'type': 'object', 'additionalProperties': {'type': 'array', 'items': STR}}, 'include_unknown': {'type': 'boolean'}, 'q': nullable(STR),
                        'search': {'type': 'object'}}, ['facets', 'include_unknown', 'q']),
        'facets': {'type': 'array', 'items': obj({'key': {'type': 'string', 'enum': facets}, 'matched': INT0, 'unknown': INT0,
            'values': {'type': 'array', 'items': obj({'value': STR, 'count': INT0})}, 'selected': {'type': 'array', 'items': STR}})}}),
    'EnrichmentBatchStart': {'type': 'object', 'additionalProperties': False, 'properties': {
        'workspace_id': R('Id'), 'candidate_ids': {'type': 'array', 'minItems': 1, 'maxItems': 1000, 'items': R('Id')}, 'filters': R('FacetFilters'),
        'limit': {'type': 'integer', 'minimum': 1, 'maximum': 1000}, 'spend_cap_cents': {'type': 'integer', 'minimum': 1, 'maximum': 1000000}},
        'required': ['workspace_id', 'limit', 'spend_cap_cents'], 'oneOf': [{'required': ['candidate_ids']}, {'required': ['filters']}]},
    'EnrichmentBatch': obj({
        'id': R('Id'), 'workspace_id': R('Id'), 'status': {'type': 'string', 'enum': ['running', 'completed', 'stopped_spend_cap', 'cancelled']},
        'scope': {'type': 'object'}, 'item_limit': {'type': 'integer', 'minimum': 1}, 'spend_cap_cents': {'type': 'integer', 'minimum': 1}, 'spent_micro_usd': INT0,
        'model': STR, 'prompt_version': STR, 'created_at': R('DateTime'), 'updated_at': R('DateTime'), 'completed_at': nullable(R('DateTime')), 'row_version': R('RowVersion'),
        'counts': obj({k: INT0 for k in ['total', 'pending', 'queued', 'succeeded', 'failed', 'skipped', 'input_tokens', 'output_tokens']}),
        'items': {'type': 'array', 'maxItems': 200, 'items': obj({'candidate_id': R('Id'), 'position': {'type': 'integer', 'minimum': 1},
            'status': {'type': 'string', 'enum': ['pending', 'queued', 'succeeded', 'failed', 'skipped']}, 'job_id': nullable(R('Id')), 'error_code': nullable(STR), 'cost_micro_usd': INT0})}}),
}
OPS = [
    ('list_candidate_observations', 'get', '/candidates/{candidate_id}/observations', 'cast.read', 'candidate_id', None, 'CandidateObservations',
     'List appearance observations for a candidate',
     'Per authorised photo or video frame: neutral visible-appearance suggestions (model), confirmed values and human overrides, each with source media, frame time, '
     'confidence and evidence. Ambiguous or multi-person media is flagged and never merged into one person. Also returns supplied information with its real source '
     '(archive import, transcript or manual); stated age is supplied information, separate from playing-age suggestions. Search uses confirmed and overridden values only.',
     {'readOnlyHint': True, 'destructiveHint': False, 'idempotentHint': True, 'openWorldHint': False}, 'listCandidateObservations'),
    ('review_candidate_observation', 'post', '/candidate-observations/{observation_id}/review', 'cast.review', 'observation_id', 'ObservationReview', 'AppearanceObservation',
     'Confirm, reject, override or reset one appearance suggestion',
     'Confirm a visible-appearance suggestion, reject it, override it with a value from the closed vocabulary, or reset it to a suggestion. Repeating the same decision is '
     'idempotent; a different decision on a stale row_version returns 409. On ambiguous media, confirming selects that person as the candidate; another person on the same '
     'media then conflicts. Reanalysis never changes confirmed, rejected or overridden rows.',
     {'readOnlyHint': False, 'destructiveHint': False, 'idempotentHint': True, 'openWorldHint': False}, 'reviewCandidateObservation'),
    ('start_enrichment_batch', 'post', '/enrichment-batches', 'cast.write', None, 'EnrichmentBatchStart', 'EnrichmentBatch',
     'Start a bounded appearance-suggestion batch',
     'Queue appearance analysis for listed candidates or for candidates matching facet filters, with an item limit and a spend cap in cents (stops when usage reaches it). '
     'Uses only existing authorised photos and frames; results are suggestions awaiting review. The same Idempotency-Key and body returns the same batch.',
     {'readOnlyHint': False, 'destructiveHint': False, 'idempotentHint': True, 'openWorldHint': True}, 'startEnrichmentBatch'),
    ('get_enrichment_batch', 'get', '/enrichment-batches/{batch_id}', 'cast.read', 'batch_id', None, 'EnrichmentBatch',
     'Read an enrichment batch', 'Progress, per-item status and recorded token usage/spend of a batch you started (or any batch with operations.read).',
     {'readOnlyHint': True, 'destructiveHint': False, 'idempotentHint': True, 'openWorldHint': False}, 'getEnrichmentBatch'),
    ('get_candidate_facets', 'post', '/candidate-facets/query', 'cast.read', None, 'FacetFilters', 'CandidateFacets',
     'Count Cast Library facet values for filters',
     'Counts distinct active people per facet value (OR within a facet, AND across facets; each facet counted with the other filters applied) plus an explicit unknown '
     'count. Sources: confirmed or overridden observations, attributed archive labels and supplied facts; unreviewed suggestions are never counted. Optional q matches '
     'normalised English/Arabic names, casting ID and tags. Read-only.',
     {'readOnlyHint': True, 'destructiveHint': False, 'idempotentHint': True, 'openWorldHint': False}, 'getCandidateFacets'),
]
SOURCES = {'domain_source': 'packages/central/src/appearance.ts', 'http_source': 'apps/web/lib/appearance-http.ts'}
UI = ['apps/web/components/candidate/AppearanceObservations.tsx', 'apps/web/components/library/LibraryFacetFilters.tsx']

# OpenAPI ---------------------------------------------------------------------------------------------------------------
path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
schemas = api['components']['schemas']
schemas.update(copy.deepcopy(SCHEMAS))
kind = schemas['Job']['properties']['kind']['enum']
if 'candidate_appearance' not in kind:
    kind.append('candidate_appearance')
template_post = api['paths']['/candidates/{candidate_id}/duplicates/resolve']['post']
template_get = api['paths']['/candidates/{candidate_id}/photos']['get']
for name, method, route, capability, param, body, data, summary, description, _annotations, _symbol in OPS:
    base = copy.deepcopy(template_post if method == 'post' else template_get)
    base.update({'operationId': name, 'summary': summary, 'description': description, 'tags': ['candidates'], 'x-capability': capability, 'x-mcp-exposed': True,
                 'x-shared-service-operation': name})
    parameters = [{'name': param, 'in': 'path', 'required': True, 'schema': R('Id')}] if param else []
    if method == 'post' and name != 'get_candidate_facets':
        parameters.append({'$ref': '#/components/parameters/IdempotencyKey'})
    base['parameters'] = parameters
    if body:
        base['requestBody'] = {'required': True, 'content': {'application/json': {'schema': R(body)}}}
    else:
        base.pop('requestBody', None)
    success = obj({'request_id': STR, 'data': R(data), 'warnings': {'type': 'array', 'items': R('Warning')}}, ['request_id', 'data'])
    base['responses'] = {'200': {'description': 'Successful operation', 'content': {'application/json': {'schema': success}}},
                         **{k: v for k, v in template_post['responses'].items() if k != '200'}}
    api['paths'].setdefault(route, {})[method] = base
write_source(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))

# MCP catalog -------------------------------------------------------------------------------------------------------------
def closure(names):
    seen, todo = set(), list(names)
    while todo:
        current = todo.pop()
        if current in seen:
            continue
        seen.add(current)
        todo.extend(refs(schemas[current]))
    return {n: converted(copy.deepcopy(schemas[n])) for n in sorted(seen)}

path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
for tool in catalog['tools']:
    for side in ('inputSchema', 'outputSchema'):
        job = tool[side].get('$defs', {}).get('Job')
        if job and 'candidate_appearance' not in job['properties']['kind']['enum']:
            job['properties']['kind']['enum'].append('candidate_appearance')
names = {op[0] for op in OPS}
catalog['tools'] = [t for t in catalog['tools'] if t['name'] not in names]
for name, method, route, capability, param, body, data, summary, description, annotations, _symbol in OPS:
    properties, required = {}, []
    if param:
        properties[param] = R('Id'); required.append(param)
    if method == 'post' and name != 'get_candidate_facets':
        properties['idempotency_key'] = {'type': 'string', 'minLength': 16, 'maxLength': 200}; required.append('idempotency_key')
    if body:
        properties['body'] = R(body); required.append('body')
    input_schema = converted({'type': 'object', 'additionalProperties': False, 'properties': properties, 'required': required})
    input_schema['$defs'] = closure(refs({'p': properties}))
    output = obj({'request_id': STR, 'data': R(data), 'warnings': {'type': 'array', 'items': R('Warning')}}, ['request_id', 'data'])
    output_schema = converted(output); output_schema['$defs'] = closure(refs(output))
    catalog['tools'].append({'name': name, 'description': description, 'operationId': name, 'http': {'method': method.upper(), 'path': route}, 'capability': capability,
                             'inputSchema': input_schema, 'outputSchema': output_schema, 'annotations': annotations})
write_source(path, json.dumps(catalog, indent=2) + '\n')

# Parity inventory ------------------------------------------------------------------------------------------------------
path = ROOT / 'contracts/operation-parity.json'
parity = json.loads(path.read_text(encoding='utf-8'))
parity['groups'] = [g for g in parity['groups'] if g['id'] != 'appearance']
parity['groups'].append({'id': 'appearance', 'label': 'Appearance observations, enrichment batches and Library facets', 'ui_sources': UI,
                         'operations': [{'operation': op[0], 'domain_symbol': op[10], **SOURCES} for op in OPS]})
write_source(path, json.dumps(parity, indent=2) + '\n')

# Parity checker counts ---------------------------------------------------------------------------------------------------
path = ROOT / 'tools/check_m07_parity.py'
text = path.read_text(encoding='utf-8')
count = len(catalog['tools'])
text = re.sub(r'len\(runtime\) == len\(tools\) == \d+, \'Runtime/catalog must contain\d+ implemented user tools.\'',
              f"len(runtime) == len(tools) == {count}, 'Runtime/catalog must contain{count} implemented user tools.'", text)
text = re.sub(r"len\(\{row\['operation'\] for row in rows\}\) == \d+,", f"len({{row['operation'] for row in rows}}) == {count},", text)
path.write_text(text, encoding='utf-8', newline='\n')
print(json.dumps({'tools': count, 'operations': len(api['paths']), 'added': sorted(names)}))

# Worker images carry only sealed sources (no contracts/appearance-taxonomy.json), so the taxonomy is also emitted as a
# TypeScript module; tests/domain/appearance.test.ts checks it equals the JSON contract.
path = ROOT / 'packages/domain/src/appearance-taxonomy.ts'
path.write_text('// Generated by tools/update_cycle7_a4_contracts.py from contracts/appearance-taxonomy.json. Do not edit.\n'
                'export const APPEARANCE_TAXONOMY_SOURCE = ' + json.dumps(TAXONOMY, ensure_ascii=False, indent=1) + ' as const;\n',
                encoding='utf-8', newline='\n')

# search_candidates (A1) gains facet filtering: `facets` is a JSON object string {facet: [values]} (query parameters and
# MCP arguments are flat), `facet_include_unknown` a boolean. Applied to OpenAPI and the MCP catalog idempotently.
FACETS_PARAM = {'name': 'facets', 'in': 'query', 'schema': {'type': 'string', 'maxLength': 4000},
                'description': 'JSON object {facet: [values]} using get_candidate_facets keys. OR within a facet, AND across facets; appearance facets use '
                               'confirmed and corrected observations only. Result counts equal get_candidate_facets totals for the same filters.'}
UNKNOWN_PARAM = {'name': 'facet_include_unknown', 'in': 'query', 'schema': {'type': 'boolean', 'default': False},
                 'description': 'Also include people with no value for an active facet filter.'}
path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
parameters = api['paths']['/candidates']['get']['parameters']
parameters[:] = [p for p in parameters if p.get('name') not in ('facets', 'facet_include_unknown')]
at = next(i for i, p in enumerate(parameters) if p.get('name') == 'cursor')
parameters[at:at] = [copy.deepcopy(FACETS_PARAM), copy.deepcopy(UNKNOWN_PARAM)]
write_source(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))
path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
tool = next(t for t in catalog['tools'] if t['name'] == 'search_candidates')
props = {k: v for k, v in tool['inputSchema']['properties'].items() if k not in ('facets', 'facet_include_unknown')}
ordered = {}
for key, value in props.items():
    if key == 'cursor':
        ordered['facets'] = {'type': 'string', 'maxLength': 4000, 'description': FACETS_PARAM['description']}
        ordered['facet_include_unknown'] = {'type': 'boolean', 'default': False}
    ordered[key] = value
tool['inputSchema']['properties'] = ordered
write_source(path, json.dumps(catalog, indent=2) + '\n')
