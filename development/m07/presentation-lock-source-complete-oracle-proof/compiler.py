"""Fresh default-off complete validation purpose; compilation never dispatches."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-lock-source-oracle-proof'
OLD_COMPILER_SHA = 'df51881c7b29d5442e1fdd018c4e0dac929b4a17d9d2c834735184b9e4ec391f'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('COMPLETE_ORACLE_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-lock-source-complete-oracle-proof-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = relative.replace('presentation-lock-source-complete-oracle-proof-compiled', 'presentation-lock-source-oracle-proof-compiled')
    need(sha((OLD / 'compiler.py').read_bytes()) == OLD_COMPILER_SHA)
    source, old_callback, old_cases = module('complete_oracle_frozen_compiler', OLD / 'compiler.py').compile_source(old_relative)
    projection = module('complete_oracle_projection', HERE / 'source.py')
    cases, projection_metadata = projection.project_cases()
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, _ = projection.project_callback(ROOT / cases_relative)
    oracle_sql, oracle_metadata = module('complete_oracle_builder', HERE / 'oracle.py').build()
    semantic_sql, semantic_metadata = module('complete_semantic_builder', HERE / 'semantic.py').build()

    def replace(before, after):
        nonlocal source
        need(source.count(before) == 1)
        source = source.replace(before, after)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for before, after in [
        ("'.local/presentation-lock-source-oracle-proof'", "'.local/presentation-lock-source-complete-oracle-proof'"),
        ("'tracking/evidence/m07/presentation-lock-source-oracle-proof'", "'tracking/evidence/m07/presentation-lock-source-complete-oracle-proof'"),
        ("'.local/presentation-lock-source-oracle-proof-once'", "'.local/presentation-lock-source-complete-oracle-proof-once'"),
        ("'eps.oracleproof.run'", "'eps.completeoracle.run'"),
        ("'eps.oracleproof.workspace'", "'eps.completeoracle.workspace'"),
        ("'eps.oracleproof.purpose'", "'eps.completeoracle.purpose'"),
        ("'unchanged-helper-complete-partition-oracle-proof'", "'all-twelve-and-semantic-complete-pk-validation'"),
        ("'eps-oracleproof-'", "'eps-completeoracle-'"),
        ("'presentation-lock-oracle-owned-proof'", "'presentation-lock-complete-oracle-owned-proof'"),
    ]:
        replace(before, after)
    need(source.count('label=eps.oracleproof.run=') == 2)
    source = source.replace('label=eps.oracleproof.run=', 'label=eps.completeoracle.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    args.update(projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()), projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()), completeOracleSql=oracle_sql, completeSemanticSql=semantic_sql, completeValidationMetadata={'oracle': oracle_metadata, 'semantic': semantic_metadata, 'projection': projection_metadata})
    source = source[:position] + json.dumps(args) + source[position + length:]
    replace(json.dumps(old_relative), json.dumps(relative))
    replace(json.dumps(old_callback_path), json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())), json.dumps(args['projectedCallbackSha']))
    replace(json.dumps(old_cases_path), json.dumps(args['projectedCases']))
    # The prior hash is also retained inside inverse-projection metadata. Update
    # only the one explicit private-artifact check, never that historical seal.
    old_cases_check = 'assert.equal(sha(await readFile(' + json.dumps(args['projectedCases']) + ')),' + json.dumps(sha(old_cases.encode())) + ');'
    new_cases_check = 'assert.equal(sha(await readFile(' + json.dumps(args['projectedCases']) + ')),' + json.dumps(args['projectedCasesSha']) + ');'
    replace(old_cases_check, new_cases_check)
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
    replace("assert(lockProof.EXECUTION_ENABLED,'ORACLE_PROOF_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'COMPLETE_ORACLE_PROOF_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    token = str(uuid.uuid4())
    relative = '.local/presentation-lock-source-complete-oracle-proof-compiled/controller-' + token + '.mjs'
    controller, callback, cases = compile_source(relative)
    results = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        results.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': results}))
