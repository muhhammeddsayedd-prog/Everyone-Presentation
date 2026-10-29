"""Sealed offline roots for the immutable16->17 release/activation tests.

The retained17 manifest and every source/evidence byte must satisfy the original
production seals. These sources were also compared with Git blob
a8b607e05a197821234a1152f6b827bd09c33ff0 when this fixture was authored; Git is
not needed at test runtime, including in the source ZIP. No credentials or live
state are copied. Target/config below are synthetic guard inputs, never a CLI.
"""
from contextlib import contextmanager
import hashlib
import json
from pathlib import Path
import tempfile

SOURCE_ROOT = Path(__file__).resolve().parents[2]
MANIFEST = 'development/local-db/reviewed.json'
BASELINE17 = 'tracking/evidence/m03/remaining-preparation/baseline17-reviewed-manifest.json'
BASELINE17_SHA = 'f4ae3d8ba1169ae9f89ee16c1d8b922edaf6a5bea2e8ad56c5a5194ef8aadfdb'
MANIFEST19 = 'tests/fixtures/operations/candidate-pipeline/manifest19.source.txt'
MANIFEST19_SHA = 'f504c4745bfb1ac31c7ba30d42153fe965dcc9e3451821808b3b4050122985b2'
RUNTIME16 = 'tracking/evidence/cloud-pdf-vision/2026-10-29T09-54-06-914141Z-9a0506a9-apply.json'
RUNTIME16_SHA = '44eadafe84c65426cc3d5e884f8477a70e8591af66098e3cbb8fc8ea56de86e6'
REFRESH17 = 'tracking/evidence/cloud-candidate-pipeline-reconciliation/2026-10-29T10-44-49-279742Z-11aa0653.json'
REFRESH17_SHA = '6c48c0e1ed74d48336d2ce51de620dd3ea1e9842ca00974fdac2c62df16a19f7'


def sealed_bytes(relative, expected):
    path = Path(relative)
    if path.is_absolute() or '..' in path.parts:
        raise AssertionError('Historical fixture path must stay in the repository.')
    data = (SOURCE_ROOT / path).read_bytes()
    if hashlib.sha256(data).hexdigest() != expected:
        raise AssertionError('Historical fixture source seal changed: ' + relative)
    return data


def put(root, relative, data):
    destination = root / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)


@contextmanager
def historical17_root(release, extra_seals=None):
    """Copy real sealed evidence; execute the unchanged guards on that root."""
    if release.FILES[MANIFEST] != BASELINE17_SHA:
        raise AssertionError('The original fixed17 manifest guard must remain exact.')
    with tempfile.TemporaryDirectory(prefix='eps-historical-candidate17-') as directory:
        root = Path(directory)
        for relative, expected in {**release.FILES, **(extra_seals or {})}.items():
            source = BASELINE17 if relative == MANIFEST else relative
            put(root, relative, sealed_bytes(source, expected))
        manifest = json.loads((root / MANIFEST).read_bytes())
        if len(manifest['migrations']) != 17:
            raise AssertionError('Historical positive fixture must have exactly17 migrations.')
        for row in manifest['migrations']:
            put(root, row['path'], sealed_bytes(row['path'], row['sha256']))
        proof = json.loads((root / release.PROOF).read_bytes())
        for relative, expected in proof['source_seals'].items():
            put(root, relative, sealed_bytes(relative, expected))
        put(root, 'supabase/.temp/project-ref', (release.TARGET + '\n').encode())
        put(root, 'supabase/config.toml', b'[db.migrations]\nenabled=true\n[db.seed]\nenabled=false\n')
        yield root


def install_current19_fixture(root):
    """Frozen19 is a denial input; never rebase the fixed17 positive guard."""
    data = sealed_bytes(MANIFEST19, MANIFEST19_SHA)
    manifest = json.loads(data)
    if len(manifest['migrations']) != 19:
        raise AssertionError('The current-history denial fixture must have exactly19 migrations.')
    put(root, MANIFEST, data)
    for row in manifest['migrations']:
        put(root, row['path'], sealed_bytes(row['path'], row['sha256']))
