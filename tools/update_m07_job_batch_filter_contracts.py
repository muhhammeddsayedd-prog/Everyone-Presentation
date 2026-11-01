"""Extend batch input and align job-read gates; generation never dispatches SQL."""
import copy
import json
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parents[1]
UUID = {'type': 'string', 'format': 'uuid', 'pattern': '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'}
DESCRIPTION = 'Optional batch grouping filter. Existing ordinary-job project checks and requester-only Cast Library frame visibility still apply; a batch UUID grants no access. Page and ascending job-ID cursor semantics are unchanged.'
JOB_READ_CAPABILITY = 'operations.read OR owning workspace read OR own frame read'

def write_source(path, text):
    previous = path.read_bytes()
    ending = b'\r\n' if b'\r\n' in previous else b'\n'
    if ending == b'\r\n':
        assert previous.count(b'\n') == previous.count(b'\r\n'), 'Mixed source newlines require explicit reconciliation.'
    path.write_bytes(text.replace('\r\n', '\n').encode().replace(b'\n', ending))

def main():
    path = ROOT / 'contracts/openapi.yaml'
    api = yaml.safe_load(path.read_text(encoding='utf8'))
    operation = api['paths']['/jobs']['get']
    assert operation['operationId'] == 'list_jobs'
    parameters = operation['parameters']
    parameters[:] = [p for p in parameters if p.get('name') != 'batch_id']
    parameters.append({'name': 'batch_id', 'in': 'query', 'required': False, 'description': DESCRIPTION, 'schema': copy.deepcopy(UUID)})
    for route in ['/jobs', '/jobs/{job_id}']:
        operation = api['paths'][route]['get']
        assert operation['x-capability'] in ['operations.read OR owning workspace read', JOB_READ_CAPABILITY]
        operation['x-capability'] = JOB_READ_CAPABILITY
    write_source(path, yaml.safe_dump(api, sort_keys=False, allow_unicode=True, width=140))
    path = ROOT / 'contracts/mcp-tool-catalog.json'
    catalog = json.loads(path.read_bytes())
    tool = next(t for t in catalog['tools'] if t['name'] == 'list_jobs')
    tool['inputSchema']['properties']['batch_id'] = {**copy.deepcopy(UUID), 'description': DESCRIPTION}
    for tool in catalog['tools']:
        if tool['name'] in ['list_jobs', 'get_job']:
            assert tool['capability'] in ['operations.read OR owning workspace read', JOB_READ_CAPABILITY]
            tool['capability'] = JOB_READ_CAPABILITY
    write_source(path, json.dumps(catalog, indent=2) + '\n')
    path = ROOT / 'docs/integrations/OPERATION_INDEX.md'
    index = path.read_text(encoding='utf8')
    for operation, route in [('list_jobs', '/jobs'), ('get_job', '/jobs/{job_id}')]:
        before = f'| `{operation}` | `GET {route}` | operations.read OR owning workspace read | Yes |'
        after = f'| `{operation}` | `GET {route}` | {JOB_READ_CAPABILITY} | Yes |'
        assert index.count(before) == 1 or index.count(after) == 1
        index = index.replace(before, after)
    write_source(path, index)

if __name__ == '__main__':
    main()
