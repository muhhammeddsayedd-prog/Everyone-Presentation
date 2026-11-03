"""Offline finite-source, SQL AST and data-contract checks; no database calls."""
from pathlib import Path
import importlib.util
import re
import subprocess
import sys
import unittest

from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('assignment_candidate', HERE / 'candidate.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)


def order(row):
    # Both fields are NOT NULL in the pinned table; ID breaks sort-order ties.
    return (row['sort'], row['id'])


def included(row, output):
    return row['workspace'] == 'w' and not row['archived'] and (output == 'selection' or row['shortlist'])


def old_contract(rows, slots, output):
    result = []
    for slot in slots:
        if not slot['visible'] or slot['archived'] or slot['role_archived']:
            continue
        selected = sorted((x for x in rows if x['visible'] and included(x, output) and x['slot'] == slot['id']), key=order)
        # Old NO_MAIN omits workspace_id; validated composite FK requires that
        # every assignment with this globally unique slot has this workspace.
        main = any(x['visible'] and x['slot'] == slot['id'] and not x['archived'] and x['position'] == 'main' and (output == 'selection' or x['shortlist']) for x in rows)
        result.append((slot['id'], [x['id'] for x in selected], 'pending' if not selected else 'main' if main else 'no_main'))
    return result


def enumeration_contract(rows, slots, output, budget, already_used):
    saved = already_used
    retained = []
    complete = True
    for row in sorted((x for x in rows if x['visible'] and included(x, output)), key=lambda x: (x['slot'], order(x))):
        if already_used + row['cost'] > budget:
            retained = []
            already_used = saved
            complete = False
            break
        retained.append(row)
        already_used += row['cost']
    result = []
    for slot in slots:
        if not slot['visible'] or slot['archived'] or slot['role_archived']:
            continue
        source = retained if complete else rows
        selected = sorted((x for x in source if x['visible'] and included(x, output) and x['slot'] == slot['id']), key=order)
        result.append((slot['id'], [x['id'] for x in selected], 'pending' if not selected else 'main' if any(x['position'] == 'main' for x in selected) else 'no_main'))
    return result, complete, already_used, retained


def fixture():
    def row(identity, slot, **extra):
        value = dict(id=identity, slot=slot, workspace='w', archived=False, visible=True, shortlist=True, position='option', sort=1, cost=120)
        value.update(extra)
        return value
    rows = [row('b', 's1'), row('a', 's1'), row('z', 's1', sort=2), row('main', 's2', position='main', shortlist=False), row('option', 's2'), row('other', 'other-slot', workspace='other'), row('archived', 's1', archived=True), row('hidden', 's1', visible=False), row('old-slot-row', 'old-slot'), row('old-role-row', 'old-role-slot')]
    slots = [dict(id=x, visible=True, archived=False, role_archived=False) for x in ['s1', 's2', 'empty', 'old-slot', 'old-role-slot']]
    slots[3]['archived'] = True
    slots[4]['role_archived'] = True
    return rows, slots


class Tests(unittest.TestCase):
    def test_one_body_five_finite_edits_inverse_and_unchanged_interface(self):
        built = c.build()
        before, after = parse_sql(built['before'])[0].stmt, parse_sql(built['after'])[0].stmt
        self.assertEqual(len(parse_plpgsql(built['after'])), 1)
        self.assertEqual(before.funcname, after.funcname)
        self.assertEqual(before.parameters, after.parameters)
        self.assertEqual(before.returnType, after.returnType)
        self.assertEqual([x for x in before.options if x.defname != 'as'], [x for x in after.options if x.defname != 'as'])
        self.assertTrue(built['inverse_byte_equal'])
        self.assertEqual(built['finite_edit_count'], 5)
        self.assertEqual(built['other_three_candidate_bodies'], {
            'eps.review_snapshot': 'c6f93795e1926bcbb2e550b428f2e76a9ffe04dc29199e799c3d3a0e7b73cd10',
            'public.eps_generate_version': 'a5e5c60d3f94d9e05c62fc1cfc76ac4552713000b72b1efe4eac028da15c0d40',
            'eps.capture_presentation_video_transcripts': 'afe33691e2bb1dad42999b49c8c5ba9d583d68bfc6cced60bfbea0adadc37dd7',
        })

    def test_cached_and_fallback_predicate_order_AST_equals_original(self):
        original = c.OLD_LOOP.removeprefix('for assignment in ').removesuffix(' loop')
        cached, fallback = c.NEW_LOOP.removeprefix('for assignment in\n    ').removesuffix(' loop').split('\n    union all\n    ')
        self.assertEqual(parse_sql(fallback.replace('where not assignment_rows_complete and ', 'where ')), parse_sql(original))
        cached = cached.replace('select cached.* from unnest(assignment_rows)cached where assignment_rows_complete and ', 'select * from eps.assignments where ').replace('cached.', '') + 'order by sort_order,id'
        self.assertEqual(parse_sql(cached), parse_sql(original))
        union = parse_sql(c.NEW_LOOP.removeprefix('for assignment in\n    ').removesuffix(' loop'))[0].stmt
        self.assertTrue(union.all)
        self.assertEqual(len(union.sortClause), 2)
        self.assertNotIn('limit', c.LOAD.lower())

    def test_all_or_nothing_existing_shared_budget_and_lazy_load_order(self):
        load = c.LOAD
        self.assertIn('pg_column_size(assignment_row)::bigint+octet_length(assignment_row::text)::bigint+octet_length(assignment_row.id::text)+256', load)
        self.assertIn('if reuse_bytes+reuse_cost>4194304 then', load)
        self.assertIn("assignment_rows:='{}'::eps.assignments[];reuse_bytes:=assignment_rows_start_bytes;\n      assignment_rows_complete:=false;exit;", load)
        self.assertNotIn('exception', load.lower())
        built = c.build()['after']
        self.assertLess(built.index("if slot_item.provisional then"), built.index('if not assignment_rows_loaded then'))
        self.assertLess(built.index('if not assignment_rows_loaded then'), built.index('for assignment in\n'))
        self.assertEqual(built.count('assignment_rows_loaded:=true'), 1)

    def test_explicit_order_output_archive_visibility_and_NO_MAIN_contract(self):
        rows, slots = fixture()
        selection = [('s1', ['a', 'b', 'z'], 'no_main'), ('s2', ['main', 'option'], 'main'), ('empty', [], 'pending')]
        shortlist = [('s1', ['a', 'b', 'z'], 'no_main'), ('s2', ['option'], 'no_main'), ('empty', [], 'pending')]
        for output, expected in [('selection', selection), ('shortlist', shortlist)]:
            self.assertEqual(old_contract(rows, slots, output), expected)
            for budget in [0, 300, 4194304]:
                actual, complete, used, retained = enumeration_contract(rows, slots, output, budget, 200)
                self.assertEqual(actual, expected)
                self.assertLessEqual(used, max(budget, 200))
                if not complete:
                    self.assertEqual(retained, [])
                    self.assertEqual(used, 200)
        actual, complete, _, _ = enumeration_contract([], slots, 'selection', 4194304, 200)
        self.assertTrue(complete)
        self.assertEqual(actual, [('s1', [], 'pending'), ('s2', [], 'pending'), ('empty', [], 'pending')])

    def test_oversized_private_row_falls_back_without_partial_or_row_drop(self):
        rows, slots = fixture()
        rows[1]['cost'] = 4194305
        actual, complete, used, retained = enumeration_contract(rows, slots, 'selection', 4194304, 2048)
        self.assertFalse(complete)
        self.assertEqual(used, 2048)
        self.assertEqual(retained, [])
        self.assertEqual(actual, old_contract(rows, slots, 'selection'))

    def test_source_guards_fresh_authority_locks_outputs_and_errors_unchanged(self):
        built = c.build()
        body = re.search(r' AS (\$[a-zA-Z0-9_]*\$)(.*?)\1;$', built['after'], re.S)[2]
        for token in ['set_config(', 'current_setting(', 'SECURITY DEFINER', 'FOR UPDATE', 'FOR SHARE', 'statement_timeout', 'clock_timestamp()', 'review_require(']:
            self.assertNotIn(token.lower(), body.lower())
        # The only changed call is the assignment enumeration/NO_MAIN read.
        original = c.unpatch_body(body)
        calls = lambda text: re.findall(r'\b(?:eps|public)\.[a-z_]+\s*\(', text)
        self.assertEqual(calls(body), calls(original))
        for marker in ['issues:=issues||', 'inputs:=inputs||', 'fingerprint:=encode', 'return jsonb_build_object', 'REVIEW_TOO_LARGE', 'FRAME_UNAVAILABLE']:
            self.assertEqual(body.count(marker), original.count(marker))
        with self.assertRaises(ValueError):
            c.patch_body(original + '\n')

    def test_NO_MAIN_equivalence_uses_exact_pinned_composite_FK_and_RLS(self):
        file = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
        raw = file.read_bytes()
        self.assertEqual(c.sha(raw), '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c')
        text = raw.decode().replace('\r\n', '\n')
        fk = re.findall(r'ALTER TABLE ONLY eps\.assignments\s+ADD CONSTRAINT assignments_workspace_id_slot_id_fkey [^;]+;', text)
        self.assertEqual(len(fk), 1)
        self.assertIn('FOREIGN KEY (workspace_id, slot_id) REFERENCES eps.slots(workspace_id, id)', fk[0])
        self.assertNotIn('NOT VALID', fk[0])
        constraint = parse_sql(fk[0])[0].stmt.cmds[0].def_
        immediate_valid = lambda x: x.initially_valid and not x.skip_validation and not x.deferrable and not x.initdeferred
        self.assertTrue(immediate_valid(constraint))
        for suffix in [' DEFERRABLE', ' DEFERRABLE INITIALLY DEFERRED', ' NOT VALID']:
            changed = parse_sql(fk[0].removesuffix(';') + suffix + ';')[0].stmt.cmds[0].def_
            self.assertFalse(immediate_valid(changed))
        self.assertEqual(c.build()['required_actual_FK'], {
            'name': 'assignments_workspace_id_slot_id_fkey',
            'convalidated': True, 'condeferrable': False, 'condeferred': False,
        })
        self.assertIn('CREATE POLICY review_assignments_read ON eps.assignments FOR SELECT TO eps_review_owner USING (eps.review_scope(workspace_id));', text)
        self.assertIn('CREATE INDEX assignments_workspace_order ON eps.assignments USING btree (workspace_id, slot_id, sort_order, id) WHERE (archived_at IS NULL);', text)

    def test_disabled_before_assembly_no_SQL_transport(self):
        result = subprocess.run([sys.executable, '-X', 'utf8', '-B', str(HERE / 'candidate.py')], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, '')
        self.assertEqual(result.stderr.strip(), 'ASSIGNMENT_ENUMERATION_ASSEMBLY_DISABLED')
        self.assertFalse(c.ENTRY_ENABLED)
        source = (HERE / 'candidate.py').read_text()
        for token in ['psycopg', 'subprocess', 'requests.', 'docker', 'exec_command']:
            self.assertNotIn(token, source)


if __name__ == '__main__':
    unittest.main()
