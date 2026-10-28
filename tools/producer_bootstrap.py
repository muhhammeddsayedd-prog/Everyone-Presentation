"""Bounded, one-time owner-requested canonical setup; never creates Auth users.

Use prepare | inspect | records | grants. The private request supplies the email
and requested labels. Stable resource IDs and pending phases survive a lost CLI
response. Only a previously prepared pending action can recover an existing pair.
Normal project/client/workspace edits continue through the application RPCs.
"""
import contextlib
import datetime
import hashlib
import json
import os
import re
import sys
import uuid

from release_foundation import ROOT, TARGET, call
from provision_logo_verifier import WindowsPrivateFiles, ProvisionBlocked, require, safe_path, strict_json

PRIVATE = ROOT / '.local/m01-enrollment'
INTENT = PRIVATE / 'request.json'
STATE = PRIVATE / 'state.json'
EVIDENCE = ROOT / 'tracking/evidence/m01/producer-bootstrap'
PROOF = ROOT / 'tracking/evidence/m01/producer-bootstrap-local.json'
SQL_HASHES = {
    'inspect': '40211c94d836bf9dfc9234b0c936c5fd3712e016b94b481bfacf57f3545cab6f',
    'records': '53104c72a358082bf4745cbb5e6cb87dacc2a6f8bd3229826915d292dc85e610',
    'grants': '6ae3ef321c1103b2f19473fe377a5e9fcaee753535b9c09fa05231624263daff',
}
CAPABILITIES = ['projects.read', 'projects.write', 'workspaces.read', 'workspaces.write']
INSPECTION_FIELDS = {'request_id', 'client_id', 'project_id', 'resource_state', 'client_name_collisions', 'project_name_collisions',
                     'principal_match_count', 'principal_id', 'principal_confirmed', 'signed_in', 'nonanonymous', 'nondeleted',
                     'nonbanned', 'pinned_principal_matches', 'capabilities', 'project_membership', 'client_membership'}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def encode(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')


def validate_request(value):
    fields = {'schema_version', 'request_id', 'client_id', 'project_id', 'principal_id', 'producer_email', 'client_name', 'project_name'}
    require(isinstance(value, dict) and set(value) == fields and value['schema_version'] == '1.0', 'Private setup request has invalid fields.')
    for field in ('request_id', 'client_id', 'project_id'):
        require(str(uuid.UUID(value[field])) == value[field], 'Private setup resource identifier is invalid.')
    require(len({value[k] for k in ('request_id', 'client_id', 'project_id')}) == 3, 'Private setup identifiers must be distinct.')
    if value['principal_id'] is not None:
        require(str(uuid.UUID(value['principal_id'])) == value['principal_id'], 'Pinned account identifier is invalid.')
    require(isinstance(value['producer_email'], str) and re.fullmatch(r'[^\s@\x00-\x1f]{1,64}@[^\s@\x00-\x1f]{1,189}', value['producer_email']) is not None
            and value['producer_email'] == value['producer_email'].strip().lower(), 'Private Producer email is invalid.')
    for field in ('client_name', 'project_name'):
        text = value[field]
        require(isinstance(text, str) and 1 <= len(text) <= 200 and text == text.strip()
                and not any(ord(c) < 32 or ord(c) == 127 for c in text), 'Requested resource label is invalid.')
    require(len(encode(value)) <= 2048, 'Private setup request exceeds its bound.')
    return value


def validate_state(value):
    require(isinstance(value, dict) and set(value) == {'version', 'target', 'request', 'request_sha256', 'phase', 'principal_id', 'created_at', 'updated_at'}, 'Private setup state has invalid fields.')
    require(value['version'] == 1 and value['target'] == TARGET and value['phase'] in ('prepared', 'records_pending', 'records_ready', 'grants_pending', 'completed'), 'Private setup phase or target is invalid.')
    request = validate_request(value['request'])
    require(request['principal_id'] is None and digest(encode(request)) == value['request_sha256'], 'Private setup request binding changed.')
    principal = value['principal_id']
    require(principal is None or str(uuid.UUID(principal)) == principal, 'Private pinned account is invalid.')
    require((value['phase'] in ('grants_pending', 'completed')) == (principal is not None), 'Private pinned account and phase disagree.')
    return value


@contextlib.contextmanager
def exclusive_state(security):
    """Lock existing state with a Win32 handle that denies sharing and deletion."""
    import msvcrt
    from ctypes import wintypes
    safe_path(STATE)
    handle = security.kernel.CreateFileW(str(STATE), 0xC0000000, 0, None, 3, 0x80, None)
    require(handle != wintypes.HANDLE(-1).value, 'Private setup is locked, missing or inaccessible; no database action attempted.')
    try:
        security.verify_handle(handle)
        descriptor = msvcrt.open_osfhandle(handle, os.O_RDWR | os.O_BINARY)
        handle = None
        with os.fdopen(descriptor, 'r+b') as stream:
            yield stream
    finally:
        if handle is not None:
            security.kernel.CloseHandle(handle)


def save_state(stream, value, security):
    validate_state(value)
    security.verify_open(stream)
    stream.seek(0)
    stream.write(encode(value) + b'\n')
    stream.truncate()
    stream.flush()
    os.fsync(stream.fileno())
    security.verify_open(stream)


def prerequisites():
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'Linked target differs from the owner-selected canonical system.')
    require(set(SQL_HASHES) == {'inspect', 'records', 'grants'}, 'Setup SQL is not yet sealed for execution.')
    for action, expected in SQL_HASHES.items():
        path = ROOT / f'tools/sql/producer-bootstrap-{action}.sql'
        require(digest(path.read_bytes()) == expected, 'A reviewed setup SQL file changed; review and rerun local proof.')
    proof = strict_json(PROOF.read_bytes(), 65536)
    require(proof.get('result') == 'passed' and proof.get('sql_hashes') == SQL_HASHES and proof.get('rolled_back') is True
            and proof.get('cleanup_confirmed') is True, 'Exact successful local rollback and cleanup proof is required.')


def query(action, request, security):
    validate_request(request)
    template_bytes = (ROOT / f'tools/sql/producer-bootstrap-{action}.sql').read_bytes()
    require(digest(template_bytes) == SQL_HASHES[action], 'Fixed SQL changed during setup; no action will be dispatched.')
    template = template_bytes.decode('utf-8')
    token = '__EPS_BOOTSTRAP_REQUEST_HEX__'
    require(template.count(token) == 1, 'Fixed SQL template has invalid request transport.')
    # Hex is quote-free transport, not SQL interpolation of user text. The fixed
    # SQL decodes a bounded JSON envelope and uses typed variables in static DML.
    sql = template.replace(token, encode(request).hex())
    file = PRIVATE / (str(uuid.uuid4()) + '-' + action + '.sql')
    with security.create(file) as stream:
        stream.write(sql.encode('utf-8')); stream.flush(); os.fsync(stream.fileno())
    try:
        result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(file), '--output-format', 'json'])
        require(result.returncode == 0, 'Fixed setup operation failed; private input and raw diagnostics are suppressed. Inspect before retrying.')
        payload = json.loads(result.stdout)
        require(len(payload['rows']) == 1 and set(payload['rows'][0]) == {'bootstrap'}, 'Fixed setup response was invalid; inspect before retrying.')
        value = payload['rows'][0]['bootstrap']
        fields = INSPECTION_FIELDS if action == 'inspect' else {'request_id', 'client_id', 'project_id', 'result', 'workspace_created'}
        if action == 'grants':
            fields |= {'principal_id', 'capabilities'}
        require(isinstance(value, dict) and set(value) == fields, 'Fixed setup response fields were invalid; raw content is suppressed.')
        if action == 'inspect':
            require(isinstance(value['capabilities'], dict) and set(value['capabilities']) == set(CAPABILITIES)
                    and all(v in ('absent', 'active', 'inactive') for v in value['capabilities'].values()), 'Fixed setup capability response was invalid.')
            require(value['project_membership'] in ('absent', 'write', 'readonly', 'inactive')
                    and value['client_membership'] in ('absent', 'write', 'readonly', 'inactive')
                    and value['resource_state'] in ('absent', 'complete_pair', 'partial_or_mismatch'), 'Fixed setup scope response was invalid.')
            for key in ('client_name_collisions', 'project_name_collisions', 'principal_match_count'):
                require(type(value[key]) is int and value[key] >= 0, 'Fixed setup count response was invalid.')
            for key in ('principal_confirmed', 'signed_in', 'nonanonymous', 'nondeleted', 'nonbanned', 'pinned_principal_matches'):
                require(value[key] is None or type(value[key]) is bool, 'Fixed setup identity flags were invalid.')
            for key in ('request_id', 'client_id', 'project_id', 'principal_id'):
                require(value[key] is None and key == 'principal_id' or str(uuid.UUID(value[key])) == value[key], 'Fixed setup identifier response was invalid.')
        return value
    except ProvisionBlocked:
        raise
    except Exception:
        raise ProvisionBlocked('Setup database outcome could not be confirmed. Preserve private state and use inspect/retry; never regenerate resource IDs.') from None


def require_identity(state, observed):
    require(observed.get('principal_match_count') == 1 and all(observed.get(key) is True for key in
            ('principal_confirmed', 'signed_in', 'nonanonymous', 'nondeleted', 'nonbanned')), 'The requested Producer must complete a verified email sign-in before access can be granted.')
    principal = observed.get('principal_id')
    require(isinstance(principal, str) and str(uuid.UUID(principal)) == principal, 'Verified account lookup did not return one bounded identity.')
    require(state['principal_id'] in (None, principal), 'The previously pinned account changed; preserve state for review.')
    return principal


def require_fresh_records(state, observed):
    resource = observed.get('resource_state')
    require(resource in ('absent', 'complete_pair'), 'A partial or mismatched canonical pair exists; preserve it for review.')
    if state['phase'] == 'prepared':
        require(resource == 'absent' and observed.get('client_name_collisions') == 0 and observed.get('project_name_collisions') == 0,
                'Existing IDs or labels conflict with the fresh owner request; no resource will be adopted or overwritten.')
    else:
        require(resource == 'complete_pair', 'A pending or confirmed canonical pair is missing; preserve state for reconciliation without recreating records.')
    return resource


def mutation_allowed(action, phase, initial_phase):
    # A pending phase loaded from disk has an ambiguous prior DB outcome. It can
    # only confirm current state, never replay writes after an intervening revoke.
    return (action == 'records' and phase == 'records_pending' and initial_phase == 'prepared') or (
        action == 'grants' and phase == 'grants_pending' and initial_phase == 'records_ready')


def require_grants(state, observed):
    require(require_identity(state, observed) == state['principal_id'] and observed.get('resource_state') == 'complete_pair'
            and observed.get('project_membership') == 'write' and observed.get('client_membership') == 'write'
            and observed.get('capabilities') == {c: 'active' for c in CAPABILITIES},
            'Previously granted Producer access is missing or changed; preserve current permissions for reconciliation.')


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    require(action in ('prepare', 'inspect', 'records', 'grants'), 'Use prepare, inspect, records or grants; no target or input overrides are accepted.')
    prerequisites()
    security = WindowsPrivateFiles()
    safe_path(PRIVATE); safe_path(INTENT); safe_path(STATE)
    PRIVATE.mkdir(parents=True, exist_ok=True)
    receipt = {'observed_at': now(), 'target': TARGET, 'action': action, 'result': 'failed', 'auth_users_written': False,
               'workspace_created': False, 'private_input_recorded': False, 'raw_diagnostics_recorded': False}
    try:
        if action == 'prepare':
            intent = strict_json(INTENT.read_bytes(), 2048)
            require(set(intent) == {'producer_email', 'client_name', 'project_name'}, 'Private owner intent has unexpected fields.')
            request = validate_request(dict(intent, schema_version='1.0', request_id=str(uuid.uuid4()), client_id=str(uuid.uuid4()), project_id=str(uuid.uuid4()), principal_id=None))
            value = {'version': 1, 'target': TARGET, 'request': request, 'request_sha256': digest(encode(request)), 'phase': 'prepared',
                     'principal_id': None, 'created_at': now(), 'updated_at': now()}
            with security.create(STATE) as stream:
                save_state(stream, value, security)
            receipt.update(result='passed', phase='prepared', request_id=request['request_id'], client_id=request['client_id'], project_id=request['project_id'])
        else:
            with exclusive_state(security) as stream:
                state = validate_state(strict_json(stream.read(8193), 8192))
                initial_phase = state['phase']
                request = dict(state['request'], principal_id=state['principal_id'])
                observed = query('inspect', request, security)
                require(observed.get('request_id') == request['request_id'] and observed.get('client_id') == request['client_id'] and observed.get('project_id') == request['project_id'], 'Setup readback did not match the private resource binding.')
                if action == 'inspect':
                    receipt.update(result='passed', phase=state['phase'], inspection=observed)
                else:
                    resource = require_fresh_records(state, observed)
                    if action == 'records':
                        require(state['phase'] in ('prepared', 'records_pending', 'records_ready', 'grants_pending', 'completed'), 'Private records phase is invalid.')
                        if state['phase'] == 'prepared':
                            state.update(phase='records_pending', updated_at=now()); save_state(stream, state, security)
                        if mutation_allowed('records', state['phase'], initial_phase):
                            outcome = query('records', request, security)
                            require(outcome.get('result') in ('created', 'existing_pair') and all(outcome.get(k) == request[k] for k in ('request_id', 'client_id', 'project_id')) and outcome.get('workspace_created') is False,
                                    'Canonical records outcome was invalid; preserve pending state for recovery.')
                        else:
                            # Once confirmed, even a concurrent delete must never
                            # turn an operational replay into record recreation.
                            outcome = dict({k: request[k] for k in ('request_id', 'client_id', 'project_id')}, result='confirmed_existing_pair', workspace_created=False)
                        if state['phase'] == 'records_pending':
                            state.update(phase='records_ready', updated_at=now()); save_state(stream, state, security)
                    else:
                        require(resource == 'complete_pair' and state['phase'] in ('records_ready', 'grants_pending', 'completed'), 'Create and confirm the owner-requested canonical pair before granting access.')
                        principal = require_identity(state, observed)
                        if state['phase'] == 'records_ready':
                            state.update(phase='grants_pending', principal_id=principal, updated_at=now()); save_state(stream, state, security)
                        request['principal_id'] = principal
                        if mutation_allowed('grants', state['phase'], initial_phase):
                            outcome = query('grants', request, security)
                            require(outcome.get('result') in ('granted', 'already_granted') and outcome.get('capabilities') == CAPABILITIES
                                    and all(outcome.get(k) == request[k] for k in ('request_id', 'principal_id', 'client_id', 'project_id')) and outcome.get('workspace_created') is False,
                                    'Producer grant outcome was invalid; preserve pending state for recovery.')
                        else:
                            require_grants(state, observed)
                            outcome = dict({k: request[k] for k in ('request_id', 'principal_id', 'client_id', 'project_id')},
                                           capabilities=CAPABILITIES, result='confirmed_existing_grants', workspace_created=False)
                        state.update(phase='completed', updated_at=now()); save_state(stream, state, security)
                    after = query('inspect', request, security)
                    require(after.get('resource_state') == 'complete_pair', 'Canonical pair could not be confirmed after operation; use inspect before retrying.')
                    if action == 'grants':
                        require_grants(state, after)
                    receipt.update(result='passed', phase=state['phase'], outcome=outcome, inspection=after)
    except ProvisionBlocked as error:
        receipt['reason'] = str(error)
    except Exception:
        receipt['reason'] = 'Private setup prerequisites or database outcome could not be confirmed; preserve state and inspect. Raw diagnostics are suppressed.'
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    file = EVIDENCE / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + action + '.json')
    with file.open('x', encoding='utf-8') as stream:
        stream.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))
    return 0 if receipt['result'] == 'passed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except ProvisionBlocked as error:
        print(json.dumps({'result': 'blocked', 'reason': str(error), 'raw_diagnostics_recorded': False}))
        sys.exit(1)
    except Exception:
        print(json.dumps({'result': 'blocked', 'reason': 'Private setup prerequisites failed; no raw input or diagnostics recorded.'}))
        sys.exit(1)
