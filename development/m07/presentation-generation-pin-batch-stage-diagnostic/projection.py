"""Frozen eeca mechanism plus the exact reviewed pin-batch GEN block; no transport."""
from pathlib import Path
import hashlib
import importlib.util

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
NAMESPACE = 'presentation-generation-pin-batch-stage-diagnostic'
PREVIOUS_NAMESPACE = 'presentation-generation-acquisition-stage-diagnostic'
OLD = HERE.parent / PREVIOUS_NAMESPACE
PINS = {
    'admit.mjs': 'b86896643165e5d3d369890f127682a54cf30ab80c980f1bd7fa2a3418e63c73',
    'compiler.py': '8e766b027a10e7d1cdbea6669e153031724d8d17df1500ff9d7fdddf0184cee3',
    'entry.mjs': '989e2704bb361939f91223cf827f05330c8bfc943ef969d96b2ddd022f7eea64',
    'projection.py': '9c17435b3709e87aafebcd3055d0341717d80a8bc3e27ad28ae57efcd0b965cf',
    'README.md': 'b31d242e00c9fe6961dbc6f4a992c06534dd0053ef5b431bdefa36440e9fef5d',
    'test_wrapper.py': '69f3247aaece7f461a5597abe39991d1ff70cd93f6056c591ebf5c5224251f16',
    'wrapper.test.mjs': '953ec08218f13f843e90b90be811614a0c626232f9028a24dc6480db47378d48',
}
PIN_FILE = HERE.parent / 'presentation-asset-pin-batch/candidate.py'
PIN_SHA = 'e6c41fb88f2d665c9b1b41982915339dc598f75dc2e90ff50e745ea63faa8d5a'
GEN = '41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d'
OLD_INSTRUMENTED_GEN = 'e027442ba36b260fb573316e41cf6e8839baf42fe08d10277d8455cb7caaa6c7'
INSTRUMENTED_GEN = 'b3bc105e6fb7d14194b04db6dbb5e8bbaad8bad9fe237d276cbde751c112b2a3'
CALLBACK_EDITS = [
    ('candidate_aa1_four_body_identity_verified=true', 'candidate_aa1_pinbatch_four_body_identity_verified=true'),
    ('a820_performance_failure_remains_open=true', 'pinbatch374_performance_failure_remains_open=true'),
]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('PIN_BATCH_STAGE_SOURCE_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def frozen():
    for file, digest in [(OLD / name, value) for name, value in PINS.items()] + [(PIN_FILE, PIN_SHA)]:
        info = file.lstat()
        need(file.is_file() and not file.is_symlink() and info.st_nlink == 1)
        need(0 < info.st_size < 2 * 1024**2 and sha(file.read_bytes()) == digest)
    load('pin_stage_frozen_eeca_projection', OLD / 'projection.py').frozen()


def previous():
    frozen()
    return load('pin_stage_eeca_projection', OLD / 'projection.py')


def previous_instrument():
    value = previous()
    return load('pin_stage_d958_instrument', value.OLD / 'instrument.py')


def pin_candidate():
    frozen()
    return load('pin_stage_sealed_pin_batch', PIN_FILE)


def instrumented_bodies():
    instrument, candidate = previous_instrument(), pin_candidate()
    rows, pin = instrument.build(), candidate.build()
    row = next(x for x in rows if x['name'] == 'public.eps_generate_version')
    need(row['after_body_sha256'] == OLD_INSTRUMENTED_GEN)
    need(row['current_candidate_body_sha256'] == candidate.BEFORE_BODY_SHA)
    definition = pin['after']
    match = candidate.parts(definition)
    body = match[2]
    changed = instrument.transform(body, GEN, instrument.generate_edits())
    need(sha(changed.encode()) == INSTRUMENTED_GEN)
    after = definition[:match.start(2)] + changed + definition[match.end(2):]
    # The same notices and the sole pin-block substitution commute exactly.
    need(row['after'].count(candidate.OLD) == 1)
    need(row['after'].replace(candidate.OLD, candidate.NEW, 1) == after)
    row.update(after=after, current_candidate_body_sha256=GEN, after_body_sha256=INSTRUMENTED_GEN)
    return rows, {'one_business_GEN_block_only': True, 'same_notice_edits_and_line_count': True,
                  'GEN_notice_and_pin_block_inverse_byte_equal': True,
                  'current_GEN_sha256': GEN, 'instrumented_GEN_sha256': INSTRUMENTED_GEN,
                  'all_other_three_definitions_helper_authority_and_bounds_unchanged': True}


def project_callback(cases_path):
    before, prior = previous().project_callback(cases_path)
    source = before
    for a, b in CALLBACK_EDITS:
        need(source.count(a) == 1 and b not in source)
        source = source.replace(a, b, 1)
    inverse = source
    for a, b in reversed(CALLBACK_EDITS):
        inverse = inverse.replace(b, a, 1)
    need(inverse == before)
    return source, {'inverse_byte_equal': True, 'frozen_eeca_projection': prior,
                    'callback_SQL_authority_restore_and_one_call_unchanged': True,
                    'only_business_identity_and_prior_failure_labels_changed': True}


def project_entry():
    frozen()
    before = (OLD / 'entry.mjs').read_text(encoding='utf8')
    source = before.replace(PREVIOUS_NAMESPACE, NAMESPACE).replace('ACQUISITION_STAGE_DIAG_', 'PIN_BATCH_STAGE_DIAG_')
    need(source.count(OLD_INSTRUMENTED_GEN) == 1)
    source = source.replace(OLD_INSTRUMENTED_GEN, INSTRUMENTED_GEN, 1)
    old_scope = 'one owned helperaa1 current-four MCP-large8s stage diagnostic: unchanged d958 bounded NOTICE/private57014 mechanism; a820 failure remains open; instrumentation cost present, no performance/provider/production acceptance'
    scope = 'one owned helperaa1 GEN41fe MCP-large8s stage diagnostic: unchanged eeca/d958 bounded NOTICE/private57014 mechanism; pinbatch374 failure remains open; instrumentation cost present, no performance/provider/production acceptance'
    need(source.count(old_scope) == 1)
    source = source.replace(old_scope, scope, 1)
    inverse = source.replace(scope, old_scope, 1).replace(INSTRUMENTED_GEN, OLD_INSTRUMENTED_GEN, 1)
    inverse = inverse.replace(NAMESPACE, PREVIOUS_NAMESPACE).replace('PIN_BATCH_STAGE_DIAG_', 'ACQUISITION_STAGE_DIAG_')
    need(inverse == before)
    return source
