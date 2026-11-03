"""Finite aa1 continuation over the frozen d958 stage mechanism; no transport."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-stage-diagnostic'
PINS = {
    'admit.mjs': 'bcfefa2cc95c5e25e53b998eca28bf6391ee61f8f213189ba77500d6129cdc29',
    'admit.test.mjs': 'f32174f35b5678effd91cea32fe6636f149e4ce4fa60194b025fca2b256df7f4',
    'compiler.py': '4f9c0899404c3857e9021b923bdeb544ef73276c255b958a340431ffa0635070',
    'entry.mjs': 'd8eff4fa9bc0a851377b89e32dc8d455006bc2d3ad30d1fb0264e1ff0f872f8f',
    'instrument.py': '1540d3c69ed14fb2409c032b93d5ee1cd371801e5b98c7b4264870ca1cc7197c',
    'markers.mjs': 'e65c3f2570c1d5d7976b3ea1ba75be2767e3a5f75af0e4ad863a938ca5f72b46',
    'markers.test.mjs': '3d618d4579efaf42d2697d9452de3472967339c2912d720e325b5a0d3234b86f',
    'README.md': '8b7ee6d22502cc754de1c32cce765ed06a57472787c95d26a160ff6e71f85dca',
    'receiver.test.mjs': '0f9e9c80a68f30c40c22fba906d8e65c503d7b9b20314472000c1cfd8ed1f4ed',
    'run.mjs': 'c6163fe506810d2a5666150f86a84498ac655a1506a4d372c43624c9b3790663',
    'run.test.mjs': '6ff93fedfbc9eea0ff06297e259b075875a01d7d538c7c68a0f45a67d810d3fa',
    'session.mjs': 'ea8b032d35946a19293ffc16c8f9ac8bf233c5601058f178230385c708d250a5',
    'source.py': '5847849a862e7b17deafdf5976117a31dd9250f12329e9c02120c40e0e68a0b0',
    'test_proof.py': 'fd74360ccc6d5666a96ba53814448c3bd8c391d0d8792bbe58de7157d0dc815c',
}
BEFORE = '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4'
AFTER = 'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3'


def need(ok):
    if not ok:
        raise ValueError('ACQUISITION_STAGE_SOURCE_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def frozen():
    for name, digest in PINS.items():
        file = OLD / name
        info = file.lstat()
        need(file.is_file() and not file.is_symlink() and info.st_nlink == 1)
        need(0 < info.st_size < 2 * 1024**2 and sha(file.read_bytes()) == digest)


def previous():
    frozen()
    spec = importlib.util.spec_from_file_location('acquisition_frozen_stage_projection', OLD / 'source.py')
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def project_callback(cases_path):
    before, prior = previous().project_callback(cases_path)
    edits = [
        ('helper280_four_body_identity_verified=true', 'candidate_aa1_four_body_identity_verified=true'),
        ('d093_performance_failure_remains_open=true', 'a820_performance_failure_remains_open=true'),
    ]
    source = before
    for old, new in edits:
        need(source.count(old) == 1 and new not in source)
        source = source.replace(old, new, 1)
    inverse = source
    for old, new in reversed(edits):
        inverse = inverse.replace(new, old, 1)
    need(inverse == before)
    return source, {'inverse_byte_equal': True, 'frozen_d958_projection': prior,
                    'callback_business_SQL_authority_and_restoration_byte_unchanged': True,
                    'only_helper_identity_and_failed_baseline_labels_changed': True}


def project_entry():
    frozen()
    before = (OLD / 'entry.mjs').read_text()
    source = before.replace('presentation-generation-stage-diagnostic', 'presentation-generation-acquisition-stage-diagnostic').replace('STAGE_DIAG_', 'ACQUISITION_STAGE_DIAG_')
    old = "assert.equal(ctx.bindings.candidateSha,'" + BEFORE + "');"
    need(source.count(old) == 1)
    source = source.replace(old, "assert.equal(ctx.bindings.candidateSha,'" + AFTER + "');", 1)
    old_scope = 'one owned current-candidate MCP-large8s stage diagnostic: fixed bounded NOTICE records and private57014 stack; instrumentation cost present, no performance/provider/production acceptance'
    new_scope = 'one owned helperaa1 current-four MCP-large8s stage diagnostic: unchanged d958 bounded NOTICE/private57014 mechanism; a820 failure remains open; instrumentation cost present, no performance/provider/production acceptance'
    need(source.count(old_scope) == 1)
    source = source.replace(old_scope, new_scope, 1)
    inverse = source.replace(new_scope, old_scope, 1).replace("assert.equal(ctx.bindings.candidateSha,'" + AFTER + "');", old, 1)
    inverse = inverse.replace('presentation-generation-acquisition-stage-diagnostic', 'presentation-generation-stage-diagnostic').replace('ACQUISITION_STAGE_DIAG_', 'STAGE_DIAG_')
    need(inverse == before)
    return source
