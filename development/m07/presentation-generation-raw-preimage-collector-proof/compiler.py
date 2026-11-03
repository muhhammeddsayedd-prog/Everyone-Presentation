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
OLD = MAIN / 'development/m07/presentation-generation-collector-history-proof'
PINS = {'compiler.py': '9a92329529b71ffa8b534efeac292c42dd43410c9a211a4d171b062663c7837c',
        'entry.mjs': '4268de1598195c12754221995785304d1be9412e8b5e5d0766dffede9998cdac',
        'test_history.py': 'b1a5bed2c6ca3cc64a7aa633c0c9826edea1a2d7b5c7563144f09d589d4d52c9',
        'README.md': '307ec2e9e838fff7de674cfd2d66e627d62394a7d3fb88ef7c619212757f84bd'}
FAILED = 'tracking/evidence/m07/presentation-generation-collector-proof/history-successor/2026-11-03T11-11-23.813Z-ec829d5c.json'
FAILED_SHA = '44bfece12935cecc2538eaab3e7fc7500c1adb3c4216ffc815359eb59eab649f'
AUDIT = 'tracking/evidence/m07/presentation-generation-collector-proof/history-successor/Root-ec829d5c-postrun-audit.json'
AUDIT_SHA = '8172293d42c28a2c27ebd55a5142fb93b8b6ad95c586f483a10b3b5de1112314'
ENTRY = b'/** Fresh exact raw-preimage collector; no old controller or claim is replayed. */\nexport const EXECUTION_ENABLED = false;\n'


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


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-collector-raw-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    flag = (HERE / 'entry.mjs').read_bytes()
    armed = ENTRY.replace(b'EXECUTION_ENABLED = false;', b'EXECUTION_ENABLED = true;')
    need(flag in (ENTRY, armed))
    for name, digest in PINS.items():
        need(sha((OLD / name).read_bytes()) == digest)
    for name, digest in [(FAILED, FAILED_SHA), (AUDIT, AUDIT_SHA)]:
        need(sha((MAIN / name).read_bytes()) == digest)
    failed, audit = json.loads((MAIN / FAILED).read_bytes()), json.loads((MAIN / AUDIT).read_bytes())
    need(failed['result'] == 'failed' and failed['run_id'] == audit['run_id'] == 'ec829d5c-fc41-41b1-83cc-0b6e135046fb')
    need(all(failed[key] is True for key in ('all_owned_resources_absent', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released')))
    local = module('generation_raw_actual_owned_Context', HERE / 'local.py')
    actual = local.configuration()
    parent = module('generation_raw_frozen_history_compiler', OLD / 'compiler.py')
    source, bridge, entry, prior = parent.compile_source(relative.replace('presentation-generation-collector-raw-compiled', 'presentation-generation-collector-history-compiled'))
    begin = source.index('const cfg=') + len('const cfg=')
    cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
    old_cfg, old_entry = json.dumps(cfg, sort_keys=True), cfg['entry_file']
    for key in ('entry_file', 'bridge_file'):
        cfg['source_pins'].pop(cfg[key])
    cfg.update(controller=str(MAIN / relative), bridge_file=str(MAIN / relative.replace('/controller-', '/bridge-')),
               entry_file=str(MAIN / relative.replace('/controller-', '/entry-')),
               snapshot_sql=actual['snapshot_sql'], checkpoint_sql=actual['checkpoint_sql'])
    bridge = parent.project(bridge, [
        ('const LOCAL=' + json.dumps(str(MAIN / 'development/m07/presentation-generation-collector-proof/local.py').replace('\\', '/')) + ';', 'const LOCAL=' + json.dumps(str(HERE / 'local.py').replace('\\', '/')) + ';'),
        ("'.local/presentation-generation-collector-history-proof'", "'.local/presentation-generation-raw-preimage-collector-proof'"),
    ])
    entry = parent.project(entry, [
        ('export const EXECUTION_ENABLED = false;', 'export const EXECUTION_ENABLED = ' + str(flag == armed).lower() + ';'),
        ("'.local/presentation-generation-collector-history-once'", "'.local/presentation-generation-collector-raw-once'"),
        ("'label=eps.genhistory.run='", "'label=eps.genraw.run='"),
    ])
    cfg['entry_sha256'], cfg['bridge_sha256'] = sha(entry.encode()), sha(bridge.encode())
    cfg['source_pins'].update(actual['source_pins'])
    cfg['source_pins'].update({cfg['entry_file']: cfg['entry_sha256'], cfg['bridge_file']: cfg['bridge_sha256']})
    for file in [MAIN / FAILED, MAIN / AUDIT, *sorted(HERE.iterdir())]:
        if file.is_file():
            cfg['source_pins'][str(file)] = sha(file.read_bytes())
    changes = [('const cfg=' + old_cfg + ';', 'const cfg=' + json.dumps(cfg, sort_keys=True) + ';'), (Path(old_entry).as_uri(), Path(cfg['entry_file']).as_uri())]
    changes += [
        ("'.local/presentation-generation-collector-history-proof'", "'.local/presentation-generation-raw-preimage-collector-proof'"),
        ("'eps.genhistory.run'", "'eps.genraw.run'"), ("'eps.genhistory.workspace'", "'eps.genraw.workspace'"),
        ("'eps.genhistory.purpose'", "'eps.genraw.purpose'"), ("'eps-genhistory-'", "'eps-genraw-'"),
        ("'generation-seven-target-post41-history-collector-rehearsal'", "'generation-seven-target-exact-raw-preimage-collector-rehearsal'"),
        ("'presentation-generation-collector-history-owned-proof'", "'presentation-generation-collector-raw-owned-proof'"),
        ("'tracking/evidence/m07/presentation-generation-collector-proof/history-successor'", "'tracking/evidence/m07/presentation-generation-raw-preimage-collector-proof'"),
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
    source = parent.project(source, changes)
    return source, bridge, entry, {'parent_controller_inverse_byte_equal': True, 'parent_bridge_inverse_byte_equal': True,
                                  'parent_entry_inverse_byte_equal': True, 'only_actual_raw_Context_and_new_ownership_changed': True,
                                  'no_fixture_DDL_or_protocol_or_bounds_change': True, 'source_pins': cfg['source_pins'], 'parent_projection': prior}


if __name__ == '__main__':
    relative = '.local/presentation-generation-collector-raw-compiled/controller-' + str(uuid.uuid4()) + '.mjs'
    controller, bridge, entry, proof = compile_source(relative)
    for kind, text in [('bridge', bridge), ('entry', entry), ('controller', controller)]:
        file = MAIN / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'controller': relative,
                      'controller_sha256': sha(controller.encode()), 'bridge_sha256': sha(bridge.encode()), 'entry_sha256': sha(entry.encode()), 'projection': proof}))
