"""Finite original-graph projection of the frozen one-call owned kernel."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
LIBRARY = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD = LIBRARY / 'development/m07/presentation-generation-raw-companion-first-proof'
NAMESPACE = HERE.name
STATS_REF = 'tracking/evidence/m07/completion-release/canonical-planner-stats-e2813947-7ccb-4f96-820b-6b156f3e8653.json'
STATS_SHA = '8df6f004e2cc99e92fa43962dcc6523c93324910548f9836ddf927094a37a27d'
PINS = {
    'compiler.py': 'b7c4c14ffee78038c7ee9727f161d0c51094bad43c8333db2ce3a95b970a2a7f',
    'entry.mjs': 'dce315c6530c2062090d3127e3d3451de9945a086dea63bacea8d14d5128e9e1',
    'projection.py': 'd2ec606e607878bf829f4bcda310179ffc92ef81c271e72397204be22f76d2b0',
    'README.md': '21250af156ce73892ab4a815a5f51456f79da71445cdc8b89337f4bb96ca1402',
    'run.mjs': 'd9afb794f80dfb8049ed427e2b4c3490f38fde4a4c21467d30b2d7b3f448fcf3',
    'run.test.mjs': 'd5c1f2d963b4ab97f0531db99d0cdf4cbe2b825aa5fd4343eb1eaa1b4a5ae2cd',
    'test_proof.py': '2a30e4302b6c99dd0f5d17fd685ae68240a50c3fcdd75413fe0ae5187279d16b',
}
TABLES = ['auth.sessions', 'eps.assignments', 'eps.candidate_media', 'eps.candidates',
          'eps.mcp_oauth_resources', 'eps.media_assets', 'eps.presentation_version_assets',
          'eps.presentation_versions', 'eps.presentation_video_english_transcripts',
          'eps.presentation_video_transcripts', 'eps.roles', 'eps.slots', 'eps.version_slides',
          'eps.workspace_candidates', 'eps.workspaces', 'public.app_capability_grants',
          'public.project_memberships', 'public.projects']
TARGETS = {
    'eps.presentation_lock_sources(uuid,text,text)': '4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7',
    'eps.review_snapshot_data(uuid,uuid,text)': '4d46151993a60d8c6ac9d36e48781fee34c12c3e1dede727ac1ed4d31a953ab7',
    'eps.review_snapshot(uuid,uuid,text)': 'f0815e014144f1345b4679d96114aab6b358d95df317e3cfe6ac6b59989813cb',
    'public.eps_generate_version(uuid,jsonb,text)': 'b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08',
    'eps.capture_presentation_video_transcripts(uuid)': 'ed4a3469971fa410078b546b13aa0a875b4867efdda4b134dc729563dd887187',
    'eps.capture_presentation_video_english_transcripts(uuid)': 'c68de52a4ede0ec6401aa05e0f40b5932905dd8dc8c1c72149c9f95c51a23aeb',
    'eps.mcp_token_permits_capability(text)': '5eb6c1272a78a4ca821569082c54d2b1ce434516585c8eac533c29ec1c445ccc',
    'public.eps_validate_own_oauth_session(text)': '9fe44accb3998d924bb0f453c721a33f5603f20e4c245abbf0e46807561891f6',
}
IDENTITY_SQL = "select jsonb_object_agg(n.nspname||'.'||p.proname,jsonb_build_object('source',encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in(" + ','.join("'" + name + "'::regprocedure" for name in TARGETS) + ');'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('PLANNER_STATS_SOURCE_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def frozen():
    for name, digest in PINS.items():
        file = OLD / name
        info = file.lstat()
        need(file.is_file() and not file.is_symlink() and info.st_nlink == 1 and sha(file.read_bytes()) == digest)
    load('stats_frozen_first_projection', OLD / 'projection.py').frozen()
    raw = (LIBRARY / STATS_REF).read_bytes()
    need(sha(raw) == STATS_SHA)
    receipt = json.loads(raw)
    need(receipt['result'] == 'passed' and receipt['normal_CLI_exit'] == 0)
    need({key: receipt['data']['settings'][key] for key in ('jit', 'plan_cache_mode', 'default_statistics_target')} ==
         {'jit': 'off', 'plan_cache_mode': 'auto', 'default_statistics_target': '100'})
    need([row['table'] for row in receipt['data']['tables']] == TABLES)


def project_cases():
    source = (HERE / 'run.mjs').read_text(encoding='utf8')
    return source.replace("'./observations.sql'", json.dumps((HERE / 'observations.sql').as_uri()))


def project_callback(cases_path):
    frozen()
    before, parent = load('stats_first_projection', OLD / 'projection.py').project_callback(cases_path)
    source = before
    edits = []

    def replace(old, new):
        nonlocal source
        need(source.count(old) == 1)
        edits.append((old, new))
        source = source.replace(old, new, 1)

    start = source.index(' const originalBodyIdentity=')
    end = source.index(' let baseline,sourceBefore;', start)
    replace(source[start:end], ' const canonicalIdentitySQL=' + json.dumps(IDENTITY_SQL) + ';\n const originalCanonicalIdentity=await value(canonicalIdentitySQL);\n for(const [name,hash]of Object.entries(ctx.bindings.canonicalTargets))assert.equal(originalCanonicalIdentity[name].source,hash);\n')
    mask_start = source.index("case when p.oid in(")
    mask_end = source.index("else array[]::text[]end", mask_start) + len("else array[]::text[]end")
    replace(source[mask_start:mask_end], 'array[]::text[]/*no product prosrc exclusions*/')
    replace('  await install(ctx.bindings.baseSource);\n', '')
    replace('assert.equal(sourceBefore.lock_source,ctx.bindings.baseSha);', "assert.equal(sourceBefore.lock_source,'4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7');")
    start = source.index('  ctx.report.generation_first_call={')
    end = source.index('  const startFreshGeneration=', start)
    replace(source[start:end], "  ctx.report.generation_first_call={scope_only:true,catalogue_prosrc_exclusions:0,instrumentation_cost_present:false,fresh_baseline:baseline,performance_or_release_acceptance:false};\n  assert.deepEqual(await value(canonicalIdentitySQL),originalCanonicalIdentity);\n  ctx.report.generation_first_call.canonical_graph_unchanged=true;\n")
    replace('  await install(ctx.bindings.originalLockSource,ctx.bindings.beforeBodies);', '  assert.deepEqual(await value(canonicalIdentitySQL),originalCanonicalIdentity);\n  ctx.report.generation_first_call.all_original_functions_unchanged=true;')
    replace('original4107_and_four_old_bodies_restored=true', 'original4107_canonical_six_and_validator_never_replaced=true')
    replace('  ctx.report.generation_first_call.pinbatch374_performance_failure_remains_open=true;', '  ctx.report.generation_first_call.no_prior_performance_result_carried=true;')
    # Remove unused race exports/imports; no executed fixture/control body changes.
    start = source.index('\nexport async function changedSourceRaces(')
    replace(source[start:], '')
    inverse = source
    for old, new in reversed(edits):
        if new:
            need(inverse.count(new) == 1)
            inverse = inverse.replace(new, old, 1)
        else:
            # Empty removals have explicit positional anchors in the retained text.
            if old.startswith('  await install(ctx.bindings.baseSource)'):
                anchor = '  sourceBefore=await value('
                need(inverse.count(anchor) == 1)
                inverse = inverse.replace(anchor, old + anchor, 1)
            else:
                inverse += old
    need(inverse == before)
    need('await install(' not in source and 'const install=' not in source)
    return source, {'inverse_byte_equal': True, 'frozen_one_call_kernel': parent,
                    'no_product_function_installed_or_replaced': True, 'catalogue_prosrc_exclusions': 0,
                    'original_4107_canonical_six_and_public_validator_full_identity': True,
                    'fixture_fit_and_all_outer_cleanup_unchanged': True}
