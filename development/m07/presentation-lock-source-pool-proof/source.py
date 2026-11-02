"""Exact proven fixture prefix plus new cases; no old run/controller invocation."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
PRIOR = HERE.parent / 'presentation-generation-data-proof/proof_source.py'
PRIOR_SHA = '67cc13d0fed354e102eb769bf5d9712b07e1af1f434d2a3da8ede57333232c1c'


def project_source():
    if hashlib.sha256(PRIOR.read_bytes()).hexdigest() != PRIOR_SHA:
        raise ValueError('POOL_PROOF_PREFIX_SOURCE_UNCONFIRMED')
    spec = importlib.util.spec_from_file_location('pool_proof_frozen_prefix', PRIOR)
    prior = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prior)
    full = prior.project_source()
    before_import = 'import { verifyDataReuseCases,assertDataReuseEquality } from ' + json.dumps((PRIOR.parent / 'cases.mjs').as_uri()) + ';'
    after_import = 'import { runPoolCases } from ' + json.dumps((HERE / 'cases.mjs').as_uri()) + ';'
    if full.count(before_import) != 1:
        raise ValueError('POOL_PROOF_IMPORT_UNCONFIRMED')
    source = full.replace(before_import, after_import)
    # Restore the original1-field catalogue mask. The four data bodies stay old
    # and their complete pg_proc/source values must remain part of the baseline.
    fixture = (prior.OLD / 'fixture.sql').read_text(encoding='utf8').replace('\r\n', '\n')
    five_mask = prior.fixture(fixture)
    if source.count(json.dumps(five_mask)) != 1:
        raise ValueError('POOL_PROOF_CATALOGUE_MASK_UNCONFIRMED')
    source = source.replace(json.dumps(five_mask), json.dumps(fixture))
    begin = source.index('  const results={},security={},locks={},edges={},races={};')
    end = source.index(' }finally{for(const s of sessions)await s.finish();}', begin)
    removed = source[begin:end]
    restore_begin = source.index('  await ctx.sql("set session authorization postgres;update eps.presentation_processing_config')
    restore_end = source.index('\n', restore_begin)
    restore_config = source[restore_begin:restore_end]
    restore_identity = r"select jsonb_build_object('source',encode(sha256(convert_to(replace(prosrc,E'\r\n',E'\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc')from pg_proc p where oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure;"
    replacement = """  ctx.report.pool_helper_proof={candidate_four_bodies_executed:false,catalogue_prosrc_exclusions:1,fresh_baseline:baseline};
  await runPoolCases({...ctx,holder,contender,observer,writer,profiles,acting,id,value,baseline,start,install,sourceBefore});
  await install(ctx.bindings.originalLockSource);assert.deepEqual(await value(SNAPSHOT_SQL),baseline,'POOL_PROOF_FINAL_BASELINE_CHANGED');
  const restored=await value(RESTORE_IDENTITY);
  ctx.report.pool_helper_proof.restored_helper_source_sha256=restored.source;
  assert.equal(restored.source,ctx.bindings.originalLockSha);assert.deepEqual(restored.authority,sourceBefore.authority);
  ctx.report.pool_helper_proof.original_lock_and_four_preceding_bodies_restored=true;
  ctx.report.pool_helper_proof.full_fresh_data_catalogue_reason_ready_auth_preserved=true;
""".replace('RESTORE_IDENTITY', json.dumps(restore_identity)) + restore_config + "\n  ctx.report.pool_helper_proof.original_presentation_configuration_restored=true;\n"
    result = source[:begin] + replacement + source[end:]
    if result.replace(replacement, removed) != source:
        raise ValueError('POOL_PROOF_TAIL_INVERSE_UNCONFIRMED')
    return result, {'fixture_prefix_preserved': True, 'only_target_helper_prosrc_masked': True, 'removed_tail_sha256': hashlib.sha256(removed.encode()).hexdigest(), 'tail_inverse_byte_equal': True}
