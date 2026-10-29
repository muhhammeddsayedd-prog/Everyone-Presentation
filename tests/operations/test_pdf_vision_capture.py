import copy
import importlib.util
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
SPEC = importlib.util.spec_from_file_location('pdf_vision_capture', ROOT / 'tools/capture-m02-pdf-vision.py')
capture = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(capture)


def event(page):
    return {'event': 'document_vision_page_processed', 'job_id': capture.JOB,
            'attempt_id': '12345678-1234-4123-8123-123456789abc', 'input_hash': 'a' * 64,
            'provider': 'openai', 'sdk_version': '7.45.1', 'requested_model': 'synthetic-model', 'resolved_model': 'synthetic-model',
            'source_asset_id': capture.ASSET, 'source_sha256': capture.SOURCE_SHA256, 'page': page,
            'image_sha256': str(page) * 64, 'prompt_version': 'pdf-page-ocr.v1', 'prompt_sha256': 'b' * 64, 'schema_sha256': 'c' * 64,
            'response_id': 'resp_synthetic_' + str(page), 'request_id': 'req_synthetic_' + str(page),
            'rasterizer_version': 'pdftoppm version 22.12.0', 'elapsed_ms': 300,
            'usage': {'input_tokens': 10, 'output_tokens': 5, 'total_tokens': 15}}


def log(*events):
    return ('\n'.join(json.dumps(row) for row in events) + '\n').encode()


class PdfVisionCaptureTests(unittest.TestCase):
    def test_metadata_projection_never_copies_text_images_unknown_keys_or_request_ids(self):
        first = event(1)
        first.update(raw_response='PRIVATE_BODY', text='PRIVATE_WORDING', image='PRIVATE_IMAGE', arbitrary_token='PRIVATE_SECRET')
        first['usage']['private_extra'] = 'PRIVATE_USAGE'
        rows = capture.ocr_events(log({'event': 'irrelevant', 'text': 'PRIVATE_OTHER'}, first, event(2)))
        encoded = json.dumps(rows)
        for private in ('PRIVATE_BODY', 'PRIVATE_WORDING', 'PRIVATE_IMAGE', 'PRIVATE_SECRET', 'PRIVATE_USAGE', 'PRIVATE_OTHER', 'resp_synthetic_', 'req_synthetic_'):
            self.assertNotIn(private, encoded)
        self.assertEqual([row['page'] for row in rows], [1, 2])
        self.assertTrue(all(row['response_reference_present'] and row['request_reference_present'] for row in rows))

    def test_duplicate_page_wrong_source_and_malformed_usage_are_rejected(self):
        for replacement in ({'source_asset_id': 'other'}, {'source_sha256': '0' * 64}, {'page': True}, {'usage': {'input_tokens': 10, 'output_tokens': 5, 'total_tokens': 99}}):
            first = event(1)
            first.update(replacement)
            with self.assertRaises(ValueError):
                capture.ocr_events(log(first, event(2)))
        with self.assertRaises(ValueError):
            capture.ocr_events(log(event(1), event(1), event(2)))

    def test_committed_attempt_filter_does_not_bind_another_attempt(self):
        other = event(1)
        other['attempt_id'] = 'other-incomplete-attempt'
        rows = capture.ocr_events(log(other, event(1), event(2)), event(1)['attempt_id'])
        self.assertEqual(len(rows), 2)
        with self.assertRaises(ValueError):
            capture.ocr_events(log(other, event(1), event(2)), other['attempt_id'])

    def test_missing_unknowns_or_protected_note_cannot_pass_vacuous_boolean_checks(self):
        proof = {'draft': {'role_fixture_checks': {'archive_clerk': True}}, 'protected_source': {'still_waiting': True}}
        checks = capture.checks_for(proof, [])
        self.assertFalse(checks['synthetic_fixture_facts_and_unknowns'])
        self.assertFalse(checks['protected_original_work_retained'])
        full = copy.deepcopy(proof)
        full['draft']['role_fixture_checks'] = {key: True for key in capture.ROLE_CHECKS}
        full['protected_source']['manual_note_retained'] = True
        self.assertTrue(capture.checks_for(full, [])['synthetic_fixture_facts_and_unknowns'])
        full['draft']['role_fixture_checks']['age_not_invented'] = False
        self.assertFalse(capture.checks_for(full, [])['synthetic_fixture_facts_and_unknowns'])

    def test_readback_sql_is_exactly_sealed_and_contains_only_readonly_projection(self):
        source = (ROOT / capture.SQL).read_bytes()
        self.assertEqual(capture.sha256(source), capture.SQL_SHA256)
        lowered = source.decode().lower()
        self.assertIn('begin isolation level repeatable read read only;', lowered)
        self.assertTrue(lowered.rstrip().endswith('rollback;'))
        guard = lowered.split('end $scope$;', 1)[0]
        self.assertIn(capture.PROJECT, guard)
        self.assertIn(capture.WORKSPACE, guard)
        self.assertNotIn('4b70c8ce-18bd-4a8c-b5a9-bc1156c06463', guard)
        protected = lowered.split("'protected_source'", 1)[1]
        self.assertIn('098d5b48-42a3-475b-b562-735c9eafce80', protected)
        for command in ('insert into', 'update eps.', 'delete from', 'create function', 'grant execute'):
            self.assertNotIn(command, lowered)


if __name__ == '__main__':
    unittest.main()
