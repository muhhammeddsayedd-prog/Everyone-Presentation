"""Same factored collector adapter with compact Context and original-query oracle."""
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


s = module('generation42_compact_collector_state', HERE.parent / 'presentation-generation-compact-release/state.py')
OLD = MAIN / 'development/m07/presentation-generation-factored-collector-proof/local.py'
s.need(s.sha(s.load(OLD)) == 'e63ade2b1b01cc51bf808b488e0731fd2346adede08486a4bba0802378975778')
old = module('generation42_frozen_factored_owned_adapter', OLD)


class Context(s.Context):
    def __init__(self):
        super().__init__(root=MAIN, source=MAIN)
        self.current = old.old.old.old.Canonical41Owned(root=MAIN, source=MAIN)
        self.b, self.tables = self.current.b, self.current.tables
        self.original_catalogue = self.current.original_catalogue

    bind, qualify, render, diagnostic = old.Context.bind, old.Context.qualify, old.Context.render, old.Context.diagnostic

    def source_pins(self):
        pins = super().source_pins()
        pins[str(OLD)] = s.sha(s.load(OLD))
        acl = old.old.old.old.ACL
        s.need(s.sha(s.load(acl)) == old.old.old.old.ACL_SHA)
        pins[str(acl)] = old.old.old.old.ACL_SHA
        return dict(sorted(pins.items()))


def bind(function, **values):
    namespace = dict(function.__globals__)
    namespace.update(Context=Context, s=s, HERE=HERE)
    namespace.update(values)
    return types.FunctionType(function.__code__, namespace, function.__name__, function.__defaults__, function.__closure__)


prior_configuration = bind(old.configuration)
prior_dispatch = bind(old.prior_dispatch)
dispatch = bind(old.dispatch, prior_dispatch=prior_dispatch)


def configuration():
    value = prior_configuration()
    value['original_snapshot_sql'] = Context().original_state_sql()
    return value


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
        print('{"result":"unconfirmed","code":"OWNED_GENERATION42_COMPACT_REFUSED"}', file=sys.stderr)
        sys.exit(1)
