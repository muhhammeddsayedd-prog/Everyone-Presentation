"""Fresh disabled aa1 stage purpose over the frozen compiler; no dispatch."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-stage-diagnostic'
CANDIDATE = HERE.parent / 'presentation-lock-acquisition-reuse/candidate.py'
CANDIDATE_SHA = '961d9969a8646831c64d0f9e2f0960d7e7910cc1ddd29a558d2e7bd990f66ec6'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('ACQUISITION_STAGE_COMPILATION_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-acquisition-stage-diagnostic-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    projection = load('acquisition_stage_projection', HERE / 'projection.py')
    projection.frozen()
    old_relative = relative.replace('presentation-generation-acquisition-stage-diagnostic-compiled', 'presentation-generation-stage-diagnostic-compiled')
    source, old_callback, cases = load('acquisition_frozen_stage_compiler', OLD / 'compiler.py').compile_source(old_relative)
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, proof = projection.project_callback(ROOT / cases_relative)
    need(sha(CANDIDATE.read_bytes()) == CANDIDATE_SHA)
    candidate = load('acquisition_stage_helper', CANDIDATE)
    before, after = candidate.build()

    def replace(old, new):
        nonlocal source
        need(source.count(old) == 1)
        source = source.replace(old, new, 1)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for old, new in [
        ("'.local/presentation-generation-stage-diagnostic'", "'.local/presentation-generation-acquisition-stage-diagnostic'"),
        ("'tracking/evidence/m07/presentation-generation-stage-diagnostic'", "'tracking/evidence/m07/presentation-generation-acquisition-stage-diagnostic'"),
        ("'.local/presentation-generation-stage-diagnostic-once'", "'.local/presentation-generation-acquisition-stage-diagnostic-once'"),
        ("'eps.stagediag.run'", "'eps.acqstage.run'"),
        ("'eps.stagediag.workspace'", "'eps.acqstage.workspace'"),
        ("'eps.stagediag.purpose'", "'eps.acqstage.purpose'"),
        ("'single-current-candidate-fixed-stage-diagnostic'", "'single-aa1-current-four-fixed-stage-diagnostic'"),
        ("'eps-stagediag-'", "'eps-acqstage-'"),
        ("'presentation-generation-stage-owned-diagnostic'", "'presentation-generation-acquisition-stage-owned-diagnostic'"),
    ]:
        replace(old, new)
    need(source.count('label=eps.stagediag.run=') == 2)
    source = source.replace('label=eps.stagediag.run=', 'label=eps.acqstage.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    need(args['baseSource'] == before and args['candidateSource'] == before)
    need(args['candidateSha'] == candidate.BEFORE_BODY_SHA)
    args['candidateSource'] = after
    args['candidateSha'] = candidate.AFTER_BODY_SHA
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()),
                projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()),
                acquisitionStageProjection=proof,
                acquisitionStageHelper={'before_sha256': candidate.BEFORE_BODY_SHA, 'after_sha256': candidate.AFTER_BODY_SHA,
                                        'before_definition_sha256': sha(before.encode()), 'after_definition_sha256': sha(after.encode()),
                                        'source_sha256': CANDIDATE_SHA, 'only_business_function_delta_from_d958': True})
    source = source[:position] + json.dumps(args) + source[position + length:]
    replace(json.dumps(old_relative), json.dumps(relative))
    replace(json.dumps(old_callback_path), json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())), json.dumps(args['projectedCallbackSha']))
    replace(json.dumps(old_cases_path), json.dumps(args['projectedCases']))
    # The old cases bytes stay exact; only their fresh artifact path changes.
    need(sha(cases.encode()) == args['projectedCasesSha'])
    marker = 'report.source_seals = {}; for (const [root, file] of '
    begin = source.index(marker) + len(marker)
    end = source.index(') {\n      const bytes = await readFile', begin)
    records = json.loads(source[begin:end])
    for record in records:
        if record[1] == old_relative.replace('/controller-', '/callback-'):
            record[1] = callback_relative
        if record[1] == old_relative.replace('/controller-', '/cases-'):
            record[1] = cases_relative
    files = sorted(p for folder in [HERE, CANDIDATE.parent] for p in folder.iterdir()
                   if p.is_file() and p.suffix in ['.py', '.mjs', '.sql', '.md', '.json', '.diff'])
    records.extend([[str(ROOT).replace('\\', '/'), p.relative_to(ROOT).as_posix()] for p in files])
    source = source[:begin] + json.dumps(records) + source[end:]
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(p).replace('\\', '/')) + ')),' + json.dumps(sha(p.read_bytes())) + ');' for p in files)
    replace("assert(lockProof.EXECUTION_ENABLED,'STAGE_DIAG_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'ACQUISITION_STAGE_DIAG_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    relative = '.local/presentation-generation-acquisition-stage-diagnostic-compiled/controller-' + str(uuid.uuid4()) + '.mjs'
    controller, callback, cases = compile_source(relative)
    outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
