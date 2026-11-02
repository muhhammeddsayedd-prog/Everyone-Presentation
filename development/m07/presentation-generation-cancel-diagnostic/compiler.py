"""Compile a new disabled diagnostic purpose; never execute Docker or SQL."""
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
        raise ValueError('CANCEL_DIAGNOSTIC_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-cancel-diagnostic-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = relative.replace('presentation-generation-cancel-diagnostic-compiled', 'presentation-generation-combined-proof-compiled')
    need(sha((OLD / 'compiler.py').read_bytes()) == 'fecec16554f6e4440fa7bb1106348f74bf13ba0f16781f403bc5cf7af98d5e07')
    source, old_callback, old_cases = module('cancel_frozen_combined_compiler', OLD / 'compiler.py').compile_source(old_relative)
    projection = module('cancel_diagnostic_projection', HERE / 'source.py')
    cases = projection.project_cases()
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, proof = projection.project_callback(ROOT / cases_relative)
    temporary = module('cancel_temporary_SQL', HERE / 'temporary.py')
    sql, sql_proof = temporary.build();stages = temporary.stage_map()

    def replace(before, after):
        nonlocal source
        need(source.count(before) == 1)
        source = source.replace(before, after)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for before, after in [
        ("'.local/presentation-generation-combined-proof'", "'.local/presentation-generation-cancel-diagnostic'"),
        ("'tracking/evidence/m07/presentation-generation-combined-proof'", "'tracking/evidence/m07/presentation-generation-cancel-diagnostic'"),
        ("'.local/presentation-generation-combined-proof-once'", "'.local/presentation-generation-cancel-diagnostic-once'"),
        ("'eps.combinedproof.run'", "'eps.gendiag.run'"),
        ("'eps.combinedproof.workspace'", "'eps.gendiag.workspace'"),
        ("'eps.combinedproof.purpose'", "'eps.gendiag.purpose'"),
        ("'helper280-four-body-generation8s-preservation-proof'", "'single-candidate-MCP-cancellation-context-diagnostic'"),
        ("'eps-combinedproof-'", "'eps-gendiag-'"),
        ("'presentation-generation-combined-owned-proof'", "'presentation-generation-cancel-owned-diagnostic'"),
    ]:
        replace(before, after)
    need(source.count('label=eps.combinedproof.run=') == 2)
    source = source.replace('label=eps.combinedproof.run=', 'label=eps.gendiag.run=')
    pos = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[pos:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()), projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()), diagnosticTemporarySQL=sql, diagnosticTemporaryProof=sql_proof, diagnosticStageMap=stages, diagnosticProjection=proof)
    source = source[:pos] + json.dumps(args) + source[pos + length:]
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
    replace("assert(lockProof.EXECUTION_ENABLED,'COMBINED_PROOF_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'CANCEL_DIAG_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    token = str(uuid.uuid4());relative = '.local/presentation-generation-cancel-diagnostic-compiled/controller-' + token + '.mjs'
    controller, callback, cases = compile_source(relative);outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
