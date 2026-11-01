"""New disabled web37 purpose. Import reads only pinned public helper source.

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
CURRENT = 'dpl_6pcN8Qb1XDkBTsiwKVmexKfWUvf7'
WORKER = 'dpl_2uASsbYobSDwWjMptPjGLcVEdCg3'
TARGET = 'pyibofyctwnqpvktepse'
VERSION = '20261101042702'
MIGRATION = 'supabase/migrations/20261101042702_m07_feedback_summary.sql'
MIGRATION_SHA = '14bb7f74e597b9a1a9b49df6fe047b16a788efa703e5d7a849ed254c3cbe98b3'
BASE = 'development/m07/workspace-summary35-web/web.py'
BASE_SHA = 'b306de33cbfe1a2d43426d0d9ec8e397618e847d94cd19692a3f6caff3e0a483'
DB_HELPER = 'development/m07/feedback-summary37-release/release.py'
DB_FILES = {f'development/m07/feedback-summary37-release/{name}' for name in
            ['state.py', 'release.py', 'test_release.py', 'README.md', 'admission.template.json']}
ANCHORS = {
    'baseline_ready': {'path': 'tracking/evidence/m07/source-unreadable36-web/2026-11-01T03-10-26-362504Z-ready.json', 'sha256': 'e6c8391fd3ff19f74cd4eccad10244aa4fd32ff7b21bc828f94468659616dd01'},
    'baseline_source': {'path': 'tracking/evidence/m07/controlled-pilot/2026-11-01T03-00-41-778Z-1fd134aa-web-source.json', 'sha256': 'b18d39364440d021610b678b7ab8a2923dcfe811230163f9bc6ef02dddcff9fa'},
    'health': {'path': 'tracking/evidence/m07/controlled-pilot/2026-11-01T04-17-19-997448Z-worker-web-health.json', 'sha256': 'a6b799790a32aa68f1675c637908b354ebf0ce650cd0a3760207f39e6231ca17'},
    'proof': {'path': 'tracking/evidence/m07/feedback-summary37-proof/2026-11-01T09-45-45-482Z-e109a4d1.json', 'sha256': '3a98d0dabac723e8c599f200a30e6849596b41281c0828868a64a313d008b1b9'},
    'api_gates': {'path': 'tracking/evidence/m07/feedback-summary37/2026-11-01-root-product-checks.json', 'sha256': '60cef2a97b7914150b5900816259a50037e647b038ee931f2bc151628d580536'},
}
CHANGED = {'apps/web/lib/generated-contracts.json', 'apps/web/lib/guest-http.ts', 'apps/web/lib/mcp.ts',
           'contracts/mcp-tool-catalog.json', 'packages/central/src/guest-reviews.ts',
           'packages/domain/src/guest-types.ts', 'packages/domain/src/index.ts'}
ADDED = 'packages/domain/src/feedback-summary.ts'
MARKERS = [('epsFeedback37Source', 'source_sha256'), ('epsFeedback37Quality', 'quality_sha256'), ('epsFeedback37Canonical', 'canonical_sha256')]
PRIVATE = ROOT / '.local/m07-feedback-summary37-web'
PLAN = PRIVATE / 'plan.json'
INSPECT = PRIVATE / 'provider-before.json'
BUILD_CLAIM = PRIVATE / 'build.claim.json'
BUILD = PRIVATE / 'build.json'
ADMISSION = PRIVATE / 'canonical-admission.json'
CLAIM = PRIVATE / 'deploy.claim.json'
RETURNED = PRIVATE / 'deploy.returned.json'


def need(value):
    if not value:
        raise ValueError('FEEDBACK37_WEB_UNCONFIRMED')


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
spec = importlib.util.spec_from_file_location('feedback37_pinned_pure_web_helpers', ROOT / BASE)
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
    doc = anchor('proof')
    need(doc['run_id'] == 'e109a4d1-b3e8-4caf-98d8-773251359e91' and doc['result'] == 'passed'
         and doc['checkpoint'] == 'complete' and len(doc['source_seals']) == 217)
    verify_pins(doc['source_seals'])
    check = doc['feedback37_sql']
    need(check['result'] == 'passed' and check['actual37_sha256'] == MIGRATION_SHA
         and check['migration37'] == MIGRATION and check['persistent_history_count'] == 33)
    for key in ['actual34_to37_functional_DDL', 'full_counts_internal_and_guest_authority_assertions',
                'history34_to37_ephemeral', 'ddl_data_catalogue_roles_rolled_back']:
        need(check[key] is True)
    for key in ['disposable_databases_removed', 'new33_roles_removed', 'original_local_database_unchanged',
                'original29_full_catalogue_unchanged', 'original29_full_auth_storage_catalogue_unchanged',
                'original29_exact_profile_and_settings_state_unchanged',
                'existing_global_role_oids_attributes_memberships_unchanged', 'shared_test_lock_released']:
        need(doc[key] is True)
    need(doc['cloud_called'] is False and doc['provider_called'] is False and check['hosted_acceptance'] is False)
    return doc


def product_gates(ref):
    need(ref == ANCHORS['api_gates'])
    doc = reference(ref)
    need(doc['result'] == 'passed' and doc['product_typescript_contracts_unchanged_after_commands'] is True
         and doc['owned_sql_receipt'] == ANCHORS['proof']['path']
         and doc['owned_sql_receipt_sha256'] == ANCHORS['proof']['sha256'] and doc['provider_called'] is False)
    need([(r['command'], r['exit_code']) for r in doc['commands']] ==
         [('npm.cmd test', 0), ('npm.cmd run lint', 0), ('npm.cmd run typecheck', 0)])
    return doc


def expected_source_rows():
    baseline, ready, health = anchor('baseline_source'), anchor('baseline_ready'), anchor('health')
    need(ready['deployment']['id'] == CURRENT and ready['deployment']['source_sha256'] ==
         'd17a3f4eba0f0dc5a19ed02bc0c717c8b1472ce692fe910118ace3238fbc79ee'
         and ready['stable_alias_matches'] is True and ready['deployment']['source_sha256'] == digest(baseline['files']))
    need(health['web']['id'] == CURRENT and health['worker']['deployment_id'] == WORKER and health['result'] == 'passed')
    base.validate_rows(baseline['files'])
    pins = proof()['source_seals']
    rows = {row['path']: copy.deepcopy(row) for row in baseline['files']}
    need(CHANGED <= rows.keys() and ADDED not in rows and baseline['entries'] == len(rows))
    for file in CHANGED | {ADDED}:
        raw = load(source_path(file))
        need(sha(raw) == pins[file])
        rows[file] = {'path': file, 'bytes': len(raw), 'sha256': sha(raw)}
    for file, row in rows.items():
        raw = load(source_path(file))
        need(len(raw) == row['bytes'] and sha(raw) == row['sha256'])
    return sorted(rows.values(), key=lambda row: row['path'])


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
    pins = base.source_pins()  # Hash checks only; no old main(), claim or provider command.
    pins.update(proof()['source_seals'])
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
    verify_pins(pins)
    need(DB_FILES <= pins.keys())
    spec = importlib.util.spec_from_file_location('feedback37_applied_readonly_static', ROOT / DB_HELPER)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    need(helper.VERSION == VERSION and helper.MIGRATION_SHA == MIGRATION_SHA)
    return helper


def canonical(refs, live=False):
    need(type(live) is bool and type(refs) is dict and set(refs) == {'apply', 'readback'})
    for ref in refs.values():
        need(type(ref) is dict and type(ref.get('path')) is str and ref['path'].startswith('tracking/evidence/m07/feedback-summary37-release/'))
    apply, readback = reference(refs['apply']), reference(refs['readback'])
    need(apply['action'] == 'apply' and apply['result'] == 'passed' and readback['action'] == 'readback'
         and readback['result'] == 'observed_applied' and apply['target'] == readback['target'] == TARGET
         and apply['version'] == readback['version'] == VERSION
         and apply['migration_sha256'] == readback['migration_sha256'] == MIGRATION_SHA)
    need(apply['normal_return_marker_observed'] is True and apply['independent_readback_verified'] is True
         and apply['claim_retained'] is True and apply['first'] == apply['second']
         and readback['claim_retained'] is True
         and readback['original_dispatch_normal_return_not_inferred'] is True
         and apply['source_pins'] == readback['source_pins'] and apply['admission'] == readback['admission'])
    expected = apply['static_schema_after']
    need(type(expected) is dict and expected == readback['static_schema_after']
         and len(expected['history']) == 37 and expected['history'][-1] == VERSION and DB_FILES <= apply['source_pins'].keys())
    helper = database_helper(apply['source_pins'])
    need(helper.s.static_schema(apply['first']) == expected)
    helper.s.check_static(expected)
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
    markers = MARKERS if result['id'] != CURRENT else [('epsSourceUnreadable36' + suffix, field) for suffix, field in
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
    path = ROOT / 'tracking/evidence/m07/feedback-summary37-web' / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + action + '.json')
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
            'canonical37_static_contract_preserved': True, 'claim_retained': True, 'application_acceptance': False,
            'rollback_anchor': ANCHORS['baseline_ready'], 'rollback_performed': False})}


if __name__ == '__main__':
    try:
        print(json.dumps(main()))
    except Exception:
        print('FEEDBACK37_WEB_UNCONFIRMED')
        sys.exit(1)
