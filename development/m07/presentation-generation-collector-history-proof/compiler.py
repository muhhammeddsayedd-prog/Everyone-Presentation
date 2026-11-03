"""Fresh ownership over frozen collector; only its post41 expectation changes."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD = MAIN / 'development/m07/presentation-generation-collector-proof'
PINS = {
    'compiler.py': 'a76e94375dc519218ee56dd91c968ada7ad07a7ca00c951739709e9d5c25fb2f',
    'entry.mjs': '12ef5cf69bdc65d06a49bf2c567b896e77bf388df1cc0b283e976c9381b9e7f3',
    'local.py': 'a1c047f20c7e75b241e01ff7b7b13fc6b2470cb00b85ba4e7f6713c78e52f7ef',
    'README.md': 'c020ee741b462f7bb57eec355661cf5c4c876d14c536362cf80e9e6522f89266',
    'test_collector.py': 'b66b03926e4517824812e6b2c04f16d314722adfd00fa6484ff8f0a33c354555',
}
RAW = 'tracking/evidence/m07/presentation-generation-collector-proof/2026-11-03T10-56-59.946Z-7ea4ca87.json'
RAW_SHA = 'fc2cf8ee9960f97ff217316b5336b2f2dd0074394b14fdef6585fe267ce15444'
AUDIT = 'tracking/evidence/m07/presentation-generation-collector-proof/Root-7ea4ca87-postrun-audit.json'
AUDIT_SHA = '780d071f61ad65f13ff8119077f9198a8bf2e48e44d298b1f21018191771cae1'
ARMED = '6d2ceda0d9fd97da0bdb45c2c8938c289e87be666a66568db2ed1a2eb9913acb'
ENTRY = b'/** Fresh owned history-guard successor; no old entry or claim is replayed. */\nexport const EXECUTION_ENABLED = false;\n'
OLD_GUARD = 'assert.deepEqual(actualHistory.history,cfg.history40);'
NEW_GUARD = "assert.deepEqual(actualHistory.history,[...cfg.history40,'20261103031200']);"
OLD_META = 'report.catalogue40_setup_delta = delta; report.catalogue40_setup_delta_sha256 = sha(JSON.stringify(delta));report.restored_current40_history_count=40;'
NEW_META = 'report.catalogue41_setup_delta = delta; report.catalogue41_setup_delta_sha256 = sha(JSON.stringify(delta));report.restored_current41_history_count=41;'


def need(ok):
    if not ok:
        raise ValueError('GENERATION_COLLECTOR_HISTORY_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def project(text, changes):
    before = text
    for old, new in changes:
        need(text.count(old) == 1)
        text = text.replace(old, new, 1)
    inverse = text
    for old, new in reversed(changes):
        need(inverse.count(new) == 1)
        inverse = inverse.replace(new, old, 1)
    need(inverse == before)
    return text


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-collector-history-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    flag = (HERE / 'entry.mjs').read_bytes()
    armed = ENTRY.replace(b'EXECUTION_ENABLED = false;', b'EXECUTION_ENABLED = true;')
    need(flag in (ENTRY, armed))
    for name, digest in PINS.items():
        need(sha((OLD / name).read_bytes()) == digest)
    for name, digest in [(RAW, RAW_SHA), (AUDIT, AUDIT_SHA)]:
        need(sha((MAIN / name).read_bytes()) == digest)
    raw = json.loads((MAIN / RAW).read_bytes())
    audit = json.loads((MAIN / AUDIT).read_bytes())
    need(raw['run_id'] == audit['run_id'] == '7ea4ca87-98e5-4f20-bce1-739816a5858b')
    need(raw['result'] == 'failed' and audit['normal_process_exit'] == 1 and audit['collector_validation_started'] is False and audit['seven_target_42_migration_dispatched'] is False)
    need(audit['actual_receipt'] == {'path': RAW, 'sha256': RAW_SHA} and audit['actual_accepted41_fixture_appended_before_legacy40_assertion'] is True)
    need(all(raw[key] is True for key in ['all_owned_resources_absent', 'original_data_catalogue_and_global_roles_unchanged', 'shared_lock_released']))
    entry = (OLD / 'entry.mjs').read_bytes()
    need(raw['source_seals']['development/m07/presentation-generation-collector-proof/entry.mjs'] == ARMED)
    need(entry.count(b'EXECUTION_ENABLED = false;') == 1 and sha(entry.replace(b'EXECUTION_ENABLED = false;', b'EXECUTION_ENABLED = true;', 1)) == ARMED)
    parent = module('generation_history_frozen_compiler', OLD / 'compiler.py')
    parent_relative = relative.replace('presentation-generation-collector-history-compiled', 'presentation-generation-collector-compiled')
    source, bridge, entry, prior = parent.compile_source(parent_relative)
    begin = source.index('const cfg=') + len('const cfg=')
    cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
    old_cfg, old_entry = json.dumps(cfg, sort_keys=True), cfg['entry_file']
    for key in ('entry_file', 'bridge_file'):
        cfg['source_pins'].pop(cfg[key])
    cfg.update(controller=str(MAIN / relative), bridge_file=str(MAIN / relative.replace('/controller-', '/bridge-')),
               entry_file=str(MAIN / relative.replace('/controller-', '/entry-')))
    bridge = project(bridge, [("'.local/presentation-generation-collector-proof'", "'.local/presentation-generation-collector-history-proof'")])
    entry = project(entry, [
        ('export const EXECUTION_ENABLED = false;', 'export const EXECUTION_ENABLED = ' + str(flag == armed).lower() + ';'),
        ("'.local/presentation-generation-collector-once'", "'.local/presentation-generation-collector-history-once'"),
        ("'label=eps.generationcollector.run='", "'label=eps.genhistory.run='"),
    ])
    cfg['entry_sha256'], cfg['bridge_sha256'] = sha(entry.encode()), sha(bridge.encode())
    cfg['source_pins'].update({cfg['entry_file']: cfg['entry_sha256'], cfg['bridge_file']: cfg['bridge_sha256']})
    for file in [MAIN / RAW, MAIN / AUDIT, *sorted(HERE.iterdir())]:
        if file.is_file():
            cfg['source_pins'][str(file)] = sha(file.read_bytes())
    changes = [('const cfg=' + old_cfg + ';', 'const cfg=' + json.dumps(cfg, sort_keys=True) + ';'),
               (Path(old_entry).as_uri(), Path(cfg['entry_file']).as_uri()), (OLD_GUARD, NEW_GUARD), (OLD_META, NEW_META)]
    changes += [
        ("'.local/presentation-generation-collector-proof'", "'.local/presentation-generation-collector-history-proof'"),
        ("'eps.generationcollector.run'", "'eps.genhistory.run'"),
        ("'eps.generationcollector.workspace'", "'eps.genhistory.workspace'"),
        ("'eps.generationcollector.purpose'", "'eps.genhistory.purpose'"),
        ("'generation-seven-target-collector-transaction-rehearsal'", "'generation-seven-target-post41-history-collector-rehearsal'"),
        ("'eps-generationcollector-'", "'eps-genhistory-'"),
        ("'presentation-generation-collector-owned-proof'", "'presentation-generation-collector-history-owned-proof'"),
        ("'tracking/evidence/m07/presentation-generation-collector-proof'", "'tracking/evidence/m07/presentation-generation-collector-proof/history-successor'"),
    ]
    marker = 'report.source_seals = {}; for (const [root, file] of '
    start = source.index(marker) + len(marker)
    end = source.index(') {\n      const bytes', start)
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
                                 'parent_entry_inverse_byte_equal': True, 'only_post41_guard_and_current_metadata_changed': True,
                                 'pre41_guards_Context_SQL_and_bounds_unchanged': True, 'source_pins': cfg['source_pins'],
                                 'parent_projection': prior}


if __name__ == '__main__':
    relative = '.local/presentation-generation-collector-history-compiled/controller-' + str(uuid.uuid4()) + '.mjs'
    controller, bridge, entry, proof = compile_source(relative)
    for kind, text in [('bridge', bridge), ('entry', entry), ('controller', controller)]:
        file = MAIN / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'controller': relative,
                      'controller_sha256': sha(controller.encode()), 'bridge_sha256': sha(bridge.encode()),
                      'entry_sha256': sha(entry.encode()), 'projection': proof}))
