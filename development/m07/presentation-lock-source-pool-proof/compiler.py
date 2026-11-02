"""Compile a fresh disabled once-only owned proof. Never dispatch SQL/Docker."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OLD = HERE.parent / 'presentation-generation-data-proof'
OLD_COMPILER_SHA = '6ec01de30d7a3c73adf911d53c70ed69b44ca4e82360fc511265b77c8f3e6815'
OLD_ENTRY_SHA = '18177115fc20a6810d90af4dfda7a12ced022f883dba6db4cf070474414a5283'


def need(ok):
    if not ok:
        raise ValueError('POOL_PROOF_COMPILATION_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative, callback_relative):
    pattern = r'\.local/presentation-lock-source-pool-proof-compiled/controller-([a-f0-9-]{36})\.mjs'
    match = re.fullmatch(pattern, relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    need(callback_relative == relative.replace('/controller-', '/callback-'))
    need(sha((OLD / 'compiler.py').read_bytes()) == OLD_COMPILER_SHA and sha((OLD / 'entry.mjs').read_bytes()) == OLD_ENTRY_SHA)
    old_relative = relative.replace('presentation-lock-source-pool-proof-compiled', 'presentation-generation-data-proof-compiled')
    old_callback = callback_relative.replace('presentation-lock-source-pool-proof-compiled', 'presentation-generation-data-proof-compiled')
    source, old_callback_source = module('pool_proof_frozen_compiler', OLD / 'compiler.py').compile_source(old_relative, old_callback)
    callback, projection = module('pool_proof_callback', HERE / 'source.py').project_source()
    candidate = module('pool_proof_candidate', HERE.parent / 'presentation-lock-source-pool-reuse/candidate.py')
    before, after = candidate.build()
    oracle, _ = module('pool_proof_oracle', HERE / 'oracle.py').build()

    def replace(before, after):
        nonlocal source
        need(source.count(before) == 1)
        source = source.replace(before, after)

    replace(json.dumps((OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for before_text, after_text in [
        ("'.local/presentation-generation-data-proof'", "'.local/presentation-lock-source-pool-proof'"),
        ("'tracking/evidence/m07/presentation-generation-data-proof'", "'tracking/evidence/m07/presentation-lock-source-pool-proof'"),
        ("'eps.generationdata.run'", "'eps.poolproof.run'"),
        ("'eps.generationdata.workspace'", "'eps.poolproof.workspace'"),
        ("'eps.generationdata.purpose'", "'eps.poolproof.purpose'"),
        ("'generation-data-reuse-performance-equality'", "'fenced-pool-id-reuse-cold-first-proof'"),
        ("'eps-gendata-'", "'eps-poolproof-'"),
        ("'presentation-generation-data-owned-proof'", "'presentation-lock-pool-owned-proof'"),
    ]:
        replace(before_text, after_text)
    need(source.count('label=eps.generationdata.run=') == 2)
    source = source.replace('label=eps.generationdata.run=', 'label=eps.poolproof.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    args.update(baseSource=before, candidateSource=after, baseSha=candidate.sha(candidate.body(before).encode()), candidateSha=candidate.sha(candidate.body(after).encode()))
    args['afterBodies'] = args['beforeBodies']
    args['originalLockSha'] = '4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7'
    args['measureSql'] = (HERE / 'measure.sql').read_text(encoding='utf8').replace('\r\n', '\n')
    args['oracleSql'] = oracle
    args['projection'] = projection
    args['projectedCallback'] = str(ROOT / callback_relative).replace('\\', '/')
    args['projectedCallbackSha'] = sha(callback.encode())
    source = source[:position] + json.dumps(args) + source[position + length:]
    replace(json.dumps(old_relative), json.dumps(relative))
    marker = 'report.source_seals = {}; for (const [root, file] of '
    begin = source.index(marker) + len(marker)
    end = source.index(') {\n      const bytes = await readFile', begin)
    records = json.loads(source[begin:end])
    for record in records:
        if record[1] == old_callback:
            record[1] = callback_relative
    files = sorted(path for folder in [HERE, HERE.parent / 'presentation-lock-source-pool-reuse'] for path in folder.iterdir() if path.is_file() and path.suffix in ['.py', '.mjs', '.sql', '.md'])
    files.append(HERE.parent / 'presentation-generation-data-diagnostics/capture.mjs')
    records.extend([[str(ROOT).replace('\\', '/'), path.relative_to(ROOT).as_posix()] for path in files])
    source = source[:begin] + json.dumps(records) + source[end:]
    replace(json.dumps(str(ROOT / old_callback).replace('\\', '/')), json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback_source.encode())), json.dumps(args['projectedCallbackSha']))
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(path).replace('\\', '/')) + ')),' + json.dumps(sha(path.read_bytes())) + ');' for path in files)
    replace("assert(lockProof.EXECUTION_ENABLED,'GENERATION_DATA_REUSE_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'POOL_PROOF_EXECUTION_DISABLED');" + checks)
    # One protected permit per admitted compiled artifact, before the original
    # target is opened and before any Docker action. Never delete this claim.
    once = """    const dispatchRoot=path.join(ROOT,'.local/presentation-lock-source-pool-proof-once',COMPILE_UUID);
    await mkdir(path.dirname(dispatchRoot),{recursive:true});await protect(dispatchRoot);
    await writeFile(path.join(dispatchRoot,'claim.json'),JSON.stringify({compile_uuid:COMPILE_UUID,run_id:runId,automatic_retry:false}),{flag:'wx'});
    report.dispatch_once_claim_created=true;report.compile_uuid=COMPILE_UUID;
""".replace('COMPILE_UUID', json.dumps(match[1]))
    replace('    await mkdir(path.dirname(privateRoot), { recursive: true }); await protect(privateRoot); privateReady = true; report.private_acl_verified = true;', once + '    await mkdir(path.dirname(privateRoot), { recursive: true }); await protect(privateRoot); privateReady = true; report.private_acl_verified = true;')
    return source, callback


if __name__ == '__main__':
    token = str(uuid.uuid4())
    relative = '.local/presentation-lock-source-pool-proof-compiled/controller-' + token + '.mjs'
    callback_relative = relative.replace('/controller-', '/callback-')
    controller, callback = compile_source(relative, callback_relative)
    for name, text in [(callback_relative, callback), (relative, controller)]:
        path = ROOT / name
        path.parent.mkdir(parents=True, exist_ok=True)
        with path.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
    print(json.dumps({'controller': str(ROOT / relative), 'controller_sha256': sha(controller.encode()), 'callback': str(ROOT / callback_relative), 'callback_sha256': sha(callback.encode()), 'compiled_only': True, 'execution_dispatched': False}))
