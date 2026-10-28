"""Fixed8→9 role-order DDL release. No provider, identity or business writes.

Only dry-run/apply/readback are accepted. Actual nine-version proof and catalog
seals remain fail-closed until available; historical eight-version acceptance is
never relaxed. A lost/unknown dispatch is journaled and inspected, never retried.
"""
from pathlib import Path
import copy
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tomllib
import uuid

import release_manual_specs as prior

ROOT = Path(__file__).resolve().parents[1]
TARGET = 'pyibofyctwnqpvktepse'
HISTORICAL = {
    'tools/release_manual_specs.py': 'd535de68948547acb205881d336f525f272e1d032c1059ba4da12a8f5784d62f',
    'tools/sql/manual-specs-readback.sql': 'f4abfc3c8a73647d61d4abdf7152d674af51194fc02f52ebf5c0d214aeb54c07',
    'tools/release_processing_foundation.py': '3f1c6b10e62e9713aaa511f332bcc554f9254ad4eec8564a02f59d6bf4fa8336',
    'tools/sql/processing-foundation-readback.sql': '24d305c117aa61888de98a6dbfb732a20cc53c527804e192f735adc0e7715189',
}
PENDING = ['20261028184145_m02_role_order.sql']
MIGRATIONS = {**prior.MIGRATIONS, PENDING[0]: '14f96c7e635fe46cb11393a881bca26068d696c32f5e454df8655299702b1efa'}
VERSIONS = [name[:14] for name in MIGRATIONS]
READBACK = 'tools/sql/role-order-readback.sql'
READBACK_HASH = 'ee010b55340211c5a012789bed5e25b416deb7c45c9339e763e8a01144c54110'
POLICY_EXPRESSIONS_HASH = 'd8a173c150e49ec7c664e0e8076ae6e222692a36182425cde0097207940804be'
EVIDENCE = ROOT / 'tracking/evidence/cloud-role-order'
PROOFS = {key: (None, None) for key in ('prior_cloud', 'full_db', 'm01_replay', 'm02_local', 'manual_specs', 'role_order_local', 'local_contract')}
PROOFS['prior_cloud'] = ('tracking/evidence/cloud-manual-specs/2026-10-28T18-21-07-451865Z-b7e8cd80-readback.json',
                         'c5057eb3cdf4ea2f1e26647c47d7dcccd9d7501a6b073975242941efd3b5c065')
PROOFS['role_order_local'] = ('tracking/evidence/m02/role-order-local/2026-10-28T19-02-20-589Z-b9d09e55.json',
                             'a1e71accdcf0bac8312099977e2f36945aab59e0e38a38a0ea1f97ca82735218')
PROOFS.update({
    'full_db': ('development/local-db/receipts/2026-10-28T19-03-28-322Z-test-db-summary-499067f3.json', 'daf7bbb0690b4d154aa744c5e0b23530844ab56890da7ae2e80e35b2dd9676ed'),
    'm02_local': ('tracking/evidence/m02/local/2026-10-28T19-05-03-586Z-35d591fb.json', '4f372bcaea861e37a6691711b0ca66e4a714df1db75b6c8a16283ac64fb7ff32'),
    'manual_specs': ('tracking/evidence/m02/specs-local/2026-10-28T19-06-45-233Z-5698a461.json', 'd50e0dc0791b1b322980d18cf0ddf3852008c0ff2a0284884118bb3877a58807'),
    'm01_replay': ('tracking/evidence/m01/replay-scope/2026-10-28T19-09-29-124Z-fixed.json', '8718e094a590e2bcf949e824418ffdabdd2fa82167dc49894fe444c98efc3ccf'),
    'local_contract': ('tracking/evidence/cloud-role-order/local-contract.json', 'd9a6f34790a7467cc51709ea6837ffdd63eaf3a945d86804f7c922d344a91bdc'),
})
SOURCE_SEALS = {path: None for path in ('tools/test-db.mjs', 'tools/test-m01-replay-scope.mjs', 'tools/test-m02-local.mjs',
    'tools/test-m02-specs-local.mjs', 'tools/test-m02-role-order-local.mjs', 'tools/local-postgres.mjs')}
SOURCE_SEALS.update({
    'tools/test-db.mjs': '3681f4beaf7a9351b5078a4bc23017094be7abb2f0288e8ddbf8e1b21ba35577',
    'tools/test-m01-replay-scope.mjs': '7286314bc425f35ac8a85a8fb8f8d8042d647975a9957674b589378bad6f06eb',
    'tools/test-m02-local.mjs': '4023dd1058323f3ea3efcfbef7c467bf6d0c0d8110dc0621b44b7d62e756a9c6',
    'tools/test-m02-specs-local.mjs': 'e638a0686312564912155af6f4262f5d8107d95bfb892df84838cd90333bee91',
    'tools/test-m02-role-order-local.mjs': 'a57c345e1d3b2e3c3b40a9dbcee35fee7193a4147348391d1cc981c92edcd684',
    'tools/local-postgres.mjs': '49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de',
})
ROLE_ORDER_PAIRS = ('reorder-versus-editor', 'create-versus-stale-reorder',
                    'revoked-cached-reorder', 'cleanup-preserves-source-after-wait')
FUNCTIONS = {'eps.specs_order_workspace_dto', 'public.eps_reorder_workspace'}
POLICIES = {'specs_order_replay_read': ('eps.idempotency_records', 'r'),
            'specs_order_replay_insert': ('eps.idempotency_records', 'a'), 'specs_order_audit': ('eps.audit_events', 'a')}
Blocked = prior.Blocked
require = prior.require


def digest(relative):
    return hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()


def read_json(relative):
    return json.loads((ROOT / relative).read_text(encoding='utf-8'))


def definitions():
    """Parse only the two reviewed simple routine declarations in migration9."""
    sql = (ROOT / 'supabase/migrations' / PENDING[0]).read_text(encoding='utf-8')
    result = {}
    for match in re.finditer(r'^create function\s+(\w+)\.(\w+)\s*(\([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$;', sql, re.M | re.I):
        schema, function, header, body = match.groups(); name = schema + '.' + function
        require(name in FUNCTIONS and name not in result, 'Unexpected role-order routine/overload in the fixed source.')
        declaration = re.match(r'^\(([\s\S]*?)\)\s*returns\s+([\w.]+)\s+language\b', header, re.I)
        require(declaration is not None, 'Fixed role-order routine declaration needs review.')
        arguments = []
        for argument in declaration.group(1).split(',') if declaration.group(1).strip() else []:
            parsed = re.match(r'^\s*(\w+)\s+([\w.]+(?:\[\])?)(?:\s+default\b[\s\S]*)?\s*$', argument, re.I)
            require(parsed is not None, 'Fixed role-order named argument declaration needs review.')
            arguments.append(parsed.groups())
        result[name] = {'signature': name + '(' + ', '.join(kind for _, kind in arguments) + ')',
            'identity_arguments': ', '.join(argument + ' ' + kind for argument, kind in arguments), 'returns': declaration.group(2),
            'source_sha256': hashlib.sha256(body.replace('\r\n', '\n').encode()).hexdigest(),
            'owner': 'eps_api_owner' if schema == 'eps' else 'eps_specs_owner', 'definer': True, 'volatility': 'v', 'language': 'plpgsql'}
        require(re.search(r'\bsecurity\s+definer\b', header, re.I) and re.search(r'\bvolatile\b', header, re.I)
                and re.search(r'\blanguage\s+plpgsql\b', header, re.I), 'Reviewed role-order security/volatility declaration changed.')
    require(set(result) == FUNCTIONS, 'Exact two role-order routines required.')
    return result


def old_projection(state, applied):
    """Remove only known additions; the entire remaining8 contract stays strict."""
    require(sum(row['name'] == 'public.eps_reorder_workspace' for row in state['base']['functions']) == int(applied)
            and sum(row['name'] == 'eps.specs_order_workspace_dto' for row in state['manual']['functions']) == int(applied)
            and sorted(row['name'] for row in state['manual']['policies'] if row['name'] in POLICIES) == (sorted(POLICIES) if applied else []),
            'The broad catalog must contain exactly the known9 additions before projection.')
    projected = copy.deepcopy(state)
    projected.pop('role_order')
    projected['base']['versions'] = VERSIONS[:8]
    projected['base']['functions'] = [row for row in projected['base']['functions'] if row['name'] != 'public.eps_reorder_workspace']
    projected['manual']['functions'] = [row for row in projected['manual']['functions'] if row['name'] != 'eps.specs_order_workspace_dto']
    projected['manual']['policies'] = [row for row in projected['manual']['policies'] if row['name'] not in POLICIES]
    rows = [row for row in projected['manual']['column_acls'] if (row['table'], row['column'], row['role']) == ('eps.roles', 'sort_order', 'eps_specs_owner')]
    require(len(rows) == 1 and rows[0]['update'] is applied, 'The explicit role sort-order UPDATE delta differs.')
    rows[0]['update'] = False
    return projected


def validate_state(state):
    versions = state['base']['versions']
    require(versions in (VERSIONS[:8], VERSIONS), 'Cloud history is outside exact8-before/9-after states.')
    applied = versions == VERSIONS; order = state['role_order']
    # Pure8 catalog validation only. Never invoke prior.prerequisites/main/CLI.
    require(prior.validate_state(old_projection(state, applied)) == 'applied', 'The unchanged eight-version catalog contract differs.')
    require(set(order['data_sha256']) == {'specs', 'roles', 'slots', 'preferences'}
            and all(re.fullmatch('[a-f0-9]{64}', value) for value in order['data_sha256'].values()), 'Source/order/preferences preservation digest missing.')
    acls = order['sort_order_acl']
    prior.unique_rows(acls, ('role',), {(role,) for role in prior.ROLES})
    for row in acls:
        for privilege in ('select', 'insert', 'update', 'references'):
            allowed = row['role'] == 'eps_specs_owner' and (privilege in ('select', 'insert') or applied and privilege == 'update')
            require(row[privilege] is allowed, 'Role sort-order column authority differs from the exact narrow delta.')
    if not applied:
        require(order['functions'] == order['policies'] == []
                and not any(row['name'] in FUNCTIONS for row in state['base']['functions'] + state['manual']['functions'])
                and not any(row['name'] in POLICIES for row in state['manual']['policies']), 'Role-order routine/overload/policy collision before9; preserve state.')
        return 'pending'
    expected = definitions()
    prior.unique_rows(order['functions'], ('name',), {(name,) for name in FUNCTIONS})
    for function in order['functions']:
        require(all(function[key] == value for key, value in expected[function['name']].items()) and function['config'] == ['search_path=""']
                and function['public_execute'] is False and set(function['execute']) == prior.ROLES, 'Role-order routine source/signature/named arguments/result/security differs.')
        for role in prior.ROLES:
            allowed = role in ({'eps_api_owner', 'eps_specs_owner'} if function['name'].startswith('eps.') else
                {'authenticated', 'eps_api_owner', 'eps_logo_verify_owner', 'eps_jobs_owner', 'eps_specs_owner'})
            require(function['execute'][role] is allowed, 'Role-order helper/RPC execute boundary differs.')
    policies = order['policies']
    prior.unique_rows(policies, ('name',), {(name,) for name in POLICIES})
    for policy in policies:
        require((policy['table'], policy['command']) == POLICIES[policy['name']] and policy['permissive'] is True
                and policy['roles'] == ['eps_specs_owner'], 'Role-order policy target/command/roles differs.')
    expressions = [{key: row[key] for key in ('name', 'using', 'check')} for row in sorted(policies, key=lambda row: row['name'])]
    require(POLICY_EXPRESSIONS_HASH is not None and hashlib.sha256(json.dumps(expressions, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == POLICY_EXPRESSIONS_HASH,
            'Role-order RLS expressions differ from the reviewed actual local catalog.')
    return 'applied'


def stage_seals(proof, reviewed):
    require(proof['reviewed_manifest_sha256'] == digest('development/local-db/reviewed.json'), 'Fresh9 proof manifest differs.')
    for stage in proof['stages']:
        entry = reviewed.get(stage['path'], {})
        require(stage['result'] in ('passed', 'applied', 'already_applied', 'expected_rejection')
                and stage['sha256'] == entry.get('sha256') == digest(stage['path']), 'Fresh9 SQL proof stage/source differs.')
        if stage['result'] == 'expected_rejection':
            require(stage.get('code') in ('SPECS_LOCAL_SOURCE_PRESERVATION_REQUIRED', 'ROLE_ORDER_LOCAL_SOURCE_PRESERVATION_REQUIRED'), 'Unexpected proof rejection.')
    require({stage['path'] for stage in proof['stages'] if stage['path'].startswith('supabase/migrations/')} == {'supabase/migrations/' + name for name in MIGRATIONS}, 'All nine migration replays required.')


def prerequisites():
    require(all(MIGRATIONS.values()) and READBACK_HASH and POLICY_EXPRESSIONS_HASH and ROLE_ORDER_PAIRS
            and all(path and seal for path, seal in PROOFS.values()) and all(SOURCE_SEALS.values()), 'Fresh9 source/proof/catalog seals not configured; no CLI is permitted.')
    for path, expected in HISTORICAL.items():
        require(digest(path) == expected, 'A frozen prior release helper/SQL changed.')
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'Linked target differs.')
    config = tomllib.loads((ROOT / 'supabase/config.toml').read_text())
    require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False, 'Reviewed migrations and disabled seeds required.')
    require(sorted(path.name for path in (ROOT / 'supabase/migrations').glob('*.sql')) == list(MIGRATIONS), 'Exact nine-file history required.')
    manifest = read_json('development/local-db/reviewed.json'); entries = manifest['migrations'] + manifest['tests']
    require(len(manifest['migrations']) == 9 and len({entry['path'] for entry in entries}) == len(entries), 'Exact unique reviewed9 history required.')
    reviewed = {entry['path']: entry for entry in entries}
    for name, expected in MIGRATIONS.items():
        path = 'supabase/migrations/' + name; entry = reviewed.get(path, {})
        require(digest(path) == expected == entry.get('sha256') and entry.get('reviewed_by') and entry.get('reviewed_at'), 'A reviewed migration source seal changed.')
    for path, expected in SOURCE_SEALS.items():
        require(digest(path) == expected, 'A fixed9 proof harness changed.')
    require(digest(READBACK) == READBACK_HASH, 'Fixed9 metadata SQL changed.')
    proofs = {}
    for key, (path, expected) in PROOFS.items():
        require(digest(path) == expected, 'A sealed9 prerequisite receipt changed.'); proofs[key] = read_json(path)
        if key != 'local_contract': require(proofs[key]['result'] == 'passed', 'A fresh9 prerequisite did not pass.')
    cloud, full, replay, core, manual, local = (proofs[key] for key in ('prior_cloud', 'full_db', 'm01_replay', 'm02_local', 'manual_specs', 'role_order_local'))
    require(cloud['target'] == TARGET and cloud['action'] in ('apply', 'readback') and cloud['application_verified_by_readback'] is True
            and cloud['readback']['base']['versions'] == VERSIONS[:8] and prior.validate_state(cloud['readback']) == 'applied', 'Exact prior8 cloud release required.')
    require(len(full['stages']) == 25 and full['cleanup']['result'] == full['logo_cleanup']['result'] == 'passed' and len(full['concurrency_pairs']) == 3
            and all(pair['result'] == 'passed' and pair['distinct_database_backends'] and pair['overlapping_reviewed_transaction_windows'] for pair in full['concurrency_pairs']), 'Fresh9 full M01 SQL suite/three races/cleanups required.')
    require(replay['mode'] == 'fixed' and replay['migration_sha256'] == MIGRATIONS['20261028162702_m01_replay_scope_refresh.sql']
            and replay['harness_sha256'] == SOURCE_SEALS['tools/test-m01-replay-scope.mjs'] and replay['cloud_called'] is False and replay['service_credentials_used'] is False
            and replay['before'] == replay['after'] and replay['cleanup']['result'] == 'passed' and len(replay['cases']) == 11
            and all(case['exact_advisory_wait_observed'] and case['legitimate_replay_passed'] and case['denied_after_concurrent_revocation'] and case['holder_pid'] != case['waiter_pid'] for case in replay['cases']), 'Fresh9 eleven-case fixed replay proof required.')
    require(core['cleanup'] == 'passed' and core['before'] == core['after'] and core['before']['versions'] == VERSIONS and len(core['stages']) == 29
            and len(core['concurrency']) == 6 and {pair['name'] for pair in core['concurrency']} == {'same-input-distinct-key-enqueue', 'two-job-skip-locked', 'revoked-cached-replay', 'same-event-single-lease', 'cancel-before-dispatch-finish', 'dispatch-finish-before-cancel'}
            and all(pair['distinct_backends'] for pair in core['concurrency'])
            and all(core['after'][key] == 0 for key in ('jobs', 'outbox', 'events')) and core['after']['fixture_present'] is False
            and core['restart']['same_container'] is True and core['restart']['same_volume'] is True
            and core['restart']['system_identifier'] == core['environment']['system_identifier']
            and core['environment']['container'] == 'eps-presentation-canonical-pg17-local'
            and core['environment']['host_ip'] == '127.0.0.1' and core['environment']['host_port'] == '55433'
            and core['after']['restricted_dispatcher'] is True
            and all(core['before'][key] == 'on' for key in ('fsync', 'synchronous_commit', 'full_page_writes'))
            and all(core[key] is False for key in ('cloud_called', 'provider_called', 'stage_callbacks_tested', 'dispatcher_daemon_tested')), 'Fresh9 local queue races/restart/fencing/cleanup required.')
    require(manual['cleanup'] == 'passed' and manual['all_business_counts_restored'] is True and manual['before'] == manual['after'] and manual['before']['versions'] == VERSIONS
            and manual['harness_sha256'] == SOURCE_SEALS['tools/test-m02-specs-local.mjs'] and len(manual['concurrency']) == 4
            and {pair['name'] for pair in manual['concurrency']} == {'same-key-role-create', 'rename-versus-resize', 'revoked-cached-role-replay', 'cleanup-preserves-source-after-row-wait'}
            and all(pair['actual_blocker_sampled'] and pair['holder_pid'] != pair['waiter_pid'] for pair in manual['concurrency'])
            and all(manual[key] is False for key in ('cloud_called', 'provider_called', 'source_submission_tested', 'assignment_retirement_integrated', 'job_callbacks_tested')), 'Fresh9 manual-specs regressions/actual waits/restoration required.')
    require(local['cleanup'] == 'passed' and local['all_business_counts_restored'] is True and local['application_preserved_business_counts'] is True
            and local['before'] == local['after'] and local['before']['versions'] == local['expected_versions'] == VERSIONS
            and local['before']['fixture_present'] is False and len(local['stages']) == 23
            and local['harness_sha256'] == SOURCE_SEALS['tools/test-m02-role-order-local.mjs']
            and len(local['concurrency']) == 4 and {pair['name'] for pair in local['concurrency']} == set(ROLE_ORDER_PAIRS)
            and all(pair['actual_blocker_sampled'] and pair['distinct_backends'] and pair['holder_pid'] != pair['waiter_pid'] for pair in local['concurrency'])
            and local['environment']['container'] == core['environment']['container']
            and local['environment']['system_identifier'] == core['environment']['system_identifier']
            and all(local[key] is False for key in ('cloud_called', 'provider_called', 'source_submission_tested', 'assignments_integrated', 'dispatcher_daemon_tested')),
            'Fresh9 persisted role-order/editor/create/revocation proof and cleanup required.')
    flags = {pair['name']: pair for pair in local['concurrency']}
    require(flags['reorder-versus-editor']['edited'] is True and flags['create-versus-stale-reorder']['stale_rejected'] is True
            and flags['revoked-cached-reorder']['revoked_replay_denied'] is True and flags['cleanup-preserves-source-after-wait']['cleanup_denied'] is True,
            'Exact role-order concurrency outcomes required.')
    for proof in (full, core, manual, local): stage_seals(proof, reviewed)
    contract = proofs['local_contract']
    require(contract['cloud_called'] is False and contract['readback_sha256'] == READBACK_HASH
            and contract['system_identifier'] == core['environment']['system_identifier'] and validate_state(contract['readback']) == 'applied', 'Exact fixed local9 catalog contract proof required.')
    definitions()
    return {'migration_hashes': MIGRATIONS, 'proofs': {key: {'path': path, 'sha256': seal} for key, (path, seal) in PROOFS.items()},
            'source_seals': SOURCE_SEALS, 'historical_seals': HISTORICAL, 'readback_sha256': READBACK_HASH,
            'policy_expressions_sha256': POLICY_EXPRESSIONS_HASH, 'reviewed_manifest_sha256': digest('development/local-db/reviewed.json'),
            'release_helper_sha256': digest('tools/release_role_order.py')}


def inspect():
    result = call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / READBACK), '--output-format', 'json'])
    require(result.returncode == 0, 'Fixed read-only role-order inspection failed; raw diagnostics suppressed.')
    state = json.loads(result.stdout)['rows'][0]['role_order_release']
    for section in ('base', 'manual', 'role_order'):
        for function in state[section]['functions']:
            function['source_sha256'] = hashlib.sha256(function.pop('source').replace('\r\n', '\n').encode()).hexdigest()
    try: return validate_state(state), state
    except Blocked as error:
        error.snapshot = state
        raise


def compare_preserved(before, after):
    prior.compare_preserved(before, after)
    require(before['manual']['counts'] == after['manual']['counts'] and before['role_order']['data_sha256'] == after['role_order']['data_sha256'],
            'Source/role order/slots/preferences changed; applied history retained for reconciliation.')


def call(arguments):
    return subprocess.run(['npx.cmd', '--yes', 'supabase@2.122.0', *arguments, '--workdir', str(ROOT)], cwd=ROOT,
                          capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=90)


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def retain(receipt, phase):
    name = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + phase + '.json'
    with (EVIDENCE / name).open('x', encoding='utf-8') as file:
        json.dump(receipt, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
    return name


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    require(action in ('dry-run', 'apply', 'readback'), 'Use dry-run, apply or readback with no target/file overrides.')
    inputs = prerequisites()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    receipt = {'observed_at': stamp(), 'target': TARGET, 'action': action, 'inputs': inputs, 'result': 'failed',
               'application_status': 'not_attempted', 'application_verified_by_readback': False, 'schema_cache_notified': False,
               'runtime_flag_changed': False, 'identity_provisioned': False, 'provider_or_service_provisioned': False,
               'seeds': False, 'vault_sync': False, 'raw_diagnostics_recorded': False, 'pipeline_acceptance': False}
    try:
        mode, before = inspect(); receipt.update(before_mode=mode, before=before)
        if mode == 'applied':
            receipt['application_status'] = 'verified_existing'
            receipt['application_verified_by_readback'] = True
        if action != 'readback':
            require(mode == 'pending', 'Release already applied/unknown; inspect instead of replaying a mutator.')
            if action == 'apply':
                prior = json.loads((EVIDENCE / 'dry-run.json').read_text(encoding='utf-8'))
                age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(prior['finished_at'])).total_seconds()
                require(prior['result'] == 'passed' and prior['inputs'] == inputs and prior['target'] == TARGET and prior['action'] == 'dry-run'
                        and prior['pending_migrations'] == PENDING and prior['readback'] == before and 0 <= age <= 3600,
                        'Exact successful fresh dry-run/current preflight match required.')
            receipt['application_status'] = 'unknown_until_readback' if action == 'apply' else 'not_attempted'
            receipt['attempt_receipt'] = retain(receipt, action + '-attempt')
            command = ['db', 'push', '--linked', '--project-ref', TARGET, '--skip-vault', '--yes', '--output-format', 'json']
            if action == 'dry-run':
                command.append('--dry-run')
            try:
                result = call(command)
                receipt['exit_code'] = result.returncode
                receipt['pending_migrations'] = sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql', result.stdout + '\n' + result.stderr)))
            except Exception:
                receipt['dispatch_response_unavailable'] = True
        after_mode, after = inspect()
        receipt.update(after_mode=after_mode, readback=after, application_verified_by_readback=after_mode == 'applied',
                       application_status={'pending': 'verified_pending', 'applied': 'verified_applied'}[after_mode])
        expected_mode = 'pending' if action == 'dry-run' else ('applied' if action == 'apply' else mode)
        require(after_mode == expected_mode, 'Observed unexpected application; preserve and reconcile before another mutator.')
        compare_preserved(before, after)
        if action != 'readback':
            require(receipt.get('exit_code') == 0 and receipt.get('pending_migrations') == PENDING, 'Dispatch response unconfirmed; readback state retained, do not blindly retry.')

        receipt['result'] = 'passed'
    except Blocked as error:
        receipt['reason'] = str(error)
        if error.snapshot is not None:
            receipt['unverified_readback'] = error.snapshot
        raise
    except Exception:
        receipt['reason'] = 'Fixed release could not be confirmed; inspect retained history, raw diagnostics suppressed.'
        raise
    finally:
        receipt['finished_at'] = stamp()
        retain(receipt, action)
        if action == 'dry-run' and receipt['result'] == 'passed':
            temporary = EVIDENCE / ('dry-run-pointer-' + uuid.uuid4().hex + '.tmp')
            with temporary.open('x', encoding='utf-8') as file:
                json.dump(receipt, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
            os.replace(temporary, EVIDENCE / 'dry-run.json')
        print(json.dumps(receipt, indent=2))

if __name__ == '__main__':
    try:
        main()
    except Blocked as error:
        print(json.dumps({'result': 'blocked', 'reason': str(error), 'raw_diagnostics_recorded': False})); sys.exit(1)
    except Exception:
        print(json.dumps({'result': 'blocked', 'reason': 'Fixed release could not be confirmed; raw diagnostics suppressed.', 'raw_diagnostics_recorded': False})); sys.exit(1)
