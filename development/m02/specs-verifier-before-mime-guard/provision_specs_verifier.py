"""Prepare one fixed original-document verifier key; no action on import.

PostgreSQL generates the only 32-byte key. Captured CLI output stays in memory;
no result/error body, key, digest, account identity or environment is logged.
Protected CREATE_NEW phase/secret files are held exclusively before dispatch.
The DB/filesystem boundary is not atomic: any interrupted or unknown outcome
leaves a noncompleted claim and blocks reruns for separately reviewed recovery.
This tool never retrieves, regenerates, rotates or overwrites an existing key.
"""
import base64
import datetime
import hashlib
import json
import os
import re
import sys
import uuid

from release_foundation import ROOT, TARGET, call
from provision_logo_verifier import WindowsPrivateFiles

KEY_ID = 'eps-specs-dev-20261029-v1'
SQL = 'tools/sql/provision-specs-verifier.sql'
SQL_SHA256 = 'dfe21d2ffddb78a011e2bd1d1f40375b1d6ac6ba30170e44d8d929a4d55dadac'
CLOUD_PROOF = None  # Root fills the exact successful cloud11 readback path.
CLOUD_PROOF_SHA256 = None
MIGRATION_11_VERSION = '20261029001520'
MIGRATION_11_SHA256 = None
VERSIONS_10 = ['20261028010943', '20261028013324', '20261028013655', '20261028024205',
               '20261028072515', '20261028162702', '20261028162800', '20261028172320',
               '20261028184145', '20261028222030']
DIRECTORY = ROOT / '.local/specs-assets-verifier'
PHASE_FILE = DIRECTORY / 'phase.json'
SECRET_FILE = DIRECTORY / 'verifier.json'
SECRET_RELATIVE = '.local/specs-assets-verifier/verifier.json'
EVIDENCE = ROOT / 'tracking/evidence/m02/specs-verifier'
PHASE_FIELDS = {'version', 'target', 'key_id', 'phase', 'claim_id', 'secret_file', 'created_at', 'completed_at', 'contains_secret'}


class ProvisionBlocked(Exception):
    """Only fixed, secret-free codes are emitted by this module."""


def require(condition):
    if not condition:
        raise ProvisionBlocked('SPECS_VERIFIER_PROVISIONING_UNCONFIRMED')


def utc_now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def strict_json(data, maximum):
    require(isinstance(data, bytes) and 0 < len(data) <= maximum)
    def pairs(entries):
        result = {}
        for key, value in entries:
            require(key not in result)
            result[key] = value
        return result
    try:
        return json.loads(data.decode('utf-8'), object_pairs_hook=pairs)
    except Exception:
        raise ProvisionBlocked('SPECS_VERIFIER_PROVISIONING_UNCONFIRMED') from None


def verified_secret(value):
    require(isinstance(value, dict) and set(value) == {'key_id', 'purpose', 'key_bytes', 'secret_base64url',
            'uploads_enabled', 'capabilities_enabled', 'file_pipeline_enabled'})
    require(value['key_id'] == KEY_ID and value['purpose'] == 'specs' and type(value['key_bytes']) is int and value['key_bytes'] == 32
            and all(value[name] is False for name in ('uploads_enabled', 'capabilities_enabled', 'file_pipeline_enabled')))
    encoded = value['secret_base64url']
    require(isinstance(encoded, str) and re.fullmatch(r'[A-Za-z0-9_-]{43}', encoded) is not None)
    decoded = base64.urlsafe_b64decode(encoded + '=')
    require(len(decoded) == 32 and base64.urlsafe_b64encode(decoded).decode('ascii').rstrip('=') == encoded)
    return {'SPECS_VERIFICATION_KEY_ID': KEY_ID, 'SPECS_VERIFICATION_KEY_BASE64URL': encoded}


def prerequisites():
    require(SQL_SHA256 and CLOUD_PROOF and CLOUD_PROOF_SHA256 and MIGRATION_11_VERSION and MIGRATION_11_SHA256)
    require(re.fullmatch(r'[0-9]{14}', MIGRATION_11_VERSION) is not None)
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET)
    sql_bytes = (ROOT / SQL).read_bytes()
    require(digest(sql_bytes) == SQL_SHA256 and b'UNSEALED_MIGRATION_11' not in sql_bytes)
    proof_bytes = (ROOT / CLOUD_PROOF).read_bytes()
    require(digest(proof_bytes) == CLOUD_PROOF_SHA256)
    proof = strict_json(proof_bytes, 4 * 1024 * 1024)
    require(proof.get('target') == TARGET and proof.get('action') == 'readback' and proof.get('result') == 'passed'
            and proof.get('application_verified_by_readback') is True and proof.get('application_status') == 'verified_applied')
    readback = proof.get('readback')
    require(isinstance(readback, dict) and readback.get('versions') == [*VERSIONS_10, MIGRATION_11_VERSION]
            and isinstance(readback.get('catalog_sha256'), str) and re.fullmatch(r'[a-f0-9]{64}', readback['catalog_sha256']))
    assets = readback.get('assets')
    require(isinstance(assets, dict) and all(type(assets.get(name)) is int and assets[name] == 0 for name in ('keys', 'uploads', 'grants', 'preparations')))
    config = assets.get('config')
    require(isinstance(config, dict) and set(config) == {'id', 'uploads_enabled', 'capabilities_enabled', 'file_pipeline_enabled'}
            and type(config['id']) is int and config['id'] == 1
            and all(config[name] is False for name in ('uploads_enabled', 'capabilities_enabled', 'file_pipeline_enabled')))
    migrations = proof['inputs']['migrations']
    require(isinstance(migrations, dict) and len(migrations) == 11)
    matching = [name for name in migrations if name.startswith(MIGRATION_11_VERSION + '_') and name.endswith('.sql')]
    require(matching == ['20261029001520_m02_specs_assets.sql'] and migrations[matching[0]] == MIGRATION_11_SHA256
            and sorted(name[:14] for name in migrations) == [*VERSIONS_10, MIGRATION_11_VERSION])
    require(all(isinstance(name, str) and re.fullmatch(r'[0-9]{14}_[A-Za-z0-9_]+\.sql', name)
                and digest((ROOT / 'supabase/migrations' / name).read_bytes()) == expected for name, expected in migrations.items()))
    require(not PHASE_FILE.exists() and not SECRET_FILE.exists())


def phase_bytes(phase):
    require(isinstance(phase, dict) and set(phase) == PHASE_FIELDS and phase['version'] == 1 and phase['target'] == TARGET
            and phase['key_id'] == KEY_ID and phase['secret_file'] == SECRET_RELATIVE and phase['contains_secret'] is False)
    require(isinstance(phase['claim_id'], str) and re.fullmatch(r'[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}', phase['claim_id'])
            and phase['phase'] in ('prepared', 'dispatching', 'completed', 'unconfirmed'))
    try:
        created = datetime.datetime.fromisoformat(phase['created_at'].replace('Z', '+00:00'))
        require(created.utcoffset() == datetime.timedelta(0))
        if phase['phase'] == 'completed':
            completed = datetime.datetime.fromisoformat(phase['completed_at'].replace('Z', '+00:00'))
            require(completed.utcoffset() == datetime.timedelta(0) and completed >= created)
        else:
            require(phase['completed_at'] is None)
    except Exception:
        raise ProvisionBlocked('SPECS_VERIFIER_PROVISIONING_UNCONFIRMED') from None
    return (json.dumps(phase, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def write_phase(security, handle, phase, first=False):
    security.verify_open(handle)
    if not first:
        handle.seek(0); previous = strict_json(handle.read(8193), 8192)
        require(set(previous) == PHASE_FIELDS and previous['claim_id'] == phase['claim_id'] and previous['target'] == TARGET
                and previous['key_id'] == KEY_ID and previous['secret_file'] == SECRET_RELATIVE and previous['contains_secret'] is False)
    handle.seek(0); handle.write(phase_bytes(phase)); handle.truncate(); handle.flush(); os.fsync(handle.fileno()); security.verify_open(handle)


def main():
    require(sys.argv[1:] == ['provision'])
    prerequisites()
    security = WindowsPrivateFiles(); DIRECTORY.mkdir(exist_ok=True, parents=True)
    phase = {'version': 1, 'target': TARGET, 'key_id': KEY_ID, 'phase': 'prepared', 'claim_id': str(uuid.uuid4()),
             'secret_file': SECRET_RELATIVE, 'created_at': utc_now(), 'completed_at': None, 'contains_secret': False}
    report = {'observed_at': phase['created_at'], 'target': TARGET, 'key_id': KEY_ID, 'action': 'provision', 'result': 'unconfirmed',
              'runtime_enablement_requested': False, 'automatic_retry': False, 'secret_recorded': False, 'raw_diagnostics_suppressed': True,
              'sql_sha256': SQL_SHA256, 'private_file_acl_verified': False, 'database_flags_disabled': None}
    # The reused writer establishes owner+SYSTEM-only ACLs at first byte and
    # denies all sharing. Never call its logo-specific write_phase helper.
    with security.create(PHASE_FILE) as journal:
        write_phase(security, journal, phase, first=True)
        with security.create(SECRET_FILE) as secret:
            phase['phase'] = 'dispatching'; write_phase(security, journal, phase)
            try:
                require(digest((ROOT / SQL).read_bytes()) == SQL_SHA256)
                result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / SQL), '--output-format', 'json'])
                require(result.returncode == 0)
                payload = strict_json(result.stdout.encode('utf-8'), 65536)
                require(isinstance(payload, dict) and isinstance(payload.get('rows'), list) and len(payload['rows']) == 1
                        and isinstance(payload['rows'][0], dict) and set(payload['rows'][0]) == {'provisioned'})
                private = verified_secret(payload['rows'][0]['provisioned'])
                encoded = (json.dumps(private, ensure_ascii=False, separators=(',', ':')) + '\n').encode('utf-8')
                secret.write(encoded); secret.flush(); os.fsync(secret.fileno()); security.verify_open(secret)
                secret.seek(0); require(secret.read(513) == encoded)
                require(digest((ROOT / SQL).read_bytes()) == SQL_SHA256)
                phase['phase'] = 'completed'; phase['completed_at'] = utc_now(); write_phase(security, journal, phase)
                report.update(result='passed', private_file_acl_verified=True, database_flags_disabled=True)
            except Exception:
                phase['phase'] = 'unconfirmed'; phase['completed_at'] = None
                write_phase(security, journal, phase)
    EVIDENCE.mkdir(exist_ok=True, parents=True)
    receipt = EVIDENCE / (phase['created_at'].replace(':', '-') + '-' + phase['claim_id'] + '-provision.json')
    with receipt.open('x', encoding='utf-8') as output:
        output.write(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print(json.dumps({'result': 'blocked', 'code': 'SPECS_VERIFIER_PROVISIONING_UNCONFIRMED', 'raw_diagnostics_suppressed': True}))
        sys.exit(1)
