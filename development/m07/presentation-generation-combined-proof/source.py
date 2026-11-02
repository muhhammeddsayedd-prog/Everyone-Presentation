"""Finite frozen fixture prefix + focused combined tail; never dispatch tools."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-data-proof'
SOURCE_SHA = '67cc13d0fed354e102eb769bf5d9712b07e1af1f434d2a3da8ede57333232c1c'
FOCUS_SHA = 'aeb5972c0ba19ab8ae8dcdb9a1292af69b1d026df10eafff233a437e151cd239'
FOCUS_SQL_SHA = '052770e2f3267a9036adeebf3c790fa104d2bb621251bd03266a1d07644faa2c'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('COMBINED_SOURCE_PROJECTION_UNCONFIRMED')


def original():
    need(sha((OLD / 'proof_source.py').read_bytes()) == SOURCE_SHA)
    spec = importlib.util.spec_from_file_location('combined_frozen_data_source', OLD / 'proof_source.py')
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def project_cases():
    raw = (OLD / 'cases.mjs').read_bytes()
    need(sha(raw) == FOCUS_SHA)
    before = raw.decode()
    helpers = (OLD / 'cases.sql').read_text(encoding='utf8')
    need(sha(helpers.encode()) == FOCUS_SQL_SHA and helpers.count('create function pg_temp.') == 2)
    edits = [
        ("from '../presentation-lock-source-proof/proof.mjs';", 'from ' + json.dumps((HERE.parent / 'presentation-lock-source-proof/proof.mjs').as_uri()) + ';\nimport {observePending}from ' + json.dumps((HERE.parent / 'presentation-lock-source-pool-proof/cases.mjs').as_uri()) + ';'),
        ("new URL('./cases.sql',import.meta.url)", 'new URL(' + json.dumps((OLD / 'cases.sql').as_uri()) + ')'),
        ("const pending=contender.request(metric('review',profiles.control));", "const pending=observePending(contender.request(metric('review',profiles.control)));"),
        ("await holder.request('reset role;'+helpers);", "assert.equal(sha(helpers),'" + FOCUS_SQL_SHA + "');assert.equal(helpers.split('create function pg_temp.').length,3);await holder.request('reset role;'+helpers.replaceAll('create function pg_temp.','create or replace function pg_temp.'));"),
        ("  assert.deepEqual(record.pins.english_states,expectedEnglish);", "  assert.deepEqual(record.pins.english_states,expectedEnglish);\n  record.manifest=only(await holder.request(`select pg_temp.combined_manifest_projection(${literal(result.resource_id)}::uuid);`));\n  for(const key of['stored_snapshot_hash_valid','stored_manifest_hash_valid','stored_inventory_hash_valid'])assert.equal(record.manifest[key],true);"),
        ('assert.deepEqual(before.projection,after.projection);assert.deepEqual(before.pins,after.pins);', 'assert.deepEqual(before.projection,after.projection);assert.deepEqual(before.pins,after.pins);assert.deepEqual(before.manifest,after.manifest);'),
    ]
    source = before
    for a, b in edits:
        need(source.count(a) == 1)
        source = source.replace(a, b)
    inverse = source
    for a, b in reversed(edits):
        need(inverse.count(b) == 1)
        inverse = inverse.replace(b, a)
    need(inverse.encode() == raw)
    return source, {'inverse_byte_equal': True, 'frozen_focused_cases_sha256': FOCUS_SHA, 'two_temp_CREATE_markers_only_become_CREATE_OR_REPLACE': True, 'adds_actual_persisted_manifest_hash_observer': True, 'immediate_original_Promise_observation': True, 'all_six_generation_six_association_four_English_budget_expiry_original_predicates_unchanged': True}


def project_callback(cases_path):
    before = original().project_source()
    source = before
    edits = []

    def replace(a, b):
        nonlocal source
        need(source.count(a) == 1)
        source = source.replace(a, b)
        edits.append((a, b))

    a = 'import { verifyDataReuseCases,assertDataReuseEquality } from ' + json.dumps((OLD / 'cases.mjs').as_uri()) + ';'
    b = 'import { verifyDataReuseCases,assertDataReuseEquality } from ' + json.dumps(cases_path.as_uri()) + ';\nimport {firstWholeGenerations,projectionEqualities,missingFrameEquality}from ' + json.dumps((HERE / 'cases.mjs').as_uri()) + ';\nimport {observePending}from ' + json.dumps((HERE.parent / 'presentation-lock-source-pool-proof/cases.mjs').as_uri()) + ';'
    replace(a, b)
    # Both are unchanged actual request Promises; observe immediately before
    # polling, then keep the original later await and identical rejection.
    for a in [
        "const pending=contender.request(measure('generate',p,p.meta.input,'locksource41-'+ctx.runId+'-'+variant+'-race-'+change));",
        "const pending=contender.request(measure('locks',p));",
    ]:
        replace(a, a.replace('=contender.request(', '=observePending(contender.request(')[:-1] + ');')
    begin = source.index('  const results={},security={},locks={},edges={},races={};')
    end = source.index(' }finally{for(const s of sessions)await s.finish();}', begin)
    removed = source[begin:end]
    permission_begin = removed.index('   security[variant]=[];')
    permission_end = removed.index('   const context=', permission_begin)
    permissions = removed[permission_begin:permission_end]
    restore_begin = removed.index('  await ctx.sql("set session authorization postgres;update eps.presentation_processing_config')
    restore_end = removed.index('\n', restore_begin)
    restore = removed[restore_begin:restore_end]
    identity = "select jsonb_build_object('source',encode(sha256(convert_to(replace(prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc')from pg_proc p where oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure;"
    tail = """  ctx.report.combined_generation={catalogue_prosrc_exclusions:5,helper_variant_same_both_sides:true,fresh_baseline:baseline,first_calls:[],projections:[]};
  ctx.report.combined_generation.carried_helper_security=ctx.admitFreshCarry({...ctx,baseline,profiles,acting,id,value});
  ctx.report.data_reuse_cases={};
  const focusedSQL=await readFile(new URL(FOCUSED_SQL_URL),'utf8');assert.equal(sha(focusedSQL),FOCUSED_SQL_SHA);
  await holder.request('reset role;'+ctx.bindings.combinedObservationsSQL);
  const installVariant=async variant=>{
   assert(['old','candidate'].includes(variant));
   await install(ctx.bindings.candidateSource,variant==='old'?ctx.bindings.beforeBodies:ctx.bindings.afterBodies);
   const actual=await value(HELPER_IDENTITY);
   const record={variant,source_sha256:actual.source,authority_unchanged:JSON.stringify(actual.authority)===JSON.stringify(sourceBefore.authority)};
   (ctx.report.combined_generation.helper_installations??=[]).push(record);
   assert.equal(actual.source,'280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4');assert.equal(record.authority_unchanged,true);
  };
  const startFreshGeneration=async tag=>{const s=await start(tag);await s.request('reset role;'+temporary+focusedSQL+ctx.bindings.combinedObservationsSQL);return s;};
  const combined={...ctx,profiles,acting,id,value,baseline,installVariant,startFreshGeneration};
  await firstWholeGenerations(combined);
  await projectionEqualities(combined);
  await missingFrameEquality(combined);
  const security={},races={};Object.assign(ctx.report.combined_generation,{security,races});
  for(const variant of['old','candidate']){
   await installVariant(variant);
   ctx.report.checkpoint='combined-'+variant+'-focused-cases';
   await verifyDataReuseCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline});
PERMISSIONS
   const context={...ctx,holder,contender,observer,writer,workspace:profiles.large.workspace,series:profiles.large.series,profiles,acting,id,variant:variant==='candidate'?'new':'old',value,raceEvidence:races[variant]=[]};
   ctx.report.checkpoint='combined-'+variant+'-source-and-generation-races';await changedSourceRaces(context);
   assert.deepEqual(await value(SNAPSHOT_SQL),baseline,'COMBINED_FULL_BASELINE_CHANGED');
  }
  assertDataReuseEquality(ctx.report.data_reuse_cases);assert.deepEqual(security.old,security.candidate);
  await install(ctx.bindings.originalLockSource,ctx.bindings.beforeBodies);
  assert.deepEqual(await value(SNAPSHOT_SQL),baseline,'COMBINED_FINAL_BASELINE_CHANGED');
  const restored=await value(HELPER_IDENTITY);assert.equal(restored.source,'4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7');assert.deepEqual(restored.authority,sourceBefore.authority);
  ctx.report.combined_generation.original4107_and_all_four_old_bodies_restored=true;
CONFIG_RESTORE
  ctx.report.combined_generation.original_presentation_config_restored=true;
  ctx.report.combined_generation.full_data_reason_Ready_catalogue_authority_preserved=true;
  ctx.report.combined_generation.all_new_whole_generation_8s_and_data_equalities_completed=true;
""".replace('FOCUSED_SQL_URL', json.dumps((OLD / 'cases.sql').as_uri())).replace('FOCUSED_SQL_SHA', json.dumps(FOCUS_SQL_SHA)).replace('HELPER_IDENTITY', json.dumps(identity)).replace('PERMISSIONS', permissions.rstrip()).replace('CONFIG_RESTORE', restore)
    replace(removed, tail)
    inverse = source
    for a, b in reversed(edits):
        need(inverse.count(b) == 1)
        inverse = inverse.replace(b, a)
    need(inverse == before)
    need('await verifyHeld(context)' not in source and 'await verifyEdges(context)' not in source)
    return source, {'inverse_byte_equal': True, 'removed_old_matrix_oracle_tail_sha256': sha(removed.encode()), 'same_exact_frozen_fixture_prefix_five_prosrc_mask': True, 'same280_helper_old_four_vs_new_four': True, 'no_broad_cohort_or_RLS_edge_replay': True, 'permission_negative_loop_byte_preserved': True, 'three_pending_requests_observed_immediately_without_replacing_original': True}


def project_entry():
    old = HERE.parent / 'presentation-lock-source-uuid-proof/entry.mjs'
    raw = old.read_text(encoding='utf8')
    need(sha(raw.encode()) == 'a92a26d668fff088277bd9bab2e49ddbf241279546cb5af0d68622d6a027e875')
    source = raw.replace('presentation-lock-source-uuid-proof', 'presentation-generation-combined-proof').replace('UUID_PROOF_', 'COMBINED_PROOF_')
    a = " assert.deepEqual(ctx.bindings.beforeBodies.map(x=>x.sha),BEFORE);assert.deepEqual(ctx.bindings.afterBodies,ctx.bindings.beforeBodies);"
    after = ['4b37255bd919719086175f5df2b197584555f3c08000ee13fe18a7dbe62f8cc3', 'c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10', 'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40', 'afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7']
    b = ' assert.deepEqual(ctx.bindings.beforeBodies.map(x=>x.sha),BEFORE);assert.deepEqual(ctx.bindings.afterBodies.map(x=>x.sha),' + json.dumps(after) + ');\n for(const key of[\'beforeBodies\',\'afterBodies\'])for(const item of ctx.bindings[key])assert.equal(sha(item.sql),item.definition_sha256);'
    need(source.count(a) == 1)
    source = source.replace(a, b)
    source = source.replace("assert.equal(ctx.bindings.baseSha,'1ff8ce429ec61785c1e1037da8de5d2a4b9426789074a64eab0f6f89241c48e4');", "assert.equal(ctx.bindings.baseSha,'280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4');")
    a = 'canonical-public-UUID-qualified fixture namespace; dated393 and278 completed scopes carried only; fresh unchangedRC workspace-fence/membership/capability/expiry plus restoration; no generation/provider/production acceptance'
    b = 'owned synthetic whole-generation8s and exact data/companion/security comparison: helper280 on both sides, four old versus four candidate bodies; completed helper scopes carried only; no provider/production acceptance'
    need(source.count(a) == 1)
    return source.replace(a, b)
