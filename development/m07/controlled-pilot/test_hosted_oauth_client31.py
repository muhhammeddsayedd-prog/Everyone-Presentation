"""Synthetic tests only: no CLI, auth file, key, HTTP, provider or database IO."""
import base64
import copy
import importlib.util
import json
from pathlib import Path
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('hosted_oauth_client', Path(__file__).with_name('hosted-oauth-client31.py'))
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)
CLIENT = 'ab100000-0000-4000-8000-000000000001'
NOW = 1793390400


def jwt(payload=None, header=None):
    encode = lambda x: base64.urlsafe_b64encode(json.dumps(x).encode()).decode().rstrip('=')
    return '.'.join([encode(header or {'alg': 'HS256', 'typ': 'JWT'}), encode(payload or {
        'iss': 'supabase', 'ref': MODULE.TARGET, 'role': 'service_role', 'iat': NOW - 1000, 'exp': NOW + 1000}), 'a' * 43])


def client(identifier=CLIENT):
    return {'client_id': identifier, 'client_name': MODULE.CLIENT_NAME, 'client_type': 'public',
            'token_endpoint_auth_method': 'none', 'redirect_uris': [MODULE.CALLBACK],
            'grant_types': ['authorization_code', 'refresh_token'], 'response_types': ['code'],
            'registration_type': 'manual', 'created_at': '2026-10-30T20:00:00Z', 'updated_at': '2026-10-30T20:00:00Z'}


class PublicClientTests(unittest.TestCase):
    def test_draft_guard_denies_before_credential_returning_key_cli(self):
        with patch.object(MODULE.subprocess,'run',side_effect=AssertionError('credential CLI reached')):
            with self.assertRaises(ValueError):MODULE.load_key()
    def test_environment_gate_is_case_insensitive_and_preserves_only_known_blockers(self):
        MODULE.validate_environment({'PATH': 'synthetic', 'UNRELATED_OPTION': 'retained', 'SUPABASE_ACCESS_TOKEN': 'synthetic-existing-login'})
        for key in MODULE.FORBIDDEN_ENV | {'NPM_CONFIG_NODE_OPTIONS', 'NODE_DEBUG', 'NODE_DEBUG_NATIVE', 'SUPABASE_DEBUG'}:
            for spelling in (key, key.lower(), key.swapcase()):
                with self.assertRaisesRegex(ValueError, '^HOSTED_OAUTH_CLIENT_UNCONFIRMED$'):
                    MODULE.validate_environment({spelling: 'synthetic-option'})
                MODULE.validate_environment({spelling: ''})

    def test_cli_and_main_environment_preflights_run_before_any_subprocess_or_public_input_read(self):
        with patch.dict(MODULE.os.environ, {'npm_config_node_options': '--require=synthetic-never-executed'}, clear=True), \
             patch.object(MODULE.subprocess, 'run') as run:
            with self.assertRaisesRegex(ValueError, '^HOSTED_OAUTH_CLIENT_UNCONFIRMED$'):
                MODULE.load_key()
            run.assert_not_called()
            with patch.object(MODULE.sys, 'argv', ['hosted-oauth-client31.py', 'inspect']), \
                 patch.object(MODULE, 'source_pins') as pins:
                with self.assertRaisesRegex(ValueError, '^HOSTED_OAUTH_CLIENT_UNCONFIRMED$'):
                    MODULE.main()
                pins.assert_not_called()
            run.assert_not_called()

    def test_exact_default_cli_command_never_requests_reveal_or_transports_key_in_args(self):
        args = MODULE.key_command()
        self.assertEqual(args, ['npx.cmd', '--yes', 'supabase@2.122.0', 'projects', 'api-keys', '--project-ref', MODULE.TARGET, '--output', 'json'])
        self.assertNotIn('--reveal', args)

    def test_only_exact_legacy_service_role_jwt_for_fixed_project_is_selected(self):
        key = jwt()
        self.assertEqual(MODULE.select_legacy_service_key([{'name': 'service_role', 'id': 'service_role', 'type': 'legacy', 'api_key': key}], NOW), key)
        payload = {'iss': 'supabase', 'ref': MODULE.TARGET, 'role': 'service_role', 'iat': NOW - 1000, 'exp': NOW + 1000}
        invalid = [[], [{'name': 'service_role', 'id': 'service_role', 'type': 'legacy', 'api_key': None}],
                   [{'name': 'default', 'type': 'secret', 'api_key': 'sb_secret_private-sentinel'}]]
        for change in [{'role': 'anon'}, {'ref': 'anotherprojectrefhere'}, {'iss': 'another'}, {'exp': NOW - 1}, {'iat': NOW + 1}, {'exp': True}]:
            invalid.append([{'name': 'service_role', 'id': 'service_role', 'type': 'legacy', 'api_key': jwt({**payload, **change})}])
        row = {'name': 'service_role', 'id': 'service_role', 'type': 'legacy', 'api_key': key}
        invalid.extend([[row, row], [{**row, 'api_key': jwt(header={'alg': 'none', 'typ': 'JWT'})}], [{**row, 'id': 'another'}]])
        for rows in invalid:
            with self.assertRaisesRegex(ValueError, '^HOSTED_OAUTH_CLIENT_UNCONFIRMED$'):
                MODULE.select_legacy_service_key(rows, NOW)

    def test_empty_omitempty_list_supported_but_secret_or_unknown_payload_refused(self):
        self.assertEqual(MODULE.parse_clients({}), [])
        self.assertEqual(MODULE.parse_clients({'clients': []}), [])
        for value in [{'clients': None}, {'clients': [dict(client(), client_secret='private-sentinel')]},
                      {'clients': [dict(client(), access_token='private-sentinel')]}, {'clients': [], 'token': 'private-sentinel'}]:
            with self.assertRaisesRegex(ValueError, '^HOSTED_OAUTH_CLIENT_UNCONFIRMED$'):
                MODULE.parse_clients(value)

    def test_public_registration_is_pinned_auth_shape_and_never_invents_uuid(self):
        payload = MODULE.registration_payload()
        self.assertEqual(set(payload), {'client_name', 'client_type', 'token_endpoint_auth_method', 'redirect_uris', 'grant_types'})
        self.assertEqual(payload['client_name'], MODULE.CLIENT_NAME)
        self.assertEqual(payload['redirect_uris'], ['http://localhost:3118/callback'])
        self.assertEqual(payload['token_endpoint_auth_method'], 'none')
        self.assertNotIn('client_id', payload)

    def test_one_create_claim_precedes_post_and_two_readbacks_preserve_old_clients(self):
        old = dict(client('ab100000-0000-4000-8000-000000000002'), client_name='Unrelated public client')
        calls = []; responses = iter([[old], [old], [old, client()], [old, client()]])
        report = MODULE.operate('create', lambda: next(responses), lambda p: calls.append(('post', p)) or client(),
                                lambda value: calls.append(('claim', value)), lambda: {'helper_sha256': 'a' * 64, 'plan_sha256': 'b' * 64})
        self.assertEqual([x[0] for x in calls], ['claim', 'post'])
        self.assertEqual(report['result'], 'passed'); self.assertEqual(report['client']['client_id'], CLIENT)
        self.assertTrue(report['other_existing_clients_equal']); self.assertTrue(report['independent_readback_equal'])
        self.assertNotIn('Unrelated public client', json.dumps(report)); self.assertFalse(report['application_resource_binding_observed'])
        MODULE.validate_public_receipt(report)

    def test_unknown_post_commit_gets_two_readbacks_and_never_retries(self):
        calls = []; responses = iter([[], [], [client()], [client()]])
        def post(_):
            calls.append('post')
            raise RuntimeError('private-sentinel')
        report = MODULE.operate('create', lambda: next(responses), post, lambda _: calls.append('claim'),
                                lambda: {'helper_sha256': 'a' * 64, 'plan_sha256': 'b' * 64})
        self.assertEqual(calls, ['claim', 'post']); self.assertEqual(report['result'], 'passed')
        self.assertEqual(report['post_outcome'], 'unknown'); self.assertNotIn('private-sentinel', json.dumps(report))

    def test_claim_reuse_and_concurrent_change_never_redispatch_or_precredit_preservation(self):
        calls = []; responses = iter([[], [client()], [client()]])
        def exists(_): raise FileExistsError()
        report = MODULE.operate('create', lambda: next(responses), lambda _: calls.append('post'), exists,
                                lambda: {'helper_sha256': 'a' * 64, 'plan_sha256': 'b' * 64})
        self.assertEqual(calls, []); self.assertEqual(report['result'], 'passed'); self.assertTrue(report['repeat_create_prevented'])
        self.assertFalse(report['other_existing_clients_equal']); self.assertFalse(report['original_client_baseline_available'])
        responses = iter([[], [dict(client(), client_name='Other')]])
        with self.assertRaises(ValueError):
            MODULE.operate('create', lambda: next(responses), lambda _: calls.append('post'), lambda _: None,
                           lambda: {'helper_sha256': 'a' * 64, 'plan_sha256': 'b' * 64})
        self.assertEqual(calls, [])

    def test_duplicate_matching_clients_or_old_client_drift_fails_closed_and_never_reflects_payload(self):
        other = dict(client('ab100000-0000-4000-8000-000000000002'), client_name='Unrelated')
        changed = dict(other, client_name='private-sentinel')
        responses = iter([[other], [other], [changed, client()], [changed, client()]])
        report = MODULE.operate('create', lambda: next(responses), lambda _: client(), lambda _: None,
                                lambda: {'helper_sha256': 'a' * 64, 'plan_sha256': 'b' * 64})
        self.assertEqual(report['result'], 'unconfirmed'); self.assertNotIn('private-sentinel', json.dumps(report))
        with self.assertRaises(ValueError): MODULE.parse_clients({'clients': [client(), client()]})

    def test_public_receipt_is_closed_and_rejects_false_flags_types_or_private_extras(self):
        report = MODULE.operate('inspect', lambda: [client()], lambda _: None, lambda _: None,
                                lambda: {'helper_sha256': 'a' * 64, 'plan_sha256': 'b' * 64})
        MODULE.validate_public_receipt(report)
        for key, value in [('provider_client_observed', 1), ('client_secret_observed', True), ('access_token', 'private-sentinel')]:
            changed = copy.deepcopy(report); changed[key] = value
            with self.assertRaises(ValueError): MODULE.validate_public_receipt(changed)

    def test_known_create_response_id_must_match_independent_readback_identity(self):
        different = client('ab100000-0000-4000-8000-000000000003')
        responses = iter([[], [], [client()], [client()]])
        report = MODULE.operate('create', lambda: next(responses), lambda _: different, lambda _: None,
                                lambda: {'helper_sha256': 'a' * 64, 'plan_sha256': 'b' * 64})
        self.assertEqual(report['result'], 'unconfirmed')

    def test_unknown_create_attempts_both_readbacks_even_if_first_read_fails(self):
        calls = []; sequence = iter([[], [], RuntimeError('private-sentinel'), [client()]])
        def pull():
            calls.append('get'); value = next(sequence)
            if isinstance(value, Exception): raise value
            return value
        def post(_): raise RuntimeError('private-sentinel')
        report = MODULE.operate('create', pull, post, lambda _: None,
                                lambda: {'helper_sha256': 'a' * 64, 'plan_sha256': 'b' * 64})
        self.assertEqual(len(calls), 4); self.assertEqual(report['result'], 'unconfirmed')
        self.assertNotIn('private-sentinel', json.dumps(report))

    def test_rejected_secret_bearing_create_response_records_only_honest_boolean_and_cannot_pass(self):
        responses = iter([[], [], [client()], [client()]])
        report = MODULE.operate('create', lambda: next(responses), lambda _: dict(client(), client_secret='private-sentinel'), lambda _: None,
                                lambda: {'helper_sha256': 'a' * 64, 'plan_sha256': 'b' * 64})
        self.assertEqual(report['result'], 'unconfirmed'); self.assertTrue(report['client_secret_observed'])
        self.assertNotIn('private-sentinel', json.dumps(report)); MODULE.validate_public_receipt(report)


if __name__ == '__main__': unittest.main()
