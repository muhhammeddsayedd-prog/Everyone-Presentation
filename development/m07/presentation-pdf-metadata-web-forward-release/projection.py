"""Fresh PDF-metadata web compiler over the frozen, unsubmitted38 purpose."""
from pathlib import Path
import ast
import copy
import datetime
import hashlib
import importlib.util
import json
import re
import types

MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
HERE = Path(__file__).resolve().parent
PARENT = MAIN / 'development/m07/final-canonical42-web-forward-release'
PARENT_PINS = {
    'gates.py': 'b94223177e9f4a4dae7e3adce3e20681488eb993f424538672f8da427d2b696f',
    'inputs.template.json': '072a650e5770772bf4849a5830ad685b92e2c96949edb31f7bb09e10dbc92001',
    'preflight.py': '57cf3f754f95e0d5233ef71c71da6efddb306f1a88d7b4ad1d5fca17c484e414',
    'projection.py': '7a18dfdf61c244e3e181d01260c205c061ee1a056237e605a3f68f59b3ef4b04',
    'README.md': '452767457617e4d69884e31c4c6c60a293cb1074e97eae1a6a61579f235dd6db',
    'release.py': '4afe7c1a6375eb7fe9e8132213c21fe3cd8b2a6ed54c48004b8e71918d7046cd',
    'scan-stage.mjs': 'cc2c224acf1e45fb8dbd596304269099d3e32f574b67e18463c90670111984e4',
    'stage.py': 'dc65bc00602d5622e33671a9738b6d312e8298688fecf1468a3f1e8c3e37242d',
    'test_release.py': 'c6e109d2cbfb06805905ececb5c5fde14b308d85e9f7b07dc7b7dc66f6a8c0cd',
}
PRIOR_FAILURE = {'path': 'tracking/evidence/m07/final-canonical42-web-forward-release/Root-38c4-preclaim-path-failure.json', 'sha256': '6c07f56b75b45b271a53354725850acff63f0573c5f07d04a8f3883186b797df'}
NAMESPACE = 'presentation-pdf-metadata-web-forward-release'
TESTED = '514447f5e82d97b18cf45807eebe77287e17044a'
QUALITY = {'path': 'tracking/evidence/m07/completion-release/2026-11-03T14-14-04.950Z-235ee1b3-pdf-metadata-root-quality.json', 'sha256': '93a99f2ec4eb0ea065aaf207d58b68c806e47ae860fc993a02b99cf5a105b6c0'}
MIN_TESTS = 1030
REASON_FILES = {'packages/central/src/studio.ts'}


def need(ok):
    if not ok:
        raise ValueError('PDF_METADATA_WEB_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def load(file):
    stat = file.lstat()
    need(file.is_file() and not file.is_symlink() and file.resolve() == file and stat.st_nlink == 1 and 0 < stat.st_size <= 16 * 1024**2)
    return file.read_bytes()


def frozen():
    for name, digest in PARENT_PINS.items():
        need(sha(load(PARENT / name)) == digest)
    need(sha(load(MAIN / PRIOR_FAILURE['path'])) == PRIOR_FAILURE['sha256'])


frozen()
_spec = importlib.util.spec_from_file_location('pdf_metadata_frozen_final_web_compiler', PARENT / 'projection.py')
previous = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(previous)
for _name in ('PINS', 'FROZEN', 'OLD', 'APPROVED_PREDECESSOR', 'APPROVED', 'NATIVE', 'WORKER', 'CONTEXT', 'CONTEXT_SHA', 'CANONICAL42', 'BASELINE', 'BASE_DEPLOYMENT', 'BASE_COMMIT', 'BASE_MANIFEST', 'worker_anchor', 'worker_projection', 'stable_scope'):
    globals()[_name] = copy.deepcopy(getattr(previous, _name)) if _name in ('WORKER', 'CANONICAL42') else getattr(previous, _name)


def bind(function):
    # Only this fresh module's globals are used; no old module is patched.
    return types.FunctionType(function.__code__, globals(), function.__name__, function.__defaults__, function.__closure__)


_parent_ready = bind(previous.ready)


def ready():
    _parent_ready()
    need(type(REASON_FILES) is set and len(REASON_FILES) > 0 and all(type(name) is str and not name.startswith('/') and '..' not in name.split('/') for name in REASON_FILES))
    return True


context = bind(previous.context)
canonical = bind(previous.canonical)
snapshot_projection = bind(previous.snapshot_projection)
_raw = load(PARENT / 'projection.py').decode('utf8')
_tree = ast.parse(_raw)
_function = next(node for node in _tree.body if isinstance(node, ast.FunctionDef) and node.name == 'preflight_gate')
_before = ast.get_source_segment(_raw, _function)
_old_purpose = 'final_canonical42_web_forward_canonical_preflight'
_new_purpose = 'presentation_pdf_metadata_web_forward_canonical_preflight'
need(_before.count(_old_purpose) == 1)
_after = _before.replace(_old_purpose, _new_purpose)
need(_after.replace(_new_purpose, _old_purpose) == _before)
exec(compile(_after, 'pdf-metadata-exact-preflight-purpose', 'exec'), globals())


def project(name):
    frozen()
    before = load(PARENT / name).decode('utf8') if name == 'preflight.py' else previous.project(name)
    source, edits = before, []
    def edit(old, new, count=1):
        nonlocal source
        need(old != new and source.count(old) == count and new not in source)
        source = source.replace(old, new)
        edits.append((old, new, count))
    def assignment(key, value):
        old = re.search('^' + key + r'=.*$', source, re.M)
        need(old is not None)
        edit(old[0], key + '=' + repr(value))
    for old, new in [('final-canonical42-web-forward-release', NAMESPACE), ('FINAL_CANONICAL42_WEB_FORWARD', 'PRESENTATION_PDF_METADATA_WEB_FORWARD'), ('FINAL_CANONICAL42_WEB', 'PRESENTATION_PDF_METADATA_WEB'), ('final_canonical42_web_forward', 'presentation_pdf_metadata_web_forward')]:
        if old in source:
            edit(old, new, source.count(old))
    if name == 'gates.py':
        for key, value in [('TESTED_COMMIT', TESTED), ('QUALITY_RECEIPT', QUALITY), ('REASON_FILES', REASON_FILES)]:
            assignment(key, value)
    if name == 'release.py':
        marker = '  return dict(sorted(pins.items()))'
        edit(marker, "  for name,expected in _projection.PARENT_PINS.items():\n   file='development/m07/final-canonical42-web-forward-release/'+name;g.need(g.sha(g.load(self.root/file))==expected);pins[file]=expected\n  prior=_projection.PRIOR_FAILURE;g.need(g.sha(g.load(self.root/prior['path']))==prior['sha256']);pins[prior['path']]=prior['sha256']\n" + marker)
    if name == 'preflight.py':
        marker = 'def private_bytes(operator, file, raw):'
        helper = "def receipt_filename(observed, run):\n    return observed.replace('+00:00', 'Z').replace(':', '-') + '-' + run + '-canonical-preflight.json'\n\n\n"
        edit(marker, helper + marker)
        edit("file = folder / (observed.replace(':', '-') + '-' + run + '-canonical-preflight.json')", 'file = folder / receipt_filename(observed, run)')
    inverse = source
    for old, new, count in reversed(edits):
        need(inverse.count(new) == count)
        inverse = inverse.replace(new, old)
    need(inverse == before)
    return source


def projected_tests():
    before = load(PARENT / 'test_release.py').decode('utf8')
    tree = ast.parse(before)
    cls = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'Source')
    first = ast.get_source_segment(before, cls.body[0])
    replacement = '''def test_closed_or_missing_selected_source_refuse_before_operator_or_reader(self):
        self.assertIs(r.RELEASE_ENABLED, False)
        self.assertEqual(p.TESTED, '514447f5e82d97b18cf45807eebe77287e17044a')
        self.assertEqual(p.QUALITY['sha256'], '93a99f2ec4eb0ea065aaf207d58b68c806e47ae860fc993a02b99cf5a105b6c0')
        self.assertEqual(p.MIN_TESTS, 1030)
        self.assertEqual(p.REASON_FILES, {'packages/central/src/studio.ts'})
        with patch.object(r, 'legacy', side_effect=AssertionError('transport loaded')):
            with self.assertRaises(ValueError):
                r.Operator('00000000-0000-4000-8000-000000000000')
            with patch.object(r, 'RELEASE_ENABLED', True), patch.object(r._projection, 'TESTED', None):
                with self.assertRaises(ValueError):
                    r.Operator('00000000-0000-4000-8000-000000000000')
        with patch.object(f.r, 'Operator', side_effect=AssertionError('operator constructed')):
            with self.assertRaises(ValueError):
                f.main([])'''
    text = before.replace(first, replacement, 1)
    text = text.replace("self.assertIn('REASON_FILES=set()', gates)", "self.assertIn('REASON_FILES=' + repr(p.REASON_FILES), gates)")
    marker = "MIN_TESTS=1023, CANONICAL42="
    need(text.count(marker) == 1)
    text = text.replace(marker, "MIN_TESTS=1023, REASON_FILES={'packages/central/src/studio.ts'}, CANONICAL42=", 1)
    text = text.replace(_old_purpose, _new_purpose)
    return text.replace("if __name__ == '__main__':\n    unittest.main()", '')
