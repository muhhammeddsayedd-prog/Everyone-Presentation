"""New disabled web38 purpose. Import reads only pinned public helper source.

Root actions use ordinary Vercel CLI authentication and original source bytes.
No old operator main(), mutating DB port, deployment claim or CLI hook is reused.
"""
from pathlib import Path
import copy
import datetime
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DEPLOY_ENABLED = True
CURRENT = 'dpl_EUK29uLiGvrPguUv3T7d5KR19RwC'
WORKER = 'dpl_2uASsbYobSDwWjMptPjGLcVEdCg3'
TARGET = 'pyibofyctwnqpvktepse'
VERSION = '20261101110939'
MIGRATION = 'supabase/migrations/20261101110939_m07_job_batch_filter.sql'
MIGRATION_SHA = '47af16421613320b76abc6e7119da92912859f0334b03b047a98492f75f6ea2d'
BASE = 'development/m07/workspace-summary35-web/web.py'
BASE_SHA = 'b306de33cbfe1a2d43426d0d9ec8e397618e847d94cd19692a3f6caff3e0a483'
DB_HELPER = 'development/m07/job-batch-filter38-release/release.py'
DB_FILES = {f'development/m07/job-batch-filter38-release/{name}' for name in
            ['state.py', 'release.py', 'build_migration.py']}
ANCHORS = {
    'baseline_ready': {'path': 'tracking/evidence/m07/feedback-summary37-web/2026-11-01T10-14-01-892380Z-ready.json', 'sha256': 'b9455c1001ff4b8aacd874582bc475e3b49aa26ddcc895d4843dfd37c6e4f1e9'},
    'baseline_source': {'path': 'tracking/evidence/m07/controlled-pilot/2026-11-01T10-02-58-943Z-7f987547-web-source.json', 'sha256': '0463395083aed2ade456d26a57c0a5ea2bfb1d0da3bbb899bb66a5c49b64ced7'},
    'health': {'path': 'tracking/evidence/m07/controlled-pilot/2026-11-01T11-13-51-575999Z-web-worker-health-before38.json', 'sha256': '04c8f0366dc9abad31c694732ef7ee1461baceac09b944431fefa8d139c2ed6f'},
    'proof': {'path': 'tracking/evidence/m07/job-batch-filter-proof/2026-11-01T17-23-47-142Z-bb9cf2bf.json', 'sha256': 'c2020d123b7d54c27a6440b4bf6ede7c9dd1c751ec13b1613f7ad2c1bf62b2c4'},
    'api_gates': {'path': 'tracking/evidence/m07/job-batch-filter38/2026-11-01T17-30-53-272311Z-root-postmerge-quality.json', 'sha256': '8dc8365c456cda6c97edd1d73fc5acd888c97f9a04ba00a667cd88fcca8e89fb'},
}
PRODUCT_ROWS = [{'path': 'apps/web/lib/generated-contracts.json', 'bytes': 145060, 'sha256': 'ad8333b036e1df0c36ee84915713273f4d84615df92a8744eb5b77e3a35cc2f2'}, {'path': 'apps/web/lib/job-http.ts', 'bytes': 2922, 'sha256': 'b702118210a96032ef5553580cacea4210c6927cbce603bf16a4a081613fde46'}, {'path': 'apps/web/lib/mcp-capabilities.ts', 'bytes': 1518, 'sha256': 'ef60eb112571b011c90dc2d50d58d14c04ca036e2146bcd118a97793615f7a4d'}, {'path': 'contracts/mcp-tool-catalog.json', 'bytes': 648533, 'sha256': 'd9511710406bba82c427bedad17ec2d37aaf4086c1ff28e71fafb579030fb65f'}, {'path': 'packages/central/src/jobs.ts', 'bytes': 11900, 'sha256': '74edc9bc4758b6fdc1ecec3115b4293af9f9205f96cc3a8eb72ca5ca632e96b4'}, {'path': 'packages/domain/src/index.ts', 'bytes': 32418, 'sha256': '40b9416726ff05376c05731edcc85aad4da9b36bfa07134d8b718bcca6435b35'}, {'path': 'packages/domain/src/job-filters.ts', 'bytes': 1767, 'sha256': '6e7163df85d11ed157e04f3db9886931baea1d6ca95deaa98d260a2c2f4ebd0b'}]
PRODUCT_PINS = {r['path']: r['sha256'] for r in PRODUCT_ROWS}
CHANGED = set(PRODUCT_PINS) - {'packages/domain/src/job-filters.ts'}
ADDED = 'packages/domain/src/job-filters.ts'
EXPECTED_SOURCE_SHA = '4edc5f1a3db2db62cb01d2f804589ae948c46cccb93fbf169f85b0090ccdc0b8'
PROOF_FIXTURE_SHA = '82b087a1873facc5dacbb783d00cb0ccd0d5fd9b058731926fba291ebbdb6a84'
MARKERS = [('epsBatchFilter38Source', 'source_sha256'), ('epsBatchFilter38Quality', 'quality_sha256'), ('epsBatchFilter38Canonical', 'canonical_sha256')]
PRIVATE = ROOT / '.local/m07-job-batch-filter38-web'
PLAN = PRIVATE / 'plan.json'
INSPECT = PRIVATE / 'provider-before.json'
BUILD_CLAIM = PRIVATE / 'build.claim.json'
BUILD = PRIVATE / 'build.json'
ADMISSION = PRIVATE / 'canonical-admission.json'
CLAIM = PRIVATE / 'deploy.claim.json'
RETURNED = PRIVATE / 'deploy.returned.json'


def need(value):
    if not value:
        raise ValueError('BATCH38_WEB_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def digest(value):
    return sha(json.dumps(value, sort_keys=True, separators=(',', ':')).encode())


def load(path, limit=8 * 1024 * 1024):
    need(path.is_file() and not path.is_symlink() and not path.is_junction()
         and path.resolve() == path and path.stat().st_nlink == 1 and path.stat().st_size <= limit)
    return path.read_bytes()


def source_path(relative):
    need(type(relative) is str and relative and not relative.startswith('/') and '\\' not in relative
         and ':' not in relative and all(p not in ['', '.', '..'] for p in relative.split('/'))
         and not re.search(r'(?:^|/)(?:\.env[^/]*|\.local|\.git|Screenshots|redesign-output|node_modules|\.next[^/]*)(?:/|$)', relative))
    return ROOT / relative


need(sha(load(ROOT / BASE)) == BASE_SHA)
spec = importlib.util.spec_from_file_location('batch38_pinned_pure_web_helpers', ROOT / BASE)
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)
old = base.old


def reference(ref):
    need(type(ref) is dict and set(ref) == {'path', 'sha256'} and type(ref['sha256']) is str
         and re.fullmatch('[a-f0-9]{64}', ref['sha256']))
    path = source_path(ref['path'])
    need(ref['path'].startswith('tracking/evidence/'))
    raw = load(path)
    need(sha(raw) == ref['sha256'])
    return json.loads(raw)


def anchor(name):
    return reference(ANCHORS[name])


def verify_pins(pins):
    need(type(pins) is dict and pins)
    for file, expected in pins.items():
        need(type(expected) is str and re.fullmatch('[a-f0-9]{64}', expected)
             and sha(load(source_path(file))) == expected)


def proof():
    # Public receipt metadata only: old376 TypeScript pins must not be rerun
    # after the compatible product merge. The separate DB release admits those
    # exact native inputs before the merge and this gate checks its receipt.
    doc = anchor('proof')
    need(doc['result'] == 'passed' and doc['checkpoint'] == 'complete'
         and len(doc['source_seals']) == 376 and doc.get('cleanup_unconfirmed') is not True)
    need(type(doc['run_id']) is str and str(uuid.UUID(doc['run_id'])) == doc['run_id'])
    suffix = doc['run_id'].replace('-', '')
    need(doc['actual_disposable_database_absence'] ==
         {'eps_m07_r33_source_' + suffix: False, 'eps_m07_r33_restore_' + suffix: False})
    check = doc['batch_filter_sql']
    need(check['result'] == 'passed' and check['fixture_sha256'] == PROOF_FIXTURE_SHA)
    for key in ['actual34_to37_functional_DDL', 'nested37_full_state_and_session_identity_restored',
                'old37_fixture_executed', 'outer_rollback_to33', 'synthetic_delegated_claims_SQL_enforced']:
        need(check[key] is True)
    for key in ['disposable_databases_removed', 'new33_roles_removed', 'original_local_database_unchanged',
                'original29_full_catalogue_unchanged', 'original29_full_auth_storage_catalogue_unchanged',
                'original29_exact_profile_and_settings_state_unchanged',
                'existing_global_role_oids_attributes_memberships_unchanged', 'shared_test_lock_released']:
        need(doc[key] is True)
    need(doc['cloud_called'] is False and doc['provider_called'] is False and check['hosted_acceptance'] is False)
    return doc


def product_gates(ref):
    need(ANCHORS['api_gates'] is not None and ref == ANCHORS['api_gates'])
    doc = reference(ref)
    need(doc['result'] == 'passed' and doc['product_source_unchanged_after_commands'] is True
         and doc['product_source_pins'] == PRODUCT_PINS and doc['provider_called'] is False
         and doc['owned_sql_receipt'] == ANCHORS['proof'])
    need([(r['command'], r['exit_code']) for r in doc['commands']] ==
         [('npm.cmd test', 0), ('npm.cmd run lint', 0), ('npm.cmd run typecheck', 0)])
    return doc


def candidate_source_rows():
    baseline, ready, health = anchor('baseline_source'), anchor('baseline_ready'), anchor('health')
    need(ready['deployment']['id'] == CURRENT and ready['deployment']['source_sha256'] ==
         '1af3032799946cedb4b86b061c32d8def260bd1aa09ae1c7625cac9ea1af34dd'
         and ready['stable_alias_matches'] is True and ready['deployment']['source_sha256'] == digest(baseline['files']))
    need(health['result'] == 'passed_read_only_health' and health['web']['id'] == CURRENT
         and health['web']['project_id'] == old.PROJECT and health['web']['team_id'] == old.TEAM
         and health['web']['ready_state'] == 'READY' and health['web']['stable_alias_present'] is True
         and health['worker']['deployment_id'] == WORKER and health['worker']['status'] == 'ready'
         and health['worker']['desired'] == health['worker']['ready'] == health['worker']['total'] == 1)
    base.validate_rows(baseline['files'])
    rows = {row['path']: copy.deepcopy(row) for row in baseline['files']}
    need(CHANGED <= rows.keys() and ADDED not in rows and baseline['entries'] == len(rows) == 284)
    for row in PRODUCT_ROWS:
        rows[row['path']] = copy.deepcopy(row)
    result = sorted(rows.values(), key=lambda row: row['path'])
    need(len(result) == 285 and sum(r['bytes'] for r in result) == 3068061 and digest(result) == EXPECTED_SOURCE_SHA)
    return result


def expected_source_rows():
    result = candidate_source_rows()
    for row in result:
        raw = load(source_path(row['path']))
        need(len(raw) == row['bytes'] and sha(raw) == row['sha256'])
    return result


def source_delta(report):
    base.validate_rows(report['files'])
    need(report['files'] == expected_source_rows() and report['entries'] == len(report['files']))
    before = {r['path']: r for r in anchor('baseline_source')['files']}
    after = {r['path']: r for r in report['files']}
    changed = [{'path': p, 'before': before[p], 'after': after[p]} for p in sorted(before.keys() & after.keys()) if before[p] != after[p]]
    added = [{'path': p, 'before': None, 'after': after[p]} for p in sorted(after.keys() - before.keys())]
    removed = [{'path': p, 'before': before[p], 'after': None} for p in sorted(before.keys() - after.keys())]
    need({r['path'] for r in changed} == CHANGED and [r['path'] for r in added] == [ADDED] and not removed)
    return {'baseline_ready': ANCHORS['baseline_ready'], 'baseline_source': ANCHORS['baseline_source'],
            'baseline_entries': len(before), 'current_entries': len(after), 'current_source_sha256': digest(report['files']),
            'added': added, 'changed': changed, 'removed': removed, 'environment_values_included': False,
            'deployment_performed': False, 'worker_payload_changed': False, 'ui_redesign_included': False}


def source_pins():
    pins = base.source_pins()  # Pure helpers/tool hashes only, never an old main().
    proof()
    verify_pins(PRODUCT_PINS)
    pins.update(PRODUCT_PINS)
    for ref in ANCHORS.values():
        reference(ref)
        pins[ref['path']] = ref['sha256']
    for name in ['web.py', 'test_web.py', 'README.md', 'inputs.template.json']:
        file = HERE / name
        pins[file.relative_to(ROOT).as_posix()] = sha(load(file))
    need(pins[BASE] == BASE_SHA)
    return pins


def stage(value):
    report = reference(value['source'])
    source_delta(report)
    need(report['result'] == 'passed' and report['project_id'] == old.PROJECT and report['team_id'] == old.TEAM
         and report['origin'] == 'https://' + old.ALIAS and report['source_stable'] is True
         and report['private_input_stable'] is True and report['private_hits'] == 0 and report['deployed'] is False
         and report['harness_sha256'] == base.STAGE_SHA)
    relative = report['source_root']
    need(type(relative) is str and re.fullmatch(r'\.local/m07-pilot/web-source-[A-Za-z0-9TZ.-]+-[a-f0-9]{8}', relative))
    folder = ROOT / relative
    need(folder.is_dir() and folder.resolve() == folder and not folder.is_symlink() and not folder.is_junction())
    for row in report['files']:
        raw = load(folder / row['path'])
        need(len(raw) == row['bytes'] and sha(raw) == row['sha256'])
    need(json.loads(load(folder / '.vercel/project.json')) ==
         {'projectId': old.PROJECT, 'orgId': old.TEAM, 'projectName': 'everyone-presentation-pilot'})
    need(base.sealed_source_files(folder) == sorted([r['path'] for r in report['files']] + ['.vercel/project.json']))
    return report, folder


def database_helper(pins):
    # The readback map is the finite SQL/Python projection closure, not the
    # premerge native376/full apply map. Verify every byte before importing it.
    verify_pins(pins)
    need(DB_FILES <= pins.keys())
    spec = importlib.util.spec_from_file_location('batch38_applied_readonly_static', ROOT / DB_HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    need(helper.VERSION == VERSION and helper.MIGRATION_SHA == MIGRATION_SHA
         and helper.projection_sources() == pins)
    return helper


def canonical(refs, live=False):
    need(type(MIGRATION_SHA) is str and re.fullmatch('[a-f0-9]{64}', MIGRATION_SHA))
    need(type(live) is bool and type(refs) is dict and set(refs) == {'apply', 'readback'})
    for ref in refs.values():
        need(type(ref) is dict and type(ref.get('path')) is str and ref['path'].startswith('tracking/evidence/m07/job-batch-filter38-release/'))
    apply, readback = reference(refs['apply']), reference(refs['readback'])
    need(apply['action'] == 'apply' and apply['result'] == 'passed' and readback['action'] == 'readback'
         and readback['result'] == 'observed_applied' and apply['target'] == readback['target'] == TARGET
         and apply['version'] == readback['version'] == VERSION
         and apply['migration_sha256'] == readback['migration_sha256'] == MIGRATION_SHA)
    need(apply['normal_return_marker_observed'] is True and apply['independent_readback_verified'] is True
         and apply['claim_retained'] is True and apply['first'] == apply['second']
         and readback['two_static_reads_equal'] is True and readback['normal_return_not_inferred'] is True
         and readback['full_business_hashes_rechecked'] is False
         and apply['admission']['local_proof'] == ANCHORS['proof'])
    need(apply['preservation'] == {key: True for key in
         ['all74_business_hashes_unchanged', 'trace_hash_unchanged', 'old4_full_pg_proc_unchanged',
          'only_history_and_one_new_function_changed', 'English_Ready_Reviewed_media_protectedM02_preserved',
          'old_catalogue_OAuth_RLS_grants_owners_preserved']})
    projection = readback['source_pins']
    need(type(projection) is dict and DB_FILES <= projection.keys()
         and all(apply['source_pins'].get(file) == digest_value for file, digest_value in projection.items()))
    expected = apply['static_schema_after']
    need(type(expected) is dict and expected == readback['static_schema_after']
         and len(expected['history']) == 38 and expected['history'][-1] == VERSION)
    helper = database_helper(projection)
    need(helper.s.static_schema(apply['first']) == expected)
    helper.s.check_static(expected)
    proof()
    if live:
        need(helper.read_static_state() == expected)
    return digest(expected)


def command(args, provider=False, timeout=60, cwd=ROOT, environment=None):
    result = subprocess.run(args, cwd=cwd, env=environment if environment is not None else old.environment(provider),
                            capture_output=True, timeout=timeout, stdin=subprocess.DEVNULL)
    need(result.returncode == 0 and len(result.stdout) <= 8 * 1024 * 1024 and len(result.stderr) <= 2 * 1024 * 1024)
    return result.stdout.decode('utf8')


def deployment(value):
    result = old.deployment(value)
    markers = MARKERS if result['id'] != CURRENT else [('epsFeedback37' + suffix, field) for suffix, field in
                                                     [('Source', 'source_sha256'), ('Quality', 'quality_sha256'), ('Canonical', 'canonical_sha256')]]
    for key, field in markers:
        marker = value.get('meta', {}).get(key)
        need(marker is None or type(marker) is str and re.fullmatch('[a-f0-9]{64}', marker))
        result[field] = marker
    return result


def api(endpoint):
    need(re.fullmatch(r'/v(?:9/projects|13/deployments)/[A-Za-z0-9_.-]+\?teamId=' + old.TEAM, endpoint))
    return json.loads(command([str(old.NODE), str(old.CLI), 'api', endpoint, '--scope', old.SLUG,
                               '--method', 'GET', '--raw', '--global-config', old.GLOBAL], True, 30))


def observe():
    endpoint = '/v10/projects/' + old.PROJECT + '/env?teamId=' + old.TEAM + '&decrypt=false'
    env = base.environment_rows(json.loads(command([str(old.NODE), str(old.CLI), 'api', endpoint, '--scope', old.SLUG,
                                                  '--method', 'GET', '--raw', '--global-config', old.GLOBAL], True, 30)))
    return {'project': base.project_settings(api('/v9/projects/' + old.PROJECT + '?teamId=' + old.TEAM)),
            'environment': env, 'deployment': deployment(api('/v13/deployments/' + old.ALIAS + '?teamId=' + old.TEAM))}


def exclusive(path, value):
    path.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
    need(path.parent.resolve() == path.parent and not path.parent.is_symlink() and not path.parent.is_junction())
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0), 0o600)
    with os.fdopen(fd, 'w', encoding='utf8', newline='\n') as stream:
        stream.write(json.dumps(value, sort_keys=True, indent=2) + '\n')
        stream.flush()
        os.fsync(stream.fileno())


def save(action, value):
    path = ROOT / 'tracking/evidence/m07/job-batch-filter38-web' / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + action + '.json')
    exclusive(path, {'schema_version': '1.0', 'action': action, 'project_id': old.PROJECT, 'team_id': old.TEAM,
                     'deployment_method': 'provider_source_build', 'no_prebuilt_acceptance': True,
                     'worker_redeployment_attempted': False, 'worker_anchor': WORKER,
                     'oauth_or_environment_mutations': False, 'credentials_or_raw_cli_persisted': False, **value})
    return path.relative_to(ROOT).as_posix()


def plan():
    value = json.loads(load(PLAN))
    need(value['source_pins'] == source_pins() and str(uuid.UUID(value['run_id'])) == value['run_id'])
    product_gates(value['api_gates'])
    base.public_environment(value['public_build_environment'])
    stage(value)
    return value


def build_root(value):
    return PRIVATE / value['run_id'] / 'build'


def build_receipt(value):
    doc = json.loads(load(BUILD))
    report, _ = stage(value)
    need(doc['result'] == 'passed' and doc['plan_sha256'] == sha(load(PLAN)) and doc['source_pins'] == source_pins()
         and doc['files'] == report['files'] and doc['source_sha256'] == digest(report['files'])
         and doc['no_prebuilt_acceptance'] is True and doc['quality_output'] == base.quality_output(build_root(value)))
    return doc


def admission(value, live=False):
    doc = json.loads(load(ADMISSION))
    need(set(doc) == {'plan_sha256', 'canonical', 'canonical_schema_sha256', 'source_pins'}
         and doc['plan_sha256'] == sha(load(PLAN)) and doc['source_pins'] == source_pins())
    need(canonical(doc['canonical'], live) == doc['canonical_schema_sha256'])
    return doc


def deploy_command(folder, source_hash, quality_hash, canonical_hash):
    args = [str(old.NODE), str(old.CLI), 'deploy', str(folder), '--prod', '--yes', '--no-wait',
            '--scope', old.SLUG, '--project', old.PROJECT]
    for (key, _), value in zip(MARKERS, [source_hash, quality_hash, canonical_hash]):
        args += ['--meta', key + '=' + value]
    return args + ['--global-config', old.GLOBAL]


def ready(direct, alias, source_hash, quality_hash, canonical_hash):
    need(direct == alias and direct['state'] == 'READY' and direct['id'] != CURRENT
         and direct['source_sha256'] == source_hash and direct['quality_sha256'] == quality_hash
         and direct['canonical_sha256'] == canonical_hash)
    return direct


def dispatch(value, source, doc, before):
    need(not CLAIM.exists() and not RETURNED.exists() and observe() == before)
    bound = admission(value, True)
    exclusive(CLAIM, {'run_id': value['run_id'], 'plan_sha256': sha(load(PLAN)), 'build_sha256': sha(load(BUILD)),
                      'canonical_admission_sha256': sha(load(ADMISSION)), 'source_pins': source_pins(),
                      'before': before, 'dispatch_may_have_occurred': True, 'automatic_retry': False})
    need(plan() == value and build_receipt(value) == doc and observe() == before and admission(value, True) == bound)
    raw = command(deploy_command(source, doc['source_sha256'], sha(load(BUILD)), bound['canonical_schema_sha256']), True, 60)
    url = old.deployment_url(raw)
    exclusive(RETURNED, {'claim_sha256': sha(load(CLAIM)), 'url': url, 'process_returned': True})
    return {'result': 'submitted', 'url': url, 'claim_retained': True, 'ready_verified': False, 'automatic_retry': False}


def inputs(path, action):
    doc = json.loads(load(Path(path).resolve()))
    need(type(doc) is dict and set(doc) == {'prepare', 'admit'})
    return doc[action]


def main(argv=None):
    need(DEPLOY_ENABLED)  # Before input, private directory, CLI, tool-cache or provider access.
    args = sys.argv[1:] if argv is None else argv
    need(len(args) in [1, 2] and args[0] in ['prepare', 'inspect', 'build', 'admit', 'deploy', 'readback'])
    action = args[0]
    if action == 'prepare':
        need(len(args) == 2 and not PLAN.exists())
        supplied = inputs(args[1], 'prepare')
        need(set(supplied) == {'source_receipt', 'api_gates_receipt', 'public_build_environment'})
        product_gates(supplied['api_gates_receipt'])
        value = {'run_id': str(uuid.uuid4()), 'source': supplied['source_receipt'], 'api_gates': supplied['api_gates_receipt'],
                 'public_build_environment': base.public_environment(supplied['public_build_environment']), 'source_pins': source_pins()}
        report, _ = stage(value)
        delta = source_delta(report)
        exclusive(PLAN, value)
        public = {'run_id': value['run_id'], 'source': value['source'], 'api_gates': value['api_gates'],
                  'plan_sha256': sha(load(PLAN)), 'source_pins': value['source_pins'], 'source_delta': delta,
                  'public_environment_keys': sorted(value['public_build_environment']),
                  'public_environment_sha256': digest(value['public_build_environment']), 'environment_values_persisted': False}
        return {'result': 'prepared', 'receipt': save('prepare', public)}
    value = plan()
    report, source = stage(value)
    if action == 'admit':
        need(len(args) == 2 and not ADMISSION.exists() and not CLAIM.exists())
        build_receipt(value)
        refs = inputs(args[1], 'admit')
        state = canonical(refs, True)
        exclusive(ADMISSION, {'plan_sha256': sha(load(PLAN)), 'canonical': refs, 'canonical_schema_sha256': state, 'source_pins': source_pins()})
        return {'result': 'bound', 'receipt': save('canonical-admission', {'canonical': refs, 'canonical_schema_sha256': state, 'deployed': False})}
    need(len(args) == 1)
    if action == 'inspect':
        need(not INSPECT.exists() and not CLAIM.exists())
        before = observe()
        direct = deployment(api('/v13/deployments/' + CURRENT + '?teamId=' + old.TEAM))
        need(before['deployment'] == direct and direct == anchor('baseline_ready')['deployment'] and observe() == before)
        exclusive(INSPECT, before)
        return {'result': 'passed', 'receipt': save('inspect', {'before': before, 'deployed': False})}
    before = json.loads(load(INSPECT))
    if action == 'build':
        folder = build_root(value)
        need(not BUILD_CLAIM.exists() and not BUILD.exists() and observe() == before and folder.resolve() == folder and not folder.exists())
        exclusive(BUILD_CLAIM, {'plan_sha256': sha(load(PLAN)), 'source_pins': source_pins(), 'dispatch_may_have_occurred': True, 'automatic_retry': False})
        folder.mkdir(parents=True, exist_ok=False)
        need(folder.resolve() == folder and not folder.is_symlink() and not folder.is_junction())
        for row in report['files']:
            destination = folder / row['path']
            destination.parent.mkdir(parents=True, exist_ok=True)
            raw = load(source / row['path'])
            need(sha(raw) == row['sha256'])
            with destination.open('xb') as stream:
                stream.write(raw)
        for name in ['empty-npmrc', 'empty-global-npmrc']:
            (folder / name).write_text('', encoding='utf8')
        install, build = base.build_commands(folder)
        env = base.build_environment(value['public_build_environment'], folder)
        command(install, timeout=900, cwd=folder, environment=env)
        command(build, timeout=900, cwd=folder, environment=env)
        generated = []
        for row in report['files']:
            actual = sha(load(folder / row['path']))
            if actual != row['sha256']:
                need(row['path'] == 'apps/web/next-env.d.ts')
                generated.append({'path': row['path'], 'staged_sha256': row['sha256'], 'framework_sha256': actual})
        need(all(not list(p.glob('.env*')) for p in [folder, folder / '.vercel', folder / 'apps/web', folder / 'apps/web/.vercel'])
             and observe() == before and plan() == value)
        doc = {'result': 'passed', 'action': 'build', 'files': report['files'], 'source_sha256': digest(report['files']),
               'quality_output': base.quality_output(folder), 'framework_generated_deltas': generated,
               'plan_sha256': sha(load(PLAN)), 'source_pins': source_pins(), 'isolated': True,
               'private_environment_transferred': False, 'exit_code': 0, 'no_prebuilt_acceptance': True}
        exclusive(BUILD, doc)
        return {'result': 'passed', 'receipt': save('build', doc)}
    doc = build_receipt(value)
    if action == 'deploy':
        return dispatch(value, source, doc, before)
    bound = admission(value, True)
    claim, returned = json.loads(load(CLAIM)), json.loads(load(RETURNED))
    need(claim['plan_sha256'] == sha(load(PLAN)) and claim['build_sha256'] == sha(load(BUILD))
         and claim['canonical_admission_sha256'] == sha(load(ADMISSION)) and claim['source_pins'] == source_pins()
         and returned['claim_sha256'] == sha(load(CLAIM)) and returned['process_returned'] is True)
    url = returned['url']
    need(old.deployment_url(url) == url)
    current = observe()
    direct = deployment(api('/v13/deployments/' + url.removeprefix('https://') + '?teamId=' + old.TEAM))
    ready(direct, current['deployment'], doc['source_sha256'], sha(load(BUILD)), bound['canonical_schema_sha256'])
    need(current['project'] == before['project'] and current['environment'] == before['environment']
         and observe() == current and plan() == value and build_receipt(value) == doc and admission(value, True) == bound)
    return {'result': 'passed', 'receipt': save('ready', {'deployment': direct, 'stable_alias_matches': True,
            'project_settings_link_preserved': True, 'environment_ids_targets_preserved': True,
            'canonical38_static_contract_preserved': True, 'claim_retained': True, 'application_acceptance': False,
            'rollback_anchor': ANCHORS['baseline_ready'], 'rollback_performed': False})}


if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except Exception:
        print('BATCH38_WEB_UNCONFIRMED')
        sys.exit(1)
