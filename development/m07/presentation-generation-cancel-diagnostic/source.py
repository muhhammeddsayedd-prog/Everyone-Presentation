"""Finite prefix reuse; one diagnostic replaces the combined matrix/focus tail."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'presentation-generation-combined-proof'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def project_cases():
    raw = (HERE / 'run.mjs').read_text(encoding='utf8')
    edits = [("from '../presentation-lock-source-proof/proof.mjs'", 'from ' + json.dumps((HERE.parent / 'presentation-lock-source-proof/proof.mjs').as_uri())), ("from '../presentation-lock-source-pool-proof/native.mjs'", 'from ' + json.dumps((HERE.parent / 'presentation-lock-source-pool-proof/native.mjs').as_uri())), ("from './capture.mjs'", 'from ' + json.dumps((HERE / 'capture.mjs').as_uri()))]
    source = raw
    for a, b in edits:
        assert source.count(a) == 1;source = source.replace(a, b)
    inverse = source
    for a, b in reversed(edits):
        assert inverse.count(b) == 1;inverse = inverse.replace(b, a)
    assert inverse == raw
    return source


def project_callback(cases_path):
    assert sha((OLD / 'source.py').read_bytes()) == '9ff14004b0ba0cc097ecafae1bbdec813e30d8c3ea0e59b0c269a52e6d915189'
    original = load('diagnostic_frozen_combined_source', OLD / 'source.py')
    before, _ = original.project_callback(cases_path)
    imported = 'import { verifyDataReuseCases,assertDataReuseEquality } from ' + json.dumps(cases_path.as_uri()) + ';'
    replacement = 'import {runDiagnostic}from ' + json.dumps(cases_path.as_uri()) + ';'
    assert before.count(imported) == 1
    source = before.replace(imported, replacement)
    begin = source.index('  ctx.report.combined_generation={catalogue_prosrc_exclusions:5,')
    end = source.index(' }finally{for(const s of sessions)await s.finish();}', begin)
    removed = source[begin:end]
    identity = "select jsonb_build_object('source',encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc')from pg_proc p where oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure;"
    config_begin = removed.index('  await ctx.sql("set session authorization postgres;update eps.presentation_processing_config')
    config = removed[config_begin:removed.index('\n', config_begin)]
    tail = """  ctx.report.generation_cancel_diagnostic={scope_only:true,catalogue_prosrc_exclusions:5,candidate_body_code_and_RLS_unchanged_from78:true,functionstats_enabled:false,fresh_baseline:baseline};
  ctx.report.generation_cancel_diagnostic.carried_helper_security=ctx.admitFreshCarry({...ctx,baseline,profiles,acting,id,value});
  await install(ctx.bindings.candidateSource,ctx.bindings.afterBodies);
  const installed=await value(IDENTITY);assert.equal(installed.source,ctx.bindings.candidateSha);assert.deepEqual(installed.authority,sourceBefore.authority);
  ctx.report.generation_cancel_diagnostic.candidate_helper_and_four_body_identity_verified=true;
  const startFreshGeneration=async tag=>{const s=await start(tag);await s.request('reset role;'+ctx.bindings.diagnosticTemporarySQL);return s;};
  await runDiagnostic({...ctx,profiles,acting,id,value,baseline,startFreshGeneration});
  await install(ctx.bindings.originalLockSource,ctx.bindings.beforeBodies);
  assert.deepEqual(await value(SNAPSHOT_SQL),baseline,'DIAG_FINAL_BASELINE_CHANGED');
  const restored=await value(IDENTITY);assert.equal(restored.source,'4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7');assert.deepEqual(restored.authority,sourceBefore.authority);
  ctx.report.generation_cancel_diagnostic.original4107_and_four_old_bodies_restored=true;
CONFIG
  ctx.report.generation_cancel_diagnostic.original_config_and_full_baseline_restored=true;
  ctx.report.generation_cancel_diagnostic.performance_or_release_acceptance=false;
""".replace('IDENTITY', json.dumps(identity)).replace('CONFIG', config)
    result = source[:begin] + tail + source[end:]
    assert result.replace(tail, removed).replace(replacement, imported) == before
    return result, {'inverse_byte_equal': True, 'same_fixture_prefix_280_four_candidate_bodies': True, 'removed_matrix_tail_sha256': sha(removed.encode()), 'exactly_one_fresh_MCP_large_public_generation': True, 'no_matrix_focus_or_warming_replay': True}


def project_entry():
    raw = (OLD / 'entry.mjs').read_text(encoding='utf8')
    assert sha(raw.encode()) == '8dca5891b9f2e832f94c8ebc206377f159fd234441a4721d0e812f3055f51e88'
    source = raw.replace('presentation-generation-combined-proof', 'presentation-generation-cancel-diagnostic').replace('COMBINED_PROOF_', 'CANCEL_DIAG_')
    # The raw native cancellation is a private file, never report fields.
    old = " const projected=await import(pathToFileURL(ctx.bindings.projectedCallback).href);"
    new = """ const custodyDiagnostic=async payload=>{
  const basename='query-canceled-private.json',encoded=JSON.stringify(payload);
  await writeFile(path.join(privateRoot,basename),encoded,{flag:'wx',mode:0o600});
  return{private_file:basename,sha256:sha(encoded),normal_return:true};
 };
 const projected=await import(pathToFileURL(ctx.bindings.projectedCallback).href);"""
    assert source.count(old) == 1
    source = source.replace(old, new)
    assert source.count('captureError,sessions,admitFreshCarry:') == 1
    source = source.replace('captureError,sessions,admitFreshCarry:', 'captureError,sessions,custodyDiagnostic,admitFreshCarry:')
    a = 'owned synthetic whole-generation8s and exact data/companion/security comparison: helper280 on both sides, four old versus four candidate bodies; completed helper scopes carried only; no provider/production acceptance'
    b = 'single owned fresh MCP large query-cancellation diagnostic; same280/fourcandidate/fixture/8s; private context then closed projection; no performance/provider/production acceptance'
    assert source.count(a) == 1
    return source.replace(a, b)
