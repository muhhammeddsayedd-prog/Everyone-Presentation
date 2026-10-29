"""Fixed active12->13 read-policy compatibility release. Importing performs no IO.

Only the three reviewed Storage SELECT USING expressions and migration history
may change. No flags, login, key, source, object or provider actions are offered.
Missing seals stop before CLI access. Unknown dispatches are inspected, never
automatically repeated. Historical release helpers and receipts stay immutable.
"""
import copy
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tomllib
import uuid

from release_foundation import ROOT, TARGET, call as cli_call
from release_specs_assets import MIGRATIONS as PRIOR_MIGRATIONS

MIGRATION = None  # Exact CLI-created13 filename, after reviewed local proof.
MIGRATION_SHA256 = None
READBACK = 'tools/sql/specs-read-operation-readback.sql'
READBACK_SHA256 = '8c23cba328e8eef38c99520807dcb680895b94b5508dc307932d01b5fda76a2f'
MANIFEST_SHA256 = None
POLICIES = ('eps_specs_original_read', 'eps_specs_capability_read', 'eps_specs_read_guard')
NEW_USING_SHA256 = {name: None for name in POLICIES}
BASELINE = None  # (immutable fresh active-cloud12 contract path, SHA256)
LOCAL_PROOF = None  # (actual guarded persisted13 local proof path, SHA256)
LOCAL_CONTRACT = None  # (source-hashed local13 policy contract path, SHA256)
SOURCE_SEALS = {}  # Reviewed migration/test/harness/readback/dependency sources.
EVIDENCE = ROOT / 'tracking/evidence/cloud-specs-read-operation'
BASE_VERSIONS = [name[:14] for name in PRIOR_MIGRATIONS]
READ_DEPENDENCIES = {'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
                     'tools/release_specs_assets.py': '2a5926c2362d8ea246d3d6b9b43f09bbf5a662288cc8126b1cbf9a7f2ffbcaaa'}


class Blocked(Exception):
    def __init__(self, message='SPECS_READ_OPERATION_RELEASE_UNCONFIRMED'):
        super().__init__(message)
        self.snapshot = None


def require(value, message='SPECS_READ_OPERATION_RELEASE_UNCONFIRMED'):
    if not value:
        raise Blocked(message)


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(path):
    return hashlib.sha256((ROOT / path).read_bytes()).hexdigest()


def canonical_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def read_json(path):
    return json.loads((ROOT / path).read_text(encoding='utf-8'))


def versions():
    require(isinstance(MIGRATION, str) and re.fullmatch(r'\d{14}_m02_specs_read_operation\.sql', MIGRATION))
    return BASE_VERSIONS + [MIGRATION[:14]]


def policy_rows(state):
    selected = [row for row in state['catalog']['policies']
                if row['table'] == 'storage.objects' and row['name'] in POLICIES]
    require(len(selected) == 3 and len({row['name'] for row in selected}) == 3,
            'Exact three existing Storage read policies required.')
    rows = {row['name']: row for row in selected}
    for name, row in rows.items():
        expected = {'eps_specs_original_read': (True, ['authenticated']),
                    'eps_specs_capability_read': (True, ['anon']),
                    'eps_specs_read_guard': (False, ['PUBLIC'])}[name]
        require(row['command'] == 'r' and row['permissive'] is expected[0]
                and row['roles'] == expected[1] and row['check'] is None
                and isinstance(row['using'], str), 'Storage policy command/roles/composition differs.')
    return rows


def validate_snapshot(state):
    require(isinstance(state, dict) and state.get('query_role') == 'postgres'
            and state.get('database') == 'postgres' and state.get('unrestricted_visibility') is True,
            'Unrestricted fixed-target metadata visibility required.')
    require(state.get('versions') in (BASE_VERSIONS, versions() if MIGRATION else BASE_VERSIONS), 'Only exact12/13 histories are allowed.')
    require(isinstance(state.get('catalog'), dict) and isinstance(state.get('counts'), dict)
            and isinstance(state.get('data_sha256'), dict), 'Complete catalogue/data fingerprints required.')
    policy_rows(state)
    require(all(row['maintain'] is False for row in state['catalog']['table_acls']
                if row['table'] not in ('storage.objects', 'storage.buckets')),
            'Unexpected app-role MAINTAIN authority.')
    runtime = state.get('runtime')
    if runtime is not None:
        require(runtime.get('name') == 'eps_specs_runtime' and runtime.get('login') is True
                and runtime.get('table_authority') is False and runtime.get('schema_create') is False
                and all(runtime.get(key) is False for key in ('inherit', 'superuser', 'bypass_rls', 'create_db', 'create_role', 'replication')),
                'Runtime must retain its narrow service identity.')
    return 'pending' if state['versions'] == BASE_VERSIONS else 'applied'


def compare_preserved(before, after):
    # No nullable-field masking: all existing file/media/source/queue fields are
    # now established. Auth/key/grant secrets are explicitly excluded in SQL;
    # counts and nonsecret lifecycle metadata remain separately fingerprinted.
    require({key: value for key, value in before.items() if key not in ('catalog', 'versions')}
            == {key: value for key, value in after.items() if key not in ('catalog', 'versions')},
            'Business/media/Storage/Auth counts, fingerprints or active configuration changed.')


def compare_catalogues(before, after, applied):
    old = policy_rows(before); current = policy_rows(after)
    normalized = copy.deepcopy(after['catalog'])
    for row in normalized['policies']:
        if row['table'] == 'storage.objects' and row['name'] in POLICIES:
            name = row['name']
            if applied:
                require(NEW_USING_SHA256[name] and hashlib.sha256(row['using'].encode()).hexdigest() == NEW_USING_SHA256[name],
                        'New read expression differs from actual sealed local13.')
                require(row['using'] != old[name]['using'], 'Read expression did not change.')
            else:
                require(row['using'] == old[name]['using'], 'Pending read expression drifted.')
            row['using'] = old[name]['using']
    require(normalized == before['catalog'], 'An unrelated catalogue, ACL, owner or policy attribute changed.')
    require(len(current) == 3)


def compact(state):
    return {key: value for key, value in state.items() if key != 'catalog'} | {
        'catalog_sha256': canonical_hash(state['catalog']),
        'catalogue_counts': {key: len(value) for key, value in state['catalog'].items()},
        'read_policy_sha256': {name: hashlib.sha256(row['using'].encode()).hexdigest()
                              for name, row in policy_rows(state).items()}}


def load_sealed(pair):
    require(isinstance(pair, tuple) and len(pair) == 2 and all(isinstance(value, str) and value for value in pair))
    path, seal = pair
    require(digest(path) == seal, 'A sealed prerequisite changed.')
    return read_json(path)


def prerequisites():
    require(MIGRATION_SHA256 and READBACK_SHA256 and MANIFEST_SHA256 and SOURCE_SEALS
            and all(NEW_USING_SHA256.values()) and BASELINE and LOCAL_PROOF and LOCAL_CONTRACT,
            'Final13 sources, real local proof, local policy contract and fresh active-cloud12 baseline are required; no CLI allowed.')
    expected = {**PRIOR_MIGRATIONS, MIGRATION: MIGRATION_SHA256}
    require(sorted(path.name for path in (ROOT / 'supabase/migrations').glob('*.sql')) == list(expected),
            'Only exact coordinated thirteen-file history is allowed.')
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'Linked project differs.')
    config = tomllib.loads((ROOT / 'supabase/config.toml').read_text(encoding='utf-8'))
    require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False,
            'Migrations enabled and seeds disabled required.')
    require(digest(READBACK) == READBACK_SHA256 and digest('development/local-db/reviewed.json') == MANIFEST_SHA256,
            'Readback/reviewed manifest changed.')
    for path, seal in SOURCE_SEALS.items():
        require(digest(path) == seal, 'A reviewed release/test/SQL dependency changed.')
    reviewed = {row['path']: row for row in read_json('development/local-db/reviewed.json')['migrations']}
    require(len(reviewed) == len(expected))
    for name, seal in expected.items():
        path = 'supabase/migrations/' + name
        require(digest(path) == seal == reviewed.get(path, {}).get('sha256')
                and reviewed[path].get('reviewed_by') and reviewed[path].get('reviewed_at'), 'Migration bytes/reviewer differ.')
    baseline = load_sealed(BASELINE)
    require(baseline['result'] == 'passed' and baseline['target'] == TARGET and baseline['read_only'] is True
            and baseline['readback_sha256'] == READBACK_SHA256
            and validate_snapshot(baseline['readback']) == 'pending', 'Fresh source-bound active12 cloud baseline required.')
    proof = load_sealed(LOCAL_PROOF)
    # Final actual proof field names are pinned after the author supplies the
    # real receipt; this cannot be satisfied by a candidate-only parse result.
    require(proof['result'] == 'passed' and proof['migration_sha256'] == MIGRATION_SHA256
            and proof['before'] == proof['after'] and proof['before']['versions'] == versions()
            and proof['catalog_and_all_counts_restored'] is True and proof['rollback_verified'] is True
            and proof['transaction_completed_to_rollback'] is True and proof['cloud_called'] is False
            and proof['provider_called'] is False and proof['storage_http_tested'] is False,
            'Actual persisted13 role-policy rollback proof required.')
    require(proof['harness_sha256'] in SOURCE_SEALS.values() and proof['hashes']['assertions'] in SOURCE_SEALS.values(),
            'Actual local receipt must bind exact reviewed harness/assertions.')
    local = load_sealed(LOCAL_CONTRACT)
    require(local['read_only'] is True and local['cloud_called'] is False
            and local['readback_sha256'] == READBACK_SHA256 and local['system_identifier'] == '7701520506262638626'
            and validate_snapshot(local['readback']) == 'applied', 'Actual pinned local13 policy contract required.')
    for name, row in policy_rows(local['readback']).items():
        require(hashlib.sha256(row['using'].encode()).hexdigest() == NEW_USING_SHA256[name], 'Local policy seal differs.')
    return {'migrations': expected, 'readback_sha256': READBACK_SHA256, 'manifest_sha256': MANIFEST_SHA256,
            'sources': SOURCE_SEALS, 'policy_sha256': NEW_USING_SHA256,
            'baseline': BASELINE, 'local_proof': LOCAL_PROOF, 'local_contract': LOCAL_CONTRACT,
            'release_helper_sha256': digest('tools/release_specs_read_operation.py')}, baseline['readback']


def capture_baseline():
    """Separate fixed READ ONLY gate: permits preparation before local13 proofs.

    It cannot push, select another target/query, load runtime/provider config,
    enable a feature or establish acceptance. Every run is immutable.
    """
    require(digest(READBACK) == READBACK_SHA256 and READBACK_SHA256, 'Readback source differs.')
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'Linked project differs.')
    for path, seal in READ_DEPENDENCIES.items():
        require(digest(path) == seal, 'Fixed read-only CLI dependency changed.')
    for name, seal in PRIOR_MIGRATIONS.items():
        require(digest('supabase/migrations/' + name) == seal, 'A historical migration changed.')
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    receipt = {'observed_at': stamp(), 'target': TARGET, 'action': 'baseline', 'result': 'failed', 'read_only': True,
               'readback_sha256': READBACK_SHA256, 'harness_sha256': digest('tools/release_specs_read_operation.py'),
               'read_dependencies': READ_DEPENDENCIES, 'provider_called': False, 'storage_http_called': False,
               'raw_diagnostics_recorded': False, 'verification_secrets_or_raw_grant_tokens_read_or_hashed': False,
               'auth_user_rows_returned_or_hashed': False}
    try:
        mode, state = inspect()
        require(mode == 'pending', 'Baseline capture requires current exact12; an observed13 needs release readback.')
        receipt.update(result='passed', readback=state)
    except Blocked as error:
        receipt['reason'] = str(error)
        if error.snapshot is not None: receipt['unverified_readback'] = error.snapshot
        raise
    except Exception:
        receipt['reason'] = 'Fixed read-only baseline unconfirmed; raw diagnostics suppressed.'
        raise
    finally:
        receipt['finished_at'] = stamp(); name = retain(receipt, 'baseline')
        print(json.dumps({'result': receipt['result'], 'receipt': (EVIDENCE / name).relative_to(ROOT).as_posix(),
                          'read_only': True, 'raw_diagnostics_recorded': False}))


def call(arguments):
    result = cli_call(arguments)
    private = ROOT / '.local/cloud-specs-read-operation'; private.mkdir(parents=True, exist_ok=True)
    label = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8]
    for stream in ('stdout', 'stderr'):
        with (private / (label + '.' + stream)).open('x', encoding='utf-8') as file:
            file.write(getattr(result, stream)); file.flush(); os.fsync(file.fileno())
    return result


def inspect():
    result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / READBACK), '--output-format', 'json'])
    require(result.returncode == 0 and len(result.stdout.encode('utf-8')) <= 16 * 1024 * 1024,
            'Fixed read-only metadata inspection unconfirmed; raw diagnostics suppressed.')
    rows = json.loads(result.stdout)['rows']; require(len(rows) == 1 and set(rows[0]) == {'specs_read_operation_release'})
    state = rows[0]['specs_read_operation_release']
    try:
        return validate_snapshot(state), state
    except Blocked as error:
        error.snapshot = compact(state); raise


def retain(receipt, phase):
    name = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + phase + '.json'
    with (EVIDENCE / name).open('x', encoding='utf-8') as file:
        json.dump(receipt, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
    return name


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    if action == 'baseline':
        return capture_baseline()
    require(action in ('dry-run', 'apply', 'readback'), 'Only fixed dry-run/apply/readback; no SQL/target overrides.')
    inputs, baseline = prerequisites(); EVIDENCE.mkdir(parents=True, exist_ok=True)
    receipt = {'observed_at': stamp(), 'target': TARGET, 'action': action, 'inputs': inputs, 'result': 'failed',
               'application_status': 'not_attempted', 'application_verified_by_readback': False,
               'runtime_flag_changed': False, 'identity_provisioned': False, 'verifier_key_provisioned': False,
               'provider_called': False, 'n8n_changed': False, 'seeds': False, 'vault_sync': False,
               'raw_diagnostics_recorded': False, 'file_pipeline_acceptance': False,
               'forward_fix': 'Use a new reviewed migration restoring exactly the three old USING expressions from the sealed active12 baseline. Never edit13, reapply, or automatically mutate on unknown outcomes.'}
    try:
        mode, before = inspect(); receipt.update(before_mode=mode, before=compact(before))
        if mode == 'applied':
            receipt.update(application_status='verified_existing', application_verified_by_readback=True)
        compare_preserved(baseline, before); compare_catalogues(baseline, before, mode == 'applied')
        if action != 'readback':
            require(mode == 'pending', 'Already applied/unknown: read back; never repeat the mutator.')
            if action == 'apply':
                dry = read_json(str((EVIDENCE / 'dry-run.json').relative_to(ROOT)))
                age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(dry['finished_at'])).total_seconds()
                require(dry['result'] == 'passed' and dry['target'] == TARGET and dry['inputs'] == inputs
                        and dry['action'] == 'dry-run' and dry['readback'] == compact(before)
                        and dry['pending_migrations'] == [MIGRATION] and 0 <= age <= 3600,
                        'Exact successful fresh dry-run/current preflight required.')
            receipt['application_status'] = 'unknown_until_readback' if action == 'apply' else 'not_attempted'
            receipt['attempt_receipt'] = retain(receipt, action + '-attempt')
            command = ['db', 'push', '--linked', '--project-ref', TARGET, '--skip-vault', '--yes', '--output-format', 'json']
            if action == 'dry-run': command.append('--dry-run')
            try:
                result = call(command); receipt['exit_code'] = result.returncode
                receipt['pending_migrations'] = sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql', result.stdout + '\n' + result.stderr)))
            except Exception:
                receipt['dispatch_response_unavailable'] = True
        after_mode, after = inspect()
        receipt.update(after_mode=after_mode, readback=compact(after), application_verified_by_readback=after_mode == 'applied',
                       application_status='verified_' + after_mode)
        require(after_mode == ('pending' if action == 'dry-run' else 'applied' if action == 'apply' else mode),
                'Unexpected history; reconcile without another mutator.')
        compare_preserved(baseline, after); compare_preserved(before, after)
        compare_catalogues(baseline, after, after_mode == 'applied')
        if action != 'readback':
            require(receipt.get('exit_code') == 0 and receipt.get('pending_migrations') == [MIGRATION],
                    'Dispatch response unconfirmed; observed state retained, no automatic retry.')
        receipt['result'] = 'passed'
    except Blocked as error:
        receipt['reason'] = str(error)
        if error.snapshot is not None: receipt['unverified_readback'] = error.snapshot
        raise
    except Exception:
        receipt['reason'] = 'Fixed read-policy release unconfirmed; raw diagnostics suppressed. Inspect history before retry.'
        raise
    finally:
        receipt['finished_at'] = stamp(); name = retain(receipt, action)
        if action == 'dry-run' and receipt['result'] == 'passed':
            temporary = EVIDENCE / ('dry-run-pointer-' + uuid.uuid4().hex + '.tmp')
            with temporary.open('x', encoding='utf-8') as file:
                json.dump(receipt, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
            os.replace(temporary, EVIDENCE / 'dry-run.json')
        print(json.dumps({'result': receipt['result'], 'application_status': receipt['application_status'],
                          'application_verified_by_readback': receipt['application_verified_by_readback'],
                          'receipt': (EVIDENCE / name).relative_to(ROOT).as_posix(), 'raw_diagnostics_recorded': False}))


if __name__ == '__main__':
    try:
        main()
    except Blocked as error:
        print(json.dumps({'result': 'blocked', 'reason': str(error), 'raw_diagnostics_recorded': False})); sys.exit(1)
    except Exception:
        print('{"result":"blocked","reason":"Fixed release unconfirmed; raw diagnostics suppressed.","raw_diagnostics_recorded":false}')
        sys.exit(1)
