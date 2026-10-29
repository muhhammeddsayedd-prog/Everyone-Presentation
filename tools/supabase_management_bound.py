"""UNUSED RESEARCH PROTOTYPE: inert fixed-target Management API transport.

Root selected the existing pinned CLI with public-key-encrypted bootstrap SQL.
This prototype is not integrated or authorized for credential reads/network use.

Importing does not read credentials or perform IO. Root must explicitly approve
the credential read/probe and the caller's SQL/timeout/canary proof first.

CLI v2.122.0 official sources (Windows raw UTF-8 Go-shaped keyring entries):
https://github.com/supabase/cli/blob/v2.122.0/apps/cli/src/auth/command-credentials.layer.ts
https://github.com/supabase/cli/blob/v2.122.0/apps/cli/src/shared/auth/keyring-token.ts
https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credreadw
https://supabase.com/docs/reference/api/v1-run-a-query

No keyring writes/enumeration, process/env token handoff, plaintext token-file
fallback, redirects, ambient proxy, raw error body, retry or diagnostic logging.
This module does not establish SQL transaction timeouts or prove log privacy.
"""
import base64
import ctypes
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = 'pyibofyctwnqpvktepse'
ENDPOINT = f'https://api.supabase.com/v1/projects/{TARGET}/database/query'
PROFILE = 'supabase'
MAX_RESPONSE = 64 * 1024
TOKEN_PATTERN = re.compile(r'sbp_(?:oauth_|v0_)?[a-f0-9]{40}')


class ManagementBoundError(Exception):
    """Fixed safe codes only: never include headers, body, SQL or credentials."""
    def __init__(self, code='MANAGEMENT_BOUND_UNCONFIRMED'):
        super().__init__(code)


def require(value, code='MANAGEMENT_BOUND_INVALID'):
    if not value:
        raise ManagementBoundError(code)


def decode_cli_token(blob):
    """Known official CLI native credential encodings; strict PAT after decoding."""
    require(isinstance(blob, bytes) and 1 <= len(blob) <= 512, 'CLI_CREDENTIAL_INVALID')
    try:
        value = blob.decode('utf-16-le') if b'\x00' in blob else blob.decode('utf-8')
        if value.startswith('go-keyring-base64:'):
            value = base64.b64decode(value[len('go-keyring-base64:'):], validate=True).decode('utf-8')
        require(TOKEN_PATTERN.fullmatch(value) is not None, 'CLI_CREDENTIAL_INVALID')
        return value
    except (ValueError, UnicodeError):
        raise ManagementBoundError('CLI_CREDENTIAL_INVALID') from None


def _read_windows_credential(account):
    """One exact generic credential via read-only CredReadW; no enumeration."""
    require(os.name == 'nt' and account in (PROFILE, 'access-token'), 'CLI_CREDENTIAL_UNAVAILABLE')
    from ctypes import wintypes
    class Credential(ctypes.Structure):
        _fields_ = [('Flags', wintypes.DWORD), ('Type', wintypes.DWORD), ('TargetName', wintypes.LPWSTR),
                    ('Comment', wintypes.LPWSTR), ('LastWritten', wintypes.FILETIME), ('CredentialBlobSize', wintypes.DWORD),
                    ('CredentialBlob', ctypes.POINTER(wintypes.BYTE)), ('Persist', wintypes.DWORD),
                    ('AttributeCount', wintypes.DWORD), ('Attributes', ctypes.c_void_p),
                    ('TargetAlias', wintypes.LPWSTR), ('UserName', wintypes.LPWSTR)]
    library = ctypes.WinDLL('Advapi32.dll', use_last_error=True)
    read = library.CredReadW
    read.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, ctypes.POINTER(ctypes.POINTER(Credential))]
    read.restype = wintypes.BOOL
    free = library.CredFree
    free.argtypes = [ctypes.c_void_p]
    free.restype = None
    credential = ctypes.POINTER(Credential)()
    target = f'Supabase CLI:{account}'
    if not read(target, 1, 0, ctypes.byref(credential)):
        if ctypes.get_last_error() == 1168:  # ERROR_NOT_FOUND only; unknown access errors never fall through.
            return None
        raise ManagementBoundError('CLI_CREDENTIAL_UNAVAILABLE')
    try:
        row = credential.contents
        require(row.Type == 1 and row.TargetName.casefold() == target.casefold() and row.UserName == account,
                'CLI_CREDENTIAL_SCOPE_INVALID')
        require(1 <= row.CredentialBlobSize <= 512 and bool(row.CredentialBlob), 'CLI_CREDENTIAL_INVALID')
        return decode_cli_token(ctypes.string_at(row.CredentialBlob, row.CredentialBlobSize))
    finally:
        # This is the returned process buffer, not a Credential Manager write.
        if credential:
            row = credential.contents
            if row.CredentialBlob and 0 < row.CredentialBlobSize <= 512:
                ctypes.memset(row.CredentialBlob, 0, row.CredentialBlobSize)
            free(credential)


def _validate_cli_context():
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'CLI_TARGET_INVALID')
    require(not any(os.environ.get(name) for name in ('SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROFILE', 'SUPABASE_HOME', 'SUPABASE_NO_KEYRING')),
            'CLI_CONTEXT_OVERRIDE_UNSUPPORTED')
    profile = Path.home() / '.supabase/profile'
    if profile.exists():
        require(not profile.is_symlink() and profile.is_file() and profile.stat().st_size <= 64, 'CLI_PROFILE_UNSUPPORTED')
        require(profile.read_text(encoding='utf-8').strip() == PROFILE, 'CLI_PROFILE_UNSUPPORTED')


def read_cli_access_token():
    """Explicit root-only runtime action. Nothing invokes this on import."""
    try:
        _validate_cli_context()
        for account in (PROFILE, 'access-token'):
            value = _read_windows_credential(account)
            if value is not None:
                require(isinstance(value, str) and TOKEN_PATTERN.fullmatch(value), 'CLI_CREDENTIAL_INVALID')
                return value
        raise ManagementBoundError('CLI_CREDENTIAL_UNAVAILABLE')
    except ManagementBoundError:
        raise
    except Exception:
        raise ManagementBoundError('CLI_CREDENTIAL_UNAVAILABLE') from None


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise ManagementBoundError('MANAGEMENT_REDIRECT_DENIED')


def _open_request(request, timeout):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}),
        urllib.request.HTTPSHandler(context=ssl.create_default_context()), _NoRedirect())
    return opener.open(request, timeout=timeout)


def post_bound_query(query, parameters, *, read_only):
    """One non-retried fixed-target POST. Caller owns reviewed SQL and timeout proof.

    Only nonsecret parameters are accepted: one public PGP key with an optional
    public nonce, or no parameters for reviewed metadata SQL. Database-generated
    secret bytes must be encrypted in SQL and never returned as plaintext.
    No arbitrary destination, headers or CLI arguments are accepted.
    """
    require(isinstance(query, str) and 1 <= len(query.encode('utf-8')) <= 32 * 1024 and '\x00' not in query)
    require(isinstance(parameters, list) and len(parameters) <= 2)
    if parameters:
        public_key = parameters[0]
        require(isinstance(public_key, str) and len(public_key) <= 16 * 1024
                and re.fullmatch(r'-----BEGIN PGP PUBLIC KEY BLOCK-----\n[\x20-\x7e\n]{1,16000}\n-----END PGP PUBLIC KEY BLOCK-----\n?', public_key) is not None
                and 'PRIVATE KEY' not in public_key, 'PUBLIC_PGP_PARAMETER_REQUIRED')
    if len(parameters) == 2:
        require(isinstance(parameters[1], str) and re.fullmatch(r'(?:[a-f0-9]{32}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})', parameters[1]) is not None,
                'PUBLIC_NONCE_PARAMETER_INVALID')
    require(type(read_only) is bool and set(re.findall(r'\$([0-9]+)', query)) == {str(index + 1) for index in range(len(parameters))})
    require(all(parameter not in query for parameter in parameters), 'BOUND_PARAMETER_INTERPOLATED')
    token = read_cli_access_token()
    require(token not in query and all(token not in parameter for parameter in parameters), 'CLI_CREDENTIAL_SCOPE_INVALID')
    body = json.dumps({'query': query, 'parameters': parameters, 'read_only': read_only},
                      separators=(',', ':'), ensure_ascii=True).encode('utf-8')
    request = urllib.request.Request(ENDPOINT, data=body, method='POST',
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json', 'Accept': 'application/json'})
    started = time.monotonic()
    try:
        with _open_request(request, timeout=9) as response:
            require(response.geturl() == ENDPOINT, 'MANAGEMENT_REDIRECT_DENIED')
            require(response.status in (200, 201), 'MANAGEMENT_HTTP_UNCONFIRMED')
            require(response.headers.get_content_type() == 'application/json', 'MANAGEMENT_RESPONSE_INVALID')
            length = response.headers.get('Content-Length')
            require(length is None or length.isdecimal() and int(length) <= MAX_RESPONSE, 'MANAGEMENT_RESPONSE_TOO_LARGE')
            chunks = []
            size = 0
            while True:
                require(time.monotonic() - started < 10, 'MANAGEMENT_DEADLINE_EXCEEDED')
                chunk = response.read(min(8192, MAX_RESPONSE + 1 - size))
                if not chunk:
                    break
                chunks.append(chunk)
                size += len(chunk)
                require(size <= MAX_RESPONSE, 'MANAGEMENT_RESPONSE_TOO_LARGE')
            value = json.loads(b''.join(chunks))
            require(isinstance(value, list) and len(value) <= 8 and all(isinstance(row, dict) for row in value),
                    'MANAGEMENT_RESPONSE_INVALID')
            return value
    except ManagementBoundError:
        raise
    except Exception:
        # HTTPError can contain private response/SQL/parameters. Do not read or preserve it.
        raise ManagementBoundError('MANAGEMENT_BOUND_UNCONFIRMED') from None
    finally:
        # No log, receipt, credential hash, subprocess, environment or file receives token/body.
        token = None
        body = None
