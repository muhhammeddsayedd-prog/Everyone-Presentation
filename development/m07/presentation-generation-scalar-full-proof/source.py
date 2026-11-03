"""Finite seven-target successor to the frozen slide full proof; no dispatch."""
from pathlib import Path
import hashlib
import importlib.util

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LIBRARY = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD = LIBRARY / 'development/m07/presentation-generation-slide-batch-full-proof'
EXTENSION = HERE / 'extension.py'
NAMESPACE = HERE.name
PREVIOUS_NAMESPACE = OLD.name
EXTENSION_SHA = '32bd4cba5325bb240661f64b91707cfb2a984df78c121398841fe1866f03849d'
PINS = {
    'source.py': 'cb7c7d5d56ab269f299ecd678617a9206a182b08e23b66cc9032356eafe84770',
    'compiler.py': '349fa2bde996035eaf3de17dc14ae4ba6b0fd79791d7286adb6ebd5e8210791d',
    'entry.mjs': '4ffb0305768a3bd7899174b9bd47927c39367b59c05f0a0d8b73c887e2e0e5df',
    'admit.mjs': '607f5ab272ead8a8796d9d4c798fa9a189cbe120577671811f54aba889783da8',
    'test_proof.py': 'fce128370fe977651c62ac1b3d685c99f372695ee007e8aabe5a1eb3b5f77220',
    'admit.test.mjs': '282d90709d169ac762348f31e638e9c73fdc4b9293ffb3a3dead31b613329298',
    'README.md': 'b283a908c8f2e0d0ed8c8a902cfeb8272b1facfd74b111d2d0cabfae3dc02ef2',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('SCALAR_FULL_SOURCE_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def frozen():
    for file, digest in [(OLD / name, digest) for name, digest in PINS.items()] + [(EXTENSION, EXTENSION_SHA)]:
        info = file.lstat()
        need(file.is_file() and not file.is_symlink() and info.st_nlink == 1 and sha(file.read_bytes()) == digest)
    load('scalar_full_frozen_slide', OLD / 'source.py').frozen()


def original():
    frozen()
    return load('scalar_full_parent_source', OLD / 'source.py')


def extension():
    frozen()
    return load('scalar_full_shared_extension', EXTENSION)


def project_cases():
    return original().project_cases()


def project_callback(cases_path):
    before, prior = original().project_callback(cases_path)
    after, proof = extension().extend_callback(before)
    return after, {'parent_slide_full_projection': prior, 'seven_target_extension': proof,
                   'all_eight_sixteen_AA_RC_focus_pin_raw_cases_unchanged': True,
                   'only_scalar_body_added_to_existing_variant_install_selection': True}


def project_entry():
    frozen()
    before = (OLD / 'entry.mjs').read_bytes().decode('utf8')
    source = before.replace(PREVIOUS_NAMESPACE, NAMESPACE).replace('SLIDE_FULL_PROOF_', 'SCALAR_FULL_PROOF_')
    old_scope = 'owned synthetic whole-generation8s: old280 canonical four plus English versus aa1 DATA0dba wrapperc6 GENaf486 rawf222 Englishb763; unchanged full8/16 AA RC pin raw and restore; no provider/production acceptance'
    new_scope = 'owned synthetic whole-generation8s: old280 canonical four Englishc68 scalar5eb versus aa1 DATA0dba wrapperc6 GENaf486 rawf222 Englishb763 scalar845; unchanged full8/16 AA RC pin raw and original7 restore; no signedOAuth/provider/production acceptance'
    changes = [
        ("import {admitCarry,freshCarry,assertEnglishBindings}from './admit.mjs';",
         "import {admitCarry,freshCarry,assertSevenBindings,ADMISSION_READY}from './admit.mjs';"),
        ('export const EXECUTION_ENABLED=false;', 'export const EXECUTION_ENABLED=false;\nexport {ADMISSION_READY};'),
        (" assert(EXECUTION_ENABLED,'SCALAR_FULL_PROOF_EXECUTION_DISABLED');",
         " assert(EXECUTION_ENABLED,'SCALAR_FULL_PROOF_EXECUTION_DISABLED');\n assert(ADMISSION_READY,'SCALAR_FULL_PROOF_PARITY_UNBOUND');"),
        (' assertEnglishBindings(ctx.bindings);', ' assertSevenBindings(ctx.bindings);'),
        (old_scope, new_scope),
    ]
    for old, new in changes:
        need(source.count(old) == 1 and new not in source)
        source = source.replace(old, new, 1)
    inverse = source
    for old, new in reversed(changes):
        need(inverse.count(new) == 1)
        inverse = inverse.replace(new, old, 1)
    need(inverse.replace(NAMESPACE, PREVIOUS_NAMESPACE).replace('SCALAR_FULL_PROOF_', 'SLIDE_FULL_PROOF_') == before)
    return source


def admit_entry(raw):
    closed = project_entry()
    flag = 'export const EXECUTION_ENABLED=false;'
    need(closed.count(flag) == 1)
    need(raw in [closed, closed.replace(flag, 'export const EXECUTION_ENABLED=true;', 1)])
