"""Cycle 7 A1 follow-up (m16): server-recorded upload outcomes. Source generation only; idempotent.

  Job.candidate_result   + candidate_outcome, membership_outcome
  CandidateUploadRow     + candidate_outcome, membership_outcome

candidate_outcome:  created | tape_added | tape_rescanned   (null = unknown: a job finished before outcomes were recorded,
                                                             or, on an upload row, the job has not succeeded)
membership_outcome: added | already_member | not_requested  (same null rule)

Run with an interpreter that has PyYAML, then: python tools/generate_runtime_contracts.py && python tools/check_m07_parity.py
"""
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
REF = '#/components/schemas/'


def write_bytes(path, text):
    """Keep each tracked contract's established byte newline convention."""
    previous = path.read_bytes()
    ending = b'\r\n' if b'\r\n' in previous else b'\n'
    raw = text.replace('\r\n', '\n').encode('utf-8')
    path.write_bytes(raw.replace(b'\n', ending))


def converted(value):
    if isinstance(value, dict):
        return {k: v.replace(REF, '#/$defs/') if k == '$ref' else converted(v) for k, v in value.items()}
    if isinstance(value, list):
        return [converted(v) for v in value]
    return value


CANDIDATE = {'anyOf': [{'type': 'string', 'enum': ['created', 'tape_added', 'tape_rescanned']}, {'type': 'null'}],
             'description': 'What processing did, recorded by the save step: created a new person, added a tape to the existing person, '
                            'or re-scanned a stored tape. null = unknown (finished before outcomes were recorded, or not finished).'}
MEMBERSHIP = {'anyOf': [{'type': 'string', 'enum': ['added', 'already_member', 'not_requested']}, {'type': 'null'}],
              'description': 'Project membership outcome recorded by the save step: processing added the person to this project, the person was '
                             'already in it, or no membership was requested (re-scan). null = unknown. Current membership is read from the project list.'}

path = ROOT / 'contracts/openapi.yaml'
api = yaml.safe_load(path.read_text(encoding='utf-8'))
schemas = api['components']['schemas']

result = schemas['Job']['properties']['candidate_result']
result['properties'].update({'candidate_outcome': CANDIDATE, 'membership_outcome': MEMBERSHIP})
result['required'] = [k for k in result['required'] if k not in ('candidate_outcome', 'membership_outcome')] + ['candidate_outcome', 'membership_outcome']
result['description'] = ('Present on a succeeded candidate_scan: the person and the project row the upload produced (workspace_candidate_id is null '
                         'for a re-scan) and the recorded outcomes (null for jobs finished before outcomes were recorded).')

row = schemas['CandidateUploadRow']
row['properties'].update({'candidate_outcome': CANDIDATE, 'membership_outcome': MEMBERSHIP})
row['required'] = [k for k in row['required'] if k not in ('candidate_outcome', 'membership_outcome')] + ['candidate_outcome', 'membership_outcome']
write_bytes(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))


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


# MCP catalog: tools embedding Job or CandidateUploadRow follow the current OpenAPI definitions.
path = ROOT / 'contracts/mcp-tool-catalog.json'
catalog = json.loads(path.read_text(encoding='utf-8'))
changed = {'Job', 'CandidateUploadRow'}
for tool in catalog['tools']:
    for side in ['inputSchema', 'outputSchema']:
        if changed & set(tool[side].get('$defs', {})):
            tool[side]['$defs'] = closure({k: v for k, v in tool[side].items() if k != '$defs'})
write_bytes(path, json.dumps(catalog, indent=2, ensure_ascii=False) + '\n')
