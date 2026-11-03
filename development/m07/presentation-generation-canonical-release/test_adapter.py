"""Offline collector/identity/phase-binding checks; no SQL or provider ports."""
from pathlib import Path
import copy
import importlib.util
import inspect
import unittest
from unittest.mock import patch
from pglast import parse_sql, parse_plpgsql

HERE = Path(__file__).resolve().parent


def module(name, file):
    spec = importlib.util.spec_from_file_location(name, file)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


s = module('generation42_test_state', HERE / 'state.py')
r = module('generation42_test_entry', HERE / 'release.py')


class Tests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = s.Context(root=s.MAIN, source=s.MAIN)
        cls.rows = cls.c.targets

    def test_seven_exact_production_preimages_and_mixed_original_headers(self):
        self.assertEqual(len(self.rows), 7)
        self.assertEqual(set(self.rows), {row[0] for row in s.TARGETS})
        self.assertEqual(self.rows['eps.presentation_lock_sources(uuid,text,text)']['before_sha256'], '4107c87b1a51d2c5ed506a64c81378026068406a5136b202779767efb30264e7')
        self.assertFalse(set(self.rows) & set(s.FIXED))
        for row in self.rows.values():
            definition = row['definition']
            match = s.parts(definition)
            self.assertEqual(s.sha(match[2].encode()), row['after_sha256'])
            self.assertEqual(s.sha(row['before_body'].encode()), row['before_sha256'])
            self.assertEqual(len(parse_plpgsql(definition)), 1)
            self.assertNotIn('ALTER FUNCTION', definition)
            self.assertNotIn('GRANT ', definition)
        self.assertEqual(len(parse_sql(self.c.definitions_sql())), 7)
        # No blanket logo SECURITY DEFINER/STABLE requirement is introduced.
        data = self.rows['eps.review_snapshot_data(uuid,uuid,text)']['definition']
        generate = self.rows['public.eps_generate_version(uuid,jsonb,text)']['definition']
        self.assertNotIn('SECURITY DEFINER', data[:s.parts(data).start(2)])
        self.assertIn('SECURITY DEFINER', generate[:s.parts(generate).start(2)])

    def test_alias_safe_exact_seven_normalizer_and_real_collector_parse(self):
        sql = "select p.prosrc,to_jsonb(p)from pg_proc p;select to_jsonb(p)from pg_policies p;"
        normalized = self.c.normalized(sql)
        self.assertIn("(to_jsonb(p)->>'oid')::oid", normalized)
        self.assertIn("to_jsonb(p)?'prosrc'", normalized)
        self.assertEqual(len(parse_sql(normalized)), 2)
        self.assertNotIn("'" + next(iter(s.FIXED)) + "'::regprocedure", normalized)
        # This impossible calendar value is a unit-only history label, not a
        # migration timestamp or future release artifact. Module binding stays None.
        with patch.object(s, 'VERSION', '00000000000042'):
            for query in (self.c.state_sql(), self.c.checkpoint_sql()):
                self.assertEqual(len(parse_sql(query)), 1)
                self.assertLess(len(query.encode()), s.MAXIMUM)
        self.assertEqual(s.VERSION, '20261103104337')

    def value(self):
        def identity(index):
            return {'oid': index, 'proowner': 10, 'proacl': None, 'proconfig': ['search_path=""'], 'prosecdef': index % 2 == 0, 'provolatile': 'v' if index % 2 else 's'}
        return {'canonical41': {}, 'history': {'versions': self.c.history, 'old_rows_sha256': 'a' * 64, 'new_entry_valid': False},
                'targets': {name: {'identity': identity(index), 'source_sha256': row['before_sha256']} for index, (name, row) in enumerate(self.rows.items(), 1)},
                'fixed_functions': {name: {'identity': identity(index), 'source_sha256': value} for index, (name, value) in enumerate(s.FIXED.items(), 20)},
                'full_scope': {'function_count': 100, **{key: 'b' * 64 for key in ['functions_normalized_sha256', 'catalogue_normalized_sha256', 'dependencies_sha256', 'audit_attributes_sha256']}}}

    def test_transition_permits_only_seven_sources_and_one_history_row(self):
        before = self.value()
        with patch.object(s, 'VERSION', '00000000000042'), patch.object(self.c.current, 'check', return_value=True):
            after = self.c.expected(before)
            self.assertTrue(self.c.transition(before, after)['only_exact_seven_prosrc_and_one_history_row_changed'])
            with patch.object(self.c, 'require_ready', return_value=self.c.definitions_sql().encode()), patch.object(s, 'MIGRATION_SHA', 'f' * 64):
                rendered = self.c.render(before, '00000000-0000-4000-8000-000000000001')
                self.assertGreater(len(parse_sql(rendered)), 12)
                self.assertGreaterEqual(len(parse_plpgsql(rendered)), 10)
                self.assertEqual(rendered.count('insert into supabase_migrations.schema_migrations'), 1)
                self.assertEqual(rendered.count('commit;select jsonb_build_object'), 1)
                self.assertIn("current_database()<>'postgres'or current_user<>'postgres'", rendered)
                self.assertLess(len(rendered.encode()), s.MAXIMUM)
            mutations = [
                lambda value: value['targets'][next(iter(self.rows))]['identity'].__setitem__('prosecdef', True),
                lambda value: value['targets'][next(iter(self.rows))]['identity'].__setitem__('proacl', ['PUBLIC=X/owner']),
                lambda value: value['fixed_functions'][next(iter(s.FIXED))].__setitem__('source_sha256', 'f' * 64),
                lambda value: value['full_scope'].__setitem__('dependencies_sha256', 'c' * 64),
                lambda value: value['history']['versions'].append('unexpected'),
            ]
            for mutate in mutations:
                bad = copy.deepcopy(after)
                mutate(bad)
                with self.assertRaises(ValueError):
                    self.c.transition(before, bad)

    def test_full_checkpoint_comparison_preserves_reason_and_every_nontarget_row(self):
        left = {'state': self.value(), 'application_tables': {'audit_events': [{'id': 'a', 'reason': 'Ω العربية'}], 'ready': [{'status': 'ready', 'payload': 1}]},
                'catalogue': {'fixed': 'same'}, 'function_rows': [], 'history_rows': [{'version': '41'}]}
        for name, row in self.rows.items():
            left['function_rows'].append({**left['state']['targets'][name]['identity'], 'prosrc': row['before_body']})
            left['catalogue']['functions|' + name + '|source_sha256'] = row['before_sha256']
        left['function_rows'].append({'oid': 500, 'prosrc': 'unchanged public validator', 'proacl': None})
        right = copy.deepcopy(left)
        for name, row in self.rows.items():
            right['catalogue']['functions|' + name + '|source_sha256'] = row['after_sha256']
            oid = left['state']['targets'][name]['identity']['oid']
            next(item for item in right['function_rows'] if item['oid'] == oid)['prosrc'] = row['after_body']
        right['history_rows'].append({'version': '00000000000042', 'statements': [], 'name': r.s.MIGRATION_NAME})
        class Views:
            plan = 'plan'
            c = None
            def checkpoint_read(self, reference):
                return left if reference == 'before' else right
            def read(self, reference):
                return {'before': left['state']}
        view = Views()
        view.c = type('ContextView', (), {'targets': self.rows, 'tables': list(left['application_tables']), 'transition': lambda *args: True})()
        with patch.object(r.s, 'VERSION', '00000000000042'):
            self.assertTrue(r.Release.compare_checkpoints(view, 'before', 'after'))
            for field, changed in [('reason', ''), ('id', 'changed')]:
                old = right['application_tables']['audit_events'][0][field]
                right['application_tables']['audit_events'][0][field] = changed
                with self.assertRaises(ValueError):
                    r.Release.compare_checkpoints(view, 'before', 'after')
                right['application_tables']['audit_events'][0][field] = old
            right['function_rows'][-1]['proacl'] = ['PUBLIC=X/owner']
            with self.assertRaises(ValueError):
                r.Release.compare_checkpoints(view, 'before', 'after')

    def test_off_phases_and_incomplete_binding_refuse_before_ports_or_claims(self):
        self.assertFalse(r.READ_ENABLED)
        self.assertFalse(r.APPLY_ENABLED)
        self.assertTrue(s.READY)
        self.assertEqual(r.COLLECTOR_FAMILY, 'presentation-generation-collector-proof')
        self.assertIs(r.Release.response_binding.__globals__['s'], r.s)
        self.assertIs(r.Release.worker.__globals__['s'], r.s)
        self.assertIs(r.Base.query.__globals__['s'], r.s)
        self.assertEqual(r.Base.prepare.__globals__['PURPOSE'], r.PURPOSE)
        inspect.signature(r.s.module).bind('existing_two_argument_transport_library', Path('unused.py'))
        raw = (HERE / 'release.py').read_bytes()
        normalize = r.parent.old.old.disabled_release_bytes
        self.assertEqual(normalize(raw), raw)
        armed = raw.replace(b'READ_ENABLED=False', b'READ_ENABLED=True').replace(b'APPLY_ENABLED=False', b'APPLY_ENABLED=True')
        self.assertEqual(normalize(armed), raw)
        operation = r.Release.__new__(r.Release)
        operation.c = self.c
        for phase in ['prepare', 'apply', 'reconcile', 'snapshot', 'admission']:
            with self.assertRaises(ValueError):
                getattr(operation, phase)()
        with patch.object(s, 'READY', False):
            with self.assertRaises(ValueError):
                self.c.require_ready()
            with self.assertRaises(ValueError):
                self.c.render({}, '00000000-0000-4000-8000-000000000001')
        with patch.object(s, 'VERSION', None):
            with self.assertRaises(ValueError):
                self.c.state_sql()
        for name in ('MIGRATION', 'MIGRATION_SHA', 'REMAINING_PROOF_REF', 'REMAINING_AUDIT_REF'):
            with patch.object(s, name, None):
                with self.assertRaises(ValueError):
                    self.c.require_ready()

    def test_actual_helper_records_require_AA_source_authority_and_original4107_restore(self):
        proof = {'run_id': 'actual-test-run', 'source_seals': {'fixture': 'a' * 64}, 'combined_generation': {'helper_installations': [
            {'variant': 'old', 'source_sha256': '280244090e5350b912dec5b23b74bb5d260e9e21df497c8ddfc2ae322fb774c4', 'authority_unchanged': True},
            {'variant': 'candidate', 'source_sha256': self.rows['eps.presentation_lock_sources(uuid,text,text)']['after_sha256'], 'authority_unchanged': True},
        ], 'original4107_and_all_six_old_bodies_restored': True, 'full_data_reason_Ready_catalogue_authority_preserved': True}}
        audit = {'actual_receipt': s.REMAINING_PROOF_REF, 'run_id': proof['run_id'], 'normal_process_exit': 0, 'runtime_source_seals_verified': 1}
        for key in ('actual_and_private_executed_source_hashes_equal', 'helper_old280_candidateAA_full_installation_records_verified',
                    'final_original4107_and_six_source_config_full_clone_restoration_completed',
                    'independent_successful_daemon_label_inventories_empty', 'fresh_shared_lock_absent', 'original_target_preserved'):
            audit[key] = True
        self.assertTrue(self.c.helper_records(proof, audit))
        mutations = [
            lambda item: item['helper_installations'][1].__setitem__('source_sha256', 'f' * 64),
            lambda item: item['helper_installations'][1].__setitem__('authority_unchanged', False),
            lambda item: item['helper_installations'][0].__setitem__('source_sha256', self.rows['eps.presentation_lock_sources(uuid,text,text)']['before_sha256']),
            lambda item: item.__setitem__('original4107_and_all_six_old_bodies_restored', False),
        ]
        for mutate in mutations:
            bad = copy.deepcopy(proof)
            mutate(bad['combined_generation'])
            with self.assertRaises(ValueError):
                self.c.helper_records(bad, audit)
        for key in ('helper_old280_candidateAA_full_installation_records_verified', 'final_original4107_and_six_source_config_full_clone_restoration_completed'):
            bad_audit = copy.deepcopy(audit)
            bad_audit[key] = False
            with self.assertRaises(ValueError):
                self.c.helper_records(proof, bad_audit)

    def test_actual_passed_remaining_reference_and_exact_migration_binding(self):
        self.assertEqual(self.c.require_ready(), self.c.definitions_sql().encode())
        value = self.c.admission()
        self.assertEqual(value['local_proof'], s.REMAINING_PROOF_REF)
        self.assertEqual(value['local_proof_postrun_audit'], s.REMAINING_AUDIT_REF)
        self.assertFalse(value['production_acceptance_claimed'])


if __name__ == '__main__':
    unittest.main()
