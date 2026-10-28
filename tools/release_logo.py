"""Fixed, reviewed private-logo release for the owner-selected canonical project.

Commands: dry-run | apply | readback. No SQL/file/host/project arguments are accepted.
The additive release provisions no key, identity, object bytes or runtime feature flag.
Failures after db push must be inspected with readback; never reset/rewrite history.
Repair applied DDL with a new reviewed forward migration. Existing business records
and private assets remain canonical; reverting app runtime to disabled is independent.
"""
import datetime
import hashlib
import json
import re
import subprocess
import sys
import tomllib
import uuid

from release_foundation import ROOT, TARGET, call

MIGRATIONS = {
    '20261028010943_m01_canonical_foundation.sql': '8a5f3ed7727a72051e630307d2daecab8c4a74054398a6425e73bd85e17568b9',
    '20261028013324_m01_identity_role_inheritance.sql': '5382efe9fbdf9c194010257e0ac0024dcb447207522036560056d5d1a4e20e30',
    '20261028013655_m01_workspace_scope_alias.sql': '67ddb2cff9fed9c42d34657e833c613aec4afd2769543a991bbac84da355db64',
    '20261028024205_m01_private_logo_boundary.sql': 'b04af5119b4e384bd96136573eec39e69f21a0ffb7d9f4aeb07bbf48f2976b9d',
}
PENDING = list(MIGRATIONS)[-1]
LOCAL_PROOF = 'development/local-db/receipts/2026-10-28T03-17-08-868Z-test-db-summary-6b069f43.json'
INTEROP_PROOF = 'development/local-db/receipts/2026-10-28T03-20-25-083Z-logo-node-sql-interop.json'
PROOF_HASHES = {
    LOCAL_PROOF: '6a75b05d256f74287330d28aa85d5f505d9f625f33f3a3d555ecb296a611a5e2',
    INTEROP_PROOF: '6dded7e038290c41fd1788881a9ffcec82c2e0b0837f25b2c203edc17994cc51',
    'tracking/evidence/cloud-foundation/apply.json': '568f76ded2cdda869682a4dd66d882aec2b61c1e43009c889650850f64abcb16',
}
PREFLIGHT_SQL = 'tools/sql/logo-release-preflight.sql'
READBACK_SQL = 'tools/sql/logo-foundation-readback.sql'
EVIDENCE = ROOT / 'tracking/evidence/cloud-logo-foundation'
PRIVATE = ROOT / '.local/cloud-logo-release'
BASE_RPCS = {
    'eps_get_capabilities', 'eps_list_projects', 'eps_get_project', 'eps_update_project',
    'eps_list_workspaces', 'eps_get_workspace', 'eps_create_workspace', 'eps_update_workspace',
    'eps_list_audience_presets', 'eps_create_audience_preset', 'eps_update_audience_preset', 'eps_archive_audience_preset',
}
LOGO_RPCS = {'eps_reserve_logo_upload', 'eps_get_logo_upload', 'eps_prepare_logo_completion',
             'eps_finalize_logo_completion', 'eps_cancel_logo_upload', 'eps_get_logo_media'}
RELATIONS = {'public.' + name for name in ('clients', 'projects', 'project_memberships', 'client_memberships', 'app_capability_grants')} | {
    'eps.' + name for name in ('workspaces', 'user_workspace_preferences', 'media_assets', 'audience_presets', 'idempotency_records', 'audit_events', 'upload_sessions', 'logo_verification_keys')}


class ReleaseBlocked(Exception):
    """Only fixed messages from this module may be printed on failure."""


def require(condition, message):
    if not condition:
        raise ReleaseBlocked(message)


def digest(relative):
    return hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()


def load(relative):
    return json.loads((ROOT / relative).read_text(encoding='utf-8'))


def verified_inputs():
    require(TARGET == 'pyibofyctwnqpvktepse', 'The fixed owner-selected target changed.')
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'The linked target is not the owner-selected canonical project.')
    config = tomllib.loads((ROOT / 'supabase/config.toml').read_text(encoding='utf-8'))
    require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False
            and config['db']['seed'].get('sql_paths') == [] and config['db']['migrations'].get('schema_paths') == [],
            'Require reviewed root migrations only, with seeds and schema-path imports disabled.')
    require(sorted(path.name for path in (ROOT / 'supabase/migrations').glob('*.sql')) == list(MIGRATIONS), 'The exact four-migration release set changed.')
    manifest = load('development/local-db/reviewed.json')
    require(manifest['version'] == 1, 'Unsupported reviewed manifest.')
    entries = manifest['migrations'] + manifest['tests']
    require(len({entry['path'] for entry in entries}) == len(entries), 'Duplicate reviewed manifest entries.')
    reviewed = {entry['path']: entry['sha256'] for entry in entries}
    for name, expected in MIGRATIONS.items():
        relative = 'supabase/migrations/' + name
        require(digest(relative) == expected and reviewed.get(relative) == expected, 'A migration differs from the exact reviewed release bytes.')
    for relative, expected in PROOF_HASHES.items():
        require(digest(relative) == expected, 'A fixed prerequisite evidence receipt changed.')
    previous = load('tracking/evidence/cloud-foundation/apply.json')
    require(previous['target'] == TARGET and previous['exit_code'] == 0 and previous['application_verified_by_readback'] is True
            and previous['hashes'] == dict(list(MIGRATIONS.items())[:3]) and previous['pending_migrations'] == list(MIGRATIONS)[:3],
            'The prior three-migration cloud application proof does not match.')
    proof = load(LOCAL_PROOF)
    require(proof['result'] == 'passed' and proof['cleanup']['result'] == 'passed' and proof['logo_cleanup']['result'] == 'passed'
            and proof['cleanup']['setup_confirmed'] is True and proof['logo_cleanup']['setup_confirmed'] is True
            and proof['cleanup']['attempted'] is True and proof['logo_cleanup']['attempted'] is True,
            'Successful local full-suite and both scoped cleanups are required.')
    stages = proof['stages']
    require(len(stages) == 19 and len({stage['path'] for stage in stages}) == 19, 'The fixed complete local acceptance stages are required.')
    for stage in stages:
        require(stage['result'] in ('passed', 'applied', 'already_applied') and reviewed.get(stage['path']) == stage['sha256']
                and digest(stage['path']) == stage['sha256'], 'Local acceptance no longer matches a reviewed SQL source.')
    pairs = proof['concurrency_pairs']
    require({pair['name'] for pair in pairs} == {'same-key-claim', 'distinct-key-claim', 'distinct-key-logo-completion'}
            and len(pairs) == 3, 'All actual local concurrency pairs are required.')
    for pair in pairs:
        sessions = pair['sessions']
        require(pair['result'] == 'passed' and pair['distinct_database_backends'] is True
                and pair['overlapping_reviewed_transaction_windows'] is True and pair['claim_exceeded_900_ms'] is True
                and len(sessions) == 2 and sessions[0]['session_pid'] != sessions[1]['session_pid']
                and any(session['claim_duration_ms'] > 900 for session in sessions), 'Actual two-backend overlapping lock-window proof is required.')
    interop = load(INTEROP_PROOF)
    require(interop['result'] == 'passed' and interop['rollback']['verified'] is True
            and all(type(value) is int and value == 0 for value in interop['rollback']['fixture_counts'].values())
            and all(interop['assertions'][name] is True for name in ('wrong_signature_rejected', 'ready_projection_verified', 'single_transition_verified', 'node_to_sql_receipt_verified')),
            'Actual Node-to-SQL proof and complete fixture rollback are required.')
    require(interop['sql_file'] == 'tests/db/m01-logo-node-interop.sql' and digest(interop['sql_file']) == interop['sql_sha256']
            and reviewed.get(interop['sql_file']) == interop['sql_sha256']
            and digest('packages/central/src/logo-receipt.ts') == interop['receipt_module_sha256'], 'Interop proof no longer matches current Node/SQL bytes.')
    sources = {relative: digest(relative) for relative in [
        'tools/release_logo.py', 'tools/release_foundation.py', PREFLIGHT_SQL, READBACK_SQL,
        'supabase/config.toml', 'development/local-db/reviewed.json', 'packages/central/src/logo-receipt.ts',
        interop['sql_file'], *PROOF_HASHES]}
    return {'migration_hashes': MIGRATIONS, 'source_hashes': sources}


def expected_history(state, include_logo):
    names = list(MIGRATIONS) if include_logo else list(MIGRATIONS)[:3]
    expected = [{'version': name[:14], 'name': name[15:-4]} for name in names]
    require(state.get('query_role') == 'postgres' and state.get('database') == 'postgres', 'The fresh query role/database differs from the fixed release target.')
    require(state.get('count_visibility_unrestricted') is True, 'Fresh administrative count snapshots must not be filtered by RLS.')
    require(state.get('migrations') == expected, 'Remote migration history differs from the exact expected canonical history; reconcile without overwrite.')


def validate_preflight(state):
    require(set(state) == {'query_role', 'database', 'postgres_version', 'count_visibility_unrestricted', 'migrations', 'logo_table_collisions', 'logo_role_collision',
            'logo_bucket_collision', 'logo_function_collisions', 'logo_policy_collisions', 'prerequisites', 'counts'}, 'Unexpected preflight metadata fields.')
    expected_history(state, False)
    require(state.get('logo_table_collisions') == [] and state.get('logo_role_collision') is False
            and state.get('logo_bucket_collision') is False and state.get('logo_function_collisions') == []
            and state.get('logo_policy_collisions') == [], 'Pending logo objects collide with existing remote state; preserve and reconcile.')
    require(set(state['prerequisites']) == {'storage_objects_rls', 'storage_buckets_rls', 'storage_operation_helper', 'hmac', 'bucket_insert', 'authenticated_admin', 'storage_policy_delegate'}
            and all(value is True for value in state['prerequisites'].values()), 'Managed Storage/HMAC/role/policy prerequisites are missing.')
    require(all(type(value) is int and value >= 0 for value in state['counts'].values()), 'Invalid preflight count snapshot.')


def expression(value):
    return re.sub(r'[\s()]', '', (value or '').replace('::text', ''))


def validate_readback(state):
    require(set(state) == {'query_role', 'database', 'postgres_version', 'count_visibility_unrestricted', 'migrations', 'canonical_relations', 'user_rpc_security',
            'verifier_role', 'verifier_auth_membership', 'unsafe_membership', 'private_boundary', 'brand_bucket', 'logo_policies',
            'capability_uploads_remain_disabled', 'counts'}, 'Unexpected readback metadata fields.')
    expected_history(state, True)
    relations = state['canonical_relations']
    require(len(relations) == 13 and {row['schema'] + '.' + row['table'] for row in relations} == RELATIONS
            and all(row['rls'] is True and row['force_rls'] is True for row in relations), 'Readback must show exactly thirteen expected forced-RLS canonical tables.')
    rpcs = state['user_rpc_security']
    require(len(rpcs) == 18 and {rpc['name'] for rpc in rpcs} == BASE_RPCS | LOGO_RPCS, 'Readback must show exactly eighteen expected user RPCs.')
    for rpc in rpcs:
        require(rpc['owner'] == ('eps_logo_verify_owner' if rpc['name'] == 'eps_finalize_logo_completion' else 'eps_api_owner')
                and rpc['definer'] is True and rpc['anonymous_execute'] is False and rpc['authenticated_execute'] is True
                and rpc['config'] == ['search_path=""'], 'An RPC owner, execution grant or fixed search_path differs.')
    role = state['verifier_role']
    require(role['name'] == 'eps_logo_verify_owner' and all(role[name] is False for name in ('login', 'superuser', 'bypassrls', 'create_role', 'create_db'))
            and state['verifier_auth_membership'] == {'inherit': True, 'set': False, 'admin': False} and state['unsafe_membership'] is False,
            'Verifier role authority or membership is unsafe.')
    require(len(state['private_boundary']) == 8 and all(value is False for value in state['private_boundary'].values()), 'Private key/verification/canonical-DML grants are unsafe.')
    bucket = state['brand_bucket']
    require(bucket['id'] == bucket['name'] == 'eps-brand-assets' and bucket['public'] is False and bucket['maximum_bytes'] == 5242880
            and len(bucket['mime_types']) == 3 and set(bucket['mime_types']) == {'image/png', 'image/jpeg', 'image/webp'}, 'Private bucket configuration differs from the reviewed limits.')
    allowed_insert = "eps.logo_storage_insert_allowedbucket_id,name"
    allowed_read = "eps.logo_storage_read_allowedbucket_id,name"
    bucket_is = "bucket_id='eps-brand-assets'"
    bucket_not = "bucket_id<>'eps-brand-assets'"
    policies = {
        'eps_logo_insert': ('storage.objects', True, 'a', ['authenticated'], '', bucket_is + 'AND' + allowed_insert),
        'eps_logo_insert_guard': ('storage.objects', False, 'a', ['authenticated'], '', bucket_not + 'OR' + allowed_insert),
        'eps_logo_update_guard': ('storage.objects', False, 'w', ['authenticated'], bucket_not, bucket_not),
        'eps_logo_delete_guard': ('storage.objects', False, 'd', ['authenticated'], bucket_not, ''),
        'eps_logo_read': ('storage.objects', True, 'r', ['authenticated'], bucket_is + 'AND' + allowed_read, ''),
        'eps_logo_read_guard': ('storage.objects', False, 'r', ['authenticated'], bucket_not + 'OR' + allowed_read, ''),
        'eps_logo_verifier_no_storage': ('storage.objects', False, '*', ['eps_logo_verify_owner'], 'false', 'false'),
        'eps_logo_verifier_no_buckets': ('storage.buckets', False, '*', ['eps_logo_verify_owner'], 'false', 'false'),
    }
    require(len(state['logo_policies']) == 8 and {policy['name'] for policy in state['logo_policies']} == set(policies), 'Expected eight fixed Storage policies.')
    for policy in state['logo_policies']:
        actual = (policy['table'], policy['permissive'], policy['command'], policy['roles'], expression(policy['using']), expression(policy['with_check']))
        require(actual == policies[policy['name']], 'A Storage policy differs from the reviewed command/role/restriction expression.')
    require(state['capability_uploads_remain_disabled'] is True and state['counts']['verification_keys'] == 0,
            'This release must retain unavailable upload capabilities and zero provisioned verification keys.')
    require(all(type(value) is int and value >= 0 for value in state['counts'].values()), 'Invalid readback count snapshot.')


def raw_call(arguments, label, run_id):
    def save(stdout, stderr):
        def decoded(value):
            return value.decode('utf-8', errors='replace') if isinstance(value, bytes) else value or ''
        with (PRIVATE / (run_id + '-' + label + '-raw.txt')).open('x', encoding='utf-8') as handle:
            handle.write(decoded(stdout) + '\n' + decoded(stderr))
    try:
        result = call(arguments)
    except subprocess.TimeoutExpired as error:
        save(error.stdout, error.stderr)
        raise ReleaseBlocked('Fixed cloud CLI call timed out; inspect private diagnostics/readback before retrying.') from None
    save(result.stdout, result.stderr)
    return result


def query(relative, field, run_id):
    result = raw_call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / relative), '--output-format', 'json'], field, run_id)
    require(result.returncode == 0, 'Fixed read-only cloud metadata query failed; inspect private diagnostics.')
    payload = json.loads(result.stdout)
    require(len(payload['rows']) == 1 and set(payload['rows'][0]) == {field}, 'Unexpected cloud metadata result shape.')
    return payload['rows'][0][field]


def latest_dry_run(inputs):
    receipts = sorted(EVIDENCE.glob('*-dry-run.json'))
    require(bool(receipts), 'A successful exact dry-run receipt is required before application.')
    previous = json.loads(receipts[-1].read_text(encoding='utf-8'))
    require(previous['action'] == 'dry-run' and previous['target'] == TARGET and previous['result'] == 'passed'
            and previous['exit_code'] == 0 and previous['pending_migrations'] == [PENDING] and previous['inputs'] == inputs,
            'The latest dry-run did not succeed with this exact tool, evidence, SQL and migration set.')
    return receipts[-1].name


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    require(action in ('dry-run', 'apply', 'readback'), 'Use only dry-run, apply or readback for this fixed logo release.')
    inputs = verified_inputs()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    PRIVATE.mkdir(parents=True, exist_ok=True)
    run_id = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8]
    receipt = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'action': action, 'target': TARGET,
               'result': 'failed', 'inputs': inputs, 'seeds': False, 'vault_sync': False, 'key_provisioning': False,
               'runtime_enablement': False, 'raw_diagnostics': 'ignored .local/cloud-logo-release/ only',
               'application_verified_by_readback': False, 'counts_are_snapshots_only': True,
               'limitations': 'Metadata/DDL proof only. Genuine-user Storage HTTP, private byte transfer and Sharp verification remain separate gates.'}
    try:
        if action == 'readback':
            state = query(READBACK_SQL, 'readback', run_id)
            validate_readback(state)
            receipt.update(readback=state, result='passed', application_verified_by_readback=True)
        else:
            if action == 'apply':
                receipt['dry_run_receipt'] = latest_dry_run(inputs)
            before = query(PREFLIGHT_SQL, 'preflight', run_id)
            validate_preflight(before)
            receipt['preflight'] = before
            require(verified_inputs() == inputs, 'Release inputs changed during fresh preflight; stop and review.')
            command = ['db', 'push', '--linked', '--project-ref', TARGET, '--skip-vault', '--yes', '--output-format', 'json']
            if action == 'dry-run':
                command.append('--dry-run')
            receipt['application_attempted'] = action == 'apply'
            result = raw_call(command, action, run_id)
            receipt['exit_code'] = result.returncode
            receipt['pending_migrations'] = sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql', result.stdout + '\n' + result.stderr)))
            require(result.returncode == 0 and receipt['pending_migrations'] == [PENDING], 'Cloud push did not report successful execution of exactly the one pending logo migration; inspect diagnostics/readback before retrying.')
            require(verified_inputs() == inputs, 'Release inputs changed during execution; inspect readback before proceeding.')
            if action == 'apply':
                after = query(READBACK_SQL, 'readback', run_id)
                validate_readback(after)
                receipt.update(readback=after, application_verified_by_readback=True)
            receipt['result'] = 'passed'
    except ReleaseBlocked as error:
        receipt['reason'] = str(error)
    except Exception as error:
        receipt.update(reason='Release verification failed; raw exception details suppressed.', error_type=type(error).__name__)
    with (EVIDENCE / (run_id + '-' + action + '.json')).open('x', encoding='utf-8') as handle:
        handle.write(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))
    return 0 if receipt['result'] == 'passed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except ReleaseBlocked as error:
        print(json.dumps({'result': 'blocked', 'reason': str(error), 'cloud_mutation_attempted': False}))
        sys.exit(1)
    except Exception as error:
        print(json.dumps({'result': 'blocked', 'reason': 'Local release prerequisites could not be verified.', 'error_type': type(error).__name__, 'raw_errors_suppressed': True}))
        sys.exit(1)
