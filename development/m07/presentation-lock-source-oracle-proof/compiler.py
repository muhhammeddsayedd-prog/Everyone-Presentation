"""Pure finite compiler for fresh owned oracle proof; never dispatches tools."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-lock-source-pool-proof'
OLD_COMPILER_SHA = '1d09d0a6d76495b3f4b0b60602aff0a5811b57c254426eb5866c1f41f92f0026'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('ORACLE_PROOF_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-lock-source-oracle-proof-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    old_relative = relative.replace('presentation-lock-source-oracle-proof-compiled', 'presentation-lock-source-pool-proof-compiled')
    old_callback_relative = old_relative.replace('/controller-', '/callback-')
    need(sha((OLD / 'compiler.py').read_bytes()) == OLD_COMPILER_SHA)
    source, old_callback = module('oracle_frozen_compiler', OLD / 'compiler.py').compile_source(old_relative, old_callback_relative)
    projection = module('oracle_projection', HERE / 'source.py')
    cases = projection.project_cases()
    callback, _ = projection.project_callback(ROOT / cases_relative)
    slice_sql, _ = module('oracle_slice', HERE / 'oracle.py').build()

    def replace(before, after):
        nonlocal source
        need(source.count(before) == 1)
        source = source.replace(before, after)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for before, after in [
        ("'.local/presentation-lock-source-pool-proof'", "'.local/presentation-lock-source-oracle-proof'"),
        ("'tracking/evidence/m07/presentation-lock-source-pool-proof'", "'tracking/evidence/m07/presentation-lock-source-oracle-proof'"),
        ("'.local/presentation-lock-source-pool-proof-once'", "'.local/presentation-lock-source-oracle-proof-once'"),
        ("'eps.poolproof.run'", "'eps.oracleproof.run'"),
        ("'eps.poolproof.workspace'", "'eps.oracleproof.workspace'"),
        ("'eps.poolproof.purpose'", "'eps.oracleproof.purpose'"),
        ("'fenced-pool-id-reuse-cold-first-proof'", "'unchanged-helper-complete-partition-oracle-proof'"),
        ("'eps-poolproof-'", "'eps-oracleproof-'"),
        ("'presentation-lock-pool-owned-proof'", "'presentation-lock-oracle-owned-proof'"),
    ]:
        replace(before, after)
    need(source.count('label=eps.poolproof.run=') == 2)
    source = source.replace('label=eps.poolproof.run=', 'label=eps.oracleproof.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path = args['projectedCallback']
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()), projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()), oracleSliceSql=slice_sql)
    source = source[:position] + json.dumps(args) + source[position + length:]
    replace(json.dumps(old_relative), json.dumps(relative))
    replace(json.dumps(old_callback_path), json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())), json.dumps(args['projectedCallbackSha']))
    marker = 'report.source_seals = {}; for (const [root, file] of '
    begin = source.index(marker) + len(marker)
    end = source.index(') {\n      const bytes = await readFile', begin)
    records = json.loads(source[begin:end])
    for record in records:
        if record[1] == old_callback_relative:
            record[1] = callback_relative
    files = sorted(p for p in HERE.iterdir() if p.is_file() and p.suffix in ['.py', '.mjs', '.sql', '.md'])
    records.extend([[str(ROOT).replace('\\', '/'), p.relative_to(ROOT).as_posix()] for p in files])
    records.append([str(ROOT).replace('\\', '/'), cases_relative])
    source = source[:begin] + json.dumps(records) + source[end:]
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(p).replace('\\', '/')) + ')),' + json.dumps(sha(p.read_bytes())) + ');' for p in files)
    checks += '\n  assert.equal(sha(await readFile(' + json.dumps(args['projectedCases']) + ')),' + json.dumps(args['projectedCasesSha']) + ');'
    replace("assert(lockProof.EXECUTION_ENABLED,'POOL_PROOF_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'ORACLE_PROOF_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    token = str(uuid.uuid4())
    relative = '.local/presentation-lock-source-oracle-proof-compiled/controller-' + token + '.mjs'
    controller, callback, cases = compile_source(relative)
    outputs = []
    for name, text in [(relative.replace('/controller-', '/cases-'), cases), (relative.replace('/controller-', '/callback-'), callback), (relative, controller)]:
        file = ROOT / name
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': name, 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
