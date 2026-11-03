"""Compile only a fresh helper-acquisition purpose. Never dispatch a controller."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-assignment-proof'
OLD_SHA = 'b8b1c3d57003371bb83cd8fedb0eb1b3803455bf51d75a51834cbc1a0608f620'
CANDIDATE = HERE.parent / 'presentation-lock-acquisition-reuse/candidate.py'
CANDIDATE_SHA = '961d9969a8646831c64d0f9e2f0960d7e7910cc1ddd29a558d2e7bd990f66ec6'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('ACQUISITION_PROOF_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-lock-acquisition-proof-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = relative.replace('presentation-generation-lock-acquisition-proof-compiled', 'presentation-generation-assignment-proof-compiled')
    need(sha((OLD / 'compiler.py').read_bytes()) == OLD_SHA)
    source, old_callback, old_cases = module('acquisition_frozen_assignment_compiler', OLD / 'compiler.py').compile_source(old_relative)
    projection = module('acquisition_proof_projection', HERE / 'source.py')
    cases, cases_proof = projection.project_cases()
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, callback_proof = projection.project_callback(ROOT / cases_relative)
    need(sha(CANDIDATE.read_bytes()) == CANDIDATE_SHA)
    candidate = module('acquisition_helper_body', CANDIDATE)
    before, after = candidate.build()
    security, security_proof = projection.project_security()
    need((HERE / 'security.mjs').read_bytes() == security.encode())

    def replace(old, new):
        nonlocal source
        need(source.count(old) == 1)
        source = source.replace(old, new, 1)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for old, new in [
        ("'.local/presentation-generation-assignment-proof'", "'.local/presentation-generation-lock-acquisition-proof'"),
        ("'tracking/evidence/m07/presentation-generation-assignment-proof'", "'tracking/evidence/m07/presentation-generation-lock-acquisition-proof'"),
        ("'.local/presentation-generation-assignment-proof-once'", "'.local/presentation-generation-lock-acquisition-proof-once'"),
        ("'eps.assignproof.run'", "'eps.acqproof.run'"),
        ("'eps.assignproof.workspace'", "'eps.acqproof.workspace'"),
        ("'eps.assignproof.purpose'", "'eps.acqproof.purpose'"),
        ("'helper280-bounded-assignment-generation8s-preservation-proof'", "'helper-aa1-generation8s-and-fresh-lock-security-proof'"),
        ("'eps-assignproof-'", "'eps-acqproof-'"),
        ("'presentation-generation-assignment-owned-proof'", "'presentation-generation-lock-acquisition-owned-proof'"),
    ]:
        replace(old, new)
    need(source.count('label=eps.assignproof.run=') == 2)
    source = source.replace('label=eps.assignproof.run=', 'label=eps.acqproof.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    need(args['baseSource'] == before and args['candidateSource'] == before)
    need(args['baseSha'] == candidate.BEFORE_BODY_SHA and args['candidateSha'] == candidate.BEFORE_BODY_SHA)
    need([x['sha'] for x in args['afterBodies']] == [
        '0dba1d407199191d3bbb4d84ddab94d9f4e33da6a0172738b86133e8c7bf61fd',
        'c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10',
        'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40',
        'afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7'])
    args['candidateSource'] = after
    args['candidateSha'] = candidate.AFTER_BODY_SHA
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()),
                projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()),
                acquisitionProjection=callback_proof, acquisitionCasesProjection=cases_proof, acquisitionSecurityProjection=security_proof,
                acquisitionCandidate={'before_body_sha256': candidate.BEFORE_BODY_SHA, 'after_body_sha256': candidate.AFTER_BODY_SHA,
                                      'before_definition_sha256': sha(before.encode()), 'after_definition_sha256': sha(after.encode()),
                                      'source_sha256': CANDIDATE_SHA, 'four_finite_inverse_patches': [x[0] for x in candidate.PATCHES]})
    source = source[:position] + json.dumps(args) + source[position + length:]
    replace(json.dumps(old_relative), json.dumps(relative))
    replace(json.dumps(old_callback_path), json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())), json.dumps(args['projectedCallbackSha']))
    replace(json.dumps(old_cases_path), json.dumps(args['projectedCases']))
    replace('assert.equal(sha(await readFile(' + json.dumps(args['projectedCases']) + ')),' + json.dumps(sha(old_cases.encode())) + ');',
            'assert.equal(sha(await readFile(' + json.dumps(args['projectedCases']) + ')),' + json.dumps(args['projectedCasesSha']) + ');')
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
    replace("assert(lockProof.EXECUTION_ENABLED,'ASSIGNMENT_PROOF_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'ACQUISITION_PROOF_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    token = str(uuid.uuid4())
    relative = '.local/presentation-generation-lock-acquisition-proof-compiled/controller-' + token + '.mjs'
    controller, callback, cases = compile_source(relative)
    outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
