"""Finite matching-profile successor; frozen bodies and full cases stay exact."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LIBRARY = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD = LIBRARY / 'development/m07/presentation-generation-scalar-full-proof'
NAMESPACE = HERE.name
PREVIOUS_NAMESPACE = OLD.name
STATS_REF = 'tracking/evidence/m07/completion-release/canonical-planner-stats-e2813947-7ccb-4f96-820b-6b156f3e8653.json'
STATS_SHA = '8df6f004e2cc99e92fa43962dcc6523c93324910548f9836ddf927094a37a27d'
PROFILE = {'jit': 'off', 'plan_cache_mode': 'auto', 'default_statistics_target': '100'}
PINS = {
    'admit.mjs': '6d8e31246f580d7779e2cd6961629f542e786c3d1bb76d3e5813a74d4a60de02',
    'admit.test.mjs': '3a3dad544c7357a6c44bf53079c9252501c93fe09e79fa24003d571e03948a27',
    'compiler.py': '0c1d44aea70b7bdf813d634f402be1a241e2ce8f60a52b64404f67b4bc2f3fc9',
    'entry.mjs': '984e50c42a7e942e7b15cb852a4be6d71b4095f40759fe9e42ddfb1d4bce164a',
    'extension.py': '32bd4cba5325bb240661f64b91707cfb2a984df78c121398841fe1866f03849d',
    'README.md': '919d9ab31b34820abb018f3a51d2ca605a6536b708e488f989b4a2b71c2c8ca2',
    'source.py': '5b9790b6ff9f984d5194933e3210f2c7188a1b3a235e9b31f455e3ed17dab2c7',
    'test_extension.py': 'aa1d6afee334f8aa326ad700ec89629d6d531576058c98d780509541f681b465',
    'test_proof.py': '4313614f5643564a74d2a5e87421d9f126f548c62db1ad9de442e23b8e4c4091',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('CANONICAL_PROFILE_FULL_SOURCE_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def frozen():
    for name, digest in PINS.items():
        file = OLD / name
        info = file.lstat()
        need(file.is_file() and not file.is_symlink() and info.st_nlink == 1 and sha(file.read_bytes()) == digest)
    load('profile_full_frozen_source', OLD / 'source.py').frozen()
    raw = (LIBRARY / STATS_REF).read_bytes()
    need(sha(raw) == STATS_SHA)
    receipt = json.loads(raw)
    need(receipt['result'] == 'passed' and receipt['normal_CLI_exit'] == 0)
    need({name: receipt['data']['settings'][name] for name in PROFILE} == PROFILE)


def parent():
    frozen()
    return load('profile_full_parent', OLD / 'source.py')


def project_callback(cases_path):
    before, previous = parent().project_callback(cases_path)
    source = before
    edits = [
        ("import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport {observeProfile}from " + json.dumps((HERE / 'profile.mjs').as_uri()) + ';'),
        (' const sessions=[],start=async tag=>{const s=session(ctx,tag);sessions.push(s);return s.start();};',
         ' const sessions=[],start=async tag=>{const s=session(ctx,tag);sessions.push(s);await s.start();await observeProfile(ctx,s,tag);return s;};'),
        ('  await firstWholeGenerations(combined);', "  await observeProfile(ctx,observer,'before_matrix');\n  await firstWholeGenerations(combined);"),
    ]
    for old, new in edits:
        need(source.count(old) == 1 and new not in source)
        source = source.replace(old, new, 1)
    inverse = source
    for old, new in reversed(edits):
        need(inverse.count(new) == 1)
        inverse = inverse.replace(new, old, 1)
    need(inverse == before)
    return source, {'inverse_byte_equal': True, 'parent_full_seven_projection': previous,
                    'only_profile_reads_added_before_shared_session_return_and_matrix': True,
                    'full_eight_sixteen_AA_RC_pin_raw_and_seven_restore_unchanged': True}


def project_entry():
    frozen()
    before = (OLD / 'entry.mjs').read_bytes().decode('utf8')
    source = before.replace(PREVIOUS_NAMESPACE, NAMESPACE).replace('SCALAR_FULL_PROOF_', 'CANONICAL_PROFILE_FULL_PROOF_')
    source = source.replace("from './admit.mjs'", 'from ' + json.dumps((OLD / 'admit.mjs').as_uri()))
    for relative in ['../presentation-lock-source-proof/proof.mjs', '../presentation-lock-source-dedupe-proof/entry.mjs',
                     '../presentation-generation-data-diagnostics/capture.mjs', '../presentation-lock-source-oracle-proof/admit.mjs']:
        source = source.replace("from '" + relative + "'", 'from ' + json.dumps((OLD / relative).resolve().as_uri()))
    source = source.replace("import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nexport {ownedPostgresCommand}from './profile.mjs';", 1)
    # Parent's hash read must still bind the frozen capture library, not this worktree.
    old = "new URL('../presentation-generation-data-diagnostics/capture.mjs',import.meta.url)"
    new = 'new URL(' + json.dumps((OLD.parent / 'presentation-generation-data-diagnostics/capture.mjs').as_uri()) + ')'
    need(source.count(old) == 1)
    source = source.replace(old, new, 1)
    inverse = source.replace(new, old, 1)
    inverse = inverse.replace("\nexport {ownedPostgresCommand}from './profile.mjs';", '', 1)
    for relative in ['../presentation-lock-source-proof/proof.mjs', '../presentation-lock-source-dedupe-proof/entry.mjs',
                     '../presentation-generation-data-diagnostics/capture.mjs', '../presentation-lock-source-oracle-proof/admit.mjs']:
        absolute = 'from ' + json.dumps((OLD / relative).resolve().as_uri())
        need(inverse.count(absolute) == 1)
        inverse = inverse.replace(absolute, "from '" + relative + "'", 1)
    inverse = inverse.replace('from ' + json.dumps((OLD / 'admit.mjs').as_uri()), "from './admit.mjs'", 1)
    need(inverse.replace(NAMESPACE, PREVIOUS_NAMESPACE).replace('CANONICAL_PROFILE_FULL_PROOF_', 'SCALAR_FULL_PROOF_') == before)
    return source


def admit_entry(raw):
    closed = project_entry()
    flag = 'export const EXECUTION_ENABLED=false;'
    need(closed.count(flag) == 1)
    need(raw in [closed, closed.replace(flag, 'export const EXECUTION_ENABLED=true;', 1)])
