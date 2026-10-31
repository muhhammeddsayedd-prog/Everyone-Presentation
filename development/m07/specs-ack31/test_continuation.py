"""Synthetic compact-release tests; no CLI, filesystem claims, or DB execution."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

HERE=Path(__file__).parent
def load(name,file):
    spec=importlib.util.spec_from_file_location(name,HERE/file);value=importlib.util.module_from_spec(spec);spec.loader.exec_module(value);return value

s=load('continuation_sql','continuation_sql.py')
g=load('continuation_guards','continuation_guards.py')
fixtures=load('ack31_synthetic_fixtures','test_canonical_guards.py')
MARKER='11111111-2222-4333-8444-555555555555'
CUTOFF='2026-10-31T01:37:38.327713+00:00'

class ContinuationTests(unittest.TestCase):
    def test_large_full_state_is_compared_without_embedding_it_in_sql(self):
        before=fixtures.baseline();before['protected_data']['counts']={'eps.jobs':0,'public.projects':1}
        before['catalog']['synthetic_private_text']='PRIVATE_SENTINEL_'+('x'*2700000)
        value=s.render((HERE/'canonical-query.sql').read_text(),(HERE/'candidate.sql').read_text(),before,'a'*64,MARKER,CUTOFF)
        self.assertLess(len(value.encode()),64000)
        self.assertNotIn('PRIVATE_SENTINEL',value)
        self.assertIn("'a"+('a'*63)+"'",value)
        self.assertIn("current_setting('eps.ack31.before')::jsonb",value)
        self.assertEqual(value.lower().count('create or replace function eps.specs_submit_ack('),1)
        self.assertEqual(value.lower().count('insert into supabase_migrations.schema_migrations('),1)
        self.assertEqual(value.lower().count('\ncommit;'),1)
        self.assertLess(value.index(MARKER),100)
        self.assertLess(value.index('application_name'),value.index('lock table'))
        self.assertTrue(value.rstrip().endswith('as specs_ack31_commit;'))

    def test_hash_normalization_changes_only_cli_expiry_and_preserves_role_order(self):
        expression=s.normalized_hash('state')
        self.assertIn("r->>'name'='cli_login_postgres'",expression)
        self.assertIn("'{valid_until}'",expression)
        self.assertIn('order by ordinal',expression)
        self.assertNotIn("-'",expression)
        for invalid in ('state;COMMIT','x.y',"'state'"):
            with self.assertRaises(ValueError):s.normalized_hash(invalid)

    def test_preflight_returns_full_state_sql_hash_and_conservative_activity_fence(self):
        query=s.read_query((HERE/'canonical-query.sql').read_text(),CUTOFF)
        self.assertIn("'normalized_state_sha256'",query)
        self.assertIn("'activity_fence'",query)
        self.assertIn("backend_type='client backend'",query)
        self.assertIn('xact_start is not null',query)
        self.assertIn('pid<>pg_backend_pid()',query)
        self.assertNotIn("state='active'",query)
        self.assertNotIn('position(',s.activity_expression(CUTOFF))
        self.assertIn(CUTOFF,query)
        self.assertTrue(query.rstrip().endswith('rollback;'))

    def test_marker_table_hash_and_cutoff_are_closed_inputs(self):
        before=fixtures.baseline();before['protected_data']['counts']={'eps.jobs':0}
        args=[(HERE/'canonical-query.sql').read_text(),(HERE/'candidate.sql').read_text(),before,'a'*64,MARKER,CUTOFF]
        for index,value in ((3,'not-a-hash'),(4,"';commit;--"),(5,"2026-10-31';commit;--")):
            bad=copy.deepcopy(args);bad[index]=value
            with self.assertRaises(ValueError):s.render(*bad)
        for table in ('auth.users','eps.jobs;commit','eps../jobs'):
            bad=copy.deepcopy(args);bad[2]['protected_data']['counts']={table:1}
            with self.assertRaises(ValueError):s.render(*bad)

    def test_activity_absence_requires_monitoring_full_visibility_exact_shape_and_zero_all_old_transactions(self):
        value={'track_activities':True,'unrestricted_visibility':True,'older_client_transactions':0}
        g.validate_fence(value)
        for change in ({'track_activities':False},{'unrestricted_visibility':False},{'older_client_transactions':1},
                       {'older_client_transactions':False},{'older_client_transactions':None},{'extra':0}):
            with self.assertRaises(ValueError):g.validate_fence({**value,**change})

    def test_fresh_old_state_must_still_preserve_the_original_claimed_baseline(self):
        original=fixtures.baseline();fresh=copy.deepcopy(original)
        fresh['context']['all_roles'][0]['valid_until']='2026-10-31T01:06:00+00:00'
        g.predecessor_equal(original,fresh,'2026-10-31T01:00:00+00:00',fixtures.g)
        for mutate in (lambda x:x['catalog'].update(extra=True),lambda x:x['protected_data']['hashes'].update(synthetic='c'*64),
                       lambda x:x['context']['all_roles'][0].update(oid=12),lambda x:x['admission']['protected_m02'].update(manual_note_retained=False)):
            changed=copy.deepcopy(fresh);mutate(changed)
            with self.assertRaises(ValueError):g.predecessor_equal(original,changed,'2026-10-31T01:00:00+00:00',fixtures.g)

    def test_diagnostics_expose_only_fixed_codes_and_never_raw_error_content(self):
        secret='SYNTHETIC_PRIVATE_SENTINEL'
        value=g.diagnostic(1,'',f'HTTP 413 RequestEntityTooLarge {secret}; SQLSTATE 42501; ACK31_FULL_SELECTED_STATE_CHANGED')
        self.assertEqual(value['exit_code'],1);self.assertEqual(value['http_status'],413)
        self.assertEqual(value['sqlstate'],'42501');self.assertTrue(value['request_entity_too_large'])
        self.assertIn('ACK31_FULL_SELECTED_STATE_CHANGED',value['fixed_error_tokens'])
        self.assertNotIn(secret,json.dumps(value))
        unknown=g.diagnostic(1,'',f'HTTP 999; SQLSTATE SECRET; {secret}')
        self.assertIsNone(unknown['http_status']);self.assertIsNone(unknown['sqlstate'])
        self.assertEqual(unknown['fixed_error_tokens'],[])

    def test_timeout_or_nonzero_exit_cannot_be_a_normal_return(self):
        for value in (g.diagnostic(None,'','',True),g.diagnostic(1,'','HTTP 413')):
            self.assertFalse(g.command_returned_successfully(value))
        self.assertTrue(g.command_returned_successfully(g.diagnostic(0,'','')))

    def test_unknown_dispatch_stops_after_one_attempt_even_if_readback_observes_desired_state(self):
        class IO:
            calls=0
            def preflight(self):return fixtures.baseline()
            def claim(self,before):pass
            def dispatch(self,before):self.calls+=1;raise TimeoutError()
            def read(self):return fixtures.after()
            def now(self):return '2026-10-31T01:00:00+00:00'
        io=IO();result=fixtures.g.apply_once(io)
        self.assertEqual(io.calls,1);self.assertTrue(result['application_verified_by_readback'])
        self.assertEqual(result['result'],'unconfirmed');self.assertFalse(result['normal_return_marker_observed'])

if __name__=='__main__':unittest.main()
