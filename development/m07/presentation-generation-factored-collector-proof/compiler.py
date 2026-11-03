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
OLD = MAIN / 'development/m07/presentation-generation-english-guard-collector-proof'
PINS = {'compiler.py': '58e406c8d3dc5b7b83363ae59ed214f16a17051d0e23135f31c18a3906cd01a1', 'entry.mjs': '537674e9ca7b444358de4026b8d365f436abc049d6ab5686dbb040a69dfd6183', 'local.py': '49cf2ded84999f34cb3aa8ca9cf89647eeab52dc9ac1c8776eefb78f4adec03c', 'test_collector.py': '4a8ff65fea421f83982b92895e7b191596b201c15bda2b7b0348538e18672287', 'README.md': 'aa2db2cb341aad5b662a14f43df8a3e7b0e5d0f793f15488fc8e00789862c24e'}
FAILED = 'tracking/evidence/m07/presentation-generation-english-guard-collector-proof/2026-11-03T11-51-31.429Z-89fbfcc7.json'
FAILED_SHA = '9a6d8598ad7efab26dfeccdec0fdc855ef045c4dda00d61220c60ee987efbbcc'
AUDIT = 'tracking/evidence/m07/presentation-generation-english-guard-collector-proof/Root-89fbfcc7-postrun-audit.json'
AUDIT_SHA = '851583afef95b18bf687fc99b4b93ed4629666e166b509ab3d8ba0bb30473143'
ENTRY = b'/** Fresh factored-renderer collector; prior nonce/claims are never replayed. */\nexport const EXECUTION_ENABLED = false;\n'


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
    match = re.fullmatch(r'\.local/presentation-generation-collector-factored-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    flag = (HERE / 'entry.mjs').read_bytes()
    armed = ENTRY.replace(b'EXECUTION_ENABLED = false;', b'EXECUTION_ENABLED = true;')
    need(flag in (ENTRY, armed))
    for name, digest in PINS.items():
        need(sha((OLD / name).read_bytes()) == digest)
    for name, digest in [(FAILED, FAILED_SHA), (AUDIT, AUDIT_SHA)]:
        need(sha((MAIN / name).read_bytes()) == digest)
    failed, audit = json.loads((MAIN / FAILED).read_bytes()), json.loads((MAIN / AUDIT).read_bytes())
    need(failed['result'] == 'passed' and failed['run_id'] == audit['run_id'] == '89fbfcc7-41a8-4cb5-ae9e-08148ed461a7')
    need(all(failed[key] is True for key in ('all_owned_resources_absent', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released')))
    local = module('generation_raw_actual_owned_Context', HERE / 'local.py')
    actual = local.configuration()
    parent = module('generation_raw_frozen_history_compiler', OLD / 'compiler.py')
    source, bridge, entry, prior = parent.compile_source(relative.replace('presentation-generation-collector-factored-compiled', 'presentation-generation-collector-english-guard-compiled'))
    begin = source.index('const cfg=') + len('const cfg=')
    cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
    old_cfg, old_entry = json.dumps(cfg, sort_keys=True), cfg['entry_file']
    need(cfg['snapshot_sql']==actual['snapshot_sql'] and cfg['checkpoint_sql']==actual['checkpoint_sql'])
    for key in ('entry_file', 'bridge_file'):
        cfg['source_pins'].pop(cfg[key])
    cfg.update(controller=str(MAIN / relative), bridge_file=str(MAIN / relative.replace('/controller-', '/bridge-')),
               entry_file=str(MAIN / relative.replace('/controller-', '/entry-')),
               snapshot_sql=actual['snapshot_sql'], checkpoint_sql=actual['checkpoint_sql'])
    bridge = project(bridge, [
        ('const LOCAL=' + json.dumps(str(MAIN / 'development/m07/presentation-generation-english-guard-collector-proof/local.py').replace('\\', '/')) + ';', 'const LOCAL=' + json.dumps(str(HERE / 'local.py').replace('\\', '/')) + ';'),
        ("'.local/presentation-generation-english-guard-collector-proof'", "'.local/presentation-generation-factored-collector-proof'"),
    ])
    entry = project(entry, [
        ('export const EXECUTION_ENABLED = false;', 'export const EXECUTION_ENABLED = ' + str(flag == armed).lower() + ';'),
        ("'.local/presentation-generation-collector-english-guard-once'", "'.local/presentation-generation-collector-factored-once'"),
        ("'label=eps.genenglishguard.run='", "'label=eps.genfactored.run='"),
    ])
    cfg['entry_sha256'], cfg['bridge_sha256'] = sha(entry.encode()), sha(bridge.encode())
    cfg['source_pins'].update(actual['source_pins'])
    cfg['source_pins'].update({cfg['entry_file']: cfg['entry_sha256'], cfg['bridge_file']: cfg['bridge_sha256']})
    for file in [MAIN / FAILED, MAIN / AUDIT, *sorted(HERE.iterdir())]:
        if file.is_file():
            cfg['source_pins'][str(file)] = sha(file.read_bytes())
    changes = [('const cfg=' + old_cfg + ';', 'const cfg=' + json.dumps(cfg, sort_keys=True) + ';'), (Path(old_entry).as_uri(), Path(cfg['entry_file']).as_uri())]
    changes += [
        ("'.local/presentation-generation-english-guard-collector-proof'", "'.local/presentation-generation-factored-collector-proof'"),
        ("'eps.genenglishguard.run'", "'eps.genfactored.run'"), ("'eps.genenglishguard.workspace'", "'eps.genfactored.workspace'"),
        ("'eps.genenglishguard.purpose'", "'eps.genfactored.purpose'"), ("'eps-genenglishguard-'", "'eps-genfactored-'"),
        ("'generation-seven-target-legacy-English-guard-collector-rehearsal'", "'generation-seven-target-factored-collector-rehearsal'"),
        ("'presentation-generation-collector-English-guard-owned-proof'", "'presentation-generation-collector-factored-owned-proof'"),
        ("'tracking/evidence/m07/presentation-generation-english-guard-collector-proof'", "'tracking/evidence/m07/presentation-generation-factored-collector-proof'"),
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
                                  'parent_entry_inverse_byte_equal': True, 'only_renderer_and_new_ownership_changed': True,
                                  'no_fixture_DDL_or_protocol_or_bounds_change': True, 'source_pins': cfg['source_pins'], 'parent_projection': prior}


if __name__ == '__main__':
    relative = '.local/presentation-generation-collector-factored-compiled/controller-' + str(uuid.uuid4()) + '.mjs'
    controller, bridge, entry, proof = compile_source(relative)
    for kind, text in [('bridge', bridge), ('entry', entry), ('controller', controller)]:
        file = MAIN / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'controller': relative,
                      'controller_sha256': sha(controller.encode()), 'bridge_sha256': sha(bridge.encode()), 'entry_sha256': sha(entry.encode()), 'projection': proof}))
