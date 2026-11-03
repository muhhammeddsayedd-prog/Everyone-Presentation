"""New OFF normal-phase binding; consumed LF adapter and transports unchanged."""
from pathlib import Path
import importlib.util
import sys
import json
import types

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('generation42_exact_raw_state', HERE / 'state.py')
s = importlib.util.module_from_spec(spec)
spec.loader.exec_module(s)
OLD = s.MAIN / 'development/m07/presentation-generation-canonical-release/release.py'
OLD_SHA = '794ede7b0f76a8bc936b6cfa84c03e6a2cd99be0b97bf30aa51d1ae0e65891e6'
old = s.module('generation42_frozen_normal_phase_adapter', OLD, OLD_SHA)
READ_ENABLED=False
APPLY_ENABLED=False
PURPOSE = 'presentation-generation-raw-preimage-release'
COLLECTOR_FAMILY = 'presentation-generation-raw-preimage-collector-proof'


def bind(function, **values):
    namespace = dict(function.__globals__)
    namespace.update(s=s, PURPOSE=PURPOSE, READ_ENABLED=True, APPLY_ENABLED=True,
                     HERE=HERE, COLLECTOR_FAMILY=COLLECTOR_FAMILY, bind=bind)
    namespace.update(values)
    return types.FunctionType(function.__code__, namespace, function.__name__, function.__defaults__, function.__closure__)


Base = type('RawPreimageNormalPhaseLibrary', (), {name: bind(value) for name, value in vars(old.Base).items() if isinstance(value, types.FunctionType)})
methods = {name: bind(value, Base=Base) for name, value in vars(old.Release).items() if isinstance(value, types.FunctionType)}
Phase = type('RawPreimagePhaseMethods', (old.Release,), methods)


class Release(Phase):
    def enabled(self, apply=False):
        s.need(READ_ENABLED and (not apply or APPLY_ENABLED))
        self.c.require_ready()


save = bind(old.save)


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
        print('{"result":"unconfirmed","safe_error_code":"GENERATION42_RAW_PREIMAGE_UNCONFIRMED"}', file=sys.stderr)
        sys.exit(1)
