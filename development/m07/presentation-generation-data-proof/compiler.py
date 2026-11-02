"""Fresh disabled local bundle; pure compilation never dispatches SQL or Docker."""
from pathlib import Path
import hashlib
import importlib.util
import json
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-lock-source-edge-proof'
OLD_COMPILER_SHA = '8fb944c9235a5903a09d004fb77522c3b228f891ad5d0f7939f7d15e43bef4bc'
OLD_ENTRY_SHA = 'afda8e16b1d41325fbdbc622457fac54ee3dfe4d193c5091ed69927bebdae1b8'


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('GENERATION_DATA_REUSE_COMPILATION_UNCONFIRMED')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative, callback_relative):
    need(sha((OLD / 'compiler.py').read_bytes()) == OLD_COMPILER_SHA)
    need(sha((OLD / 'entry.mjs').read_bytes()) == OLD_ENTRY_SHA)
    need(Path(relative).parent.as_posix() == '.local/presentation-generation-data-proof-compiled')
    need(Path(callback_relative).parent.as_posix() == '.local/presentation-generation-data-proof-compiled')
    before = module('frozen_edge_compiler', OLD / 'compiler.py').compile_source(relative)
    projection = module('generation_callback_projection', HERE / 'proof_source.py')
    callback = projection.project_source()
    need(projection.inverse_source(callback).encode() == (HERE.parent / 'presentation-lock-source-proof/proof.mjs').read_bytes())
    source = before

    def replace(old, new):
        nonlocal source
        need(source.count(old) == 1)
        source = source.replace(old, new)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for old, new in [
        ("'.local/presentation-lock-source-edge-proof'", "'.local/presentation-generation-data-proof'"),
        ("'tracking/evidence/m07/presentation-lock-source-edge-proof'", "'tracking/evidence/m07/presentation-generation-data-proof'"),
        ("'eps.locksource41edge.run'", "'eps.generationdata.run'"),
        ("'eps.locksource41edge.workspace'", "'eps.generationdata.workspace'"),
        ("'eps.locksource41edge.purpose'", "'eps.generationdata.purpose'"),
        ("'locksource41-edge-qualified-performance-equality'", "'generation-data-reuse-performance-equality'"),
        ("'eps-locksrc41edge-'", "'eps-gendata-'"),
        ("'presentation-lock-source41-edge-owned-proof'", "'presentation-generation-data-owned-proof'"),
    ]:
        replace(old, new)
    need(source.count('label=eps.locksource41edge.run=') == 2)
    source = source.replace('label=eps.locksource41edge.run=', 'label=eps.generationdata.run=')
    build = module('generation_candidate_assembly', HERE.parent / 'presentation-generation-data-reuse/build.py')
    bodies = build.build()
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    need(set(args) == {'baseSource', 'candidateSource', 'baseSha', 'candidateSha', 'migration40', 'migration40Sha'})
    args['originalLockSource'] = args['baseSource']
    args['baseSource'] = args['candidateSource']
    args['baseSha'] = args['candidateSha']
    args['beforeBodies'] = [{'name': item['name'], 'sha': item['before_body_sha256'], 'sql': item['before'], 'definition_sha256': sha(item['before'].encode())} for item in bodies]
    args['afterBodies'] = [{'name': item['name'], 'sha': item['after_body_sha256'], 'sql': item['after'], 'definition_sha256': sha(item['after'].encode())} for item in bodies]
    args['projectedCallback'] = str(ROOT / callback_relative).replace('\\', '/')
    args['projectedCallbackSha'] = sha(callback.encode())
    source = source[:position] + json.dumps(args) + source[position + length:]
    files = sorted(p for p in HERE.iterdir() if p.is_file() and p.suffix in ['.py', '.mjs', '.sql', '.md'])
    files += sorted(p for p in (HERE.parent / 'presentation-generation-data-reuse').iterdir() if p.is_file() and p.suffix in ['.py', '.md'])
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(p).replace('\\', '/')) + ')),' + json.dumps(sha(p.read_bytes())) + ');' for p in files)
    checks += '\n  assert.equal(sha(await readFile(' + json.dumps(args['projectedCallback']) + ')),' + json.dumps(args['projectedCallbackSha']) + ');'
    replace("assert(lockProof.EXECUTION_ENABLED,'LOCKSOURCE41_EDGE_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'GENERATION_DATA_REUSE_EXECUTION_DISABLED');" + checks)
    marker = 'report.source_seals = {}; for (const [root, file] of '
    begin = source.index(marker) + len(marker)
    end = source.index(') {\n      const bytes = await readFile', begin)
    records = json.loads(source[begin:end])
    records.extend([[str(ROOT).replace('\\', '/'), p.relative_to(ROOT).as_posix()] for p in files])
    records.append([str(ROOT).replace('\\', '/'), callback_relative])
    source = source[:begin] + json.dumps(records) + source[end:]
    return source, callback


if __name__ == '__main__':
    token = str(uuid.uuid4())
    relative = '.local/presentation-generation-data-proof-compiled/controller-' + token + '.mjs'
    callback_relative = '.local/presentation-generation-data-proof-compiled/callback-' + token + '.mjs'
    source, callback = compile_source(relative, callback_relative)
    for name, text in [(callback_relative, callback), (relative, source)]:
        path = ROOT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
    print(json.dumps({'controller': str(ROOT / relative), 'controller_sha256': sha(source.encode()), 'callback': str(ROOT / callback_relative), 'callback_sha256': sha(callback.encode()), 'compiled_only': True, 'execution_dispatched': False}))
