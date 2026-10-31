"""Pure synthetic CLI-response/control-flow tests; no provider, files or commands."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('pilot_auth_redirects', Path(__file__).with_name('auth-redirects.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

OLD = ['http://127.0.0.1:3000/api/auth/callback']
NEW = OLD + ['https://everyone-presentation-pilot.vercel.app/api/auth/callback']
OTHER_PATHS = [('auth', 'email', 'enable_confirmations'), ('auth', 'email', 'max_frequency'),
               ('auth', 'email', 'otp_length'), ('auth', 'mfa', 'totp', 'enroll_enabled'),
               ('auth', 'mfa', 'totp', 'verify_enabled'), ('db', 'pooler', 'default_pool_size'),
               ('db', 'pooler', 'max_client_conn'), ('storage', 'analytics', 'enabled'),
               ('storage', 'analytics', 'max_namespaces'), ('storage', 'image_transformation', 'enabled')]


def difference():
    return {'target': {'project_ref': 'pyibofyctwnqpvktepse'}, 'changes': [
        {'path': ['auth', 'additional_redirect_urls'], 'class': 'update', 'declared': True, 'local': NEW, 'remote': OLD},
        *[{'path': list(p), 'class': 'remote_only', 'declared': False, 'local': 'default', 'remote': 'private-sentinel'} for p in OTHER_PATHS]]}


def pull(urls=OLD, secret='private-sentinel', site='http://127.0.0.1:3000'):
    return {'dry_run': True, 'wrote': False, 'target': {'project_ref': 'pyibofyctwnqpvktepse'}, 'changes': [
        {'path': ['auth', 'additional_redirect_urls'], 'remote': list(urls), 'written': False},
        {'path': ['auth', 'site_url'], 'remote': site, 'written': False},
        {'path': ['auth', 'smtp', 'password'], 'remote': secret, 'written': False},
        {'path': ['storage', 'analytics', 'enabled'], 'remote': False, 'written': False}]}


def pins():
    return {'project_ref_sha256': 'f706303084a6135ca452a75e7c40e4746086e8cadc156c66e4e42af80b4c0ee5',
            'repository_config_sha256': '0a50cd9902ed3a31b57cde31171f725310ed8d0d3efbd7226f894d48272dfbb2',
            'harness_sha256': 'a' * 64}


class SyntheticOperation:
    def __init__(self, outcome='known', changed_other=False, claimed=False):
        self.urls = list(OLD)
        self.outcome, self.changed_other, self.claimed = outcome, changed_other, claimed
        self.pushes, self.pulls, self.claims = 0, 0, 0

    def pull(self):
        self.pulls += 1
        return pull(self.urls, 'changed-private-sentinel' if self.changed_other and self.pushes else 'private-sentinel')

    def diff(self):
        return difference()

    def push(self):
        if not self.claimed:
            raise AssertionError('A permanent claim must precede dispatch.')
        self.pushes += 1
        if self.outcome != 'not_committed':
            self.urls = list(NEW)
        if self.outcome != 'known':
            raise RuntimeError('private-sentinel')

    def claim(self, value):
        self.claims += 1
        if self.claimed:
            raise FileExistsError()
        self.claimed = True
        self.claim_value = value

    def run(self):
        return module.apply_once(self.pull, self.diff, self.push, self.claim, pins)


class RedirectGuards(unittest.TestCase):
    def test_exact_one_declared_update_and_ten_undeclared_remote_only_defaults(self):
        value = difference()
        baseline = copy.deepcopy(value)
        metadata = module.validate_redirect_diff(value)
        self.assertEqual(value, baseline)
        self.assertEqual(len(metadata), 11)
        self.assertNotIn('private-sentinel', json.dumps(metadata))

    def test_diff_rejects_extra_declared_defaults_wrong_target_or_changed_url_scope(self):
        for mutate in [lambda v:v['changes'][1].update(declared=True),
                       lambda v:v['changes'][1].update(**{'class': 'update'}),
                       lambda v:v['changes'].pop(),
                       lambda v:v['changes'].append(copy.deepcopy(v['changes'][0])),
                       lambda v:v['changes'][0].update(local=NEW + ['https://unapproved.invalid/callback']),
                       lambda v:v['changes'][0].update(remote=[]),
                       lambda v:v['target'].update(project_ref='another')]:
            value = difference()
            mutate(value)
            with self.assertRaises(ValueError) as error:
                module.validate_redirect_diff(value)
            self.assertNotIn('private-sentinel', str(error.exception))

    def test_pull_projection_compares_full_other_values_only_in_memory(self):
        value = pull()
        state = module.parse_pull(value)
        self.assertEqual(state['redirects'], OLD)
        self.assertEqual(state['other_remote'][('auth', 'smtp', 'password')], 'private-sentinel')
        absent_site = copy.deepcopy(value)
        absent_site['changes'] = [row for row in absent_site['changes'] if row['path'] != ['auth', 'site_url']]
        self.assertNotIn(('auth', 'site_url'), module.parse_pull(absent_site)['other_remote'])
        for mutate in [lambda v:v.update(wrote=True), lambda v:v.update(dry_run=False),
                       lambda v:v['changes'][0].update(written=True),
                       lambda v:v['changes'].append(copy.deepcopy(v['changes'][0])),
                       lambda v:v['changes'][0].update(remote=['https://unapproved.invalid/callback'])]:
            changed = copy.deepcopy(value)
            mutate(changed)
            with self.assertRaises(ValueError):
                module.parse_pull(changed)

    def test_fixed_cli_target_dry_run_and_push_yes_do_not_accept_other_actions(self):
        for action in ['pull', 'diff', 'push']:
            args = module.command_args(action, Path('/synthetic'))
            self.assertEqual(args[:4], ['npx.cmd', '--yes', 'supabase@2.122.0', 'config'])
            self.assertEqual(args[args.index('--project-ref') + 1], 'pyibofyctwnqpvktepse')
            self.assertEqual('--dry-run' in args, action == 'pull')
            if action == 'push':
                self.assertEqual(args[-1], '--yes')
        with self.assertRaises(ValueError):
            module.command_args('reset', Path('/synthetic'))

    def test_public_source_metadata_requires_actual_link_and_repo_pins(self):
        module.validate_source_pins(pins())
        for field in pins():
            value = pins()
            value[field] = 'bad'
            with self.assertRaises(ValueError):
                module.validate_source_pins(value)


class OnceOnlyFlow(unittest.TestCase):
    def test_success_pushes_once_claims_before_push_and_independently_reads_back(self):
        operation = SyntheticOperation()
        report = operation.run()
        self.assertEqual((operation.pushes, operation.pulls, operation.claims), (1, 3, 1))
        self.assertEqual(report['result'], 'passed')
        self.assertTrue(report['nonredirect_before_after_equal'])
        self.assertTrue(report['independent_readback_equal'])
        self.assertNotIn('private-sentinel', json.dumps(report))
        self.assertNotIn('private-sentinel', json.dumps(operation.claim_value))

    def test_unknown_push_uses_readback_without_repeating_committed_action(self):
        operation = SyntheticOperation('unknown_committed')
        report = operation.run()
        self.assertEqual(operation.pushes, 1)
        self.assertEqual(report['push_outcome'], 'unknown')
        self.assertEqual(report['result'], 'passed')
        self.assertTrue(report['application_verified_by_readback'])
        self.assertNotIn('private-sentinel', json.dumps(report))

    def test_unknown_uncommitted_push_remains_unconfirmed_and_is_not_retried(self):
        operation = SyntheticOperation('not_committed')
        report = operation.run()
        self.assertEqual(operation.pushes, 1)
        self.assertEqual(report['result'], 'unconfirmed')
        self.assertFalse(report['application_verified_by_readback'])

    def test_other_remote_change_cannot_be_hidden_by_the_redirect_success(self):
        operation = SyntheticOperation(changed_other=True)
        report = operation.run()
        self.assertEqual(operation.pushes, 1)
        self.assertEqual(report['result'], 'unconfirmed')
        self.assertFalse(report['nonredirect_before_after_equal'])
        self.assertNotIn('changed-private-sentinel', json.dumps(report))

    def test_site_url_absence_is_comparator_state_and_a_new_path_fails_preservation(self):
        operation = SyntheticOperation()
        original = operation.pull
        def comparator_pull():
            value = original()
            if operation.pushes == 0:
                value['changes'] = [row for row in value['changes'] if row['path'] != ['auth', 'site_url']]
            return value
        report = module.apply_once(comparator_pull, operation.diff, operation.push, operation.claim, pins)
        self.assertEqual(operation.pushes, 1)
        self.assertEqual(report['result'], 'unconfirmed')
        self.assertFalse(report['nonredirect_before_after_equal'])
        self.assertFalse(report['site_url_declared_or_modified'])

    def test_existing_claim_can_only_read_back_and_never_reapply(self):
        operation = SyntheticOperation(claimed=True)
        operation.urls = list(NEW)
        report = operation.run()
        self.assertEqual(operation.pushes, 0)
        self.assertTrue(report['repeat_apply_prevented'])
        self.assertFalse(report['original_nonredirect_baseline_available'])

    def test_invalid_diff_or_changed_source_stops_before_claim_and_push(self):
        operation = SyntheticOperation()
        def wrong_diff():
            value = difference()
            value['changes'][1]['declared'] = True
            return value
        with self.assertRaises(ValueError):
            module.apply_once(operation.pull, wrong_diff, operation.push, operation.claim, pins)
        self.assertEqual((operation.claims, operation.pushes), (0, 0))
        readings = iter([pins(), dict(pins(), harness_sha256='b' * 64)])
        with self.assertRaises(ValueError):
            module.apply_once(operation.pull, operation.diff, operation.push, operation.claim, lambda: next(readings))
        self.assertEqual((operation.claims, operation.pushes), (0, 0))


if __name__ == '__main__':
    unittest.main()
