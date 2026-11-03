"""Finite successor of the accepted41 collector; unbound configuration refuses."""
from pathlib import Path
import hashlib
import importlib.util
import json
import re
import uuid

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
OLD = MAIN / 'development/m07/logo-info-collector-alias-proof'
PARENT_SHA = 'd8ca38da435b20371aef254529d942b8e9727045e29dc7570d66c7e1e34b94b7'
MIGRATION41 = MAIN / 'supabase/migrations/20261103031200_m07_logo_info_operation.sql'
MIGRATION41_SHA = '4af699abab0501cade40f98e2104f2fb2d563ce6a43d0cb06d83744035a278ec'
ENTRY = b'/** Fresh owned collector purpose; the canonical adapter stays independently OFF. */\nexport const EXECUTION_ENABLED = false;\n'


def need(ok):
    if not ok:
        raise ValueError('GENERATION42_COLLECTOR_SOURCE_UNCONFIRMED')


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def compile_source(relative):
    match = re.fullmatch(r'\.local/presentation-generation-collector-compiled/controller-([a-f0-9-]{36})\.mjs', relative)
    need(match is not None and str(uuid.UUID(match[1])) == match[1] and uuid.UUID(match[1]).version == 4)
    flag = (HERE / 'entry.mjs').read_bytes()
    armed = ENTRY.replace(b'EXECUTION_ENABLED = false;', b'EXECUTION_ENABLED = true;')
    need(flag in (ENTRY, armed))
    local = module('generation42_owned_context', HERE / 'local.py')
    actual = local.configuration()  # READY/proof/version/migration admission first.
    need(sha((OLD / 'compiler.py').read_bytes()) == PARENT_SHA)
    migration41 = MIGRATION41.read_bytes()
    need(sha(migration41) == MIGRATION41_SHA)
    parent = module('generation42_accepted_collector_compiler', OLD / 'compiler.py')
    parent_relative = relative.replace('presentation-generation-collector-compiled', 'logo-info-collector-alias-compiled')
    source, bridge, entry, prior = parent.compile_source(parent_relative)
    before, before_bridge, before_entry = source, bridge, entry
    edits = []
    begin = source.index('const cfg=') + len('const cfg=')
    cfg, _ = json.JSONDecoder().raw_decode(source[begin:])
    old_cfg = json.dumps(cfg, sort_keys=True)
    old_entry = cfg['entry_file']
    for key in ('entry_file', 'bridge_file'):
        cfg['source_pins'].pop(cfg[key])
    cfg.update(controller=str(MAIN / relative), bridge_file=str(MAIN / relative.replace('/controller-', '/bridge-')),
               entry_file=str(MAIN / relative.replace('/controller-', '/entry-')),
               snapshot_sql=actual['snapshot_sql'], checkpoint_sql=actual['checkpoint_sql'],
               version=actual['version'], migration_sha256=actual['migration_sha256'],
               owned_qualifications=actual['owned_qualifications'])

    def projection(text, changes):
        original = text
        for a, b in changes:
            need(text.count(a) == 1)
            text = text.replace(a, b, 1)
        inverse = text
        for a, b in reversed(changes):
            need(inverse.count(b) == 1)
            inverse = inverse.replace(b, a, 1)
        need(inverse == original)
        return text

    bridge = projection(bridge, [
        ('const LOCAL=' + json.dumps(str(OLD / 'local.py').replace('\\', '/')) + ';', 'const LOCAL=' + json.dumps(str(HERE / 'local.py').replace('\\', '/')) + ';'),
        ("'.local/logo-info-collector-alias-proof'", "'.local/presentation-generation-collector-proof'"),
    ])
    entry = projection(entry, [
        ('export const EXECUTION_ENABLED = false;', 'export const EXECUTION_ENABLED = ' + str(flag == armed).lower() + ';'),
        ("'.local/logo-info-collector-alias-once'", "'.local/presentation-generation-collector-once'"),
        ("'label=eps.logoalias.run='", "'label=eps.generationcollector.run='"),
        ('eps.logo41collector.run', 'eps.generation42collector.run'),
        ('changed.compatibility.schema40.canonical.base.data.audit_events.sha256, initial.compatibility.schema40.canonical.base.data.audit_events.sha256', 'changed.canonical41.compatibility.schema40.canonical.base.data.audit_events.sha256, initial.canonical41.compatibility.schema40.canonical.base.data.audit_events.sha256'),
        ('LOGO41_PREIMAGE_CHANGED', 'GENERATION42_PREIMAGE_CHANGED'),
        ('ctx.report.final_history_count = 41;', 'ctx.report.final_history_count = 42;'),
    ])
    cfg['entry_sha256'], cfg['bridge_sha256'] = sha(entry.encode()), sha(bridge.encode())
    cfg['source_pins'].update(actual['source_pins'])
    cfg['source_pins'].update({cfg['entry_file']: cfg['entry_sha256'], cfg['bridge_file']: cfg['bridge_sha256'], str(MIGRATION41): MIGRATION41_SHA})
    for file in [OLD / 'compiler.py', OLD / 'local.py', *sorted(HERE.iterdir())]:
        if file.is_file():
            cfg['source_pins'][str(file)] = sha(file.read_bytes())

    def edit(a, b):
        nonlocal source
        need(source.count(a) == 1)
        source = source.replace(a, b, 1)
        edits.append((a, b))

    edit('const cfg=' + old_cfg + ';', 'const cfg=' + json.dumps(cfg, sort_keys=True) + ';')
    edit(Path(old_entry).as_uri(), Path(cfg['entry_file']).as_uri())
    for a, b in [
        ("'.local/logo-info-collector-alias-proof'", "'.local/presentation-generation-collector-proof'"),
        ("'eps.logoalias.run'", "'eps.generationcollector.run'"),
        ("'eps.logoalias.workspace'", "'eps.generationcollector.workspace'"),
        ("'eps.logoalias.purpose'", "'eps.generationcollector.purpose'"),
        ("'logo-info-alias-collector-transaction-rehearsal'", "'generation-seven-target-collector-transaction-rehearsal'"),
        ("'eps-logoalias-'", "'eps-generationcollector-'"),
        ("'logo-info-collector-alias-owned-proof'", "'presentation-generation-collector-owned-proof'"),
        ("'tracking/evidence/m07/logo-info-collector-proof/alias-successor'", "'tracking/evidence/m07/presentation-generation-collector-proof'"),
    ]:
        edit(a, b)
    # Accepted41 is a declared prerequisite, before the inherited first snapshot.
    # Its exact original guard is inversely qualified to this owned cluster only.
    fixture = """    let migration41=MIGRATION41;const canonical41Guard="current_database()<>'postgres'",owned41Guard="current_database()<>'project39'or(pg_control_system()).system_identifier::text<>"+quote(identity.system_identifier)+"or current_setting('eps.generation42collector.run',true)is distinct from"+quote(runId);assert.equal(migration41.split(canonical41Guard).length,2);migration41=migration41.replace(canonical41Guard,owned41Guard);assert.equal(migration41.replace(owned41Guard,canonical41Guard),MIGRATION41);
    await sql("set session authorization postgres;begin;set local eps.generation42collector.run="+quote(runId)+';'+migration41+"insert into supabase_migrations.schema_migrations(version,statements,name)values('20261103031200',array[]::text[],'m07_logo_info_operation');commit;");
""".replace('MIGRATION41', json.dumps(migration41.decode('utf8')))
    marker = '    await sql(snapshot);report.declared_owned_fixture='
    edit(marker, fixture + marker)
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
    edit(source[start:end], json.dumps(records))
    inverse = source
    for a, b in reversed(edits):
        need(inverse.count(b) == 1)
        inverse = inverse.replace(b, a, 1)
    need(inverse == before)
    return source, bridge, entry, {'parent_controller_inverse_byte_equal': True, 'parent_entry_inverse_byte_equal': True,
                                  'parent_bridge_inverse_byte_equal': True, 'accepted41_declared_before_clone_baseline': True,
                                  'actual_seven_target_Context': True, 'source_pins': cfg['source_pins'],
                                  'snapshot_sha256': sha(cfg['snapshot_sql'].encode()), 'checkpoint_sha256': sha(cfg['checkpoint_sql'].encode()),
                                  'parent_projection': prior, 'transport_or_bounds_changed': False}


if __name__ == '__main__':
    relative = '.local/presentation-generation-collector-compiled/controller-' + str(uuid.uuid4()) + '.mjs'
    controller, bridge, entry, proof = compile_source(relative)
    for kind, text in [('bridge', bridge), ('entry', entry), ('controller', controller)]:
        file = MAIN / relative.replace('/controller-', '/' + kind + '-')
        file.parent.mkdir(parents=True, exist_ok=True)
        with file.open('x', encoding='utf8', newline='\n') as stream:
            stream.write(text)
    print(json.dumps({'compiled_only': True, 'execution_dispatched': False, 'controller': relative,
                      'controller_sha256': sha(controller.encode()), 'entry_sha256': sha(entry.encode()),
                      'bridge_sha256': sha(bridge.encode()), 'projection': proof}))
