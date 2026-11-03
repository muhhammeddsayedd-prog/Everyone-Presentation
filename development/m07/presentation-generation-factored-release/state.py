"""Same complete state query declared once; no transport or target changes."""
from pathlib import Path
import hashlib
import importlib.util

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parents[2]
MAIN = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
PARENT = MAIN / 'development/m07/presentation-generation-english-guard-release/state.py'
PARENT_SHA = '330a8e89a266773d57ab0a51e4413a80ce2ac327a10467269ba7bcf9bcd8bcdb'
_stat = PARENT.lstat()
if not (PARENT.is_file() and not PARENT.is_symlink() and PARENT.resolve() == PARENT and _stat.st_nlink == 1 and 0 < _stat.st_size <= 16 * 1024**2 and hashlib.sha256(PARENT.read_bytes()).hexdigest() == PARENT_SHA):
    raise ValueError('GENERATION42_FACTORED_SOURCE_UNCONFIRMED')
_spec = importlib.util.spec_from_file_location('generation42_frozen_complete_state', PARENT)
parent = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(parent)
for _name in ('TARGET', 'MAXIMUM', 'VERSION', 'MIGRATION', 'MIGRATION_SHA', 'MIGRATION_NAME', 'REMAINING_PROOF_REF', 'REMAINING_AUDIT_REF', 'READY', 'FIXED', 'TARGETS', 'uuid', 'need', 'sha', 'load', 'literal', 'json_sql', 'digest', 'parts', 'module'):
    globals()[_name] = getattr(parent, _name)
RECONCILIATION = {'path': 'tracking/evidence/m07/presentation-generation-english-guard-release/Root-928c19af-413-read-only-reconciliation.json', 'sha256': '3e9ef391c8dafc2ffbb56b0d11c20893087b1a36b0e337ef38fd475451ccc2e7'}


class Context(parent.Context):
    def __init__(self, root=MAIN, source=SOURCE):
        super().__init__(root=root, source=source)

    def rendering(self, before, marker):
        original = parent.Context.render(self, before, marker)
        query, migration, after = self.state_sql(), self.require_ready().decode('utf8'), self.expected(before)

        def assertion(value, tag):
            return 'do $generation42$declare observed jsonb;begin ' + query + ' into observed;if observed is distinct from ' + json_sql(value) + " then raise exception'" + tag + "';end if;end$generation42$;\n"

        left = assertion(before, 'GENERATION42_PREIMAGE_CHANGED')
        right = assertion(after, 'GENERATION42_POSTIMAGE_CHANGED')
        need(original.count(left) == original.count(right) == 1 and original.count(query) == 2)
        prefix, rest = original.split(left, 1)
        middle, tail = rest.split(right, 1)
        append = "insert into supabase_migrations.schema_migrations(version,statements,name)values(" + literal(self.version()) + ',array[]::text[],' + literal(MIGRATION_NAME) + ');\n'
        need(middle == migration + append and prefix + left + middle + right + tail == original)
        query_tag = '$g42_state_' + sha(query.encode())[:24] + '$'
        block_tag = '$g42_block_' + sha(original.encode())[:24] + '$'
        need(query_tag not in query and block_tag not in original)
        declaration = 'do ' + block_tag + 'declare g42_state_query constant text:=' + query_tag + query + query_tag + ';observed jsonb;g42_before constant jsonb:=' + json_sql(before) + ';g42_after constant jsonb:=' + json_sql(after) + ';begin\n'
        precheck = "execute g42_state_query into observed;if observed is distinct from g42_before then raise exception'GENERATION42_PREIMAGE_CHANGED';end if;\n"
        postcheck = "execute g42_state_query into observed;if observed is distinct from g42_after then raise exception'GENERATION42_POSTIMAGE_CHANGED';end if;\n"
        close = 'end' + block_tag + ';\n'
        normal = prefix + declaration + precheck + middle + postcheck + close + tail
        # Same existing diagnostic precondition/DDL/history/two-state-read flow;
        # no GUC, temp object or raw state NOTICE is introduced to return data.
        diagnostic = prefix + declaration + precheck + middle + close + query + 'as reason40_release;rollback;'
        need(normal.count(query) == 1 and normal.count('execute g42_state_query into observed;') == 2)
        need(diagnostic.count(query) == 2 and 'commit;' not in diagnostic)
        need(normal.count(migration) == 1 and normal.count(append) == 1 and tail.startswith('commit;select '))
        need(len(normal.encode()) <= MAXIMUM and len(diagnostic.encode()) <= MAXIMUM)
        proof = {'complete_state_query_sha256': sha(query.encode()), 'state_query_occurrences_normal': 1,
                 'same_state_query_executions_normal': 2, 'original_render_inverse_byte_equal': True,
                 'same_prefix_seven_DDL_history_and_commit_tail': True, 'no_new_catalogue_object_or_transport': True,
                 'migration_sha256': sha(migration.encode()), 'original_SQL_bytes': len(original.encode()),
                 'factored_SQL_bytes': len(normal.encode()), 'diagnostic_SQL_bytes': len(diagnostic.encode())}
        return normal, diagnostic, proof

    def render(self, before, marker):
        return self.rendering(before, marker)[0]

    def diagnostic(self, before, marker):
        return self.rendering(before, marker)[1]

    def admission(self):
        value = super().admission()
        raw = load(self.root / RECONCILIATION['path'])
        need(sha(raw) == RECONCILIATION['sha256'])
        import json
        observed = json.loads(raw)
        need(observed['result'] == 'observed_not_applied_original41_unchanged' and observed['safe_HTTP_status'] == 413)
        need(observed['normal_return_marker_observed'] is False and observed['SQL_or_claim_replayed'] is False)
        need(observed['two_fresh_read_only_full_states_equal_original_preimage'] is True and observed['new42_history_row_absent'] is True)
        value['prior_413_not_applied_reconciliation'] = RECONCILIATION
        return value

    def source_pins(self):
        pins = super().source_pins()
        pins[str(PARENT)] = PARENT_SHA
        file = self.root / RECONCILIATION['path']
        need(sha(load(file)) == RECONCILIATION['sha256'])
        pins[str(file)] = RECONCILIATION['sha256']
        for file in sorted(HERE.iterdir()):
            if file.is_file():
                pins[str(file)] = sha(load(file))
        return dict(sorted(pins.items()))
