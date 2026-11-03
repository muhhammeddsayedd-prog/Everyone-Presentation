"""Finite current full-proof continuation; only GEN pin block and case call change."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-lock-acquisition-proof'
SOURCE_SHA = '72920b540f5b40ed7f3aedc4f5d6f9d67ddd5bd23b4ee6f4749b71d57a002ffe'
ENTRY_SHA = '04e329e27412aa7aea50c227f9c492c0aadd751cd9df6fac6263e651e96d4eb2'
ADMIT_SHA = 'cb2b89a2f403cdcbdd9c7df5d7940770ee68ca423237580ebc9a6483e70db058'
BEFORE = 'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40'
AFTER = '41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('PIN_BATCH_PROOF_SOURCE_UNCONFIRMED')


def original():
    file = OLD / 'source.py'
    need(sha(file.read_bytes()) == SOURCE_SHA)
    spec = importlib.util.spec_from_file_location('pin_batch_frozen_acquisition_projection', file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def project_cases():
    return original().project_cases()


def project_callback(cases_path):
    before, prior = original().project_callback(cases_path)
    imported = 'import {verifyAcquisitionLocks}from ' + json.dumps((OLD / 'locks.mjs').as_uri()) + ';'
    edits = [
        (imported, imported + '\nimport {verifyPinAuthorityCases}from ' + json.dumps((HERE / 'pin-authority.mjs').as_uri()) + ';'),
        ('ctx.report.data_reuse_cases={};ctx.report.assignment_cases={};',
         'ctx.report.data_reuse_cases={};ctx.report.assignment_cases={};ctx.report.pin_batch_cases={};'),
        ('   await verifyAssignmentCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline});',
         '   await verifyAssignmentCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline});\n   await verifyPinAuthorityCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline,startFreshGeneration});'),
    ]
    source = before
    for old, new in edits:
        need(source.count(old) == 1 and new not in source)
        source = source.replace(old, new, 1)
    inverse = source
    for old, new in reversed(edits):
        need(inverse.count(new) == 1)
        inverse = inverse.replace(new, old, 1)
    need(inverse == before)
    return source, {'inverse_byte_equal': True, 'frozen_acquisition_projection': prior,
                    'same_candidate_MCP_large_first_eight_matrix_and_sixteen_components': True,
                    'same_fresh_aa1_twelve_locksets_archived_FK_and_RC_cases': True,
                    'same_focus_fallback_English_missing_frame_selection_Shortlist_and_restore': True,
                    'adds_only_pin_phase_fresh_authority_cases_with_fresh_sender_factory': True}


def project_entry():
    raw = (OLD / 'entry.mjs').read_bytes()
    need(sha(raw) == ENTRY_SHA)
    before = raw.decode()
    source = before.replace('presentation-generation-lock-acquisition-proof', 'presentation-generation-pin-batch-proof').replace('ACQUISITION_PROOF_', 'PIN_BATCH_PROOF_')
    need(source.count(BEFORE) == 1)
    source = source.replace(BEFORE, AFTER, 1)
    old_scope = 'owned synthetic whole-generation8s: old280 with canonical four versus newaa1 with current four; fresh original12 locksets and RC authority; historical280 scopes dated only; no provider/production acceptance'
    new_scope = 'owned synthetic whole-generation8s: old280 canonical four versus aa1 current four with one pin INSERT; fresh semantic lock and pin-phase authority proof; no provider/production acceptance'
    need(source.count(old_scope) == 1)
    source = source.replace(old_scope, new_scope, 1)
    inverse = source.replace(new_scope, old_scope, 1).replace(AFTER, BEFORE, 1)
    inverse = inverse.replace('presentation-generation-pin-batch-proof', 'presentation-generation-lock-acquisition-proof').replace('PIN_BATCH_PROOF_', 'ACQUISITION_PROOF_')
    need(inverse == before)
    return source


def project_admit():
    raw = (OLD / 'admit.mjs').read_bytes()
    need(sha(raw) == ADMIT_SHA)
    before = raw.decode()
    need(before.count(BEFORE) == 1 and AFTER not in before)
    source = before.replace(BEFORE, AFTER, 1)
    need(source.replace(AFTER, BEFORE, 1) == before)
    return source
