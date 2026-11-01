"""Inert compiler, preservation and fake-port checks; never executes SQL/CLI."""
from pathlib import Path
import copy
import importlib.util
import json
import sys
import unittest
from unittest.mock import Mock, patch
from pglast import ast, parse_sql, parse_plpgsql
from pglast.stream import RawStream
from pglast.visitors import Visitor

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('specs_worker38_test_project', HERE/'project.py')
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)
MARKER = 'a9380000-0000-4000-8000-000000000001'
NEW = 'a9380000-0000-4000-8000-000000000002'


def snapshot():
    raw = json.loads(p.s.load(p.ROOT/'tracking/evidence/m07/job-batch-filter38-release/2026-11-01T17-28-00-388406Z-apply.json'))
    full = copy.deepcopy(raw['first'])
    configs = {}
    for table, (_, fields) in p.s.CONFIG.items():
        row = {'id': 1 if table == 'specs_pipeline_config' else True, 'enabled': True}
        if table == 'candidate_asset_config':
            row['english_transcript_version'] = '1.0'
        if table == 'frame_extraction_config':
            row.update(native_image_id=p.NATIVE, implementation_version='frame-extraction.v1')
        assert set(row) == set(fields.split())
        configs[table] = {'public': row, 'shape_valid': True, 'fixed_sha256': 'f'*64,
                          'table_hash': full['data'][table]['sha256']}
    return {'state': full, 'config': configs, 'lifecycle': dict.fromkeys(p.s.COUNTERS, 0)}


def observation():
    value = snapshot()
    return {'snapshot': value, 'actor_eligible': True, 'client_valid': True,
            'template_valid': True, 'membership_valid': True, 'insert_surface_safe': True,
            'target_matches': 0, 'target': None, 'target_memberships': [], 'target_workspace_count': 0,
            'counts': {table: value['state']['data'][table]['count'] for table in p.WRITES}}


def created(before):
    value = copy.deepcopy(before)
    value['target_matches'] = 1
    stamp = '2026-11-01T20:00:00+00:00'
    value['target'] = {'id': NEW, 'client_id': p.CLIENT, 'name': p.NAME, 'archived_at': None,
                       'row_version': 1, 'created_at': stamp, 'updated_at': stamp}
    value['target_memberships'] = [{'project_id': NEW, 'principal_id': p.ACTOR,
                                   'active': True, 'can_write': True, 'created_at': stamp}]
    value['counts'] = {key: count+1 for key, count in before['counts'].items()}
    return value


def evidence():
    state = snapshot()
    resume = {'target': p.TARGET, 'phase': 'resume', 'result': 'passed',
              'normal_return_marker_observed': True, 'independent_readback_verified': True,
              'first': state, 'second': copy.deepcopy(state), 'source_pins': {p.STATE: p.STATE_SHA}}
    worker = {'result': 'passed', 'project_id': p.s.PROJECT, 'team_id': p.s.TEAM,
              'source_sha256': p.WORKER_SOURCE, 'native_image_id': p.NATIVE, 'daemon_image_id': p.DAEMON,
              'new_deployment_ready': True, 'old_instances_absent': True, 'native_cleanup_confirmed': True,
              'ready_alive_instances': 1, 'memory_mib': 2048, 'region': 'dub1'}
    return resume, worker


class Fake:
    def __init__(self, before, mode='normal'):
        self.before, self.after, self.mode = before, created(before), mode
        self.claimed = None
        self.dispatches = 0
        self.reads = 0
        self.returned_count = 0

    def pins(self):
        return {'synthetic': 'a'*64}

    def read(self):
        self.reads += 1
        return copy.deepcopy(self.after if self.dispatches else self.before)

    def claim(self, value):
        if self.claimed is not None:
            raise ValueError('SYNTHETIC_CLAIM_EXISTS')
        self.claimed = copy.deepcopy(value)

    def returned(self, claim, reply):
        assert claim == self.claimed
        p.validate_reply(reply, claim['marker'])
        self.returned_count += 1

    def dispatch(self, sql):
        assert self.claimed is not None and 'insert into public.projects' in sql
        self.dispatches += 1
        if self.mode != 'normal':
            raise ValueError('SYNTHETIC_LOST_REPLY')
        return {'phase': 'create', 'marker': MARKER, 'project_id': NEW, 'inserted_projects': 1, 'inserted_memberships': 1}


class Tests(unittest.TestCase):
    def plan(self, before):
        resume, _ = evidence()
        return {'before': copy.deepcopy(before), 'pins': {'synthetic': 'a'*64}, 'admission': {'resume': resume}, 'marker': MARKER}

    def test_disabled_entry_refuses_before_admission_or_IO(self):
        self.assertIs(type(p.APPLY_ENABLED), bool)
        with patch.object(p, 'APPLY_ENABLED', False), patch.object(sys, 'argv', ['project', 'apply']), \
                patch.object(p, 'load_admission') as admitted, patch.object(p, 'query') as query:
            with self.assertRaises(ValueError):
                p.main()
            admitted.assert_not_called()
            query.assert_not_called()

    def test_identities_come_from_the_exact_old_receipt_and_source_closure_is_current(self):
        self.assertEqual(p.ACTOR, '0a79a703-caba-47e5-93d4-42e32197037a')
        self.assertEqual(p.CLIENT, 'f4a9937c-f575-4975-bdea-fb83b85e48c3')
        self.assertEqual(p.TEMPLATE, 'bd14d10f-b1c5-4d6a-8b4d-e5c48208433c')
        self.assertEqual(len(p.HISTORY), 38)
        pins = p.sources()
        self.assertEqual(pins[p.STATE], p.STATE_SHA)
        self.assertEqual(pins[p.IDENTITY], p.IDENTITY_SHA)
        self.assertFalse(any(file.endswith('.ts') for file in pins))

    def test_unknown_resume_and_wrong_worker_cannot_admit(self):
        template = json.loads((HERE/'admission.template.json').read_text())
        with self.assertRaises(ValueError):
            p.admit(template, Mock())
        resume, worker = evidence()
        supplied = {**template, 'resume_receipt': {'path': 'tracking/evidence/synthetic-resume.json', 'sha256': 'a'*64},
                    'worker_ready': {'path': 'tracking/evidence/synthetic-worker.json', 'sha256': 'b'*64}}
        self.assertEqual(p.admit(supplied, Mock(side_effect=[resume, worker]))['resume'], resume)
        for key in ['normal_return_marker_observed', 'independent_readback_verified']:
            bad = copy.deepcopy(resume); bad[key] = False
            with self.assertRaises(ValueError):
                p.admit(supplied, Mock(side_effect=[bad, worker]))
        for key, value in [('native_image_id', p.s.OLD_IMAGE), ('old_instances_absent', False), ('ready_alive_instances', 2)]:
            bad = copy.deepcopy(worker); bad[key] = value
            with self.assertRaises(ValueError):
                p.admit(supplied, Mock(side_effect=[resume, bad]))

    def test_post_resume_history_native_and_all_enabled_flags_are_required(self):
        p.validate(observation(), absent=True)
        changes = [lambda x: x['snapshot']['state']['history'].pop(),
                   lambda x: x['snapshot']['config']['frame_extraction_config']['public'].update(native_image_id=p.s.OLD_IMAGE)]
        changes += [lambda x, key=key: x['snapshot']['config'][key]['public'].update(enabled=False) for key in p.s.CONFIG]
        for change in changes:
            value = observation(); change(value)
            with self.assertRaises(ValueError):
                p.validate(value, absent=True)

    def test_preservation_allows_only_the_two_new_scoped_rows(self):
        before = observation(); after = created(before)
        self.assertTrue(p.preserved(before, after))
        for key in before['snapshot']['state']['data']:
            bad = copy.deepcopy(after); bad['snapshot']['state']['data'][key]['sha256'] = '0'*64
            with self.assertRaises(ValueError):
                p.preserved(before, bad)
        for change in [lambda x: x['snapshot']['state']['trace_rows'].update(sha256='0'*64),
                       lambda x: x['target'].update(name='Existing project'),
                       lambda x: x['target'].update(row_version=2),
                       lambda x: x['target'].update(updated_at='2026-11-01T20:00:01+00:00'),
                       lambda x: x['target_memberships'][0].update(principal_id=NEW),
                       lambda x: x['target_memberships'][0].update(can_write=False),
                       lambda x: x['target_memberships'][0].update(active=1),
                       lambda x: x.update(target_workspace_count=1),
                       lambda x: x['counts'].update({'public.projects': before['counts']['public.projects']+2})]:
            bad = copy.deepcopy(after); change(bad)
            with self.assertRaises(ValueError):
                p.preserved(before, bad)

    def test_compiled_SQL_parses_and_contains_only_the_two_intended_insert_targets(self):
        before = observation()
        sql = p.render_create(before, MARKER)
        self.assertLess(sql.index('in share row exclusive mode;'), sql.index('select'))
        self.assertLess(sql.index('SPECS_TEST_PROJECT_PREFLIGHT_CHANGED'), sql.index('insert into public.projects'))
        self.assertLess(sql.index('SPECS_TEST_PROJECT_POSTCONDITION_FAILED'), sql.index('commit;'))
        inserts = []
        class Mutations(Visitor):
            def visit_InsertStmt(self, ancestors, node):
                inserts.append((node.relation.schemaname, node.relation.relname))
            def visit_UpdateStmt(self, ancestors, node):
                raise AssertionError('Unexpected executable UPDATE')
            def visit_DeleteStmt(self, ancestors, node):
                raise AssertionError('Unexpected executable DELETE')
        for node in parse_sql(sql):
            if isinstance(node.stmt, ast.DoStmt):
                parsed = parse_plpgsql(RawStream()(node.stmt))
                def walk(value):
                    if isinstance(value, dict):
                        for key, child in value.items():
                            if key == 'query' and isinstance(child, str) and child.startswith(('insert into', 'update ', 'delete ')):
                                Mutations()(parse_sql(child))
                            else:
                                walk(child)
                    elif isinstance(value, list):
                        for child in value:
                            walk(child)
                walk(parsed)
        self.assertEqual(inserts, [('public', 'projects'), ('public', 'project_memberships')])
        parse_sql(p.read_sql())

    def test_fake_dispatch_is_claimed_once_and_readbacks_preserve_originals(self):
        before = observation(); io = Fake(before)
        with patch.object(p, 'APPLY_ENABLED', True):
            result = p.apply_once(io, self.plan(before))
            self.assertEqual(result['result'], 'passed')
            self.assertEqual(io.dispatches, 1)
            self.assertEqual(io.returned_count, 1)
            self.assertEqual(io.reads, 4)
            with self.assertRaises(ValueError):
                p.apply_once(io, self.plan(before))
            self.assertEqual(io.dispatches, 1)

    def test_lost_reply_never_retries_or_infers_a_validated_SQL_return(self):
        for mode in ['lost_reply', 'timeout']:
            before = observation(); io = Fake(before, mode)
            with patch.object(p, 'APPLY_ENABLED', True):
                result = p.apply_once(io, self.plan(before))
            self.assertEqual(result['result'], 'unconfirmed')
            self.assertEqual(io.dispatches, 1)
            self.assertFalse(result['normal_return_marker_observed'])
            self.assertEqual(io.returned_count, 0)
            self.assertTrue(result['independent_readback_verified'])
            self.assertEqual(result['first']['target']['id'], NEW)
            self.assertTrue(result['claim_retained'])

    def test_stale_plan_refuses_before_claim_or_dispatch(self):
        before = observation(); io = Fake(before)
        plan = self.plan(before); plan['before']['snapshot']['state']['data']['jobs']['sha256'] = '0'*64
        with patch.object(p, 'APPLY_ENABLED', True), self.assertRaises(ValueError):
            p.apply_once(io, plan)
        self.assertIsNone(io.claimed)
        self.assertEqual(io.dispatches, 0)

    def test_future_static_baseline_comes_only_from_actual_admitted_resume(self):
        before = observation(); resume, _ = evidence()
        admitted = {'resume': resume}
        io = p.OperatorIO({'synthetic': 'a'*64}, admitted)
        with patch.object(p, 'sources', return_value={'synthetic': 'a'*64}), \
                patch.object(p, 'load_admission', return_value=admitted), \
                patch.object(p, 'query', return_value=before), \
                patch.object(p.s.s, 'check_static', side_effect=AssertionError('Old795 validator must not run')):
            self.assertEqual(io.read(), before)
            before['snapshot']['state']['catalogue']['sha256'] = '0'*64
            with self.assertRaises(ValueError):
                io.read()

    def test_source_change_after_claim_refuses_dispatch_and_retains_claim(self):
        before = observation(); io = Fake(before)
        io.pins = Mock(side_effect=[{'synthetic': 'a'*64}, {'synthetic': 'b'*64}, {'synthetic': 'b'*64}])
        with patch.object(p, 'APPLY_ENABLED', True):
            result = p.apply_once(io, self.plan(before))
        self.assertEqual(result['result'], 'unconfirmed')
        self.assertIsNotNone(io.claimed)
        self.assertEqual(io.dispatches, 0)

    def test_success_reply_for_a_different_project_cannot_earn_acceptance(self):
        before = observation(); io = Fake(before)
        original = io.dispatch
        def wrong_reply(sql):
            return {**original(sql), 'project_id': MARKER}
        io.dispatch = wrong_reply
        with patch.object(p, 'APPLY_ENABLED', True):
            result = p.apply_once(io, self.plan(before))
        self.assertEqual(result['result'], 'unconfirmed')
        self.assertTrue(result['normal_return_marker_observed'])
        self.assertTrue(result['independent_readback_verified'])
        self.assertFalse(result['reply_matches_readbacks'])
        self.assertEqual(io.dispatches, 1)

    def test_real_dispatch_adapter_checks_persisted_claim_SQL_before_query(self):
        before = observation(); admitted = {'synthetic': True}; pins = {'synthetic': 'a'*64}
        io = p.OperatorIO(pins, admitted); io.pins = Mock(return_value=pins)
        sql = p.render_create(before, MARKER)
        claim = {'before': before, 'pins': pins, 'admission': admitted, 'marker': MARKER,
                 'purpose': p.PURPOSE, 'target': p.TARGET, 'automatic_retry': False,
                 'dispatch_may_have_occurred': True, 'sql_sha256': p.sha(sql.encode())}
        with patch.object(p, 'private_read', return_value=claim), patch.object(p, 'query') as query:
            io.dispatch(sql)
            query.assert_called_once_with(sql)
            query.reset_mock(); claim['sql_sha256'] = '0'*64
            with self.assertRaises(ValueError):
                io.dispatch(sql)
            query.assert_not_called()

    def test_malformed_reply_cannot_record_return_even_when_both_reads_show_the_new_rows(self):
        valid = {'phase': 'create', 'marker': MARKER, 'project_id': NEW, 'inserted_projects': 1, 'inserted_memberships': 1}
        replies = [None, [], {}, {**valid, 'phase': 'inspect'}, {**valid, 'marker': NEW},
                   {**valid, 'project_id': 'invalid'}, {**valid, 'inserted_projects': True},
                   {**valid, 'inserted_memberships': 2}, {**valid, 'unexpected': 'not accepted'}]
        for reply in replies:
            before = observation(); io = Fake(before)
            def dispatch(sql):
                io.dispatches += 1
                return reply
            io.dispatch = dispatch
            with patch.object(p, 'APPLY_ENABLED', True):
                result = p.apply_once(io, self.plan(before))
            self.assertEqual(result['result'], 'unconfirmed')
            self.assertFalse(result['normal_return_marker_observed'])
            self.assertTrue(result['independent_readback_verified'])
            self.assertEqual(result['first']['target']['id'], NEW)
            self.assertEqual(result['second']['target']['id'], NEW)
            self.assertEqual(io.returned_count, 0)
            self.assertEqual(io.dispatches, 1)
            self.assertTrue(result['claim_retained'])

    def test_durable_return_adapter_revalidates_unique_SQL_reply_before_writing(self):
        claim = {'marker': MARKER}
        io = p.OperatorIO({}, {})
        valid = {'phase': 'create', 'marker': MARKER, 'project_id': NEW, 'inserted_projects': 1, 'inserted_memberships': 1}
        with patch.object(p, 'private_read', return_value=claim) as read, patch.object(p, 'private_write') as write, \
                patch.object(p.s, 'load', return_value=b'synthetic-claim'):
            with self.assertRaises(ValueError):
                io.returned(claim, {**valid, 'marker': NEW})
            read.assert_not_called()
            write.assert_not_called()
            io.returned(claim, valid)
            write.assert_called_once_with(p.PRIVATE/'create.returned.json', {
                'claim_sha256': p.sha(b'synthetic-claim'), 'normal_return_marker_observed': True, 'reply': valid})


if __name__ == '__main__':
    unittest.main()
