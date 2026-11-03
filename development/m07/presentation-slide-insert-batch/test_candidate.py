"""Offline field/query and exact-source checks; no SQL execution."""
from pathlib import Path
import ast
import difflib
import hashlib
import importlib.util
import json
import re
import unittest
from pglast import parse_plpgsql, parse_sql, parser

HERE = Path(__file__).resolve().parent
SOURCE_ROOT = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio')
METADATA = SOURCE_ROOT / '.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql'
METADATA_SHA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'
spec = importlib.util.spec_from_file_location('slide_insert_batch_candidate', HERE / 'candidate.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def walk(value):
    if isinstance(value, dict):
        yield value
        for item in value.values():
            yield from walk(item)
    elif isinstance(value, list):
        for item in value:
            yield from walk(item)


def slide_statement(definition):
    queries = [node['PLpgSQL_expr']['query'] for node in walk(parse_plpgsql(definition))
               if 'PLpgSQL_expr' in node and node['PLpgSQL_expr']['parseMode'] == 0
               and node['PLpgSQL_expr']['query'].startswith('insert into eps.version_slides(')]
    assert len(queries) == 1
    return json.loads(parser.parse_sql_json(queries[0]))['stmts'][0]['stmt']['InsertStmt']


def normalized(value):
    if isinstance(value, dict):
        if set(value) == {'ColumnRef'}:
            fields = value['ColumnRef']['fields']
            if fields == [{'String': {'sval': 's'}}, {'String': {'sval': 'item'}}]:
                return {'ColumnRef': {'fields': [{'String': {'sval': 'item'}}]}}
        return {key: normalized(item) for key, item in value.items() if key != 'location'}
    if isinstance(value, list):
        return [normalized(item) for item in value]
    return value


def assert_query_shape(test, old, new):
    test.assertEqual(old['cols'], new['cols'])
    test.assertEqual(len(new['cols']), 8)
    old_values = old['selectStmt']['SelectStmt']['valuesLists'][0]['List']['items']
    query = new['selectStmt']['SelectStmt']
    new_values = [item['ResTarget']['val'] for item in query['targetList']]
    test.assertEqual(normalized(old_values), normalized(new_values))
    source = query['fromClause'][0]['RangeFunction']
    test.assertEqual(len(query['fromClause']), 1)
    test.assertTrue(source['ordinality'])
    test.assertEqual(source['alias']['aliasname'], 's')
    test.assertEqual(source['alias']['colnames'], [{'String': {'sval': 'item'}}, {'String': {'sval': 'slide_position'}}])
    call = source['functions'][0]['List']['items'][0]['FuncCall']
    test.assertEqual(call['funcname'], [{'String': {'sval': 'jsonb_array_elements'}}])
    test.assertEqual(normalized(call['args']), [{'ColumnRef': {'fields': [{'String': {'sval': 'slides'}}]}}])
    test.assertEqual(normalized(query['sortClause']), [{'SortBy': {
        'node': {'ColumnRef': {'fields': [{'String': {'sval': 's'}}, {'String': {'sval': 'slide_position'}}]}},
        'sortby_dir': 'SORTBY_DEFAULT', 'sortby_nulls': 'SORTBY_NULLS_DEFAULT'}}])
    for key in ['whereClause', 'distinctClause', 'groupClause', 'havingClause', 'limitCount', 'limitOffset']:
        test.assertFalse(query.get(key), key)
    test.assertNotIn('onConflictClause', new)
    test.assertNotIn('returningList', new)
    test.assertFalse(any('RangeVar' in item for item in walk(query)))


class Tests(unittest.TestCase):
    def test_slide_INSERT_is_one_query_not_per_item_VALUES(self):
        value = c.build(SOURCE_ROOT)
        old = slide_statement(value['before'])
        new = slide_statement(value['after'])
        self.assertIn('valuesLists', old['selectStmt']['SelectStmt'])
        self.assertNotIn('valuesLists', new['selectStmt']['SelectStmt'],
                         'candidate still dispatches the original per-slide VALUES command')
        self.assertEqual(old['cols'], new['cols'])
        self.assertEqual(len(new['cols']), 8)

    def test_exact_expressions_casts_NULLs_hash_and_array_order_with_negative_witnesses(self):
        value = c.build(SOURCE_ROOT)
        old, new = slide_statement(value['before']), slide_statement(value['after'])
        assert_query_shape(self, old, new)
        # Reversed dispatch and swapping the stored ordinal for array position
        # both parse, but violate the original row/constraint ordering or value.
        for before, after in [('order by s.slide_position;', 'order by s.slide_position desc;'),
                              ("(s.item->>'order')::integer", 's.slide_position::integer'),
                              ('eps.presentation_hash(s.item)', 'eps.presentation_hash(null)')]:
            mutant = value['after'].replace(before, after, 1)
            with self.assertRaises(AssertionError):
                assert_query_shape(self, old, slide_statement(mutant))

    def test_one_block_inverse_body_pins_attributes_and_full_PL_parser(self):
        value = c.build(SOURCE_ROOT)
        before, after = value['before'], value['after']
        self.assertEqual(c.sha(c.parts(before)[2].encode()), c.BEFORE_BODY_SHA)
        self.assertEqual(c.sha(c.parts(after)[2].encode()), c.AFTER_BODY_SHA)
        self.assertNotEqual(before, after)
        self.assertEqual(after.replace(c.NEW, c.OLD, 1), before)
        self.assertEqual(c.unpatch_body(c.parts(after)[2]), c.parts(before)[2])
        self.assertEqual(before.count('\n'), after.count('\n'))
        self.assertEqual(len(parse_plpgsql(after)), 1)
        old, new = parse_sql(before)[0].stmt, parse_sql(after)[0].stmt
        for key in ['funcname', 'parameters', 'returnType']:
            self.assertEqual(getattr(old, key), getattr(new, key))
        self.assertEqual([item for item in old.options if item.defname != 'as'],
                         [item for item in new.options if item.defname != 'as'])
        for body in [c.parts(before)[2] + '\n', c.parts(before)[2].replace('order by a.id;', 'order by a.id desc;', 1)]:
            with self.assertRaises(ValueError):
                c.patch_body(body)
        with self.assertRaises(ValueError):
            c.unpatch_body(c.parts(after)[2].replace('s.slide_position;', 's.slide_position desc;', 1))

    def test_empty_SQL_NULL_guard_no_new_cache_and_following_authority_bytes_unchanged(self):
        value = c.build(SOURCE_ROOT)
        self.assertIn('if coalesce(jsonb_array_length(slides),0)>0 then', c.NEW)
        self.assertEqual(value['before'].split(c.OLD, 1)[0], value['after'].split(c.NEW, 1)[0])
        tail = value['after'].split(c.NEW, 1)[1]
        self.assertEqual(tail, value['before'].split(c.OLD, 1)[1])
        self.assertTrue(tail.startswith('\n if coalesce(cardinality(capture_assets),0)>0 then'))
        self.assertIn('perform eps.capture_presentation_video_transcripts(version_id);', tail)
        self.assertIn('update eps.presentation_series set next_version_number=', tail)
        self.assertIn('return eps.presentation_remember(', tail)
        self.assertIsNone(re.search(r'\b(?:item|found)\b', tail, re.I))
        self.assertIn('slides:=jsonb_build_array(', value['before'].split(c.OLD, 1)[0])
        # The guarded new command is skipped for empty/SQL-NULL input; it adds
        # no source-table reread, target privilege check or retention in that path.
        for slides in [None, [], [{'order': 8}, {'order': 2}]]:
            old_order = list(slides or [])
            guarded_order = [row for _, row in enumerate(slides, 1)] if slides else []
            self.assertEqual(old_order, guarded_order)

    def test_frozen_DDL_constraints_RLS_and_no_INSERT_triggers(self):
        raw = METADATA.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), METADATA_SHA)
        text = raw.decode().replace('\r\n', '\n')
        table = re.search(r'CREATE TABLE eps.version_slides \(.*?\n\);', text, re.S)[0]
        names = [item.colname for item in parse_sql(table)[0].stmt.tableElts if hasattr(item, 'colname')]
        self.assertEqual(names, ['id', 'version_id', 'ordinal', 'kind', 'source_assignment_id', 'source_slot_id', 'snapshot', 'content_sha256'])
        for column in ['ordinal', 'kind', 'snapshot', 'content_sha256']:
            self.assertIn(column, table)
        constraints = re.findall(r'ALTER TABLE ONLY eps.version_slides\s+ADD CONSTRAINT [^;]+;', text)
        self.assertEqual(len(constraints), 5)
        for token in ['PRIMARY KEY (id)', 'UNIQUE (version_id, ordinal)',
                      'FOREIGN KEY (version_id) REFERENCES eps.presentation_versions(id)',
                      'FOREIGN KEY (source_assignment_id) REFERENCES eps.assignments(id)',
                      'FOREIGN KEY (source_slot_id) REFERENCES eps.slots(id)']:
            self.assertTrue(any(token in item for item in constraints), token)
        triggers = [match[0] for match in re.finditer(r'CREATE (?:CONSTRAINT )?TRIGGER [^;]+;', text, re.S)
                    if ' ON eps.version_slides ' in match[0]]
        self.assertEqual(len(triggers), 1)
        self.assertIn('BEFORE DELETE OR UPDATE', triggers[0])
        self.assertNotIn('INSERT', triggers[0])
        policy = re.search(r'CREATE POLICY presentation_slide_insert [^;]+;', text, re.S)[0]
        for token in ['FOR INSERT TO eps_review_owner', 'WITH CHECK',
                      'eps.presentation_scope(v.workspace_id, true)', "v.status = 'queued'::text"]:
            self.assertIn(token, policy)
        self.assertIn('CREATE POLICY presentation_version_read ON eps.presentation_versions FOR SELECT TO eps_review_owner USING (eps.presentation_scope(workspace_id));', text)
        self.assertIn('CREATE POLICY review_series_update ON eps.presentation_series FOR UPDATE TO eps_review_owner USING (eps.review_scope(workspace_id, true)) WITH CHECK (eps.review_scope(workspace_id, true));', text)

    def test_default_off_no_transport_and_exact_review_artifacts(self):
        self.assertFalse(c.ENTRY_ENABLED)
        source = (HERE / 'candidate.py').read_text()
        tree = ast.parse(source)
        entry = tree.body[-1]
        self.assertIsInstance(entry, ast.If)
        self.assertEqual(ast.unparse(entry.body[0]), 'need(ENTRY_ENABLED)')
        for token in ['subprocess', 'psycopg', 'requests.', 'set_config', 'statement_timeout']:
            self.assertNotIn(token, source)
        value = c.build(SOURCE_ROOT)
        before, after = c.parts(value['before'])[2], c.parts(value['after'])[2]
        self.assertEqual((HERE / 'before-body.sql').read_bytes(), before.encode())
        self.assertEqual((HERE / 'candidate-body.sql').read_bytes(), after.encode())
        expected = ''.join(difflib.unified_diff(before.splitlines(keepends=True), after.splitlines(keepends=True), fromfile='GEN41fe', tofile='slide-insert-batch'))
        self.assertEqual((HERE / 'body.diff').read_bytes(), expected.encode())


if __name__ == '__main__':
    unittest.main()
