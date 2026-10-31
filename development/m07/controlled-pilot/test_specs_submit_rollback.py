"""Synthetic pure guards/state machine only; no SQL/CLI/provider execution."""
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('specs_submit_rollback',Path(__file__).with_name('specs-submit-rollback.py'))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class RollbackTests(unittest.TestCase):
    def test_ack_is_exact_published_contract_and_binds_actual_spec_and_poll_identity(self):
        job='11111111-2222-4333-8444-555555555555'
        value={'kind':'ack','subtransaction_rolled_back':True,'ack':{'job_id':job,'resource_id':module.SPEC,'poll_url':'/api/v1/jobs/'+job,'status':'queued'}}
        self.assertEqual(module.outcome(value),value)
        for patch in ({'resource_id':module.WORKSPACE},{'poll_url':'https://offsite.example/'},{'extra':'PRIVATE'}):
            with self.assertRaises(ValueError):module.outcome({**value,'ack':{**value['ack'],**patch}})

    def test_sql_errors_allow_only_code_and_fixed_permission_object(self):
        value={'kind':'sql_error','subtransaction_rolled_back':True,'sqlstate':'42501','permission_denied':True,'permission_object':'workspaces'}
        self.assertEqual(module.outcome(value),value)
        for patch in ({'permission_object':'SYNTHETIC_PRIVATE'},{'message':'SYNTHETIC_PRIVATE'},{'subtransaction_rolled_back':False}):
            with self.assertRaises(ValueError):module.outcome({**value,**patch})

    def test_unknown_dispatch_never_retries_or_credits_rollback_from_zero_rows_alone(self):
        state={'fingerprints':{'synthetic':'same'}}
        class IO:
            calls=0
            def read(self):return state
            def claim(self,value):pass
            def execute(self):self.calls+=1;raise TimeoutError()
        io=IO();result=module.run_once(io)
        self.assertEqual(io.calls,1);self.assertEqual(result['result'],'unconfirmed')
        self.assertTrue(result['selected_state_equal']);self.assertFalse(result['rollback_verified'])

    def test_claim_collision_prevents_actual_rpc(self):
        class IO:
            calls=0
            def read(self):return {'fingerprints':{'synthetic':'same'}}
            def claim(self,value):raise FileExistsError()
            def execute(self):self.calls+=1
        io=IO()
        with self.assertRaises(FileExistsError):module.run_once(io)
        self.assertEqual(io.calls,0)

    def test_successful_error_diagnostic_requires_preservation_and_changes_remain_unconfirmed(self):
        error={'kind':'sql_error','subtransaction_rolled_back':True,'sqlstate':'42501','permission_denied':True,'permission_object':'specs'}
        class IO:
            reads=0
            def read(self):self.reads+=1;return {'fingerprints':{'synthetic':'before'if self.reads==1 else'changed'}}
            def claim(self,value):pass
            def execute(self):return error
        result=module.run_once(IO());self.assertEqual(result['result'],'unconfirmed');self.assertFalse(result['rollback_verified'])

    def test_public_fixture_is_encoded_and_both_rollback_boundaries_survive_rendering(self):
        sql=Path(__file__).with_name('SPECS_SUBMIT_ROLLBACK.sql').read_text()
        fixture=b"Synthetic ';COMMIT;SELECT private;--"
        rendered=module.render_repro(sql,"select '{}'::jsonb as specs_submit_state",{'synthetic':True},fixture)
        self.assertNotIn(fixture.decode(),rendered)
        self.assertIn("raise exception using errcode='P7001'",rendered)
        self.assertTrue(rendered.rstrip().endswith('rollback;'))
        self.assertNotIn('__BRIEF_B64__',rendered)
        with self.assertRaises(ValueError):module.render_repro(sql+'\nCOMMIT;',"select '{}'",{},fixture)


if __name__=='__main__':unittest.main()
