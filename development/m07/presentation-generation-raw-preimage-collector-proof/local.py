"""Actual raw-preimage Context with accepted owned41/ACL qualifications only."""
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


s = module('generation42_raw_collector_state', HERE.parent / 'presentation-generation-raw-preimage-release/state.py')
OLD = MAIN / 'development/m07/presentation-generation-collector-proof/local.py'
s.need(s.sha(s.load(OLD)) == 'a1c047f20c7e75b241e01ff7b7b13fc6b2470cb00b85ba4e7f6713c78e52f7ef')
old = module('generation42_frozen_owned_ACL_adapter', OLD)


def bind(function):
    namespace = dict(function.__globals__)
    namespace.update(Context=Context, s=s, HERE=HERE)
    return types.FunctionType(function.__code__, namespace, function.__name__, function.__defaults__, function.__closure__)


class Context(s.Context):
    def __init__(self):
        super().__init__(root=MAIN, source=MAIN)
        self.current = old.Canonical41Owned(root=MAIN, source=MAIN)
        self.b, self.tables = self.current.b, self.current.tables
        self.original_catalogue = self.current.original_catalogue

    bind = old.Context.bind  # Same code, dynamic self.check is exact raw42.

    def render(self, before, marker):
        canonical = s.Context.render(self, before, marker)
        original = "current_database()<>'postgres'"
        replacement = "current_database()<>'project39'or(pg_control_system()).system_identifier::text<>" + s.literal(self.system) + "or current_setting('eps.generation42collector.run',true)is distinct from" + s.literal(self.run)
        s.need(canonical.count(original) == 1)
        value = canonical.replace(original, replacement, 1)
        s.need(value.replace(replacement, original, 1) == canonical)
        return value

    def source_pins(self):
        pins = super().source_pins()
        pins[str(OLD)] = s.sha(s.load(OLD))
        s.need(s.sha(s.load(old.ACL)) == old.ACL_SHA)
        pins[str(old.ACL)] = old.ACL_SHA
        return dict(sorted(pins.items()))


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
        print('{"result":"unconfirmed","code":"OWNED_GENERATION42_RAW_REFUSED"}', file=sys.stderr)
        sys.exit(1)
