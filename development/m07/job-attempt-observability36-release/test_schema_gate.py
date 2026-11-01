"""Inert catalogue-contract tests. No PostgreSQL or provider connection."""
import copy
import unittest
from pglast import parse_sql
from pglast import ast
from pglast.stream import RawStream
import schema_gate as gate


def after_fixture():
    """Synthetic metadata only; this is not an observed PostgreSQL catalogue."""
    value = copy.deepcopy(gate.EMPTY_SCHEMA)
    value['table'] = {'schema': 'eps', 'name': 'job_stage_attempts', 'owner': 'postgres',
                      'kind': 'r', 'persistence': 'p', 'rls': True, 'force_rls': True,
                      'partition': False, 'options': None, 'nonowner_acl': []}
    value['columns'] = [{'name': name, 'number': i, 'type_schema': 'pg_catalog', 'type': typ,
                         'not_null': name != 'workflow_execution_id', 'identity': '', 'generated': '',
                         'collation': 'pg_catalog.default' if typ == 'text' else None,
                         'default': "'1.0'::text" if i == 1 else None}
                        for i, (name, typ) in enumerate(gate.COLS, 1)]
    create = next(row.stmt for row in parse_sql(gate._source()) if isinstance(row.stmt, ast.CreateStmt))
    raw = []
    for item in create.tableElts:
        for con in (item.constraints or () if isinstance(item, ast.ColumnDef) else (item,)):
            if isinstance(con, ast.Constraint) and con.contype.name == 'CONSTR_CHECK':
                raw.append(RawStream()(con.raw_expr))
    for (name, (_, columns)), expr in zip(gate._check_identity().items(), raw, strict=True):
        value['constraints'].append({'name': name, 'kind': 'c', 'columns': sorted(columns), 'expr': expr,
                                     'reference': None, 'reference_columns': [], 'update': None, 'delete': None,
                                     'match': None, 'deferrable': False, 'deferred': False, 'validated': True, 'no_inherit': False})
    for kind, name, columns in [('p', 'job_stage_attempts_pkey', ['job_id', 'attempt_id']),
                                ('u', 'job_stage_attempts_job_id_attempt_key', ['job_id', 'attempt']),
                                ('f', 'job_stage_attempts_job_id_fkey', ['job_id'])]:
        value['constraints'].append({'name': name, 'kind': kind, 'columns': columns, 'expr': None,
                                     'reference': 'eps.jobs' if kind == 'f' else None,
                                     'reference_columns': ['id'] if kind == 'f' else [],
                                     'update': 'a' if kind == 'f' else None, 'delete': 'r' if kind == 'f' else None,
                                     'match': 's' if kind == 'f' else None, 'deferrable': False,
                                     'deferred': False, 'validated': True, 'no_inherit': None})
    for name, columns, classes, primary in [('job_stage_attempts_job_id_attempt_key', ['job_id', 'attempt'], ['uuid_ops', 'int4_ops'], False),
                                            ('job_stage_attempts_pkey', ['job_id', 'attempt_id'], ['uuid_ops', 'uuid_ops'], True)]:
        value['indexes'].append({'name': name, 'owner': 'postgres', 'method': 'btree', 'columns': columns,
                                'opclasses': ['pg_catalog.' + item for item in classes], 'options': [0, 0],
                                'unique': True, 'primary': primary, 'valid': True, 'ready': True, 'exclusion': False,
                                'nulls_not_distinct': False, 'attributes': 2, 'keys': 2, 'predicate': None, 'expressions': None})
    value['policies'] = [{'name': 'job_stage_attempts_capture', 'command': 'a', 'permissive': True,
                          'roles': ['eps_job_trace_owner'], 'using': None, 'check': '(pg_trigger_depth() > 0)'}]
    value['function_name_count'] = 1
    value['function'] = {'schema': 'eps', 'name': 'capture_job_stage_attempt', 'owner': 'eps_job_trace_owner',
                         'language': 'plpgsql', 'kind': 'f', 'security_definer': True, 'volatility': 'v',
                         'strict': False, 'leakproof': False, 'parallel': 'u', 'returns_set': False,
                         'result': 'pg_catalog.trigger', 'arguments': 0, 'argument_defaults': 0,
                         'config': ['search_path=""'], 'source_sha256': gate.EXPECTED_FUNCTION_SHA256, 'nonowner_acl': []}
    for table, name, function, typ, internal, reference in [
            ('eps.jobs', 'capture_job_stage_attempt', 'eps.capture_job_stage_attempt', 17, False, None),
            ('eps.jobs', 'RI_ConstraintTrigger_a_<oid>', 'pg_catalog.RI_FKey_noaction_upd', 17, True, gate.TABLE),
            ('eps.jobs', 'RI_ConstraintTrigger_a_<oid>', 'pg_catalog.RI_FKey_restrict_del', 9, True, gate.TABLE),
            (gate.TABLE, 'RI_ConstraintTrigger_c_<oid>', 'pg_catalog.RI_FKey_check_ins', 5, True, 'eps.jobs'),
            (gate.TABLE, 'RI_ConstraintTrigger_c_<oid>', 'pg_catalog.RI_FKey_check_upd', 17, True, 'eps.jobs')]:
        value['triggers'].append({'table': table, 'name': name, 'function': function, 'type': typ,
                                  'internal': internal, 'reference': reference,
                                  'constraint': 'job_stage_attempts_job_id_fkey' if internal else None,
                                  'enabled': 'O', 'deferrable': False, 'deferred': False,
                                  'columns': [] if internal else ['current_attempt_id'], 'args_bytes': 0,
                                  'old_table': None, 'new_table': None, 'name_matches_oid': True,
                                  'definition': None if internal else 'CREATE TRIGGER capture_job_stage_attempt AFTER UPDATE OF current_attempt_id ON eps.jobs FOR EACH ROW WHEN (new.current_attempt_id IS NOT NULL AND new.current_attempt_id IS DISTINCT FROM old.current_attempt_id) EXECUTE FUNCTION eps.capture_job_stage_attempt()',
                                  'constraint_index_table': 'eps.jobs' if internal else None,
                                  'constraint_index_columns': ['id'] if internal else []})
    value['role'] = {'name': 'eps_job_trace_owner', 'superuser': False, 'inherit': False, 'create_role': False,
                      'create_db': False, 'login': False, 'replication': False, 'bypass_rls': False,
                      'connection_limit': -1, 'valid_until': None, 'config': None}
    value['memberships'] = gate.membership_variants()[0]
    value['schema_acl'] = [{'object': 'eps', 'privilege': 'USAGE', 'grantor': 'postgres', 'grantable': False}]
    value['column_acl'] = [{'object': gate.TABLE, 'column': name, 'privilege': 'INSERT', 'grantor': 'postgres', 'grantable': False}
                           for name, _ in sorted(gate.COLS)]
    value['owned_objects'] = [{'kind': 'function', 'object': 'eps.capture_job_stage_attempt()'}]
    return value


class SchemaGateTests(unittest.TestCase):
    def test_before_requires_complete_absence(self):
        gate.check_schema_before(copy.deepcopy(gate.EMPTY_SCHEMA))
        for key in gate.EMPTY_SCHEMA:
            value = copy.deepcopy(gate.EMPTY_SCHEMA)
            value[key] = {'unexpected': True}
            with self.assertRaises(ValueError):
                gate.check_schema_before(value)

    def test_catalogue_query_is_safe_before_absence_and_is_one_select(self):
        statements = parse_sql(gate.new_schema_sql())
        self.assertEqual(len(statements), 1)
        self.assertEqual(statements[0].stmt.__class__.__name__, 'SelectStmt')
        self.assertNotIn("'eps.job_stage_attempts'::regclass", gate.new_schema_sql())

    def test_complete_synthetic_after_and_finite_creator_membership_variants(self):
        for matrix in gate.membership_variants():
            value = after_fixture()
            value['memberships'] = matrix
            gate.check_schema_after(value)
        self.assertIn('job_stage_attempts_check', gate._check_identity())
        self.assertIn('job_stage_attempts_check2', gate._check_identity())
        self.assertNotIn('job_stage_attempts_stage_attempt_check', gate._check_identity())

    def test_cooked_expression_forms_preserve_semantics_not_parenthesis_stripping(self):
        for left, right in [("stage in('a','b')", "stage=ANY(ARRAY['a'::text,'b'::text])"),
                            ('dispatch_generation between 1 and 9007199254740991', "dispatch_generation >= 1 AND dispatch_generation <= '9007199254740991'::bigint"),
                            ('pg_catalog.pg_trigger_depth()>0', 'pg_trigger_depth()>0')]:
            self.assertEqual(gate.expression(left), gate.expression(right))
        self.assertNotEqual(gate.expression('(a OR b) AND c'), gate.expression('a OR (b AND c)'))
        self.assertNotEqual(gate.expression('pg_trigger_depth()>0'), gate.expression('public.pg_trigger_depth()>0'))
        with self.assertRaises(ValueError):
            gate.expression('true); select true;--')

    def test_schema_owner_permission_source_and_constraint_drift_are_rejected(self):
        mutations = [lambda v: v['table'].update(force_rls=False),
                     lambda v: v['columns'][1].update(type='text'),
                     lambda v: v['columns'][0].update(default="'2.0'::text"),
                     lambda v: v['constraints'][0].update(expr='true'),
                     lambda v: v['constraints'][-2].update(columns=['job_id', 'stage', 'stage_attempt']),
                     lambda v: v['function'].update(source_sha256='0' * 64),
                     lambda v: v['function'].update(security_definer=False),
                     lambda v: v['function'].update(config=['search_path=public']),
                     lambda v: v['policies'][0].update(check='true'),
                     lambda v: v['role'].update(login=True),
                     lambda v: v['schema_acl'].append({'object': 'public', 'privilege': 'CREATE'}),
                     lambda v: v['column_acl'][0].update(privilege='SELECT'),
                     lambda v: v['table_acl'].append({'unexpected': True}),
                     lambda v: v['function']['nonowner_acl'].append({'role': 'authenticated', 'privilege': 'EXECUTE'}),
                     lambda v: v['memberships'][0].update(admin=True),
                     lambda v: v['memberships'][0].update(grantor='unknown'),
                     lambda v: v['memberships'].append({'role': 'privileged', 'member': gate.ROLE}),
                     lambda v: v['owned_objects'].append({'kind': 'function', 'object': 'eps.other()'})]
        for mutate in mutations:
            value = after_fixture()
            mutate(value)
            with self.subTest(mutate=mutate), self.assertRaises(ValueError):
                gate.check_schema_after(value)

    def test_trigger_scope_and_all_four_RI_bindings_are_required(self):
        for mutate in [lambda v: v['triggers'][0].update(type=19),
                       lambda v: v['triggers'][0].update(columns=['status']),
                       lambda v: v['triggers'][0].update(definition=v['triggers'][0]['definition'].replace('IS DISTINCT FROM', 'IS NOT DISTINCT FROM')),
                       lambda v: v['triggers'][1].update(name_matches_oid=False),
                       lambda v: v['triggers'][1].update(reference='eps.other'),
                       lambda v: v['triggers'].pop()]:
            value = after_fixture();mutate(value)
            with self.assertRaises(ValueError):
                gate.check_schema_after(value)

    def test_atomic_gate_uses_admitted_exact_template_and_bounded_disable_only(self):
        value = after_fixture()
        for enabled in ['O', 'D']:
            predicate = gate.gate_sql(value, enabled)
            self.assertEqual(len(parse_sql('select ' + predicate)), 1)
            self.assertIn("actual.value-'memberships'", predicate)
            self.assertIn("actual.value->'memberships' in(", predicate)
            copy_value = copy.deepcopy(value)
            copy_value['triggers'][0]['enabled'] = enabled
            gate.check_schema_after(copy_value, enabled)
        self.assertEqual(value['triggers'][0]['enabled'], 'O')
        value['triggers'][1]['enabled'] = 'D'
        with self.assertRaises(ValueError):
            gate.check_schema_after(value, 'D')
        with self.assertRaises(ValueError):
            gate.gate_sql(after_fixture(), 'R')

    def test_null_function_acl_expands_default_PUBLIC_execute_before_filtering(self):
        # PG17 NULL proacl means the default ACL, including PUBLIC EXECUTE.
        # It is never an empty nonowner ACL. The actual local gate proof still
        # must exercise this projection in PostgreSQL before a hosted release.
        self.assertIn("aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))a where a.grantee<>p.proowner", gate.new_schema_sql())
        value = after_fixture()
        value['function']['nonowner_acl'] = [{'role': '-', 'privilege': 'EXECUTE', 'grantable': False}]
        with self.assertRaises(ValueError):
            gate.check_schema_after(value)

    def test_local_proof_expression_is_exact_marked_and_uses_shared_comparison(self):
        for mode in ['O', 'D']:
            sql = gate.gate_sql_from_expression(gate.PROOF_EXPECTED_EXPR, mode)
            self.assertEqual(len(parse_sql('select ' + sql)), 1)
            self.assertIn(gate.PROOF_MARKER_EXPR, sql)
            self.assertIn("item->>'table'='eps.jobs'", sql)
            self.assertIn("item->>'name'='capture_job_stage_attempt'", sql)
            self.assertIn("item->'internal'='false'::jsonb", sql)
            self.assertIn("actual.value-'memberships'", sql)
        for expression in [None, "'{}'::jsonb", gate.PROOF_EXPECTED_EXPR + ';select true']:
            with self.assertRaises(ValueError):
                gate.gate_sql_from_expression(expression)
        with self.assertRaises(ValueError):
            gate.gate_sql_from_expression(gate.PROOF_EXPECTED_EXPR, 'A')


if __name__ == '__main__':
    unittest.main()
