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

MIGRATION = '20261029070038_m02_specs_read_operation.sql'
MIGRATION_SHA256 = '040151ec89b461be2dc0c1d4ab8446652062488aac5f63822129d497ecf1702e'
READBACK = 'tools/sql/specs-read-operation-readback.sql'
READBACK_SHA256 = '8c23cba328e8eef38c99520807dcb680895b94b5508dc307932d01b5fda76a2f'
MANIFEST_SHA256 = 'b03d02089e81e13dd5ec8b4245ecfdc81cd6f08e6e4e24ef97933e5d30d77a6c'
POLICIES = ('eps_specs_original_read', 'eps_specs_capability_read', 'eps_specs_read_guard')
NEW_USING_SHA256 = {'eps_specs_original_read': '743bd89c5821ba0de2d57bd432c27f9963dd6bb69cda5e1f47d9dd62d403649d',
                    'eps_specs_capability_read': '20f819f0ceb92b068be6344b9d19b7fde4844d2816092a8953eec117923c7ca8',
                    'eps_specs_read_guard': '6ea6a14a40847852f0e92d6d410938aa18996a8e0fd13b73183276350b8063c2'}
BASELINE = ('tracking/evidence/cloud-specs-read-operation/2026-10-29T06-54-27-704770Z-4b1a2633-baseline.json',
            '40e4e28b2464c5ed2fecc88eecb8b34b486ffee7ad991f0a63bf341cd9a8ac0b')
LOCAL_PROOF = ('tracking/evidence/m02/specs-read-operation-local/2026-10-29T07-12-41-265Z-648059c6-rollback.json',
               '865280bdda5cffbfd4934a4a12b804c79c22782b150ed7cf400b45bf13e45cd1')
LOCAL_CONTRACT = ('tracking/evidence/m02/specs-read-operation-local/648059c6-9120-49b1-95d8-ddf463d25949-policy-contract.json',
                  'c192bd96a574eb1b3efe3f68b92895731eb9261f0932af09906a0eeec016fb2b')
PROMOTION_PROOF = ('tracking/evidence/m02/specs-read-operation-promotion/2026-10-29T07-08-30-135Z-34f2e77e.json',
                   '39eff060b6d4f59b5d1e3a792421f55dce7f0efa29e6029801339571b95302e7')
CANDIDATE_PROOF = ('tracking/evidence/m02/specs-read-operation-candidate/2026-10-29T06-58-54-461Z-156cc7e0-rollback.json',
                   '02b560e8259bccaacfb665e4558ed771eb6af40935e535504815b00da6d04e7f')
CANDIDATE_HARNESS = 'tools/test-m02-specs-read-operation.mjs'
CANDIDATE_SQL = 'development/m02/specs-read-operation-candidate.sql'
ASSERTIONS = 'tests/db/m02-specs-read-operation.sql'
PERSISTED_HARNESS = 'tools/test-m02-specs-read-operation-local.mjs'
PERSISTED_ASSERTIONS = 'tests/db/m02-specs-read-operation-local.sql'
SOURCE_SEALS = {'development/m02/specs-read-operation-candidate.sql': '7012e48c480c0d5399246f587826fdfd75e7ca135fcb916c94cd5d8aba60e507',
 'tests/db/m02-specs-read-operation-local.sql': 'df272fe1c3cf4f5e4fbadc2575c25834f854f73db32274d6985c734a40af5187',
 'tests/db/m02-specs-read-operation.sql': '57f18bf41ca40036791af68af383ab07f270ded1d3c2a80b2bf2b707302bd37b',
 'tests/operations/test_specs_read_operation_release.py': 'fac48f00c59b6670a23b9e5bed5ca1099700293f5b23f3a8f989a8d0d5d6946d',
 'tools/lib/native-specs-local-transport.mjs': '57f2b5dca8ea6e04542366c93283a2bf22a63c8d918918a0b00561b3b31758d9',
 'tools/local-postgres.mjs': '49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de',
 'tools/promote-specs-read-operation-local.mjs': '90e1ef13b2ada75cda34359ba6c4dcbbc531410a0780341afc7fc5e5a091b3e9',
 'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
 'tools/release_specs_assets.py': '2a5926c2362d8ea246d3d6b9b43f09bbf5a662288cc8126b1cbf9a7f2ffbcaaa',
 'tools/sql/specs-read-operation-forward-fix.md': 'c65d3b0e6ca483fd31d9e744638f41d693e2668f6f104751f8558103798cfe3d',
 'tools/sql/specs-read-operation-readback.sql': '8c23cba328e8eef38c99520807dcb680895b94b5508dc307932d01b5fda76a2f',
 'tools/test-m02-specs-read-operation-local.mjs': '70a8815edc2fd35bb5eb771317b8ab58e222bfb4acf7bfc2a3a838fd06b0d485',
 'tools/test-m02-specs-read-operation.mjs': 'fe2456460a9f1cb26e60d046640212cad284f50734165e2e5bc6350613d689f8'}
EVIDENCE = ROOT / 'tracking/evidence/cloud-specs-read-operation'
BASE_VERSIONS = [name[:14] for name in PRIOR_MIGRATIONS]
READ_DEPENDENCIES = {'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
                     'tools/release_specs_assets.py': '2a5926c2362d8ea246d3d6b9b43f09bbf5a662288cc8126b1cbf9a7f2ffbcaaa'}
RUNTIME_GROUPS = {'eps_jobs_dispatcher', 'eps_jobs_executor', 'eps_specs_assets_executor'}
RUNTIME_OPERATIONS = sorted(['eps.claim_job_outbox(integer)', 'eps.finish_job_outbox(uuid, text, boolean)',
    'eps.claim_job_stage(jsonb)', 'eps.get_specs_stage_input(uuid, uuid, text)', 'eps.record_job_event(jsonb)',
    'eps.recover_job_stages(integer)', 'eps.get_job_asset_access(jsonb)', 'eps.reserve_job_output(jsonb)',
    'eps.complete_job_output(jsonb)', 'eps.store_specs_preparation(jsonb)'])
RUNTIME_SETTINGS = sorted(['log_statement=none', 'log_parameter_max_length=0', 'log_parameter_max_length_on_error=0',
    'log_min_error_statement=panic', 'log_min_duration_statement=-1', 'auto_explain.log_min_duration=-1',
    'auto_explain.log_parameter_max_length=0', 'auto_explain.log_nested_statements=false', 'pg_stat_statements.track=none'])


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


def validate_runtime(runtime):
    require(isinstance(runtime, dict) and runtime.get('name') == 'eps_specs_runtime' and runtime.get('login') is True
            and runtime.get('table_authority') is False and runtime.get('schema_create') is False
            and all(runtime.get(key) is False for key in ('inherit', 'superuser', 'bypass_rls', 'create_db', 'create_role', 'replication'))
            and runtime.get('connection_limit') == 4 and sorted(runtime.get('execute', [])) == RUNTIME_OPERATIONS,
            'Runtime must retain its exact narrow ten-operation service identity.')
    parents = runtime.get('parents', [])
    require(len(parents) == 3 and {row['name'] for row in parents} == RUNTIME_GROUPS
            and all(row == {'name': row['name'], 'grantor': 'postgres', 'admin': False, 'inherit': True, 'set': False} for row in parents),
            'Only the existing exact three inherit-only runtime groups are allowed.')
    require(runtime.get('incoming') in ([], [{'name': 'postgres', 'grantor': 'supabase_admin', 'admin': True, 'inherit': False, 'set': False}])
            and runtime.get('settings') == [{'database': '0', 'values': RUNTIME_SETTINGS, 'unknown_setting': False}],
            'Runtime membership or private logging defaults differ.')
    try:
        expiry = datetime.datetime.fromisoformat(runtime['valid_until'].replace('Z', '+00:00'))
        require(expiry > datetime.datetime.now(datetime.timezone.utc), 'Runtime credential expired.')
    except (KeyError, ValueError, TypeError, AttributeError):
        raise Blocked('Runtime credential expiry is unavailable.') from None


def validate_snapshot(state, *, local=False):
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
    if local:
        require(state.get('runtime') is None, 'Local contract must not adopt a real runtime login.')
    else:
        validate_runtime(state.get('runtime'))
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
            and all(NEW_USING_SHA256.values()) and BASELINE and LOCAL_PROOF and LOCAL_CONTRACT and CANDIDATE_PROOF and PROMOTION_PROOF and PERSISTED_ASSERTIONS,
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
    candidate = load_sealed(CANDIDATE_PROOF)
    require(candidate['result'] == 'passed' and candidate['before'] == candidate['after'] and candidate['before']['versions'] == BASE_VERSIONS
            and all(candidate[key] is True for key in ('red_body_allowed_info_denied', 'green_body_and_info_allowed', 'scope_and_lease_negatives_passed',
                'catalog_and_all_counts_restored', 'rollback_verified', 'transaction_completed_to_rollback', 'owned_backend_settled', 'candidate_ddl_executed'))
            and candidate['cloud_called'] is False and candidate['provider_called'] is False and candidate['storage_http_tested'] is False
            and candidate['harness_sha256'] == SOURCE_SEALS[CANDIDATE_HARNESS]
            and candidate['hashes'] == {'candidate': SOURCE_SEALS[CANDIDATE_SQL], 'assertions': SOURCE_SEALS[ASSERTIONS]},
            'Actual exact12 RED/GREEN candidate role-policy rollback proof required.')
    proof = load_sealed(LOCAL_PROOF)
    # Final actual proof field names are pinned after the author supplies the
    # real receipt; this cannot be satisfied by a candidate-only parse result.
    require(proof['result'] == 'passed' and proof['migration_sha256'] == MIGRATION_SHA256
            and proof['before'] == proof['after'] and proof['before']['versions'] == versions()
            and proof['catalog_and_all_counts_restored'] is True and proof['rollback_verified'] is True
            and proof['transaction_completed_to_rollback'] is True and proof['cloud_called'] is False
            and proof['provider_called'] is False and proof['storage_http_tested'] is False
            and proof['candidate_ddl_executed'] is False and proof['persisted_schema_assertions_tested'] is True
            and proof['owned_backend_settled'] is True and proof['green_body_and_info_allowed'] is True
            and proof['scope_and_lease_negatives_passed'] is True and proof['environment']['system_identifier'] == '7701520506262638626'
            and proof['reviewed_manifest_sha256'] == MANIFEST_SHA256,
            'Actual persisted13 role-policy rollback proof required.')
    require(proof['harness_sha256'] == SOURCE_SEALS[PERSISTED_HARNESS] and proof['hashes']['assertions'] == SOURCE_SEALS[PERSISTED_ASSERTIONS],
            'Actual local receipt must bind exact reviewed harness/assertions.')
    local = load_sealed(LOCAL_CONTRACT)
    contract = local['policy_contract']
    require(local['result'] == 'passed' and local['read_only'] is True and local['cloud_called'] is False
            and local['readback_sha256'] == READBACK_SHA256 and local['system_identifier'] == '7701520506262638626'
            and local['harness_sha256'] == SOURCE_SEALS[PERSISTED_HARNESS]
            and contract['query_role'] == 'postgres' and contract['database'] == 'postgres'
            and contract['unrestricted_visibility'] is True and contract['versions'] == versions() and contract['runtime'] is None
            and proof['local_policy_contract'] == LOCAL_CONTRACT[0] and proof['local_policy_contract_sha256'] == LOCAL_CONTRACT[1]
            and local['catalog_sha256'] == proof['before']['catalog_sha256'], 'Actual source-bound compact local13 policy contract required.')
    for name, row in policy_rows(contract).items():
        require(hashlib.sha256(row['using'].encode()).hexdigest() == NEW_USING_SHA256[name], 'Local policy seal differs.')
    promotion = load_sealed(PROMOTION_PROOF)
    old_policies = policy_rows(baseline['readback'])
    require(promotion['result'] == 'passed' and promotion['migration_sha256'] == MIGRATION_SHA256
            and promotion['manifest_sha256'] == MANIFEST_SHA256 and promotion['observed_versions'] == versions()
            and promotion['business_rows_preserved'] is True and promotion['only_three_reviewed_read_predicates_changed'] is True
            and promotion['cloud_called'] is False and promotion['lock_retained'] is False
            and len(promotion['policy_effects']) == 3 and {row['name'] for row in promotion['policy_effects']} == set(POLICIES)
            and all(row['before_using_sha256'] == hashlib.sha256(old_policies[row['name']]['using'].encode()).hexdigest()
                    and row['after_using_sha256'] == NEW_USING_SHA256[row['name']] for row in promotion['policy_effects']),
            'Actual local12-to13 three-policy-only promotion proof required.')
    return {'migrations': expected, 'readback_sha256': READBACK_SHA256, 'manifest_sha256': MANIFEST_SHA256,
            'sources': SOURCE_SEALS, 'policy_sha256': NEW_USING_SHA256,
            'baseline': BASELINE, 'candidate_proof': CANDIDATE_PROOF, 'promotion_proof': PROMOTION_PROOF,
            'local_proof': LOCAL_PROOF, 'local_contract': LOCAL_CONTRACT,
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
