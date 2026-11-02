"""Finite, inverse-proved private callback projection. No SQL/Docker dispatch."""
from pathlib import Path
import hashlib
import json

HERE = Path(__file__).resolve().parent
OLD = HERE.parent / 'presentation-lock-source-proof'
BASE_SHA = '087df11fa717f72043c9782c8da7380ae8cda559221a0495582d1dcd01d22448'
FIXTURE_SHA = 'aa976e76fa2a69fd7ea2b8f6f90609c28f734b889b20c15fe8de8d50dc29d22d'
SIGNATURES = [
    'eps.review_snapshot_data(uuid,uuid,text)', 'eps.review_snapshot(uuid,uuid,text)',
    'public.eps_generate_version(uuid,jsonb,text)', 'eps.capture_presentation_video_transcripts(uuid)',
]
IDENTITY_SQL = "select jsonb_object_agg(n.nspname||'.'||p.proname,jsonb_build_object('source',encode(sha256(convert_to(replace(p.prosrc,E'\\r\\n',E'\\n'),'UTF8')),'hex'),'authority',to_jsonb(p)-'prosrc'))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.oid in(" + ','.join("'" + name + "'::regprocedure" for name in SIGNATURES) + ');'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('GENERATION_DATA_REUSE_PROOF_SOURCE_UNCONFIRMED')


def fixture(source):
    need(sha(source.encode()) == FIXTURE_SHA)
    before = "p.oid='eps.presentation_lock_sources(uuid,text,text)'::regprocedure"
    after = "p.oid in(" + ','.join("'" + name + "'::regprocedure" for name in ['eps.presentation_lock_sources(uuid,text,text)'] + SIGNATURES) + ')'
    need(source.count(before) == 1)
    result = source.replace(before, after)
    need(result.replace(after, before) == source)
    return result


def edits():
    old_url = OLD.as_uri() + '/'
    extra_imports = "\nimport { qualifySeed } from " + json.dumps((HERE.parent / 'presentation-lock-source-seed-proof/entry.mjs').as_uri()) + ';'
    extra_imports += "\nimport { qualifyScale,qualifyBackground } from " + json.dumps((HERE.parent / 'presentation-lock-source-dedupe-proof/entry.mjs').as_uri()) + ';'
    extra_imports += "\nimport { verifyDataReuseCases,assertDataReuseEquality } from " + json.dumps((HERE / 'cases.mjs').as_uri()) + ';'
    fixture_before = (OLD / 'fixture.sql').read_text(encoding='utf8').replace('\r\n', '\n')
    fixture_after = fixture(fixture_before)
    old_local = "const local=async file=>readFile(new URL('./'+file,import.meta.url),'utf8');"
    new_local = """const local=async file=>{
  const text=await readFile(new URL(file,REPLACE_URL),'utf8');
  if(file==='scale.sql')return qualifyScale(qualifySeed(text));
  if(file==='background.sql')return qualifyBackground(text);
  if(file==='fixture.sql'){assert.equal(sha(text),REPLACE_BEFORE);return REPLACE_AFTER;}
  return text;
 };""".replace('REPLACE_URL', json.dumps(old_url)).replace('REPLACE_BEFORE', json.dumps(FIXTURE_SHA)).replace('REPLACE_AFTER', json.dumps(fixture_after))
    old_install = "const install=async source=>ctx.sql('set session authorization postgres;'+source.replace('create function eps.presentation_lock_sources','create or replace function eps.presentation_lock_sources'));"
    new_install = """const originalBodyIdentity=await value(REPLACE_IDENTITY);
 const install=async(source,bodies=ctx.bindings.beforeBodies)=>{
  await ctx.sql('set session authorization postgres;'+source.replace('create function eps.presentation_lock_sources','create or replace function eps.presentation_lock_sources')+'\\n'+bodies.map(item=>item.sql).join('\\n'));
  const actual=await value(REPLACE_IDENTITY);
  const record={expected:bodies.map(item=>({name:item.name,source:item.sha})),actual,normal_return:true};ctx.report.data_reuse_body_installations.push(record);
  for(const item of bodies){assert.equal(actual[item.name].source,item.sha);assert.deepEqual(actual[item.name].authority,originalBodyIdentity[item.name].authority);}
 };""".replace('REPLACE_IDENTITY', json.dumps(IDENTITY_SQL))
    return [
        ("import { session } from './session.mjs';", 'import { session } from ' + json.dumps((OLD / 'session.mjs').as_uri()) + ';' + extra_imports),
        ("import { verifyHeld, verifyEdges } from './probes.mjs';", 'import { verifyHeld, verifyEdges } from ' + json.dumps((OLD / 'probes.mjs').as_uri()) + ';'),
        (old_local, new_local),
        (old_install, new_install),
        ('  sourceBefore=await value(', '  await install(ctx.bindings.baseSource);\n  sourceBefore=await value('),
        ("await install(variant==='old'?ctx.bindings.baseSource:ctx.bindings.candidateSource);", "await install(variant==='old'?ctx.bindings.baseSource:ctx.bindings.candidateSource,variant==='old'?ctx.bindings.beforeBodies:ctx.bindings.afterBodies);"),
        ('   security[variant]=[];', "   ctx.report.checkpoint='data-reuse-'+variant+'-focused-cases';\n   await verifyDataReuseCases({...ctx,holder,contender,observer,writer,profiles,acting,id,variant,value,baseline});\n   security[variant]=[];"),
        ('  assert.deepEqual(security.old,security.candidate);', '  assertDataReuseEquality(ctx.report.data_reuse_cases);\n  assert.deepEqual(security.old,security.candidate);'),
        ('  await install(ctx.bindings.baseSource);assert.deepEqual(await value(SNAPSHOT_SQL),baseline);', '  await install(ctx.bindings.originalLockSource);assert.deepEqual(await value(SNAPSHOT_SQL),baseline);'),
        ('old_function_restored:true,', 'old_function_restored:true,all_four_preceding_bodies_restored:true,baseline_is_lock1ff8_plus_preceding_four_bodies:true,source_data_reuse_only:true,'),
    ]


def project_source():
    raw = (OLD / 'proof.mjs').read_bytes()
    need(sha(raw) == BASE_SHA)
    text = raw.decode().replace('\r\n', '\n')
    for before, after in edits():
        need(text.count(before) == 1)
        text = text.replace(before, after)
    return text


def inverse_source(text):
    for before, after in reversed(edits()):
        need(text.count(after) == 1)
        text = text.replace(after, before)
    need(sha(text.encode()) == BASE_SHA)
    return text
