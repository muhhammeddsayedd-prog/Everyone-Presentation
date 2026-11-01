import copy
import datetime as dt
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import uuid
from pglast import parse_sql

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('contributor_controller_test', HERE / 'controller.py')
controller = importlib.util.module_from_spec(spec)
spec.loader.exec_module(controller)


def plan():
    return {'run_id': str(uuid.uuid4()), 'principal_id': '10000000-0000-4000-8000-000000000002', 'project_id': controller.access.PROJECT,
            'marker': '2026-11-02T00:00:00.123456+00:00', 'source': controller.seal(), 'baseline': 'a' * 64,
            'owned_capabilities': list(controller.REQUIRED), 'owned_membership': True}


def identity():
    user = {'principal_id': plan()['principal_id'], 'not_deleted': True, 'not_banned': True, 'not_anonymous': True, 'authenticated_role': True, 'email_confirmed': True,
            'capabilities': {c: False for c in controller.access.ALL_CAPABILITIES}, 'required_inactive': 0, 'membership_exists': False, 'membership_active': False, 'membership_can_write': False, 'frame_request_count': 0}
    producer = copy.deepcopy(user)
    producer.update(principal_id=controller.PRODUCER, membership_exists=True, membership_active=True, membership_can_write=True)
    producer['capabilities']['projects.write'] = True
    return {'scope': 'actual_read_only_existing_identity_and_grants', 'target': controller.access.TARGET, 'read_only_rollback': True,
            'exit_code': 0, 'timed_out': False, 'output_limit_exceeded': False,
            'metadata': {'database': 'postgres', 'operator': 'postgres', 'observed_at': dt.datetime.now(dt.timezone.utc).isoformat(),
                         'project_id': controller.access.PROJECT, 'project_active': True, 'project_name_matches': True,
                         'identities': [{'label': 'contributor', 'match_count': 1, 'users': [user]}, {'label': 'producer', 'match_count': 1, 'users': [producer]}]}}


class ContributorGuards(unittest.TestCase):
    def test_disabled_modes_cannot_reach_cli_or_claim(self):
        self.assertFalse(controller.MUTATIONS_ENABLED)
        for mode in ('grant', 'revoke'):
            with patch.object(sys, 'argv', ['controller.py', mode, 'missing']), patch.object(controller, 'query') as query, patch.object(controller, 'private_path') as path:
                with self.assertRaises(ValueError):
                    controller.main()
                query.assert_not_called()
                path.assert_not_called()

    def test_genuine_identity_and_producer_are_distinct_and_current(self):
        receipt = identity()
        self.assertEqual(controller.prepare_identity(receipt), plan()['principal_id'])
        changes = [lambda x: x['metadata']['identities'][0].update(match_count=0, users=None),
                   lambda x: x['metadata']['identities'][0]['users'][0].update(principal_id=controller.PRODUCER),
                   lambda x: x['metadata'].update(project_active=False),
                   lambda x: x['metadata'].update(project_name_matches=False),
                   lambda x: x['metadata'].update(observed_at='2026-01-01T00:00:00Z'),
                   lambda x: x['metadata']['identities'][1]['users'][0].update(membership_can_write=False)]
        for change in changes:
            changed = copy.deepcopy(receipt)
            change(changed)
            with self.assertRaises(ValueError):
                controller.prepare_identity(changed)

    def test_inactive_or_broad_grants_are_never_reactivated_or_reduced(self):
        changes = [lambda u: u.update(required_inactive=1), lambda u: u['capabilities'].update({'operations.read': True}),
                   lambda u: u['capabilities'].update({'cast.review': True}), lambda u: u.update(membership_exists=True, membership_active=False),
                   lambda u: u.update(membership_exists=True, membership_active=True, membership_can_write=False)]
        for change in changes:
            receipt = identity()
            change(receipt['metadata']['identities'][0]['users'][0])
            with self.assertRaises(ValueError):
                controller.prepare_identity(receipt)

    def test_plan_bound_to_target_source_uuid_and_closed_capabilities(self):
        for field, value in [('project_id', str(uuid.uuid4())), ('source', {}), ('principal_id', controller.PRODUCER),
                             ('marker', "x';delete from auth.users;--"), ('owned_capabilities', ['cast.review']),
                             ('owned_capabilities', ['cast.read', 'cast.read'])]:
            current = plan()
            current[field] = value
            with self.assertRaises(ValueError):
                controller.validate_plan(current)

    def test_generated_sql_parses_and_limits_mutation_tables(self):
        for owned, membership in [(list(controller.REQUIRED), True), ([], False), (['cast.read'], False)]:
            current = plan()
            current.update(owned_capabilities=owned, owned_membership=membership)
            for mode in ('grant', 'revoke'):
                sql = controller.mutation_sql(current, mode)
                parse_sql(sql)
                self.assertNotIn('on conflict', sql.lower())
                self.assertNotIn('update ', sql.lower())
                self.assertNotIn('insert into auth.', sql.lower())
                self.assertNotIn('delete from auth.', sql.lower())
                self.assertNotIn('public.projects where', sql.lower().split('delete from')[-1] if mode == 'revoke' else '')
                self.assertIn('share row exclusive mode', sql)
                self.assertIn('before_access', sql)
                self.assertIn("raise exception 'CONTRIBUTOR_ACCESS_REFUSED'", sql)
                self.assertIn("created_at='" + current['marker'], sql)
        parse_sql(controller.read_sql(plan()['principal_id']))

    def test_inspection_never_returns_auth_rows_or_email(self):
        sql = controller.access.inspection_sql({'contributor_email': "synthetic.o'connor@example.invalid", 'producer_email': 'synthetic.producer@example.invalid'})
        parse_sql(sql)
        self.assertIn("o''connor", sql)
        self.assertNotIn('to_jsonb(u)', sql)
        self.assertNotIn('select *', sql.lower())
        self.assertTrue(sql.rstrip().endswith('rollback;'))
        self.assertIn('begin read only;', sql)
        with self.assertRaises(ValueError):
            controller.access.inspection_sql({'contributor_email': 'bad\n@example.invalid', 'producer_email': 'synthetic@example.invalid'})

    def test_ambient_credentials_cannot_override_normal_cli_auth(self):
        for key in ('SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'DATABASE_URL'):
            with patch.dict('os.environ', {key: 'synthetic-blocked'}):
                with self.assertRaises(ValueError):
                    controller.access.environment()

    def test_confirmation_requires_fresh_post_commit_readback(self):
        current = plan()
        granted = {'eligible': True, 'baseline': current['baseline'], 'missing_capabilities': [], 'membership_absent': False}
        self.assertTrue(controller.readback_result(current, granted)['granted'])
        self.assertFalse(controller.readback_result(current, granted)['cleaned'])
        cleaned = {**granted, 'missing_capabilities': list(controller.REQUIRED), 'membership_absent': True}
        self.assertTrue(controller.readback_result(current, cleaned)['cleaned'])
        with self.assertRaises(ValueError):
            controller.readback_result(current, {**granted, 'baseline': 'b' * 64})
        with self.assertRaises(ValueError):
            controller.readback_result(current, {**granted, 'membership_absent': 0})


if __name__ == '__main__':
    unittest.main()
