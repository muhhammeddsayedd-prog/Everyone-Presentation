"""Finite old-purpose library projection; no controller or SQL dispatch."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'presentation-lock-source-pool-proof'
CASES_SHA = '2832ee76211ed1a2494adad26b1d17fc90adae6e600b943232b6bc170a4e9dc5'
SOURCE_SHA = '7c2e36912fa4e989d7ef8dc86e30168d51aaa386982193e6bdde988649525378'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('ORACLE_PROOF_SOURCE_UNCONFIRMED')


def edits():
    return [
        ("from '../presentation-lock-source-proof/proof.mjs';", 'from ' + json.dumps((HERE.parent / 'presentation-lock-source-proof/proof.mjs').as_uri()) + ';'),
        ("from './native.mjs';", 'from ' + json.dumps((OLD / 'native.mjs').as_uri()) + ';\nimport {prepareOracle,readOracle}from ' + json.dumps((HERE / 'oracle.mjs').as_uri()) + ';'),
        ("new URL('../presentation-lock-source-proof/cohorts.sql',import.meta.url)", 'new URL(' + json.dumps((HERE.parent / 'presentation-lock-source-proof/cohorts.sql').as_uri()) + ')'),
        ("  await oracle.request('begin isolation level repeatable read read only;'+ctx.acting('mcp')+\"set local statement_timeout='8s';set local lock_timeout='8s';\");", '  await prepareOracle(ctx,oracle,record);'),
        ("keys=only(await oracle.request(`select pg_temp.pool_proof_cohort(${literal(relation)},${literal(ctx.profiles.large.workspace)}::uuid,${literal(ctx.profiles.large.series)}::uuid);`));", 'keys=await readOracle(ctx,oracle,relation,record);'),
        (' await firstAndWarm(ctx);', " await ctx.installHelper('new');\n ctx.report.pool_helper_proof.prior_timing_evidence=ctx.priorTiming;\n ctx.report.pool_helper_proof.fresh_timing_matrix_executed=false;"),
        (' ctx.report.pool_helper_proof.first_calls_and_planned_warm_completed=true;', ' ctx.report.pool_helper_proof.remaining_semantics_and_security_completed=true;'),
    ]


def project_cases():
    raw = (OLD / 'cases.mjs').read_bytes()
    need(sha(raw) == CASES_SHA)
    source = raw.decode()
    for before, after in edits():
        need(source.count(before) == 1)
        source = source.replace(before, after)
    inverse = source
    for before, after in reversed(edits()):
        need(inverse.count(after) == 1)
        inverse = inverse.replace(after, before)
    need(inverse.encode() == raw)
    return source


def project_callback(cases_path):
    need(sha((OLD / 'source.py').read_bytes()) == SOURCE_SHA)
    spec = importlib.util.spec_from_file_location('oracle_proof_frozen_source', OLD / 'source.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    source, metadata = module.project_source()
    before = 'import { runPoolCases } from ' + json.dumps((OLD / 'cases.mjs').as_uri()) + ';'
    after = 'import { runPoolCases } from ' + json.dumps(cases_path.as_uri()) + ';'
    need(source.count(before) == 1)
    result = source.replace(before, after)
    need(result.replace(after, before) == source)
    return result, metadata
