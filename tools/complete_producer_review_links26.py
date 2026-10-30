"""Fixed absent-only capability completion for the source job's existing Producer.

Root reviews/executes once. No caller-supplied principal, SQL, target or key. An
exclusive protected claim survives every unknown mutation outcome; only readback
may reconcile it. Imports and unit tests perform no cloud/private-file IO.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tomllib
import uuid

from release_foundation import ROOT, TARGET
from release_m04_casting import call as cli_call, private_write

APPLY = 'tools/sql/enable-producer-review-links26.sql'
READBACK = 'tools/sql/producer-review-links26-readback.sql'
BASELINE = 'tracking/evidence/m06/start-discovery/2026-10-30T00-18-13-662771Z-fb359736.json'
BASELINE_SHA = '7dab325cb265e2abf15c5b99e05a43c7c2b1797bbe11fea02d08230ef185d95b'
LOCAL_PROOF = 'tracking/evidence/m06/producer-review-links26-local/2026-10-30T00-47-21.871Z-34cc8507.json'
LOCAL_PROOF_SHA = '2d8c58e7e356cbd1260529cdd80feddf69f2070cba72e3f6336613265c5a3bb9'
SEALS = {
    APPLY: '29acb74892fd828d3406aaeecfe6bef58a336f661dabda7a6f6576ccc7434a79',
    READBACK: 'c6c381d10aad632534a621b5bfbea9b66eae8c045ac5da7382edae209959f564',
    'tools/release_m04_casting.py': 'ca855cda402566ebe8c6a78174a44dfcc9e878d7f0a320a6b7251a783ade2226',
    'tools/release_foundation.py': '02aac0cefc4b46419c7d5a086da672398716cf7ee73882602574cff99659d751',
    'tools/provision_logo_verifier.py': '660f2eb0d15b1ed17801ecef22270dbb389fdf93181c340f16d715fc2b3a340c',
}
PRIVATE = ROOT / '.local/producer-review-links26'
EVIDENCE = ROOT / 'tracking/evidence/m06/producer-review-links26'
CLAIM = PRIVATE / 'apply.claim.json'
JOB = '9a5ddb61-6a9a-4157-b6be-8653cf2eadef'


def require(value):
    if not value: raise ValueError('FIXED_PRODUCER_REVIEW_LINKS26_UNCONFIRMED')


def sha(value): return hashlib.sha256(value).hexdigest()
def canonical(value): return sha(json.dumps(value, sort_keys=True, separators=(',', ':')).encode('utf8'))


def exact(value, keys): require(type(value) is dict and set(value) == set(keys))


def checked(relative):
    from provision_logo_verifier import safe_path
    file = ROOT / relative; safe_path(file); require(file.resolve() == file and not file.is_symlink())
    return file


def load_json(relative): return json.loads(checked(relative).read_bytes())


def sealed(relative, expected):
    require(type(expected) is str and re.fullmatch('[a-f0-9]{64}', expected))
    data = checked(relative).read_bytes(); require(sha(data) == expected); return data


def timestamp(value):
    require(type(value) is str and 0 < len(value) <= 50)
    at = datetime.datetime.fromisoformat(value.replace('Z', '+00:00')); require(at.tzinfo is not None); return at


def validate_state(state, versions):
    require(type(versions) is list and len(versions) == 26 and versions == sorted(set(versions))
        and all(type(value) is str and re.fullmatch('[0-9]{14}', value) for value in versions))
    exact(state, {'observed_at', 'query_role', 'database', 'unrestricted_visibility', 'versions', 'source_job_count',
        'requester_derived_from_fixed_job', 'verified_active_auth', 'two_projects_current', 'two_writable_memberships_current',
        'producer_authority_current', 'link_manager_grant', 'preservation'})
    timestamp(state['observed_at'])
    require(state['query_role'] == state['database'] == 'postgres' and state['unrestricted_visibility'] is True and state['versions'] == versions)
    require(type(state['source_job_count']) is int and state['source_job_count'] == 1)
    for field in ('requester_derived_from_fixed_job', 'verified_active_auth', 'two_projects_current', 'two_writable_memberships_current', 'producer_authority_current'):
        require(state[field] is True)
    grant = state['link_manager_grant']; exact(grant, {'count', 'active', 'state'})
    require(type(grant['count']) is int and ((grant['count'] == 0 and grant['active'] is None and grant['state'] == 'absent')
        or (grant['count'] == 1 and type(grant['active']) is bool and grant['state'] == ('active' if grant['active'] else 'inactive'))))
    preservation = state['preservation']; exact(preservation, {'auth_users_count', 'grants_count', 'other_grants_sha256', 'project_memberships_sha256', 'client_memberships_sha256'})
    require(all(type(preservation[field]) is int and preservation[field] >= 1 for field in ('auth_users_count', 'grants_count')))
    for field in ('other_grants_sha256', 'project_memberships_sha256', 'client_memberships_sha256'):
        require(type(preservation[field]) is str and re.fullmatch('[a-f0-9]{64}', preservation[field]))
    return state


def validate_transition(before, after):
    validate_state(before, before['versions']); validate_state(after, before['versions'])
    require(before['link_manager_grant'] == {'count': 0, 'active': None, 'state': 'absent'}
        and after['link_manager_grant'] == {'count': 1, 'active': True, 'state': 'active'})
    old = before['preservation']; new = after['preservation']
    require(new['grants_count'] == old['grants_count'] + 1 and all(new[key] == value for key, value in old.items() if key != 'grants_count'))
    return {'only_absent_capability_added': True, 'other_grants_and_memberships_preserved': True,
        'auth_user_count_preserved': True, 'auth_writes_requested': False, 'inactive_grants_reactivated': False}


def build_apply(template, versions):
    require(type(template) is str and template.count('__REVIEWED_VERSIONS__') == 1)
    require(type(versions) is list and len(versions) == 26 and versions == sorted(set(versions))
        and all(type(value) is str and re.fullmatch('[0-9]{14}', value) for value in versions))
    return template.replace('__REVIEWED_VERSIONS__', ','.join("'" + value + "'" for value in versions))


def inputs():
    for file, expected in SEALS.items(): sealed(file, expected)
    baseline = json.loads(sealed(BASELINE, BASELINE_SHA))
    require(baseline['result'] == 'captured' and baseline['read_only'] is True and baseline['target'] == TARGET
        and baseline['state']['query_role'] == baseline['state']['database'] == 'postgres'
        and baseline['state']['existing_requester_count'] == 1
        and baseline['state']['link_manager_rows'] == {'active': None, 'count': 0})
    authority = {'projects.read', 'projects.write', 'workspaces.read', 'workspaces.write', 'cast.read', 'cast.upload', 'cast.write', 'cast.review', 'presentations.generate'}
    require(authority.issubset(set(baseline['state']['producer_active_capabilities'])))
    proof = json.loads(sealed(LOCAL_PROOF, LOCAL_PROOF_SHA))
    require(proof['result'] == 'passed' and proof['cloud_called'] is False and proof['provider_called'] is False and proof['hosted_credentials_loaded'] is False
        and proof['negative_cases_passed'] == 18 and proof['one_absent_row_inserted_in_fixture'] is True and proof['rollback_verified'] is True
        and proof['sources_stable'] is True and proof['before'] == proof['after'] and proof['original_grants_memberships_auth_revisions_preserved'] is True)
    for file in (APPLY, READBACK, 'tools/sql/producer-review-links26-local-fixture.sql', 'tools/local-postgres.mjs'):
        sealed(file, proof['source_seals'][file])
    sealed('tools/test-producer-review-links26-local.mjs', proof['harness_sha256'])
    forbidden = {'SUPABASE_PROJECT_ID', 'SUPABASE_API_URL', 'SUPABASE_WORKDIR', 'SUPABASE_DB_URL', 'PGHOST', 'PGHOSTADDR', 'PGPORT',
        'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS', 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGSSLNEGOTIATION'}
    require(not any(os.environ.get(name) for name in forbidden))
    require(checked('supabase/.temp/project-ref').read_text().strip() == TARGET)
    settings = tomllib.loads(checked('supabase/config.toml').read_text()); require(settings['db']['migrations']['enabled'] is True and settings['db']['seed']['enabled'] is False)
    manifest_bytes = checked('development/local-db/reviewed.json').read_bytes(); manifest = json.loads(manifest_bytes)
    require(type(manifest.get('migrations')) is list and len(manifest['migrations']) == 26)
    versions = []; migrations = {}
    for row in manifest['migrations']:
        require(type(row) is dict and type(row.get('path')) is str and re.fullmatch('supabase/migrations/[0-9]{14}_[a-z0-9_]+\\.sql', row['path']) and row.get('reviewed_by') and row.get('reviewed_at'))
        sealed(row['path'], row['sha256']); migrations[row['path']] = row['sha256']; versions.append(Path(row['path']).name[:14])
    prior_path = 'tracking/evidence/cloud-m06-review/2026-10-30T00-40-49-572252Z-48f6139e-readback.json'
    prior = json.loads(sealed(prior_path, 'dc846f424f4f9c17e8aeac4e04d5ea5a1a0329de57b12052a472bfe146372f46'))
    require(prior['result'] == 'passed' and prior['action'] == 'readback' and prior['target'] == TARGET
        and prior['application_verified_by_readback'] is True and prior['comparison']['new_config_disabled_key_absent'] is True
        and prior['comparison']['old_noncredential_business_data_and_managed_auth_metadata_counts_preserved'] is True)
    sealed('tools/complete_producer_review_links.py', '9720635fb09b1b95e2508d3df72833ee49010da48bbf52c542b241bf6b58175b')
    require(versions[:24] == baseline['state']['history'] and len(baseline['state']['history']) == 24 and versions == sorted(set(versions))
        and versions[:25] == prior['inputs']['versions'] and '_m06_' in manifest['migrations'][-1]['path'] and versions == proof['before']['versions'])
    require(sorted(file.name for file in checked('supabase/migrations').glob('*.sql')) == [Path(row['path']).name for row in manifest['migrations']])
    return {'versions': versions, 'manifest_sha256': sha(manifest_bytes), 'migration_seals': migrations,
        'source_seals': dict(SEALS), 'absence_receipt': BASELINE, 'absence_receipt_sha256': BASELINE_SHA,
        'local_sql_proof': LOCAL_PROOF, 'local_sql_proof_sha256': LOCAL_PROOF_SHA, 'helper_sha256': sha(Path(__file__).read_bytes()),
        'preexisting_canonical25_readback': prior_path, 'preexisting_canonical25_readback_sha256': 'dc846f424f4f9c17e8aeac4e04d5ea5a1a0329de57b12052a472bfe146372f46',
        'preserved_25_helper_sha256': '9720635fb09b1b95e2508d3df72833ee49010da48bbf52c542b241bf6b58175b'}


def inspect(current):
    sealed(READBACK, current['source_seals'][READBACK])
    result = cli_call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(ROOT / READBACK), '--output-format', 'json'])
    require(result.returncode == 0 and len(result.stdout.encode('utf8')) <= 32768)
    rows = json.loads(result.stdout)['rows']; require(type(rows) is list and len(rows) == 1); exact(rows[0], {'producer_review_links26'})
    return validate_state(rows[0]['producer_review_links26'], current['versions'])


def retain(report, suffix):
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    file = EVIDENCE / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8] + '-' + suffix + '.json')
    with file.open('x', encoding='utf8') as handle: json.dump(report, handle, indent=2); handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
    return file.relative_to(ROOT).as_posix()


def read_claim():
    from provision_logo_verifier import WindowsPrivateFiles
    WindowsPrivateFiles().verify(CLAIM)
    require(0 < CLAIM.stat().st_size <= 131072)
    return json.loads(CLAIM.read_bytes())


def main(arguments=None):
    arguments = sys.argv[1:] if arguments is None else arguments; require(len(arguments) <= 1)
    action = arguments[0] if arguments else 'inspect'; require(action in ('inspect', 'apply', 'readback'))
    report = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'target': TARGET, 'action': action, 'result': 'unconfirmed',
        'capability': 'review_links.manage', 'source_job_id': JOB, 'mutation_attempted': False, 'automatic_retry': False,
        'private_identity_or_facts_published': False, 'auth_or_membership_writes_requested': False, 'hosting_deferred': True}
    try:
        current = inputs(); report['inputs'] = current
        before = inspect(current); report['readback'] = before
        if action == 'apply':
            require(before['link_manager_grant']['state'] == 'absent' and not CLAIM.exists() and not any(EVIDENCE.glob('*-apply-attempt.json')))
            report['before'] = before; report['attempt_receipt'] = retain(report, 'apply-attempt')
            query = build_apply(sealed(APPLY, SEALS[APPLY]).decode('utf8'), current['versions']).encode('utf8')
            PRIVATE.mkdir(parents=True, exist_ok=True); query_file = PRIVATE / ('apply-' + uuid.uuid4().hex + '.sql'); private_write(query_file, query)
            claim = {'target': TARGET, 'inputs_sha256': canonical(current), 'before_sha256': canonical(before),
                'attempt_receipt': report['attempt_receipt'], 'query_sha256': sha(query), 'dispatch_may_have_occurred': True}
            private_write(CLAIM, (json.dumps(claim) + '\n').encode('utf8'))
            require(inputs() == current and sha(query_file.read_bytes()) == claim['query_sha256'])
            report['mutation_attempted'] = True
            result = cli_call(['db', 'query', '--linked', '--project-ref', TARGET, '--file', str(query_file), '--output-format', 'json'])
            require(result.returncode == 0 and len(result.stdout.encode('utf8')) <= 32768)
            rows = json.loads(result.stdout)['rows']; require(type(rows) is list and len(rows) == 1); exact(rows[0], {'producer_review_links26'})
            require(rows[0]['producer_review_links26'] == {'capability': 'review_links.manage', 'active': True, 'inserted_grants': 1,
                'other_grants_preserved': True, 'memberships_preserved': True, 'auth_user_count_preserved': True, 'auth_writes_requested': False, 'inactive_grants_reactivated': False})
            after = inspect(current); report['comparison'] = validate_transition(before, after); report['readback'] = after
        elif action == 'readback':
            claim = read_claim(); exact(claim, {'target', 'inputs_sha256', 'before_sha256', 'attempt_receipt', 'query_sha256', 'dispatch_may_have_occurred'})
            require(claim['target'] == TARGET and claim['inputs_sha256'] == canonical(current) and claim['dispatch_may_have_occurred'] is True)
            path = Path(claim['attempt_receipt']); require(path.parent.as_posix() == 'tracking/evidence/m06/producer-review-links26' and path.name.endswith('-apply-attempt.json'))
            previous = load_json(path); require(canonical(previous['before']) == claim['before_sha256'])
            report['comparison'] = validate_transition(previous['before'], before)
        require(inputs() == current); report['result'] = 'captured' if action == 'inspect' else 'verified'
    except Exception:
        report['code'] = 'FIXED_PRODUCER_REVIEW_LINKS26_UNCONFIRMED'
    finally:
        report['finished_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat(); file = retain(report, action)
        print(json.dumps({'result': report['result'], 'receipt': file, 'mutation_attempted': report['mutation_attempted'], 'automatic_retry': False}))
    return 0 if report['result'] in ('captured', 'verified') else 1


if __name__ == '__main__':
    try: sys.exit(main())
    except Exception: sys.stderr.write('Producer capability completion stopped; diagnostics remain private. No automatic mutation retry.\n'); sys.exit(1)
