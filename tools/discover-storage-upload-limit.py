"""Read the existing linked project's global upload limit without changing config.

The CLI's dry-run compares against an isolated deliberately distinct local limit.
Only the allowlisted Storage limit is retained; no tokens, raw config or errors.
"""
from pathlib import Path
import datetime
import hashlib
import json
import re
import subprocess
import sys
import uuid

ROOT = Path(__file__).resolve().parents[1]
TARGET = 'pyibofyctwnqpvktepse'


def require(value):
    if not value:
        raise ValueError('STORAGE_UPLOAD_LIMIT_UNCONFIRMED')


def sha(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def bytes_value(value):
    if isinstance(value, int) and not isinstance(value, bool):
        return value if value > 0 else None
    match = re.fullmatch(r'([1-9][0-9]*)(B|KB|KiB|MB|MiB|GB|GiB)?', value or '')
    if not match:
        return None
    return int(match[1]) * {'B': 1, 'KB': 1000, 'KiB': 1024,
        'MB': 1000000, 'MiB': 1048576, 'GB': 1000000000, 'GiB': 1073741824}.get(match[2], 1)


def main():
    require(len(sys.argv) == 1)
    linked = ROOT / 'supabase/.temp/project-ref'
    config = ROOT / 'supabase/config.toml'
    require(linked.read_text().strip() == TARGET)
    before = {'project_ref_sha256': sha(linked), 'config_sha256': sha(config)}
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ')
    run_id = stamp + '-' + uuid.uuid4().hex[:8]
    isolated = ROOT / '.local/storage-limit-discovery' / run_id
    (isolated / 'supabase').mkdir(parents=True, exist_ok=False)
    (isolated / 'supabase/config.toml').write_text(
        'project_id = "storage-limit-readonly-probe"\n[storage]\nfile_size_limit = "1B"\n', encoding='utf-8')
    arguments = ['npx.cmd', '--yes', 'supabase@2.122.0', 'config', 'pull', '--dry-run',
        '--project-ref', TARGET, '--output-format', 'json', '--workdir', str(isolated)]
    result = subprocess.run(arguments, cwd=ROOT, capture_output=True, text=True,
        encoding='utf-8', errors='replace', timeout=90)
    require(result.returncode == 0)
    data = json.loads(result.stdout)
    require(data['dry_run'] is True and data['wrote'] is False and data['target']['project_ref'] == TARGET)
    limits = [row for row in data['changes'] if row['path'] == ['storage', 'file_size_limit']]
    require(len(limits) == 1 and limits[0]['written'] is False)
    configured = limits[0]['remote']
    maximum = bytes_value(configured)
    require(maximum is not None)
    after = {'project_ref_sha256': sha(linked), 'config_sha256': sha(config)}
    require(before == after)
    receipt = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'target': TARGET, 'action': 'read-only existing-credential config pull --dry-run',
        'command': 'npx.cmd --yes supabase@2.122.0 config pull --dry-run --project-ref '
            + TARGET + ' --output-format json --workdir <isolated ignored task directory>',
        'cli_exit_code': result.returncode, 'setting': 'storage.file_size_limit',
        'configured': configured, 'maximum_bytes': maximum,
        'app_native_candidate_maximum_bytes': 268435456,
        'global_limit_permits_app_maximum': maximum >= 268435456,
        'plan': 'unknown; not inferred from limit', 'project_and_repo_config_unchanged': before == after,
        'project_or_repo_config_written': False, 'credentials_created_or_extracted': False,
        'raw_config_or_diagnostics_retained': False, 'source_sha256': sha(Path(__file__)),
        'request_scope': 'metadata only; no upload, bucket mutation, plan or billing action',
        'sources': ['https://supabase.com/docs/guides/storage/uploads/file-limits',
            'https://supabase.com/docs/reference/api/v1-get-storage-config'],
        'local_comparison_only': '1B is a private local comparator, never a project configuration change'}
    directory = ROOT / 'tracking/evidence/m03/storage-limit-discovery'
    directory.mkdir(parents=True, exist_ok=True)
    out = directory / (run_id + '.json')
    out.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'status': 'PASS', 'receipt': str(out.relative_to(ROOT)),
        'global_maximum_bytes': maximum, 'permits_app_maximum': receipt['global_limit_permits_app_maximum'],
        'configuration_changed': False}))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, KeyError, TypeError, OSError, subprocess.TimeoutExpired):
        print(json.dumps({'status': 'BLOCKED', 'reason': 'STORAGE_UPLOAD_LIMIT_UNCONFIRMED',
            'raw_config_and_diagnostics_suppressed': True, 'configuration_changed': False}))
        sys.exit(1)
