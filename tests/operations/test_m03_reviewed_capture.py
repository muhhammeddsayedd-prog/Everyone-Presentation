"""Offline source/answer-key/privacy regressions; no CLI or provider calls."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import sys
import unittest
import uuid

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('reviewed_capture', ROOT / 'tools/capture-m03-reviewed.py')
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)


def hashed(value): return hashlib.sha256(value.encode()).hexdigest()


def fixture():
    baseline = json.loads((ROOT / capture.BASELINE).read_bytes())
    old = baseline['state']['retained_profiles']
    key = {'name': 'SYNTHETIC PRIVATE ANSWER', 'age': 37}
    state = {
        'observed_at': '2026-10-29T21:00:00+00:00', 'query_role': 'postgres', 'database': 'postgres',
        'unrestricted_visibility': True, 'versions': baseline['state']['versions'],
        'job': {'id': capture.JOB, 'kind': 'candidate_scan', 'workspace_id': capture.WORKSPACE,
            'project_id': capture.PROJECT, 'status': 'succeeded', 'stage': 'apply_candidate',
            'input_sha256': baseline['state']['job']['input_sha256'], 'target_candidate_id': None},
        'source': {'asset_id': capture.ASSET, 'sha256': capture.SOURCE_SHA, 'size_bytes': capture.SOURCE_SIZE, 'status': 'ready'},
        'candidate': {'id': capture.CANDIDATE, 'candidate_media_id': capture.MEDIA, 'source_job_id': capture.JOB,
            'source_asset_id': capture.ASSET, 'source_kind': 'scan', 'unarchived': True,
            'created_by_matches_requester': True, 'effective_reviewed': True, 'review_fingerprint_matches': True,
            'facts_fingerprint': 'b' * 64, 'reviewed_facts_fingerprint': 'b' * 64,
            'reviewer_matches_requester': True, 'reviewed_at': '2026-10-29T20:10:01+00:00', 'row_version': 3,
            'name_manual_by_requester': True, 'other_supplied_facts_unchanged': True,
            'populated_source_fact_count': 2, 'changed_supplied_field_paths': ['facts.name'],
            'extraction_matches_persisted_stage': True,
            'selected_frame_asset_ids': copy.deepcopy(baseline['state']['application']['selected_frame_asset_ids']),
            'frames': capture.baseline_frames(baseline),
            'private_comparison': {'current_name_sha256': hashed(key['name']), 'original_name_sha256': hashed('SYNTHETIC OLD NAME'),
                'current_age_integer_sha256': hashed(str(key['age'])), 'original_age_integer_sha256': hashed(str(key['age']))}},
        'audit': [
            {'id': '00000000-0000-4000-8000-000000000001', 'action': 'cast.update_candidate', 'at': '2026-10-29T20:09:00+00:00', 'actor_matches_requester': True},
            {'id': '00000000-0000-4000-8000-000000000002', 'action': 'cast.confirm_candidate_reviewed', 'at': '2026-10-29T20:10:00+00:00', 'actor_matches_requester': True}],
        'generation_capability': {'capability': 'presentations.generate', 'requester_derived_from_job': True, 'grant_count': 0, 'active': None, 'state': 'absent'},
        'retained_profiles': copy.deepcopy(old)}
    return state, key, baseline


class ReviewedCapture(unittest.TestCase):
    def test_owner_key_accepts_only_exact_private_fields_and_valid_types(self):
        key = {'name': 'SYNTHETIC NAME', 'age': 37}
        self.assertEqual(capture.parse_ground_truth(key), key)
        for bad in (None, [], {**key, 'sql': 'select 1'}, {**key, 'target': 'other'},
                    {**key, 'name': ''}, {**key, 'name': ' leading'}, {**key, 'name': 'line\nname'},
                    {**key, 'age': True}, {**key, 'age': '37'}, {**key, 'age': -1}, {**key, 'age': 131}):
            with self.subTest(case=type(bad).__name__), self.assertRaises(ValueError): capture.parse_ground_truth(bad)

    def test_valid_reviewed_readback_emits_only_matches_and_source_specific_counts(self):
        state, key, baseline = fixture()
        result = capture.validate(state, key, baseline, state['versions'])
        self.assertTrue(result['owner_key_name_matches'])
        self.assertTrue(result['owner_key_age_matches'])
        self.assertTrue(result['effective_reviewed'])
        self.assertEqual(result['source_answer_key_fields'], 2)
        self.assertEqual(result['source_corrected_field_count'], 1)
        self.assertEqual(result['original_profile_count'], 9)
        self.assertEqual(result['original_frame_count'], 108)
        self.assertEqual(result['generation_capability']['state'], 'absent')
        serialized = json.dumps(result)
        for secret in (key['name'], hashed(key['name']), hashed(str(key['age'])), hashed('SYNTHETIC OLD NAME'), 'private_comparison'):
            self.assertNotIn(secret, serialized)
        self.assertNotIn('accuracy', result)

    def test_stale_review_fingerprint_and_wrong_reviewer_cannot_pass(self):
        for key, value in (('effective_reviewed', False), ('review_fingerprint_matches', False),
                           ('reviewed_facts_fingerprint', 'c' * 64), ('reviewer_matches_requester', False),
                           ('created_by_matches_requester', False), ('name_manual_by_requester', False)):
            state, expected, baseline = fixture(); state['candidate'][key] = value
            with self.subTest(field=key), self.assertRaises(ValueError): capture.validate(state, expected, baseline, state['versions'])

    def test_private_name_age_mismatch_or_uncorrected_name_cannot_pass(self):
        for change in ('name', 'age', 'original_age', 'no_correction', 'missing_hash'):
            state, expected, baseline = fixture(); private = state['candidate']['private_comparison']
            if change == 'name': private['current_name_sha256'] = 'f' * 64
            elif change == 'age': private['current_age_integer_sha256'] = 'f' * 64
            elif change == 'original_age': private['original_age_integer_sha256'] = 'f' * 64
            elif change == 'no_correction': private['original_name_sha256'] = private['current_name_sha256']
            else: private['current_age_integer_sha256'] = None
            with self.subTest(change=change), self.assertRaises(ValueError): capture.validate(state, expected, baseline, state['versions'])

    def test_wrong_source_job_history_scope_or_provider_extraction_binding_cannot_pass(self):
        changes = [('job', 'id', '00000000-0000-4000-8000-000000000099'),
            ('job', 'project_id', '00000000-0000-4000-8000-000000000099'), ('job', 'input_sha256', 'c' * 64),
            ('source', 'sha256', 'c' * 64), ('source', 'size_bytes', 1),
            ('candidate', 'extraction_matches_persisted_stage', False), ('candidate', 'other_supplied_facts_unchanged', False),
            ('candidate', 'populated_source_fact_count', 3), ('candidate', 'changed_supplied_field_paths', ['facts.name', 'facts.city'])]
        for section, key, value in changes:
            state, expected, baseline = fixture(); state[section][key] = value
            with self.subTest(section=section, key=key), self.assertRaises(ValueError): capture.validate(state, expected, baseline, state['versions'])
        state, expected, baseline = fixture(); state['versions'] = state['versions'][:-1]
        with self.assertRaises(ValueError): capture.validate(state, expected, baseline, baseline['state']['versions'])

    def test_nine_old_facts_and_all_108_frames_and_new_frame_choices_must_be_preserved(self):
        for change in ('old_fact', 'old_frame', 'old_missing', 'new_frame', 'new_selected'):
            state, expected, baseline = fixture()
            if change == 'old_fact': state['retained_profiles'][0]['facts_sha256'] = 'e' * 64
            elif change == 'old_frame': state['retained_profiles'][0]['frames'][0]['sha256'] = 'e' * 64
            elif change == 'old_missing': state['retained_profiles'].pop()
            elif change == 'new_frame': state['candidate']['frames'][0]['sha256'] = 'e' * 64
            else: state['candidate']['selected_frame_asset_ids'].reverse()
            with self.subTest(change=change), self.assertRaises(ValueError): capture.validate(state, expected, baseline, state['versions'])

    def test_audit_requires_ordinary_owner_actions_in_order_and_recent_confirmation(self):
        for change in ('missing_update', 'missing_confirm', 'wrong_action', 'wrong_actor', 'order', 'old_confirm'):
            state, expected, baseline = fixture()
            if change == 'missing_update': state['audit'].pop(0)
            elif change == 'missing_confirm': state['audit'].pop()
            elif change == 'wrong_action': state['audit'][0]['action'] = 'manual.sql.override'
            elif change == 'wrong_actor': state['audit'][1]['actor_matches_requester'] = False
            elif change == 'order': state['audit'].reverse()
            else: state['audit'][1]['at'] = '2026-10-29T20:00:00+00:00'
            with self.subTest(change=change), self.assertRaises(ValueError): capture.validate(state, expected, baseline, state['versions'])

    def test_generation_capability_is_reported_without_grants_and_false_states_are_rejected(self):
        for status, count, active in (('absent', 0, None), ('active', 1, True), ('inactive', 1, False)):
            state, expected, baseline = fixture(); state['generation_capability'].update(state=status, grant_count=count, active=active)
            self.assertEqual(capture.validate(state, expected, baseline, state['versions'])['generation_capability']['state'], status)
        for change in ('wrong_capability', 'wrong_actor', 'invalid_count', 'false_status'):
            state, expected, baseline = fixture(); row = state['generation_capability']
            if change == 'wrong_capability': row['capability'] = 'settings.manage'
            elif change == 'wrong_actor': row['requester_derived_from_job'] = False
            elif change == 'invalid_count': row['grant_count'] = 2
            else: row['state'] = 'active'
            with self.subTest(change=change), self.assertRaises(ValueError): capture.validate(state, expected, baseline, state['versions'])

    def test_unknown_personal_or_diagnostic_fields_are_rejected_before_public_projection(self):
        for location, key in (('top', 'facts'), ('job', 'email'), ('candidate', 'name'), ('source', 'object_key'), ('generation_capability', 'principal_id')):
            state, expected, baseline = fixture(); target = state if location == 'top' else state[location]
            target[key] = 'SYNTHETIC PRIVATE MARKER'
            with self.subTest(location=location), self.assertRaises(ValueError): capture.validate(state, expected, baseline, state['versions'])

    def test_fixed_sql_is_read_only_and_contains_no_private_answer_key_substitution(self):
        from pglast import parse_sql
        query = (ROOT / capture.SQL).read_text(encoding='utf8')
        kinds = [type(statement.stmt).__name__ for statement in parse_sql(query)]
        self.assertEqual(kinds, ['TransactionStmt', 'VariableSetStmt', 'VariableSetStmt', 'VariableSetStmt', 'SelectStmt', 'TransactionStmt'])
        self.assertTrue(query.startswith('-- Fixed'))
        self.assertIn('begin isolation level repeatable read read only;', query)
        self.assertTrue(query.rstrip().endswith('rollback;'))
        for forbidden in ('auth.users', 'auth.sessions', 'original_transcript', 'set_config', '__', 'request.jwt', 'SYNTHETIC PRIVATE ANSWER'):
            self.assertNotIn(forbidden, query)
        self.assertEqual(capture.sha((ROOT / capture.SQL).read_bytes()), capture.SQL_SHA)
        self.assertEqual(capture.sha((ROOT / capture.BASELINE).read_bytes()), capture.BASELINE_SHA)
        with self.assertRaises(ValueError): capture.main(['--target', 'other'])

    def test_duplicate_json_fields_are_rejected_without_echoing_private_values(self):
        with self.assertRaises(ValueError) as stopped:
            capture.strict_json(b'{"name":"SYNTHETIC PRIVATE VALUE","age":37,"age":38}')
        self.assertNotIn('SYNTHETIC PRIVATE VALUE', str(stopped.exception))

    @unittest.skipUnless(os.name == 'nt', 'Actual Windows protected-file boundary')
    def test_actual_protected_synthetic_file_reads_stably_and_obeys_size_bound(self):
        from provision_logo_verifier import WindowsPrivateFiles
        relative = '.local/m03-reviewed-tests/' + uuid.uuid4().hex + '.json'
        file = ROOT / relative
        self.assertTrue(file.resolve().is_relative_to(ROOT.resolve() / '.local/m03-reviewed-tests'))
        file.parent.mkdir(parents=True, exist_ok=True)
        data = b'{"name":"SYNTHETIC PRIVATE VALUE","age":37}'
        try:
            security = WindowsPrivateFiles()
            with security.create(file) as handle:
                handle.write(data); handle.flush(); os.fsync(handle.fileno()); security.verify_open(handle)
            self.assertEqual(capture.stable_read(relative, 8192, private=True), data)
            with self.assertRaises(ValueError): capture.stable_read(relative, len(data) - 1, private=True)
        finally:
            self.assertTrue(file.resolve().is_relative_to(ROOT.resolve() / '.local/m03-reviewed-tests'))
            file.unlink(missing_ok=True)

    def test_protected_cli_and_path_dependencies_are_exactly_sealed(self):
        for file, expected in capture.SEALS.items():
            self.assertEqual(capture.sha((ROOT / file).read_bytes()), expected, file)

    def test_original_extraction_projection_uses_the_canonical_apply_result_key_and_completed_payload(self):
        query = (ROOT / capture.SQL).read_text(encoding='utf8')
        applied = (ROOT / 'supabase/migrations/20261029100500_m03_candidate_pipeline.sql').read_text(encoding='utf8')
        self.assertIn("extraction:=extracted.payload->'result';", applied)
        self.assertIn("p.payload->'result'=s.extraction", query)
        self.assertNotIn("p.payload->'extraction'", query)
        self.assertIn("p.result_schema='candidate-extraction-stage.v1'", query)
        self.assertIn("p.payload->>'source_asset_id'=s.source_asset_id::text", query)
        self.assertIn("done#>>'{result,stage_output_id}'=p.id::text", query)
        self.assertIn("done->>'attempt_id'=p.attempt_id::text", query)
        self.assertIn("done->>'input_hash'=j.input_hash", query)


if __name__ == '__main__': unittest.main()
