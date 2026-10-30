"""Synthetic protocol/source tests. No cloud, credentials, process or private IO."""
import copy
import importlib.util
import io
import json
from pathlib import Path
import sys
import unittest
from contextlib import ExitStack, redirect_stdout
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'tools'))
spec = importlib.util.spec_from_file_location('producer_review_links', ROOT / 'tools/complete_producer_review_links.py')
tool = importlib.util.module_from_spec(spec); spec.loader.exec_module(tool)
# Synthetic25th version exercises the pure validation seams without reading a
# mutable working migration manifest or calling any provider.
baseline_bytes = (ROOT / tool.BASELINE).read_bytes()
if tool.sha(baseline_bytes) != tool.BASELINE_SHA:
    raise ValueError('FROZEN_PRODUCER_REVIEW_LINKS_ABSENCE_CHANGED')
VERSIONS = [*json.loads(baseline_bytes)['state']['history'], '20261030000100']
if len(VERSIONS) != 25 or VERSIONS != sorted(set(VERSIONS)):
    raise ValueError('SYNTHETIC_PRODUCER_REVIEW_LINKS_25_REQUIRED')



def fixture():
    before = {'observed_at': '2026-10-29T20:40:00+00:00', 'query_role': 'postgres', 'database': 'postgres',
        'unrestricted_visibility': True, 'versions': VERSIONS, 'source_job_count': 1, 'requester_derived_from_fixed_job': True,
        'verified_active_auth': True, 'two_projects_current': True, 'two_writable_memberships_current': True, 'producer_authority_current': True,
        'link_manager_grant': {'count': 0, 'active': None, 'state': 'absent'},
        'preservation': {'auth_users_count': 2, 'grants_count': 9, 'other_grants_sha256': 'a' * 64,
            'project_memberships_sha256': 'b' * 64, 'client_memberships_sha256': 'c' * 64}}
    after = copy.deepcopy(before); after['link_manager_grant'] = {'count': 1, 'active': True, 'state': 'active'}; after['preservation']['grants_count'] += 1
    return before, after


class ProducerReviewLinks(unittest.TestCase):
    def test_exact_absence_to_active_transition_preserves_other_grants_memberships_and_auth_count(self):
        before, after = fixture(); result = tool.validate_transition(before, after)
        self.assertTrue(result['only_absent_capability_added']); self.assertFalse(result['inactive_grants_reactivated'])

    def test_existing_active_or_revoked_grants_are_never_treated_as_absent(self):
        for active, state in ((True, 'active'), (False, 'inactive')):
            before, after = fixture(); before['link_manager_grant'] = {'count': 1, 'active': active, 'state': state}
            self.assertIs(tool.validate_state(before, VERSIONS), before)
            with self.subTest(state=state), self.assertRaises(ValueError): tool.validate_transition(before, after)

    def test_unknown_identity_or_personal_fields_never_enter_public_state(self):
        for section, field in (('top', 'principal_id'), ('top', 'email'), ('preservation', 'auth_row'), ('link_manager_grant', 'requested_by')):
            before, _ = fixture(); (before if section == 'top' else before[section])[field] = 'SYNTHETIC PRIVATE MARKER'
            with self.subTest(section=section, field=field), self.assertRaises(ValueError): tool.validate_state(before, VERSIONS)

    def test_missing_active_auth_current_source_or_either_authority_scope_is_denied(self):
        for key in ('unrestricted_visibility', 'requester_derived_from_fixed_job', 'verified_active_auth', 'two_projects_current', 'two_writable_memberships_current', 'producer_authority_current'):
            before, _ = fixture(); before[key] = False
            with self.subTest(field=key), self.assertRaises(ValueError): tool.validate_state(before, VERSIONS)
        for key, value in (('source_job_count', 0), ('source_job_count', True), ('query_role', 'authenticated'), ('database', 'other')):
            before, _ = fixture(); before[key] = value
            with self.subTest(field=key), self.assertRaises(ValueError): tool.validate_state(before, VERSIONS)

    def test_inconsistent_grant_state_or_current_history_is_rejected(self):
        for change in ('active_count_zero', 'absent_inactive', 'two_rows', 'bool_count', 'history'):
            before, _ = fixture()
            if change == 'active_count_zero': before['link_manager_grant']['active'] = True
            elif change == 'absent_inactive': before['link_manager_grant']['state'] = 'inactive'
            elif change == 'two_rows': before['link_manager_grant']['count'] = 2
            elif change == 'bool_count': before['link_manager_grant']['count'] = False
            else: before['versions'] = VERSIONS[:-1]
            with self.subTest(change=change), self.assertRaises(ValueError): tool.validate_state(before, VERSIONS)

    def test_any_unrelated_grant_membership_or_auth_count_drift_rejects_completion(self):
        for key in fixture()[0]['preservation']:
            before, after = fixture(); after['preservation'][key] = 100 if key.endswith('count') else 'd' * 64
            with self.subTest(field=key), self.assertRaises(ValueError): tool.validate_transition(before, after)

    def test_versions_are_the_only_allowed_sql_substitution_and_cannot_inject(self):
        text = (ROOT / tool.APPLY).read_text(encoding='utf8'); query = tool.build_apply(text, VERSIONS)
        self.assertNotIn('__REVIEWED_VERSIONS__', query)
        for value in ([], VERSIONS[:-1], VERSIONS[::-1], [*VERSIONS, '20261029203953'], [*VERSIONS[:-1], "';delete from auth.users;--"], [*VERSIONS[:-1], VERSIONS[0]]):
            with self.assertRaises(ValueError): tool.build_apply(text, value)
        for malformed in ('', text + text):
            with self.assertRaises(ValueError): tool.build_apply(malformed, VERSIONS)
        before, _ = fixture(); newer = [*VERSIONS, '20261029203953']; before['versions'] = newer
        with self.assertRaises(ValueError): tool.validate_state(before, newer)

    def test_sql_has_one_fixed_insert_no_upsert_reactivation_auth_or_membership_write(self):
        from pglast import parse_sql
        text = (ROOT / tool.APPLY).read_text(encoding='utf8'); query = tool.build_apply(text, VERSIONS)
        self.assertEqual([type(stmt.stmt).__name__ for stmt in parse_sql(query)], ['TransactionStmt', 'VariableSetStmt', 'VariableSetStmt', 'VariableSetStmt', 'VariableSetStmt', 'LockStmt', 'DoStmt', 'SelectStmt', 'TransactionStmt'])
        self.assertEqual(query.lower().count('insert into'), 1)
        self.assertIn("insert into public.app_capability_grants(principal_id,capability,active)values(actor,'review_links.manage',true)", query)
        for forbidden in ('on conflict', 'update auth.', 'insert into auth.', 'delete from', 'set active', 'request.jwt', '@everyone.', 'mohamed', 'producer_email'):
            self.assertNotIn(forbidden, query.lower())
        self.assertLess(query.index('for share;'), query.index('-- These are fresh statements'))
        self.assertLess(query.index('PRODUCER_REVIEW_LINKS_EXISTING_GRANT_PRESERVED'), query.index('insert into public.app_capability_grants'))

    def test_readback_is_repeatable_read_only_and_projects_no_principal_or_auth_row(self):
        from pglast import parse_sql
        query = (ROOT / tool.READBACK).read_text(encoding='utf8')
        self.assertIn('begin isolation level repeatable read read only;', query)
        self.assertTrue(query.rstrip().endswith('rollback;'))
        self.assertEqual([type(stmt.stmt).__name__ for stmt in parse_sql(query)], ['TransactionStmt', 'VariableSetStmt', 'VariableSetStmt', 'VariableSetStmt', 'VariableSetStmt', 'SelectStmt', 'TransactionStmt'])
        for forbidden in ("'principal_id'", "'email'", "'requested_by'", 'to_jsonb(u)', 'encrypted_password', 'original_transcript'):
            self.assertNotIn(forbidden, query)

    def test_source_sql_and_actual_rollback_proof_are_sealed_without_claiming_cloud_success(self):
        for file, expected in tool.SEALS.items(): self.assertEqual(tool.sha((ROOT / file).read_bytes()), expected)
        self.assertEqual(tool.sha((ROOT / tool.BASELINE).read_bytes()), tool.BASELINE_SHA)
        self.assertEqual(tool.sha((ROOT / tool.LOCAL_PROOF).read_bytes()), tool.LOCAL_PROOF_SHA)
        proof = json.loads((ROOT / tool.LOCAL_PROOF).read_bytes())
        self.assertEqual(proof['result'], 'passed'); self.assertEqual(proof['negative_cases_passed'], 18); self.assertTrue(proof['rollback_verified']); self.assertFalse(proof['cloud_called'])
        for file in (tool.APPLY, tool.READBACK, 'tools/sql/producer-review-links-local-fixture.sql', 'tools/local-postgres.mjs'):
            self.assertEqual(tool.sha((ROOT / file).read_bytes()), proof['source_seals'][file])
        self.assertEqual(tool.sha((ROOT / 'tools/test-producer-review-links-local.mjs').read_bytes()), proof['harness_sha256'])

    def protocol(self, unknown=False, drift=False, existing=False):
        before, after = fixture()
        if existing: before['link_manager_grant'] = {'count': 1, 'active': False, 'state': 'inactive'}
        template = (ROOT / tool.APPLY).read_bytes(); current = {'versions': VERSIONS, 'source_seals': {tool.READBACK: 'a' * 64}}
        memory = {}; evidence = {}; calls = []; checks = 0
        def inputs():
            nonlocal checks
            checks += 1; return {**current, 'changed': True} if drift and checks >= 2 else current
        def retain(value, suffix):
            name = f'tracking/evidence/m06/producer-review-links/synthetic-{suffix}.json'; evidence[name] = copy.deepcopy(value); return name
        def write(file, data):
            if file in memory: raise ValueError('Exclusive creation required')
            memory[file] = data
        def call(args):
            calls.append(args)
            if unknown: raise TimeoutError('SYNTHETIC PRIVATE PROVIDER MARKER')
            self.assertIn(tool.CLAIM, memory)
            return SimpleNamespace(returncode=0, stdout=json.dumps({'rows': [{'producer_review_links': {'capability': 'review_links.manage', 'active': True,
                'inserted_grants': 1, 'other_grants_preserved': True, 'memberships_preserved': True, 'auth_user_count_preserved': True,
                'auth_writes_requested': False, 'inactive_grants_reactivated': False}}]}))
        stack = ExitStack()
        stack.enter_context(patch.object(tool, 'inputs', side_effect=inputs)); stack.enter_context(patch.object(tool, 'inspect', side_effect=[before, after]))
        stack.enter_context(patch.object(tool, 'sealed', return_value=template)); stack.enter_context(patch.object(tool, 'retain', side_effect=retain))
        stack.enter_context(patch.object(tool, 'private_write', side_effect=write)); stack.enter_context(patch.object(tool, 'cli_call', side_effect=call))
        stack.enter_context(patch.object(Path, 'mkdir')); stack.enter_context(patch.object(Path, 'exists', lambda file: file in memory))
        stack.enter_context(patch.object(Path, 'glob', lambda _file, _pattern: [])); stack.enter_context(patch.object(Path, 'read_bytes', lambda file: memory[file]))
        stack.enter_context(redirect_stdout(io.StringIO()))
        return stack, memory, evidence, calls, before, after, current

    def test_apply_creates_one_exclusive_claim_before_exactly_one_mutation_then_readback(self):
        stack, memory, evidence, calls, _before, _after, _current = self.protocol()
        with stack: self.assertEqual(tool.main(['apply']), 0)
        self.assertEqual(len(calls), 1); self.assertIn(tool.CLAIM, memory)
        self.assertEqual(evidence['tracking/evidence/m06/producer-review-links/synthetic-apply.json']['result'], 'verified')
        self.assertIn('--project-ref', calls[0]); self.assertEqual(calls[0][calls[0].index('--project-ref') + 1], 'pyibofyctwnqpvktepse')

    def test_unknown_mutation_result_keeps_claim_and_reconciliation_is_read_only(self):
        stack, memory, evidence, calls, _before, after, current = self.protocol(unknown=True)
        with stack:
            self.assertEqual(tool.main(['apply']), 1); self.assertIn(tool.CLAIM, memory)
            with patch.object(tool, 'inspect', return_value=after), patch.object(tool, 'read_claim', return_value=json.loads(memory[tool.CLAIM])), patch.object(tool, 'load_json', side_effect=lambda p: evidence[p.as_posix()]):
                self.assertEqual(tool.main(['readback']), 0)
            with patch.object(tool, 'inspect', return_value=fixture()[0]): self.assertEqual(tool.main(['apply']), 1)
        self.assertEqual(len(calls), 1)
        serialized = json.dumps(evidence); self.assertNotIn('SYNTHETIC PRIVATE PROVIDER MARKER', serialized)
        self.assertTrue(evidence['tracking/evidence/m06/producer-review-links/synthetic-readback.json']['comparison']['only_absent_capability_added'])

    def test_revocation_or_last_moment_source_drift_prevents_mutation(self):
        for setting in ({'existing': True}, {'drift': True}):
            stack, memory, _evidence, calls, *_ = self.protocol(**setting)
            with stack: self.assertEqual(tool.main(['apply']), 1)
            self.assertEqual(calls, [])
            self.assertEqual(tool.CLAIM in memory, bool(setting.get('drift')))

    def test_no_identity_target_sql_or_force_arguments_are_accepted(self):
        for arguments in (['--target', 'other'], ['force'], ['--principal', 'synthetic'], ['apply', 'again']):
            with self.assertRaises(ValueError): tool.main(arguments)


if __name__ == '__main__': unittest.main()
