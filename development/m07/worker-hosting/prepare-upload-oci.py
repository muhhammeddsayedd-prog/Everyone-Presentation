"""Offline: copy the fixed Docker export's verified OCI closure, never legacy layers."""
from pathlib import Path
import hashlib
import json
import re
import tarfile

ROOT = Path(__file__).resolve().parents[3]
ARCHIVE = ROOT / '.local/m07-pilot/native-2e551bb2.tar'
OUTPUT = ROOT / '.local/m07-pilot/native-upload-oci-2e551bb2'
DIGEST = '5a41cf3c8801b2891d378b3f7caef44c3fb7af184ceb89e7f4e44c3d865ac697'


def main():
    assert ARCHIVE.is_file() and not ARCHIVE.is_symlink() and ARCHIVE.resolve() == ARCHIVE
    before = ARCHIVE.stat()
    assert before.st_size == 633582592 and not OUTPUT.exists() and OUTPUT.parent.resolve() == OUTPUT.parent
    with tarfile.open(ARCHIVE, 'r:') as archive:
        entries = archive.getmembers()
        assert len({entry.name for entry in entries}) == len(entries)
        for entry in entries:
            assert entry.isdir() and entry.name.rstrip('/') in ('blobs', 'blobs/sha256') or entry.isfile() and (
                entry.name in ('oci-layout', 'index.json', 'manifest.json') or re.fullmatch(r'blobs/sha256/[a-f0-9]{64}', entry.name))
            assert entry.size <= 500 * 1024**2
        assert json.load(archive.extractfile('oci-layout')) == {'imageLayoutVersion': '1.0.0'}
        index = json.load(archive.extractfile('index.json'))
        assert index['schemaVersion'] == 2 and len(index['manifests']) == 1
        assert index['manifests'][0]['digest'] == 'sha256:' + DIGEST
        OUTPUT.mkdir()
        (OUTPUT / 'blobs/sha256').mkdir(parents=True)
        copied = {}
        for entry in entries:
            if entry.name in ('oci-layout', 'index.json') or entry.name.startswith('blobs/sha256/') and entry.isfile():
                target = OUTPUT / entry.name
                assert target.resolve().is_relative_to(OUTPUT) and entry.isfile()
                digest = hashlib.sha256()
                with archive.extractfile(entry) as source, target.open('xb') as destination:
                    while chunk := source.read(1024 * 1024):
                        digest.update(chunk)
                        destination.write(chunk)
                if entry.name.startswith('blobs/'):
                    assert digest.hexdigest() == target.name
                    copied['sha256:' + target.name] = entry.size
        visited = set()

        def verify(descriptor):
            value = descriptor['digest']
            assert value in copied and copied[value] == descriptor['size']
            if value in visited:
                return
            visited.add(value)
            if descriptor['mediaType'] in ('application/vnd.oci.image.index.v1+json', 'application/vnd.oci.image.manifest.v1+json'):
                body = json.loads((OUTPUT / 'blobs/sha256' / value[7:]).read_bytes())
                for child in body.get('manifests', []) + body.get('layers', []) + ([body['config']] if 'config' in body else []):
                    verify(child)

        verify(index['manifests'][0])
        assert visited == set(copied)
    after = ARCHIVE.stat()
    assert (before.st_size, before.st_mtime_ns, before.st_ino) == (after.st_size, after.st_mtime_ns, after.st_ino)
    result = {'schema_version': '1.0', 'offline_only': True, 'index_digest': 'sha256:' + DIGEST,
              'blobs_verified': len(visited), 'compressed_blob_bytes': sum(copied.values()),
              'all_blob_sha256_and_descriptor_sizes_verified': True, 'legacy_manifest_used': False,
              'layers_recompressed': False, 'credentials_read': False, 'provider_contacted': False}
    (OUTPUT.parent / 'native-upload-oci-2e551bb2.proof.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
