"""Inert structural/parse checks; native SQL authority is a later owned proof."""
import unittest
import re
from pglast import parse_sql, parse_plpgsql, ast
import build_migration as b


class MigrationTests(unittest.TestCase):
    def test_current_guest_port_matches_applied_source_and_single_additive_branch(self):
        old, new = b.guest_bodies()
        self.assertEqual(b.sha256(old.encode()).hexdigest(), b.OLD_GUEST_SHA)
        self.assertEqual(new, old.replace(b.ANCHOR, b.BRANCH + b.ANCHOR))
        self.assertEqual(new.count("p_operation='get_feedback_summary'"), 1)
        self.assertLess(new.index('perform eps.review_gateway_verify'), new.index("p_operation='get_feedback_summary'"))
        self.assertLess(new.index('session:=eps.guest_current'), new.index("p_operation='get_feedback_summary'"))
        self.assertIn('eps.feedback_version(eps.casting_uuid', b.BRANCH)
        self.assertIn('link.series_id', b.BRANCH)

    def test_complete_transaction_and_actual_function_bodies_parse(self):
        sql = b.render()
        parsed = parse_sql(sql)
        self.assertIsInstance(parsed[0].stmt, ast.TransactionStmt)
        self.assertIsInstance(parsed[-1].stmt, ast.TransactionStmt)
        functions = [x.stmt for x in parsed if isinstance(x.stmt, ast.CreateFunctionStmt)]
        self.assertEqual(['.'.join(n.sval for n in f.funcname) for f in functions], ['eps.feedback_summary', 'public.eps_get_feedback_summary'])
        for raw in parsed:
            if isinstance(raw.stmt, (ast.CreateFunctionStmt, ast.DoStmt)):
                statement = sql[raw.stmt_location:raw.stmt_location + raw.stmt_len] + ';'
                parse_plpgsql(statement)

    def test_permissions_and_source_guard_refuse_default_public_execute_and_create_drift(self):
        sql = b.render()
        self.assertIn("has_schema_privilege('eps_review_owner','eps','CREATE')", sql)
        self.assertIn("has_schema_privilege('eps_review_owner','public','CREATE')", sql)
        self.assertLess(sql.index('M07_FEEDBACK_EXACT36_REQUIRED'), sql.index('grant create on schema'))
        self.assertIn("aclexplode(coalesce(p.proacl,acldefault('f',p.proowner)))", sql)
        self.assertIn('x.grantor<>p.proowner', sql)
        self.assertIn('revoke all on function eps.feedback_summary(uuid,boolean),public.eps_get_feedback_summary(uuid)from public,anon,authenticated,service_role;', sql)
        self.assertIn('grant execute on function eps.feedback_summary(uuid,boolean)to eps_review_owner,eps_guest_owner;', sql)
        self.assertIn('grant execute on function public.eps_get_feedback_summary(uuid)to authenticated;', sql)
        self.assertNotRegex(sql, r'(?i)grant\s+(?:select|insert|update|delete)\b|create\s+(?:table|role|policy)|alter\s+(?:table|role|policy)')

    def test_aggregate_has_no_pagination_body_fields_or_cross_product(self):
        sql = b.render()
        body = sql.split('as $feedback37_summary$')[1].split('end$feedback37_summary$')[0]
        self.assertNotRegex(body, r'(?i)\b(?:limit|offset|cursor|author_display_name|company|body|guest_session_id)\b')
        self.assertIn('c.deleted_at is null', body)
        self.assertIn("not p_external or c.visibility='external'", body)
        self.assertIn("s.kind in('candidate','pending')", body)
        self.assertIn("s.kind='candidate'", body)
        self.assertIn('left join comments', body)
        self.assertIn('left join votes', body)
        self.assertIn('order by ordinal', body)
        self.assertIn('perform eps.feedback_internal_require(p_version_id)', sql)
        self.assertIn("to_jsonb(p)-'prosrc'", sql)

    def test_vote_columns_come_from_actual_existing_table_not_public_dto_names(self):
        migration = (b.ROOT / 'supabase/migrations/20261030002634_m06_guest_review_feedback_exports.sql').read_text(encoding='utf-8')
        table = next(x.stmt for x in parse_sql(migration) if isinstance(x.stmt, ast.CreateStmt) and x.stmt.relation.relname == 'feedback_preferences')
        columns = {c.colname for c in table.tableElts if isinstance(c, ast.ColumnDef)}
        vote_sql = b.render().split('votes as(')[1].split('per_slide as(')[0]
        referenced = set(re.findall(r'\bp\.([a-z_]+)', vote_sql))
        self.assertLessEqual(referenced, columns)
        self.assertIn('preference', referenced)

    def test_fixture_preference_calls_match_required_canonical_signature(self):
        migration = (b.ROOT / 'supabase/migrations/20261030002634_m06_guest_review_feedback_exports.sql').read_text(encoding='utf-8')
        functions = [x.stmt for x in parse_sql(migration) if isinstance(x.stmt, ast.CreateFunctionStmt)
                     and [n.sval for n in x.stmt.funcname] == ['public', 'eps_set_preference']]
        self.assertEqual(len(functions), 1)
        required = sum(p.defexpr is None for p in functions[0].parameters)
        self.assertEqual(required, 3)
        fixture = (b.ROOT / 'tests/db/m07-feedback-summary.sql').read_text(encoding='utf-8')
        calls = [parse_sql('select ' + line.strip()[len('perform '):])[0].stmt.targetList[0].val
                 for line in fixture.splitlines() if line.strip().startswith('perform public.eps_set_preference(')]
        self.assertEqual(len(calls), 3)
        keys = []
        for call in calls:
            self.assertEqual(len(call.args), required)
            self.assertIsInstance(call.args[2], ast.A_Const)
            keys.append(call.args[2].val.sval)
        self.assertEqual(len(set(keys)), len(keys), 'Distinct preference intents need distinct replay keys')
        self.assertTrue(all(8 <= len(key) <= 200 for key in keys))

    def test_fixture_explicitly_denies_nonready_version_for_internal_and_guest(self):
        fixture = (b.ROOT / 'tests/db/m07-feedback-summary.sql').read_text(encoding='utf-8')
        self.assertTrue("3,'queued'" in fixture, 'A separate queued version is required for the Ready-only checks')
        lines = [line for line in fixture.splitlines() if 'fb37_error' in line and "pg_temp.fb37_id('b7370008',4)" in line]
        self.assertEqual(len(lines), 2)
        self.assertTrue(any('public.eps_get_feedback_summary' in line for line in lines))
        self.assertTrue(any('pg_temp.fb37_guest' in line for line in lines))
        self.assertTrue(all("'RESOURCE_NOT_FOUND'" in line for line in lines))


if __name__ == '__main__':
    unittest.main()
