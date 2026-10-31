"""Fixed callback-only operator; importing is inert and root owns execution.

Only additional_redirect_urls is declared. Other returned comparator values are
compared in memory, never persisted or hashed. Unknown push outcomes only read
back; the permanent exclusive claim never permits an automatic second push.
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
import uuid

ROOT = Path(__file__).resolve().parents[3]
TARGET = 'pyibofyctwnqpvktepse'
HOST = 'https://everyone-presentation-pilot.vercel.app'
CALLBACK = HOST + '/api/auth/callback'
OLD = ['http://127.0.0.1:3000/api/auth/callback']
DESIRED = OLD + [CALLBACK]
REDIRECT_PATH = ('auth', 'additional_redirect_urls')
REMOTE_ONLY = {('auth', 'email', 'enable_confirmations'), ('auth', 'email', 'max_frequency'),
               ('auth', 'email', 'otp_length'), ('auth', 'mfa', 'totp', 'enroll_enabled'),
               ('auth', 'mfa', 'totp', 'verify_enabled'), ('db', 'pooler', 'default_pool_size'),
               ('db', 'pooler', 'max_client_conn'), ('storage', 'analytics', 'enabled'),
               ('storage', 'analytics', 'max_namespaces'), ('storage', 'image_transformation', 'enabled')}
PIN_LINK = 'f706303084a6135ca452a75e7c40e4746086e8cadc156c66e4e42af80b4c0ee5'
PIN_REPO = '0a50cd9902ed3a31b57cde31171f725310ed8d0d3efbd7226f894d48272dfbb2'
PRIVATE = ROOT / '.local/m07-pilot/auth-redirects'
CLAIM = PRIVATE / 'apply.claim.json'


def require(value):
    if not value:
        raise ValueError('AUTH_REDIRECT_OPERATION_UNCONFIRMED')


def digest(value):
    return hashlib.sha256(value).hexdigest()


def validate_source_pins(value):
    require(type(value) is dict and set(value) == {'project_ref_sha256', 'repository_config_sha256', 'harness_sha256'})
    require(value['project_ref_sha256'] == PIN_LINK and value['repository_config_sha256'] == PIN_REPO)
    require(type(value['harness_sha256']) is str and re.fullmatch('[a-f0-9]{64}', value['harness_sha256']))


def public_source_pins():
    # Public source/link metadata only, never fetched provider configuration.
    selected = {'project_ref_sha256': ROOT / 'supabase/.temp/project-ref',
                'repository_config_sha256': ROOT / 'supabase/config.toml', 'harness_sha256': Path(__file__).resolve()}
    result = {}
    for key, file in selected.items():
        require(file.is_file() and not file.is_symlink() and file.resolve() == file and file.stat().st_size <= 256 * 1024)
        result[key] = digest(file.read_bytes())
    validate_source_pins(result)
    return result


def command_args(action, directory):
    require(action in ('pull', 'diff', 'push'))
    args = ['npx.cmd', '--yes', 'supabase@2.122.0', 'config', action, '--project-ref', TARGET,
            '--workdir', str(directory), '--output-format', 'json']
    if action == 'pull':
        args.append('--dry-run')
    if action == 'push':
        args.append('--yes')
    return args


def cli(action, directory):
    result = subprocess.run(command_args(action, directory), cwd=ROOT, capture_output=True, text=True,
                            encoding='utf-8', errors='replace', timeout=60, stdin=subprocess.DEVNULL)
    require(result.returncode == 0)
    if action == 'push':
        return None  # Command success is not acceptance; independently pull.
    require(len(result.stdout.encode('utf-8')) <= 4 * 1024 * 1024)
    try:
        return json.loads(result.stdout)
    except (TypeError, ValueError):
        raise ValueError('AUTH_REDIRECT_OPERATION_UNCONFIRMED') from None


def paths(value):
    require(type(value) is list and 0 < len(value) <= 2000)
    selected = {}
    for row in value:
        require(type(row) is dict and type(row.get('path')) is list and 0 < len(row['path']) <= 8)
        require(all(type(part) is str and re.fullmatch('[a-zA-Z0-9_]{1,100}', part) for part in row['path']))
        key = tuple(row['path'])
        require(key not in selected)
        selected[key] = row
    return selected


def parse_pull(value):
    require(type(value) is dict and value.get('dry_run') is True and value.get('wrote') is False)
    require(type(value.get('target')) is dict and value['target'].get('project_ref') == TARGET)
    rows = paths(value.get('changes'))
    require(REDIRECT_PATH in rows and all(row.get('written') is False and 'remote' in row for row in rows.values()))
    urls = rows[REDIRECT_PATH]['remote']
    require(urls == OLD or urls == DESIRED)
    # Missing paths are comparator state, not explicitly read defaults. SiteURL
    # may be absent. A newly appearing/removed path fails before/after equality.
    return {'redirects': list(urls), 'other_remote': copy.deepcopy({key: row['remote'] for key, row in rows.items() if key != REDIRECT_PATH})}


def validate_redirect_diff(value):
    require(type(value) is dict and type(value.get('target')) is dict and value['target'].get('project_ref') == TARGET)
    rows = paths(value.get('changes'))
    require(set(rows) == REMOTE_ONLY | {REDIRECT_PATH})
    update = rows[REDIRECT_PATH]
    require(update.get('class') == 'update' and update.get('declared') is True
            and update.get('local') == DESIRED and update.get('remote') == OLD)
    require(all(rows[key].get('class') == 'remote_only' and rows[key].get('declared') is False for key in REMOTE_ONLY))
    return [{'path': list(key), 'class': rows[key]['class'], 'declared': rows[key]['declared'],
             'local_type': type(rows[key].get('local')).__name__, 'remote_type': type(rows[key].get('remote')).__name__}
            for key in sorted(rows)]


def base_report():
    return {'target': TARGET, 'current_redirects': [], 'desired_redirects': list(DESIRED), 'result': 'unconfirmed',
            'dispatch_attempted': False, 'automatic_push_retry': False, 'application_verified_by_readback': False,
            'nonredirect_before_after_equal': False, 'independent_readback_equal': False,
            'original_nonredirect_baseline_available': False, 'repeat_apply_prevented': False, 'push_outcome': 'not_attempted',
            'raw_config_diagnostics_or_secret_digests_persisted': False, 'site_url_declared_or_modified': False,
            'scope': 'One callback update only. Other returned comparator values stay in memory; missing SiteURL is not an explicit read. Masked values are not plaintext-secret proof.'}


def readback_only(pull, verify_sources, repeat_prevented=False):
    report = base_report()
    report['repeat_apply_prevented'] = repeat_prevented
    before = verify_sources()
    validate_source_pins(before)
    try:
        first, second = parse_pull(pull()), parse_pull(pull())
        report['current_redirects'] = second['redirects']
        report['independent_readback_equal'] = first == second
        require(verify_sources() == before)
        if first['redirects'] == second['redirects'] == DESIRED and first == second:
            report.update(result='passed', application_verified_by_readback=True)
    except Exception:
        pass  # No provider diagnostics or automatic mutation.
    report['source_pins'] = before
    return report


def apply_once(pull, difference, push, acquire_claim, verify_sources):
    report = base_report()
    baseline_pins = verify_sources()
    validate_source_pins(baseline_pins)
    before = parse_pull(pull())
    if before['redirects'] == DESIRED:
        return readback_only(pull, verify_sources, repeat_prevented=True)
    metadata = validate_redirect_diff(difference())
    require(verify_sources() == baseline_pins)
    claim = {'schema_version': '1.0', 'target': TARGET, 'desired_redirects': list(DESIRED),
             'source_pins': baseline_pins, 'dispatch_may_have_occurred': True}
    try:
        acquire_claim(claim)
    except FileExistsError:
        return readback_only(pull, verify_sources, repeat_prevented=True)
    require(verify_sources() == baseline_pins)
    report.update(source_pins=baseline_pins, diff_metadata=metadata, dispatch_attempted=True,
                  original_nonredirect_baseline_available=True, push_outcome='unknown')
    try:
        push()
        report['push_outcome'] = 'command_succeeded'
    except Exception:
        pass  # An error/timeout can follow commit; never repeat push.
    try:
        after, independent = parse_pull(pull()), parse_pull(pull())
        report['current_redirects'] = independent['redirects']
        report['nonredirect_before_after_equal'] = before['other_remote'] == after['other_remote'] == independent['other_remote']
        report['independent_readback_equal'] = after == independent
        require(verify_sources() == baseline_pins)
        if after['redirects'] == independent['redirects'] == DESIRED and report['nonredirect_before_after_equal'] and after == independent:
            report.update(result='passed', application_verified_by_readback=True)
    except Exception:
        pass
    return report


def config(directory, urls):
    require(urls in ([], OLD, DESIRED))
    (directory / 'supabase').mkdir(parents=True, exist_ok=False)
    file = directory / 'supabase/config.toml'
    body = ('project_id = "eps-pilot-auth-redirect"\n[auth]\nadditional_redirect_urls = ' + json.dumps(urls) + '\n').encode()
    file.write_bytes(body)
    require(directory.resolve() == directory and not file.is_symlink() and file.read_bytes() == body)
    return file, body


def permanent_claim(value):
    PRIVATE.mkdir(parents=True, exist_ok=True)
    require(PRIVATE.resolve() == PRIVATE)
    try:
        descriptor = os.open(CLAIM, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        require(CLAIM.is_file() and not CLAIM.is_symlink() and CLAIM.stat().st_size <= 8192)
        existing = json.loads(CLAIM.read_bytes())
        require(type(existing) is dict and set(existing) == set(value) and existing.get('schema_version') == '1.0'
                and existing.get('target') == TARGET and existing.get('desired_redirects') == DESIRED
                and existing.get('dispatch_may_have_occurred') is True)
        validate_source_pins(existing['source_pins'])
        raise
    with os.fdopen(descriptor, 'w', encoding='utf-8') as file:
        json.dump(value, file, indent=2)
        file.write('\n')
        file.flush()
        os.fsync(file.fileno())


def main():
    require(len(sys.argv) == 2 and sys.argv[1] in ('inspect', 'apply', 'readback'))
    action = sys.argv[1]
    baseline = public_source_pins()
    run = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8]
    directory = PRIVATE / run
    directory.mkdir(parents=True, exist_ok=False)
    require(directory.resolve() == directory)
    count = 0

    def fresh_pull():
        nonlocal count
        count += 1
        selected = directory / ('read-' + str(count))
        file, body = config(selected, [])
        value = cli('pull', selected)
        require(file.read_bytes() == body)
        return value

    prepared = directory / 'write'
    prepared_file, prepared_body = config(prepared, DESIRED)

    def prepared_cli(operation):
        require(prepared_file.read_bytes() == prepared_body)
        value = cli(operation, prepared)
        require(prepared_file.read_bytes() == prepared_body)
        return value

    if action == 'apply':
        report = apply_once(fresh_pull, lambda: prepared_cli('diff'), lambda: prepared_cli('push'), permanent_claim, public_source_pins)
    elif action == 'readback':
        report = readback_only(fresh_pull, public_source_pins)
    else:
        current = parse_pull(fresh_pull())
        metadata = validate_redirect_diff(prepared_cli('diff')) if current['redirects'] == OLD else []
        require(public_source_pins() == baseline)
        report = base_report()
        report.update(result='passed', current_redirects=current['redirects'], source_pins=baseline, diff_metadata=metadata,
                      ready_for_single_declared_update=current['redirects'] == OLD)
    require(public_source_pins() == baseline)
    report.update(action=action, observed_at=datetime.datetime.now(datetime.timezone.utc).isoformat(),
                  repository_link_and_config_preserved=True, prepared_directory=directory.relative_to(ROOT).as_posix(), fresh_readbacks=count)
    output = ROOT / 'tracking/evidence/m07/controlled-pilot' / (run + '-auth-redirect-' + action + '.json')
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x', encoding='utf-8') as file:
        json.dump(report, file, indent=2)
        file.write('\n')
    print(json.dumps({'result': report['result'], 'receipt': output.relative_to(ROOT).as_posix(),
                      'dispatch_attempted': report['dispatch_attempted'], 'application_verified_by_readback': report['application_verified_by_readback']}))
    return 0 if report['result'] == 'passed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print(json.dumps({'result': 'unconfirmed', 'automatic_push_retry': False,
                          'instruction': 'Read back only if a permanent apply claim exists; never blindly repeat push.',
                          'raw_config_diagnostics_or_secret_digests_persisted': False}))
        sys.exit(1)
