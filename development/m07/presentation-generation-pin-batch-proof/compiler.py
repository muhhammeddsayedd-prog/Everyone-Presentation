"""Compile only a fresh default-OFF pin-batch proof; never dispatch SQL/Docker."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-lock-acquisition-proof'
OLD_SHA = '93583dba4fb4ffcc08e5f18cdbff8661661586f2810d6c09fb708c739b5a82be'
CANDIDATE = HERE.parent / 'presentation-asset-pin-batch/candidate.py'
CANDIDATE_SHA = 'e6c41fb88f2d665c9b1b41982915339dc598f75dc2e90ff50e745ea63faa8d5a'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('PIN_BATCH_PROOF_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-pin-batch-proof-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = relative.replace('presentation-generation-pin-batch-proof-compiled', 'presentation-generation-lock-acquisition-proof-compiled')
    need(sha((OLD / 'compiler.py').read_bytes()) == OLD_SHA)
    source, old_callback, cases = module('pin_batch_frozen_full_compiler', OLD / 'compiler.py').compile_source(old_relative)
    projection = module('pin_batch_proof_projection', HERE / 'source.py')
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, proof = projection.project_callback(ROOT / cases_relative)
    need(sha(CANDIDATE.read_bytes()) == CANDIDATE_SHA)
    candidate = module('pin_batch_new_GEN', CANDIDATE).build()
    need((HERE / 'admit.mjs').read_bytes() == projection.project_admit().encode())

    def replace(old, new):
        nonlocal source
        need(source.count(old) == 1)
        source = source.replace(old, new, 1)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for old, new in [
        ("'.local/presentation-generation-lock-acquisition-proof'", "'.local/presentation-generation-pin-batch-proof'"),
        ("'tracking/evidence/m07/presentation-generation-lock-acquisition-proof'", "'tracking/evidence/m07/presentation-generation-pin-batch-proof'"),
        ("'.local/presentation-generation-lock-acquisition-proof-once'", "'.local/presentation-generation-pin-batch-proof-once'"),
        ("'eps.acqproof.run'", "'eps.pinbatch.run'"),
        ("'eps.acqproof.workspace'", "'eps.pinbatch.workspace'"),
        ("'eps.acqproof.purpose'", "'eps.pinbatch.purpose'"),
        ("'helper-aa1-generation8s-and-fresh-lock-security-proof'", "'aa1-single-pin-INSERT-generation8s-and-authority-proof'"),
        ("'eps-acqproof-'", "'eps-pinbatch-'"),
        ("'presentation-generation-lock-acquisition-owned-proof'", "'presentation-generation-pin-batch-owned-proof'"),
    ]:
        replace(old, new)
    need(source.count('label=eps.acqproof.run=') == 2)
    source = source.replace('label=eps.acqproof.run=', 'label=eps.pinbatch.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    need(args['afterBodies'][2]['name'] == candidate['name'] and args['afterBodies'][2]['sql'] == candidate['before'])
    need(args['afterBodies'][2]['sha'] == candidate['before_body_sha256'])
    args['afterBodies'][2] = {'name': candidate['name'], 'sha': candidate['after_body_sha256'], 'sql': candidate['after'], 'definition_sha256': candidate['after_definition_sha256']}
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()),
                projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()),
                pinBatchProjection=proof, pinBatchCandidate={k: v for k, v in candidate.items() if k not in ['before', 'after']})
    source = source[:position] + json.dumps(args) + source[position + length:]
    replace(json.dumps(old_relative), json.dumps(relative))
    replace(json.dumps(old_callback_path), json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())), json.dumps(args['projectedCallbackSha']))
    replace(json.dumps(old_cases_path), json.dumps(args['projectedCases']))
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
    replace("assert(lockProof.EXECUTION_ENABLED,'ACQUISITION_PROOF_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'PIN_BATCH_PROOF_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    relative = '.local/presentation-generation-pin-batch-proof-compiled/controller-' + str(uuid.uuid4()) + '.mjs'
    controller, callback, cases = compile_source(relative)
    outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
