"""Default-off fresh combined proof compiler; no SQL/Docker/provider dispatch."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-lock-source-uuid-proof'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('COMBINED_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-combined-proof-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = relative.replace('presentation-generation-combined-proof-compiled', 'presentation-lock-source-uuid-proof-compiled')
    need(sha((OLD / 'compiler.py').read_bytes()) == '274f23c2d45d7d65f9b80d52979aebe481f731bc44de1520d74a55acf6b511a5')
    source, old_callback, old_cases = module('combined_frozen_compiler', OLD / 'compiler.py').compile_source(old_relative)
    projection = module('combined_projection', HERE / 'source.py')
    cases, focus_metadata = projection.project_cases()
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, projection_metadata = projection.project_callback(ROOT / cases_relative)
    build_file = HERE.parent / 'presentation-generation-data-reuse/build.py'
    need(sha(build_file.read_bytes()) == 'cda17a14ead6d7ee8aa225d04b5026c9998e5fc67efbaf3472bb108e6e3fadbd')
    bodies = module('combined_four_body_builder', build_file).build()

    def replace(before, after):
        nonlocal source
        need(source.count(before) == 1)
        source = source.replace(before, after)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for before, after in [
        ("'.local/presentation-lock-source-uuid-proof'", "'.local/presentation-generation-combined-proof'"),
        ("'tracking/evidence/m07/presentation-lock-source-uuid-proof'", "'tracking/evidence/m07/presentation-generation-combined-proof'"),
        ("'.local/presentation-lock-source-uuid-proof-once'", "'.local/presentation-generation-combined-proof-once'"),
        ("'eps.uuidproof.run'", "'eps.combinedproof.run'"),
        ("'eps.uuidproof.workspace'", "'eps.combinedproof.workspace'"),
        ("'eps.uuidproof.purpose'", "'eps.combinedproof.purpose'"),
        ("'pure-UUID-qualified-remaining-RC-security'", "'helper280-four-body-generation8s-preservation-proof'"),
        ("'eps-uuidproof-'", "'eps-combinedproof-'"),
        ("'presentation-lock-uuid-owned-proof'", "'presentation-generation-combined-owned-proof'"),
    ]:
        replace(before, after)
    need(source.count('label=eps.uuidproof.run=') == 2)
    source = source.replace('label=eps.uuidproof.run=', 'label=eps.combinedproof.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    need([x['sha'] for x in args['beforeBodies']] == [x['before_body_sha256'] for x in bodies])
    need([x['sql'] for x in args['beforeBodies']] == [x['before'] for x in bodies])
    args['baseSource'] = args['candidateSource'];args['baseSha'] = args['candidateSha']
    args['afterBodies'] = [{'name': x['name'], 'sha': x['after_body_sha256'], 'sql': x['after'], 'definition_sha256': sha(x['after'].encode())} for x in bodies]
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()), projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()), combinedObservationsSQL=(HERE / 'observations.sql').read_text(encoding='utf8'), combinedProjection=projection_metadata, combinedFocusedProjection=focus_metadata)
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
    replace("assert(lockProof.EXECUTION_ENABLED,'UUID_PROOF_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'COMBINED_PROOF_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    token = str(uuid.uuid4())
    relative = '.local/presentation-generation-combined-proof-compiled/controller-' + token + '.mjs'
    controller, callback, cases = compile_source(relative)
    outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
