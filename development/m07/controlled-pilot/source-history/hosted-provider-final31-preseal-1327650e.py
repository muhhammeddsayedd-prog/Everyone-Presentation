"""Root-operated, once-only hosted Auth update. Importing is inert.

No token loader, HTTP-hook secret, SQL, hook deletion, or retry fallback exists.
Provider comparator data lives only in RAM. Public evidence excludes its values
and hashes; canonical database ACL verification is a separate prerequisite.
"""
from pathlib import Path, PurePosixPath
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

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
TARGET = 'pyibofyctwnqpvktepse'
HOST = 'https://everyone-presentation-pilot.vercel.app'
WEB_PROJECT = 'prj_7xOsfRtvJ9voYi7rTEfra5ncOoA0'
HOOK = 'pg-functions://postgres/eps/mcp_custom_access_token_hook'
REDIRECTS = ['http://127.0.0.1:3000/api/auth/callback', HOST + '/api/auth/callback']
REDIRECT_PATH = ('auth', 'additional_redirect_urls')
SELECTED = {('auth', 'site_url'): 'site_url',
            ('auth', 'oauth_server', 'enabled'): 'oauth_server_enabled',
            ('auth', 'oauth_server', 'authorization_url_path'): 'oauth_server_authorization_path',
            ('auth', 'oauth_server', 'allow_dynamic_registration'): 'oauth_server_allow_dynamic_registration',
            ('auth', 'hook', 'custom_access_token', 'enabled'): 'hook_custom_access_token_enabled',
            ('auth', 'hook', 'custom_access_token', 'uri'): 'hook_custom_access_token_uri'}
DESIRED = dict(zip(SELECTED.values(), (HOST, True, '/oauth/consent', False, True, HOOK)))
CORE_CHECKS = ('projects', 'settings', 'processing', 'specs_openai_n8n', 'video_openai_n8n',
               'native_frames', 'selection_pdf', 'guest_feedback', 'guest_original_video')
CORE_REL = 'tracking/evidence/m07/controlled-pilot/HOSTED_CORE.json'
PRIVATE = ROOT / '.local/m07-pilot/hosted-provider-final31'
CLAIM = PRIVATE / 'apply.claim.json'
FIXED_PINS = {'supabase/.temp/project-ref': 'f706303084a6135ca452a75e7c40e4746086e8cadc156c66e4e42af80b4c0ee5',
              'supabase/config.toml': '0a50cd9902ed3a31b57cde31171f725310ed8d0d3efbd7226f894d48272dfbb2'}
FORBIDDEN_ENV = {'SUPABASE_PROJECT_ID', 'SUPABASE_PROJECT_REF', 'SUPABASE_API_URL', 'SUPABASE_WORKDIR',
                 'SUPABASE_DB_URL', 'SUPABASE_DEBUG', 'DATABASE_URL', 'PGHOST', 'PGHOSTADDR', 'PGPORT',
                 'PGDATABASE', 'PGUSER', 'PGPASSWORD', 'PGPASSFILE', 'PGSERVICE', 'PGSERVICEFILE', 'PGOPTIONS',
                 'PGSSLMODE', 'PGSSLROOTCERT', 'PGSSLCERT', 'PGSSLKEY', 'PGSSLNEGOTIATION', 'NODE_OPTIONS',
                 'NPM_CONFIG_NODE_OPTIONS', 'NODE_TLS_REJECT_UNAUTHORIZED', 'NODE_EXTRA_CA_CERTS',
                 'NODE_DEBUG', 'NODE_DEBUG_NATIVE', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'REQUESTS_CA_BUNDLE',
                 'CURL_CA_BUNDLE'}


# Draft remains inert until this exact guard source and its real31/core plan are reviewed.
GUARD_SHA = ''
def admit31():
    require(type(GUARD_SHA) is str and re.fullmatch('[a-f0-9]{64}',GUARD_SHA))
    file=HERE/'hosted-oauth-final31-guard.py'
    require(file.is_file() and not file.is_symlink() and file.resolve()==file and 0<file.stat().st_size<=512*1024)
    data=file.read_bytes();require(hashlib.sha256(data).hexdigest()==GUARD_SHA)
    spec=importlib.util.spec_from_file_location('approved_oauth31_guard',file)
    guard=importlib.util.module_from_spec(spec);spec.loader.exec_module(guard)
    gate=guard.admit31();guard.validate_gate(gate,require_actual=True)
    require(guard.ROOT==ROOT and guard.TARGET==TARGET and gate['history'][-1]=='20261031010000' and len(gate['history'])==31)
    return gate


def require(value):
    if not value: raise ValueError('HOSTED_PROVIDER_UNCONFIRMED')


class CommandProcessUnconfirmed(ValueError):
    """A CLI-parent timeout does not establish descendant process absence."""


def exact(value, keys):
    require(type(value) is dict and set(value) == set(keys))


def validate_environment(environment):
    require(not any(value for key, value in environment.items() if key.upper() in FORBIDDEN_ENV))


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)


def equal(a, b):
    return canonical(a) == canonical(b)


def inventory(value):
    return [[list(path), value[path]] for path in sorted(value)]


def same_state(a, b):
    return equal(a['selected'], b['selected']) and equal(inventory(a['other_remote']), inventory(b['other_remote']))


def receipt_path(value):
    require(type(value) is str and len(value) <= 300 and value.startswith('tracking/evidence/m07/controlled-pilot/')
            and re.fullmatch('[A-Za-z0-9_./+-]+[.]json', value) and ':' not in value and '\\' not in value
            and '..' not in PurePosixPath(value).parts and not PurePosixPath(value).is_absolute())
    return ROOT / value


def validate_core(value):
    exact(value, ('schema_version', 'result', 'target', 'origin', 'web_project_id', 'web_deployment_id',
                  'acting_user_id', 'core_checks', 'evidence_receipts'))
    require(value['schema_version'] == '1.0' and value['result'] == 'passed' and value['target'] == TARGET
            and value['origin'] == HOST and value['web_project_id'] == WEB_PROJECT)
    require(type(value['web_deployment_id']) is str and re.fullmatch('dpl_[A-Za-z0-9]{8,100}', value['web_deployment_id']))
    actor = value['acting_user_id']
    require(type(actor) is str and re.fullmatch('[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', actor)
            and str(uuid.UUID(actor)) == actor and uuid.UUID(actor).int != 0)
    exact(value['core_checks'], CORE_CHECKS)
    require(all(type(item) is str and item == 'passed' for item in value['core_checks'].values()))
    refs = value['evidence_receipts']
    require(type(refs) is list and 1 <= len(refs) <= 128 and all(type(item) is str for item in refs)
            and len(set(refs)) == len(refs))
    for ref in refs: require(receipt_path(ref) != ROOT / CORE_REL)
    return copy.deepcopy(value)


def public_file(path, limit):
    # Refuse junctions/symlinks at every existing component, before reading.
    require(path.is_absolute() and path.is_relative_to(ROOT))
    for component in [path, *list(path.parents)[:len(path.relative_to(ROOT).parts)]]:
        require(not component.is_symlink() and not (getattr(component.lstat(), 'st_file_attributes', 0) & 0x400))
    require(path.resolve() == path and path.is_file())
    before = path.stat(); require(0 < before.st_size <= limit)
    data = path.read_bytes(); after = path.stat()
    require((before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns) ==
            (after.st_dev, after.st_ino, after.st_size, after.st_mtime_ns) and len(data) == before.st_size)
    return data, {'sha256': hashlib.sha256(data).hexdigest(), 'size': before.st_size,
                  'mtime_ns': before.st_mtime_ns, 'device': before.st_dev, 'inode': before.st_ino}


def inputs():
    admit31()
    # All files are public source/evidence. This executes before CLI auth access.
    pins = {}
    for rel in [*FIXED_PINS, 'development/m07/controlled-pilot/hosted-provider-final31.py',
                'development/m07/controlled-pilot/test_hosted_provider_final31.py',
                'development/m07/controlled-pilot/HOSTED_PROVIDER_FINAL31.md']:
        _, pin = public_file(ROOT / rel, 512 * 1024); pins[rel] = pin
        if rel in FIXED_PINS: require(pin['sha256'] == FIXED_PINS[rel])
    data, pin = public_file(ROOT / CORE_REL, 256 * 1024)
    core = validate_core(json.loads(data)); pins[CORE_REL] = pin
    for rel in core['evidence_receipts']:
        _, pin = public_file(receipt_path(rel), 2 * 1024 * 1024); pins[rel] = pin
    return pins


def rows(value, pull=False):
    require(type(value) is dict and type(value.get('target')) is dict
            and value['target'].get('project_ref') == TARGET and 'branch' not in value['target'])
    if pull: require(value.get('dry_run') is True and value.get('wrote') is False)
    changes = value.get('changes'); require(type(changes) is list and len(changes) <= 2000)
    result = {}
    for row in changes:
        require(type(row) is dict and type(row.get('path')) is list and 1 <= len(row['path']) <= 8
                and all(type(part) is str and re.fullmatch('[a-zA-Z0-9_]{1,100}', part) for part in row['path']))
        path = tuple(row['path']); require(path not in result and 'remote' in row)
        if pull: require(row.get('written') is False)
        result[path] = row
    return result


def validate_state(value):
    exact(value, ('selected', 'other_remote')); exact(value['selected'], DESIRED)
    s = value['selected']
    require(s['site_url'] in ('http://localhost:3000', 'http://127.0.0.1:3000', HOST))
    for key in ('oauth_server_enabled', 'hook_custom_access_token_enabled'): require(type(s[key]) is bool)
    if s['oauth_server_enabled']:
        require(type(s['oauth_server_allow_dynamic_registration']) is bool
                and type(s['oauth_server_authorization_path']) is str
                and re.fullmatch('/[A-Za-z0-9_/-]{0,240}', s['oauth_server_authorization_path']))
    else:
        # These are unknown/pruned, not inferred remote values.
        require(s['oauth_server_allow_dynamic_registration'] is None and s['oauth_server_authorization_path'] is None)
    if s['hook_custom_access_token_enabled']: require(s['hook_custom_access_token_uri'] == HOOK)
    else: require(s['hook_custom_access_token_uri'] is None)
    other = value['other_remote']; require(type(other) is dict and REDIRECT_PATH in other and equal(other[REDIRECT_PATH], REDIRECTS))
    require(not set(other).intersection(SELECTED))
    for path in other:
        require(type(path) is tuple and 1 <= len(path) <= 8
                and all(type(part) is str and re.fullmatch('[a-zA-Z0-9_]{1,100}', part) for part in path))
    canonical(inventory(other))
    return copy.deepcopy(value)


def parse_reads(values):
    # Counterfactual LOCAL documents are only used by pull --dry-run, never push.
    # They expose equal/default values without pretending an omitted value was read.
    require(type(values) is list and len(values) == 3)
    union = {}; other = None
    for value in values:
        parsed = rows(value, pull=True)
        current = {path: copy.deepcopy(row['remote']) for path, row in parsed.items() if path not in SELECTED}
        if other is None: other = current
        else: require(equal(inventory(other), inventory(current)))
        for path, key in SELECTED.items():
            if path not in parsed or parsed[path]['remote'] is None: continue
            if key in union: require(equal(union[key], parsed[path]['remote']))
            union[key] = copy.deepcopy(parsed[path]['remote'])
    selected = {key: union.get(key) for key in DESIRED}
    return validate_state({'selected': selected, 'other_remote': other})


def validate_diff(value, before):
    validate_state(before); parsed = rows(value)
    expected = {path for path, key in SELECTED.items() if not equal(before['selected'][key], DESIRED[key])}
    require(set(parsed) == expected | set(before['other_remote']))
    for path, row in parsed.items():
        if path not in SELECTED:
            require(row.get('class') == 'remote_only' and row.get('declared') is False
                    and equal(row['remote'], before['other_remote'][path]))
            continue
        key = SELECTED[path]; old = before['selected'][key]
        require(row.get('declared') is True and equal(row.get('local'), DESIRED[key]) and equal(row['remote'], old)
                and row.get('class') == ('local_only' if old is None else 'update'))
    patch = {SELECTED[path]: DESIRED[SELECTED[path]] for path in sorted(expected)}
    # Exact pinned CLI hook container semantics: enabling and URI always travel together.
    if any(path[:3] == ('auth', 'hook', 'custom_access_token') for path in expected):
        patch.update(hook_custom_access_token_enabled=True, hook_custom_access_token_uri=HOOK)
    # The three OAuth leaves have no grouping fallback: each must be in this patch
    # when enabling an off server. Never disable an on server just to force a diff.
    if not before['selected']['oauth_server_enabled']:
        require(all(key in patch for key in ('oauth_server_enabled', 'oauth_server_authorization_path',
                                             'oauth_server_allow_dynamic_registration')))
    require(set(patch) <= set(DESIRED))
    return patch


def base_report():
    return {'schema_version': '1.0', 'target': TARGET, 'desired_auth_fields': dict(DESIRED),
            'preserved_exact_redirects': list(REDIRECTS), 'result': 'unconfirmed', 'dispatch_attempted': False,
            'push_outcome': 'not_attempted', 'automatic_push_retry': False, 'provider_configuration_observed': False,
            'application_verified_by_readback': False, 'original_baseline_available': False,
            'nonselected_returned_comparator_preserved': None, 'independent_readback_equal': False,
            'database_hook_acl_verified_by_this_operator': False, 'unreturned_or_secret_plaintext_preservation_proven': False,
            'raw_provider_values_or_hashes_persisted': False, 'claim_retained': False,
            'cli_patch_unknown_transport_or_5xx_retry': False, 'cli_patch_429_retries_maximum': 5,
            'process_cleanup_unconfirmed': False}


def read_pair(io):
    result = []; unresolved = False
    for _ in range(2):
        try: result.append(validate_state(io.read()))
        except (CommandProcessUnconfirmed, subprocess.TimeoutExpired):
            unresolved = True; result.append(None)
        except Exception: result.append(None)
    return result, unresolved


def summarize(report, before, after, independent):
    matched = after is not None and independent is not None and same_state(after, independent)
    observed = independent is not None and equal(independent['selected'], DESIRED)
    preserved = (equal(inventory(before['other_remote']), inventory(after['other_remote']))
                 and equal(inventory(before['other_remote']), inventory(independent['other_remote']))) if before and after and independent else None
    verified = before is not None and matched and observed and preserved is True
    report.update(result='passed' if verified else 'unconfirmed', provider_configuration_observed=observed,
                  application_verified_by_readback=verified, original_baseline_available=before is not None,
                  nonselected_returned_comparator_preserved=preserved, independent_readback_equal=matched)
    return report


def readback_only(io):
    report = base_report(); io.verify(); (after, independent), unresolved = read_pair(io)
    summarize(report, None, after, independent)
    report['process_cleanup_unconfirmed'] = unresolved
    try: io.verify()
    except Exception: report.update(result='unconfirmed', application_verified_by_readback=False)
    return report


def apply_once(io):
    baseline_pins = io.verify(); before = validate_state(io.read())
    if equal(before['selected'], DESIRED): return readback_only(io)
    patch = validate_diff(io.difference(), before); require(patch and io.verify() == baseline_pins)
    try:
        io.claim({'schema_version': '1.0', 'target': TARGET, 'desired_auth_fields': dict(DESIRED),
                  'source_and_core_pins': baseline_pins, 'dispatch_may_have_occurred': True})
    except FileExistsError:
        report = readback_only(io); report['claim_retained'] = True; return report
    # A claim is intentionally consumed even if a new guard failure prevents dispatch.
    fresh = validate_state(io.read()); require(same_state(before, fresh))
    require(equal(validate_diff(io.difference(), fresh), patch) and io.verify() == baseline_pins)
    report = base_report(); report.update(dispatch_attempted=True, claim_retained=True, push_outcome='unknown',
                                         planned_single_auth_patch=patch)
    try: io.push(); report['push_outcome'] = 'command_succeeded'
    except (CommandProcessUnconfirmed, subprocess.TimeoutExpired): report['process_cleanup_unconfirmed'] = True
    except Exception: pass  # A timeout/error can follow commit; never push again.
    (after, independent), unresolved = read_pair(io); summarize(report, before, after, independent)
    report['process_cleanup_unconfirmed'] = report['process_cleanup_unconfirmed'] or unresolved
    if report['process_cleanup_unconfirmed']:
        report.update(result='unconfirmed', application_verified_by_readback=False)
    try: require(io.verify() == baseline_pins)
    except Exception: report.update(result='unconfirmed', application_verified_by_readback=False)
    return report


def config(directory, mode):
    require(mode in ('write', 'read-a', 'read-b', 'read-c'))
    if mode == 'read-c':
        body = 'project_id="eps-hosted-provider-final31-read"\n[auth]\nadditional_redirect_urls=[]\n[auth.oauth_server]\nenabled=false\n[auth.hook.custom_access_token]\nenabled=false\n'
    else:
        alternate = mode == 'read-b'
        site = 'https://eps-readback.invalid' if alternate else HOST
        path = '/oauth/readback-only' if alternate else '/oauth/consent'
        hook = 'pg-functions://postgres/eps/eps_readback_only_never_called' if alternate else HOOK
        body = ('project_id="eps-hosted-provider"\n[auth]\nsite_url=' + json.dumps(site) + '\n'
                + ('additional_redirect_urls=[]\n' if mode != 'write' else '')
                + '[auth.oauth_server]\nenabled=true\nallow_dynamic_registration=' + ('true' if alternate else 'false')
                + '\nauthorization_url_path=' + json.dumps(path)
                + '\n[auth.hook.custom_access_token]\nenabled=true\nuri=' + json.dumps(hook) + '\n')
    data = body.encode('utf-8'); (directory / 'supabase').mkdir(parents=True, exist_ok=False)
    file = directory / 'supabase/config.toml'; file.write_bytes(data)
    require(directory.resolve() == directory and not file.is_symlink() and file.read_bytes() == data)
    return file, data


def command_args(action, directory):
    require(action in ('pull', 'diff', 'push'))
    args = ['npx.cmd', '--yes', 'supabase@2.122.0', 'config', action, '--project-ref', TARGET,
            '--workdir', str(directory), '--output-format', 'json']
    if action == 'pull': args.append('--dry-run')
    if action == 'push': args.append('--yes')
    return args


def cli(action, directory):
    admit31()
    # Existing protected CLI login only; do not read token files or fetch service keys.
    validate_environment(os.environ)
    try:
        result = subprocess.run(command_args(action, directory), cwd=ROOT, capture_output=True, text=True,
                                encoding='utf-8', errors='replace', timeout=60, stdin=subprocess.DEVNULL)
    except subprocess.TimeoutExpired:
        raise CommandProcessUnconfirmed('HOSTED_PROVIDER_PROCESS_CLEANUP_UNCONFIRMED') from None
    require(result.returncode == 0)
    if action == 'push': return None
    require(len(result.stdout.encode('utf-8')) <= 4 * 1024 * 1024)
    try: return json.loads(result.stdout)
    except Exception: raise ValueError('HOSTED_PROVIDER_UNCONFIRMED') from None


def permanent_claim(value):
    require(PRIVATE.resolve() == PRIVATE and not PRIVATE.is_symlink())
    descriptor = os.open(CLAIM, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(descriptor, 'w', encoding='utf-8') as file:
        json.dump(value, file, indent=2); file.write('\n'); file.flush(); os.fsync(file.fileno())


def final_source_check(io, report):
    try:
        io.verify(); report['repository_link_and_config_preserved'] = True
    except Exception:
        report.update(result='unconfirmed', application_verified_by_readback=False,
                      repository_link_and_config_preserved=False)


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('inspect', 'apply', 'readback'))
    action = sys.argv[1]; validate_environment(os.environ); admit31()
    initial = inputs()  # Core and public source gates before any private CLI access.
    run = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8]
    directory = PRIVATE / run; directory.mkdir(parents=True, exist_ok=False); require(directory.resolve() == directory)
    write_file, write_data = config(directory / 'write', 'write')
    count = 0

    class ActualIO:
        def verify(self):
            observed = inputs(); require(observed == initial); return observed
        def read(self):
            nonlocal count
            count += 1; result = []
            for mode in ('read-a', 'read-b', 'read-c'):
                selected = directory / ('read-' + str(count) + '-' + mode)
                file, data = config(selected, mode); result.append(cli('pull', selected)); require(file.read_bytes() == data)
            return parse_reads(result)
        def difference(self):
            require(write_file.read_bytes() == write_data); value = cli('diff', write_file.parent.parent)
            require(write_file.read_bytes() == write_data); return value
        def push(self):
            require(write_file.read_bytes() == write_data); cli('push', write_file.parent.parent)
            require(write_file.read_bytes() == write_data)
        def claim(self, value): permanent_claim(value)

    io = ActualIO()
    if action == 'apply': report = apply_once(io)
    elif action == 'readback': report = readback_only(io)
    else:
        before = io.read(); patch = validate_diff(io.difference(), before); io.verify()
        report = base_report(); report.update(result='passed', planned_single_auth_patch=patch,
            ready_for_single_declared_update=bool(patch), provider_configuration_observed=equal(before['selected'], DESIRED),
            baseline_pruned_fields=[key for key, value in before['selected'].items() if value is None])
    final_source_check(io, report)
    report.update(action=action, evidence_kind='actual_provider_observation', source_and_core_pins=initial,
                  observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(), logical_reads=count,
                  config_pull_requests=count * 3, prepared_directory=directory.relative_to(ROOT).as_posix())
    output = ROOT / 'tracking/evidence/m07/controlled-pilot' / (run + '-hosted-provider-final31-' + action + '.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as file: json.dump(report, file, indent=2); file.write('\n')
    print(json.dumps({'result': report['result'], 'receipt': output.relative_to(ROOT).as_posix(),
        'dispatch_attempted': report['dispatch_attempted'], 'application_verified_by_readback': report['application_verified_by_readback']}))
    return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    try: sys.exit(main())
    except CommandProcessUnconfirmed:
        print(json.dumps({'result': 'unconfirmed', 'automatic_push_retry': False, 'process_cleanup_unconfirmed': True,
                          'instruction': 'Retain any claim. Pause provider/ACL actions until root reconciles owned CLI processes.'}))
        sys.exit(1)
    except Exception:
        print(json.dumps({'result': 'unconfirmed', 'automatic_push_retry': False,
                          'instruction': 'Retain any claim. Observe only; never blindly repeat push.'}))
        sys.exit(1)
