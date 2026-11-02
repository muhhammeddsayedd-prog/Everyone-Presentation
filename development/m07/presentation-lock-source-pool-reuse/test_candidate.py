"""Finite/parser/relational reasoning checks only; no database or processes."""
from pathlib import Path
import hashlib
import importlib.util
import itertools
import re
import unittest
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('pool_reuse_candidate', HERE / 'candidate.py')
c = importlib.util.module_from_spec(spec)
spec.loader.exec_module(c)
BACKUP = Path('D:/Everyone/Presentation/Everyone-Presentation-Studio/.local/m07-recovery/639da33a-7e90-4471-b0ec-c7a8ff6097ef/backup/metadata.sql')
BACKUP_SHA = '12df4e565d466c008095498903237ae24f304403887db396b8bc46b5cf93346c'


def rows(pools, assignments, workspace):
    old = {pool['id'] for pool in pools for item in assignments if item['pool'] == pool['id'] and item['workspace'] == workspace and item['active']}
    captured = {pool['id'] for pool in pools if pool['workspace'] == workspace and any(item['pool'] == pool['id'] and item['active'] for item in assignments)}
    new = {pool['id'] for pool in pools if pool['workspace'] == workspace and pool['id'] in captured}
    return old, new


class Tests(unittest.TestCase):
    def test_one_fragment_and_exact_inverse_to_sealed_1ff(self):
        before, after = c.build()
        self.assertEqual(c.sha(c.body(before).encode()), c.BEFORE_BODY_SHA)
        self.assertEqual(after.replace(c.NEW, c.OLD), before)
        self.assertEqual(before.count(c.OLD), 1)
        self.assertEqual(after.count(c.NEW), 1)
        for changed in [c.body(before) + '\n', c.body(before).replace('v_pool_ids', 'wrong_ids', 1)]:
            with self.assertRaises(ValueError):
                c.patch_body(changed)

    def test_same_signature_attributes_all_twelve_locks_and_error_footer(self):
        before, after = c.build()
        old, new = parse_sql(before)[0].stmt, parse_sql(after)[0].stmt
        self.assertEqual(old.funcname, new.funcname)
        self.assertEqual(old.parameters, new.parameters)
        self.assertEqual(old.returnType, new.returnType)
        self.assertEqual([x for x in old.options if x.defname != 'as'], [x for x in new.options if x.defname != 'as'])
        self.assertEqual(len(parse_plpgsql(after)), 1)
        locks = lambda text: re.findall(r'perform 1 from ((?:eps|public)\.[a-z_]+)', text)
        self.assertEqual(locks(before), locks(after))
        self.assertEqual(len(locks(after)), 12)
        self.assertEqual(before.count('for share nowait'), after.count('for share nowait'))
        self.assertEqual(after.count('eps.presentation_scope(p_workspace,true)'), 2)
        self.assertEqual(before[before.index('\n exception when lock_not_available'):], after[after.index('\n exception when lock_not_available'):])

    def test_selected_fields_still_read_after_pool_locks_and_all_tail_exact(self):
        before, after = c.build()
        capture = after.index('into v_pool_ids')
        pool_lock = after.index('p.id=any(v_pool_ids)order by p.id for share nowait')
        selected = after.index('with selected as materialized(')
        self.assertLess(capture, pool_lock)
        self.assertLess(pool_lock, selected)
        self.assertEqual(after[after.index('  ),frames as materialized('):], before[before.index('  ),frames as materialized('):])
        self.assertIn('select distinct p.id,p.candidate_id,p.selected_candidate_media_id,p.selected_frame_asset_ids', after)
        self.assertNotIn('archived', c.NEW)
        for token in ['statement_timeout', 'set_config', 'security definer', 'set role']:
            self.assertFalse(token in after)

    def test_frozen_only_production_caller_takes_workspace_fence_first_and_FKs_validate(self):
        raw = BACKUP.read_bytes()
        self.assertEqual(hashlib.sha256(raw).hexdigest(), BACKUP_SHA)
        text = raw.decode().replace('\r\n', '\n')
        functions = list(re.finditer(r'CREATE FUNCTION ([a-z_]+\.[a-z_]+)\([^;]*? AS (\$[a-zA-Z0-9_]*\$)(.*?)\2;', text, re.S))
        callers = [item for item in functions if 'eps.presentation_lock_sources(' in item[3]]
        self.assertEqual([item[1] for item in callers], ['public.eps_generate_version'])
        caller = callers[0][3]
        self.assertEqual(hashlib.sha256(caller.encode()).hexdigest(), 'b20fef7adc8dee0da91db1508b30d4116855bb3e9be9e881072a7e8d55fcee08')
        self.assertLess(caller.index('perform 1 from eps.workspaces where id=series.workspace_id for update;'), caller.index('perform eps.presentation_lock_sources('))
        for name, columns, target in [
            ('assignments_workspace_id_workspace_candidate_id_fkey', 'workspace_id, workspace_candidate_id', 'eps.workspace_candidates(workspace_id, id)'),
            ('assignments_workspace_id_slot_id_fkey', 'workspace_id, slot_id', 'eps.slots(workspace_id, id)'),
        ]:
            expected = 'ADD CONSTRAINT ' + name + ' FOREIGN KEY (' + columns + ') REFERENCES ' + target + ' ON DELETE RESTRICT;'
            self.assertIn(expected, text)
            self.assertNotIn(expected[:-1] + ' NOT VALID', text)

    def test_complete_small_valid_relation_cases_include_archived_and_duplicate_refs(self):
        checked = 0
        for archived in itertools.product([False, True], repeat=4):
            pools = [{'id': i, 'workspace': i // 2, 'archived': archived[i]} for i in range(4)]
            for states in itertools.product([0, 1, 2], repeat=4):
                assignments = [{'pool': i, 'workspace': i // 2, 'active': state == 1} for i, state in enumerate(states) if state != 0]
                if assignments:
                    assignments += [dict(assignments[0])]
                for workspace in [0, 1]:
                    old, new = rows(pools, assignments, workspace)
                    self.assertEqual(old, new)
                    checked += 1
        self.assertEqual(checked, 2592)

    def test_FK_and_no_phantom_preconditions_are_real_not_hidden_assumptions(self):
        pools = [{'id': 1, 'workspace': 0}, {'id': 2, 'workspace': 1}]
        old, new = rows(pools, [{'pool': 2, 'workspace': 0, 'active': True}], 0)
        self.assertNotEqual(old, new)  # Invalid composite-FK relation must not be admitted.
        same_workspace = [{'id': 1, 'workspace': 0}, {'id': 2, 'workspace': 0}]
        before = [{'pool': 1, 'workspace': 0, 'active': True}]
        _, captured_before = rows(same_workspace, before, 0)
        original_after, _ = rows(same_workspace, before + [{'pool': 2, 'workspace': 0, 'active': True}], 0)
        self.assertNotEqual(captured_before, original_after)  # An unfenced phantom is outside the equivalence proof.

    def test_default_entry_has_no_query_process_or_provider_transport(self):
        self.assertFalse(c.ENTRY_ENABLED)
        text = (HERE / 'candidate.py').read_text()
        for token in ['subprocess', 'psycopg', 'requests.', 'exec_command']:
            self.assertFalse(token in text)


if __name__ == '__main__':
    unittest.main()
