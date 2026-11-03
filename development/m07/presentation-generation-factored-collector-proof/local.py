"""Same owned qualification/checks; render action supplies the factored pair."""
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


s = module('generation42_factored_collector_state', HERE.parent / 'presentation-generation-factored-release/state.py')
OLD = MAIN / 'development/m07/presentation-generation-english-guard-collector-proof/local.py'
s.need(s.sha(s.load(OLD)) == '49cf2ded84999f34cb3aa8ca9cf89647eeab52dc9ac1c8776eefb78f4adec03c')
old = module('generation42_frozen_passed_collector_adapter', OLD)


class Context(s.Context):
    def __init__(self):
        super().__init__(root=MAIN, source=MAIN)
        self.current = old.old.old.Canonical41Owned(root=MAIN, source=MAIN)
        self.b, self.tables = self.current.b, self.current.tables
        self.original_catalogue = self.current.original_catalogue

    bind = old.Context.bind

    def qualify(self, sql):
        original = "current_database()<>'postgres'"
        replacement = "current_database()<>'project39'or(pg_control_system()).system_identifier::text<>" + s.literal(self.system) + "or current_setting('eps.generation42collector.run',true)is distinct from" + s.literal(self.run)
        s.need(sql.count(original) == 1)
        value = sql.replace(original, replacement, 1)
        s.need(value.replace(replacement, original, 1) == sql)
        return value

    def render(self, before, marker):
        return self.qualify(s.Context.render(self, before, marker))

    def diagnostic(self, before, marker):
        return self.qualify(s.Context.diagnostic(self, before, marker))

    def source_pins(self):
        pins = super().source_pins()
        pins[str(OLD)] = s.sha(s.load(OLD))
        acl = old.old.old.ACL
        s.need(s.sha(s.load(acl)) == old.old.old.ACL_SHA)
        pins[str(acl)] = old.old.old.ACL_SHA
        return dict(sorted(pins.items()))


def bind(function):
    namespace = dict(function.__globals__)
    namespace.update(Context=Context, s=s, HERE=HERE)
    return types.FunctionType(function.__code__, namespace, function.__name__, function.__defaults__, function.__closure__)


configuration = bind(old.configuration)
prior_dispatch = bind(old.dispatch)


def dispatch(action, value):
    if action != 'render':
        return prior_dispatch(action, value)
    c = Context().bind(value['initial'], value['system'], value['run'])
    before, marker = value['before'], value['marker']
    sql, diagnostic = c.render(before, marker), c.diagnostic(before, marker)
    return {'sql': sql, 'diagnostic_sql': diagnostic, 'expected': c.expected(before),
            'sql_sha256': s.sha(sql.encode()), 'diagnostic_sha256': s.sha(diagnostic.encode())}


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
        print('{"result":"unconfirmed","code":"OWNED_GENERATION42_FACTORED_REFUSED"}', file=sys.stderr)
        sys.exit(1)
