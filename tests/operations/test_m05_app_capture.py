"""Offline metadata boundary checks; no CLI, browser, provider or private files."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('m05_app_capture', ROOT / 'tools/capture-m05-app.py')
capture = importlib.util.module_from_spec(spec)
spec.loader.exec_module(capture)


def identity(number): return '99000000-0000-4000-8000-' + str(number).zfill(12)


STAGES = [('prepare_presentation', 'presentation-preparation.v1'),
          ('render_presentation', 'presentation-rendering.v1'),
          ('validate_presentation', 'presentation-validation.v1'),
          ('publish_presentation', 'presentation-render-result.v1')]
VERSIONS = [str(20261028000000 + index) for index in range(23)] + ['20261029215218']


def fixture():
    version = dict(id=identity(1), series_id=identity(2), workspace_id='098d5b48-42a3-475b-b562-735c9eafce80',
                   version_no=1, status='ready', snapshot_sha256='a' * 64, manifest_sha256='b' * 64,
                   inventory_sha256='c' * 64, snapshot_hash_matches=True, manifest_hash_matches=True,
                   inventory_hash_matches=True, page_count=2, template_version='1.1.0',
                   template_content_sha256='bbe72bf2bb08f37fe394c75563e2eca3ab8da72b1775db75704d47ae54f4f638',
                   slides=[dict(id=identity(10 + index), order=index, kind=kind, assignment_id=None,
                                slot_id=None, content_sha256='d' * 64, frame_count=0, has_original_video=False)
                           for index, kind in enumerate(['cover', 'pending'])],
                   pins=[dict(asset_id=identity(number), asset_kind=kind, sha256=checksum * 64,
                              byte_size=100, current_physical_identity_matches=True, retained=True)
                         for number, kind, checksum in [(3, 'presentation_pdf', 'e'), (4, 'presentation_manifest', 'f')]],
                   pdf_asset_id=identity(3), manifest_asset_id=identity(4), pdf_sha256='e' * 64, pdf_bytes=100,
                   manifest_bytes_sha256='f' * 64, job_id=identity(5), job_status='succeeded',
                   stage='publish_presentation', attempt=4, n8n_execution_id='12345', error_code=None,
                   completed_stages=[dict(stage=stage, attempt_id=identity(20 + index), input_hash_matches=True,
                                          result_schema=schema) for index, (stage, schema) in enumerate(STAGES)],
                   stage_receipts=[dict(stage=stage, result_schema=schema, payload_sha256='a' * 64)
                                   for stage, schema in STAGES],
                   outbox=[dict(stage=stage, status='delivered', generation=index + 1)
                           for index, (stage, _) in enumerate(STAGES)])
    return dict(observed_at='2026-10-29T22:00:00.000000Z', query_role='postgres', database='postgres',
                unrestricted_visibility=True, migration_versions=VERSIONS[:], processing_enabled=True,
                versions=[version], series=[dict(id=identity(2), output_type='selection', template_version='1.1.0',
                                               latest_ready_version_id=identity(1), latest_ready_version_no=1,
                                               next_version_no=2)],
                protected=dict(m02_waiting_preserved=True, owner_confirmed_profile_still_reviewed=True,
                               reviewed_source_sha256='ffe461d30d48b32d90f1165627e2d104b6817f61d96a5a4bd9dcd6ff1964fc0a'))


class AppCaptureTests(unittest.TestCase):
    def setUp(self):
        self.cli = self.enterContext(patch.object(capture, 'cli_call', side_effect=AssertionError('Offline only')))

    def test_valid_ready_metadata_and_nonready_metadata_are_accepted_offline(self):
        capture.validate(fixture(), VERSIONS)
        state = fixture(); version = state['versions'][0]
        version.update(status='rendering', job_status='running', stage='render_presentation', attempt=2,
                       completed_stages=version['completed_stages'][:1], stage_receipts=version['stage_receipts'][:1],
                       pins=[], pdf_asset_id=None, manifest_asset_id=None, pdf_sha256=None,
                       manifest_bytes_sha256=None, pdf_bytes=None)
        capture.validate(state, VERSIONS)
        self.cli.assert_not_called()

    def test_duplicate_missing_reordered_or_wrong_completion_stages_are_denied(self):
        for mode in ['duplicate', 'missing', 'reordered', 'wrong_stage', 'wrong_schema']:
            state = fixture(); stages = state['versions'][0]['completed_stages']
            if mode == 'duplicate': stages[2] = copy.deepcopy(stages[1])
            elif mode == 'missing': stages.pop()
            elif mode == 'reordered': stages[0], stages[1] = stages[1], stages[0]
            elif mode == 'wrong_stage': stages[2]['stage'] = 'render_presentation'
            else: stages[2]['result_schema'] = 'presentation-rendering.v1'
            with self.subTest(mode=mode), self.assertRaises(ValueError): capture.validate(state, VERSIONS)

    def test_duplicate_missing_wrong_stage_or_schema_receipts_are_denied(self):
        for mode in ['duplicate', 'missing', 'stage', 'schema', 'digest']:
            state = fixture(); receipts = state['versions'][0]['stage_receipts']
            if mode == 'duplicate': receipts[2] = copy.deepcopy(receipts[1])
            elif mode == 'missing': receipts.pop()
            elif mode == 'stage': receipts[2]['stage'] = 'render_presentation'
            elif mode == 'schema': receipts[2]['result_schema'] = 'presentation-rendering.v1'
            else: receipts[2]['payload_sha256'] = 'not a digest'
            with self.subTest(mode=mode), self.assertRaises(ValueError): capture.validate(state, VERSIONS)

    def test_false_and_nonboolean_hash_claims_are_denied(self):
        for field in ['snapshot_hash_matches', 'manifest_hash_matches', 'inventory_hash_matches']:
            for false_value in [False, None, 'true', 1]:
                state = fixture(); state['versions'][0][field] = false_value
                with self.subTest(field=field, value=false_value), self.assertRaises(ValueError): capture.validate(state, VERSIONS)
        state = fixture(); state['versions'][0]['completed_stages'][1]['input_hash_matches'] = False
        with self.assertRaises(ValueError): capture.validate(state, VERSIONS)

    def test_attempt_identity_and_artifact_pin_identity_or_byte_claims_are_bound(self):
        for field in ['attempt', 'pdf_id', 'manifest_id', 'pdf_hash', 'manifest_hash', 'retained', 'physical', 'purpose', 'duplicate_pin']:
            state = fixture(); version = state['versions'][0]
            if field == 'attempt': version['completed_stages'][2]['attempt_id'] = '12345'
            elif field == 'pdf_id': version['pdf_asset_id'] = identity(99)
            elif field == 'manifest_id': version['manifest_asset_id'] = identity(99)
            elif field == 'pdf_hash': version['pdf_sha256'] = '0' * 64
            elif field == 'manifest_hash': version['manifest_bytes_sha256'] = '0' * 64
            elif field == 'retained': version['pins'][0]['retained'] = False
            elif field == 'physical': version['pins'][0]['current_physical_identity_matches'] = False
            elif field == 'purpose': version['pins'][0]['asset_kind'] = 'candidate_frame'
            else: version['pins'].append(copy.deepcopy(version['pins'][0]))
            with self.subTest(field=field), self.assertRaises(ValueError): capture.validate(state, VERSIONS)

    def test_private_extra_fields_are_denied_at_each_public_projection_depth(self):
        for level in ['root', 'version', 'slide', 'pin', 'completion', 'receipt', 'series', 'protected']:
            state = fixture(); version = state['versions'][0]
            target = {'root': state, 'version': version, 'slide': version['slides'][0], 'pin': version['pins'][0],
                      'completion': version['completed_stages'][0], 'receipt': version['stage_receipts'][0],
                      'series': state['series'][0], 'protected': state['protected']}[level]
            target['private_payload'] = 'PRIVATE_SYNTHETIC_MARKER'
            with self.subTest(level=level), self.assertRaises(ValueError): capture.validate(state, VERSIONS)

    def test_role_visibility_scope_order_and_protected_assertions_are_required(self):
        for mode in ['bypass', 'role', 'database', 'history', 'workspace', 'page_order', 'm02', 'reviewed']:
            state = fixture()
            if mode == 'bypass': state['unrestricted_visibility'] = False
            elif mode == 'role': state['query_role'] = 'authenticated'
            elif mode == 'database': state['database'] = 'other'
            elif mode == 'history': state['migration_versions'] = VERSIONS[:-1]
            elif mode == 'workspace': state['versions'][0]['workspace_id'] = identity(99)
            elif mode == 'page_order': state['versions'][0]['slides'][1]['order'] = 0
            elif mode == 'm02': state['protected']['m02_waiting_preserved'] = False
            else: state['protected']['owner_confirmed_profile_still_reviewed'] = False
            with self.subTest(mode=mode), self.assertRaises(ValueError): capture.validate(state, VERSIONS)

    def test_sql_requires_readonly_row_security_off_and_actual_bypass(self):
        sql = (ROOT / capture.SQL).read_bytes()
        self.assertEqual(capture.sha(sql), capture.SQL_SHA)
        text = sql.decode('utf-8')
        for required in ['begin isolation level repeatable read read only;', 'set local row_security=off;',
                         "current_setting('row_security')='off'", '(rolsuper or rolbypassrls)',
                         "where v.workspace_id='098d5b48-42a3-475b-b562-735c9eafce80'", 'rollback;']:
            self.assertIn(required, text)
        self.cli.assert_not_called()


if __name__ == '__main__': unittest.main()
