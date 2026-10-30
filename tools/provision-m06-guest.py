"""Fixed encrypted M06 backend bootstrap. No private values enter query text.

prepare/apply/recover are explicit modes. An apply claim is written before the
single guarded dispatch; unknown outcomes permit read-only recovery only.
Imports are inert and no keys, ciphertext, HMACs or secret hashes are published.
"""
from datetime import datetime, timezone
from pathlib import Path
import hashlib
import hmac
import inspect
import json
import os
import re
import secrets
import subprocess
import sys
import uuid
from provision_logo_verifier import ROOT, WindowsPrivateFiles, safe_path
from release_foundation import call

TARGET = 'pyibofyctwnqpvktepse'
PRIVATE = ROOT / '.local/m06-guest-bootstrap'
ENV = ROOT / '.env.guest-runtime.local'
CRYPTO = 'tools/private-key-bootstrap/bootstrap.mjs'
BOOTSTRAP = 'tools/sql/m06-guest-bootstrap-template.sql'
RECOVER = 'tools/sql/m06-guest-recover-template.sql'
STATE = 'tools/sql/m06-guest-key-state.sql'
SOURCES = [BOOTSTRAP, RECOVER, STATE, CRYPTO, 'tools/private-key-bootstrap/package.json',
           'tools/private-key-bootstrap/package-lock.json', 'tools/provision-m06-guest.py',
           'tools/provision_logo_verifier.py', 'tools/release_foundation.py', 'tools/private-guest-env.mjs']

def require(value):
    if not value: raise ValueError('M06_GUEST_BOOTSTRAP_UNCONFIRMED')

def sha(data): return hashlib.sha256(data).hexdigest()
def now(): return datetime.now(timezone.utc)
def sources(): return {file: sha((ROOT / file).read_bytes()) for file in SOURCES}

def private_write(security, path, data):
    safe_path(path); path.parent.mkdir(parents=True, exist_ok=True); safe_path(path)
    with security.create(path) as handle:
        handle.write(data); handle.flush(); os.fsync(handle.fileno()); security.verify_open(handle)
    security.verify(path)

def private_read(security, path, limit):
    security.verify(path)
    with path.open('rb') as handle:
        security.verify_open(handle); data = handle.read(limit + 1); security.verify_open(handle)
    require(len(data) <= limit); return data

def crypto(payload):
    environment = {key: os.environ[key] for key in ('PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP') if key in os.environ}
    result = subprocess.run(['C:/Program Files/nodejs/node.exe', str(ROOT / CRYPTO)], input=json.dumps(payload),
        capture_output=True, text=True, encoding='utf8', errors='strict', timeout=90, cwd=ROOT, env=environment)
    require(result.returncode == 0 and not result.stderr and 0 < len(result.stdout.encode()) <= 65536)
    return json.loads(result.stdout)

def query(security, file, field):
    result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(file), '--output-format', 'json'])
    stamp = uuid.uuid4().hex
    for name in ('stdout', 'stderr'):
        private_write(security, PRIVATE / (stamp + '.' + name), getattr(result, name).encode('utf8'))
    require(result.returncode == 0 and len(result.stdout.encode()) <= 1024 * 1024)
    rows = json.loads(result.stdout)['rows']; require(len(rows) == 1 and set(rows[0]) == {field})
    return rows[0][field]

def expected_versions():
    result = sorted(file.name[:14] for file in (ROOT / 'supabase/migrations').glob('*.sql'))
    require(len(result) == 25 and len(set(result)) == 25 and all(re.fullmatch('[0-9]{14}', value) for value in result))
    return result

def validate_state(value, versions, present):
    require(set(value) == {'query_role', 'database', 'unrestricted_visibility', 'versions', 'configuration', 'constraints_sha256', 'user_triggers', 'rules'})
    require(value['query_role'] == value['database'] == 'postgres' and value['unrestricted_visibility'] is True
        and value['versions'] == versions and value['user_triggers'] == value['rules'] == 0
        and re.fullmatch('[a-f0-9]{64}', value['constraints_sha256']))
    require(value['configuration'] == {'count': 1, 'enabled': False, 'key_present': present,
        'key_bytes': 32 if present else 0, 'replay_ttl_seconds': 86400, 'session_ttl_seconds': 3600})

def compile_sql(template, recipient, state):
    require(type(recipient) is dict and re.fullmatch('[a-f0-9]{32}', recipient['nonce']))
    public = recipient['public_key']
    require(type(public) is str and len(public) <= 16384 and public.startswith('-----BEGIN PGP PUBLIC KEY BLOCK-----\n')
        and public.rstrip().endswith('-----END PGP PUBLIC KEY BLOCK-----') and 'PRIVATE KEY' not in public and public.isascii())
    versions = state['versions']; require(len(versions) in (24, 25) and versions == sorted(set(versions))
        and all(re.fullmatch('[0-9]{14}', item) for item in versions))
    require(re.fullmatch('[a-f0-9]{64}', state['constraints_sha256']))
    compiled = template.replace('__VERSIONS__', ','.join("'" + value + "'" for value in versions))
    compiled = compiled.replace('__CONSTRAINT_SHA__', state['constraints_sha256']).replace('__PUBLIC_HEX__', public.encode('ascii').hex()).replace('__NONCE__', recipient['nonce'])
    require('__' not in compiled and recipient['private_key'] not in compiled)
    return compiled

def validate_local_proof(proof, seals):
    require(type(proof) is dict and proof.get('result') == 'passed')
    for field in ('rollback_verified', 'actual_pgcrypto_openpgp_round_trip',
                  'plaintext_absent_from_statement_statistics_and_error_output', 'sources_stable'):
        require(proof.get(field) is True)
    require(proof.get('compiler_sha256') == sha(inspect.getsource(compile_sql).encode()))
    require(type(proof.get('source_seals')) is dict and all(proof['source_seals'].get(name) == digest for name, digest in seals.items()))
    require(proof.get('cloud_called') is False and proof.get('activation_private_configuration_read') is False)

def retain(report, suffix):
    directory = ROOT / 'tracking/evidence/m06/guest-bootstrap'; directory.mkdir(parents=True, exist_ok=True)
    file = directory / (now().strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + suffix + '.json')
    with file.open('x', encoding='utf8') as handle: json.dump(report, handle, indent=2); handle.write('\n')
    return file.relative_to(ROOT).as_posix()

def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('prepare', 'apply', 'recover'))
    mode = sys.argv[1]; security = WindowsPrivateFiles(); safe_path(PRIVATE); PRIVATE.mkdir(parents=True, exist_ok=True)
    seal = sources()
    local_proof_file = ROOT / 'tracking/evidence/m06/guest-bootstrap/local-pgp-proof.json'
    validate_local_proof(json.loads(local_proof_file.read_bytes()), seal)
    versions = expected_versions(); before = query(security, ROOT / STATE, 'guest_key_state')
    report = {'observed_at': now().isoformat(), 'target': TARGET, 'action': mode, 'result': 'unconfirmed',
        'source_seals': seal, 'local_proof_sha256': sha(local_proof_file.read_bytes()), 'cloud_write_attempted': False, 'automatic_retry': False, 'raw_values_or_secret_digests_published': False, 'hosting_deferred': True}
    validate_state(before, versions, mode == 'recover')
    if mode == 'prepare':
        require(not (PRIVATE / 'apply.claim.json').exists() and not ENV.exists())
        recipient_path = PRIVATE / 'recipient.json'
        if not recipient_path.exists():
            recipient = {**crypto({'action': 'generate'}), 'nonce': secrets.token_hex(16)}
            private_write(security, recipient_path, json.dumps(recipient).encode())
            private_write(security, PRIVATE / 'replay-key.bin', secrets.token_bytes(32))
        else: json.loads(private_read(security, recipient_path, 65536))
        prepare = {'at': now().isoformat(), 'state': before, 'source_seals': seal}
        if (PRIVATE / 'prepare.json').exists():
            old = private_read(security, PRIVATE / 'prepare.json', 65536)
            private_write(security, PRIVATE / ('prepare-retained-' + uuid.uuid4().hex + '.json'), old)
            with (PRIVATE / 'prepare.json').open('r+b') as handle:
                security.verify_open(handle); require(handle.read() == old); handle.seek(0); handle.write(json.dumps(prepare).encode()); handle.truncate(); handle.flush(); os.fsync(handle.fileno()); security.verify_open(handle)
        else: private_write(security, PRIVATE / 'prepare.json', json.dumps(prepare).encode())
        require(sources() == seal); report.update(result='prepared', database_unchanged=True, configuration_written=False)
        print(json.dumps({'result': report['result'], 'receipt': retain(report, mode), 'cloud_write_attempted': False})); return
    prepare = json.loads(private_read(security, PRIVATE / 'prepare.json', 65536))
    require(prepare['source_seals'] == seal and prepare['state']['versions'] == versions)
    recipient = json.loads(private_read(security, PRIVATE / 'recipient.json', 65536))
    expected = json.loads(json.dumps(prepare['state']))
    if mode == 'recover':
        require((PRIVATE / 'apply.claim.json').exists()); expected['configuration'].update(key_present=True, key_bytes=32)
    else:
        require(0 <= (now() - datetime.fromisoformat(prepare['at'])).total_seconds() <= 900 and not (PRIVATE / 'apply.claim.json').exists())
    require(before == expected and not (PRIVATE / 'completed.json').exists() and sources() == seal)
    template = (ROOT / (RECOVER if mode == 'recover' else BOOTSTRAP)).read_text(encoding='utf8')
    compiled = compile_sql(template, recipient, prepare['state']); query_path = PRIVATE / (mode + '-public-inputs-' + uuid.uuid4().hex + '.sql')
    private_write(security, query_path, compiled.encode())
    if mode == 'apply':
        attempt = retain({**report, 'result': 'attempting', 'cloud_write_attempted': True}, 'attempt')
        private_write(security, PRIVATE / 'apply.claim.json', json.dumps({'at': now().isoformat(), 'source_seals': seal, 'attempt_receipt': attempt, 'automatic_retry': False}).encode())
        report['cloud_write_attempted'] = True
    require(sources() == seal)
    value = query(security, query_path, 'guest_bootstrap')
    require(set(value) == {'query_role', 'database', 'changed_rows', 'key_bytes', 'recipient_key_id', 'ciphertext', 'nonce_hmac'}
        and value['query_role'] == value['database'] == 'postgres' and value['changed_rows'] == (0 if mode == 'recover' else 1)
        and value['key_bytes'] == 32 and value['recipient_key_id'].lower() == recipient['recipient_id'])
    key_result = crypto({'action': 'decrypt', 'payload': {**recipient, 'ciphertext': value['ciphertext'], 'nonce_hmac': value['nonce_hmac']}})
    require(set(key_result) == {'key_hex'} and re.fullmatch('[a-f0-9]{64}', key_result['key_hex']))
    key = bytes.fromhex(key_result['key_hex']); replay = private_read(security, PRIVATE / 'replay-key.bin', 32)
    require(len(replay) == 32 and not hmac.compare_digest(key, replay)
        and hmac.compare_digest(hmac.new(key, recipient['nonce'].encode(), hashlib.sha256).hexdigest(), value['nonce_hmac']))
    after = query(security, ROOT / STATE, 'guest_key_state'); validate_state(after, versions, True)
    expected = json.loads(json.dumps(prepare['state'])); expected['configuration'].update(key_present=True, key_bytes=32)
    require(after == expected and sources() == seal)
    environment = ('EPS_REVIEW_GATEWAY_KEY=' + key.hex() + '\nEPS_REVIEW_REPLAY_KEY=' + replay.hex() + '\n').encode()
    if ENV.exists(): require(private_read(security, ENV, 1024) == environment)
    else: private_write(security, ENV, environment)
    private_write(security, PRIVATE / 'completed.json', json.dumps({'at': now().isoformat(), 'source_seals': seal, 'owner_system_only': True, 'automatic_retry': False}).encode())
    report.update(result='passed', nonce_hmac_verified=True, configuration_written=True, owner_system_only=True,
        database_key_present=True, database_enabled=False, only_expected_key_metadata_changed=True,
        scope='Bootstrap checks exact gateway configuration/catalog metadata; full old-state preservation is recorded by the coordinated release/readback evidence.')
    print(json.dumps({'result': report['result'], 'receipt': retain(report, mode), 'owner_system_only': True, 'cloud_write_attempted': mode == 'apply'}))

if __name__ == '__main__':
    try: main()
    except Exception: sys.stderr.write('M06 encrypted bootstrap unconfirmed. Preserve the claim and recipient; use read-only recovery after an unknown write. No private diagnostics emitted.\n'); sys.exit(1)
