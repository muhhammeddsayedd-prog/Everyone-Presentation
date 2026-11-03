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
OLD = MAIN / 'development/m07/presentation-generation-raw-preimage-collector-proof'
PINS = {'compiler.py': '82092c51189e9a07cefc86c7301f589d4c2d6abc4285582c67ad3408298a57b5', 'entry.mjs': '82783eb16765a9c4f8117dd271b8df7403ccaee876cb8876677ff4d142938941', 'local.py': '314709a789ee0e53cac1e69abec26130a88d27531ab55e299924e427af732690', 'test_collector.py': '5577162e2e01f3d7ffb2d2c10ff4b7d5fdbd489d37cfde829b592074260a3c5c', 'README.md': '684e2ba91d24591e8f5ceacd0144f49870655b2c921f0e7f44faf444ee3e6576'}
FAILED = 'tracking/evidence/m07/presentation-generation-raw-preimage-collector-proof/2026-11-03T11-34-44.748Z-b1c52308.json'
FAILED_SHA = '6fa1eb4d863ea37993d9bb4469ea725b0ff141f8181eb17c48e00a293b0b1199'
AUDIT = 'tracking/evidence/m07/presentation-generation-raw-preimage-collector-proof/Root-b1c52308-postrun-audit.json'
AUDIT_SHA = '13e18c1bca1b857e37bbeccd2c9f909377b8b5ad95c971048461bac14a332f79'
ENTRY = b'/** Fresh single legacy-English-predicate collector; consumed claims stay frozen. */\nexport const EXECUTION_ENABLED = false;\n'


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
    match = re.fullmatch(r'\.local/presentation-generation-collector-english-guard-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    flag = (HERE / 'entry.mjs').read_bytes()
    armed = ENTRY.replace(b'EXECUTION_ENABLED = false;', b'EXECUTION_ENABLED = true;')
    need(flag in (ENTRY, armed))
    for name, digest in PINS.items():
        need(sha((OLD / name).read_bytes()) == digest)
    for name, digest in [(FAILED, FAILED_SHA), (AUDIT, AUDIT_SHA)]:
        need(sha((MAIN / name).read_bytes()) == digest)
    failed, audit = json.loads((MAIN / FAILED).read_bytes()), json.loads((MAIN / AUDIT).read_bytes())
    need(failed['result'] == 'failed' and failed['run_id'] == audit['run_id'] == 'b1c52308-71af-4c26-986b-51f8715cb726')
    need(all(failed[key] is True for key in ('all_owned_resources_absent', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released')))
    local = module('generation_raw_actual_owned_Context', HERE / 'local.py')
    actual = local.configuration()
    parent = module('generation_raw_frozen_history_compiler', OLD / 'compiler.py')
    source, bridge, entry, prior = parent.compile_source(relative.replace('presentation-generation-collector-english-guard-compiled', 'presentation-generation-collector-raw-compiled'))
    begin = source.index('const cfg=') + len('const cfg=')
    cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
    old_cfg, old_entry = json.dumps(cfg, sort_keys=True), cfg['entry_file']
    for key in ('entry_file', 'bridge_file'):
        cfg['source_pins'].pop(cfg[key])
    cfg.update(controller=str(MAIN / relative), bridge_file=str(MAIN / relative.replace('/controller-', '/bridge-')),
               entry_file=str(MAIN / relative.replace('/controller-', '/entry-')),
               snapshot_sql=actual['snapshot_sql'], checkpoint_sql=actual['checkpoint_sql'])
    bridge = project(bridge, [
        ('const LOCAL=' + json.dumps(str(MAIN / 'development/m07/presentation-generation-raw-preimage-collector-proof/local.py').replace('\\', '/')) + ';', 'const LOCAL=' + json.dumps(str(HERE / 'local.py').replace('\\', '/')) + ';'),
        ("'.local/presentation-generation-raw-preimage-collector-proof'", "'.local/presentation-generation-english-guard-collector-proof'"),
    ])
    entry = project(entry, [
        ('export const EXECUTION_ENABLED = false;', 'export const EXECUTION_ENABLED = ' + str(flag == armed).lower() + ';'),
        ("'.local/presentation-generation-collector-raw-once'", "'.local/presentation-generation-collector-english-guard-once'"),
        ("'label=eps.genraw.run='", "'label=eps.genenglishguard.run='"),
    ])
    cfg['entry_sha256'], cfg['bridge_sha256'] = sha(entry.encode()), sha(bridge.encode())
    cfg['source_pins'].update(actual['source_pins'])
    cfg['source_pins'].update({cfg['entry_file']: cfg['entry_sha256'], cfg['bridge_file']: cfg['bridge_sha256']})
    for file in [MAIN / FAILED, MAIN / AUDIT, *sorted(HERE.iterdir())]:
        if file.is_file():
            cfg['source_pins'][str(file)] = sha(file.read_bytes())
    changes = [('const cfg=' + old_cfg + ';', 'const cfg=' + json.dumps(cfg, sort_keys=True) + ';'), (Path(old_entry).as_uri(), Path(cfg['entry_file']).as_uri())]
    changes += [
        ("'.local/presentation-generation-raw-preimage-collector-proof'", "'.local/presentation-generation-english-guard-collector-proof'"),
        ("'eps.genraw.run'", "'eps.genenglishguard.run'"), ("'eps.genraw.workspace'", "'eps.genenglishguard.workspace'"),
        ("'eps.genraw.purpose'", "'eps.genenglishguard.purpose'"), ("'eps-genraw-'", "'eps-genenglishguard-'"),
        ("'generation-seven-target-exact-raw-preimage-collector-rehearsal'", "'generation-seven-target-legacy-English-guard-collector-rehearsal'"),
        ("'presentation-generation-collector-raw-owned-proof'", "'presentation-generation-collector-English-guard-owned-proof'"),
        ("'tracking/evidence/m07/presentation-generation-raw-preimage-collector-proof'", "'tracking/evidence/m07/presentation-generation-english-guard-collector-proof'"),
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
                                  'parent_entry_inverse_byte_equal': True, 'only_legacy_English_source_operand_and_new_ownership_changed': True,
                                  'no_fixture_DDL_or_protocol_or_bounds_change': True, 'source_pins': cfg['source_pins'], 'parent_projection': prior}


if __name__ == '__main__':
    relative = '.local/presentation-generation-collector-english-guard-compiled/controller-' + str(uuid.uuid4()) + '.mjs'
    controller, bridge, entry, proof = compile_source(relative)
    for kind, text in [('bridge', bridge), ('entry', entry), ('controller', controller)]:
        file = MAIN / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'controller': relative,
                      'controller_sha256': sha(controller.encode()), 'bridge_sha256': sha(bridge.encode()), 'entry_sha256': sha(entry.encode()), 'projection': proof}))
