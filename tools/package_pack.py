#!/usr/bin/env python3
"""Package Git-eligible source only; retain the supplied pack manifest unchanged."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PRIVATE_PARTS = {'.git', '.local', '.temp', '.branches', '.venv-skills', 'node_modules',
                 '.next', '.next-e2e', 'dist', '__pycache__', 'test-results', 'playwright-report'}


def source_files():
    result = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
                            cwd=ROOT, capture_output=True, check=True)
    selected = []
    for relative in sorted(set(result.stdout.decode('utf-8').split('\0')) - {''}):
        path = ROOT / relative
        parts = Path(relative).parts
        private_parts = PRIVATE_PARTS.intersection(parts)
        # Only committed acceptance PNG/JSON/text may retain its historical path.
        if parts[:2] == ('tracking', 'evidence') and path.suffix.lower() in {'.png', '.json', '.md', '.txt'}:
            private_parts.discard('test-results')
        if private_parts or (
                path.name.startswith('.env') and path.name != '.env.example') or (
                path.name.endswith(('.pem', '.key')) or path.name == 'trace.zip'):
            raise ValueError(f'Private or generated path is Git-eligible: {relative}')
        resolved = path.resolve(strict=True)
        if path.is_symlink() or not resolved.is_relative_to(ROOT) or not resolved.is_file():
            raise ValueError(f'Unsupported source path: {relative}')
        selected.append((relative, resolved))
    if not selected:
        raise ValueError('No Git-eligible source files found.')
    return selected


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Inspect eligible paths without creating artifacts.')
    args = parser.parse_args()
    selected = source_files()
    inventory = {'project': 'Everyone Presentation Studio', 'kind': 'current development source',
                 'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                 'status': 'Consult PROGRESS.md and tracking/HANDOFF.md; this archive is not production acceptance.',
                 'supplied_manifest': 'MANIFEST.json is retained as the historical supplied-pack inventory.',
                 'files': [{'path': relative, 'bytes': path.stat().st_size,
                            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for relative, path in selected]}
    if args.check:
        print(json.dumps({'result': 'PASS', 'eligible_files': len(selected),
                          'private_runtime_paths': 'excluded by Git rules and explicit path guard',
                          'artifact_written': False}))
        return
    output = ROOT / 'dist'
    output.mkdir(exist_ok=True)
    if output.is_symlink() or output.resolve() != ROOT / 'dist':
        raise ValueError('Source artifact destination must be the workspace-owned dist directory.')
    archive = output / 'Everyone-Presentation-Studio-Source.zip'
    if archive.is_symlink() or archive.resolve().parent != output.resolve():
        raise ValueError('Source archive must remain inside the workspace artifact directory.')
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zipped:
        for relative, path in selected:
            zipped.write(path, f'{ROOT.name}/{relative}')
        zipped.writestr(f'{ROOT.name}/SOURCE_MANIFEST.json', json.dumps(inventory, indent=2) + '\n')
    with zipfile.ZipFile(archive) as zipped:
        if zipped.testzip():
            raise ValueError('Source archive integrity check failed.')
    print(json.dumps({'archive': str(archive), 'files': len(selected) + 1,
                      'archive_bytes': archive.stat().st_size,
                      'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                      'supplied_manifest_modified': False}))


if __name__ == '__main__':
    main()
