"""Offline metadata/projection regressions. No private, provider or cloud IO."""
import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('m04_review_capture', ROOT / 'tools/capture-m04-review.py')
capture = importlib.util.module_from_spec(spec); spec.loader.exec_module(capture)


def ID(value): return '8b000000-0000-4000-8000-' + str(value).zfill(12)


def fixture():
    reference = capture.baselines(); old = reference['casting']['state']; vision = reference['vision']['state']; registry = reference['registry']
    versions = vision['versions'] + ['20261029202629']; main = '098d5b48-42a3-475b-b562-735c9eafce80'
    fields = {row['id']: row for row in old['old_candidates']}; pools = {row['id']: row for row in old['old_participations']}
    separation = []
    for row in old['assignments']:
        candidate = pools[row['workspace_candidate_id']]['candidate_id'] if row['workspace_candidate_id'] in pools else '6a15cdc3-4002-40f3-a2b1-5d8dfa8d6054'
        preserved = fields.get(candidate, {'facts_sha256': 'a' * 64, 'field_sources_sha256': 'b' * 64})
        separation.append({'assignment_id': row['id'], 'workspace_id': main, 'slot_id': row['slot_id'], 'candidate_id': candidate,
            **{key: row[key] for key in ('position', 'shortlist_included', 'archived', 'presentation_notes_sha256', 'internal_notes_sha256', 'slide_wording_sha256')},
            'candidate_facts_fingerprint': 'c' * 64, 'candidate_facts_sha256': preserved['facts_sha256'], 'candidate_field_sources_sha256': preserved['field_sources_sha256'], 'project_availability_sha256': None})
    reused = fields['d5e665b3-dc23-4ead-858e-81abbce55743']
    separation.append({'assignment_id': ID(10), 'workspace_id': main, 'slot_id': capture.WAITER_SLOTS[0], 'candidate_id': reused['id'], 'position': 'option', 'shortlist_included': False, 'archived': False,
        'presentation_notes_sha256': None, 'internal_notes_sha256': None, 'slide_wording_sha256': 'd' * 64, 'candidate_facts_fingerprint': 'c' * 64,
        'candidate_facts_sha256': reused['facts_sha256'], 'candidate_field_sources_sha256': reused['field_sources_sha256'], 'project_availability_sha256': None})
    series = []; reviews = []
    active_roles = {row['id']: row for row in old['roles'] if not row['archived']}
    slots = sorted((row for row in old['slots'] if not row['archived'] and row['role_id'] in active_roles), key=lambda row: (active_roles[row['role_id']]['sort_order'], row['role_id'], row['sort_order'], row['id']))
    for number, output in ((1, 'selection'), (2, 'shortlist')):
        series.append({'id': ID(number), 'workspace_id': main, 'output_type': output, 'audience_preset_id': ID(3), 'audience_scope': 'internal', 'title_sha256': 'a' * 64, 'audience_sha256': 'a' * 64,
            'template_key': registry['key'], 'template_version': registry['version'], 'template_content_sha256': registry['content_sha256'], 'font_key': registry['font_key'], 'row_version': 1, 'archived': False})
        slides = []
        for slot in slots:
            included = [row for row in separation if row['slot_id'] == slot['id'] and not row['archived'] and (output == 'selection' or row['shortlist_included'])]
            for row in included or [None]:
                slides.append({'order': len(slides) + 1, 'kind': 'candidate' if row else 'pending', 'role_id': slot['role_id'], 'slot_id': slot['id'],
                    'assignment_id': row['assignment_id'] if row else None, 'candidate_id': row['candidate_id'] if row else None, 'candidate_media_id': None,
                    'position': row['position'] if row else None, 'review_status': 'unreviewed' if row else None, 'fields_sha256': 'b' * 64, 'source_fields_sha256': 'b' * 64, 'requirements_sha256': 'b' * 64,
                    'frame_asset_ids': [], 'video_asset_id': None})
        candidates = sum(slide['kind'] == 'candidate' for slide in slides)
        reviews.append({'series_id': ID(number), 'workspace_id': main, 'input_fingerprint': ('e' if number == 1 else 'f') * 64, 'draft_revision': 30, 'output_type': output,
            'candidate_slide_count': candidates, 'pending_slide_count': len(slides) - candidates, 'expected_page_count': len(slides) + 1, 'expected_tenfield_rectangle_count': 10 * candidates,
            'total_rectangles_persisted': False, 'cover_sha256': 'c' * 64, 'slides': slides})
    subject = {'id': capture.CANDIDATE, 'row_version': 3, 'facts_fingerprint': reference['reviewed']['confirmation']['reviewed_facts_fingerprint'], 'effective_reviewed': True,
        'reviewed_facts_fingerprint': reference['reviewed']['confirmation']['reviewed_facts_fingerprint'], 'candidate_media_id': capture.MEDIA, 'source_job_id': capture.JOB,
        'source_asset_id': capture.ASSET, 'source_sha256': vision['source']['sha256'], 'source_size_bytes': vision['source']['size_bytes'],
        'selected_frame_asset_ids': copy.deepcopy(vision['application']['selected_frame_asset_ids']),
        'frames': [{'asset_id': row['frame_asset_id'], 'sha256': row['sha256'], 'timestamp_ms': row['timestamp_ms'], 'width': row['width'], 'height': row['height'], 'ready': True, 'source_and_job_match': True} for row in vision['preparation']['sampled_frames']]}
    def payload(stage, value, metadata=None): return {'id': ID(value), 'stage': stage, 'attempt_id': ID(value + 1), 'result_schema': {'prepare_suggestion': 'suggestion-preparation.v1', 'generate_suggestion': 'contextual-suggestion.v1', 'validate_suggestion': 'suggestion-validation.v1', 'measure_review_fit': 'review-fit-measurement.v1'}[stage], 'input_hash_matches': True, 'payload_sha256': 'a' * 64, 'metadata': copy.deepcopy(metadata)}
    metadata = {'provider': 'openai', 'sdk_version': '7.45.1', 'requested_model': 'gpt-6.1-sol', 'resolved_model': 'gpt-6.1-sol', 'prompt_version': 'contextual_suggestion_v1',
        'prompt_sha256': '8480a63823dc9be53ff4898c42df82f6e5b70ccc72100d141392d6c99766c242', 'schema_sha256': 'd' * 64, 'input_sha256': 'a' * 64,
        'response_id_sha256': 'b' * 64, 'request_id_sha256': None, 'usage': {'input_tokens': 10, 'output_tokens': 5, 'total_tokens': 15}}
    jobs = []
    for number, kind, resource, stage_values in ((20, 'ai_suggestion', ID(21), [payload('prepare_suggestion', 40), payload('generate_suggestion', 42, metadata), payload('validate_suggestion', 44, metadata)]),
                                               (30, 'review_fit', ID(1), [payload('measure_review_fit', 46)])):
        completed = [{'stage': row['stage'], 'attempt_id': row['attempt_id'], 'input_hash_matches': True, 'result_sha256': capture.sha(json.dumps({'stage_output_id': row['id']}, separators=(', ', ': ')).encode())} for row in stage_values]
        jobs.append({'id': ID(number), 'workspace_id': main, 'resource_id': resource, 'kind': kind, 'status': 'succeeded', 'stage': stage_values[-1]['stage'], 'attempt': len(stage_values), 'input_hash': 'a' * 64,
            'input_hash_matches': True, 'configuration_sha256': 'c' * 64, 'n8n_execution_id': '12345', 'created_at': '2026-10-29T20:30:00+00:00', 'error_code': None, 'completed_stages': completed,
            'outbox': [{'stage': row['stage'], 'status': 'delivered', 'generation': index + 1, 'attempt_count': 1, 'input_hash_matches': True} for index, row in enumerate(stage_values)], 'payloads': stage_values})
    state = {'observed_at': '2026-10-29T21:00:00+00:00', 'query_role': 'postgres', 'database': 'postgres', 'unrestricted_visibility': True, 'versions': versions,
        'workspaces': [{'id': workspace, 'project_id': project, 'row_version': 40, 'draft_revision': 30, 'archived': False} for workspace, project in capture.SCOPES.items()],
        'series': series, 'reviews': reviews, 'jobs': jobs,
        'suggestions': [{'id': ID(21), 'workspace_id': main, 'job_id': ID(20), 'target_type': 'assignment', 'target_id': old['assignments'][0]['id'], 'target_row_version': 3, 'field': 'skills_experience',
            'bound_context_sha256': 'c' * 64, 'proposal_sha256': 'a' * 64, 'proposed_change_count': 1, 'current_assignment_wording_matches': False}],
        'fit_results': [{'job_id': ID(30), 'workspace_id': main, 'series_id': ID(1), 'input_fingerprint': 'e' * 64, 'status': 'measured', 'error_code': None,
            'completed_at': '2026-10-29T20:31:00+00:00', 'result_sha256': 'a' * 64, 'renderer_version': 'everyone-casting-fit-v1', 'chromium_version': '148.0.7778.0',
            'template_content_sha256': registry['content_sha256'], 'font_hashes': {row['path']: row['sha256'] for row in registry['fonts']}, 'overflow_count': 0, 'overflows': [],
            'total_rectangles_persisted': False, 'matches_current_review': True}],
        'waiter': {'role_id': capture.WAITER, 'role_active': True, 'active_slot_ids': copy.deepcopy(capture.WAITER_SLOTS), 'assignment_ids': [ID(10)],
            'archive_event_ids': [ID(50)], 'undo_event_ids': [ID(51)], 'consumed_archive_count': 1, 'archive_audit_count': 1, 'undo_audit_count': 1},
        'subject': subject, 'retained_profiles': copy.deepcopy(vision['retained_profiles']), 'protected_m02': copy.deepcopy(old['protected_m02']), 'assignment_separation': separation}
    return state, reference, versions


class ReviewCapture(unittest.TestCase):
    def test_observed_current_application_sources_are_explicit_public_files_only(self):
        hashes = capture.observed_application_sources()
        self.assertEqual(set(hashes), set(capture.APPLICATION_SOURCES)); self.assertEqual(len(hashes), len(capture.APPLICATION_SOURCES))
        for path, value in hashes.items():
            self.assertTrue(path.startswith(('apps/', 'packages/'))); self.assertTrue(path.endswith(('.ts', '.tsx')))
            self.assertNotIn('.local', path); self.assertNotIn('.env', path); self.assertEqual(len(value), 64)
            self.assertEqual(value, capture.sha((ROOT / path).read_bytes()))
        for required in ('apps/web/components/WorkspaceReviewView.tsx', 'apps/worker/src/review-fit.ts', 'apps/worker/src/native-browser.ts', 'apps/worker/src/runtime-main.ts', 'packages/templates/src/render.ts'):
            self.assertIn(required, hashes)

    def test_complete_metadata_validates_preservation_separately_from_job_status(self):
        state, reference, versions = fixture(); result = capture.validate(state, reference, versions)
        self.assertTrue(result['structural_and_preservation_passed'])
        self.assertEqual(result['successful_ai_job_count'], 1); self.assertEqual(result['successful_native_fit_job_count'], 1)
        self.assertEqual(result['current_zero_overflow_fit_count'], 1)
        self.assertFalse(result['actual_total_rectangles_persisted'])
        self.assertFalse(result['generated_pdf_or_independent_semantic_accuracy_claimed'])
        self.assertEqual(result['main_workspace_main_count'], 1); self.assertEqual(result['main_workspace_shortlist_count'], 1)

    def test_review_and_job_completion_do_not_imply_current_fit_after_new_assignment(self):
        state, reference, versions = fixture(); state['fit_results'][0].update(input_fingerprint='b' * 64, matches_current_review=False)
        result = capture.validate(state, reference, versions)
        self.assertEqual(result['successful_native_fit_job_count'], 1); self.assertEqual(result['current_zero_overflow_fit_count'], 0)

    def test_queued_or_failed_work_is_captured_honestly_without_fake_success(self):
        for status in ('queued', 'running', 'waiting_for_input', 'failed', 'cancelled'):
            state, reference, versions = fixture(); job = state['jobs'][0]
            job.update(status=status, stage='prepare_suggestion', completed_stages=[], payloads=[], error_code='PROCESSING_FAILED' if status == 'failed' else None)
            job['outbox'] = job['outbox'][:1]; state['suggestions'][0].update(proposal_sha256=None, proposed_change_count=0, current_assignment_wording_matches=None)
            with self.subTest(status=status): self.assertEqual(capture.validate(state, reference, versions)['successful_ai_job_count'], 0)

    def test_provider_metadata_and_completed_stage_payloads_remain_bound(self):
        for change in ('input', 'provider', 'model', 'schema', 'usage', 'payload', 'attempt', 'sequence', 'outbox'):
            state, reference, versions = fixture(); job = state['jobs'][0]; metadata = job['payloads'][1]['metadata']
            if change == 'input': metadata['input_sha256'] = 'f' * 64
            elif change == 'provider': metadata['provider'] = 'synthetic'
            elif change == 'model': metadata['requested_model'] = 'foreign-model'
            elif change == 'schema': job['payloads'][1]['result_schema'] = 'unknown.v1'
            elif change == 'usage': metadata['usage']['total_tokens'] = 16
            elif change == 'payload': job['payloads'][0]['id'] = ID(999)
            elif change == 'attempt': job['payloads'][0]['attempt_id'] = ID(999)
            elif change == 'sequence': job['completed_stages'].reverse()
            else: job['outbox'][0]['status'] = 'pending'
            with self.subTest(change=change), self.assertRaises(ValueError): capture.validate(state, reference, versions)

    def test_bad_fit_font_inventory_template_hash_or_cross_series_result_is_rejected(self):
        for change in ('font', 'template', 'renderer', 'result', 'series', 'fingerprint', 'rectangles'):
            state, reference, versions = fixture(); fit = state['fit_results'][0]
            if change == 'font': fit['font_hashes'][next(iter(fit['font_hashes']))] = 'f' * 64
            elif change == 'template': fit['template_content_sha256'] = 'f' * 64
            elif change == 'renderer': fit['renderer_version'] = 'unknown-native-build'
            elif change == 'result': fit['result_sha256'] = 'f' * 64
            elif change == 'series': fit['series_id'] = ID(2)
            elif change == 'fingerprint': fit['matches_current_review'] = False
            else: fit['total_rectangles_persisted'] = True
            with self.subTest(change=change), self.assertRaises(ValueError): capture.validate(state, reference, versions)

    def test_overflow_is_reported_not_converted_into_a_zero_overflow_fit(self):
        state, reference, versions = fixture(); fit = state['fit_results'][0]
        fit.update(overflow_count=1, overflows=[{'slide_index': 1, 'field': 'skills_experience', 'axis': 'vertical', 'overflow_px': 22.5}])
        self.assertEqual(capture.validate(state, reference, versions)['current_zero_overflow_fit_count'], 0)
        for value in (True, -1, float('inf')):
            fit['overflows'][0]['overflow_px'] = value
            with self.assertRaises(ValueError): capture.validate(state, reference, versions)

    def test_unknown_private_fields_cannot_pass_any_metadata_projection(self):
        for location in ('top', 'job', 'metadata', 'suggestion', 'review', 'slide', 'fit', 'subject', 'separation'):
            state, reference, versions = fixture()
            target = {'top': state, 'job': state['jobs'][0], 'metadata': state['jobs'][0]['payloads'][1]['metadata'], 'suggestion': state['suggestions'][0], 'review': state['reviews'][0],
                'slide': state['reviews'][0]['slides'][0], 'fit': state['fit_results'][0], 'subject': state['subject'], 'separation': state['assignment_separation'][0]}[location]
            target['raw_personal_payload'] = 'SYNTHETIC PRIVATE MARKER'
            with self.subTest(location=location), self.assertRaises(ValueError): capture.validate(state, reference, versions)

    def test_current_reviewed_profile_old_nine_frames_and_protected_m02_must_match_exactly(self):
        for change in ('fingerprint', 'stale_reviewed', 'new_frame', 'old_frame', 'old_fact', 'm02'):
            state, reference, versions = fixture()
            if change == 'fingerprint': state['subject']['facts_fingerprint'] = 'f' * 64
            elif change == 'stale_reviewed': state['subject']['effective_reviewed'] = False
            elif change == 'new_frame': state['subject']['frames'][1]['sha256'] = 'f' * 64
            elif change == 'old_frame': state['retained_profiles'][0]['frames'][0]['sha256'] = 'f' * 64
            elif change == 'old_fact': state['retained_profiles'][0]['facts_sha256'] = 'f' * 64
            else: state['protected_m02']['job_sha256'] = 'f' * 64
            with self.subTest(change=change), self.assertRaises(ValueError): capture.validate(state, reference, versions)

    def test_waiter_inverse_must_restore_three_exact_slots_and_consume_archive_events(self):
        for change in ('archived', 'slot', 'missing_archive', 'missing_undo', 'unconsumed', 'audit', 'assignment'):
            state, reference, versions = fixture(); waiter = state['waiter']
            if change == 'archived': waiter['role_active'] = False
            elif change == 'slot': waiter['active_slot_ids'][0] = ID(999)
            elif change == 'missing_archive': waiter['archive_event_ids'] = []
            elif change == 'missing_undo': waiter['undo_event_ids'] = []
            elif change == 'unconsumed': waiter['consumed_archive_count'] = 0
            elif change == 'audit': waiter['undo_audit_count'] = 2
            else: waiter['assignment_ids'] = []
            with self.subTest(change=change), self.assertRaises(ValueError): capture.validate(state, reference, versions)

    def test_ordinary_slide_wording_and_project_availability_are_allowed_while_facts_choices_and_notes_are_preserved(self):
        state, reference, versions = fixture(); state['assignment_separation'][0]['slide_wording_sha256'] = 'f' * 64; state['assignment_separation'][0]['project_availability_sha256'] = 'e' * 64
        self.assertTrue(capture.validate(state, reference, versions)['old_assignment_choices_and_private_notes_preserved'])
        for field in ('candidate_facts_sha256', 'candidate_field_sources_sha256', 'internal_notes_sha256', 'presentation_notes_sha256'):
            state, reference, versions = fixture(); state['assignment_separation'][0][field] = 'f' * 64
            with self.subTest(field=field), self.assertRaises(ValueError): capture.validate(state, reference, versions)

    def test_review_counts_order_hashes_and_assignment_relations_are_checked_independently(self):
        for change in ('page', 'rectangles', 'kind', 'order', 'missing_assignment', 'position', 'candidate', 'workspace'):
            state, reference, versions = fixture(); review = state['reviews'][0]
            if change == 'page': review['expected_page_count'] += 1
            elif change == 'rectangles': review['expected_tenfield_rectangle_count'] += 1
            elif change == 'kind': review['slides'][0]['kind'] = 'cover'
            elif change == 'order': review['slides'][0]['order'] = 0
            elif change == 'missing_assignment': review['slides'][0]['assignment_id'] = ID(999)
            elif change == 'position': review['slides'][0]['position'] = 'backup'
            elif change == 'candidate': review['slides'][0]['candidate_id'] = ID(999)
            else: review['workspace_id'] = next(key for key in capture.SCOPES if key != review['workspace_id'])
            with self.subTest(change=change), self.assertRaises(ValueError): capture.validate(state, reference, versions)

    def test_only_reviewed22_or23_exact_lineage_is_supported(self):
        state, reference, versions = fixture(); capture.validate(state, reference, versions)
        upgraded = [*versions, '20261029203953']; state['versions'] = upgraded; capture.validate(state, reference, upgraded)
        for bad in (versions[:-1], [*versions, '20261029203954'], [*upgraded, '20261029205000']):
            state['versions'] = bad
            with self.assertRaises(ValueError): capture.validate(state, reference, bad)

    def test_final_sql_is_readonly_and_scalar_facts_provider_text_tokens_are_excluded(self):
        from pglast import parse_sql
        raw = (ROOT / capture.SQL).read_bytes(); self.assertEqual(capture.sha(raw), capture.SQL_SHA)
        query = raw.decode('utf8'); kinds = [type(value.stmt).__name__ for value in parse_sql(query)]
        self.assertEqual(kinds, ['TransactionStmt', 'VariableSetStmt', 'VariableSetStmt', 'VariableSetStmt', 'DoStmt', 'SelectStmt', 'TransactionStmt'])
        self.assertIn('begin isolation level repeatable read read only;', query); self.assertTrue(query.rstrip().endswith('rollback;'))
        for forbidden in ('original_transcript', 'request.jwt', "'source_text',", "'suggested_text',", "'old_value',", "'new_value',", 'current_name_sha256', 'current_age_integer_sha256', 'auth.users'):
            self.assertNotIn(forbidden, query)

    def test_immutable_public_baselines_bind_nine_profiles_108_frames_and_current_reviewed_fingerprint(self):
        reference = capture.baselines(); vision = reference['vision']['state']; reviewed = reference['reviewed']['confirmation']
        self.assertEqual(len(vision['retained_profiles']), 9)
        self.assertEqual(sum(len(row['frames']) for row in vision['retained_profiles']), 108)
        self.assertEqual(reviewed['candidate_id'], capture.CANDIDATE)
        self.assertEqual(reviewed['candidate_row_version'], 3)
        self.assertTrue(reviewed['effective_reviewed'])
        self.assertEqual(reference['casting']['state']['protected_m02']['job_id'], 'b3f90268-147d-41d4-8875-2a6435df1496')
        for file, expected in capture.SEALS.items(): self.assertEqual(capture.sha((ROOT / file).read_bytes()), expected)

    def test_no_arguments_can_override_scope_identity_query_or_history(self):
        with patch.object(capture, 'cli_call', side_effect=AssertionError('CLI forbidden')):
            for args in (['--target', 'other'], ['apply'], ['--sql', 'select 1'], ['--principal', 'synthetic']):
                with self.assertRaises(ValueError): capture.main(args)

    def test_incomplete_projection_seal_denies_before_link_configuration_or_cli(self):
        with patch.object(capture, 'SQL_SHA', None), patch.object(capture, 'checked', side_effect=AssertionError('File access forbidden')), patch.object(capture, 'cli_call', side_effect=AssertionError('CLI forbidden')):
            with self.assertRaises(ValueError): capture.inputs()

    def test_primitives_reject_bool_counts_unknown_ids_duplicates_and_naive_times(self):
        for value in (True, False, -1, 1.5, '1'):
            with self.assertRaises(ValueError): capture.integer(value)
        for value in ('not-an-id', "';select 1;--", None):
            with self.assertRaises(ValueError): capture.identifier(value)
        with self.assertRaises(ValueError): capture.identifiers([capture.CANDIDATE, capture.CANDIDATE])
        with self.assertRaises(ValueError): capture.timestamp('2026-10-29T20:00:00')


if __name__ == '__main__': unittest.main()
