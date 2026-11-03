"""Same owned ACL/identity binding and bridge dispatch, new compatibility SQL."""
from pathlib import Path
import importlib.util
import json
import sys
import types
HERE = Path(__file__).resolve().parent
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = module('generation42_English_guard_collector_state', HERE.parent / 'presentation-generation-english-guard-release/state.py')
OLD = MAIN / 'development/m07/presentation-generation-raw-preimage-collector-proof/local.py'
s.need(s.sha(s.load(OLD)) == '314709a789ee0e53cac1e69abec26130a88d27531ab55e299924e427af732690')
old = module('generation42_frozen_raw_owned_adapter', OLD)


class Context(s.Context):
    def __init__(self):
        super().__init__(root=MAIN, source=MAIN)
        self.current = old.old.Canonical41Owned(root=MAIN, source=MAIN)
        self.b, self.tables = self.current.b, self.current.tables
        self.original_catalogue = self.current.original_catalogue

    bind = old.Context.bind
    render = old.Context.render

    def source_pins(self):
        pins = super().source_pins()
        pins[str(OLD)] = s.sha(s.load(OLD))
        s.need(s.sha(s.load(old.old.ACL)) == old.old.ACL_SHA)
        pins[str(old.old.ACL)] = old.old.ACL_SHA
        return dict(sorted(pins.items()))


def bind(function):
    namespace = dict(function.__globals__)
    namespace.update(Context=Context, s=s, HERE=HERE)
    return types.FunctionType(function.__code__, namespace, function.__name__, function.__defaults__, function.__closure__)


configuration, dispatch = bind(old.configuration), bind(old.dispatch)


if __name__ == '__main__':
    try:
        s.need(len(sys.argv) == 2)
        if sys.argv[1] == 'configuration':
            value = configuration()
        else:
            raw = sys.stdin.buffer.read(32 * 1024**2 + 1)
            s.need(0 < len(raw) <= 32 * 1024**2)
            value = dispatch(sys.argv[1], json.loads(raw))
        print(json.dumps(value, ensure_ascii=False, separators=(',', ':')))
    except Exception:
        __import__('traceback').print_exc(file=sys.stderr)
        print('{"result":"unconfirmed","code":"OWNED_GENERATION42_ENGLISH_GUARD_REFUSED"}', file=sys.stderr)
        sys.exit(1)
