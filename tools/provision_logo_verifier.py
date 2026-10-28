"""Fixed inspect/provision tool; preparation does not generate or execute a key.

Provisioning uses only fixed SQL. PostgreSQL creates the 32-byte secret; CLI
stdout/stderr stay in captured process memory and are NEVER written to diagnostics,
receipts, command arguments or recovery metadata. No key/public RPC is created.
The existing apps/web/.env.local is NEVER written. A dedicated ignored verifier.json
is created exclusively and loaded into the next dev child process only after a
completed phase. This avoids shared-env replacement and concurrent lost updates.

Recovery boundary: the DB transaction and private file write cannot be atomic.
A protected secret-free phase record is durable before the DB request. Any failure
after that request blocks further provisioning. An administrator must inspect and
recover the fixed existing key through a separately reviewed private procedure;
this tool never regenerates, overwrites, deletes or retrieves an existing secret.
The inspect action can still compare the environment's existing secret internally.

Windows files are created with a protected current-user + SYSTEM DACL from the
first CreateFileW call, before any content is written; the DACL is verified again.
Sources: https://learn.microsoft.com/en-us/windows/win32/fileio/file-security-and-access-rights
https://learn.microsoft.com/en-us/windows/win32/secauthz/security-descriptors-for-new-objects
"""
import base64
import ctypes
from ctypes import wintypes
import datetime
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import stat
import sys
import uuid

from release_foundation import ROOT, TARGET, call
from release_logo import MIGRATIONS, validate_readback, verified_inputs

KEY_ID = 'eps-logo-dev-20261028-v1'
EXPECTED_URL = 'https://pyibofyctwnqpvktepse.supabase.co'
CLOUD_PROOF = 'tracking/evidence/cloud-logo-foundation/2026-10-28T03-32-17-619834Z-6a35754c-apply.json'
CLOUD_PROOF_HASH = '5225cebeaefddf79e7abf5b780812d5e3a6c4d030ef6359f4da95d3b18617e56'
INSPECT_SQL = 'tools/sql/inspect-logo-verifier.sql'
PROVISION_SQL = 'tools/sql/provision-logo-verifier.sql'
SQL_HASHES = {
    INSPECT_SQL: '1233ce7c6e13c4b6d9a135067d73a5598f4d2c09540dea1b980a86540bb8e880',
    PROVISION_SQL: 'ad09f18f83fdc0c8f69f3a051d52f9758a8942681a44e4b53904cd8573f5f757',
}
ENV_FILE = ROOT / 'apps/web/.env.local'
STATE_FILE = ROOT / '.local/cloud-logo-provision/phase.json'
SECRET_FILE = ROOT / '.local/cloud-logo-provision/verifier.json'
EVIDENCE = ROOT / 'tracking/evidence/cloud-logo-verifier'
FIELDS = ('LOGO_VERIFICATION_KEY_ID', 'LOGO_VERIFICATION_KEY_BASE64URL', 'CENTRAL_LOGO_UPLOADS_ENABLED')
PHASE_FIELDS = {'version', 'target', 'key_id', 'phase', 'claim_id', 'secret_file', 'environment_sha256', 'tool_sha256', 'created_at', 'contains_secret', 'recovery', 'completed_at'}


class ProvisionBlocked(Exception):
    """Only fixed messages from this module may be shown to the operator."""


def require(condition, message):
    if not condition:
        raise ProvisionBlocked(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def safe_path(path):
    absolute = path.absolute()
    require(absolute.is_relative_to(ROOT), 'The fixed local path is outside this workspace.')
    for part in [absolute, *absolute.parents]:
        if part == ROOT.parent:
            break
        if part.exists() or part.is_symlink():
            flags = getattr(part.lstat(), 'st_file_attributes', 0)
            require(not part.is_symlink() and not flags & stat.FILE_ATTRIBUTE_REPARSE_POINT, 'A fixed local path contains a reparse point; preserve it for review.')
    require(absolute.resolve().is_relative_to(ROOT.resolve()), 'A fixed local path resolved outside the workspace.')


def env_document(data):
    require(len(data) <= 1_048_576 and b'\x00' not in data, 'The existing environment file is invalid or too large.')
    text = data.decode('utf-8-sig')
    lines = text.splitlines(keepends=True)
    fields = {}
    indices = {}
    for index, line in enumerate(lines):
        content = line.rstrip('\r\n')
        if not content.strip() or content.lstrip().startswith('#'):
            continue
        match = re.fullmatch(r'[ \t]*(?:export[ \t]+)?([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*(.*)', content)
        require(match is not None, 'The environment file has unsupported multiline or malformed assignments.')
        name, raw = match.groups()
        require(name not in indices, 'Duplicate environment fields must be reconciled before provisioning.')
        indices[name] = index
        if name in (*FIELDS, 'SUPABASE_URL'):
            if raw.startswith(('"', "'")):
                quote = raw[0]
                close = raw.find(quote, 1)
                require(close >= 1 and not raw[1:close].count('\\') and re.fullmatch(r'[ \t]*(?:#.*)?', raw[close + 1:]) is not None,
                        'A required environment field has unsupported quoting.')
                value = raw[1:close]
            else:
                value = re.split(r'[ \t]+#', raw, maxsplit=1)[0].strip()
            fields[name] = value
    require(fields.get('SUPABASE_URL') == EXPECTED_URL, 'SUPABASE_URL must exactly match the fixed canonical project.')
    require(fields.get('CENTRAL_LOGO_UPLOADS_ENABLED', 'false') == 'false', 'Logo runtime must remain disabled before provisioning.')
    require(fields.get('LOGO_VERIFICATION_KEY_ID', '') in ('', KEY_ID), 'An existing environment key identifier conflicts with this fixed provisioning operation.')
    return {'data': data, 'fields': fields}


def decode_secret(encoded):
    require(isinstance(encoded, str) and re.fullmatch(r'[A-Za-z0-9_-]{43}', encoded) is not None, 'Verifier key encoding is invalid.')
    secret = base64.urlsafe_b64decode(encoded + '=')
    require(len(secret) == 32 and base64.urlsafe_b64encode(secret).decode('ascii').rstrip('=') == encoded, 'Verifier key encoding is not canonical.')
    return secret


def strict_json(data, maximum):
    require(0 < len(data) <= maximum, 'A private provisioning file is empty or outside its allowed bounds.')
    def pairs(items):
        value = {}
        for name, entry in items:
            require(name not in value, 'A private provisioning file contains duplicate fields.')
            value[name] = entry
        return value
    try:
        return json.loads(data.decode('utf-8'), object_pairs_hook=pairs)
    except ProvisionBlocked:
        raise
    except Exception:
        raise ProvisionBlocked('A private provisioning file is incomplete or malformed; administrator recovery is required.') from None


def secret_document(data):
    value = strict_json(data, 512)
    require(isinstance(value, dict) and set(value) == {'LOGO_VERIFICATION_KEY_ID', 'LOGO_VERIFICATION_KEY_BASE64URL'}
            and value['LOGO_VERIFICATION_KEY_ID'] == KEY_ID, 'The private runtime verifier file has invalid scope or fields.')
    decode_secret(value['LOGO_VERIFICATION_KEY_BASE64URL'])
    return value


class WindowsPrivateFiles:
    """Win32 protected file creation; account names and SIDs are never serialized."""
    class Attributes(ctypes.Structure):
        _fields_ = [('length', wintypes.DWORD), ('descriptor', wintypes.LPVOID), ('inherit', wintypes.BOOL)]

    class Acl(ctypes.Structure):
        _fields_ = [('revision', wintypes.BYTE), ('reserved', wintypes.BYTE), ('size', wintypes.WORD), ('count', wintypes.WORD), ('reserved2', wintypes.WORD)]

    def __init__(self):
        require(os.name == 'nt', 'Verifier provisioning requires the reviewed Windows file-security implementation.')
        self.kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        self.security = ctypes.WinDLL('advapi32', use_last_error=True)
        self.kernel.GetCurrentProcess.restype = wintypes.HANDLE
        self.kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        self.kernel.LocalFree.argtypes = [wintypes.HLOCAL]
        self.security.OpenProcessToken.argtypes = [wintypes.HANDLE, wintypes.DWORD, ctypes.POINTER(wintypes.HANDLE)]
        self.security.GetTokenInformation.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD)]
        self.security.ConvertSidToStringSidW.argtypes = [wintypes.LPVOID, ctypes.POINTER(wintypes.LPWSTR)]
        self.security.ConvertStringSecurityDescriptorToSecurityDescriptorW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, ctypes.POINTER(wintypes.LPVOID), ctypes.POINTER(wintypes.DWORD)]
        self.security.GetSecurityInfo.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.DWORD, ctypes.POINTER(wintypes.LPVOID), wintypes.LPVOID, ctypes.POINTER(wintypes.LPVOID), wintypes.LPVOID, ctypes.POINTER(wintypes.LPVOID)]
        self.security.GetSecurityInfo.restype = wintypes.DWORD
        self.security.GetSecurityDescriptorControl.argtypes = [wintypes.LPVOID, ctypes.POINTER(wintypes.WORD), ctypes.POINTER(wintypes.DWORD)]
        self.security.GetAce.argtypes = [wintypes.LPVOID, wintypes.DWORD, ctypes.POINTER(wintypes.LPVOID)]
        self.kernel.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(self.Attributes), wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
        self.kernel.CreateFileW.restype = wintypes.HANDLE
        token = wintypes.HANDLE()
        require(self.security.OpenProcessToken(self.kernel.GetCurrentProcess(), 8, ctypes.byref(token)), 'Windows file owner identity could not be established.')
        try:
            needed = wintypes.DWORD()
            self.security.GetTokenInformation(token, 1, None, 0, ctypes.byref(needed))
            require(needed.value > 0, 'Windows owner token information is unavailable.')
            buffer = ctypes.create_string_buffer(needed.value)
            require(self.security.GetTokenInformation(token, 1, buffer, needed, ctypes.byref(needed)), 'Windows owner token information could not be read.')
            self.sid = self.sid_text(wintypes.LPVOID.from_buffer(buffer).value)
        finally:
            self.kernel.CloseHandle(token)

    def sid_text(self, pointer):
        result = wintypes.LPWSTR()
        require(self.security.ConvertSidToStringSidW(pointer, ctypes.byref(result)), 'Windows file security identity could not be verified.')
        try:
            return result.value
        finally:
            self.kernel.LocalFree(ctypes.cast(result, wintypes.HLOCAL))

    def verify_handle(self, handle):
        owner = wintypes.LPVOID(); acl = wintypes.LPVOID(); descriptor = wintypes.LPVOID()
        require(self.security.GetSecurityInfo(handle, 1, 5, ctypes.byref(owner), None, ctypes.byref(acl), None, ctypes.byref(descriptor)) == 0, 'Windows file ACL could not be inspected.')
        try:
            control = wintypes.WORD(); revision = wintypes.DWORD()
            require(self.security.GetSecurityDescriptorControl(descriptor, ctypes.byref(control), ctypes.byref(revision))
                    and control.value & 0x1000 and self.sid_text(owner) == self.sid and acl.value, 'Windows file owner or protected ACL is unsafe.')
            require(self.Acl.from_address(acl.value).count == 2, 'Windows file ACL must contain only the current owner and SYSTEM.')
            trustees = set()
            for index in range(2):
                ace = wintypes.LPVOID()
                require(self.security.GetAce(acl, index, ctypes.byref(ace)), 'Windows file ACL entry could not be inspected.')
                header = (ctypes.c_ubyte * 4).from_address(ace.value)
                mask = wintypes.DWORD.from_address(ace.value + 4).value
                require(header[0] == 0 and header[1] == 0 and mask == 0x1F01FF, 'Windows file ACL has an unexpected grant or inherited entry.')
                trustees.add(self.sid_text(ace.value + 8))
            require(trustees == {self.sid, 'S-1-5-18'}, 'Windows file ACL grants access to an unexpected identity.')
        finally:
            self.kernel.LocalFree(descriptor)

    def create(self, path):
        safe_path(path)
        descriptor = wintypes.LPVOID()
        text = 'O:' + self.sid + 'D:P(A;;FA;;;' + self.sid + ')(A;;FA;;;SY)'
        require(self.security.ConvertStringSecurityDescriptorToSecurityDescriptorW(text, 1, ctypes.byref(descriptor), None), 'Protected Windows ACL construction failed.')
        try:
            attributes = self.Attributes(ctypes.sizeof(self.Attributes), descriptor, False)
            handle = self.kernel.CreateFileW(str(path), 0xC0000000, 0, ctypes.byref(attributes), 1, 0x80, None)
            require(handle != wintypes.HANDLE(-1).value, 'Protected local file creation failed.')
        finally:
            self.kernel.LocalFree(descriptor)
        try:
            self.verify_handle(handle)
            import msvcrt
            descriptor_fd = msvcrt.open_osfhandle(handle, os.O_RDWR | os.O_BINARY)
            handle = None
            return os.fdopen(descriptor_fd, 'w+b')
        finally:
            if handle is not None:
                self.kernel.CloseHandle(handle)

    def verify(self, path):
        safe_path(path)
        handle = self.kernel.CreateFileW(str(path), 0x80000000, 1, None, 3, 0x80, None)
        require(handle != wintypes.HANDLE(-1).value, 'Protected local file could not be opened for verification.')
        try:
            self.verify_handle(handle)
        finally:
            self.kernel.CloseHandle(handle)

    def verify_open(self, handle):
        import msvcrt
        self.verify_handle(msvcrt.get_osfhandle(handle.fileno()))

    def write_phase(self, handle, phase, first=False):
        self.verify_open(handle)
        if not first:
            handle.seek(0)
            old = strict_json(handle.read(8193), 8192)
            require(old.get('claim_id') == phase['claim_id'] and old.get('target') == TARGET and old.get('key_id') == KEY_ID,
                    'The exclusive private provisioning claim changed; preserve it for review.')
        handle.seek(0)
        handle.write((json.dumps(phase, indent=2) + '\n').encode('utf-8'))
        handle.truncate(); handle.flush(); os.fsync(handle.fileno())
        self.verify_open(handle)


def fixed_query(relative, field):
    # stdout/stderr may contain the returned secret. Never log/save either stream,
    # including exception stdout from TimeoutExpired or malformed CLI JSON.
    try:
        require(relative in SQL_HASHES and digest((ROOT / relative).read_bytes()) == SQL_HASHES[relative], 'A fixed administrative SQL file changed; stop for review.')
        result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / relative), '--output-format', 'json'])
        require(result.returncode == 0, 'Fixed database operation failed; raw diagnostics are intentionally suppressed.')
        payload = json.loads(result.stdout)
        require(len(payload['rows']) == 1 and set(payload['rows'][0]) == {field}, 'Fixed database response was invalid; raw diagnostics are intentionally suppressed.')
        return payload['rows'][0][field]
    except ProvisionBlocked:
        raise
    except Exception:
        raise ProvisionBlocked('Fixed database operation could not be confirmed; raw diagnostics are intentionally suppressed.') from None


def prerequisites():
    inputs = verified_inputs()
    require(digest((ROOT / CLOUD_PROOF).read_bytes()) == CLOUD_PROOF_HASH, 'The exact successful fourth-migration cloud proof changed.')
    proof = json.loads((ROOT / CLOUD_PROOF).read_text(encoding='utf-8'))
    require(proof['target'] == TARGET and proof['result'] == 'passed' and proof['exit_code'] == 0
            and proof['application_verified_by_readback'] is True and proof['inputs']['migration_hashes'] == MIGRATIONS,
            'Successful exact cloud migration/readback proof is required.')
    validate_readback(proof['readback'])
    require(all(digest((ROOT / relative).read_bytes()) == expected for relative, expected in SQL_HASHES.items()), 'Fixed provisioning SQL bytes changed; stop for review.')
    require(all(inputs['source_hashes'].get(relative) == expected for relative, expected in proof['inputs']['source_hashes'].items()), 'Current release prerequisites differ from the proven cloud application.')
    safe_path(ENV_FILE); safe_path(STATE_FILE); safe_path(SECRET_FILE)
    require(ENV_FILE.is_file(), 'The existing ignored web environment file is required; it will not be invented.')
    return env_document(ENV_FILE.read_bytes())


def inspect_state(encoded=None):
    state = fixed_query(INSPECT_SQL, 'verifier')
    require(state['query_role'] == 'postgres' and state['database'] == 'postgres' and state['unrestricted_visibility'] is True
            and state['migrations'] == [name[:14] for name in MIGRATIONS] and state['uploads_disabled'] is True
            and state['random_source_present'] is True and type(state['key_count']) is int and state['key_count'] == len(state['keys']),
            'Fresh fixed-target verifier prerequisites failed.')
    configured = bool(encoded)
    matches = False
    if configured:
        secret = decode_secret(encoded)
        if state['key_count'] == 1:
            key = state['keys'][0]
            matches = key['key_id'] == KEY_ID and key['purpose'] == 'client_logo' and key['bytes'] == 32 and key['revoked'] is False and key['active'] is True and key['not_after'] is None
            matches = matches and hmac.compare_digest(hashlib.sha256(secret).hexdigest(), key['digest'])
    return state, configured, matches


def private_configuration(security):
    if not STATE_FILE.exists() and not SECRET_FILE.exists():
        return None
    require(STATE_FILE.is_file() and SECRET_FILE.is_file(), 'Private provisioning files are incomplete; administrator recovery is required.')
    security.verify(STATE_FILE); security.verify(SECRET_FILE)
    phase = strict_json(STATE_FILE.read_bytes(), 8192)
    require(isinstance(phase, dict) and set(phase) == PHASE_FIELDS and phase.get('version') == 1 and phase.get('target') == TARGET and phase.get('key_id') == KEY_ID
            and phase.get('phase') == 'completed' and phase.get('contains_secret') is False
            and phase.get('secret_file') == '.local/cloud-logo-provision/verifier.json'
            and isinstance(phase.get('claim_id'), str) and re.fullmatch(r'[a-f0-9-]{36}', phase['claim_id']) is not None,
            'Private provisioning is not completed and owned; administrator recovery is required.')
    return secret_document(SECRET_FILE.read_bytes())['LOGO_VERIFICATION_KEY_BASE64URL']


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    require(action in ('inspect', 'provision'), 'Use only inspect or provision for the fixed verifier key.')
    document = prerequisites()
    security = WindowsPrivateFiles()
    receipt = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'target': TARGET, 'action': action,
               'result': 'failed', 'runtime_secret_configured': False, 'key_matches_runtime_file': False, 'runtime_enabled': False,
               'configured_file': '.local/cloud-logo-provision/verifier.json', 'existing_environment_written': False,
               'database_upload_purposes_disabled': None, 'raw_diagnostics_recorded': False, 'secret_in_receipt': False,
               'limitations': 'Key configuration only; no runtime enablement, user enrollment or Storage HTTP acceptance.'}
    try:
        if action == 'inspect':
            encoded = private_configuration(security)
            state, configured, matches = inspect_state(encoded)
            receipt.update(result='passed', key_exists=state['key_count'] > 0, runtime_secret_configured=configured, key_matches_runtime_file=matches,
                           database_upload_purposes_disabled=True)
        else:
            require(not STATE_FILE.exists() and not SECRET_FILE.exists(), 'A private provisioning file already exists; use inspect and administrator recovery, never overwrite or adopt it.')
            require(not document['fields'].get('LOGO_VERIFICATION_KEY_ID') and not document['fields'].get('LOGO_VERIFICATION_KEY_BASE64URL'),
                    'Existing environment key fields conflict with dedicated runtime-file provisioning.')
            STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
            safe_path(STATE_FILE.parent)
            phase = {'version': 1, 'target': TARGET, 'key_id': KEY_ID, 'phase': 'prepared', 'claim_id': str(uuid.uuid4()),
                     'secret_file': '.local/cloud-logo-provision/verifier.json', 'environment_sha256': digest(document['data']),
                     'tool_sha256': digest(Path(__file__).read_bytes()), 'created_at': receipt['observed_at'], 'contains_secret': False,
                     'recovery': 'If a database request may have committed, a separately reviewed administrator procedure must recover the fixed existing key; no regeneration/deletion fallback.'}
            # CREATE_NEW is the actual claim, not the preceding existence check.
            # Both handles deny all sharing (including write/delete) until completion.
            with security.create(STATE_FILE) as phase_handle:
                security.write_phase(phase_handle, phase, first=True)
                with security.create(SECRET_FILE) as secret_handle:
                    require(ENV_FILE.read_bytes() == document['data'], 'The existing environment changed before provisioning; preserve the private phase for review.')
                    state, _, _ = inspect_state()
                    receipt['database_upload_purposes_disabled'] = True
                    require(state['key_count'] == 0, 'A database key already exists; administrator reconciliation is required, never regenerate/delete.')
                    phase['phase'] = 'database_request_pending'
                    security.write_phase(phase_handle, phase)
                    result = fixed_query(PROVISION_SQL, 'provisioned')
                    require(set(result) == {'key_id', 'purpose', 'secret_base64url'} and result['key_id'] == KEY_ID and result['purpose'] == 'client_logo', 'Provisioning response scope was invalid; administrator recovery is required.')
                    encoded = result['secret_base64url']; decode_secret(encoded)
                    content = (json.dumps({'LOGO_VERIFICATION_KEY_ID': KEY_ID, 'LOGO_VERIFICATION_KEY_BASE64URL': encoded}, separators=(',', ':')) + '\n').encode('utf-8')
                    secret_handle.write(content); secret_handle.flush(); os.fsync(secret_handle.fileno())
                    security.verify_open(secret_handle)
                    secret_handle.seek(0)
                    saved = secret_document(secret_handle.read(513))['LOGO_VERIFICATION_KEY_BASE64URL']
                    require(hmac.compare_digest(saved, encoded), 'The private runtime file could not be confirmed; administrator recovery is required.')
                    _, configured, matches = inspect_state(saved)
                    require(configured and matches, 'The fixed database verifier did not match the private runtime file; administrator recovery is required.')
                    require(ENV_FILE.read_bytes() == document['data'], 'The existing environment changed during provisioning; administrator review is required.')
                    phase['phase'] = 'completed'; phase['completed_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
                    security.write_phase(phase_handle, phase)
                # Secret handle closes before the completed phase becomes readable.
            receipt.update(result='passed', key_exists=True, runtime_secret_configured=True, key_matches_runtime_file=True,
                           protected_runtime_file_written=True, protected_phase_recorded=True, existing_environment_unchanged=True)
    except ProvisionBlocked as error:
        receipt.update(reason=str(error), recovery_required=STATE_FILE.exists())
    except Exception:
        receipt.update(reason='Provisioning could not be completed; private phase metadata must be reviewed without regenerating or deleting the key.', recovery_required=STATE_FILE.exists())
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    filename = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + action + '.json'
    with (EVIDENCE / filename).open('x', encoding='utf-8') as handle:
        handle.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))
    return 0 if receipt['result'] == 'passed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except ProvisionBlocked as error:
        print(json.dumps({'result': 'blocked', 'reason': str(error), 'raw_errors_suppressed': True}))
        sys.exit(1)
    except Exception:
        print(json.dumps({'result': 'blocked', 'reason': 'Local or database prerequisites could not be verified; raw errors are suppressed.'}))
        sys.exit(1)
