"""Inert tests only: public source reads, synthetic JSON and SQL parsing."""
from pathlib import Path
import copy, datetime, importlib.util, json, unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('refresh36_tested', HERE / 'observer.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RefreshMetadataTests(unittest.TestCase):
    def envelope(self, sessions=None, audit=None):
        end = '2026-11-01T05:00:00+00:00'
        return [{'oauth_refresh_metadata': {'observed_at': end, 'window_start': module.WINDOW_START,
            'window_end': end, 'client_id': module.CLIENT,
            'sessions': sessions or {'truncated': False, 'count': 2, 'refreshed_count': 1,
                'refreshed_after_creation_count': 1, 'missing_created_count': 0,
                'first_created_at': '2026-10-31T13:00:00Z', 'last_created_at': '2026-10-31T13:30:00Z',
                'last_refreshed_at': '2026-11-01T04:59:00Z'},
            'audit': audit or {'truncated': False, 'actions': [
                {'action': 'login', 'count': 0, 'first_at': None, 'last_at': None},
                {'action': 'token_refreshed', 'count': 3, 'first_at': '2026-10-31T14:00:00Z', 'last_at': '2026-11-01T04:59:00Z'}]}}}]

    def test_public_identity_mapping_is_evidence_derived_not_a_literal(self):
        identity = module.admission()
        self.assertEqual(identity['client_id'], module.CLIENT)
        self.assertRegex(identity['auth_user_id'], module.UUID)
        self.assertNotIn(identity['auth_user_id'], (HERE / 'observer.py').read_text())
        self.assertEqual(len(identity['history']), 36)
        self.assertEqual(identity['history'][-1], '20261101012057')

    def test_wrong_or_unaccepted_owner_binding_is_refused(self):
        source = json.loads((module.ROOT / module.ACCEPTANCE).read_text())
        for mutation in [lambda x: x.update(status='pending'),
                         lambda x: x['owner_result'].update(request_id='00000000-0000-4000-8000-000000000000'),
                         lambda x: x['server_receipt'].update(client_id='00000000-0000-4000-8000-000000000000')]:
            bad = copy.deepcopy(source); mutation(bad)
            with self.assertRaises(ValueError): module.identity_from_acceptance(bad)

    def test_exact_schema_and_read_only_sql_are_actually_parseable(self):
        import pglast
        self.assertEqual(pglast.__version__, 'v7.21')
        sql = module.observation_sql(module.admission(), '2026-11-01T05:00:00Z')
        parsed = pglast.parse_sql(sql)
        self.assertEqual(parsed[0].stmt.kind.name, 'TRANS_STMT_BEGIN')
        self.assertEqual(parsed[-1].stmt.kind.name, 'TRANS_STMT_ROLLBACK')
        self.assertEqual(sum(type(s.stmt).__name__ == 'DoStmt' for s in parsed), 1)
        do = next(s.stmt for s in parsed if type(s.stmt).__name__ == 'DoStmt')
        body = next(v.arg.sval for v in do.args if v.defname == 'as')
        pglast.parser.parse_plpgsql_json('DO $body$' + body + '$body$;')
        self.assertIn("'payload', 'json', false", sql)
        self.assertIn('is distinct from', sql)
        self.assertIn('limit 101', sql); self.assertIn('limit 501', sql)
        self.assertIn("refreshed_at at time zone 'UTC'", sql)
        self.assertLess(sql.index('do $refresh36_gate$'), sql.index('from auth.sessions s'))
        for forbidden in ['auth.refresh_tokens', 'select *', 'to_jsonb(s)', 'actor_username',
                          'user_agent', 'session_id', 'refresh_token_counter', 'refresh_token_hmac_key', '->\'traits\'']:
            self.assertNotIn(forbidden, sql.lower())

    def test_closed_output_and_limited_source_inference(self):
        value = module.parse(self.envelope(), '2026-11-01T05:00:00Z')
        self.assertEqual(value['verdict'], 'source_founded_retained_client_refresh_timestamp')
        for key in ['audit_client_binding', 'current_deployed_auth_version_verified', 'exact_current_process_proven',
                    'token_received_or_stored_proven', 'rotation_proven', 'revocation_proven', 'mcp_use_proven']:
            self.assertIs(value[key], False)
        self.assertNotIn('auth_user_id', json.dumps(value)); self.assertNotIn('principal_id', json.dumps(value))

    def test_absent_refresh_and_audit_do_not_prove_failure(self):
        data = self.envelope(); s = data[0]['oauth_refresh_metadata']['sessions']
        s['refreshed_count'] = 0; s['refreshed_after_creation_count'] = 0; s['last_refreshed_at'] = None
        value = module.parse(data, '2026-11-01T05:00:00Z')
        self.assertEqual(value['verdict'], 'not_observed_or_unavailable')

    def test_truncation_discards_partial_aggregates(self):
        sessions = dict.fromkeys(module.SESSION_KEYS)
        sessions['truncated'] = True
        audit = {'truncated': True, 'actions': None}
        result = module.parse(self.envelope(sessions, audit), '2026-11-01T05:00:00Z')
        self.assertEqual(result['verdict'], 'bounded_observation_incomplete')
        bad = self.envelope(sessions, audit); bad[0]['oauth_refresh_metadata']['sessions']['count'] = 101
        with self.assertRaises(ValueError): module.parse(bad, '2026-11-01T05:00:00Z')

    def test_private_unknown_and_inconsistent_values_are_refused(self):
        mutations = [lambda x: x.update(email='never output'), lambda x: x.update(client_id='wrong'),
            lambda x: x['sessions'].update(count=True), lambda x: x['sessions'].update(refreshed_after_creation_count=3),
            lambda x: x['sessions'].update(missing_created_count=x['sessions']['count'], first_created_at=None, last_created_at=None),
            lambda x: x['sessions'].update(last_refreshed_at='2026-11-02T05:00:00Z'),
            lambda x: x['audit']['actions'][0].update(action='logout'),
            lambda x: x['audit']['actions'][0].update(count=1),
            lambda x: x['audit'].update(raw_payload={})]
        for mutation in mutations:
            bad = self.envelope(); mutation(bad[0]['oauth_refresh_metadata'])
            with self.assertRaises(ValueError): module.parse(bad, '2026-11-01T05:00:00Z')

    def test_disabled_entry_stops_before_any_source_or_dispatch(self):
        self.assertIs(type(module.ENTRY_ENABLED), bool)
        with patch.object(module, 'ENTRY_ENABLED', False), patch.object(module, 'admission') as admission:
            with self.assertRaises(ValueError): module.main()
            admission.assert_not_called()


if __name__ == '__main__': unittest.main()
