"""Inert sidecar tests: synthetic metadata/fake ports, no private reads or SQL."""
import copy, importlib.util, inspect, io, json, unittest
from pathlib import Path
from unittest.mock import patch
from pglast import parse_sql

spec = importlib.util.spec_from_file_location('attempt36_sidecar', Path(__file__).with_name('observe.py'))
s = importlib.util.module_from_spec(spec);spec.loader.exec_module(s)


def uid(n): return 'a0740000-0000-4000-8000-' + str(n).zfill(12)


def cases():
    rows = [];inputs = {'failure_job_id': uid(2)}
    for i, role in enumerate(['success', 'failure']):
        job = s.SUCCESS_JOB if role == 'success' else inputs['failure_job_id']
        stages = ['prepare_candidate', 'transcribe_candidate', 'extract_candidate', 'select_frames', 'apply_candidate'] if i == 0 else ['prepare_candidate']
        attempts = []
        for n, stage in enumerate(stages, 1):
            attempts.append({'attempt': {'schema_version': '1.0', 'job_id': job, 'attempt_id': uid(i * 100 + n), 'kind': 'candidate_scan',
                'stage': stage, 'attempt': n, 'stage_attempt': 1, 'dispatch_generation': n, 'correlation_id': 'synthetic-sidecar',
                'input_hash': 'a' * 64, 'workflow_execution_id': str(i * 100 + n), 'workflow_execution_ref_state': 'recorded',
                'claimed_at': '2026-11-01T02:30:00+00:00', 'job_row_version': n + 1},
                'events': [{'sequence': 1, 'event_type': 'succeeded' if i == 0 else 'failed', 'created_at': '2026-11-01T02:30:01+00:00'}], 'events_truncated': False})
        providers = [{'stage': a['attempt']['stage'], 'attempt_id': a['attempt']['attempt_id'], 'source_bound': True, 'openai_records': 1,
            'english_status': 'available' if a['attempt']['stage'] == 'extract_candidate' else None,
            'english_openai_records': 1 if a['attempt']['stage'] == 'extract_candidate' else 0}
            for a in attempts if a['attempt']['stage'] in ['transcribe_candidate', 'extract_candidate', 'select_frames']]
        rows.append({'job_id': job, 'workspace_id': s.WORKSPACE, 'kind': 'candidate_scan', 'stage': stages[-1], 'status': 'succeeded' if i == 0 else 'failed',
            'attempt': len(attempts), 'input_hash': 'a' * 64, 'source_asset_id': uid(300 + i), 'source_sha256': s.SUCCESS_SHA if i == 0 else s.FAILURE_SHA,
            'source_bytes': s.SUCCESS_BYTES if i == 0 else 67, 'source_mime': 'video/mp4', 'target_candidate_id': None,
            'created_at': '2026-11-01T02:29:00+00:00', 'updated_at': '2026-11-01T02:31:00+00:00',
            'error_code': None if i == 0 else 'SOURCE_UNREADABLE', 'error_retryable': None if i == 0 else False,
            'trace_count': len(attempts), 'attempts': attempts, 'provider_records': providers})
    return {'jobs': rows}, inputs


class SidecarTests(unittest.TestCase):
    def test_original_is_exact_actual_enabled_source_and_import_is_inert(self):
        old = s.original()
        self.assertEqual(s.sha((s.ROOT / s.ORIGINAL).read_bytes()), s.ORIGINAL_SHA)
        self.assertEqual(old.REAL_SHA, 'ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a')
        self.assertIs(old.ENTRY_ENABLED, True)

    def test_only_fixed_success_and_distinct_nonprotected_failure_are_admitted(self):
        old = s.original();good = {'failure_job_id': uid(2)}
        self.assertEqual(s.job_inputs(good, old), {'success_job_id': s.SUCCESS_JOB, **good})
        for bad in [{**good, 'success_job_id': uid(9)}, {'failure_job_id': s.SUCCESS_JOB}, {'failure_job_id': old.PROTECTED_JOB}, {'failure_job_id': "x';select 1;--"}]:
            with self.assertRaises(ValueError):s.job_inputs(bad, old)

    def test_source_reference_is_exact_and_explicitly_post_upload(self):
        value = s.fixed_json(s.SOURCE_REFERENCE, s.SOURCE_REFERENCE_SHA)
        self.assertEqual(s.check_source(value), value)
        for change in [{'pre_upload_verification_claimed': True}, {'pre_upload_verification_claimed': 0}, {'sha256': '0' * 64}, {'bytes': 4316429}, {'user_submitted_job_id': uid(3)}, {'extra': 'private'}]:
            with self.assertRaises(ValueError):s.check_source({**value, **change})

    def test_real_rows_are_not_rewritten_to_legacy_sample_or_reviewed_target(self):
        value, inputs = cases();unchanged = copy.deepcopy(value)
        result = s.audit_cases(value, {'observed_at': '2026-11-01T02:21:35+00:00'}, inputs, s.original())
        self.assertEqual([x['status'] for x in result], ['succeeded', 'failed'])
        self.assertEqual(value, unchanged)
        self.assertTrue(all(x['usage_or_cost_inferred'] is False for x in result))
        mutations = [lambda x:x['jobs'][0].update(source_sha256=s.original().REAL_SHA),
            lambda x:x['jobs'][0].update(source_bytes=4316429), lambda x:x['jobs'][0].update(target_candidate_id=s.original().REVIEWED),
            lambda x:x['jobs'][0].update(created_at='2026-11-01T02:20:00+00:00'),
            lambda x:x['jobs'][0]['provider_records'][0].update(openai_records=0),
            lambda x:x['jobs'][0]['provider_records'][0].update(attempt_id=x['jobs'][0]['attempts'][0]['attempt']['attempt_id']),
            lambda x:x['jobs'][0]['attempts'][0]['events'][0].update(receipt={'private': True}),
            lambda x:x['jobs'][1].update(error_retryable=True), lambda x:x['jobs'][1].update(source_bytes=68)]
        for mutate in mutations:
            bad = copy.deepcopy(value);mutate(bad)
            with self.assertRaises(ValueError):s.audit_cases(bad, {'observed_at': '2026-11-01T02:21:35+00:00'}, inputs, s.original())

    def test_same_frozen_query_is_used_and_remains_read_only(self):
        old = s.original()
        class Core:
            class Base:STATIC_KEYS = ['catalogue'];CONTROL_TABLES = []
            def base(self):return self.Base()
            def state_sql(self, phase):return "select '{}'::jsonb"
        inputs = s.job_inputs({'failure_job_id': uid(2)}, old)
        query = old.observation_sql(Core(), inputs)
        self.assertGreater(len(parse_sql(query)), 5)
        self.assertIn(s.SUCCESS_JOB, query);self.assertIn(uid(2), query)
        self.assertNotIn(s.SUCCESS_SHA, query)
        self.assertTrue(query.startswith('begin isolation level repeatable read read only;'))
        self.assertTrue(query.endswith('rollback;'))

    def test_original_baseline_hash_and_actual_before_receipt_are_required(self):
        old = s.original();observed = {'observed_at': '2026-11-01T02:21:35+00:00', 'jobs': [], 'groups': {'versions': {'count': 1}}}
        body = {'admission': {'apply': {}, 'readback': {}}, 'source_pins': {'frozen': 'a' * 64}, 'observation': observed}
        raw = json.dumps(body).encode();before = {'action': 'before', 'target': old.TARGET, 'result': 'passed', 'baseline_sha256': s.sha(raw),
            'source_pins': body['source_pins'], 'observed_at': observed['observed_at'], 'old_counts': {'versions': 1}}
        class Guard:
            def verify(self, path):self.path = path
            def verify_open(self, stream):pass
        guard = Guard()
        def run(public):
            with patch.object(s, 'BASELINE_SHA', s.sha(raw)), patch.object(s, 'fixed_json', return_value=public), \
                 patch.object(Path, 'open', return_value=io.BytesIO(raw)), patch.object(old, 'admitted', return_value=('core', 'expected')) as admit, \
                 patch.object(old, 'source_pins', return_value=body['source_pins']), patch.object(old, 'parse_observation', return_value=observed):
                result = s.load_baseline(guard, old);admit.assert_called_once_with(body['admission']);return result
        self.assertEqual(run(before)[2], body)
        self.assertEqual(guard.path, old.PRIVATE / 'baseline.json')
        for changed in [{**before, 'result': 'unconfirmed'}, {**before, 'baseline_sha256': '0' * 64},
                        {**before, 'source_pins': {'frozen': '0' * 64}}, {**before, 'observed_at': '2026-11-01T02:22:00+00:00'},
                        {**before, 'old_counts': {'versions': 2}}]:
            with self.assertRaises(ValueError):run(changed)

    def test_new_files_are_sealed_separately_and_old_ready_scope_is_retained(self):
        pins = s.own_pins()
        self.assertEqual({Path(k).name for k in pins}, {'observe.py', 'test_observe.py', 'PLAN_CHANGE.md'})
        self.assertTrue(all(len(value) == 64 for value in pins.values()))
        old = s.original()
        before = {'static': {}, 'schema': {}, 'claim_ports': {}, 'reviewed': {'row_sha256': 'a' * 64},
                  'groups': {key: {'rows': [{'key': uid(i + 900), 'sha256': 'b' * 64}]} for i, key in enumerate(old.GROUPS)}}
        after = copy.deepcopy(before);after['groups']['reviewed_media']['rows'].append({'key': uid(999), 'sha256': 'c' * 64})
        self.assertIs(old.preserve(before, after)['new_ready_versions_observed'], False)
        for mutate in [lambda x:x['reviewed'].update(row_sha256='0' * 64), lambda x:x['groups']['versions']['rows'][0].update(sha256='0' * 64)]:
            changed = copy.deepcopy(after);mutate(changed)
            with self.assertRaises(ValueError):old.preserve(before, changed)

    def test_entry_is_disabled_before_any_input_and_claim_precedes_single_dispatch(self):
        self.assertIs(type(s.ENTRY_ENABLED), bool)
        with patch.object(s, 'ENTRY_ENABLED', False), patch.object(s, 'original', side_effect=AssertionError('IO')), self.assertRaises(ValueError):s.main()
        code = inspect.getsource(s.main)
        self.assertEqual(code.count('reader.bounded('), 1)
        self.assertLess(code.index("'after.claim.json'"), code.index('reader.bounded('))
        self.assertIn("not (old.PRIVATE / 'after.claim.json').exists()", code)
        self.assertIn('other_new_job_absence_checked', code)
        self.assertNotIn('old.audit_jobs(', code)


if __name__ == '__main__':unittest.main()
