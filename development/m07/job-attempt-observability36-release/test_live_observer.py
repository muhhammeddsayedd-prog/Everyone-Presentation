"""Inert live-observer tests; no reader, SQL, media or provider is invoked."""
import copy
import inspect
import unittest
from unittest.mock import patch
from pglast import ast, parse_sql
from pglast.visitors import Visitor
import live_observer as observer


def identifier(number):return 'a0740000-0000-4000-8000-' + str(number).zfill(12)


class Base:
    STATIC_KEYS = ['catalogue', 'history', 'protected_m02', 'protected_m02_integrity', 'english']
    CONTROL_TABLES = []
    def static_schema_sql(self):return "select '{}'::jsonb"


class Schema:
    def new_schema_sql(self):return "select '{}'::jsonb"
    def check_schema_after(self, value):observer.need(value == {'synthetic_schema': True})


class Core:
    VERSION = '20261101012057'
    def base(self):return Base()
    def module(self, name):
        assert name == 'schema_gate';return Schema()
    def ports_sql(self, _base):return "'{}'::jsonb"
    def state_sql(self, phase):
        assert phase == 'after';return "select '{}'::jsonb"


def baseline():
    static = {'history': [str(v) for v in range(35)] + [Core.VERSION], 'protected_m02_integrity': True,
              'protected_m02': {'job_id': observer.PROTECTED_JOB}, 'english': {'flags': ['1.0'], 'security': True},
              'catalogue': {'count': 10, 'sha256': 'a' * 64}, 'schema': {'synthetic_schema': True},
              'delta_metadata': {}, 'claim_ports': {}, 'control_plane': {}}
    return {'observed_at': '2026-11-01T02:00:00+00:00', 'database': 'postgres', 'operator': 'postgres', 'session_user': 'postgres',
            'static': static, 'schema': {'synthetic_schema': True}, 'claim_ports': {},
            'reviewed': {'candidate_id': observer.REVIEWED, 'row_sha256': 'b' * 64, 'is_reviewed': True},
            'groups': {name: {'count': 1, 'rows': [{'key': identifier(i + 100), 'version_id': identifier(100) if name in observer.EXACT_GROUPS else None, 'sha256': 'c' * 64}]}
                       for i, name in enumerate(observer.GROUPS)}, 'jobs': []}


def jobs():
    value = baseline();inputs = {'success_job_id': identifier(1), 'failure_job_id': identifier(2)}
    for index, role in enumerate(['success', 'failure']):
        stages = ['prepare_candidate', 'transcribe_candidate', 'extract_candidate', 'select_frames', 'apply_candidate'] if role == 'success' else ['prepare_candidate']
        attempts = []
        for number, stage in enumerate(stages, 1):
            attempts.append({'attempt': {'schema_version': '1.0', 'job_id': inputs[role + '_job_id'], 'attempt_id': identifier(index * 1000 + number + 10),
                                         'kind': 'candidate_scan', 'stage': stage, 'attempt': number, 'stage_attempt': 1,
                                         'dispatch_generation': number, 'correlation_id': 'synthetic-audit-' + role, 'input_hash': 'd' * 64,
                                         'workflow_execution_id': 'synthetic-n8n-' + str(index * 1000 + number), 'workflow_execution_ref_state': 'recorded',
                                         'claimed_at': '2026-11-01T02:01:00+00:00', 'job_row_version': number + 1},
                             'events': [{'sequence': 1, 'event_type': 'succeeded' if role == 'success' else 'failed', 'created_at': '2026-11-01T02:01:01+00:00'}],
                             'events_truncated': False})
        provider = [{'stage': item['attempt']['stage'], 'attempt_id': item['attempt']['attempt_id'], 'source_bound': True,
                     'openai_records': 1, 'english_status': 'available' if item['attempt']['stage'] == 'extract_candidate' else None,
                     'english_openai_records': 1 if item['attempt']['stage'] == 'extract_candidate' else 0}
                    for item in attempts if item['attempt']['stage'] in ['transcribe_candidate', 'extract_candidate', 'select_frames']]
        value['jobs'].append({'job_id': inputs[role + '_job_id'], 'workspace_id': observer.WORKSPACE, 'kind': 'candidate_scan',
                               'stage': stages[-1], 'status': 'succeeded' if role == 'success' else 'failed', 'attempt': len(attempts),
                               'input_hash': 'd' * 64, 'source_asset_id': identifier(index + 3000), 'source_sha256': observer.REAL_SHA if role == 'success' else observer.FAILURE_SHA,
                               'source_bytes': 4316429 if role == 'success' else 67, 'source_mime': 'video/mp4', 'target_candidate_id': observer.REVIEWED if role == 'success' else None,
                               'created_at': '2026-11-01T02:00:01+00:00', 'updated_at': '2026-11-01T02:01:02+00:00',
                               'error_code': None if role == 'success' else 'SOURCE_UNREADABLE', 'error_retryable': None if role == 'success' else False,
                               'trace_count': len(attempts), 'attempts': attempts, 'provider_records': provider})
    return value, inputs


class LiveObserverTests(unittest.TestCase):
    def test_two_job_ids_are_finite_distinct_and_exclude_protected(self):
        good = {'success_job_id': 'a0740000-0000-4000-8000-000000000001',
                'failure_job_id': 'a0740000-0000-4000-8000-000000000002'}
        self.assertEqual(observer.job_inputs(good), good)
        for bad in [{**good, 'extra': True}, {**good, 'failure_job_id': good['success_job_id']},
                    {**good, 'failure_job_id': observer.PROTECTED_JOB},
                    {**good, 'success_job_id': "x';select true;--"}]:
            with self.assertRaises(ValueError):
                observer.job_inputs(bad)

    def test_actual_closed_SQL_parses_and_reuses_exact_bounded_operator_query(self):
        for inputs in [None, jobs()[1]]:
            sql = observer.observation_sql(Core(), inputs)
            self.assertGreater(len(parse_sql(sql)), 5)
            self.assertIn('begin isolation level repeatable read read only;', sql)
            self.assertTrue(sql.endswith('rollback;'))
            self.assertNotRegex(sql, r'(?im)^\s*(?:insert|update|delete|create|alter|drop|grant|revoke|commit)\b')
            self.assertIn('ordinal<=10000', sql)
            self.assertNotIn('lease_token', sql)
        query = observer.attempt_query(identifier(1))
        self.assertIn('limit 101', query)
        self.assertIn('ordinal<=100', query)
        self.assertIn('e.job_id=a.job_id and e.attempt_id=a.attempt_id', query)
        self.assertNotIn('$1', query)

    def test_current_real_state_core_SQL_composition_parses_without_executing(self):
        path = observer.HERE / 'state.py'
        core = observer.load_module('test_state', path.relative_to(observer.ROOT).as_posix(), observer.sha(path.read_bytes()))
        for inputs in [None, jobs()[1]]:
            sql = observer.observation_sql(core, inputs)
            parsed = parse_sql(sql)
            self.assertGreater(len(parsed), 5)
            select = next(row.stmt for row in parsed if isinstance(row.stmt, ast.SelectStmt))
            readiness = next(cte for cte in select.withClause.ctes if cte.ctename == 'readiness')
            self.assertEqual(len(readiness.ctequery.targetList), 1)
            self.assertEqual(readiness.ctequery.targetList[0].name, 'value')
            class Types(Visitor):
                def visit_TypeName(self, _ancestors, node):
                    self.assert_type_names(node)
                def assert_type_names(self, node):
                    names = [part.sval for part in node.names]
                    if names[-1] == 'jsonbas':raise AssertionError('fused JSONB alias')
            Types()(parsed)

    def test_old_ready_exact_cohort_and_reviewed_subset_allow_new_media_only(self):
        before = baseline();after = copy.deepcopy(before)
        for group in ['assets', 'reviewed_media', 'reviewed_frames']:
            after['groups'][group]['rows'].append({'key': identifier(999), 'version_id': None, 'sha256': 'e' * 64})
            after['groups'][group]['count'] += 1
        self.assertTrue(observer.preserve(before, after)['old_ready_reviewed_and_source_metadata_preserved'])
        for modify in [lambda x: x['reviewed'].update(row_sha256='0' * 64),
                       lambda x: x['static'].update(protected_m02_integrity=False),
                       lambda x: x['groups']['raw']['rows'][0].update(sha256='0' * 64),
                       lambda x: x['groups']['english']['rows'][0].update(sha256='0' * 64),
                       lambda x: x['groups']['versions']['rows'].append({'key': identifier(999), 'version_id': identifier(999), 'sha256': '0' * 64})]:
            changed = copy.deepcopy(before);modify(changed)
            with self.assertRaises(ValueError):observer.preserve(before, changed)

    def test_report_scope_is_ready_cohort_and_two_audited_jobs_only(self):
        preserved = observer.preserve(baseline(), copy.deepcopy(baseline()))
        self.assertIs(preserved['new_ready_versions_observed'], False)
        self.assertNotIn('new_versions_created', preserved)
        value, inputs = jobs()
        self.assertEqual(len(observer.audit_jobs(value, baseline(), inputs, observer.parse_trace)), 2)
        # Only the two supplied job IDs are queried; the receipt must not infer
        # absence of other new workspace jobs from this finite audit.
        code = inspect.getsource(observer.main)
        self.assertIn("receipt['audited_job_count'] = len(receipt['jobs'])", code)
        self.assertIn("receipt['other_new_job_absence_checked'] = False", code)

    def test_readiness_metadata_checks_actual36_English_Reviewed_and_unknown_fields(self):
        value = baseline();expected = {**value['static'], 'schema': value['schema'], 'claim_ports': {}}
        parsed = observer.parse_observation([{'live_observation': value}], Core(), expected)
        self.assertEqual(parsed, value)
        for modify in [lambda x: x.update(raw_transcript='private'),
                       lambda x: x['static']['catalogue'].update(sha256='0' * 64),
                       lambda x: x['reviewed'].update(is_reviewed=False),
                       lambda x: x['groups']['versions']['rows'][0].update(raw_payload='private'),
                       lambda x: x['groups']['versions'].update(count=10001),
                       lambda x: x.update(session_user='other')]:
            changed = copy.deepcopy(value);modify(changed)
            with self.assertRaises(ValueError):observer.parse_observation([{'live_observation': changed}], Core(), expected)

    def test_two_real_scoped_cases_have_recorded_attempts_events_and_provider_counts(self):
        value, inputs = jobs()
        result = observer.audit_jobs(value, baseline(), inputs, observer.parse_trace)
        self.assertEqual([row['status'] for row in result], ['succeeded', 'failed'])
        self.assertTrue(all(row['usage_or_cost_inferred'] is False for row in result))
        mutations = [lambda x: x['jobs'][0].update(workspace_id=identifier(999)),
                     lambda x: x['jobs'][0].update(created_at='2026-11-01T01:59:59+00:00'),
                     lambda x: x['jobs'][0].update(source_sha256='0' * 64),
                     lambda x: x['jobs'][0]['attempts'][0]['attempt'].update(workflow_execution_ref_state='not_provided', workflow_execution_id=None),
                     lambda x: x['jobs'][0]['attempts'][0]['events'][0].update(receipt={'private': True}),
                     lambda x: x['jobs'][0]['provider_records'][0].update(openai_records=0),
                     lambda x: x['jobs'][1].update(status='succeeded'),
                     lambda x: x['jobs'][1].update(error_retryable=True),
                     lambda x: x['jobs'][1].update(provider_records=[{'unexpected': True}])]
        for modify in mutations:
            changed = copy.deepcopy(value);modify(changed)
            with self.assertRaises(ValueError):observer.audit_jobs(changed, baseline(), inputs, observer.parse_trace)

    def test_trace_parser_rejects_payloads_coercion_and_counter_or_secret_shapes(self):
        trace = jobs()[0]['jobs'][0]['attempts'][0]['attempt']
        for patch in [{'input': {}}, {'lease_token': 'private'}, {'attempt': True}, {'stage_attempt': 0},
                      {'workflow_execution_ref_state': {}}, {'workflow_execution_id': 'https://private.invalid/?token=x'}]:
            with self.assertRaises(ValueError):observer.parse_trace({**trace, **patch})

    def test_entry_is_closed_and_exclusive_claim_precedes_one_reader_dispatch(self):
        self.assertIs(type(observer.ENTRY_ENABLED), bool)
        # Root may arm both entry flags before the joint cloud source freeze.
        # Explicit FALSE must still stop before any protected input/target IO.
        with patch.object(observer, 'ENTRY_ENABLED', False), self.assertRaises(ValueError):
            observer.main()
        code = inspect.getsource(observer.main)
        self.assertLess(code.index('need(ENTRY_ENABLED'), code.index('private_json('))
        self.assertLess(code.index("action + '.claim.json'"), code.index('reader.bounded('))
        self.assertEqual(code.count('reader.bounded('), 1)
        self.assertNotIn("(PRIVATE / 'baseline.json').read_bytes()", code)
        self.assertIn('guard = load_module', code)
        self.assertIn("'supabase@2.122.0'", code)

    def test_ready_admission_binds_observer_bytes_to_joint_actual_apply_pins(self):
        core = Core();state_file = (observer.HERE / 'state.py').relative_to(observer.ROOT).as_posix()
        pins = {state_file: 'a' * 64, 'observer-source': 'b' * 64}
        expected = baseline()['static']
        apply = {'action': 'apply', 'target': observer.TARGET, 'result': 'passed', 'normal_return_marker_observed': True,
                 'independent_readback_verified': True, 'claim_retained': True, 'first': {'same': True}, 'second': {'same': True},
                 'static_schema_after': expected, 'source_pins': pins}
        readback = {'action': 'readback', 'target': observer.TARGET, 'result': 'observed_applied',
                    'static_schema_after': expected, 'source_pins': pins}
        refs = {'apply': {}, 'readback': {}}
        with patch.object(observer, 'public_reference', side_effect=[apply, readback]), patch.object(observer, 'load_module', return_value=core), \
             patch.object(observer, 'source_pins', return_value=pins):
            self.assertEqual(observer.admitted(refs), (core, expected))
        changed = copy.deepcopy(apply);changed['source_pins']['observer-source'] = '0' * 64
        changed_readback = copy.deepcopy(readback);changed_readback['source_pins'] = changed['source_pins']
        with patch.object(observer, 'public_reference', side_effect=[changed, changed_readback]), patch.object(observer, 'load_module', return_value=core), \
             patch.object(observer, 'source_pins', return_value=pins), self.assertRaises(ValueError):
            observer.admitted(refs)


if __name__ == '__main__':
    unittest.main()
