"""Compile only a fresh bounded-assignment combined purpose; never dispatch."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-combined-proof'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('ASSIGNMENT_PROOF_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-assignment-proof-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = relative.replace('presentation-generation-assignment-proof-compiled', 'presentation-generation-combined-proof-compiled')
    need(sha((OLD / 'compiler.py').read_bytes()) == 'fecec16554f6e4440fa7bb1106348f74bf13ba0f16781f403bc5cf7af98d5e07')
    source, old_callback, old_cases = module('assignment_frozen_combined_compiler', OLD / 'compiler.py').compile_source(old_relative)
    projection = module('assignment_proof_projection', HERE / 'source.py')
    cases, case_proof = projection.project_cases()
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, callback_proof = projection.project_callback(ROOT / cases_relative)
    candidate_file = HERE.parent / 'presentation-generation-assignment-reuse/candidate.py'
    need(sha(candidate_file.read_bytes()) == '0e62792bce8230a9b98bc11f387cf781ddf4095afaa09b37798331809d11c864')
    candidate = module('assignment_candidate_body', candidate_file).build()

    def replace(before, after):
        nonlocal source
        need(source.count(before) == 1)
        source = source.replace(before, after, 1)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for before, after in [
        ("'.local/presentation-generation-combined-proof'", "'.local/presentation-generation-assignment-proof'"),
        ("'tracking/evidence/m07/presentation-generation-combined-proof'", "'tracking/evidence/m07/presentation-generation-assignment-proof'"),
        ("'.local/presentation-generation-combined-proof-once'", "'.local/presentation-generation-assignment-proof-once'"),
        ("'eps.combinedproof.run'", "'eps.assignproof.run'"),
        ("'eps.combinedproof.workspace'", "'eps.assignproof.workspace'"),
        ("'eps.combinedproof.purpose'", "'eps.assignproof.purpose'"),
        ("'helper280-four-body-generation8s-preservation-proof'", "'helper280-bounded-assignment-generation8s-preservation-proof'"),
        ("'eps-combinedproof-'", "'eps-assignproof-'"),
        ("'presentation-generation-combined-owned-proof'", "'presentation-generation-assignment-owned-proof'"),
    ]:
        replace(before, after)
    need(source.count('label=eps.combinedproof.run=') == 2)
    source = source.replace('label=eps.combinedproof.run=', 'label=eps.assignproof.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    need(args['afterBodies'][0]['name'] == candidate['name'] and args['afterBodies'][0]['sha'] == candidate['before_body_sha256'])
    args['afterBodies'][0] = {'name': candidate['name'], 'sha': candidate['after_body_sha256'], 'sql': candidate['after'], 'definition_sha256': sha(candidate['after'].encode())}
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()), projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()), assignmentProjection=callback_proof, assignmentCasesProjection=case_proof, assignmentCandidate={k: v for k, v in candidate.items() if k not in ['before', 'after']})
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
    dependency = HERE.parent / 'presentation-generation-cancel-diagnostic/admit.mjs'
    need(sha(dependency.read_bytes()) == '505fab1894e93c96e5e651168f4ec0cff099e2849368901d7b278b0091e91528')
    files = sorted([p for folder in [HERE, candidate_file.parent] for p in folder.iterdir() if p.is_file() and p.suffix in ['.py', '.mjs', '.sql', '.md']] + [dependency])
    records.extend([[str(ROOT).replace('\\', '/'), p.relative_to(ROOT).as_posix()] for p in files])
    source = source[:begin] + json.dumps(records) + source[end:]
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(p).replace('\\', '/')) + ')),' + json.dumps(sha(p.read_bytes())) + ');' for p in files)
    replace("assert(lockProof.EXECUTION_ENABLED,'COMBINED_PROOF_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'ASSIGNMENT_PROOF_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    token = str(uuid.uuid4());relative = '.local/presentation-generation-assignment-proof-compiled/controller-' + token + '.mjs'
    controller, callback, cases = compile_source(relative);outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
