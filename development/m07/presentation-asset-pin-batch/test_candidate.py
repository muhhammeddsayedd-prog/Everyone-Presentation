"""Offline one-block, SQL/PL parser, field/order and frozen-policy checks."""
from pathlib import Path
import difflib
import hashlib
import importlib.util
import json
import re
import unittest
from pglast import parse_sql, parse_plpgsql, parser

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('asset_pin_batch_candidate', HERE / 'candidate.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
METADATA = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
METADATA_SHA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'


def walk(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)


def pin_statement(definition):
    values = [item['PLpgSQL_expr']['query'] for item in walk(parse_plpgsql(definition))
              if 'PLpgSQL_expr' in item and item['PLpgSQL_expr']['parseMode'] == 0
              and item['PLpgSQL_expr']['query'].startswith('insert into eps.presentation_version_assets(')]
    assert len(values) == 1
    return json.loads(parser.parse_sql_json(values[0]))['stmts'][0]['stmt']['InsertStmt']


def column(value):
    return [item['String']['sval'] for item in value['ColumnRef']['fields']]


class Tests(unittest.TestCase):
    def test_one_block_exact_inverse_final_PL_and_full_attributes(self):
        value = c.build()
        before, after = value['before'], value['after']
        self.assertEqual(c.sha(c.parts(before)[2].encode()), c.BEFORE_BODY_SHA)
        self.assertEqual(c.sha(c.parts(after)[2].encode()), c.AFTER_BODY_SHA)
        self.assertNotEqual(before, after)
        self.assertEqual(after.replace(c.NEW, c.OLD), before)
        self.assertEqual(before.count(c.OLD), 1)
        self.assertEqual(after.count(c.NEW), 1)
        self.assertEqual(len(parse_plpgsql(after)), 1)
        self.assertEqual(before.count('\n'), after.count('\n'))
        old, new = parse_sql(before)[0].stmt, parse_sql(after)[0].stmt
        self.assertEqual(old.funcname, new.funcname)
        self.assertEqual(old.parameters, new.parameters)
        self.assertEqual(old.returnType, new.returnType)
        self.assertEqual([x for x in old.options if x.defname != 'as'], [x for x in new.options if x.defname != 'as'])
        for changed in [c.parts(before)[2] + '\n', c.parts(before)[2].replace('order by id loop', 'loop', 1)]:
            with self.assertRaises(ValueError):
                c.patch_body(changed)

    def test_all_fifteen_values_same_and_only_input_is_existing_typed_array(self):
        value = c.build()
        old, new = pin_statement(value['before']), pin_statement(value['after'])
        self.assertEqual(old['cols'], new['cols'])
        self.assertEqual(len(new['cols']), 15)
        old_values = old['selectStmt']['SelectStmt']['valuesLists'][0]['List']['items']
        new_query = new['selectStmt']['SelectStmt']
        projected = [item['ResTarget']['val'] for item in new_query['targetList']]
        self.assertEqual(len(projected), 15)
        self.assertEqual([column(x)[-1] for x in old_values], [column(x)[-1] for x in projected])
        self.assertEqual(column(projected[0]), ['version_id'])
        self.assertTrue(all(column(x)[0] == 'a' for x in projected[1:]))
        self.assertEqual(new_query['sortClause'][0]['SortBy']['node']['ColumnRef']['fields'],
                         [{'String': {'sval': 'a'}}, {'String': {'sval': 'id'}}])
        for key in ['whereClause', 'distinctClause', 'groupClause', 'havingClause', 'limitCount', 'limitOffset']:
            self.assertFalse(new_query.get(key), key)
        self.assertNotIn('onConflictClause', new)
        self.assertNotIn('returningList', new)
        refs = [node['RangeVar'] for node in walk(new_query) if 'RangeVar' in node]
        self.assertEqual(refs, [])
        calls = [node['FuncCall'] for node in walk(new_query) if 'FuncCall' in node]
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]['funcname'], [{'String': {'sval': 'unnest'}}])
        self.assertEqual(column(calls[0]['args'][0]), ['capture_assets'])

    def test_empty_null_guard_private_fields_and_unused_source_FOUND_are_preserved(self):
        value = c.build()
        self.assertIn('if coalesce(cardinality(capture_assets),0)>0 then', c.NEW)
        self.assertIn('source.filename', c.OLD)
        self.assertIn('a.filename', c.NEW)
        old_tail = value['before'].split(c.OLD, 1)[1]
        new_tail = value['after'].split(c.NEW, 1)[1]
        self.assertEqual(old_tail, new_tail)
        self.assertNotIn('source.', new_tail)
        self.assertTrue(new_tail.startswith('\n perform eps.capture_presentation_video_transcripts(version_id);'))
        self.assertNotIn('if found', new_tail.lower())
        self.assertNotIn('if not found', new_tail.lower())
        for rows in [None, [], [{'id': 'c', 'filename': None}, {'id': 'a', 'filename': 'private'}, {'id': 'b', 'filename': ''}]]:
            before = sorted(rows or [], key=lambda x: x['id'])
            after = sorted(rows, key=lambda x: x['id']) if rows else []
            self.assertEqual(before, after)
        # No new variables, private-row retention or SELECT statement precedes
        # the same captured inventory/snapshot/hash and queued-version writes.
        self.assertEqual(value['before'].split(c.OLD, 1)[0], value['after'].split(c.NEW, 1)[0])

    def test_frozen_schema_no_INSERT_triggers_and_no_version_id_source_ambiguity(self):
        raw = METADATA.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), METADATA_SHA)
        text = raw.decode().replace('\r\n', '\n')
        source = re.search(r'CREATE TABLE eps.media_assets \(.*?\n\);', text, re.S)[0]
        columns = [x.colname for x in parse_sql(source)[0].stmt.tableElts if hasattr(x, 'colname')]
        self.assertNotIn('version_id', columns)
        self.assertIn('sha256', columns)
        triggers = [m[0] for m in re.finditer(r'CREATE (?:CONSTRAINT )?TRIGGER [^;]+;', text, re.S)
                    if ' ON eps.presentation_version_assets ' in m[0]]
        self.assertEqual(len(triggers), 1)
        self.assertIn('BEFORE DELETE OR UPDATE', triggers[0])
        self.assertNotIn('INSERT', triggers[0])
        policy = re.search(r'CREATE POLICY presentation_pin_insert [^;]+;', text, re.S)[0]
        for needle in ['FOR INSERT TO eps_review_owner', 'WITH CHECK', 'eps.presentation_scope(v.workspace_id, true)', "v.status = 'queued'::text"]:
            self.assertIn(needle, policy)
        self.assertIn('CREATE POLICY presentation_version_read ON eps.presentation_versions FOR SELECT TO eps_review_owner USING (eps.presentation_scope(workspace_id));', text)
        self.assertIn('CREATE POLICY review_series_update ON eps.presentation_series FOR UPDATE TO eps_review_owner USING (eps.review_scope(workspace_id, true)) WITH CHECK (eps.review_scope(workspace_id, true));', text)

    def test_default_off_no_transport_and_exact_review_artifacts(self):
        self.assertFalse(c.ENTRY_ENABLED)
        text = (HERE / 'candidate.py').read_text()
        for token in ['subprocess', 'psycopg', 'requests.', 'set_config', 'statement_timeout']:
            self.assertNotIn(token, text)
        value = c.build()
        before, after = c.parts(value['before'])[2], c.parts(value['after'])[2]
        self.assertEqual((HERE / 'before-body.sql').read_bytes(), before.encode())
        self.assertEqual((HERE / 'candidate-body.sql').read_bytes(), after.encode())
        expected = ''.join(difflib.unified_diff(before.splitlines(keepends=True), after.splitlines(keepends=True), fromfile='GENa5', tofile='pin-batch'))
        self.assertEqual((HERE / 'body.diff').read_bytes(), expected.encode())


if __name__ == '__main__':
    unittest.main()
