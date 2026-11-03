"""Compile a new disabled single-call stage purpose; never dispatch SQL/Docker."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-assignment-proof'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('STAGE_DIAGNOSTIC_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-stage-diagnostic-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = relative.replace('presentation-generation-stage-diagnostic-compiled', 'presentation-generation-assignment-proof-compiled')
    need(sha((OLD / 'compiler.py').read_bytes()) == 'b8b1c3d57003371bb83cd8fedb0eb1b3803455bf51d75a51834cbc1a0608f620')
    source, old_callback, old_cases = module('stage_frozen_assignment_compiler', OLD / 'compiler.py').compile_source(old_relative)
    projection = module('stage_source_projection', HERE / 'source.py')
    cases = projection.project_cases()
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, projection_proof = projection.project_callback(ROOT / cases_relative)
    instrument = module('stage_finite_instrumentation', HERE / 'instrument.py')
    bodies = instrument.build();temporary, temporary_proof = instrument.temporary()

    def replace(before, after):
        nonlocal source
        need(source.count(before) == 1)
        source = source.replace(before, after, 1)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for before, after in [
        ("'.local/presentation-generation-assignment-proof'", "'.local/presentation-generation-stage-diagnostic'"),
        ("'tracking/evidence/m07/presentation-generation-assignment-proof'", "'tracking/evidence/m07/presentation-generation-stage-diagnostic'"),
        ("'.local/presentation-generation-assignment-proof-once'", "'.local/presentation-generation-stage-diagnostic-once'"),
        ("'eps.assignproof.run'", "'eps.stagediag.run'"),
        ("'eps.assignproof.workspace'", "'eps.stagediag.workspace'"),
        ("'eps.assignproof.purpose'", "'eps.stagediag.purpose'"),
        ("'helper280-bounded-assignment-generation8s-preservation-proof'", "'single-current-candidate-fixed-stage-diagnostic'"),
        ("'eps-assignproof-'", "'eps-stagediag-'"),
        ("'presentation-generation-assignment-owned-proof'", "'presentation-generation-stage-owned-diagnostic'"),
    ]:
        replace(before, after)
    need(source.count('label=eps.assignproof.run=') == 2)
    source = source.replace('label=eps.assignproof.run=', 'label=eps.stagediag.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    need([r['sha'] for r in args['afterBodies']] == [r['current_candidate_body_sha256'] for r in bodies])
    args['afterBodies'] = [{'name': r['name'], 'sha': r['after_body_sha256'], 'sql': r['after'], 'definition_sha256': sha(r['after'].encode())} for r in bodies]
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()), projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()), diagnosticTemporarySQL=temporary, diagnosticTemporaryProof=temporary_proof, diagnosticStageMap=instrument.stage_map(), stageProjection=projection_proof, stageInstrumentation=[{k: r[k] for k in ['name', 'current_candidate_body_sha256', 'after_body_sha256', 'instrumented', 'line_count_equal', 'business_SQL_inverse_byte_equal']} for r in bodies])
    source = source[:position] + json.dumps(args) + source[position + length:]
    replace(json.dumps(old_relative), json.dumps(relative))
    replace(json.dumps(old_callback_path), json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())), json.dumps(args['projectedCallbackSha']))
    replace(json.dumps(old_cases_path), json.dumps(args['projectedCases']))
    replace('assert.equal(sha(await readFile(' + json.dumps(args['projectedCases']) + ')),' + json.dumps(sha(old_cases.encode())) + ');', 'assert.equal(sha(await readFile(' + json.dumps(args['projectedCases']) + ')),' + json.dumps(args['projectedCasesSha']) + ');')
    marker = 'report.source_seals = {}; for (const [root, file] of '
    begin = source.index(marker) + len(marker)
    end = source.index(') {\n      const bytes = await readFile', begin)
    records = json.loads(source[begin:end])
    for record in records:
        if record[1] == old_relative.replace('/controller-', '/callback-'):
            record[1] = callback_relative
        if record[1] == old_relative.replace('/controller-', '/cases-'):
            record[1] = cases_relative
    dependencies = [(HERE.parent / 'presentation-generation-cancel-diagnostic/capture.mjs', 'a7486885e77493aee2c8bd7972512c6a3cc3c43bf399ad5318c321e19b811741'), (HERE.parent / 'presentation-generation-cancel-diagnostic/temporary.py', 'c1aac88ee826fd7827848fb188f367f1cac7a84a3c7fb12f9243ffb44fe5c9d7')]
    for file, expected in dependencies:
        need(sha(file.read_bytes()) == expected)
    files = sorted([p for p in HERE.iterdir() if p.is_file() and p.suffix in ['.py', '.mjs', '.md']] + [p for p, _ in dependencies])
    records.extend([[str(ROOT).replace('\\', '/'), p.relative_to(ROOT).as_posix()] for p in files])
    source = source[:begin] + json.dumps(records) + source[end:]
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(p).replace('\\', '/')) + ')),' + json.dumps(sha(p.read_bytes())) + ');' for p in files)
    replace("assert(lockProof.EXECUTION_ENABLED,'ASSIGNMENT_PROOF_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'STAGE_DIAG_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    token = str(uuid.uuid4());relative = '.local/presentation-generation-stage-diagnostic-compiled/controller-' + token + '.mjs'
    controller, callback, cases = compile_source(relative);outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
