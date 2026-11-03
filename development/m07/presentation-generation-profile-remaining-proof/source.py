"""Exact remaining-tail continuation; completed work stays dated, never replayed."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LIBRARY = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD = LIBRARY / 'development/m07/presentation-generation-canonical-profile-full-proof'
NAMESPACE = HERE.name
PREVIOUS_NAMESPACE = OLD.name
FIX = LIBRARY / 'development/m07/presentation-raw-observer-sql-fix/raw-authority.mjs'
FIX_SHA = '66fc775e5fb5369933117df7c2305134032baa4e6c8a181a525739d1d0890491'
OLD_RAW = LIBRARY / 'development/m07/presentation-raw-companion-batch-proof/raw-authority.mjs'
OLD_RAW_SHA = '1b7d1743f1c1e7a750d12a26056c3208bbfa024f230386b5296998f02f333896'
CARRY_BASE = 'tracking/evidence/m07/presentation-generation-canonical-profile-full-proof/'
CARRY_REFS = {
    '2026-11-03T09-36-23.937Z-48ed954a.json': '599527b663a20a5a4e1e66c34a89c41078ca5b87c0998f96f89c546bbc48e721',
    'Root-48ed954a-postrun-audit.json': 'bf1c991bdef2363629084499e3cc006253a5b1f53d839d81812061f8666601f9',
    'Root-48ed954a-completed-scope-supplement.json': '158cbbc9a7a867d0fd1cc3701a7f7ec5e39792cc953f9be81813582879251678',
    '48ed954a-outcome.json': '7e802b88b42dbcb1d92ab366b19eca36c7148f8fa114c538aa20c9dc385ea018',
}
PINS = {
    'compiler.py': 'c71bd61dd4eb0ed9cb755fe8ced689197643898049f5909c99755d8c6b5e6f1f',
    'entry.mjs': 'b142d757016293048d3ecfb47b2b6cf51775ed4a918976bedf060e6185736177',
    'profile.mjs': '0e4815d2d9ce6e2090ef031fef273e5749668a0c87708b03a45dad8d5ff8e98c',
    'profile.test.mjs': '8f5e2ae0f10b7a91dece0d008732b5fc6c3987bb1cc40f4742199523d6bdb065',
    'README.md': '510f8097d65240ed14a98cf8165d47224b58af63c8501f85e842241d03fa3636',
    'source.py': '4f53e856c36ae9a0bdcd32088f8c75a8bd53daaf053adbe6a972d0f246032e73',
    'test_proof.py': 'f250a8715fcdbd09487fcd866e485bac46a39e7d4bedffcc73ade9eaa27a6eef',
}


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('PROFILE_REMAINING_SOURCE_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def frozen():
    files = [(OLD / name, digest) for name, digest in PINS.items()] + [(FIX, FIX_SHA), (OLD_RAW, OLD_RAW_SHA)]
    files += [(LIBRARY / (CARRY_BASE + name), digest) for name, digest in CARRY_REFS.items()]
    for file, digest in files:
        info = file.lstat()
        need(file.is_file() and not file.is_symlink() and info.st_nlink == 1 and sha(file.read_bytes()) == digest)
    before, after = OLD_RAW.read_bytes(), FIX.read_bytes()
    need(before.count(b'${sender.pid}and') == 2)
    need(before.replace(b'${sender.pid}and', b'${sender.pid} and') == after)
    load('remaining_frozen_profile', OLD / 'source.py').frozen()


def parent():
    frozen()
    return load('remaining_profile_parent', OLD / 'source.py')


def project_callback(cases_path):
    before, previous = parent().project_callback(cases_path)
    source = before
    completed = """  await observeProfile(ctx,observer,'before_matrix');
  await firstWholeGenerations(combined);
  await projectionEqualities(combined);
  await installVariant('candidate');
  await verifyAcquisitionLocks({...combined,start,sourceBefore});
  await missingFrameEquality(combined);"""
    replacement = """  await observeProfile(ctx,observer,'before_remaining');
  ctx.applyCompletedScopes(combined);"""
    pin = '   await verifyPinAuthorityCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline,startFreshGeneration});'
    edits = [
        ('from ' + json.dumps(OLD_RAW.as_uri()), 'from ' + json.dumps(FIX.as_uri())),
        (completed, replacement),
        (pin, "   if(variant==='candidate'){\n " + pin + "\n   }else assert.equal(ctx.report.pin_batch_cases.old.executed_in_current_runtime,false);"),
        ('all_new_whole_generation_8s_and_data_equalities_completed=true', 'matching_graph_whole_generation_and_data_equalities_complete_with_dated48ed_prefix=true'),
    ]
    for old, new in edits:
        need(source.count(old) == 1 and new not in source)
        source = source.replace(old, new, 1)
    inverse = source
    for old, new in reversed(edits):
        need(inverse.count(new) == 1)
        inverse = inverse.replace(new, old, 1)
    need(inverse == before)
    return source, {'inverse_byte_equal': True, 'frozen_profile_full_projection': previous,
                    'completed_eight_sixteen_AA_and_missing_frame_not_reexecuted': True,
                    'old_pin_three_dated_only_candidate_three_fresh': True,
                    'old_data_and_assignment_recomputed_for_fresh_fixture_hash_equality': True,
                    'fixed_RAW_observer_only_two_PID_token_spaces': FIX_SHA,
                    'remaining_denials_races_cross_equalities_original_seven_restore_unchanged': True}


def project_entry():
    frozen()
    before = (OLD / 'entry.mjs').read_bytes().decode('utf8')
    source = before.replace(PREVIOUS_NAMESPACE, NAMESPACE).replace('CANONICAL_PROFILE_FULL_PROOF_', 'PROFILE_REMAINING_PROOF_')
    changes = [
        ("export {ownedPostgresCommand}from './profile.mjs';", 'export {ownedPostgresCommand}from ' + json.dumps((OLD / 'profile.mjs').as_uri()) + ';'),
        ('from ' + json.dumps((LIBRARY / 'development/m07/presentation-generation-scalar-full-proof/admit.mjs').as_uri()), "from './admit.mjs'"),
        ('assertSevenBindings,ADMISSION_READY}', 'assertSevenBindings,ADMISSION_READY,applyCompletedScopes}'),
        ('admitFreshCarry:fresh=>freshCarry(fresh,carried),', 'admitFreshCarry:fresh=>freshCarry(fresh,carried),applyCompletedScopes:fresh=>applyCompletedScopes(fresh,carried.completed48),'),
        ('owned synthetic whole-generation8s: old280 canonical four Englishc68 scalar5eb versus aa1 DATA0dba wrapperc6 GENaf486 rawf222 Englishb763 scalar845; unchanged full8/16 AA RC pin raw and original7 restore; no signedOAuth/provider/production acceptance',
         'fresh observed-admin-CLI-profile remaining-scope continuation: verified48ed 8/16 AA missing-frame and oldpin3 dated only; old data/assignment recomputed for fresh ID comparisons; both RAW6, remaining denials/races and candidate focused cases fresh; original7/config/fullclone restore required; no production MCP GUC or hosted acceptance'),
    ]
    for old, new in changes:
        need(source.count(old) == 1)
        source = source.replace(old, new, 1)
    inverse = source
    for old, new in reversed(changes):
        need(inverse.count(new) == 1)
        inverse = inverse.replace(new, old, 1)
    need(inverse.replace(NAMESPACE, PREVIOUS_NAMESPACE).replace('PROFILE_REMAINING_PROOF_', 'CANONICAL_PROFILE_FULL_PROOF_') == before)
    return source


def admit_entry(raw):
    closed = project_entry()
    flag = 'export const EXECUTION_ENABLED=false;'
    need(closed.count(flag) == 1)
    need(raw in [closed, closed.replace(flag, 'export const EXECUTION_ENABLED=true;', 1)])
