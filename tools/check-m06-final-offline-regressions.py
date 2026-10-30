"""Capture M06 offline gates without changing historical M03 runner bytes.

The retained default-parallel run timed out in an unchanged 100 ms WF02 VM
sandbox. Run test files and groups sequentially to bound CPU contention; keep
every assertion, sandbox timeout, required file and nonzero-test requirement.
Only tests are executed. Live release, observation and activation CLIs are not.
"""
from pathlib import Path
import datetime
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
import uuid


ROOT = Path(__file__).resolve().parents[1]
PYTHON = ROOT / '.venv-skills/Scripts/python.exe'
BASE = ROOT / 'tools/check-final-offline-regressions.py'
BASE_SHA256 = '58d5e5b3f9ae57eb6c8f91755bccf2283ef4d873da28cdb6c43e62e14b487fe2'
RETAINED_FAILURE = 'tracking/evidence/m03/final-offline-checks/2026-10-30T01-12-38-382148Z-2008ae91.json'
N8N_FILES = (
    'build-guest-export-wf03.test.mjs',
    'm06-wf03-expression.test.mjs',
    'reconcile-m06-wf03-auto-publication.test.mjs',
    'repair-m06-wf03-expression.test.mjs',
    'update-guest-export-n8n.test.mjs',
)
INSPECTOR_FILES = (
    'tests/operations/m06-live-private-output.test.ts',
    'tests/operations/m06-live-artifact-intent.test.ts',
    'tests/worker/m06-live-geometry.test.ts',
    'tests/operations/m06-guest-storage-diagnostic.test.ts',
    'tests/operations/m06-pdf-playback-extraction.test.ts',
)


def sha(body):
    return hashlib.sha256(body).hexdigest()


def now():
    return datetime.datetime.now(datetime.timezone.utc)


def load_base():
    if sha(BASE.read_bytes()) != BASE_SHA256:
        raise ValueError('HISTORICAL_RUNNER_CHANGED')
    spec = importlib.util.spec_from_file_location('m03_offline_capture', BASE)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def sources(base, selected):
    result = base.sources(selected)
    extra = set((ROOT / 'tools').glob('*.mts'))
    extra.update((ROOT / 'n8n').rglob('*.json'))
    extra.update(file for file in (ROOT / 'packages/templates/versions').rglob('*') if file.is_file())
    extra.add(ROOT / 'tests/worker/presentation-native-fixture.ts')
    extra.add(ROOT / 'development/m06/workflow-source-history/3b43f65491d874a780c142bb93f02b3fef53ed9f30c225d154781e0d0b3fbb9f-live-matching-before-serialization-graph.json.txt')
    for file in sorted(extra):
        result[file.relative_to(ROOT).as_posix()] = sha(file.read_bytes())
    return dict(sorted(result.items()))


def run_group(name, kind, arguments, private):
    started = now()
    process = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True,
                             encoding='utf-8', errors='replace', timeout=240)
    output = {'stdout': process.stdout.encode('utf-8'), 'stderr': process.stderr.encode('utf-8')}
    for stream, body in output.items():
        (private / f'{name}.{stream}.txt').write_bytes(body)
    combined = process.stdout + '\n' + process.stderr
    if kind == 'node':
        counts = {}
        for field in ('tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'):
            matches = re.findall(r'(?m)^(?:#|\u2139)?\s*' + field + r' (\d+)\s*$', combined)
            if len(matches) != 1:
                raise ValueError('REQUIRED_TEST_SUMMARY_MISSING')
            counts[field] = int(matches[0])
        passed = (process.returncode == 0 and counts['tests'] > 0
                  and counts['pass'] == counts['tests']
                  and all(counts[field] == 0 for field in ('fail', 'cancelled', 'skipped', 'todo')))
    else:
        match = re.search(r'Ran (\d+) tests? in ', combined)
        total = int(match[1]) if match else None
        passed = (process.returncode == 0 and total is not None and total > 0
                  and re.search(r'(?m)^OK\s*$', combined) is not None)
        counts = {'tests': total, 'pass': total if passed else None}
    return {
        'name': name, 'arguments': arguments, 'started_at': started.isoformat(),
        'finished_at': now().isoformat(), 'exit_code': process.returncode,
        'result': 'passed' if passed else 'failed', 'counts': counts,
        'log_sha256': {stream: sha(body) for stream, body in output.items()},
        'raw_diagnostics': private.relative_to(ROOT).as_posix() + f'/{name}.{{stdout,stderr}}.txt',
    }


def main():
    if len(sys.argv) != 1 or Path(sys.executable).resolve() != PYTHON.resolve():
        raise ValueError('PINNED_PROJECT_PYTHON_REQUIRED')
    base = load_base()
    node, python = base.files()
    n8n = sorted((ROOT / 'tools').glob('*.test.mjs'))
    inspector = [ROOT / file for file in INSPECTOR_FILES]
    if tuple(file.name for file in n8n) != N8N_FILES or not all(file.is_file() for file in inspector):
        raise ValueError('REQUIRED_M06_OFFLINE_FILES_MISSING')
    selected = node + python + n8n + inspector
    before = sources(base, selected)
    run_id = now().strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + uuid.uuid4().hex[:8]
    private = ROOT / '.local/m06-final-offline-checks' / run_id
    private.mkdir(parents=True, exist_ok=False)
    relative = lambda files: [file.relative_to(ROOT).as_posix() for file in files]
    groups = [
        ('node-operations-and-tools', 'node', ['node', '--import', 'tsx', '--test', '--test-concurrency=1'] + relative(node)),
        ('python-operations', 'python', [str(PYTHON), '-X', 'utf8', '-m', 'unittest', 'discover', '-s', 'tests/operations', '-p', 'test_*.py']),
        ('n8n-five-top-level-suites', 'node', ['node', '--test', '--test-concurrency=1'] + relative(n8n)),
        ('typescript-operational-supplements', 'node', ['node', '--import', 'tsx', '--test', '--test-concurrency=1'] + relative(inspector)),
    ]
    results = []
    for name, kind, arguments in groups:
        row = run_group(name, kind, arguments, private)
        results.append(row)
        print(json.dumps({key: row[key] for key in ('name', 'result', 'counts')}), flush=True)
    after = sources(base, selected)
    stable = before == after
    passed = stable and all(row['result'] == 'passed' for row in results)
    failure_file = ROOT / RETAINED_FAILURE
    report = {
        'observed_at': now().isoformat(), 'result': 'passed' if passed else 'failed',
        'scope': 'Fresh sequential M06 offline regressions, injected fixtures and synthetic native PDF inspection; no live guest app or provider proof.',
        'groups': results, 'aggregate_tests': sum(row['counts']['tests'] or 0 for row in results),
        'selected_node_files': relative(node), 'selected_python_files': relative(python),
        'selected_n8n_files': relative(n8n), 'selected_typescript_supplement_files': relative(inspector),
        'sequential_groups': True, 'node_file_concurrency': 1,
        'sandbox_timeouts_or_assertions_changed': False, 'test_files_deliberately_omitted': [],
        'sources_stable': stable, 'source_sha256': before,
        'changed_source_paths': sorted(key for key in set(before) | set(after) if before.get(key) != after.get(key)),
        'preserved_historical_runner': {'path': BASE.relative_to(ROOT).as_posix(), 'sha256': BASE_SHA256},
        'retained_default_parallel_failure': {'receipt': RETAINED_FAILURE, 'sha256': sha(failure_file.read_bytes()),
            'reason': 'Original default Node file concurrency while Python also ran exceeded unchanged WF02 VM 100ms budget.'},
        'cloud_called': False, 'provider_called': False, 'cloud_cli_called': False,
        'private_runtime_credentials_loaded': False, 'runtime_config_changed': False,
        'synthetic_local_chromium_pdf_called': True, 'docker_or_ffmpeg_called': False,
        'hosting_deferred': True,
        'limits': [
            'This new runner explicitly changes scheduling; it is not a pass of the retained default-parallel runner.',
            'Current selected groups contain offline fake transports/SQL parsers and synthetic native PDF work; live HTTP, Storage, provider, cloud release, browser app, database and restore journeys are separate.',
            'Counts are distinct within this receipt; root module/browser totals may overlap and must not be added blindly.',
            'Source hashes include current code and selected workflow/template metadata fixtures, not every historical evidence artifact. Raw logs remain private.',
        ],
    }
    directory = ROOT / 'tracking/evidence/m06/offline'
    directory.mkdir(parents=True, exist_ok=True)
    file = directory / (run_id + '-final-sequential-gate.json')
    file.write_bytes((json.dumps(report, indent=2) + '\n').encode('utf-8'))
    print(json.dumps({'result': report['result'], 'receipt': file.relative_to(ROOT).as_posix(),
                      'sources_stable': stable, 'aggregate_tests': report['aggregate_tests']}), flush=True)
    return 0 if passed else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        sys.stderr.write('M06 offline capture stopped; diagnostics remain private.\n')
        sys.exit(1)
