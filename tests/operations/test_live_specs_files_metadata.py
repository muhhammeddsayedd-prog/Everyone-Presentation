"""Offline metadata/SQL-render tests only; no CLI, database or private files."""
import copy
import importlib.util
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('live_file_metadata', ROOT / 'tools/capture-live-specs-files.py')
proof = importlib.util.module_from_spec(spec); spec.loader.exec_module(proof)
JOB = '11111111-1111-4111-8111-111111111111'
ASSET = '22222222-2222-4222-8222-222222222222'
EXPECTED = {JOB: {'source_sha256': 'a' * 64, 'mime_type': 'application/pdf', 'arabic_expected': False}}


def observed():
    return {'workspace_id': proof.WORKSPACE, 'project_id': proof.PROJECT, 'versions': proof.VERSIONS,
            'assets': [{'asset_id': ASSET, 'stored_sha256': 'a' * 64, 'mime_type': 'application/pdf', 'status': 'ready', 'path_bound': True}],
            'file_jobs': [{'job_id': JOB, 'status': 'succeeded', 'source_sha256': 'a' * 64, 'source_asset_id': ASSET,
                          'source_binding': {'retained': True, 'ready_original_matches': True},
                          'completed_stages': [{'stage': stage} for stage in proof.STAGES], 'stage_attempts': {stage: 1 for stage in proof.STAGES},
                          'outbox': [{'stage': stage, 'status': 'delivered', 'dispatch_bound': True} for stage in proof.STAGES], 'last_n8n_execution_id': 'synthetic-last-id',
                          'configuration': {'model_version': 'synthetic-model'}, 'input_sha256': 'b' * 64,
                          'preparation': {'private_json_stored': True, 'ready_derivative_matches_exact_json': True, 'source_id_matches': True,
                                          'arabic_present': False, 'paragraph_count': 1},
                          'provider': {'provider': 'openai', 'response_reference_present': True, 'requested_model': 'synthetic-model', 'input_sha256': 'b' * 64,
                                       'sdk_version': '7.45.1', 'usage': {'input_tokens': 1, 'output_tokens': 1, 'total_tokens': 2}},
                          'references': {'count': 1, 'all_grounded': True, 'locators': [{'grounded': True, 'asset_id': ASSET}]}}],
            'current_draft': {'origin_resolves': True, 'active_roles': 1, 'active_slots': 1, 'role_origins': [{'origin_job_id': JOB, 'origin_resolves': True}]}}


class MetadataProof(unittest.TestCase):
    def test_only_uuid_array_is_rendered_and_private_payload_keys_are_not_returned(self):
        template = (ROOT / proof.SQL).read_text(encoding='utf-8')
        rendered = proof.render_sql(template, EXPECTED)
        self.assertNotIn('__EPS_FILE_JOB_IDS__', rendered); self.assertEqual(rendered.count(JOB), 1)
        self.assertIsNone(re.search(r"'(?:source_text|prepared_text|payload_utf8|quote|secret|lease_token)'\s*,", rendered))
        for bad in [None, {}, {"');commit;--": EXPECTED[JOB]}, {JOB: {**EXPECTED[JOB], 'mime_type': 'application/octet-stream'}}]:
            with self.assertRaises(ValueError): proof.render_sql(template, bad)

    def test_unsealed_job_ids_stop_before_any_io_or_cli(self):
        with patch.object(proof, 'JOB_EXPECTATIONS', None), patch.object(proof, 'call', side_effect=AssertionError('No CLI')) as call:
            with self.assertRaises(ValueError): proof.prerequisites()
            call.assert_not_called()

    def test_positive_metadata_and_grounding_hash_stage_origin_failures(self):
        self.assertTrue(all(proof.checks_for(observed(), EXPECTED).values()))
        cases = [lambda value: value['file_jobs'][0].update(status='failed'),
                 lambda value: value['assets'][0].update(stored_sha256='f' * 64),
                 lambda value: value['file_jobs'][0]['preparation'].update(arabic_present=True),
                 lambda value: value['file_jobs'][0]['provider'].update(usage=None),
                 lambda value: value['file_jobs'][0]['references']['locators'][0].update(asset_id=JOB),
                 lambda value: value['file_jobs'][0]['outbox'][0].update(status='dead'),
                 lambda value: value['current_draft']['role_origins'][0].update(origin_resolves=False)]
        for mutate in cases:
            value = copy.deepcopy(observed()); mutate(value)
            self.assertFalse(all(proof.checks_for(value, EXPECTED).values()))

    def test_retry_dispatches_are_labelled_all_stages_and_unknown_origins_are_not_called_resolved(self):
        value = observed(); value['file_jobs'][0]['outbox'].append(copy.deepcopy(value['file_jobs'][0]['outbox'][0]))
        checks = proof.checks_for(value, EXPECTED)
        self.assertTrue(checks[JOB + ':all_stages_delivered']); self.assertNotIn(JOB + ':three_delivered_dispatches', checks)
        value['current_draft']['role_origins'].append({'origin_job_id': None, 'origin_known': False, 'origin_resolves': False})
        self.assertTrue(proof.checks_for(value, EXPECTED)['known_current_and_historical_origins_resolve'])
        sql = (ROOT / proof.SQL).read_text()
        self.assertIn("eps.specs_stage_nonblank(r.reference->>'quote')", sql)
        self.assertIn("'origin_resolves',r.source_job_id is not null and exists", sql)


if __name__ == '__main__': unittest.main()
