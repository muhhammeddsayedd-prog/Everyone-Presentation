"""Owned identity qualification for the real seven-target Context; no DB port."""
from pathlib import Path
import copy
import importlib.util
import json
import re
import sys
import uuid

HERE = Path(__file__).resolve().parent
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = module('generation42_collector_context', HERE.parent / 'presentation-generation-canonical-release/state.py')
OLD = MAIN / 'development/m07/logo-info-collector-alias-proof/local.py'
s.need(s.sha(s.load(OLD)) == '3327262ac378a71ba38a3ab4fa84eeb077c1a65a70dacd1316d23bca1c92fafb')
old = module('generation42_accepted_owned_alias', OLD)
qualification = old.old.old


class Canonical41Owned(old.Context):
    def bind_installed(self, initial, system, run):
        # Same accepted owned identity/OID and synthetic ledger qualification,
        # with41 already installed as this new transaction's starting image.
        s.need(system.isdecimal() and system != qualification.ORIGINAL_SYSTEM and str(uuid.UUID(run)) == run and uuid.UUID(run).version == 4)
        value = initial['compatibility']
        s.need(value['schema40']['canonical']['base']['data']['oauth_consent_claims']['count'] == 2)
        context = qualification.OwnedContext(root=MAIN, source=MAIN).bind_current(value['schema40'], system, run)
        compat = qualification.m.State(old.old.s.NATIVE, context=context)
        compat.anchor = copy.deepcopy(value['schema40'])
        self.compat, self.system, self.run = compat, system, run
        self.check(initial, True)
        return self


class Context(s.Context):
    def __init__(self):
        super().__init__(root=MAIN, source=MAIN)
        self.current = Canonical41Owned(root=MAIN, source=MAIN)
        self.b, self.tables = self.current.b, self.current.tables
        self.original_catalogue = self.current.original_catalogue

    def bind(self, initial, system, run):
        self.current.bind_installed(initial['canonical41'], system, run)
        self.system, self.run = system, run
        self.check(initial, False)
        return self

    def render(self, before, marker):
        canonical = super().render(before, marker)
        original = "current_database()<>'postgres'"
        replacement = "current_database()<>'project39'or(pg_control_system()).system_identifier::text<>" + s.literal(self.system) + "or current_setting('eps.generation42collector.run',true)is distinct from" + s.literal(self.run)
        s.need(canonical.count(original) == 1)
        value = canonical.replace(original, replacement, 1)
        s.need(value.replace(replacement, original, 1) == canonical)
        return value


def configuration():
    c = Context()
    c.admission()
    return {'snapshot_sql': c.state_sql(), 'checkpoint_sql': c.checkpoint_sql(), 'source_pins': c.source_pins(),
            'version': s.VERSION, 'migration_sha256': s.MIGRATION_SHA,
            'owned_qualifications': {'database': 'project39', 'original_system_excluded': qualification.ORIGINAL_SYSTEM,
                                    'synthetic_OAuth_ledger_count': 2, 'fresh_owned_OIDs_not_canonical_OIDs': True,
                                    'protected_M02_and_CLI_identity_absent_only': True,
                                    'full_business_and_reason_columns_preserved': True, 'baseline_history': 41}}


def dispatch(action, value):
    c = Context().bind(value['initial'], value['system'], value['run'])
    if action == 'check':
        c.check(value['observed'], value.get('installed', False))
        return {'result': 'passed'}
    if action == 'render':
        sql = c.render(value['before'], value['marker'])
        assertions = list(re.finditer(r'do \$generation42\$declare observed jsonb;.*?end\$generation42\$;\n', sql, re.S))
        s.need(len(assertions) == 2)
        diagnostic = sql[:assertions[1].start()] + c.state_sql() + 'as reason40_release;rollback;'
        s.need('commit;' not in diagnostic)
        return {'sql': sql, 'diagnostic_sql': diagnostic, 'expected': c.expected(value['before']),
                'sql_sha256': s.sha(sql.encode()), 'diagnostic_sha256': s.sha(diagnostic.encode())}
    if action == 'diagnose':
        differences = qualification.differing_paths(c.expected(value['before']), value['observed'])
        if not differences:
            c.transition(value['before'], value['observed'])
        return {'result': 'passed' if not differences else 'differs', 'difference_count': len(differences),
                'differences': differences, 'normal_nonce_claimed': False}
    s.need(action == 'compare')
    left, right = value['before_checkpoint'], value['after_checkpoint']
    c.checkpoint_check(left, False)
    c.checkpoint_check(right, True)
    c.transition(left['state'], right['state'])
    release = module('generation42_actual_checkpoint_compare', HERE.parent / 'presentation-generation-canonical-release/release.py')

    class Views:
        plan = object()

        def checkpoint_read(self, reference):
            return left if reference == 'before' else right

        def read(self, _path):
            return {'before': left['state']}

    view = Views()
    view.c = c
    release.Release.compare_checkpoints(view, 'before', 'after')
    return {'result': 'passed', 'all76_full_rows_including_reason_preserved': True,
            'full_functions_catalogue_roles_dependencies_preserved': True, 'production_identity_admission_claimed': False}


if __name__ == '__main__':
    try:
        s.need(len(sys.argv) == 2)
        if sys.argv[1] == 'configuration':
            result = configuration()
        else:
            raw = sys.stdin.buffer.read(32 * 1024**2 + 1)
            s.need(0 < len(raw) <= 32 * 1024**2)
            result = dispatch(sys.argv[1], json.loads(raw))
        print(json.dumps(result, ensure_ascii=False, separators=(',', ':')))
    except Exception:
        __import__('traceback').print_exc(file=sys.stderr)
        print('{"result":"unconfirmed","code":"OWNED_GENERATION42_COLLECTOR_REFUSED"}', file=sys.stderr)
        sys.exit(1)
