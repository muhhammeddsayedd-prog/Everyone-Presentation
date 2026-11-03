"""Finite single-call projection: no NOTICE or exception-context instrumentation."""
from pathlib import Path
import hashlib
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-pin-batch-stage-diagnostic'
NAMESPACE = 'presentation-generation-raw-companion-first-proof'
PREVIOUS_NAMESPACE = OLD.name
RAW = HERE.parent / 'presentation-raw-companion-batch/candidate.py'
TEMP = HERE.parent / 'presentation-lock-source-proof/temporary.sql'
TEMP_SHA = '6c34eae348be361652b001cc1e14ea5e2d4bca16513eace77777592df924e33c'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('RAW_FIRST_SOURCE_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def frozen():
    plan = ROOT / 'tracking/evidence/m07/presentation-generation-pin-batch-stage-diagnostic/disabled-owned-plan.json'
    need(sha(plan.read_bytes()) == '913b6c7d943fc27a6fffe52f3c9b9e609d8208150603a8cc3c076ed885106c60')
    for name, digest in json.loads(plan.read_bytes())['source_sha256'].items():
        need(sha((ROOT / name).read_bytes()) == digest)
    load('raw_first_frozen_stage_projection', OLD / 'projection.py').frozen()
    need(sha(TEMP.read_bytes()) == TEMP_SHA)


def bodies():
    frozen()
    old = load('raw_first_old_instrument', HERE.parent / 'presentation-generation-stage-diagnostic/instrument.py')
    rows = old.build()
    pin = load('raw_first_pin_body', HERE.parent / 'presentation-asset-pin-batch/candidate.py').build()
    raw = load('raw_first_raw_body', RAW).build()
    for row in rows:
        if row['name'] == 'eps.review_snapshot_data':
            definition = load('raw_first_assignment_body', HERE.parent / 'presentation-generation-assignment-reuse/candidate.py').build()['after']
        elif row['name'] == 'public.eps_generate_version':
            definition = pin['after']
        elif row['name'] == 'eps.capture_presentation_video_transcripts':
            definition = raw['after']
        else:
            definition = row['after']
        match = load('raw_first_parts', RAW).parts(definition)
        row.update(after=definition, after_body_sha256=sha(match[2].encode()))
    need([r['after_body_sha256'] for r in rows] == ['0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd','c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10','41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5'])
    return rows


def project_cases():
    source = (HERE / 'run.mjs').read_text(encoding='utf8')
    for folder, name in [('presentation-lock-source-proof','proof.mjs'),('presentation-lock-source-pool-proof','native.mjs'),('presentation-lock-source-uuid-proof','fixture.mjs')]:
        old = "'../" + folder + '/' + name + "'"
        need(source.count(old) == 1)
        source = source.replace(old, json.dumps((HERE.parent / folder / name).as_uri()), 1)
    return source


def project_callback(cases_path):
    before, _ = load('raw_first_stage_callback', OLD / 'projection.py').project_callback(cases_path)
    source = before
    edits = [('generation_stage_diagnostic','generation_first_call'), ('instrumentation_cost_present:true','instrumentation_cost_present:false'),
             ('candidate_aa1_pinbatch_four_body_identity_verified=true','candidate_aa1_GEN41fe_rawf222_identity_verified=true'),
             ('  ctx.report.generation_first_call.instrumentation=ctx.bindings.stageInstrumentation;\n',''),
             ("'reset role;set client_min_messages=notice;'+ctx.bindings.diagnosticTemporarySQL", "'reset role;'+ctx.bindings.firstCallTemporarySQL")]
    counts = []
    for a, b in edits:
        count = source.count(a)
        need(count > 0 and (a == 'generation_stage_diagnostic' or count == 1))
        counts.append(count)
        source = source.replace(a, b)
    inverse = source
    for (a, b), count in reversed(list(zip(edits, counts))):
        if b:
            inverse = inverse.replace(b, a)
        else:
            anchor = '  const startFreshGeneration='
            need(inverse.count(anchor) == 1)
            inverse = inverse.replace(anchor, a + anchor, 1)
    need(inverse == before)
    return source, {'inverse_byte_equal': True, 'one_uninstrumented_first_call_only': True,
                    'all_fixture_FK_authority_and_restore_SQL_unchanged': True,
                    'NOTICE_and_context_SQL_not_installed': True, 'matrix_or_security_acceptance': False}


def project_entry():
    frozen()
    source = (OLD / 'entry.mjs').read_text(encoding='utf8').replace(PREVIOUS_NAMESPACE,NAMESPACE).replace('PIN_BATCH_STAGE_DIAG_','RAW_FIRST_')
    old = "import {admitCarry,freshCarry}from './admit.mjs';"
    need(source.count(old) == 1)
    source = source.replace(old,"import {admitCarry}from '../presentation-generation-pin-batch-stage-diagnostic/admit.mjs';\nimport {freshCarry}from './run.mjs';",1)
    for old, new in [('234cec65947a522b488c679cdc3eed9fec662394f80998626f31fba2d90dc72c','0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd'),('b3bc105e6fb7d14194b04db6dbb5e8bbaad8bad9fe237d276cbde751c112b2a3','41fe515f53fdc411b7fc2485c402d9d06241f8e23b7224aaaea3d5330544bf7d'),('afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7','f2229b303a83d7c9ca053e3c0f7e65ec3472b0cbe3b624aad4ff1a1e4af1c4d5')]:
        need(source.count(old) == 1)
        source = source.replace(old,new,1)
    start = source.index(' const custodyDiagnostic=async payload=>{')
    end = source.index(' const projected=await import(',start)
    source = source[:start] + source[end:]
    need(source.count('captureError,sessions,custodyDiagnostic,custodyPhase,') == 1)
    source = source.replace('captureError,sessions,custodyDiagnostic,custodyPhase,','captureError,sessions,',1)
    source = source.replace("import {Buffer}from 'node:buffer';\n",'',1)
    start = source.index(" ctx.report.scope='")
    end = source.index("';",start)+2
    source = source[:start] + " ctx.report.scope='one uninstrumented first MCP-large8s feasibility call only; normal SQL measurement and full rollback/restore; no matrix/semantics/security/performance/provider/production acceptance';" + source[end:]
    return source
