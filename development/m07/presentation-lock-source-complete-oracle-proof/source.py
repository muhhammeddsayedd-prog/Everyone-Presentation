"""Finite inverse projection; only isolated validation gains PK partitions/RR."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'presentation-lock-source-oracle-proof'
OLD_SOURCE_SHA = 'f548ca56b05555e956d64fc80ed1b309f27bac97f0ff3868c64d9c6e2dbbb43b'
OLD_ENTRY_SHA = 'f2797bb3b824d2f14d949691f35f81769057e06ae77059d2c3ea1adcd2021504'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('COMPLETE_ORACLE_PROJECTION_UNCONFIRMED')


def original():
    need(sha((OLD / 'source.py').read_bytes()) == OLD_SOURCE_SHA)
    spec = importlib.util.spec_from_file_location('complete_oracle_frozen_projection', OLD / 'source.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def project_cases():
    before = original().project_cases()
    start = before.index('async function tuples(')
    end = before.index('async function probe(', start)
    tuples = before[start:end]
    replacement = "async function tuples(ctx,s,workspace,mustInclude=null,mustContainFrame=null){return semanticTuples(ctx,s,workspace,mustInclude,mustContainFrame);}\n\n"
    edits = [
        (json.dumps((OLD / 'oracle.mjs').as_uri()), json.dumps((HERE / 'oracle.mjs').as_uri()) + ';\nimport {semanticTuples}from ' + json.dumps((HERE / 'semantic.mjs').as_uri())),
        (tuples, replacement),
        ("  await holder.request('begin;'+ctx.acting('api')+'reset role;');", "  await holder.request('begin isolation level repeatable read;'+ctx.acting('api')+'reset role;');"),
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
    # These actual helper/permission race transactions remain original RC.
    need(source.count("const begin=(ctx,mode='mcp',role='eps_review_owner',extra={})=>'begin;'") == 1)
    need(source.count('begin isolation level repeatable read;') == 1)
    return source, {'prior_projected_cases_sha256': sha(before.encode()), 'removed_broad_tuple_function_sha256': sha(tuples.encode()), 'inverse_byte_equal': True, 'only_semantic_holder_RR': True, 'actual_helper_fence_authority_races_RC_unchanged': True}


def project_callback(cases_path):
    return original().project_callback(cases_path)


def normalized_entry(text):
    pattern = r'^export const EXECUTION_ENABLED=(?:false|true);$'
    need(len(re.findall(pattern, text, re.M)) == 1)
    return re.sub(pattern, 'export const EXECUTION_ENABLED=false;', text, flags=re.M)


def project_entry():
    old = normalized_entry((OLD / 'entry.mjs').read_text(encoding='utf8'))
    need(sha(old.encode()) == OLD_ENTRY_SHA)
    source = old.replace('presentation-lock-source-oracle-proof', 'presentation-lock-source-complete-oracle-proof')
    source = source.replace("from './admit.mjs'", "from '../presentation-lock-source-oracle-proof/admit.mjs'")
    source = source.replace('ORACLE_PROOF_', 'COMPLETE_ORACLE_PROOF_')
    scope = 'isolated unchanged280 helper remaining semantics/security; complete key-partition original oracle; retained c2 timing only; no generation/provider/production acceptance'
    need(source.count(scope) == 1)
    source = source.replace(scope, 'isolated all12 complete-PK oracle and RR semantic validation; actual helper/fence/live-authority races unchangedRC8s; retained c2 timing only; no generation/provider/production acceptance')
    return source


if __name__ == '__main__':
    file = HERE / 'entry.mjs'
    with file.open('x', encoding='utf8', newline='\n') as stream:
        stream.write(project_entry())
    print(json.dumps({'source_only_entry': str(file), 'sha256': sha(file.read_bytes()), 'execution_enabled': False}))
