"""Fixed five-to-seven migration release. No provider/service/identity setup.

Only dry-run, apply and readback are accepted. All SQL, targets, source and proof
seals are fixed here. A partial/unknown outcome requires inspection, never an
automatic mutator retry. Successful DDL is not M02 pipeline acceptance.
"""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import subprocess
import sys
import tomllib
import uuid

ROOT = Path(__file__).resolve().parents[1]
TARGET = 'pyibofyctwnqpvktepse'
MIGRATIONS = {
    '20261028010943_m01_canonical_foundation.sql': '8a5f3ed7727a72051e630307d2daecab8c4a74054398a6425e73bd85e17568b9',
    '20261028013324_m01_identity_role_inheritance.sql': '5382efe9fbdf9c194010257e0ac0024dcb447207522036560056d5d1a4e20e30',
    '20261028013655_m01_workspace_scope_alias.sql': '67ddb2cff9fed9c42d34657e833c613aec4afd2769543a991bbac84da355db64',
    '20261028024205_m01_private_logo_boundary.sql': 'b04af5119b4e384bd96136573eec39e69f21a0ffb7d9f4aeb07bbf48f2976b9d',
    '20261028072515_m01_logo_upload_capability.sql': '4dbd400092d7743b02dd0769ae511c208e6f4f349428fc0e7f0fb9c573ba4b24',
    '20261028162702_m01_replay_scope_refresh.sql': '82a4f2ec03efc0787aa58e5f1e68ab626e5dddb5e4c645444103456757bf4251',
    '20261028162800_m02_jobs_outbox.sql': 'f619b3dfb9d964ab5902d04941b8cd59b44e9da36f1ab3f7b10bd45298ff4013',
}
PENDING = list(MIGRATIONS)[5:]
VERSIONS = [name[:14] for name in MIGRATIONS]
PROOFS = {
    'prior_cloud': ('tracking/evidence/cloud-logo-capability/2026-10-28T07-48-14-630664Z-11769197-apply.json', '08124876a1386d308497867f150ad02af386374041f5eb0732483b22a1f4d0be'),
    'full_db': ('development/local-db/receipts/2026-10-28T16-44-39-449Z-test-db-summary-fcaee673.json', '07816bd62f88f0c51e926cb7e0255674b05b1dde77377facfc1e9e51d19a631e'),
    'm01_replay': ('tracking/evidence/m01/replay-scope/2026-10-28T16-38-40-784Z-fixed.json', 'bb2fd0644597b2966ddd3129edd772c1e7c29f9030b73cb59c15ba78ac9c1e84'),
    'm02_local': ('tracking/evidence/m02/local/2026-10-28T16-43-07-185Z-63e90f8d.json', '55e402ac7f34a8438ea803c63ca41d4e4873f6586dbec2f38d8b9ad95d70da44'),
}
SOURCE_SEALS = {
    'tools/test-db.mjs': 'bce8403709755174e8f95c7a76b8cfb20289cdb48cc5b990f1f7e0509c18bfa0',
    'tools/test-m01-replay-scope.mjs': 'd86fab248876f325071ac40bcced8065e70323b9f897b770e20699624bf446e4',
    'tools/test-m02-local.mjs': '754eab76807ca152ab32d7d517b77e2f8d2af8a074110ceb43a442b61c086590',
    'tools/local-postgres.mjs': '49929bce8eb51194d9299cfd9639e537eb237daaec76c15740cb88059604e2de',
}
READBACK = 'tools/sql/processing-foundation-readback.sql'
READBACK_HASH = '24d305c117aa61888de98a6dbfb732a20cc53c527804e192f735adc0e7715189'
# Exact pg_get_expr projections observed on the reviewed PostgreSQL17 local
# catalog; retain source/shape checks as well, never accept an added OR true.
POLICY_EXPRESSIONS_HASH = 'e5ceb88fec09baf34614c10bed18da7113b01983eecddd2aa9d83acf0139fc70'
EVIDENCE = ROOT / 'tracking/evidence/cloud-processing-foundation'
JOBS = {'jobs_can_access', 'jobs_dispatch_mode', 'jobs_dto', 'jobs_remember', 'jobs_hash_v1',
        'jobs_add_dispatch', 'm02_enqueue_specs_job', 'claim_job_outbox', 'finish_job_outbox',
        'eps_get_job', 'eps_list_jobs', 'eps_retry_job', 'eps_cancel_job'}
QUEUE_TABLES = {'eps.jobs', 'eps.job_events', 'eps.outbox_events'}
BASE_TABLES = {'public.' + name for name in ('clients', 'projects', 'project_memberships', 'client_memberships', 'app_capability_grants')} | {
    'eps.' + name for name in ('workspaces', 'user_workspace_preferences', 'media_assets', 'audience_presets', 'idempotency_records', 'audit_events', 'upload_sessions', 'logo_verification_keys')}
POLICIES = {
    'jobs_workspace_identity': ('eps.workspaces', 'r'), 'jobs_read': ('eps.jobs', 'r'),
    'jobs_insert': ('eps.jobs', 'a'), 'jobs_update': ('eps.jobs', 'w'),
    'job_events_read': ('eps.job_events', 'r'), 'outbox_read': ('eps.outbox_events', 'r'),
    'outbox_insert': ('eps.outbox_events', 'a'), 'outbox_update': ('eps.outbox_events', 'w'),
    'jobs_idempotency': ('eps.idempotency_records', '*'), 'jobs_audit': ('eps.audit_events', 'a'),
    'eps_jobs_no_objects': ('storage.objects', '*'), 'eps_jobs_no_buckets': ('storage.buckets', '*'),
}


class Blocked(Exception):
    """Only fixed, nonsecret messages are emitted."""
    snapshot = None


def require(condition, message):
    if not condition:
        raise Blocked(message)


def digest(relative):
    return hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()


def read_json(relative):
    return json.loads((ROOT / relative).read_text(encoding='utf-8'))


def definitions(count):
    """Latest fixed function bodies, not a general SQL parser or SQL input port."""
    result = {}
    pattern = re.compile(r'^create(?: or replace)? function\s+(\w+)\.(\w+)\s*(\([\s\S]*?)\bas\s+\$\$([\s\S]*?)\$\$;', re.M | re.I)
    for name in list(MIGRATIONS)[:count]:
        for match in pattern.finditer((ROOT / 'supabase/migrations' / name).read_text(encoding='utf-8')):
            schema, function, header, body = match.groups()
            if schema == 'public' or function == 'idempotency_begin' or function in JOBS:
                declaration = re.match(r'^\(([\s\S]*?)\)\s*returns\s+([\w.]+)\s+language\b', header, re.I)
                require(declaration is not None, 'Fixed routine declaration changed; review argument/return parsing.')
                arguments = []
                for argument in declaration.group(1).split(',') if declaration.group(1).strip() else []:
                    parsed = re.match(r'^\s*(\w+)\s+([\w.]+(?:\[\])?)(?:\s+default\b[\s\S]*)?\s*$', argument, re.I)
                    require(parsed is not None, 'Fixed routine argument declaration changed.')
                    arguments.append(parsed.groups())
                result[schema + '.' + function] = {
                    'signature': schema + '.' + function + '(' + ', '.join(kind for _, kind in arguments) + ')',
                    'identity_arguments': ', '.join(name + ' ' + kind for name, kind in arguments),
                    'returns': declaration.group(2),
                    'source_sha256': hashlib.sha256(body.replace('\r\n', '\n').encode()).hexdigest(),
                    'owner': 'eps_jobs_owner' if function in JOBS else ('eps_logo_verify_owner' if function == 'eps_finalize_logo_completion' else 'eps_api_owner'),
                    'definer': bool(re.search(r'\bsecurity\s+definer\b', header, re.I)),
                    'volatility': 's' if re.search(r'\bstable\b', header, re.I) else ('i' if re.search(r'\bimmutable\b', header, re.I) else 'v'),
                    'language': re.search(r'\blanguage\s+(\w+)', header, re.I).group(1).lower(),
                }
    require(len(result) == (32 if count == 7 else 19), 'Fixed function source extraction differs from the reviewed release.')
    return result


def prerequisites():
    require((ROOT / 'supabase/.temp/project-ref').read_text().strip() == TARGET, 'Linked target differs; preserve state.')
    config = tomllib.loads((ROOT / 'supabase/config.toml').read_text())
    require(config['db']['migrations']['enabled'] is True and config['db']['seed']['enabled'] is False, 'Reviewed migrations and disabled seeds are required.')
    require(sorted(path.name for path in (ROOT / 'supabase/migrations').glob('*.sql')) == list(MIGRATIONS), 'Exact seven-file history is required.')
    manifest = read_json('development/local-db/reviewed.json')
    entries = manifest['migrations'] + manifest['tests']
    require(len({entry['path'] for entry in entries}) == len(entries), 'Duplicate review manifest entries.')
    reviewed = {entry['path']: entry for entry in entries}
    for name, expected in MIGRATIONS.items():
        path = 'supabase/migrations/' + name
        entry = reviewed.get(path, {})
        require(digest(path) == expected == entry.get('sha256') and bool(entry.get('reviewed_by')) and bool(entry.get('reviewed_at')), 'Migration source/review seal differs.')
    require(len(manifest['migrations']) == 7, 'Unexpected reviewed migration history.')
    for path, expected in SOURCE_SEALS.items():
        require(digest(path) == expected, 'Fixed local proof harness changed; review the new source.')
    require(digest(READBACK) == READBACK_HASH, 'Fixed metadata SQL changed.')
    proofs = {}
    for key, (path, expected) in PROOFS.items():
        require(digest(path) == expected, 'A sealed successful prerequisite receipt changed.')
        proofs[key] = read_json(path)
        require(proofs[key]['result'] == 'passed', 'A prerequisite receipt did not pass.')
    prior, full, replay, local = (proofs[key] for key in ('prior_cloud', 'full_db', 'm01_replay', 'm02_local'))
    require(prior['target'] == TARGET and prior['action'] == 'apply' and prior['application_verified_by_readback'] is True and prior['readback']['versions'] == VERSIONS[:5], 'Exact prior five-version cloud release is required.')
    require(len(full['stages']) == 23 and full['cleanup']['result'] == full['logo_cleanup']['result'] == 'passed'
            and len(full['concurrency_pairs']) == 3 and all(pair['result'] == 'passed' and pair['distinct_database_backends'] and pair['overlapping_reviewed_transaction_windows'] for pair in full['concurrency_pairs']), 'Full seven-version database suite/three races/both cleanups required.')
    require(replay['mode'] == 'fixed' and replay['migration_sha256'] == MIGRATIONS[PENDING[0]] and replay['harness_sha256'] == SOURCE_SEALS['tools/test-m01-replay-scope.mjs']
            and replay['cloud_called'] is False and replay['service_credentials_used'] is False and len(replay['cases']) == 11
            and replay['cleanup']['result'] == 'passed' and replay['before'] == replay['after'], 'Fixed M01 eleven-case replay proof and cleanup required.')
    require(all(case['exact_advisory_wait_observed'] is True and case['legitimate_replay_passed'] is True and case['denied_after_concurrent_revocation'] is True
                and isinstance(case['holder_pid'], int) and case['holder_pid'] != case['waiter_pid'] for case in replay['cases']), 'M01 actual lock waits, control replays and revoked denials required.')
    require(local['cleanup'] == 'passed' and local['before'] == local['after'] and len(local['stages']) == 27
            and local['before']['versions'] == VERSIONS and all(local['after'][key] == 0 for key in ('jobs', 'outbox', 'events'))
            and local['after']['fixture_present'] is False and local['after']['restricted_dispatcher'] is True
            and all(local['before'][key] == 'on' for key in ('fsync', 'synchronous_commit', 'full_page_writes')), 'M02 committed local proof and strict restoration required.')
    pairs = local['concurrency']
    require({pair['name'] for pair in pairs} == {'same-input-distinct-key-enqueue', 'two-job-skip-locked', 'revoked-cached-replay', 'same-event-single-lease', 'cancel-before-dispatch-finish', 'dispatch-finish-before-cancel'}
            and len(pairs) == 6 and all(pair['distinct_backends'] is True for pair in pairs), 'All six M02 independent-backend pairs required.')
    require(local['restart']['same_container'] is True and local['restart']['same_volume'] is True
            and local['restart']['system_identifier'] == local['environment']['system_identifier']
            and local['environment']['container'] == 'eps-presentation-canonical-pg17-local'
            and local['environment']['host_ip'] == '127.0.0.1' and local['environment']['host_port'] == '55433'
            and all(local[key] is False for key in ('cloud_called', 'provider_called', 'stage_callbacks_tested', 'dispatcher_daemon_tested')), 'Owned local graceful restart/fencing boundary is required.')
    for proof in (full, local):
        require(proof['reviewed_manifest_sha256'] == digest('development/local-db/reviewed.json'), 'Proof review manifest differs from the current seal.')
        for stage in proof['stages']:
            entry = reviewed.get(stage['path'], {})
            require(stage['result'] in ('passed', 'applied', 'already_applied') and stage['sha256'] == entry.get('sha256') == digest(stage['path']), 'A proof stage/source seal differs.')
        require({stage['path'] for stage in proof['stages'] if stage['path'].startswith('supabase/migrations/')} == {'supabase/migrations/' + name for name in MIGRATIONS}, 'All seven migration replays must be proved.')
    definitions(5); definitions(6); definitions(7)
    return {'migration_hashes': MIGRATIONS, 'proofs': {key: {'path': path, 'sha256': expected} for key, (path, expected) in PROOFS.items()},
            'source_seals': SOURCE_SEALS, 'readback_sha256': READBACK_HASH, 'reviewed_manifest_sha256': digest('development/local-db/reviewed.json'),
            'release_helper_sha256': digest('tools/release_processing_foundation.py')}


def validate_state(state):
    require(state['query_role'] == state['database'] == 'postgres' and state['unrestricted_visibility'] is True, 'Unrestricted fixed-target metadata context required.')
    versions = state['versions']
    require(versions in (VERSIONS[:5], VERSIONS[:6], VERSIONS), 'Cloud history is outside the exact before/partial/after states.')
    count = len(versions)
    expected = definitions(count)
    actual = state['functions']
    require(len(actual) == len(expected) and {item['name'] for item in actual} == set(expected), 'Unexpected function set/overload or missing routine.')
    for function in actual:
        require(all(function[key] == value for key, value in expected[function['name']].items()) and function['config'] == ['search_path=""'] and function['public_execute'] is False, 'Function source/owner/volatility/definer/search-path boundary differs.')
        execute = function['execute']; public = function['name'].startswith('public.')
        require(execute['anon'] is False and execute['service_role'] is False and execute['authenticated'] is public, 'Public/anonymous/service routine ACL differs.')
        if function['name'] == 'eps.idempotency_begin':
            require(execute['eps_api_owner'] is True and execute['eps_logo_verify_owner'] is True, 'Shared invoker/finalizer helper grants differ.')
        if count == 7:
            require(execute['eps_jobs_dispatcher'] is (function['name'] in ('eps.claim_job_outbox', 'eps.finish_job_outbox')), 'Dispatcher execute-only scope differs.')
            require(execute['eps_jobs_owner'] is True, 'Narrow jobs owner lost required routine execution.')
            if function['name'].split('.')[-1] in JOBS and not public:
                require(execute['eps_api_owner'] is False and execute['eps_logo_verify_owner'] is False, 'Internal enqueue/dispatcher routine became exposed to another owner.')
    relations = state['relations']
    require(len(relations) == (16 if count == 7 else 13) and {row['name'] for row in relations} == BASE_TABLES | (QUEUE_TABLES if count == 7 else set())
            and all(row['rls'] is True and row['forced_rls'] is True and row['owner'] == 'postgres' for row in relations), 'Exact canonical/app forced-RLS relation set differs.')
    if count < 7:
        require(state['jobs_roles'] == state['queue_acls'] == state['jobs_policies'] == [] and state['queue_counts'] is None, 'Unreleased queue objects/roles/policies already exist; preserve and reconcile.')
    else:
        roles = state['jobs_roles']
        require(len(roles) == 2 and {role['name'] for role in roles} == {'eps_jobs_owner', 'eps_jobs_dispatcher'}, 'Exact narrow jobs role set required.')
        for role in roles:
            require(all(role[key] is False for key in ('login','inherit','superuser','bypass_rls','create_db','create_role','eps_create','public_create','key_select','authenticated_member','api_owner_member')), 'Jobs role privilege/ownership boundary differs.')
            parents = [{'name': 'authenticated', 'admin': False, 'inherit': True, 'set': False}] if role['name'] == 'eps_jobs_owner' else []
            require(role['parents'] == parents, 'Jobs role inheritance direction/options differ.')
            if role['name'] == 'eps_jobs_owner':
                require(role['auth_usage'] and role['uid_execute'] and role['jwt_execute'], 'Managed acting-user identity inheritance missing.')
        acls = state['queue_acls']
        require(len(acls) == 21, 'Queue ACL projection is incomplete.')
        for acl in acls:
            for privilege in ('select','insert','update','delete','truncate','references','trigger'):
                allowed = acl['role'] == 'eps_jobs_owner' and (privilege == 'select' or acl['table'] != 'eps.job_events' and privilege in ('insert','update'))
                require(acl[privilege] is allowed, 'Unexpected direct queue/event table authority.')
        policies = state['jobs_policies']
        require(len(policies) == len(POLICIES) and {policy['name'] for policy in policies} == set(POLICIES), 'Jobs policy set differs.')
        expressions = [{key: policy[key] for key in ('name','using','check')} for policy in sorted(policies, key=lambda item: item['name'])]
        require(hashlib.sha256(json.dumps(expressions, sort_keys=True, separators=(',',':')).encode()).hexdigest() == POLICY_EXPRESSIONS_HASH, 'Jobs RLS policy expressions differ from the reviewed local catalog.')
        for policy in policies:
            restrictive = policy['name'].startswith('eps_jobs_no_')
            require((policy['table'], policy['command']) == POLICIES[policy['name']] and policy['permissive'] is not restrictive
                    and policy['roles'] == (['eps_jobs_dispatcher', 'eps_jobs_owner'] if restrictive else ['eps_jobs_owner']), 'Jobs policy target/roles/command differs.')
            if restrictive:
                require(policy['using'] == policy['check'] == 'false', 'Inherited Storage authority is not denied.')
        require(set(state['queue_counts']) == {'jobs','outbox','events'}, 'Queue count projection missing.')
    return {5: 'pending', 6: 'partial_scope_applied', 7: 'applied'}[count]


def call(arguments):
    return subprocess.run(['npx.cmd', '--yes', 'supabase@2.122.0', *arguments, '--workdir', str(ROOT)], cwd=ROOT,
                          capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=90)


def inspect():
    result = call(['db','query','--linked','--project-ref',TARGET,'--file',str(ROOT / READBACK),'--output-format','json'])
    require(result.returncode == 0, 'Fixed read-only inspection failed; raw diagnostics suppressed.')
    state = json.loads(result.stdout)['rows'][0]['processing_release']
    # Function bodies are compared but never copied into evidence/raw logs.
    for function in state['functions']:
        function['source_sha256'] = hashlib.sha256(function.pop('source').replace('\r\n','\n').encode()).hexdigest()
    try:
        return validate_state(state), state
    except Blocked as error:
        error.snapshot = state
        raise


def stamp():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def retain(receipt, phase):
    name = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + phase + '.json'
    with (EVIDENCE / name).open('x', encoding='utf-8') as file:
        json.dump(receipt, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())
    return name


def main():
    action = sys.argv[1] if len(sys.argv) == 2 else ''
    require(action in ('dry-run','apply','readback'), 'Use dry-run, apply or readback with no target/file overrides.')
    inputs = prerequisites()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    receipt = {'observed_at': stamp(), 'target': TARGET, 'action': action, 'inputs': inputs, 'result': 'failed',
               'application_status': 'not_attempted', 'application_verified_by_readback': False,
               'runtime_flag_changed': False, 'identity_provisioned': False, 'provider_or_service_provisioned': False,
               'seeds': False, 'vault_sync': False, 'raw_diagnostics_recorded': False, 'pipeline_acceptance': False}
    try:
        mode, before = inspect(); receipt.update(before_mode=mode, before=before)
        if mode == 'applied':
            receipt['application_status'] = 'verified_existing'
            receipt['application_verified_by_readback'] = True
        elif mode == 'partial_scope_applied':
            receipt['application_status'] = 'verified_partial'
        if action != 'readback':
            require(mode == 'pending', 'Release is applied/partial; preserve history and inspect instead of replaying a push.')
            if action == 'apply':
                prior = json.loads((EVIDENCE / 'dry-run.json').read_text(encoding='utf-8'))
                age = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(prior['finished_at'])).total_seconds()
                require(prior['result'] == 'passed' and prior['inputs'] == inputs and prior['target'] == TARGET and prior['action'] == 'dry-run'
                        and prior['pending_migrations'] == PENDING and prior['readback'] == before and 0 <= age <= 3600,
                        'Exact successful fresh dry-run/current preflight match required.')
            receipt['application_status'] = 'unknown_until_readback' if action == 'apply' else 'not_attempted'
            receipt['attempt_receipt'] = retain(receipt, action + '-attempt')
            command = ['db','push','--linked','--project-ref',TARGET,'--skip-vault','--yes','--output-format','json']
            if action == 'dry-run': command.append('--dry-run')
            try:
                result = call(command)
                receipt['exit_code'] = result.returncode
                receipt['pending_migrations'] = sorted(set(re.findall(r'\d{14}_[A-Za-z0-9_]+\.sql', result.stdout + '\n' + result.stderr)))
            except Exception:
                receipt['dispatch_response_unavailable'] = True
            # Read after dispatch even when the response is lost or reports failure.
        after_mode, after = inspect()
        receipt.update(after_mode=after_mode, readback=after, application_verified_by_readback=after_mode == 'applied',
                       application_status={'pending':'verified_pending','partial_scope_applied':'verified_partial','applied':'verified_applied'}[after_mode])
        require(after_mode == ('pending' if action == 'dry-run' else 'applied'), 'Observed partial/unexpected application; preserve and reconcile before another mutator.')
        require(after['counts'] == before['counts'], 'Business/storage counts changed; applied history is retained and concurrent activity needs reconciliation.')
        if action != 'readback':
            require(receipt.get('exit_code') == 0 and receipt.get('pending_migrations') == PENDING, 'Dispatch response was unconfirmed; readback state is retained, do not blindly retry.')
            if action == 'apply':
                require(after['queue_counts'] == {'jobs':0,'outbox':0,'events':0}, 'Initial queue rows appeared during foundation release; reconcile concurrent activity.')
        receipt['result'] = 'passed'
    except Blocked as error:
        receipt['reason'] = str(error)
        if error.snapshot is not None: receipt['unverified_readback'] = error.snapshot
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
        print(json.dumps({'result':'blocked','reason':str(error),'raw_diagnostics_recorded':False})); sys.exit(1)
    except Exception:
        print(json.dumps({'result':'blocked','reason':'Fixed release could not be confirmed; raw diagnostics suppressed.','raw_diagnostics_recorded':False})); sys.exit(1)
