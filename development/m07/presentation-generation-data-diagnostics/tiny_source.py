"""Cohort-only private callback projection; no SQL, process or runner dispatch."""
from pathlib import Path
import importlib.util
import hashlib

HERE = Path(__file__).resolve().parent
PREVIOUS = HERE.parent / 'presentation-generation-data-proof/proof_source.py'
PREVIOUS_SHA = '67cc13d0fed354e102eb769bf5d9712b07e1af1f434d2a3da8ede57333232c1c'


def need(ok):
    if not ok:
        raise ValueError('COHORT_DIAGNOSTIC_SOURCE_UNCONFIRMED')


def project_source():
    need(hashlib.sha256(PREVIOUS.read_bytes()).hexdigest() == PREVIOUS_SHA)
    spec = importlib.util.spec_from_file_location('frozen_full_data_proof_projection', PREVIOUS)
    prior = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prior)
    original = prior.project_source()
    begin = original.index('  const results={},security={},locks={},edges={},races={};')
    end = original.index(' }finally{for(const s of sessions)await s.finish();}', begin)
    removed = original[begin:end]
    replacement = """  const evidence=ctx.report.cohort_diagnostic={
   scope:'single original source-cohort observation, not performance or equality acceptance',
   same_fixture_recipe_and_counts_as_c7e4f2ef:true,
   exact_historical_c7e4f2ef_rowhash_equivalence_claimed:false,
   baseline_full_state:baseline,baseline_state_sha256:sha(JSON.stringify(baseline)),
   candidate_four_bodies_installed_or_executed:false,
   skipped_historical_measurement_cycles:32,skipped_focused_generation_cycles:6,skipped_association_cycles:6,
   before_actual_cohort:null,lock_measure:null,cohort_result:null
  };
  const p=profiles.large;
  ctx.report.checkpoint='cohort-diagnostic-lock-helper';
  await holder.request('begin;'+acting('mcp','eps_review_owner')+"set local statement_timeout='8s';set local lock_timeout='8s';");
  const helper=only(await holder.request(measure('locks',p)));evidence.lock_measure=helper;
  assert.equal(helper.ok,true,'COHORT_DIAGNOSTIC_HELPER_DID_NOT_COMPLETE');assert(helper.duration_ms<8000);
  const actor=only(await holder.request(`select jsonb_build_object('role',current_user,'actor_matches',auth.uid()=${literal(ACTOR)}::uuid,'claims_sha256',encode(sha256(convert_to(current_setting('request.jwt.claims'),'UTF8')),'hex'),'timeout',current_setting('statement_timeout'));`));
  evidence.actor=actor;assert.equal(actor.role,'eps_review_owner');assert.equal(actor.actor_matches,true);assert.equal(actor.timeout,'8s');
  const immediatelyBefore=await value(SNAPSHOT_SQL);evidence.before_actual_cohort=immediatelyBefore;
  assert.deepEqual(immediatelyBefore,baseline,'COHORT_DIAGNOSTIC_PREIMAGE_CHANGED');
  ctx.report.checkpoint='cohort-diagnostic-original-12-relation-read';
  const started=performance.now();
  const cohort=only(await holder.request(`select pg_temp.locksource41_cohorts(${literal(p.workspace)}::uuid,${literal(p.series)}::uuid);`));
  evidence.cohort_result={normal_return:true,duration_ms:performance.now()-started,source_rowset_sha256:sha(JSON.stringify(cohort)),relations:Array.isArray(cohort)?cohort.map(item=>({relation:item.relation,rows:item.keys.length})):null};
  assert(Array.isArray(cohort)&&cohort.length===12,'COHORT_DIAGNOSTIC_CLOSED_RESULT_REQUIRED');
  await holder.request('rollback;reset role;');
  const after=await value(SNAPSHOT_SQL);evidence.after_actual_cohort=after;assert.deepEqual(after,baseline,'COHORT_DIAGNOSTIC_POSTIMAGE_CHANGED');
  await install(ctx.bindings.originalLockSource);assert.deepEqual(await value(SNAPSHOT_SQL),baseline);
  evidence.original_lock_and_four_bodies_restored=true;
  evidence.full_fresh_rows_catalogue_reason_and_ready_preserved=true;
  ctx.report.diagnostic_completed=true;
"""
    result = original[:begin] + replacement + original[end:]
    need(result.replace(replacement, removed) == original)
    return result, {'removed_source_sha256': hashlib.sha256(removed.encode()).hexdigest(), 'inverse_byte_equal': True}
