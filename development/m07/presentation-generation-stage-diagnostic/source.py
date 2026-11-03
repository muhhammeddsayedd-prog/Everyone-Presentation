"""Single-call projection of the frozen assignment proof, with private traces."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-assignment-proof'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('STAGE_DIAGNOSTIC_SOURCE_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def project_cases():
    before = (HERE / 'run.mjs').read_text(encoding='utf8')
    source = before
    edits = [("from '../presentation-lock-source-proof/proof.mjs'", 'from ' + json.dumps((HERE.parent / 'presentation-lock-source-proof/proof.mjs').as_uri())),
             ("from '../presentation-lock-source-pool-proof/native.mjs'", 'from ' + json.dumps((HERE.parent / 'presentation-lock-source-pool-proof/native.mjs').as_uri())),
             ("from '../presentation-generation-cancel-diagnostic/capture.mjs'", 'from ' + json.dumps((HERE.parent / 'presentation-generation-cancel-diagnostic/capture.mjs').as_uri())),
             ("from './markers.mjs'", 'from ' + json.dumps((HERE / 'markers.mjs').as_uri()))]
    for a, b in edits:
        need(source.count(a) == 1)
        source = source.replace(a, b, 1)
    inverse = source
    for a, b in reversed(edits):
        need(inverse.count(b) == 1)
        inverse = inverse.replace(b, a, 1)
    need(inverse == before)
    return source


def project_callback(cases_path):
    need(sha((OLD / 'source.py').read_bytes()) == '0e4e467dc4cf0574664c62413438dc5122a8cb62e947ff906d81cd1bb44a18a6')
    original = load('stage_frozen_assignment_projection', OLD / 'source.py')
    before, _ = original.project_callback(cases_path)
    imported = 'import { verifyDataReuseCases,assertDataReuseEquality } from ' + json.dumps(cases_path.as_uri()) + ';'
    replacement = 'import {runDiagnostic}from ' + json.dumps(cases_path.as_uri()) + ';'
    need(before.count(imported) == 1)
    source = before.replace(imported, replacement, 1)
    old_session = json.dumps((HERE.parent / 'presentation-lock-source-proof/session.mjs').as_uri())
    new_session = json.dumps((HERE / 'session.mjs').as_uri())
    need(source.count(old_session) == 1)
    source = source.replace(old_session, new_session, 1)
    begin = source.index('  ctx.report.combined_generation={catalogue_prosrc_exclusions:5,')
    end = source.index(' }finally{for(const s of sessions)await s.finish();}', begin)
    removed = source[begin:end]
    config_start = removed.index('  await ctx.sql("set session authorization postgres;update eps.presentation_processing_config')
    config = removed[config_start:removed.index('\n', config_start)]
    fk_start = removed.index('  const assignmentFK=await value(')
    fk_end = removed.index('\n', removed.index('  ctx.report.assignment_enumeration.actual_FK=', fk_start))
    fk = removed[fk_start:fk_end].replace('ctx.report.assignment_enumeration.actual_FK', 'ctx.report.generation_stage_diagnostic.actual_FK')
    identity = "select jsonb_build_object('source',encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc')from pg_proc p where oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure;"
    tail = """  ctx.report.generation_stage_diagnostic={scope_only:true,catalogue_prosrc_exclusions:5,instrumentation_cost_present:true,functionstats_enabled:false,fresh_baseline:baseline,performance_or_release_acceptance:false};
  ctx.report.generation_stage_diagnostic.carried_helper_security=ctx.admitFreshCarry({...ctx,baseline,profiles,acting,id,value});
FK
  await install(ctx.bindings.candidateSource,ctx.bindings.afterBodies);
  const installed=await value(IDENTITY);assert.equal(installed.source,ctx.bindings.candidateSha);assert.deepEqual(installed.authority,sourceBefore.authority);
  ctx.report.generation_stage_diagnostic.helper280_four_body_identity_verified=true;
  ctx.report.generation_stage_diagnostic.instrumentation=ctx.bindings.stageInstrumentation;
  const startFreshGeneration=async tag=>{const s=await start(tag);await s.request('reset role;set client_min_messages=notice;'+ctx.bindings.diagnosticTemporarySQL);return s;};
  await runDiagnostic({...ctx,profiles,acting,id,value,baseline,startFreshGeneration});
  await install(ctx.bindings.originalLockSource,ctx.bindings.beforeBodies);
  assert.deepEqual(await value(SNAPSHOT_SQL),baseline,'STAGE_DIAG_FINAL_BASELINE_CHANGED');
  const restored=await value(IDENTITY);assert.equal(restored.source,'4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7');assert.deepEqual(restored.authority,sourceBefore.authority);
  ctx.report.generation_stage_diagnostic.original4107_and_four_old_bodies_restored=true;
CONFIG
  ctx.report.generation_stage_diagnostic.original_config_and_full_baseline_restored=true;
  ctx.report.generation_stage_diagnostic.d093_performance_failure_remains_open=true;
""".replace('IDENTITY', json.dumps(identity)).replace('\nCONFIG\n', '\n' + config + '\n').replace('\nFK\n', '\n' + fk + '\n')
    need(tail.count(config) == 1 and tail.count(fk) == 1)
    result = source[:begin] + tail + source[end:]
    inverse = result.replace(tail, removed, 1).replace(new_session, old_session, 1).replace(replacement, imported, 1)
    need(inverse == before)
    return result, {'inverse_byte_equal': True, 'frozen_assignment_prefix_and_actual_FK_guard_preserved': True,
                    'removed_combined_tail_sha256': sha(removed.encode()),
                    'single_fresh_MCP_large_call_only': True, 'matrix_components_focus_and_warming_replayed': False,
                    'only_session_transport_change_passive_strict_stage_getter': True,
                    'only_new_session_setting_client_min_messages_notice': True}


def project_entry():
    raw = (OLD / 'entry.mjs').read_bytes()
    need(sha(raw) == '8b9c0afe4080b6673fbb19303dc19655ef9bf4c4c1d4069bb6e2567554372785')
    source = raw.decode().replace('presentation-generation-assignment-proof', 'presentation-generation-stage-diagnostic').replace('ASSIGNMENT_PROOF_', 'STAGE_DIAG_')
    instrument = load('stage_entry_body_seals', HERE / 'instrument.py')
    for record in instrument.build():
        if record['instrumented']:
            before, after = record['current_candidate_body_sha256'], record['after_body_sha256']
            need(source.count(before) == 1)
            source = source.replace(before, after, 1)
    old = ' const projected=await import(pathToFileURL(ctx.bindings.projectedCallback).href);'
    new = """ const custodyDiagnostic=async payload=>{
  const basename='query-canceled-private.json',encoded=JSON.stringify(payload);assert(Buffer.byteLength(encoded)<=2*1024**2);
  await writeFile(path.join(privateRoot,basename),encoded,{flag:'wx',mode:0o600});return{private_file:basename,sha256:sha(encoded),normal_return:true};
 };
 const custodyPhase=async payload=>{
  const basename='phase-markers-private.json',encoded=JSON.stringify(payload);assert(Buffer.byteLength(encoded)<=16*1024);
  await writeFile(path.join(privateRoot,basename),encoded,{flag:'wx',mode:0o600});return{private_file:basename,sha256:sha(encoded),normal_return:true};
 };
 const projected=await import(pathToFileURL(ctx.bindings.projectedCallback).href);"""
    need(source.count(old) == 1)
    source = source.replace(old, new, 1)
    need(source.count('captureError,sessions,admitFreshCarry:') == 1)
    source = source.replace('captureError,sessions,admitFreshCarry:', 'captureError,sessions,custodyDiagnostic,custodyPhase,admitFreshCarry:', 1)
    source = source.replace("import assert from 'node:assert/strict';", "import assert from 'node:assert/strict';\nimport {Buffer}from 'node:buffer';", 1)
    old_scope = 'owned synthetic whole-generation8s and exact assignment/data/companion/security comparison: helper280 both sides, original four versus bounded-assignment candidate four; completed helper scopes carried only; no provider/production acceptance'
    need(source.count(old_scope) == 1)
    return source.replace(old_scope, 'one owned current-candidate MCP-large8s stage diagnostic: fixed bounded NOTICE records and private57014 stack; instrumentation cost present, no performance/provider/production acceptance', 1)
