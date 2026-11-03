"""Unbound/default-off seven-target adapter over the accepted normal CLI phases."""
from pathlib import Path
import copy
import datetime
import importlib.util
import json
import sys
import types

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('generation42_state', HERE / 'state.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
PARENT = 'development/m07/logo-info-canonical-alias-release/release.py'
PARENT_SHA = 'e7d2089261fb8bc8269907cd5148e5ac9428e7c20d4a8cf3385cd3bcdf9de67d'
parent = s.module('generation42_accepted_normal_phases', s.MAIN / PARENT, PARENT_SHA)
READ_ENABLED=False
APPLY_ENABLED=False
PURPOSE = 'presentation-generation-canonical-release'
COLLECTOR_FAMILY = 'presentation-generation-collector-proof'


def bind(function):
    namespace = dict(function.__globals__)
    namespace.update(s=s, PURPOSE=PURPOSE, READ_ENABLED=True, APPLY_ENABLED=True)
    return types.FunctionType(function.__code__, namespace, function.__name__, function.__defaults__, function.__closure__)


Base = type('GenerationPhaseLibrary', (), {name: bind(value) for name, value in vars(parent.Base).items() if isinstance(value, types.FunctionType)})
# These methods also use module-global version/SHA/native anchors. Rebind their
# globals instead of silently retaining the defining logo41 module's constants.
response_binding = bind(parent.old.Release.response_binding)
worker = bind(parent.old.Release.worker)


class Release(Base):
    def __init__(self, run, context=None):
        Base.__init__(self, run, context or s.Context())

    def enabled(self, apply=False):
        s.need(READ_ENABLED and (not apply or APPLY_ENABLED))
        self.c.require_ready()

    def query(self, sql, label):
        self.enabled(label == 'apply')
        return Base.query(self, sql, label)

    def snapshot(self):
        self.enabled()
        return Base.snapshot(self)

    def checkpoint(self, phase, expected, installed):
        self.enabled()
        value = Base.checkpoint(self, phase, expected, installed)
        value['history_path'] = ['state', 'history', 'versions']
        return value

    def prepare(self):
        self.enabled()
        value = Base.prepare(self)
        value['worker'] = self.last_worker
        return value

    def apply(self):
        self.enabled(True)
        value = Base.apply(self)
        value['worker'] = getattr(self, 'last_worker', None)
        return value

    def reconcile(self):
        self.enabled()
        value = Base.reconcile(self)
        if value.get('checkpoint'):
            value['checkpoint']['history_path'] = ['state', 'history', 'versions']
        return value

    response_binding = response_binding
    worker = worker

    def admission(self):
        self.enabled()
        value = self.c.admission()
        # Same existing protected validation reference and collector checks. Its
        # family/version stay unbound until the exact new collector exists.
        s.need(isinstance(COLLECTOR_FAMILY, str) and COLLECTOR_FAMILY)
        reference = self.read(self.private / 'query-validation.json')
        s.need(type(reference) is dict and set(reference) == {'path', 'sha256'})
        relative = Path(reference['path'])
        s.need(not relative.is_absolute() and '..' not in relative.parts and relative.parts[:4] == ('tracking', 'evidence', 'm07', COLLECTOR_FAMILY))
        raw = s.load(self.c.source / relative)
        validate = bind(parent.old.validate_collector_proof)
        # Its source-seal loop must identify this new entry, not logo41's file.
        validate.__globals__.update(HERE=HERE)
        validate(raw, reference['sha256'], self.c.source_pins())
        value['collector_validation'] = reference
        value['normal_phase_bytecode_reused'] = True
        return value

    def compare_checkpoints(self, before, after):
        left, right = self.checkpoint_read(before), self.checkpoint_read(after)
        s.need(left['state'] == self.read(self.plan)['before'])
        self.c.transition(left['state'], right['state'])
        for table in self.c.tables:
            s.need(sorted(map(parent.old.old.encoded, left['application_tables'][table])) == sorted(map(parent.old.old.encoded, right['application_tables'][table])))
        catalogue = dict(left['catalogue'])
        functions = copy.deepcopy(left['function_rows'])
        for name, item in self.c.targets.items():
            catalogue['functions|' + name + '|source_sha256'] = item['after_sha256']
            oid = left['state']['targets'][name]['identity']['oid']
            selected = [row for row in functions if str(row['oid']) == str(oid)]
            s.need(len(selected) == 1 and selected[0]['prosrc'] == item['before_body'])
            selected[0]['prosrc'] = item['after_body']
        s.need(right['catalogue'] == catalogue and right['function_rows'] == functions)
        s.need(right['history_rows'] == left['history_rows'] + [{'version': s.VERSION, 'statements': [], 'name': s.MIGRATION_NAME}])
        return True


def save(action, value, root):
    directory = root / 'tracking/evidence/m07' / PURPOSE
    directory.mkdir(parents=True, exist_ok=True)
    file = directory / (datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H-%M-%S-%fZ') + '-' + action + '.json')
    document = {'schema_version': '1.0', 'purpose': PURPOSE, 'action': action, 'target': s.TARGET, 'version': s.VERSION, 'migration_sha256': s.MIGRATION_SHA, 'raw_payloads_logged': False, 'private_checkpoint_is_restore_proof': False, **value}
    with file.open('x', encoding='utf8', newline='\n') as stream:
        stream.write(json.dumps(document, sort_keys=True, indent=2) + '\n')
    return file.relative_to(root).as_posix()


def main(argv=None):
    args = sys.argv[1:] if argv is None else argv
    s.need(len(args) == 2 and args[0] in ('prepare', 'apply', 'reconcile'))
    s.need(READ_ENABLED and (args[0] != 'apply' or APPLY_ENABLED) and s.READY)
    operator = Release(args[1])
    value = getattr(operator, args[0])()
    print(json.dumps({'result': value['result'], 'receipt': save(args[0], value, operator.c.source)}))
    s.need(value['result'] in ('passed', 'prepared'))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"result":"unconfirmed","safe_error_code":"GENERATION42_UNBOUND_OR_UNCONFIRMED"}', file=sys.stderr)
        sys.exit(1)
