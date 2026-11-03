"""Offline source/parser/relational checks. Never connects to a database."""
from pathlib import Path
import hashlib
import importlib.util
import itertools
import json
import difflib
import re
import unittest
from pglast import parse_sql, parse_plpgsql, parser

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('lock_acquisition_candidate', HERE / 'candidate.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
BACKUP = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
BACKUP_SHA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'
TABLES = ['public.projects', 'public.clients', 'eps.presentation_templates', 'eps.specs',
          'eps.roles', 'eps.slots', 'eps.assignments', 'eps.workspace_candidates',
          'eps.candidates', 'eps.candidate_media', 'eps.media_assets', 'eps.candidate_media_frames']


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, (list, tuple)):
        for child in value:
            yield from walk(child)


def queries(definition):
    parsed = parse_plpgsql(definition)
    return [item['PLpgSQL_expr']['query'] for item in walk(parsed)
            if 'PLpgSQL_expr' in item and item['PLpgSQL_expr']['parseMode'] == 0]


def sql_ast(query):
    return json.loads(parser.parse_sql_json(query))['stmts'][0]['stmt']['SelectStmt']


def locking_queries(definition):
    result = []
    for query in queries(definition):
        root = sql_ast(query)
        for item in walk(root):
            if 'SelectStmt' in item and item['SelectStmt'].get('lockingClause'):
                result.append((root, item['SelectStmt']))
        if root.get('lockingClause'):
            result.append((root, root))
    return result


def relation(select):
    value = select['fromClause'][0]['RangeVar']
    return value['schemaname'] + '.' + value['relname']


def normalized_columns(value):
    """Ignore only alias qualification when comparing unchanged lock predicates."""
    if isinstance(value, dict):
        if 'ColumnRef' in value:
            return {'column': value['ColumnRef']['fields'][-1]}
        return {key: normalized_columns(child) for key, child in value.items()
                if key not in ('location', 'stmt_location', 'stmt_len')}
    if isinstance(value, list):
        return [normalized_columns(child) for child in value]
    return value


def assert_full_stream(test, select):
    for key in ('distinctClause', 'groupClause', 'havingClause', 'windowClause',
                'limitOffset', 'limitCount', 'valuesLists', 'op'):
        if key == 'op':
            test.assertEqual(select.get(key, 'SETOP_NONE'), 'SETOP_NONE')
        else:
            test.assertFalse(select.get(key), key)
    for node in walk(select.get('targetList')):
        if 'FuncCall' in node:
            names = [item['String']['sval'] for item in node['FuncCall']['funcname']]
            test.assertNotIn(names[-1], ('array_agg', 'count', 'min', 'max', 'jsonb_agg'))


class Tests(unittest.TestCase):
    def test_plpgsql_and_fully_consumed_locking_streams(self):
        before, after = c.build()
        self.assertEqual(len(parse_plpgsql(after)), 1)
        locks = locking_queries(after)
        self.assertEqual([relation(inner) for _, inner in locks], TABLES)
        aggregated = [(outer, inner) for outer, inner in locks if outer is not inner]
        self.assertEqual([relation(inner) for _, inner in aggregated],
                         ['eps.assignments', 'eps.workspace_candidates', 'eps.candidate_media'])
        for outer, inner in locks:
            assert_full_stream(self, inner)
            self.assertEqual(inner['lockingClause'],
                             next(node['lockingClause'] for _, node in locking_queries(before)
                                  if relation(node) == relation(inner)))
        for outer, inner in aggregated:
            for key in ('whereClause', 'havingClause', 'limitCount', 'limitOffset', 'groupClause'):
                self.assertFalse(outer.get(key), (relation(inner), key))
            if relation(inner) == 'eps.workspace_candidates':
                selected = next(node['CommonTableExpr'] for node in walk(outer)
                                if 'CommonTableExpr' in node and node['CommonTableExpr']['ctename'] == 'selected')
                self.assertEqual(selected['ctematerialized'], 'CTEMaterializeAlways')
                selected_query = selected['ctequery']['SelectStmt']
                self.assertTrue(selected_query.get('distinctClause'))
                self.assertFalse(selected_query.get('whereClause'))
                self.assertFalse(selected_query.get('lockingClause'))
                self.assertEqual(selected_query['fromClause'][0]['RangeSubselect']['subquery']['SelectStmt'], inner)
                # The first unfiltered ID aggregate consumes the entire materialized CTE.
                projection = outer['targetList'][0]['ResTarget']['val']['SubLink']['subselect']['SelectStmt']
                self.assertEqual(projection['fromClause'][0]['RangeVar']['relname'], 'selected')
                self.assertFalse(projection.get('whereClause'))
            else:
                self.assertEqual(outer['fromClause'][0]['RangeSubselect']['subquery']['SelectStmt'], inner)
                self.assertFalse(outer.get('distinctClause'))

    def test_four_finite_inverse_edits_and_closed_baseline(self):
        before, after = c.build()
        self.assertEqual(c.sha(c.body(before).encode()), c.BEFORE_BODY_SHA)
        self.assertEqual(len(c.PATCHES), 4)
        self.assertNotEqual(before, after)
        result = c.body(after)
        for _, old, new in reversed(c.PATCHES):
            self.assertEqual(result.count(new), 1)
            result = result.replace(new, old)
        self.assertEqual(result, c.body(before))
        self.assertEqual(c.unpatch_body(c.body(after)), c.body(before))
        for wrong in [c.body(before) + '\n', c.body(before).replace('nowait', 'skip locked', 1)]:
            with self.assertRaises(ValueError):
                c.patch_body(wrong)
        with self.assertRaises(ValueError):
            c.unpatch_body(c.body(after) + '\n')

    def test_same_signature_modes_variables_lock_order_predicates_and_footer(self):
        before, after = c.build()
        old, new = parse_sql(before)[0].stmt, parse_sql(after)[0].stmt
        self.assertEqual(old.funcname, new.funcname)
        self.assertEqual(old.parameters, new.parameters)
        self.assertEqual(old.returnType, new.returnType)
        self.assertEqual([item for item in old.options if item.defname != 'as'],
                         [item for item in new.options if item.defname != 'as'])
        old_locks, new_locks = locking_queries(before), locking_queries(after)
        self.assertEqual(len(new_locks), 12)
        for (_, left), (_, right) in zip(old_locks, new_locks):
            self.assertEqual(relation(left), relation(right))
            self.assertEqual(normalized_columns(left.get('whereClause')), normalized_columns(right.get('whereClause')))
            self.assertEqual(normalized_columns(left.get('sortClause')), normalized_columns(right.get('sortClause')))
        start = 'declare project_id uuid;'
        self.assertEqual(c.body(before)[c.body(before).index(start):c.body(before).index('begin')],
                         c.body(after)[c.body(after).index(start):c.body(after).index('begin')])
        footer = '\n exception when lock_not_available'
        self.assertEqual(before[before.index(footer):], after[after.index(footer):])
        self.assertEqual(after.count('eps.presentation_scope(p_workspace,true)'), 2)
        prefix = ' begin\n'
        self.assertEqual(before[:before.index(prefix)], after[:after.index(prefix)])
        for token in ['statement_timeout', 'set_config', 'security definer', 'set role', 'row_security', 'limit ']:
            self.assertNotIn(token, after.lower())

    def test_source_fields_null_empty_frames_and_exact_pairs_preserved(self):
        before, after = c.build()
        self.assertIn('select p.client_id into client_id from public.projects p where p.id=project_id for share nowait;', after)
        self.assertNotIn('if found', after.lower())
        self.assertNotIn('strict', c.PROJECT_NEW.lower())
        for token in ['locked.id', 'locked.candidate_id', 'locked.selected_candidate_media_id', 'locked.selected_frame_asset_ids']:
            self.assertIn(token, c.POOL_NEW)
        self.assertNotIn('archived_at', c.POOL_NEW)
        self.assertIn('into v_pool_ids,v_candidate_ids,v_media_ids,v_frame_asset_ids,v_pair_media_ids,v_pair_asset_ids;', c.POOL_NEW)
        # No NULL predicate may narrow a locking stream. The existing final union removes NULLs.
        self.assertNotIn('is not null', c.MEDIA_NEW.split('   )locked;', 1)[0])
        final_union = after[after.index('from(select w.logo_asset_id'):after.index('  perform 1 from eps.media_assets')]
        self.assertIn('union all select unnest(v_asset_ids)', final_union)
        self.assertIn('union all select unnest(v_frame_asset_ids))wanted where wanted.asset_id is not null;', final_union)
        frames = '  ),frames as materialized('
        pairs_end = '  select\n'
        old_frames = before[before.index(frames):before.index(pairs_end, before.index(frames))]
        new_frames = after[after.index(frames):after.index(pairs_end, after.index(frames))]
        self.assertEqual(old_frames, new_frames)
        for sources in [[], [None], [3, None, 3], [3, 4]]:
            for frames_ids in [[], [None], [5, 5], [3, 6]]:
                for logo in [None, 7]:
                    old_assets = {item for item in [logo, *sources, *frames_ids] if item is not None}
                    captured_sources = set(sources)
                    new_assets = {item for item in [logo, *captured_sources, *frames_ids] if item is not None}
                    self.assertEqual(old_assets, new_assets)

    def test_valid_composite_FK_caller_and_small_scopes_include_archived_duplicate_refs(self):
        raw = BACKUP.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), BACKUP_SHA)
        text = raw.decode().replace('\r\n', '\n')
        name = 'assignments_workspace_id_workspace_candidate_id_fkey'
        found = re.findall(r'ALTER TABLE ONLY eps.assignments\s+ADD CONSTRAINT ' + name + r'\b[^;]+;', text)
        self.assertEqual(len(found), 1)
        constraint = parse_sql(found[0])[0].stmt.cmds[0].def_
        self.assertEqual(constraint.pktable.schemaname, 'eps')
        self.assertEqual(constraint.pktable.relname, 'workspace_candidates')
        self.assertEqual([item.sval for item in constraint.fk_attrs], ['workspace_id', 'workspace_candidate_id'])
        self.assertEqual([item.sval for item in constraint.pk_attrs], ['workspace_id', 'id'])
        self.assertTrue(constraint.initially_valid)
        self.assertFalse(constraint.deferrable)
        self.assertFalse(constraint.initdeferred)
        callers = list(re.finditer(r'CREATE FUNCTION ([a-z_]+\.[a-z_]+)\([^;]*? AS (\$[a-zA-Z0-9_]*\$)(.*?)\2;', text, re.S))
        callers = [item for item in callers if 'eps.presentation_lock_sources(' in item[3]]
        self.assertEqual([item[1] for item in callers], ['public.eps_generate_version'])
        self.assertEqual(hashlib.sha256(callers[0][3].encode()).hexdigest(), 'b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08')
        self.assertLess(callers[0][3].index('perform 1 from eps.workspaces where id=series.workspace_id for update;'),
                        callers[0][3].index('perform eps.presentation_lock_sources('))
        count = 0
        for archived in itertools.product([False, True], repeat=4):
            pools = [{'id': i, 'ws': i // 2, 'archived': archived[i]} for i in range(4)]
            for states in itertools.product([0, 1, 2], repeat=4):
                assignments = [{'id': i, 'ws': i // 2, 'pool': i, 'active': value == 1}
                               for i, value in enumerate(states) if value]
                if assignments:
                    assignments += [dict(assignments[0], id=100)]
                for ws in [0, 1]:
                    old_pool_ids = {p['id'] for p in pools if p['ws'] == ws and
                                    any(a['pool'] == p['id'] and a['active'] for a in assignments)}
                    captured = {a['pool'] for a in assignments if a['ws'] == ws and a['active']}
                    new_pool_ids = {p['id'] for p in pools if p['ws'] == ws and p['id'] in captured}
                    self.assertEqual(old_pool_ids, new_pool_ids)
                    count += 1
        self.assertEqual(count, 2592)

    def test_admission_limitations_and_stream_mutations_really_reject(self):
        # Invalid cross-workspace FK and unfenced inserts are explicit counterexamples.
        pools = {1: 0, 2: 1}
        invalid = [{'ws': 1, 'pool': 1}]
        old = {key for key, ws in pools.items() if ws == 0 and any(a['pool'] == key for a in invalid)}
        new = {key for key, ws in pools.items() if ws == 0 and key in {a['pool'] for a in invalid if a['ws'] == 0}}
        self.assertNotEqual(old, new)
        captured = {1}
        after_phantom = {1, 2}
        self.assertNotEqual(captured, after_phantom)
        _, after = c.build()
        _, assignment = next(pair for pair in locking_queries(after) if relation(pair[1]) == 'eps.assignments')
        for field, value in [('distinctClause', [{}]), ('limitCount', {'A_Const': {}}), ('groupClause', [{}])]:
            changed = dict(assignment, **{field: value})
            with self.assertRaises(AssertionError):
                assert_full_stream(self, changed)
        # SQL grammar accepts these trees; the explicit lock-level guard must
        # reject the DISTINCT/aggregate combination before any backend analysis.
        for wrong in [
            'select distinct a.workspace_candidate_id from eps.assignments a order by a.id for share nowait',
            'select array_agg(a.workspace_candidate_id) from eps.assignments a for share nowait',
            'select a.workspace_candidate_id from eps.assignments a order by a.id limit 1 for share nowait',
        ]:
            with self.assertRaises(AssertionError):
                assert_full_stream(self, sql_ast(wrong))

    def test_no_transport_default_off_and_readable_artifacts_exact(self):
        self.assertFalse(c.ENTRY_ENABLED)
        text = (HERE / 'candidate.py').read_text()
        for token in ['subprocess', 'psycopg', 'requests.', 'exec_command', 'set_config']:
            self.assertNotIn(token, text)
        before, after = c.build()
        self.assertEqual((HERE / 'before-body.sql').read_bytes(), c.body(before).encode())
        self.assertEqual((HERE / 'candidate-body.sql').read_bytes(), c.body(after).encode())
        expected = ''.join(difflib.unified_diff(c.body(before).splitlines(keepends=True),
                                              c.body(after).splitlines(keepends=True),
                                              fromfile='helper280', tofile='lock-acquisition-reuse'))
        self.assertEqual((HERE / 'body.diff').read_bytes(), expected.encode())


if __name__ == '__main__':
    unittest.main()
