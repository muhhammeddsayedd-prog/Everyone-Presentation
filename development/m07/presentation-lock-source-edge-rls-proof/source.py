"""Finite continuation: replace only the disputed semantic call; RC stays exact."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'presentation-lock-source-complete-oracle-proof'
OLD_SOURCE_SHA = 'd5a2767b9a779ddfec7800ad175d6b555715d4071193daeb8c33fbbb27b740a8'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('EDGE_RLS_PROJECTION_UNCONFIRMED')


def original():
    need(sha((OLD / 'source.py').read_bytes()) == OLD_SOURCE_SHA)
    spec = importlib.util.spec_from_file_location('edge_frozen_complete_source', OLD / 'source.py')
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def project_cases():
    before, _ = original().project_cases()
    edits = [
        ("import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport {edgeCounterfactual}from " + json.dumps((HERE / 'edge.mjs').as_uri()) + ';'),
        (' await semanticCases(ctx);', ' ctx.report.pool_helper_proof.carried_evidence=ctx.admitFreshCarry(ctx);\n await edgeCounterfactual(ctx);'),
        ("await s.request('reset role;'+cohorts+ctx.bindings.measureSql+ctx.bindings.oracleSql);", "await s.request('reset role;'+cohorts+ctx.bindings.measureSql+ctx.bindings.oracleSql+ctx.bindings.edgeSql);"),
    ]
    source = before
    for a, b in edits:
        need(source.count(a) == 1)
        source = source.replace(a, b)
    inverse = source
    for a, b in reversed(edits):
        need(inverse.count(b) == 1)
        inverse = inverse.replace(b, a)
    need(inverse == before)
    unchanged = {}
    for name in ['crossWorkspaceKeys', 'workspaceFenceRace', 'authorityCases']:
        pattern = r'async function ' + name + r'\(ctx\)\{.*?(?=\n(?:async|export) )'
        a = re.search(pattern, before, re.S)[0]
        need(a == re.search(pattern, source, re.S)[0])
        unchanged[name] = sha(a.encode())
    return source, {'inverse_byte_equal': True, 'replaced_only_semantic_invocation_and_added_point_helpers': True, 'unchanged_RC_function_sha256': unchanged, 'all12_and_benchmark_not_replayed': True}


def project_callback(file):
    return original().project_callback(file)


def project_entry():
    raw = (OLD / 'entry.mjs').read_text(encoding='utf8')
    need(sha(raw.encode()) == '98b7c5d2f2f5b6d80450396474d59ba3d710cd83c79e35c9a65916a92fbb4b3a')
    source = raw.replace('presentation-lock-source-complete-oracle-proof', 'presentation-lock-source-edge-rls-proof').replace('COMPLETE_ORACLE_PROOF_', 'EDGE_RLS_PROOF_')
    source = source.replace("export const EXECUTION_ENABLED=false;", "import {admitCarry,freshCarry}from './admit.mjs';\nexport const EXECUTION_ENABLED=false;")
    source = source.replace(' const priorTiming=admitTiming(await readFile(path.join(ctx.root,PRIOR_PATH)));', ' const priorTiming=admitTiming(await readFile(path.join(ctx.root,PRIOR_PATH)));\n const carried=await admitCarry(ctx.root);')
    source = source.replace('await projected.runCases({...ctx,priorTiming,captureError,sessions,', 'await projected.runCases({...ctx,priorTiming,captureError,sessions,admitFreshCarry:fresh=>freshCarry(fresh,carried),')
    scope = 'isolated all12 complete-PK oracle and RR semantic validation; actual helper/fence/live-authority races unchangedRC8s; retained c2 timing only; no generation/provider/production acceptance'
    need(source.count(scope) == 1)
    source = source.replace(scope, 'focused same-holder asset RLS oldWHERE/newIDs counterfactual; dated393 partial all12/150+8 and first3RR cases; fresh unchangedRC fence/live-authority/expiry; no generation/provider/production acceptance')
    return source
