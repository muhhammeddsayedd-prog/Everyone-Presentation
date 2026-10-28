"""Record actual local checks, keeping service evidence and unavailable DB acceptance distinct."""
from pathlib import Path
import datetime
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'tracking/evidence/local-checks'
CHECKS = [
    ('typecheck', ['npm.cmd', 'run', 'typecheck'], 'static TypeScript'),
    ('lint', ['npm.cmd', 'run', 'lint'], 'static application lint, zero warnings'),
    ('tests', ['npm.cmd', 'test'], 'synthetic domain/job/adapter tests and actual synthetic binary parsing'),
    ('database', ['npm.cmd', 'run', 'test:db'], 'actual owned local PostgreSQL replay, role/RLS and two-session concurrency'),
    ('browser', ['npm.cmd', 'run', 'test:e2e'], 'actual local browser and HTTP against synthetic persistent adapter'),
    ('build', ['npm.cmd', 'run', 'build'], 'compilation only, not production serving'),
    ('production-guard', ['npm.cmd', 'run', 'check:production-guard'], 'fixture denial regression'),
    ('pack', [str(ROOT / '.venv-skills/Scripts/python.exe'), '-X', 'utf8', 'tools/validate_pack.py', '--strict'], 'static specification consistency'),
    ('skills', [str(ROOT / '.venv-skills/Scripts/python.exe'), '-X', 'utf8', 'tools/manage_project_skills.py'], 'static project skill integrity'),
]

def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    results = []
    for name, command, scope in CHECKS:
        started = datetime.datetime.now(datetime.timezone.utc).isoformat()
        try:
            process = subprocess.run(command, cwd=ROOT, capture_output=True, text=True,
                encoding='utf-8', errors='replace', timeout=180)
            exit_code, output = process.returncode, process.stdout + process.stderr
        except subprocess.TimeoutExpired:
            exit_code, output = 124, 'Check exceeded 180 seconds; result is unverified.\n'
        # These checks use synthetic inputs and never inspect CLI credentials or remote rows.
        (OUTPUT / f'{name}.txt').write_text(output, encoding='utf-8')
        result = {'check':name, 'command':' '.join(command), 'scope':scope, 'started_at':started,
            'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(), 'exit_code':exit_code,
            'status':'PASS' if exit_code == 0 else 'FAIL', 'output':f'{name}.txt'}
        results.append(result)
        (OUTPUT / 'summary.json').write_text(json.dumps({'environment':'local Windows / Node 24; cloud writes and provider execution excluded',
            'checks':results}, indent=2)+'\n', encoding='utf-8')
        print(f'{name}: {result["status"]}', flush=True)
        if exit_code:
            print(f'Inspect {OUTPUT / (name + ".txt")}', flush=True)
            return exit_code
    return 0

if __name__ == '__main__':
    sys.exit(main())
