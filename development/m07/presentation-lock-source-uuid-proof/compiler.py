"""Fresh default-off proof; only pure pre-DB namespace qualification is added."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-lock-source-edge-rls-proof'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('UUID_PROOF_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-lock-source-uuid-proof-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = relative.replace('presentation-lock-source-uuid-proof-compiled', 'presentation-lock-source-edge-rls-proof-compiled')
    need(sha((OLD / 'compiler.py').read_bytes()) == '916bba555dd16a8254e6d3eb7b5bb007099ff42a26af6b3be4cda9803a58d882')
    source, old_callback, old_cases = module('uuid_frozen_compiler', OLD / 'compiler.py').compile_source(old_relative)
    projection = module('uuid_projection', HERE / 'source.py')
    cases, proof = projection.project_cases()
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, _ = projection.project_callback(ROOT / cases_relative)
    metadata = module('uuid_fixture_binding', HERE / 'fixture.py').build()

    def replace(before, after):
        nonlocal source
        need(source.count(before) == 1)
        source = source.replace(before, after)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()) + ';\nimport {qualifyRuntimeUUID}from ' + json.dumps((HERE / 'fixture.mjs').as_uri()))
    for before, after in [
        ("'.local/presentation-lock-source-edge-rls-proof'", "'.local/presentation-lock-source-uuid-proof'"),
        ("'tracking/evidence/m07/presentation-lock-source-edge-rls-proof'", "'tracking/evidence/m07/presentation-lock-source-uuid-proof'"),
        ("'.local/presentation-lock-source-edge-rls-proof-once'", "'.local/presentation-lock-source-uuid-proof-once'"),
        ("'eps.edgerls.run'", "'eps.uuidproof.run'"),
        ("'eps.edgerls.workspace'", "'eps.uuidproof.workspace'"),
        ("'eps.edgerls.purpose'", "'eps.uuidproof.purpose'"),
        ("'focused-asset-rls-counterfactual-and-remaining-RC-security'", "'pure-UUID-qualified-remaining-RC-security'"),
        ("'eps-edgerls-'", "'eps-uuidproof-'"),
        ("'presentation-lock-edge-rls-owned-proof'", "'presentation-lock-uuid-owned-proof'"),
    ]:
        replace(before, after)
    need(source.count('label=eps.edgerls.run=') == 2)
    source = source.replace('label=eps.edgerls.run=', 'label=eps.uuidproof.run=')
    a = '  const runId = randomUUID(), started = Date.now(), privateRoot = '
    b = '  const namespaceQualification = qualifyRuntimeUUID(randomUUID);\n  const runId = namespaceQualification.run_id, started = Date.now(), privateRoot = '
    replace(a, b)
    replace('  let port, before, lock, lockPath, outcome, db, privateReady = false, catalogueSql, dataSql;', '  report.fixture_uuid_qualification=namespaceQualification.evidence;\n  report.fixture_public_input_audit=' + json.dumps(metadata) + ';\n  let port, before, lock, lockPath, outcome, db, privateReady = false, catalogueSql, dataSql;')
    need(source.index('qualifyRuntimeUUID(randomUUID)') < source.index('await protect(dispatchRoot)') < source.index('port = await import('))
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()), projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()), uuidProjection=proof, fixtureUUIDMetadata=metadata)
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
    files = sorted(p for p in HERE.iterdir() if p.is_file() and p.suffix in ['.py', '.mjs', '.sql', '.md'])
    records.extend([[str(ROOT).replace('\\', '/'), p.relative_to(ROOT).as_posix()] for p in files])
    source = source[:begin] + json.dumps(records) + source[end:]
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(p).replace('\\', '/')) + ')),' + json.dumps(sha(p.read_bytes())) + ');' for p in files)
    replace("assert(lockProof.EXECUTION_ENABLED,'EDGE_RLS_PROOF_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'UUID_PROOF_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    token = str(uuid.uuid4())
    relative = '.local/presentation-lock-source-uuid-proof-compiled/controller-' + token + '.mjs'
    controller, callback, cases = compile_source(relative)
    outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
