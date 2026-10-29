"""Offline negative recovery fixtures; no private/cloud/process operations."""
import copy
import importlib.util
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from test_m05_presentation_release import fixture
import release_m05_presentations as release
spec = importlib.util.spec_from_file_location('m05_recovery', ROOT / 'tools/reconcile_m05_presentation_bucket.py')
recovery = importlib.util.module_from_spec(spec); spec.loader.exec_module(recovery)


class ManagedBucketRecovery(unittest.TestCase):
    def setUp(self):
        self.before, self.after, self.delta = fixture()
        self.after = copy.deepcopy(self.after)
        self.after['m05_state']['bucket'].update(recovery.MANAGED_FIELDS)
        self.metadata = {'schema_version': '1.0', 'query_role': 'postgres', 'database': 'postgres', 'unrestricted_visibility': True,
                         'versions': self.after['versions'], 'columns': [{'name': name, 'type': 'synthetic-fixed-type', 'default': None} for name in recovery.MANAGED_FIELDS],
                         'constraints': [{'name': 'synthetic-fixed-constraint', 'definition': 'CHECK (true)'}], 'bucket_fields': recovery.MANAGED_FIELDS}

    def compare(self, state=None, metadata=None):
        return recovery.compare_reconciliation(self.before, state or self.after, self.delta, metadata or self.metadata, self.metadata)

    def test_missing_pins_deny_every_cli_call(self):
        with patch.object(recovery, 'CONFIG_SHA', None), patch.object(release, 'cli_call', side_effect=AssertionError('CLI forbidden')):
            with self.assertRaises(release.Blocked): recovery.current_inputs()

    def test_only_observed_five_fields_are_normalized_on_a_copy(self):
        original = copy.deepcopy(self.after)
        result = self.compare()
        self.assertTrue(result['exact_five_managed_new_bucket_fields'])
        self.assertEqual(self.after, original)
        self.assertEqual(self.delta['m05_state']['bucket'].keys(), recovery.BASE_KEYS)

    def test_extra_fields_public_bucket_or_size_changes_are_denied(self):
        for change in (lambda bucket: bucket.update(unreviewed=True), lambda bucket: bucket.update(public=True),
                       lambda bucket: bucket.update(file_size_limit=100000000), lambda bucket: bucket.pop('avif_autodetection'),
                       lambda bucket: bucket.update(owner_id='synthetic-owner')):
            value = copy.deepcopy(self.after); change(value['m05_state']['bucket'])
            with self.assertRaises(release.Blocked): self.compare(value)

    def test_lifecycle_versioning_avif_and_type_changes_are_denied(self):
        for key, value in (('avif_autodetection', True), ('lifecycle_configuration', {}), ('lifecycle_configuration_generation', 1),
                           ('type', 'ANALYTICS'), ('versioning_status', 'ENABLED')):
            state = copy.deepcopy(self.after); state['m05_state']['bucket'][key] = value
            with self.assertRaises(release.Blocked): self.compare(state)

    def test_exact_column_defaults_types_and_constraints_are_required(self):
        for change in (lambda metadata: metadata['columns'][0].update(type='changed'), lambda metadata: metadata['columns'][0].update(default='changed'),
                       lambda metadata: metadata['columns'].pop(), lambda metadata: metadata['constraints'].append({'name': 'new'}),
                       lambda metadata: metadata.update(bucket_fields={**recovery.MANAGED_FIELDS, 'avif_autodetection': True})):
            metadata = copy.deepcopy(self.metadata); change(metadata)
            with self.assertRaises(release.Blocked): self.compare(metadata=metadata)

    def test_old_state_and_all_other_new_state_drift_remain_blocked(self):
        for change in (lambda state: state['data_sha256'].update({'eps.jobs': '0' * 64}),
                       lambda state: state.update(catalog_protected_sha256='0' * 64),
                       lambda state: state['m05_state']['config'].update(enabled=True),
                       lambda state: state['m05_state']['tables']['eps.presentation_versions'].update(count=1)):
            state = copy.deepcopy(self.after); change(state)
            with self.assertRaises(release.Blocked): self.compare(state)


if __name__ == '__main__': unittest.main()
