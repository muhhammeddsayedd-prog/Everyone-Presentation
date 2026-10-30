"""Unexpected CLI payloads must fail before publication; local JSON fixtures only."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest
HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('issuer30_release_payload',HERE/'release.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
BASE=HERE.parents[2]/'tracking/evidence/m07/issuer-release30-executable/2026-10-30T15-31-12-986032Z-b19aca5b-canonical-discovery.json'
class ClosedPayload(unittest.TestCase):
    def test_only_closed_safe_query_shape_is_admitted_without_mutation(self):
        state=json.loads(BASE.read_text())['discovery'];original=copy.deepcopy(state)
        module.validate_query_shape(state);self.assertEqual(state,original)
    def test_extra_private_top_or_nested_fields_are_denied(self):
        state=json.loads(BASE.read_text())['discovery']
        for location in ['top','context','admission','protected_data','function']:
            value=copy.deepcopy(state)
            target=value if location=='top'else value[location]if location!='function'else next(iter(value['context']['effective_privileges']['supabase_auth_admin']['functions'].values()))
            target['access_token']='synthetic-private-sentinel'
            with self.subTest(location=location),self.assertRaises(ValueError):module.validate_query_shape(value)
