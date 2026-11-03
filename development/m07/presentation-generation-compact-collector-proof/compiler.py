"""Frozen history collector protocol, exact new Context and fresh ownership."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD = MAIN / 'development/m07/presentation-generation-factored-collector-proof'
PINS = {'compiler.py': '99fb60d643c1ce23536dec57cb7220ce01a1c337e0e730f9e5ac9cea8a1ae2fb', 'entry.mjs': 'a70e692c7c8aa60835fe2528ac186f7507991559bcc42e2dc01f73bfa77bcb17', 'local.py': 'e63ade2b1b01cc51bf808b488e0731fd2346adede08486a4bba0802378975778', 'test_collector.py': 'edb2cb499b407dc3f0e91323dd81073f374af3297628c40b0d0d0441f9fa23b0', 'README.md': 'cb44cc05079e5d630336018eb91e11cf750a2269acf59e44f10603d12b2cb0fb'}
FAILED = 'tracking/evidence/m07/presentation-generation-factored-collector-proof/2026-11-03T12-24-27.126Z-3c56fc2a.json'
FAILED_SHA = 'afa3cd1457d3dffdff82d1d51890f09f03be3fa6f8c36b5220521cbcbb418880'
AUDIT = 'tracking/evidence/m07/presentation-generation-factored-collector-proof/Root-3c56fc2a-postrun-audit.json'
AUDIT_SHA = 'f0d027db7c5f660cb7814457e4f19798ed879194e8ceccbb8f1c72089c5c5988'
ENTRY = b'/** Fresh compact-query collector; old/new full states share each RR statement. */\nexport const EXECUTION_ENABLED = false;\n'


def need(ok):
    if not ok:
        raise ValueError('GENERATION_RAW_COLLECTOR_SOURCE_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def project(text, changes):
    before = text
    for a,b in changes:
        need(text.count(a)==1);text=text.replace(a,b,1)
    inverse=text
    for a,b in reversed(changes):
        need(inverse.count(b)==1);inverse=inverse.replace(b,a,1)
    need(inverse==before)
    return text


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-collector-compact-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    flag = (HERE / 'entry.mjs').read_bytes()
    armed = ENTRY.replace(b'EXECUTION_ENABLED = false;', b'EXECUTION_ENABLED = true;')
    need(flag in (ENTRY, armed))
    for name, digest in PINS.items():
        need(sha((OLD / name).read_bytes()) == digest)
    for name, digest in [(FAILED, FAILED_SHA), (AUDIT, AUDIT_SHA)]:
        need(sha((MAIN / name).read_bytes()) == digest)
    failed, audit = json.loads((MAIN / FAILED).read_bytes()), json.loads((MAIN / AUDIT).read_bytes())
    need(failed['result'] == 'passed' and failed['run_id'] == audit['run_id'] == '3c56fc2a-faba-48fd-a66a-a693c8ecc55b')
    need(all(failed[key] is True for key in ('all_owned_resources_absent', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released')))
    local = module('generation_raw_actual_owned_Context', HERE / 'local.py')
    actual = local.configuration()
    parent = module('generation_raw_frozen_history_compiler', OLD / 'compiler.py')
    source, bridge, entry, prior = parent.compile_source(relative.replace('presentation-generation-collector-compact-compiled', 'presentation-generation-collector-factored-compiled'))
    begin = source.index('const cfg=') + len('const cfg=')
    cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
    old_cfg, old_entry = json.dumps(cfg, sort_keys=True), cfg['entry_file']
    need(cfg['snapshot_sql']==actual['original_snapshot_sql'])
    for key in ('entry_file', 'bridge_file'):
        cfg['source_pins'].pop(cfg[key])
    cfg.update(controller=str(MAIN / relative), bridge_file=str(MAIN / relative.replace('/controller-', '/bridge-')),
               entry_file=str(MAIN / relative.replace('/controller-', '/entry-')),
               snapshot_sql=actual['snapshot_sql'], checkpoint_sql=actual['checkpoint_sql'], original_snapshot_sql=actual['original_snapshot_sql'])
    bridge = project(bridge, [
        ('const LOCAL=' + json.dumps(str(MAIN / 'development/m07/presentation-generation-factored-collector-proof/local.py').replace('\\', '/')) + ';', 'const LOCAL=' + json.dumps(str(HERE / 'local.py').replace('\\', '/')) + ';'),
        ("'.local/presentation-generation-factored-collector-proof'", "'.local/presentation-generation-compact-collector-proof'"),
    ])
    entry = project(entry, [
        ('export const EXECUTION_ENABLED = false;', 'export const EXECUTION_ENABLED = ' + str(flag == armed).lower() + ';'),
        ("'.local/presentation-generation-collector-factored-once'", "'.local/presentation-generation-collector-compact-once'"),
        ("'label=eps.genfactored.run='", "'label=eps.gencompact.run='"),
    ])
    entry = project(entry, [('  const snapshot = () => query("begin isolation level repeatable read read only;set local search_path=\'\';set local statement_timeout=\'60s\';" + cfg.snapshot_sql + \'as reason40_release;rollback;\');', '  const snapshot = async () => {\n    const pair=await query("begin isolation level repeatable read read only;set local search_path=\'\';set local statement_timeout=\'60s\';select jsonb_build_object(\'old\',("+cfg.original_snapshot_sql+"),\'compact\',("+cfg.snapshot_sql+"),\'isolation\',current_setting(\'transaction_isolation\'),\'read_only\',current_setting(\'transaction_read_only\'))as reason40_release;rollback;");\n    const oldHash=sha(Buffer.from(JSON.stringify(pair.old))),compactHash=sha(Buffer.from(JSON.stringify(pair.compact)));\n    const record={equal:oldHash===compactHash,old_sha256:oldHash,compact_sha256:compactHash,repeatable_read:pair.isolation===\'repeatable read\',read_only:pair.read_only===\'on\',same_statement_snapshot:true,history_count:pair.compact?.history?.versions?.length??null};\n    ctx.report.literal_compaction??={snapshots:[],immutable_code_literals_only:true};ctx.report.literal_compaction.snapshots.push(record);\n    assert(record.repeatable_read&&record.read_only);assert.deepEqual(pair.old,pair.compact);assert(record.equal);return pair.compact;\n  };')])
    cfg['entry_sha256'], cfg['bridge_sha256'] = sha(entry.encode()), sha(bridge.encode())
    cfg['source_pins'].update(actual['source_pins'])
    cfg['source_pins'].update({cfg['entry_file']: cfg['entry_sha256'], cfg['bridge_file']: cfg['bridge_sha256']})
    for file in [MAIN / FAILED, MAIN / AUDIT, *sorted(HERE.iterdir())]:
        if file.is_file():
            cfg['source_pins'][str(file)] = sha(file.read_bytes())
    changes = [('const cfg=' + old_cfg + ';', 'const cfg=' + json.dumps(cfg, sort_keys=True) + ';'), (Path(old_entry).as_uri(), Path(cfg['entry_file']).as_uri())]
    changes += [
        ("'.local/presentation-generation-factored-collector-proof'", "'.local/presentation-generation-compact-collector-proof'"),
        ("'eps.genfactored.run'", "'eps.gencompact.run'"), ("'eps.genfactored.workspace'", "'eps.gencompact.workspace'"),
        ("'eps.genfactored.purpose'", "'eps.gencompact.purpose'"), ("'eps-genfactored-'", "'eps-gencompact-'"),
        ("'generation-seven-target-factored-collector-rehearsal'", "'generation-seven-target-compact-collector-rehearsal'"),
        ("'presentation-generation-collector-factored-owned-proof'", "'presentation-generation-collector-compact-owned-proof'"),
        ("'tracking/evidence/m07/presentation-generation-factored-collector-proof'", "'tracking/evidence/m07/presentation-generation-compact-collector-proof'"),
    ]
    marker = 'report.source_seals = {}; for (const [root, file] of '
    start, end = source.index(marker) + len(marker), source.index(') {\n      const bytes', source.index(marker))
    records = []
    for name in cfg['source_pins']:
        file = Path(name)
        root = MAIN if file.is_relative_to(MAIN) else SOURCE
        need(file.is_relative_to(root))
        records.append([str(root), file.relative_to(root).as_posix()])
    records.append([str(MAIN), relative])
    changes.append((source[start:end], json.dumps(records)))
    source = project(source, changes)
    return source, bridge, entry, {'parent_controller_inverse_byte_equal': True, 'parent_bridge_inverse_byte_equal': True,
                                  'parent_entry_inverse_byte_equal': True, 'only_literal_query_paired_snapshot_and_new_ownership_changed': True,
                                  'same_fixture_bounds_and_transaction_protocol_with_paired_RR_reads': True, 'source_pins': cfg['source_pins'], 'parent_projection': prior}


if __name__ == '__main__':
    relative = '.local/presentation-generation-collector-compact-compiled/controller-' + str(uuid.uuid4()) + '.mjs'
    controller, bridge, entry, proof = compile_source(relative)
    for kind, text in [('bridge', bridge), ('entry', entry), ('controller', controller)]:
        file = MAIN / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'controller': relative,
                      'controller_sha256': sha(controller.encode()), 'bridge_sha256': sha(bridge.encode()), 'entry_sha256': sha(entry.encode()), 'projection': proof}))
