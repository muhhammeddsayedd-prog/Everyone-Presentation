"""Finite new-purpose projection; no SQL, Docker or provider dispatch."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-assignment-proof'
SOURCE_SHA = '0e4e467dc4cf0574664c62413438dc5122a8cb62e947ff906d81cd1bb44a18a6'
ENTRY_SHA = '8b9c0afe4080b6673fbb19303dc19655ef9bf4c4c1d4069bb6e2567554372785'
HELPER_BEFORE = '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4'
HELPER_AFTER = 'aa1db8b1c2f8e9a15360c24fd9a4216df03c9f14767b1b300898a3e88a7220e3'
SECURITY = HERE.parent / 'presentation-lock-source-complete-oracle-proof/source.py'
SECURITY_SHA = 'd5a2767b9a779ddfec7800ad175d6b555715d4071193daeb8c33fbbb27b740a8'
POOL_FK_SQL = "select jsonb_build_object('validated',convalidated,'deferrable',condeferrable,'deferred',condeferred,'source_relation',conrelid='eps.assignments'::regclass,'target_relation',confrelid='eps.workspace_candidates'::regclass,'source_columns',conkey=ARRAY[(select attnum from pg_attribute where attrelid='eps.assignments'::regclass and attname='workspace_id'),(select attnum from pg_attribute where attrelid='eps.assignments'::regclass and attname='workspace_candidate_id')]::smallint[],'target_columns',confkey=ARRAY[(select attnum from pg_attribute where attrelid='eps.workspace_candidates'::regclass and attname='workspace_id'),(select attnum from pg_attribute where attrelid='eps.workspace_candidates'::regclass and attname='id')]::smallint[],'foreign_key',contype='f')from pg_constraint where conrelid='eps.assignments'::regclass and conname='assignments_workspace_id_workspace_candidate_id_fkey';"


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('ACQUISITION_PROOF_SOURCE_UNCONFIRMED')


def module(name, file, digest):
    need(sha(file.read_bytes()) == digest)
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def original():
    return module('acquisition_frozen_assignment_projection', OLD / 'source.py', SOURCE_SHA)


def project_cases():
    return original().project_cases()


def project_security():
    before, prior = module('acquisition_frozen_RC_projection', SECURITY, SECURITY_SHA).project_cases()
    boundary = before.index('export async function firstAndWarm(')
    header = before[:boundary]
    removed = []
    for line in header.splitlines(keepends=True):
        if any(token in line for token in ["import { readFile }", "import { URL }", "import { performance }", 'import {semanticTuples}']):
            removed.append(line)
    for line in removed:
        need(header.count(line) == 1)
        header = header.replace(line, '')
    names = ['probe', 'heldCohorts', 'crossWorkspaceKeys', 'workspaceFenceRace', 'authorityCases']
    bodies = []
    for name in names:
        found = re.search(r'(?:export )?async function ' + name + r'\([^\n]*?\)\{.*?(?=\n(?:async|export) )', before, re.S)
        need(found is not None)
        text = found[0]
        if name in ['crossWorkspaceKeys', 'workspaceFenceRace', 'authorityCases']:
            need(not text.startswith('export '))
            text = 'export ' + text
        bodies.append(text)
    raw = (header + '\n\n'.join(bodies)).rstrip() + '\n'
    # Relativize only the five fixed inert imports for a checkout-portable file.
    prefix = ROOT.as_uri() + '/development/m07/'
    count = raw.count(prefix)
    need(count == 3)
    result = raw.replace(prefix, '../')
    need(result.replace('../presentation-', prefix + 'presentation-') == raw)
    hashes = {name: sha(re.search(r'async function ' + name + r'\([^\n]*?\)\{.*?(?=\n(?:async|export) |\Z)', result, re.S)[0].rstrip().encode())
              for name in names}
    for name in names:
        old = re.search(r'async function ' + name + r'\([^\n]*?\)\{.*?(?=\n(?:async|export) )', before, re.S)[0].rstrip()
        new = re.search(r'async function ' + name + r'\([^\n]*?\)\{.*?(?=\n(?:async|export) |\Z)', result, re.S)[0].rstrip()
        need(old == new)
    return result, {'frozen_projection_sha256': sha(before.encode()), 'selected_function_bodies_byte_equal': hashes,
                    'only_inert_imports_relativized': count, 'no_old_run_or_first_warm_or_semantic_entry': True,
                    'original_complete_oracle_and_RC_fence_authority_functions_retained': True,
                    'historical_projection': prior}


def project_callback(cases_path):
    before, prior = original().project_callback(cases_path)
    edits = [
        ('import {verifyAssignmentCases,assertAssignmentEquality}from ' + json.dumps((OLD / 'assignment-cases.mjs').as_uri()) + ';',
         'import {verifyAssignmentCases,assertAssignmentEquality}from ' + json.dumps((OLD / 'assignment-cases.mjs').as_uri()) + ';\nimport {verifyAcquisitionLocks}from ' + json.dumps((HERE / 'locks.mjs').as_uri()) + ';'),
        ('helper_variant_same_both_sides:true', 'helper_variant_same_both_sides:false,changed_helper_security_must_run_fresh:true'),
        ("await install(ctx.bindings.candidateSource,variant==='old'?ctx.bindings.beforeBodies:ctx.bindings.afterBodies);",
         "await install(variant==='old'?ctx.bindings.baseSource:ctx.bindings.candidateSource,variant==='old'?ctx.bindings.beforeBodies:ctx.bindings.afterBodies);"),
        ("assert.equal(actual.source,'" + HELPER_BEFORE + "');assert.equal(record.authority_unchanged,true);",
         "assert.equal(actual.source,variant==='old'?ctx.bindings.baseSha:ctx.bindings.candidateSha);assert.equal(record.authority_unchanged,true);"),
        ('  ctx.report.data_reuse_cases={};ctx.report.assignment_cases={};',
         '  ctx.report.data_reuse_cases={};ctx.report.assignment_cases={};\n  const acquisitionFK=await value(' + json.dumps(POOL_FK_SQL) + ");\n  ctx.report.lock_acquisition_FK=acquisitionFK;assert.deepEqual(acquisitionFK,{validated:true,deferrable:false,deferred:false,source_relation:true,target_relation:true,source_columns:true,target_columns:true,foreign_key:true});"),
        ('  await projectionEqualities(combined);',
         '  await projectionEqualities(combined);\n  await installVariant(\'candidate\');\n  await verifyAcquisitionLocks({...combined,start,sourceBefore});'),
    ]
    source = before
    for old, new in edits:
        need(source.count(old) == 1 and source.count(new) == 0)
        source = source.replace(old, new, 1)
    inverse = source
    for old, new in reversed(edits):
        need(inverse.count(new) == 1)
        inverse = inverse.replace(new, old, 1)
    need(inverse == before)
    return source, {'inverse_byte_equal': True, 'frozen_assignment_projection': prior,
                    'old280_canonical_four_vs_newaa1_current_four': True,
                    'eight_first_calls_and_sixteen_components_before_fresh_locks': True,
                    'full_immediate_composite_pool_FK_checked_before_first_call': True,
                    'all_existing_focused_fallback_English_missing_frame_and_RC_generation_cases_retained': True,
                    'full_original_five_body_config_data_catalogue_roles_cleanup_retained': True}


def project_entry():
    raw = (OLD / 'entry.mjs').read_bytes()
    need(sha(raw) == ENTRY_SHA)
    before = raw.decode()
    source = before.replace('presentation-generation-assignment-proof', 'presentation-generation-lock-acquisition-proof').replace('ASSIGNMENT_PROOF_', 'ACQUISITION_PROOF_')
    old = "assert.equal(ctx.bindings.candidateSha,'" + HELPER_BEFORE + "');"
    need(source.count(old) == 1)
    source = source.replace(old, "assert.equal(ctx.bindings.candidateSha,'" + HELPER_AFTER + "');", 1)
    old_scope = 'owned synthetic whole-generation8s and exact assignment/data/companion/security comparison: helper280 both sides, original four versus bounded-assignment candidate four; completed helper scopes carried only; no provider/production acceptance'
    new_scope = 'owned synthetic whole-generation8s: old280 with canonical four versus newaa1 with current four; fresh original12 locksets and RC authority; historical280 scopes dated only; no provider/production acceptance'
    need(source.count(old_scope) == 1)
    source = source.replace(old_scope, new_scope, 1)
    need(source.count(' const priorTiming=') == 1)
    source = source.replace(' const priorTiming=', " assert.equal(sha(ctx.bindings.baseSource),ctx.bindings.acquisitionCandidate.before_definition_sha256);assert.equal(sha(ctx.bindings.candidateSource),ctx.bindings.acquisitionCandidate.after_definition_sha256);\n const priorTiming=", 1)
    return source
