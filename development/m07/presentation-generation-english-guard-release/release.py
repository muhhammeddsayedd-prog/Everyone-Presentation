"""New OFF purpose, exact normal CLI phase bytecode with the new Context."""
from pathlib import Path
import importlib.util
import sys
import json
import types
HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('generation42_English_guard_Context', HERE / 'state.py')
s = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(s)
old = s.module('generation42_frozen_raw_release', s.MAIN / 'development/m07/presentation-generation-raw-preimage-release/release.py', 'f5a5a7fa8b4e43403e82e0174050d2af3634a34925b731ffc0fd65546e5b643c')
READ_ENABLED=True
APPLY_ENABLED=True
PURPOSE = 'presentation-generation-english-guard-release'
COLLECTOR_FAMILY = 'presentation-generation-english-guard-collector-proof'


def bind(function, **values):
    namespace = dict(function.__globals__)
    namespace.update(s=s, PURPOSE=PURPOSE, HERE=HERE, READ_ENABLED=True, APPLY_ENABLED=True, COLLECTOR_FAMILY=COLLECTOR_FAMILY, bind=bind)
    namespace.update(values)
    return types.FunctionType(function.__code__, namespace, function.__name__, function.__defaults__, function.__closure__)


Base = type('EnglishGuardNormalPhaseLibrary', (), {name: bind(value) for name, value in vars(old.Base).items() if isinstance(value, types.FunctionType)})
Phase = type('EnglishGuardPhaseMethods', (old.Release,), {name: bind(value, Base=Base) for name, value in vars(old.Phase).items() if isinstance(value, types.FunctionType)})


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
        print('{"result":"unconfirmed","safe_error_code":"GENERATION42_ENGLISH_GUARD_UNCONFIRMED"}', file=sys.stderr)
        sys.exit(1)
