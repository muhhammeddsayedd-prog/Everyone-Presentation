"""Pure guard tests with synthetic metadata; no database, CLI or process calls."""
import copy
import datetime
import importlib.util
from pathlib import Path
import unittest


HERE = Path(__file__).resolve().parent
SPEC = importlib.util.spec_from_file_location('issuer30_release', HERE / 'release.py')
module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(module)

OBSERVED = '2026-10-30T16:00:00+00:00'
NOW = datetime.datetime.fromisoformat(OBSERVED)
HASH = 'e5fd2121784c8372743f330664508b2a38a25cd622b24cf6765c570ae6f2a785'
FLAGS = ('login', 'super', 'inherit', 'bypassrls', 'create_role', 'create_db', 'replication')


def plan_fixture():
    """Synthetic later29 version; no plan file, migration or target is opened."""
    return {'schema_version': '1.0', 'version': '20261030160000',
            'migration_path': 'supabase/migrations/20261030160000_m07_native_oauth_issuer.sql',
            'migration_sha256': HASH, 'candidate_sha256': HASH, 'cli_version': '2.122.0'}


def role_fixture(name, oid, **changes):
    value = {'name': name, 'oid': oid, **dict.fromkeys(FLAGS, False),
             'connection_limit': -1, 'valid_until': None}
    value.update(changes)
    return value


def roles_fixture():
    return [role_fixture('postgres', 10, login=True, super=True, inherit=True, bypassrls=True),
            role_fixture('cli_login_postgres', '1001', login=True,
                         valid_until='2026-10-30T15:59:00+00:00'),
            role_fixture('eps_mcp_session_owner', 2001)]


def quiescence_fixture():
    return {'schema_version': '1.0', 'observed_at': OBSERVED,
            'target': 'pyibofyctwnqpvktepse', 'owned_processes_verified': True,
            'web_stopped': True, 'worker_stopped': True, 'owned_pids': [1100, 2200],
            'ownership_evidence': '.local/issuer30-synthetic/ownership.json'}


class PlanAdmission(unittest.TestCase):
    def test_exact_six_field_pinned_plan_is_accepted_without_mutating_it(self):
        value = plan_fixture()
        before = copy.deepcopy(value)
        module.validate_plan(value)
        self.assertEqual(value, before)

    def test_plan_schema_cli_and_both_source_hashes_are_exact(self):
        for field, values in {
                'schema_version': ['2.0', 1, None],
                'cli_version': ['2.122.1', 'latest', None],
                'migration_sha256': ['0' * 64, HASH.upper(), None],
                'candidate_sha256': ['0' * 64, HASH.upper(), None]}.items():
            for replacement in values:
                with self.subTest(field=field, replacement=replacement):
                    value = plan_fixture()
                    value[field] = replacement
                    with self.assertRaises(ValueError):
                        module.validate_plan(value)

    def test_plan_requires_later29_version_and_its_exact_fixed_migration_path(self):
        for version in ['20261030111549', '20261030111548', 'not-a-version',
                        '202610301600000', 20261030160000, True, None]:
            value = plan_fixture()
            value['version'] = version
            with self.subTest(version=version), self.assertRaises(ValueError):
                module.validate_plan(value)
        for path in ['supabase/migrations/20261030160001_m07_native_oauth_issuer.sql',
                     'supabase/migrations/20261030160000_other.sql',
                     '../supabase/migrations/20261030160000_m07_native_oauth_issuer.sql',
                     'C:/supabase/migrations/20261030160000_m07_native_oauth_issuer.sql']:
            value = plan_fixture()
            value['migration_path'] = path
            with self.subTest(path=path), self.assertRaises(ValueError):
                module.validate_plan(value)

    def test_missing_extra_or_nonobject_plan_is_denied(self):
        for field in plan_fixture():
            value = plan_fixture()
            del value[field]
            with self.subTest(missing=field), self.assertRaises(ValueError):
                module.validate_plan(value)
        for value in [None, [], {}, dict(plan_fixture(), target='unapproved')]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                module.validate_plan(value)


class RolePreservation(unittest.TestCase):
    def test_unchanged_roles_and_raw_metadata_are_preserved(self):
        before = roles_fixture()
        after = copy.deepcopy(before)
        originals = copy.deepcopy((before, after))
        module.validate_role_preservation(before, after, OBSERVED)
        self.assertEqual((before, after), originals)
        before[1]['valid_until'] = None
        after[1]['valid_until'] = None
        module.validate_role_preservation(before, after, OBSERVED)

    def test_only_monotonic_cli_expiry_within_current_ten_minute_window_is_admitted(self):
        for expiry in [OBSERVED, '2026-10-30T16:05:00+00:00', '2026-10-30T16:10:00+00:00']:
            before = roles_fixture()
            after = copy.deepcopy(before)
            after[1]['valid_until'] = expiry
            originals = copy.deepcopy((before, after))
            module.validate_role_preservation(before, after, OBSERVED)
            self.assertEqual((before, after), originals)

    def test_cli_expiry_cannot_move_backwards_be_past_or_exceed_window(self):
        for expiry in ['2026-10-30T15:58:59+00:00', '2026-10-30T15:59:59+00:00',
                       '2026-10-30T16:10:00.001+00:00', '2026-10-30T16:00:00',
                       'not-a-date', None, True]:
            before = roles_fixture()
            after = copy.deepcopy(before)
            after[1]['valid_until'] = expiry
            with self.subTest(expiry=expiry), self.assertRaises(ValueError):
                module.validate_role_preservation(before, after, OBSERVED)
        before = roles_fixture()
        before[1]['valid_until'] = '2026-10-30T16:05:00+00:00'
        after = copy.deepcopy(before)
        after[1]['valid_until'] = '2026-10-30T16:04:59+00:00'
        with self.assertRaises(ValueError):
            module.validate_role_preservation(before, after, OBSERVED)

    def test_all_old_role_oids_names_and_attributes_remain_exact(self):
        for index in range(len(roles_fixture())):
            for field, replacement in [('oid', 9999), ('name', 'renamed'),
                                       ('connection_limit', 2), ('valid_until', '2026-10-30T16:01:00+00:00')]:
                if index == 1 and field == 'valid_until':
                    continue
                before = roles_fixture()
                after = copy.deepcopy(before)
                after[index][field] = replacement
                with self.subTest(index=index, field=field), self.assertRaises(ValueError):
                    module.validate_role_preservation(before, after, OBSERVED)
            for field in FLAGS:
                before = roles_fixture()
                after = copy.deepcopy(before)
                after[index][field] = not after[index][field]
                with self.subTest(index=index, field=field), self.assertRaises(ValueError):
                    module.validate_role_preservation(before, after, OBSERVED)

    def test_old_role_removal_duplicate_or_unapproved_new_role_is_denied(self):
        before = roles_fixture()
        for after in [before[:-1], before + [copy.deepcopy(before[0])],
                      before + [role_fixture('unrelated_new_owner', 3000)],
                      before + [role_fixture('eps_mcp_issuer_owner', 3000)]]:
            with self.subTest(after=after), self.assertRaises(ValueError):
                module.validate_role_preservation(before, after, OBSERVED)

    def test_explicit_new_issuer_admits_only_its_complete_safe_role(self):
        before = roles_fixture()
        issuer = role_fixture('eps_mcp_issuer_owner', 3000)
        after = before + [issuer]
        originals = copy.deepcopy((before, after))
        module.validate_role_preservation(before, after, OBSERVED, allow_new_issuer=True)
        self.assertEqual((before, after), originals)
        variants = [dict(issuer, name='unrelated_owner'), dict(issuer, oid=10),
                    dict(issuer, connection_limit=0), dict(issuer, valid_until=OBSERVED),
                    dict(issuer, unexpected='metadata')]
        variants += [dict(issuer, **{field: True}) for field in FLAGS]
        incomplete = dict(issuer)
        del incomplete['inherit']
        variants.append(incomplete)
        for value in variants:
            with self.subTest(issuer=value), self.assertRaises(ValueError):
                module.validate_role_preservation(before, before + [value], OBSERVED, allow_new_issuer=True)


class QuiescenceAdmission(unittest.TestCase):
    def test_exact_fresh_receipt_is_accepted_without_changing_raw_evidence(self):
        value = quiescence_fixture()
        before = copy.deepcopy(value)
        module.validate_quiescence_receipt(value, NOW)
        self.assertEqual(value, before)
        value['observed_at'] = '2026-10-30T15:45:00+00:00'
        module.validate_quiescence_receipt(value, NOW)

    def test_future_stale_naive_and_malformed_observation_times_are_denied(self):
        for observed in ['2026-10-30T16:00:00.001+00:00', '2026-10-30T15:44:59.999+00:00',
                         '2026-10-30T16:00:00', 'not-a-date', None, True]:
            value = quiescence_fixture()
            value['observed_at'] = observed
            with self.subTest(observed=observed), self.assertRaises(ValueError):
                module.validate_quiescence_receipt(value, NOW)

    def test_exact_target_version_and_true_ownership_stop_flags_are_required(self):
        changes = [('schema_version', '2.0'), ('target', 'different-project')]
        changes += [(field, value) for field in ['owned_processes_verified', 'web_stopped', 'worker_stopped']
                    for value in [False, 1, 'true', None]]
        for field, replacement in changes:
            value = quiescence_fixture()
            value[field] = replacement
            with self.subTest(field=field, replacement=replacement), self.assertRaises(ValueError):
                module.validate_quiescence_receipt(value, NOW)

    def test_pid_evidence_is_a_bounded_unique_list_of_positive_actual_integers(self):
        value = quiescence_fixture()
        value['owned_pids'] = list(range(1, 33))
        module.validate_quiescence_receipt(value, NOW)
        for pids in [[], list(range(1, 34)), [1, 1], [0], [-1], [True], [1.0], ['1'], None, 1]:
            value = quiescence_fixture()
            value['owned_pids'] = pids
            with self.subTest(pids=pids), self.assertRaises(ValueError):
                module.validate_quiescence_receipt(value, NOW)

    def test_ownership_evidence_must_stay_under_private_relative_local_path(self):
        for path in ['ownership.json', '.local', '../.local/ownership.json', '.local/../ownership.json',
                     '/.local/ownership.json', 'C:/.local/ownership.json',
                     '.local\\ownership.json', 'https://example.invalid/ownership.json', '', None]:
            value = quiescence_fixture()
            value['ownership_evidence'] = path
            with self.subTest(path=path), self.assertRaises(ValueError):
                module.validate_quiescence_receipt(value, NOW)

    def test_missing_extra_and_nonobject_quiescence_evidence_is_denied(self):
        for field in quiescence_fixture():
            value = quiescence_fixture()
            del value[field]
            with self.subTest(missing=field), self.assertRaises(ValueError):
                module.validate_quiescence_receipt(value, NOW)
        for value in [None, [], {}, dict(quiescence_fixture(), target_override='other')]:
            with self.subTest(value=value), self.assertRaises(ValueError):
                module.validate_quiescence_receipt(value, NOW)


if __name__ == '__main__':
    unittest.main()
