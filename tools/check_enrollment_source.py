"""Compare known private setup values to eligible source and staged blob bytes.

No private value, digest, input or raw Git diagnostic is printed. This is a bounded
local checkpoint scan, not a general secret detector or provider acceptance.
"""
import base64
import datetime
import hashlib
import json
import subprocess
import sys
import zipfile

from package_pack import ROOT, source_files

INHERITED_REFERENCE = ('Design Elements/DESIGN.md', 'dde901c071b963b9bbf425d781e37125e6dbfbc902ee65a97f717a3c7f3e8ca1')


def classify(relative, content, secret_patterns, identity_patterns):
    if any(value in content for value in secret_patterns):
        return 'verifier'
    if any(value in content for value in identity_patterns):
        # The supplied, unchanged design reference already contained the owner's
        # business address before this setup. Preserve its exact original bytes;
        # this exception can NEVER exempt a key, changed file or another path.
        if (relative, hashlib.sha256(content).hexdigest()) == INHERITED_REFERENCE:
            return 'inherited_reference_contact'
        return 'new_identity_copy'
    return None


def git(*arguments, data=None):
    result = subprocess.run(['git', *arguments], cwd=ROOT, input=data, capture_output=True, timeout=60)
    if result.returncode:
        raise ValueError('Git checkpoint inspection failed; raw output suppressed.')
    return result.stdout


def main():
    if len(sys.argv) != 1:
        raise ValueError('No path, value or target overrides are accepted.')
    key_document = json.loads((ROOT / '.local/cloud-logo-provision/verifier.json').read_text(encoding='utf-8'))
    encoded = key_document['LOGO_VERIFICATION_KEY_BASE64URL']
    secret = base64.urlsafe_b64decode(encoded + '=')
    if len(secret) != 32:
        raise ValueError('Private key shape could not be verified.')
    email = json.loads((ROOT / '.local/m01-enrollment/request.json').read_text(encoding='utf-8'))['producer_email'].encode('utf-8')
    if len(email) < 5 or b'@' not in email:
        raise ValueError('Private enrollment identity shape could not be verified.')
    secret_patterns = [secret, encoded.encode('ascii'), secret.hex().encode('ascii'), base64.b64encode(secret)]
    identity_patterns = [email, email.hex().encode('ascii')]
    paths = source_files()
    working_matches = []; inherited_working = []
    for relative, path in paths:
        content = path.read_bytes()
        category = classify(relative, content, secret_patterns, identity_patterns)
        if category == 'inherited_reference_contact':
            inherited_working.append(relative)
        elif category:
            working_matches.append(relative)
    entries = []
    for entry in git('ls-files', '--stage', '-z').split(b'\0'):
        if not entry:
            continue
        header, name = entry.split(b'\t', 1)
        mode, blob, stage = header.split(b' ')
        if mode not in (b'100644', b'100755') or stage != b'0':
            raise ValueError('Unsupported staged entry; preserve and review the index.')
        entries.append((blob, name.decode('utf-8')))
    packed = git('cat-file', '--batch', data=b''.join(blob + b'\n' for blob, _ in entries))
    offset = 0; staged_matches = []; inherited_staged = []
    for expected, relative in entries:
        end = packed.find(b'\n', offset)
        if end < 0:
            raise ValueError('Staged blob response was incomplete.')
        blob, kind, size = packed[offset:end].split(b' ')
        size = int(size)
        if blob != expected or kind != b'blob' or size < 0 or size > 100_000_000:
            raise ValueError('Staged blob response was invalid.')
        content = packed[end + 1:end + 1 + size]
        if len(content) != size or packed[end + 1 + size:end + 2 + size] != b'\n':
            raise ValueError('Staged blob response length was invalid.')
        category = classify(relative, content, secret_patterns, identity_patterns)
        if category == 'inherited_reference_contact':
            inherited_staged.append(relative)
        elif category:
            staged_matches.append(relative)
        offset = end + size + 2
    if offset != len(packed):
        raise ValueError('Staged blob response had unexpected trailing content.')
    archive = ROOT / 'dist/Everyone-Presentation-Studio-Source.zip'
    archive_scan = None
    if archive.exists():
        if not archive.resolve().is_relative_to(ROOT.resolve()):
            raise ValueError('Source archive resolved outside this workspace.')
        matches = []; inherited = []
        with zipfile.ZipFile(archive) as bundle:
            archive_entries = [item for item in bundle.infolist() if not item.is_dir()]
            if len(archive_entries) > 10000 or sum(item.file_size for item in archive_entries) > 256_000_000:
                raise ValueError('Source archive exceeds the bounded checkpoint scan.')
            for item in archive_entries:
                prefix = ROOT.name + '/'
                if not item.filename.startswith(prefix) or any(part in ('', '.', '..') for part in item.filename[len(prefix):].split('/')):
                    raise ValueError('Source archive entry is outside its fixed package root.')
                category = classify(item.filename[len(prefix):], bundle.read(item), secret_patterns, identity_patterns)
                if category == 'inherited_reference_contact':
                    inherited.append(item.filename)
                elif category:
                    matches.append(item.filename)
        archive_scan = {'path': archive.relative_to(ROOT).as_posix(), 'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
                        'entries': len(archive_entries), 'matches': matches, 'preserved_original_reference_contact': inherited}
    receipt = {'observed_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'result': 'passed' if not working_matches and not staged_matches and not (archive_scan and archive_scan['matches']) else 'failed',
               'scope': 'known local private verifier in four encodings and owner email in two encodings; no provider calls',
               'eligible_source_files': len(paths), 'staged_blobs': len(entries), 'working_tree_matches': working_matches, 'staged_matches': staged_matches,
               'preserved_original_reference_contact': {'working_tree': inherited_working, 'staged': inherited_staged,
                  'reason': 'Exact unchanged supplied design document already contained the business contact; no new setup identity copy is allowed. Keys are never exempted.'},
               'source_archive': archive_scan,
               'private_values_or_digests_recorded': False, 'limitations': 'Does not prove absence of unknown secrets, private traces, provider correctness or production readiness.'}
    output = ROOT / 'tracking/evidence/m01/central-enrollment/source-private-scan.json'
    output.write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(receipt, indent=2))
    return 0 if receipt['result'] == 'passed' else 1


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print(json.dumps({'result': 'blocked', 'reason': 'Private-value checkpoint scan could not be confirmed; raw inputs and diagnostics suppressed.'}))
        sys.exit(1)
