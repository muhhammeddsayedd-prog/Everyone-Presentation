"""Remove only an unused owned-setup DTO hash; keep the frozen remaining proof."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LIBRARY = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD = LIBRARY / 'development/m07/presentation-generation-profile-remaining-proof'
NAMESPACE = HERE.name
PREVIOUS_NAMESPACE = OLD.name
TEMP = LIBRARY / 'development/m07/presentation-lock-source-proof/temporary.sql'
TEMP_SHA = '6c34eae348be361652b001cc1e14ea5e2d4bca16513eace77777592df924e33c'
COST = ",'review_hash',eps.presentation_hash(v_review)"
FAILED_REF = 'tracking/evidence/m07/presentation-generation-profile-remaining-proof/2026-11-03T10-15-53.024Z-24a6b816.json'
FAILED_SHA = 'f8c6af1243fb5b15d76f4dd6f4f5211b8f10aefbcc21016e1c2f1321c783822f'
FAILED_AUDIT_REF = 'tracking/evidence/m07/presentation-generation-profile-remaining-proof/Root-24a6b816-postrun-audit.json'
FAILED_AUDIT_SHA = '7a7918379198d12cde78ecf005c22f244ff267af6844e01be466705c339ab835'
ENTRY_ARMED = '93fdb887ebdf6c9975997b7f32f2a6d9315ca42f2cb362af2a45b35cff860372'
PINS = {
    'admit.mjs': '909c6fa7248776b58439dca35893dbece3aa69162c410f122d700bd91459ef4a',
    'admit.test.mjs': 'd6360fe25cd49b64b8b2b39dbff86e6a44a55a6a7f095a8752bbb82e9a77dc33',
    'compiler.py': 'bcbf210ff3493edc8350f53c0d604c4a03ffb3a3aa804ddfdbc9ec8f95e927a4',
    'entry.mjs': '47a6e847e2582fed47a0a6c501d312caa1d3a1bc047c39f5daaa52df8347a35b',
    'README.md': 'ced286ae2354b4a93891f2fcb7d47f27dbde0a5a9d09498eee28bf2b5e814319',
    'source.py': 'ece290531ef642f6834a4ae536b480f8b28ea09fe0abf9e196d1b6352954693f',
    'test_proof.py': '3df0c7a8a19e34ac4c747d18a35e644f8249593171d625559c4e6e61f7ff4727',
}
# Explicit runtime reader/consumer scope, plus generated callback/cases below.
RUNTIME_MODULES = [
    'presentation-lock-source-proof/proof.mjs', 'presentation-lock-source-proof/session.mjs',
    'presentation-lock-source-proof/probes.mjs', 'presentation-lock-source-seed-proof/entry.mjs',
    'presentation-lock-source-dedupe-proof/entry.mjs', 'presentation-lock-source-pool-proof/cases.mjs',
    'presentation-lock-source-pool-proof/native.mjs', 'presentation-generation-assignment-proof/matrix.mjs',
    'presentation-generation-assignment-proof/assignment-cases.mjs', 'presentation-generation-lock-acquisition-proof/locks.mjs',
    'presentation-generation-lock-acquisition-proof/security.mjs', 'presentation-generation-pin-batch-proof/pin-authority.mjs',
    'presentation-raw-observer-sql-fix/raw-authority.mjs', 'presentation-generation-data-diagnostics/capture.mjs',
    'presentation-generation-canonical-profile-full-proof/profile.mjs',
]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('SETUP_META_REMAINING_SOURCE_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def frozen():
    for name, digest in PINS.items():
        file = OLD / name
        info = file.lstat()
        need(file.is_file() and not file.is_symlink() and info.st_nlink == 1)
        actual = sha(file.read_bytes())
        need(actual in (digest, ENTRY_ARMED) if name == 'entry.mjs' else actual == digest)
    need(sha(TEMP.read_bytes()) == TEMP_SHA)
    raw = (LIBRARY / FAILED_REF).read_bytes()
    need(sha(raw) == FAILED_SHA)
    failed = json.loads(raw)
    need(failed['run_id'] == '24a6b816-9152-4731-9eb3-4346aaa9f2a8' and failed['result'] == 'failed')
    need(failed['checkpoint'] == 'locksource41-synthetic-fit-large' and len(failed['source_seals']) == 235)
    need('combined_generation' not in failed and 'raw_authority_cases' not in failed)
    need(len(failed['data_reuse_body_installations']) == 0)
    need(all(failed[key] is True for key in ['all_owned_resources_absent', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released']))
    raw = (LIBRARY / FAILED_AUDIT_REF).read_bytes()
    need(sha(raw) == FAILED_AUDIT_SHA)
    audit = json.loads(raw)
    need(audit['run_id'] == failed['run_id'] and audit['actual_receipt']['sha256'] == FAILED_SHA)
    need(audit['normal_process_exit'] == 1 and audit['runtime_source_seals_verified'] == 235)
    need(audit['new_business_body_installations'] == 0 and audit['remaining_scope_cases_started'] is False)
    need(audit['earlier48ed_passed_scopes_invalidated'] is False)
    need(all(audit[key] is True for key in ['actual_and_private_executed_source_hashes_equal', 'failure_after_large_fit_before_first_business_body_install', 'original_target_preserved', 'fresh_shared_lock_absent', 'independent_successful_daemon_label_inventories_empty']))
    load('setup_meta_frozen_remaining', OLD / 'source.py').frozen()


def parent():
    frozen()
    return load('setup_meta_remaining_parent', OLD / 'source.py')


def patch_temporary(before):
    need(sha(before.encode()) == TEMP_SHA and before.count(COST) == 1)
    after = before.replace(COST, '', 1)
    anchor = "'can_generate',v_review->'can_generate')"
    need(after.count(anchor) == 1)
    need(after.replace(anchor, anchor[:-1] + COST + ')', 1) == before)
    return after


def no_consumers(callback, cases):
    texts = {'generated_callback': callback, 'generated_cases': cases}
    texts.update({name: (LIBRARY / 'development/m07' / name).read_bytes().decode('utf8') for name in RUNTIME_MODULES})
    need(all('review_hash' not in text for text in texts.values()))
    return {name: sha(text.encode()) for name, text in texts.items()}


def project_callback(cases_path):
    before, previous = parent().project_callback(cases_path)
    anchor = "  if(file==='scale.sql')return qualifyScale(qualifySeed(text));"
    replacement = "  if(file==='temporary.sql'){assert.equal(sha(text)," + json.dumps(TEMP_SHA) + ");assert.equal(sha(ctx.bindings.setupMetadataTemporarySQL)," + json.dumps(sha(patch_temporary(TEMP.read_bytes().decode('utf8')).encode())) + ");return ctx.bindings.setupMetadataTemporarySQL;}\n" + anchor
    need(before.count(anchor) == 1)
    after = before.replace(anchor, replacement, 1)
    need(after.count(replacement) == 1 and after.replace(replacement, anchor, 1) == before)
    no_consumers(after, '')
    return after, {'inverse_byte_equal': True, 'parent_remaining_projection': previous,
                   'only_temporary_setup_review_hash_argument_removed': True,
                   'production_and_measured_hash_equality_gates_unchanged': True,
                   'failed24_setup_attempt_preserved': {'path': FAILED_REF, 'sha256': FAILED_SHA},
                   'failed24_independent_audit': {'path': FAILED_AUDIT_REF, 'sha256': FAILED_AUDIT_SHA}}


def project_entry():
    frozen()
    before = (OLD / 'entry.mjs').read_bytes().decode('utf8')
    if sha(before.encode()) == ENTRY_ARMED:
        flag = 'export const EXECUTION_ENABLED=true;'
        need(before.count(flag) == 1)
        before = before.replace(flag, 'export const EXECUTION_ENABLED=false;', 1)
        need(sha(before.encode()) == PINS['entry.mjs'])
    after = before.replace(PREVIOUS_NAMESPACE, NAMESPACE).replace('PROFILE_REMAINING_PROOF_', 'SETUP_META_REMAINING_PROOF_')
    old = "from './admit.mjs'"
    new = 'from ' + json.dumps((OLD / 'admit.mjs').as_uri())
    need(after.count(old) == 1)
    after = after.replace(old, new, 1)
    need(after.replace(new, old, 1).replace(NAMESPACE, PREVIOUS_NAMESPACE).replace('SETUP_META_REMAINING_PROOF_', 'PROFILE_REMAINING_PROOF_') == before)
    return after


def admit_entry(raw):
    closed = project_entry()
    flag = 'export const EXECUTION_ENABLED=false;'
    need(closed.count(flag) == 1 and raw in [closed, closed.replace(flag, 'export const EXECUTION_ENABLED=true;', 1)])
