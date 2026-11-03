"""Compose the frozen continuation with one inverse-proved temporary DTO edit."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('SETUP_META_REMAINING_COMPILATION_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    p = load('setup_meta_source', HERE / 'source.py')
    p.frozen()
    p.admit_entry((HERE / 'entry.mjs').read_bytes().decode('utf8'))
    match = re.fullmatch(r'\.local/presentation-generation-setup-meta-remaining-proof-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = relative.replace(p.NAMESPACE, p.PREVIOUS_NAMESPACE)
    source, old_callback, cases = load('setup_meta_parent_compiler', p.OLD / 'compiler.py').compile_source(old_relative)
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, proof = p.project_callback(ROOT / cases_relative)
    consumers = p.no_consumers(callback, cases)

    def replace(old, new):
        nonlocal source
        need(source.count(old) == 1)
        source = source.replace(old, new, 1)

    replace(json.dumps((p.OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    for old, new in [
        ("'.local/" + p.PREVIOUS_NAMESPACE + "'", "'.local/" + p.NAMESPACE + "'"),
        ("'tracking/evidence/m07/" + p.PREVIOUS_NAMESPACE + "'", "'tracking/evidence/m07/" + p.NAMESPACE + "'"),
        ("'.local/" + p.PREVIOUS_NAMESPACE + "-once'", "'.local/" + p.NAMESPACE + "-once'"),
        ("'eps.profilerem.run'", "'eps.setupmetarem.run'"),
        ("'eps.profilerem.workspace'", "'eps.setupmetarem.workspace'"),
        ("'eps.profilerem.purpose'", "'eps.setupmetarem.purpose'"),
        ("'eps-profilerem-'", "'eps-setupmetarem-'"),
        ("'observed-CLI-profile-remaining-scopes-after-48ed-completed-prefix'", "'observed-CLI-profile-remaining-after24-unused-setup-hash-fix'"),
        ("'presentation-generation-profile-remaining-owned-proof'", "'presentation-generation-setup-meta-remaining-owned-proof'"),
    ]:
        replace(old, new)
    need(source.count('label=eps.profilerem.run=') == 2)
    source = source.replace('label=eps.profilerem.run=', 'label=eps.setupmetarem.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    temporary = p.patch_temporary(p.TEMP.read_bytes().decode('utf8'))
    args.update(setupMetadataTemporarySQL=temporary,
                setupMetadataProjection={**proof, 'original_temporary_sha256': p.TEMP_SHA,
                                         'rendered_temporary_sha256': sha(temporary.encode()),
                                         'declared_runtime_no_consumer_source_hashes': consumers},
                projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()),
                projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()))
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
    files = sorted(file for file in HERE.iterdir() if file.is_file() and file.suffix in ('.py', '.mjs', '.md'))
    records.extend([[str(ROOT).replace('\\', '/'), file.relative_to(ROOT).as_posix()] for file in files])
    records.append([str(p.LIBRARY).replace('\\', '/'), p.FAILED_REF])
    records.append([str(p.LIBRARY).replace('\\', '/'), p.FAILED_AUDIT_REF])
    source = source[:begin] + json.dumps(records) + source[end:]
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(file).replace('\\', '/')) + ')),' + json.dumps(sha(file.read_bytes())) + ');' for file in files)
    checks += '\n  assert.equal(sha(await readFile(' + json.dumps(str(p.LIBRARY / p.FAILED_REF).replace('\\', '/')) + ')),' + json.dumps(p.FAILED_SHA) + ');'
    checks += '\n  assert.equal(sha(await readFile(' + json.dumps(str(p.LIBRARY / p.FAILED_AUDIT_REF).replace('\\', '/')) + ')),' + json.dumps(p.FAILED_AUDIT_SHA) + ');'
    replace("assert(lockProof.EXECUTION_ENABLED,'PROFILE_REMAINING_PROOF_EXECUTION_DISABLED');",
            "assert(lockProof.EXECUTION_ENABLED,'SETUP_META_REMAINING_PROOF_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    relative = '.local/presentation-generation-setup-meta-remaining-proof-compiled/controller-' + str(uuid.uuid4()) + '.mjs'
    controller, callback, cases = compile_source(relative)
    outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'outputs': outputs}))
