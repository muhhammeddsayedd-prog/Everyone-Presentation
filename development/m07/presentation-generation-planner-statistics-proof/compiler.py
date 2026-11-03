"""RAM-only finite reuse of the frozen independent owned one-call controller."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import sys
import uuid

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def need(ok):
    if not ok:
        raise ValueError('PLANNER_STATS_COMPILATION_UNCONFIRMED')


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative, arm):
    p = load('planner_stats_projection', HERE / 'projection.py')
    p.frozen()
    need(arm in ('control', 'analyzed'))
    match = re.fullmatch(r'\.local/presentation-generation-planner-statistics-proof-compiled/controller-' + arm + r'-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    old_relative = '.local/' + p.OLD.name + '-compiled/controller-' + match[1] + '.mjs'
    source, old_callback, old_cases = load('planner_stats_frozen_compiler', p.OLD / 'compiler.py').compile_source(old_relative)
    callback_relative = relative.replace('/controller-', '/callback-')
    cases_relative = relative.replace('/controller-', '/cases-')
    callback, proof = p.project_callback(ROOT / cases_relative)
    cases = p.project_cases()

    def replace(old, new):
        nonlocal source
        need(source.count(old) == 1)
        source = source.replace(old, new, 1)

    replace(json.dumps((p.OLD / 'entry.mjs').as_uri()), json.dumps((HERE / 'entry.mjs').as_uri()))
    namespace = p.NAMESPACE + '-' + arm
    for old, new in [
        ("'.local/" + p.OLD.name + "'", "'.local/" + namespace + "'"),
        ("'tracking/evidence/m07/" + p.OLD.name + "'", "'tracking/evidence/m07/" + namespace + "'"),
        ("'.local/" + p.OLD.name + "-once'", "'.local/" + namespace + "-once'"),
        ("'eps.rawfirst.run'", "'eps.planstats.run'"),
        ("'eps.rawfirst.workspace'", "'eps.planstats.workspace'"),
        ("'eps.rawfirst.purpose'", "'eps.planstats.purpose'"),
        ("'single-uninstrumented-aa1-GEN41fe-rawf222-first-call'", "'original-production-graph-statistics-" + arm + "'"),
        ("'eps-rawfirst-'", "'eps-planstats-'"),
        ("'presentation-generation-raw-first-owned-proof'", "'presentation-generation-planner-statistics-" + arm + "'"),
    ]:
        replace(old, new)
    need(source.count('label=eps.rawfirst.run=') == 2)
    source = source.replace('label=eps.rawfirst.run=', 'label=eps.planstats.run=')
    position = source.index('bindings:', source.index('await lockProof.runCases(')) + len('bindings:')
    args, length = json.JSONDecoder().raw_decode(source[position:])
    old_callback_path, old_cases_path = args['projectedCallback'], args['projectedCases']
    # Only immutable canonical identities and the existing temporary measurement SQL
    # are needed; candidate SQL/carry labels are deliberately absent from bindings.
    args = {key: args[key] for key in ('migration40', 'migration40Sha', 'firstCallTemporarySQL', 'firstCallTemporarySha')}
    args.update(statsArm=arm, canonicalTargets={name.split('(')[0]: digest for name, digest in p.TARGETS.items()},
                canonicalStatsReference={'path': p.STATS_REF, 'sha256': p.STATS_SHA},
                observationsSha=sha((HERE / 'observations.sql').read_bytes()), plannerStatsProjection=proof,
                projectedCallback=str(ROOT / callback_relative).replace('\\', '/'), projectedCallbackSha=sha(callback.encode()),
                projectedCases=str(ROOT / cases_relative).replace('\\', '/'), projectedCasesSha=sha(cases.encode()))
    source = source[:position] + json.dumps(args) + source[position + length:]
    replace(json.dumps(old_relative), json.dumps(relative))
    replace(json.dumps(old_callback_path), json.dumps(args['projectedCallback']))
    replace(json.dumps(sha(old_callback.encode())), json.dumps(args['projectedCallbackSha']))
    replace(json.dumps(old_cases_path), json.dumps(args['projectedCases']))
    replace('assert.equal(sha(await readFile(' + json.dumps(args['projectedCases']) + ')),' + json.dumps(sha(old_cases.encode())) + ');',
            'assert.equal(sha(await readFile(' + json.dumps(args['projectedCases']) + ')),' + json.dumps(args['projectedCasesSha']) + ');')
    marker = 'report.source_seals = {}; for (const [root, file] of '
    begin = source.index(marker) + len(marker)
    end = source.index(') {\n      const bytes = await readFile', begin)
    records = json.loads(source[begin:end])
    for record in records:
        if record[1] == old_relative.replace('/controller-', '/callback-'):
            record[1] = callback_relative
        if record[1] == old_relative.replace('/controller-', '/cases-'):
            record[1] = cases_relative
    files = sorted(file for file in HERE.iterdir() if file.is_file() and file.suffix in ('.py', '.mjs', '.md', '.sql'))
    records.extend([[str(ROOT).replace('\\', '/'), file.relative_to(ROOT).as_posix()] for file in files])
    records.append([str(p.LIBRARY).replace('\\', '/'), p.STATS_REF])
    source = source[:begin] + json.dumps(records) + source[end:]
    checks = ''.join('\n  assert.equal(sha(await readFile(' + json.dumps(str(file).replace('\\', '/')) + ')),' + json.dumps(sha(file.read_bytes())) + ');' for file in files)
    checks += '\n  assert.equal(sha(await readFile(' + json.dumps(str(p.LIBRARY / p.STATS_REF).replace('\\', '/')) + ')),' + json.dumps(p.STATS_SHA) + ');'
    replace("assert(lockProof.EXECUTION_ENABLED,'RAW_FIRST_EXECUTION_DISABLED');", "assert(lockProof.EXECUTION_ENABLED,'PLANNER_STATS_EXECUTION_DISABLED');" + checks)
    return source, callback, cases


if __name__ == '__main__':
    need(len(sys.argv) == 2 and sys.argv[1] in ('control', 'analyzed'))
    arm = sys.argv[1]
    relative = '.local/presentation-generation-planner-statistics-proof-compiled/controller-' + arm + '-' + str(uuid.uuid4()) + '.mjs'
    controller, callback, cases = compile_source(relative, arm)
    outputs = []
    for kind, text in [('cases', cases), ('callback', callback), ('controller', controller)]:
        file = ROOT / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
        outputs.append({'path': file.relative_to(ROOT).as_posix(), 'sha256': sha(text.encode())})
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'arm': arm, 'outputs': outputs}))
