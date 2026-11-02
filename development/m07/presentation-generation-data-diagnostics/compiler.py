"""Fresh default-off cohort diagnosis bundle, reusing the pinned owned bootstrap."""
from pathlib import Path
import importlib.util
import hashlib
import json
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-data-proof'
OLD_COMPILER_SHA = '6ec01de30d7a3c73adf911d53c70ed69b44ca4e82360fc511265b77c8f3e6815'
OLD_ENTRY_SHA = '18177115fc20a6810d90af4dfda7a12ced022f883dba6db4cf070474414a5283'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('COHORT_DIAGNOSTIC_COMPILATION_UNCONFIRMED')


def module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative, callback_relative):
    need(sha((OLD / 'compiler.py').read_bytes()) == OLD_COMPILER_SHA and sha((OLD / 'entry.mjs').read_bytes()) == OLD_ENTRY_SHA)
    old_relative = relative.replace('presentation-generation-data-diagnostics-compiled', 'presentation-generation-data-proof-compiled')
    old_callback = callback_relative.replace('presentation-generation-data-diagnostics-compiled', 'presentation-generation-data-proof-compiled')
    prior = module('frozen_full_data_proof_compiler', OLD / 'compiler.py')
    source, _ = prior.compile_source(old_relative, old_callback)
    callback, projection = module('tiny_cohort_callback', HERE / 'tiny_source.py').project_source()

    def replace(before, after):
        nonlocal source
        need(source.count(before) == 1)
        source = source.replace(before, after)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for before, after in [
        ("'.local/presentation-generation-data-proof'", "'.local/presentation-generation-data-diagnostics'"),
        ("'tracking/evidence/m07/presentation-generation-data-proof'", "'tracking/evidence/m07/presentation-generation-data-diagnostics'"),
        ("'eps.generationdata.run'", "'eps.cohortdiagnostic.run'"),
        ("'eps.generationdata.workspace'", "'eps.cohortdiagnostic.workspace'"),
        ("'eps.generationdata.purpose'", "'eps.cohortdiagnostic.purpose'"),
        ("'generation-data-reuse-performance-equality'", "'cohort-only-original-source-diagnosis'"),
        ("'eps-gendata-'", "'eps-cohortdiag-'"),
        ("'presentation-generation-data-owned-proof'", "'presentation-original-cohort-diagnostic'"),
    ]:
        replace(before, after)
    need(source.count('label=eps.generationdata.run=') == 2)
    source = source.replace('label=eps.generationdata.run=', 'label=eps.cohortdiagnostic.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    args['projectedCallback'] = str(ROOT / callback_relative).replace('\\', '/')
    args['projectedCallbackSha'] = sha(callback.encode())
    args['diagnosticProjection'] = projection
    source = source[:position] + json.dumps(args) + source[position + length:]
    replace(json.dumps(old_relative), json.dumps(relative))
    marker = 'report.source_seals = {}; for (const [root, file] of '
    begin = source.index(marker) + len(marker)
    end = source.index(') {\n      const bytes = await readFile', begin)
    records = json.loads(source[begin:end])
    for record in records:
        if record[1] == old_callback:
            record[1] = callback_relative
    files = sorted(path for path in HERE.iterdir() if path.is_file() and path.suffix in ['.mjs', '.py', '.md'])
    records.extend([[str(ROOT).replace('\\', '/'), path.relative_to(ROOT).as_posix()] for path in files])
    source = source[:begin] + json.dumps(records) + source[end:]
    # The old compiler's callback check is retained as a finite projected check.
    old_path = str(ROOT / old_callback).replace('\\', '/')
    need(source.count(json.dumps(old_path)) == 1)
    source = source.replace(json.dumps(old_path), json.dumps(args['projectedCallback']))
    old_hash = sha(module('frozen_data_callback_projection', OLD / 'proof_source.py').project_source().encode())
    need(source.count(json.dumps(old_hash)) == 1)
    source = source.replace(json.dumps(old_hash), json.dumps(args['projectedCallbackSha']))
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(path).replace('\\', '/')) + ')),' + json.dumps(sha(path.read_bytes())) + ');' for path in files)
    replace("assert(lockProof.EXECUTION_ENABLED,'GENERATION_DATA_REUSE_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'COHORT_DIAGNOSTIC_EXECUTION_DISABLED');" + checks)
    return source, callback


if __name__ == '__main__':
    token = str(uuid.uuid4())
    relative = '.local/presentation-generation-data-diagnostics-compiled/controller-' + token + '.mjs'
    callback_relative = relative.replace('/controller-', '/callback-')
    controller, callback = compile_source(relative, callback_relative)
    for name, text in [(callback_relative, callback), (relative, controller)]:
        path = ROOT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
    print(json.dumps({'controller': str(ROOT / relative), 'controller_sha256': sha(controller.encode()), 'callback': str(ROOT / callback_relative), 'callback_sha256': sha(callback.encode()), 'compiled_only': True, 'execution_dispatched': False}))
