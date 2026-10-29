"""Activation protocol and metadata guards only; no private/network operations."""
import copy
import datetime
import importlib.util
import io
import json
from pathlib import Path
import sys
import unittest
from contextlib import ExitStack, redirect_stdout
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
from test_m05_presentation_release import fixture
import release_m05_presentations as release
spec = importlib.util.spec_from_file_location('m05_enable', ROOT / 'tools/enable_m05_presentation.py')
enable = importlib.util.module_from_spec(spec); spec.loader.exec_module(enable)


class Activation(unittest.TestCase):
    def setUp(self):
        _, self.before, _ = fixture()
        self.before = copy.deepcopy(self.before)
        self.after = copy.deepcopy(self.before); self.after['m05_state']['config']['enabled'] = True
        self.after['m05_state']['tables']['eps.presentation_processing_config']['sha256'] = '9' * 64

    def test_unsealed_activation_stops_before_cli_or_private_access(self):
        with patch.object(enable, 'CONFIG_SHA', None), patch.object(release, 'cli_call', side_effect=AssertionError('CLI forbidden')):
            with self.assertRaises(release.Blocked): enable.current_inputs()

    def test_exact_single_flag_and_row_hash_transition_preserves_old_state(self):
        result = enable.compare_enabled(self.before, self.after, '9' * 64)
        self.assertTrue(result['only_presentation_enabled_flag_changed'])
        for change in (lambda state: state['review_state']['config'].update(enabled=False), lambda state: state['data_sha256'].update({'eps.jobs': '0' * 64}),
                       lambda state: state['m05_state']['config'].update(application_origin='https://unreviewed.invalid'),
                       lambda state: state['m05_state']['tables']['eps.presentation_versions'].update(count=1),
                       lambda state: state['m05_state']['bucket'].update(public=True), lambda state: state.update(catalog_protected_sha256='0' * 64)):
            value = copy.deepcopy(self.after); change(value)
            with self.assertRaises(release.Blocked): enable.compare_enabled(self.before, value, '9' * 64)

    def test_startup_requires_real_authenticated_gateway_and_all_current_sources(self):
        sources = {name: 'a' * 64 for name in enable.STARTUP_SOURCES}
        proof = {'result': 'passed', 'sources_stable': True, 'gateway_attempted': True, 'authenticated_gateway_verified': True,
                 'jobs_claimed': False, 'provider_invoked': False, 'workflows_executed': False, 'credentials_printed': False, 'hosting_deferred': True,
                 'harness_path': enable.STARTUP_HARNESS, 'harness_sha256': 'a' * 64, 'source_sha256': sources}
        with patch.object(release, 'sealed'):
            enable.validate_startup(proof, {'source_seals': sources})
            for change in (lambda value: value.update(authenticated_gateway_verified=False), lambda value: value.update(gateway_attempted=False),
                           lambda value: value.update(sources_stable=False), lambda value: value['source_sha256'].pop(enable.STARTUP_HARNESS)):
                value = copy.deepcopy(proof); change(value)
                with self.assertRaises(release.Blocked): enable.validate_startup(value, {'source_seals': sources})

    def test_live_workflow_requires_all_four_bound_real_executions_and_denials(self):
        published = {'result': 'passed', 'action': 'publish', 'active': True, 'graph_verified': True, 'workflow_id': 'synthetic-wf03'}
        probe = {'result': 'passed', 'action': 'probe', 'workflow_id': 'synthetic-wf03', 'real_workflow_executions': True,
                 'database_work_claimed': False, 'provider_invoked': False, 'unauthorized_http_status': 403, 'invalid_http_status': 400,
                 'malformed_stage_http_status': 400, 'stages': [{'stage': stage, 'kind': 'presentation_render', 'http_status': 200, 'bound_response': True,
                 'execution_id': str(index)} for index, stage in enumerate(['prepare_presentation', 'render_presentation', 'validate_presentation', 'publish_presentation'])]}
        enable.validate_workflow(published, probe)
        for change in (lambda value: value['stages'].pop(), lambda value: value['stages'][0].update(bound_response=False),
                       lambda value: value.update(database_work_claimed=True), lambda value: value.update(workflow_id='other-workflow')):
            value = copy.deepcopy(probe); change(value)
            with self.assertRaises(release.Blocked): enable.validate_workflow(published, value)

    def test_idle_readiness_preserves_waiting_m02_and_enabled_review(self):
        state = {'schema_version': '1.0', 'query_role': 'postgres', 'database': 'postgres', 'unrestricted_visibility': True,
                 'versions': self.before['versions'], 'review_processing': {'enabled': True},
                 'protected_m02': {'id': 'b3f90268-147d-41d4-8875-2a6435df1496', 'status': 'waiting_for_input'},
                 'active_jobs': {'queued': 0, 'running': 0, 'by_kind': []}}
        enable.validate_readiness(state, {'versions': self.before['versions']}, idle=True)
        for change in (lambda value: value['active_jobs'].update(queued=1), lambda value: value['review_processing'].update(enabled=False),
                       lambda value: value['protected_m02'].update(status='succeeded')):
            value = copy.deepcopy(state); change(value)
            with self.assertRaises(release.Blocked): enable.validate_readiness(value, {'versions': self.before['versions']}, idle=True)

    def test_held_or_unknown_enable_is_never_automatically_repeated(self):
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        inputs = {'versions': self.before['versions']}
        config = {'enabled_configuration_sha256': '9' * 64}
        proofs = {'cloud_reconciliation': {'readback': self.before}, 'startup': {'observed_at': now}, 'workflow_probe': {'observed_at': now}}
        calls, claims, saved = [], [], {}
        def retain(value, suffix):
            name = 'tracking/evidence/m05/presentation-activation/synthetic-' + suffix + '.json'; saved[name] = copy.deepcopy(value); return name
        def claim(before, value, attempt):
            claims.append(attempt); saved[enable.CLAIM.relative_to(ROOT).as_posix()] = {'target': release.TARGET, 'inputs_sha256': release.canonical(value),
                'activation_config_sha256': enable.CONFIG_SHA, 'activation_helper_sha256': release.sha((ROOT / 'tools/enable_m05_presentation.py').read_bytes()),
                'before_sha256': release.canonical(before), 'attempt_receipt': attempt}
        def query(file, _field):
            calls.append(file)
            if file == enable.SQL: raise RuntimeError('synthetic-lost-ack')
            return {'presentation_processing': self.before['m05_state']['config']}
        def evidence_glob(path, pattern):
            # Retained real activation receipts must not become this synthetic
            # test's preconditions. The mocked durable claim fences its retry.
            self.assertEqual(path, enable.EVIDENCE)
            self.assertEqual(pattern, '*-enable-attempt.json')
            return iter(())
        with ExitStack() as stack:
            stack.enter_context(patch.object(enable, 'current_inputs', return_value=(inputs, config, proofs)))
            stack.enter_context(patch.object(enable, 'query', side_effect=query)); stack.enter_context(patch.object(enable, 'validate_readiness'))
            stack.enter_context(patch.object(enable, 'retain', side_effect=retain)); stack.enter_context(patch.object(enable, 'claim', side_effect=claim))
            stack.enter_context(patch.object(Path, 'exists', side_effect=lambda: bool(claims)))
            stack.enter_context(patch.object(Path, 'glob', autospec=True, side_effect=evidence_glob))
            stack.enter_context(patch.object(release, 'read_json', side_effect=lambda name: saved[name]))
            stack.enter_context(redirect_stdout(io.StringIO()))
            with patch.object(release, 'inspect_state', return_value=self.before):
                with self.assertRaises(RuntimeError): enable.main(['enable'])
            self.assertEqual(calls.count(enable.SQL), 1); self.assertEqual(len(claims), 1)
            with self.assertRaises(release.Blocked): enable.main(['enable'])
            self.assertEqual(calls.count(enable.SQL), 1)
            with patch.object(release, 'inspect_state', return_value=self.after): enable.main(['readback'])
            self.assertTrue(saved['tracking/evidence/m05/presentation-activation/synthetic-readback.json']['processing_enabled_verified'])


if __name__ == '__main__': unittest.main()
